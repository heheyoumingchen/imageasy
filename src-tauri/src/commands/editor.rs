use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, GenericImageView, Rgba};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

const SUPPORTED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp"];

type PreviewCacheKey = String;

static PREVIEW_CACHE: OnceLock<Mutex<HashMap<PreviewCacheKey, DynamicImage>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustmentParams {
    pub brightness: i32,
    pub contrast: i32,
    pub saturation: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorImageSummary {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub width: u32,
    pub height: u32,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorDirectoryImage {
    pub index: usize,
    pub thumbnail_data_url: String,
    #[serde(flatten)]
    pub summary: EditorImageSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenImageSessionResult {
    pub current_image: EditorImageSummary,
    pub directory_images: Vec<EditorDirectoryImage>,
    pub current_index: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImagePreviewRequest {
    pub path: String,
    pub adjustments: AdjustmentParams,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImagePreviewResult {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageAsJpgRequest {
    pub source_path: String,
    pub target_path: String,
    pub adjustments: AdjustmentParams,
    pub quality: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageAsJpgResult {
    pub saved_path: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn open_image_session(path: String) -> Result<OpenImageSessionResult, String> {
    open_image_session_impl(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn generate_image_preview(request: GenerateImagePreviewRequest) -> Result<GenerateImagePreviewResult, String> {
    generate_image_preview_impl(request).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_image_as_jpg(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult, String> {
    save_image_as_jpg_impl(request).map_err(|error| error.to_string())
}

fn open_image_session_impl(path: &str) -> Result<OpenImageSessionResult> {
    let selected_path = PathBuf::from(path);
    let selected_path = selected_path
        .canonicalize()
        .with_context(|| format!("无法访问文件: {path}"))?;

    if !is_supported_image(&selected_path) {
        anyhow::bail!("不支持的图片格式");
    }

    let parent = selected_path.parent().context("无法定位图片所在目录")?;
    let mut sibling_paths = fs::read_dir(parent)
        .with_context(|| format!("无法读取目录: {}", parent.display()))?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|entry_path| entry_path.is_file() && is_supported_image(entry_path))
        .collect::<Vec<_>>();

    sibling_paths.sort_by(|left, right| {
        let left_name = left.file_name().and_then(|name| name.to_str()).unwrap_or_default();
        let right_name = right.file_name().and_then(|name| name.to_str()).unwrap_or_default();
        left_name.cmp(right_name)
    });

    let directory_images = sibling_paths
        .iter()
        .enumerate()
        .map(|(index, sibling_path)| {
            Ok(EditorDirectoryImage {
                index,
                thumbnail_data_url: create_thumbnail_data_url(sibling_path, 128, 58)?,
                summary: read_image_summary(sibling_path)?,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    let current_index = sibling_paths
        .iter()
        .position(|entry| entry == &selected_path)
        .context("未能在目录列表中定位当前图片")?;

    let current_image = directory_images[current_index].summary.clone();

    Ok(OpenImageSessionResult {
        current_image,
        directory_images,
        current_index,
    })
}

fn generate_image_preview_impl(request: GenerateImagePreviewRequest) -> Result<GenerateImagePreviewResult> {
    let preview_width = request.max_width.unwrap_or(560);
    let preview_height = request.max_height.unwrap_or(420);
    let prepared = get_or_prepare_preview_image(&request.path, preview_width, preview_height)?;
    let processed = process_preview_image(prepared.clone(), &request.adjustments);

    let (width, height) = processed.dimensions();
    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 60);
    encoder.encode_image(&processed)?;
    let encoded = STANDARD.encode(buffer.into_inner());

    Ok(GenerateImagePreviewResult {
        data_url: format!("data:image/jpeg;base64,{encoded}"),
        width,
        height,
    })
}

fn save_image_as_jpg_impl(request: SaveImageAsJpgRequest) -> Result<SaveImageAsJpgResult> {
    let source_image = image::open(&request.source_path)
        .with_context(|| format!("无法打开图片: {}", request.source_path))?;
    let processed = process_full_image(source_image, &request.adjustments);

    let target_path = PathBuf::from(&request.target_path);
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
    }

    let quality = request.quality.unwrap_or(90);
    let file = fs::File::create(&target_path)
        .with_context(|| format!("无法创建输出文件: {}", target_path.display()))?;
    let mut writer = std::io::BufWriter::new(file);
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, quality);
    encoder.encode_image(&processed)?;
    drop(writer);

    let metadata = fs::metadata(&target_path)
        .with_context(|| format!("无法读取输出文件信息: {}", target_path.display()))?;

    Ok(SaveImageAsJpgResult {
        saved_path: target_path.to_string_lossy().into_owned(),
        size_bytes: metadata.len(),
    })
}

fn process_preview_image(source: DynamicImage, adjustments: &AdjustmentParams) -> DynamicImage {
    let mut image = source.brighten(adjustments.brightness);
    image = image.adjust_contrast(adjustments.contrast as f32);
    apply_saturation(image, adjustments.saturation as f32 / 100.0)
}

fn process_full_image(source: DynamicImage, adjustments: &AdjustmentParams) -> DynamicImage {
    let mut image = source.brighten(adjustments.brightness);
    image = image.adjust_contrast(adjustments.contrast as f32);
    apply_saturation(image, adjustments.saturation as f32 / 100.0)
}

fn get_or_prepare_preview_image(path: &str, width: u32, height: u32) -> Result<DynamicImage> {
    let cache_key = format!("{path}::{width}x{height}");
    let cache = PREVIEW_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Some(image) = cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .get(&cache_key)
        .cloned()
    {
        return Ok(image);
    }

    let source_image = image::open(path).with_context(|| format!("无法打开图片: {path}"))?;
    let prepared = source_image.resize(width, height, FilterType::Nearest);

    cache
        .lock()
        .map_err(|_| anyhow::anyhow!("预览缓存不可用"))?
        .insert(cache_key, prepared.clone());

    Ok(prepared)
}

fn create_thumbnail_data_url(path: &Path, size: u32, quality: u8) -> Result<String> {
    let image = image::open(path).with_context(|| format!("无法打开缩略图源文件: {}", path.display()))?;
    let thumbnail = image.resize(size, size, FilterType::Nearest);
    let mut buffer = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
    encoder.encode_image(&thumbnail)?;
    let encoded = STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}

fn apply_saturation(image: DynamicImage, amount: f32) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let gray = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
        let factor = 1.0 + amount;
        let nr = ((gray + (r as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        let ng = ((gray + (g as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        let nb = ((gray + (b as f32 - gray) * factor).round()).clamp(0.0, 255.0) as u8;
        *pixel = Rgba([nr, ng, nb, a]);
    }
    DynamicImage::ImageRgba8(rgba)
}

fn read_image_summary(path: &Path) -> Result<EditorImageSummary> {
    let metadata = fs::metadata(path)
        .with_context(|| format!("无法读取文件信息: {}", path.display()))?;
    let dimensions = image::image_dimensions(path)
        .with_context(|| format!("无法读取图片尺寸: {}", path.display()))?;

    Ok(EditorImageSummary {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().and_then(|name| name.to_str()).unwrap_or_default().to_string(),
        extension: path.extension().and_then(|extension| extension.to_str()).unwrap_or_default().to_ascii_lowercase(),
        width: dimensions.0,
        height: dimensions.1,
        size_bytes: metadata.len(),
    })
}

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| SUPPORTED_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}
