use anyhow::Result;
use std::collections::BTreeSet;

use super::{validate_public_https_url, DownloadableImageItem};

/// Extract the page `<title>` text from an HTML document.
pub(crate) fn extract_page_title(html: &str) -> String {
    let document = scraper::Html::parse_document(html);
    let selector = scraper::Selector::parse("title").unwrap();
    document
        .select(&selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_default()
}

pub fn parse_webpage_images(base_url: &str, html: &str) -> Result<Vec<DownloadableImageItem>> {
    collect_images_from_html(base_url, html, false)
}

pub fn parse_wechat_article_images(
    base_url: &str,
    html: &str,
) -> Result<Vec<DownloadableImageItem>> {
    collect_images_from_html(base_url, html, true)
}

fn stable_image_id(normalized_url: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in normalized_url.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("img-{hash:016x}")
}

pub fn infer_format_from_source(source: &str) -> Option<String> {
    let url = url::Url::parse(source).ok()?;
    let last = url.path_segments()?.next_back()?;
    let ext = last
        .rsplit_once('.')
        .map(|(_, ext)| ext)
        .unwrap_or_default();
    let normalized = ext.to_ascii_lowercase();
    match normalized.as_str() {
        "jpg" | "jpeg" => Some("jpg".into()),
        "png" => Some("png".into()),
        "webp" => Some("webp".into()),
        "gif" => Some("gif".into()),
        "bmp" => Some("bmp".into()),
        "avif" => Some("avif".into()),
        _ => None,
    }
}

fn normalize_embedded_url_candidate(part: &str) -> Option<String> {
    let trimmed = part
        .trim()
        .trim_matches(['"', '\'', '`'])
        .trim_end_matches([',', ';', ']', '}', '\\']);
    let unescaped = trimmed
        .replace("\\/", "/")
        .replace("\\u002F", "/")
        .replace("\\u002f", "/");

    if unescaped.starts_with("https://") || unescaped.starts_with("http://") {
        return Some(unescaped);
    }
    if unescaped.starts_with("//") {
        return Some(format!("https:{unescaped}"));
    }
    None
}

fn extract_image_urls_from_text(text: &str) -> Vec<String> {
    text.split([
        '\"', '\'', '`', ' ', '\n', '\r', '\t', '<', '>', ')', '(', '{', '}',
    ])
    .filter_map(normalize_embedded_url_candidate)
    .filter(|candidate| {
        matches!(
            infer_format_from_source(candidate).as_deref(),
            Some("jpg" | "png" | "webp" | "gif" | "bmp" | "avif")
        )
    })
    .collect()
}

fn collect_images_from_html(
    base_url: &str,
    html: &str,
    article_only: bool,
) -> Result<Vec<DownloadableImageItem>> {
    let document = scraper::Html::parse_document(html);
    let img_selector = scraper::Selector::parse("img").unwrap();
    let source_selector = scraper::Selector::parse("source[srcset]").unwrap();
    let article_selector = scraper::Selector::parse(
        "#page-content, #img-content, #js_content, article, .article-content, .article-detail",
    )
    .unwrap();
    let base = url::Url::parse(base_url)?;
    let mut seen = BTreeSet::new();
    let mut items = Vec::new();

    let roots: Vec<_> = if article_only {
        document.select(&article_selector).collect()
    } else {
        vec![]
    };

    if article_only && roots.is_empty() {
        return Ok(Vec::new());
    }

    let img_nodes: Vec<_> = if article_only {
        roots
            .iter()
            .flat_map(|root| root.select(&img_selector).collect::<Vec<_>>())
            .collect()
    } else {
        document.select(&img_selector).collect()
    };

    let source_nodes: Vec<_> = if article_only {
        roots
            .iter()
            .flat_map(|root| root.select(&source_selector).collect::<Vec<_>>())
            .collect()
    } else {
        document.select(&source_selector).collect()
    };

    for node in img_nodes {
        let candidates: Vec<&str> = [
            node.value().attr("data-src"),
            node.value().attr("data-original"),
            node.value().attr("data-lazy-src"),
            node.value().attr("src"),
        ]
        .into_iter()
        .flatten()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("data:"))
        .collect();

        let srcset_candidates: Vec<String> = node
            .value()
            .attr("srcset")
            .unwrap_or_default()
            .split(',')
            .filter_map(|entry| entry.split_whitespace().next())
            .filter(|s| !s.is_empty() && !s.starts_with("data:"))
            .map(|s| s.to_string())
            .collect();

        let all_candidates: Vec<&str> = candidates
            .iter()
            .copied()
            .chain(srcset_candidates.iter().map(|s| s.as_str()))
            .collect();

        let title = node
            .value()
            .attr("alt")
            .or_else(|| node.value().attr("title"))
            .unwrap_or_default();
        for candidate in all_candidates {
            push_image_item(&base, candidate, title, &mut seen, &mut items);
        }
    }

    for node in source_nodes {
        let srcset_entries: Vec<String> = node
            .value()
            .attr("srcset")
            .unwrap_or_default()
            .split(',')
            .filter_map(|entry| entry.split_whitespace().next())
            .filter(|s| !s.is_empty() && !s.starts_with("data:"))
            .map(|s| s.to_string())
            .collect();

        for candidate in &srcset_entries {
            push_image_item(&base, candidate, "", &mut seen, &mut items);
        }
    }

    if !article_only {
        for candidate in extract_image_urls_from_text(html) {
            push_image_item(&base, &candidate, "", &mut seen, &mut items);
        }
    }

    Ok(items)
}

fn push_image_item(
    base: &url::Url,
    candidate: &str,
    title: &str,
    seen: &mut BTreeSet<String>,
    items: &mut Vec<DownloadableImageItem>,
) {
    let Ok(normalized) = base.join(candidate) else {
        return;
    };
    if validate_public_https_url(normalized.as_str()).is_err() {
        return;
    }
    if !seen.insert(normalized.as_str().to_string()) {
        return;
    }

    let name = normalized
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .filter(|segment| !segment.is_empty())
        .unwrap_or("image")
        .to_string();
    let resolved_title = if title.trim().is_empty() {
        name.clone()
    } else {
        title.trim().to_string()
    };

    items.push(DownloadableImageItem {
        id: stable_image_id(normalized.as_str()),
        source_url: normalized.to_string(),
        name,
        title: resolved_title,
        size_in_bytes: 0,
        format: infer_format_from_source(normalized.as_str()),
        width: None,
        height: None,
        preview_url: normalized.to_string(),
    });
}
