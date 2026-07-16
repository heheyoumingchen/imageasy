mod parser;

pub use parser::{infer_format_from_source, parse_webpage_images, parse_wechat_article_images};

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs::{File, OpenOptions},
    io::{ErrorKind, Read, Write},
    net::{Ipv4Addr, Ipv6Addr},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{Emitter, Window};

use parser::extract_page_title;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectDownloadSourceRequest {
    pub mode: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadableImageItem {
    pub id: String,
    pub source_url: String,
    pub name: String,
    pub title: String,
    pub size_in_bytes: u64,
    pub format: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub preview_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDownloadMetadataEvent {
    pub id: String,
    pub size_in_bytes: u64,
    pub format: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectDownloadSourceResult {
    pub page_title: String,
    pub images: Vec<DownloadableImageItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDownloadImagesRequest {
    pub mode: String,
    pub page_url: String,
    pub output_directory: String,
    pub image_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDownloadImagesResult {
    pub saved_count: u32,
    pub skipped_count: u32,
    pub output_paths: Vec<String>,
}

const USER_AGENT: &str = "Mozilla/5.0 (Tauri Image Download Helper)";
const MAX_REDIRECTS: usize = 5;
const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_METADATA_PROBE_ITEMS: usize = 120;
const METADATA_PROBE_WORKERS: usize = 8;
const IMAGE_DOWNLOAD_METADATA_EVENT: &str = "image-download-metadata";

fn validate_mode(mode: &str) -> Result<()> {
    match mode {
        "webpage" | "wechat-article" => Ok(()),
        _ => bail!("不支持的下载模式"),
    }
}

pub(crate) fn validate_public_https_url(input: &str) -> Result<url::Url> {
    let parsed = url::Url::parse(input).context("无效链接")?;
    if parsed.scheme() != "https" {
        bail!("仅支持公开 HTTPS 链接");
    }

    let Some(host) = parsed.host() else {
        bail!("仅支持公开 HTTPS 链接");
    };

    match host {
        url::Host::Domain(domain) => validate_public_domain(domain)?,
        url::Host::Ipv4(address) => validate_public_ipv4(address)?,
        url::Host::Ipv6(address) => validate_public_ipv6(address)?,
    }

    Ok(parsed)
}

fn validate_public_domain(domain: &str) -> Result<()> {
    let normalized = domain.trim_end_matches('.').to_ascii_lowercase();
    if normalized.is_empty()
        || normalized == "localhost"
        || normalized.ends_with(".localhost")
        || normalized.ends_with(".local")
        || !normalized.contains('.')
    {
        bail!("仅支持公开 HTTPS 链接");
    }

    Ok(())
}

fn validate_public_ipv4(address: Ipv4Addr) -> Result<()> {
    let [first, second, _, _] = address.octets();
    let is_shared_address_space = first == 100 && (64..=127).contains(&second);
    let is_benchmarking = first == 198 && matches!(second, 18 | 19);
    let is_reserved = first == 0 || first >= 240;

    if address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_multicast()
        || address.is_broadcast()
        || address.is_documentation()
        || address.is_unspecified()
        || is_shared_address_space
        || is_benchmarking
        || is_reserved
    {
        bail!("仅支持公开 HTTPS 链接");
    }

    Ok(())
}

fn validate_public_ipv6(address: Ipv6Addr) -> Result<()> {
    if let Some(v4) = address.to_ipv4_mapped() {
        return validate_public_ipv4(v4);
    }

    let segments = address.segments();
    let is_unique_local = (segments[0] & 0xfe00) == 0xfc00;
    let is_unicast_link_local = (segments[0] & 0xffc0) == 0xfe80;
    let is_documentation = segments[0] == 0x2001 && segments[1] == 0x0db8;

    if address.is_loopback()
        || address.is_unspecified()
        || is_unique_local
        || is_unicast_link_local
        || address.is_multicast()
        || is_documentation
    {
        bail!("仅支持公开 HTTPS 链接");
    }

    Ok(())
}

pub fn download_thumbnail_cache_dir() -> Result<PathBuf> {
    let dir = if let Some(cache) = crate::portable::portable_cache_dir() {
        cache.join("download-thumbnails")
    } else {
        std::env::temp_dir()
            .join("imageasy")
            .join("download-thumbnails")
    };
    std::fs::create_dir_all(&dir).context("无法创建缩略图缓存目录")?;
    Ok(dir)
}

pub fn thumbnail_cache_key_for(source_url: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in source_url.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("thumb-{hash:016x}")
}

pub fn thumbnail_cache_path_for(source_url: &str) -> Result<PathBuf> {
    let extension = infer_format_from_source(source_url).unwrap_or_else(|| "jpg".into());
    Ok(download_thumbnail_cache_dir()?.join(format!(
        "{}.{}",
        thumbnail_cache_key_for(source_url),
        extension
    )))
}

pub fn file_url_for_path(path: &Path) -> Result<String> {
    url::Url::from_file_path(path)
        .map(|url| url.to_string())
        .map_err(|_| anyhow::anyhow!("无法生成本地缩略图地址"))
}

pub fn apply_image_response_metadata(
    item: &mut DownloadableImageItem,
    content_type: Option<&str>,
    content_length: Option<u64>,
) {
    if let Some(size_in_bytes) = content_length {
        item.size_in_bytes = size_in_bytes;
    }

    if let Some(content_type) = content_type {
        let inferred = infer_download_extension(Some(content_type), &[], &item.name);
        if inferred != "bin" {
            item.format = Some(inferred);
        }
    }
}

pub fn metadata_event_payload_for(item: &DownloadableImageItem) -> ImageDownloadMetadataEvent {
    ImageDownloadMetadataEvent {
        id: item.id.clone(),
        size_in_bytes: item.size_in_bytes,
        format: item.format.clone(),
    }
}

pub fn metadata_probe_candidates_for(
    items: &[DownloadableImageItem],
) -> Vec<DownloadableImageItem> {
    items
        .iter()
        .take(MAX_METADATA_PROBE_ITEMS)
        .cloned()
        .collect()
}

fn probe_image_response_metadata(
    source_url: &str,
    page_url: &url::Url,
) -> Result<(Option<String>, Option<u64>)> {
    let response = fetch_head_response(source_url, Some(page_url), Duration::from_secs(5))?;
    let content_type = response.header("Content-Type").map(str::to_string);
    let content_length = response
        .header("Content-Length")
        .and_then(|value| value.parse::<u64>().ok());
    Ok((content_type, content_length))
}

fn spawn_metadata_probe(window: Window, page_url: url::Url, items: Vec<DownloadableImageItem>) {
    std::thread::spawn(move || {
        let (work_tx, work_rx) = std::sync::mpsc::channel::<DownloadableImageItem>();
        let work_rx = std::sync::Arc::new(std::sync::Mutex::new(work_rx));
        let mut workers = Vec::new();

        for _ in 0..METADATA_PROBE_WORKERS {
            let worker_rx = std::sync::Arc::clone(&work_rx);
            let worker_window = window.clone();
            let worker_page_url = page_url.clone();
            workers.push(std::thread::spawn(move || loop {
                let Ok(mut item) = worker_rx.lock().expect("metadata queue poisoned").recv() else {
                    break;
                };

                if let Ok((content_type, content_length)) =
                    probe_image_response_metadata(&item.source_url, &worker_page_url)
                {
                    apply_image_response_metadata(
                        &mut item,
                        content_type.as_deref(),
                        content_length,
                    );
                    let _ = worker_window.emit(
                        IMAGE_DOWNLOAD_METADATA_EVENT,
                        metadata_event_payload_for(&item),
                    );
                }
            }));
        }

        for item in items {
            if work_tx.send(item).is_err() {
                break;
            }
        }
        drop(work_tx);

        for worker in workers {
            let _ = worker.join();
        }
    });
}

fn is_windows_reserved_name(stem: &str) -> bool {
    let device_stem = stem.split('.').next().unwrap_or(stem);
    let upper = device_stem.to_ascii_uppercase();
    matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (upper.len() == 4
            && (upper.starts_with("COM") || upper.starts_with("LPT"))
            && upper.as_bytes()[3].is_ascii_digit()
            && upper.as_bytes()[3] != b'0')
}

pub fn build_safe_output_name(source_name: &str, extension: &str, index: usize) -> String {
    let base = source_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(source_name);
    let cleaned: String = base
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();
    let cleaned = cleaned.replace("..", "-");
    let trimmed = cleaned
        .trim_matches('-')
        .trim_end_matches([' ', '.'])
        .trim_matches('-')
        .to_string();
    let stem = if trimmed.is_empty() || is_windows_reserved_name(&trimmed) {
        format!("image-{:03}", index)
    } else {
        trimmed
    };
    format!("{}.{}", stem, extension)
}

fn create_unique_output_file(dir: &Path, file_name: &str) -> Result<(PathBuf, File)> {
    let (stem, ext) = match file_name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{}", e)),
        None => (file_name.to_string(), String::new()),
    };

    for suffix in 0..1000 {
        let candidate_name = if suffix == 0 {
            file_name.to_string()
        } else {
            format!("{}-{}{}", stem, suffix, ext)
        };
        let candidate = dir.join(candidate_name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => return Ok((candidate, file)),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error).context("无法写入文件"),
        }
    }

    bail!("无法生成唯一文件名")
}

pub fn inspect_download_source_from_html(
    mode: &str,
    url: &str,
    html: &str,
) -> Result<InspectDownloadSourceResult> {
    validate_mode(mode)?;
    let url = validate_public_https_url(url)?;
    let page_title = extract_page_title(html);
    let images = match mode {
        "webpage" => parse_webpage_images(url.as_str(), html)?,
        "wechat-article" => parse_wechat_article_images(url.as_str(), html)?,
        _ => unreachable!(),
    };
    Ok(InspectDownloadSourceResult { page_title, images })
}

fn fetch_response(
    url: &str,
    referer: Option<&url::Url>,
    timeout: Duration,
) -> Result<ureq::Response> {
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(timeout)
        .build();
    let mut current = validate_public_https_url(url)?;

    for _ in 0..=MAX_REDIRECTS {
        let mut request = agent.get(current.as_str()).set("User-Agent", USER_AGENT);
        if let Some(referer) = referer {
            request = request.set("Referer", referer.as_str());
        }

        let response = match request.call() {
            Ok(response) => response,
            Err(ureq::Error::Status(status, response)) if (300..400).contains(&status) => response,
            Err(error) => return Err(error).context("无法获取远程资源"),
        };

        if (300..400).contains(&response.status()) {
            let location = response.header("Location").context("重定向缺少目标")?;
            let next = current.join(location).context("无效重定向链接")?;
            current = validate_public_https_url(next.as_str())?;
            continue;
        }

        return Ok(response);
    }

    bail!("重定向次数过多")
}

fn fetch_head_response(
    url: &str,
    referer: Option<&url::Url>,
    timeout: Duration,
) -> Result<ureq::Response> {
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(timeout)
        .build();
    let mut current = validate_public_https_url(url)?;

    for _ in 0..=MAX_REDIRECTS {
        let mut request = agent.head(current.as_str()).set("User-Agent", USER_AGENT);
        if let Some(referer) = referer {
            request = request.set("Referer", referer.as_str());
        }

        let response = match request.call() {
            Ok(response) => response,
            Err(ureq::Error::Status(status, response)) if (300..400).contains(&status) => response,
            Err(error) => return Err(error).context("无法获取图片元数据"),
        };

        if (300..400).contains(&response.status()) {
            let location = response.header("Location").context("重定向缺少目标")?;
            let next = current.join(location).context("无效重定向链接")?;
            current = validate_public_https_url(next.as_str())?;
            continue;
        }

        return Ok(response);
    }

    bail!("重定向次数过多")
}

fn fetch_html(url: &str) -> Result<String> {
    let response = fetch_response(url, None, Duration::from_secs(15)).context("无法获取页面")?;
    response.into_string().context("无法读取页面内容")
}

pub fn infer_download_extension(
    content_type: Option<&str>,
    bytes: &[u8],
    source_name: &str,
) -> String {
    if let Some(content_type) = content_type {
        match content_type.split(';').next().unwrap_or_default().trim() {
            "image/jpeg" => return "jpg".into(),
            "image/png" => return "png".into(),
            "image/webp" => return "webp".into(),
            "image/gif" => return "gif".into(),
            "image/bmp" => return "bmp".into(),
            _ => {}
        }
    }

    if let Ok(format) = image::guess_format(bytes) {
        return match format {
            image::ImageFormat::Jpeg => "jpg",
            image::ImageFormat::Png => "png",
            image::ImageFormat::WebP => "webp",
            image::ImageFormat::Gif => "gif",
            image::ImageFormat::Bmp => "bmp",
            _ => "bin",
        }
        .into();
    }

    source_name
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase())
        .filter(|extension| !extension.is_empty())
        .unwrap_or_else(|| "bin".into())
}

fn fetch_and_save_remote_image(
    item: &DownloadableImageItem,
    output_dir: &Path,
    index: usize,
    page_url: &url::Url,
) -> Result<PathBuf> {
    let response = fetch_response(&item.source_url, Some(page_url), Duration::from_secs(30))
        .context("无法获取图片")?;
    let content_type = response.header("Content-Type").map(str::to_string);
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(MAX_IMAGE_BYTES)
        .read_to_end(&mut bytes)
        .context("无法读取图片内容")?;

    let extension = infer_download_extension(content_type.as_deref(), &bytes, &item.name);
    let safe_name = build_safe_output_name(&item.name, &extension, index);
    let (target, mut file) = create_unique_output_file(output_dir, &safe_name)?;

    if let Err(error) = file.write_all(&bytes).and_then(|_| file.flush()) {
        let _ = std::fs::remove_file(&target);
        return Err(anyhow::anyhow!("无法写入文件: {error}"));
    }

    Ok(target)
}

fn inspect_download_source_impl(
    request: InspectDownloadSourceRequest,
    window: Window,
) -> Result<InspectDownloadSourceResult> {
    validate_mode(&request.mode)?;
    let url = validate_public_https_url(request.url.trim())?;
    let html = fetch_html(url.as_str())?;
    let result = inspect_download_source_from_html(&request.mode, url.as_str(), &html)?;
    spawn_metadata_probe(window, url, metadata_probe_candidates_for(&result.images));
    Ok(result)
}

fn save_download_images_impl(
    request: SaveDownloadImagesRequest,
) -> Result<SaveDownloadImagesResult> {
    validate_mode(&request.mode)?;
    let page_url = validate_public_https_url(request.page_url.trim())?;
    if request.image_ids.is_empty() {
        bail!("请先选择图片");
    }
    let output_dir = PathBuf::from(request.output_directory.trim());
    if !output_dir.is_dir() {
        bail!("输出目录无效");
    }

    let html = fetch_html(page_url.as_str())?;
    let inspect = inspect_download_source_from_html(&request.mode, page_url.as_str(), &html)?;
    let selected: Vec<_> = inspect
        .images
        .into_iter()
        .filter(|item| request.image_ids.iter().any(|id| id == &item.id))
        .collect();

    let mut output_paths = Vec::new();
    let mut skipped_count: u32 = 0;
    for (index, item) in selected.iter().enumerate() {
        match fetch_and_save_remote_image(item, &output_dir, index + 1, &page_url) {
            Ok(path) => output_paths.push(path.to_string_lossy().into_owned()),
            Err(_) => skipped_count += 1,
        }
    }

    Ok(SaveDownloadImagesResult {
        saved_count: output_paths.len() as u32,
        skipped_count,
        output_paths,
    })
}

#[tauri::command]
pub async fn inspect_download_source(
    request: InspectDownloadSourceRequest,
    window: Window,
) -> Result<InspectDownloadSourceResult, String> {
    inspect_download_source_impl(request, window).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_download_images(
    request: SaveDownloadImagesRequest,
) -> Result<SaveDownloadImagesResult, String> {
    save_download_images_impl(request).map_err(|error| error.to_string())
}
