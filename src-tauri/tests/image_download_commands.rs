use imageasy_lib::commands::image_download::{
    apply_image_response_metadata, build_safe_output_name, infer_download_extension,
    infer_format_from_source, inspect_download_source_from_html, metadata_event_payload_for,
    metadata_probe_candidates_for, parse_webpage_images, parse_wechat_article_images,
    thumbnail_cache_key_for, thumbnail_cache_path_for, validate_resolved_addresses,
};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[test]
fn thumbnail_cache_key_is_stable_for_same_source_url() {
    let first = thumbnail_cache_key_for("https://example.com/a.jpg");
    let second = thumbnail_cache_key_for("https://example.com/a.jpg");

    assert_eq!(first, second);
    assert!(first.starts_with("thumb-"));
}

#[test]
fn thumbnail_cache_path_uses_detected_image_extension() {
    let path = thumbnail_cache_path_for("https://cdn.example.com/photo.webp").unwrap();

    assert!(path.to_string_lossy().ends_with(".webp"));
}

#[test]
fn thumbnail_cache_path_falls_back_to_jpg_without_extension() {
    let path = thumbnail_cache_path_for("https://cdn.example.com/image").unwrap();

    assert!(path.to_string_lossy().ends_with(".jpg"));
}

#[test]
fn file_url_for_thumbnail_cache_path_starts_with_file_scheme() {
    let path = thumbnail_cache_path_for("https://example.com/a.jpg").unwrap();
    let url = imageasy_lib::commands::image_download::file_url_for_path(&path).unwrap();

    assert!(url.starts_with("file://"));
}

#[test]
fn inspect_download_source_rejects_invalid_url() {
    let result = inspect_download_source_from_html("webpage", "not-a-url", "");
    assert!(result.is_err());
}

#[test]
fn inspect_download_source_rejects_invalid_mode() {
    let result =
        inspect_download_source_from_html("unknown", "https://example.com", "<html></html>");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("不支持的下载模式"));
}

#[test]
fn inspect_download_source_rejects_http_url() {
    let result =
        inspect_download_source_from_html("webpage", "http://example.com/post", "<html></html>");

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("公开 HTTPS"));
}

#[test]
fn inspect_download_source_rejects_localhost_https_url() {
    let result =
        inspect_download_source_from_html("webpage", "https://localhost/post", "<html></html>");

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("公开 HTTPS"));
}

#[test]
fn inspect_download_source_rejects_private_ip_https_url() {
    let result =
        inspect_download_source_from_html("webpage", "https://192.168.1.10/post", "<html></html>");

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("公开 HTTPS"));
}

#[test]
fn validate_resolved_addresses_rejects_empty_and_private_records() {
    assert!(validate_resolved_addresses(&[]).is_err());
    assert!(validate_resolved_addresses(&[IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))]).is_err());
    assert!(validate_resolved_addresses(&[IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))]).is_err());
    assert!(validate_resolved_addresses(&[IpAddr::V6(Ipv6Addr::LOCALHOST)]).is_err());
    // 混合记录中只要有一个私网地址就拒绝，防止 rebinding 夹带。
    assert!(validate_resolved_addresses(&[
        IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)),
        IpAddr::V4(Ipv4Addr::new(192, 168, 0, 8)),
    ])
    .is_err());
    assert!(validate_resolved_addresses(&[IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))]).is_ok());
}

#[test]
fn inspect_download_source_rejects_ipv4_mapped_ipv6_private_url() {
    let result = inspect_download_source_from_html(
        "webpage",
        "https://[::ffff:192.168.1.10]/post",
        "<html></html>",
    );

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("公开 HTTPS"));
}

#[test]
fn inspect_download_source_extracts_deduplicated_images_from_webpage_html() {
    let html = r#"
      <html><body>
        <img src="https://example.com/a.jpg" />
        <img data-src="/b.png" />
        <img src="https://example.com/a.jpg" />
      </body></html>
    "#;

    let result = parse_webpage_images("https://example.com/post", html).unwrap();

    assert_eq!(result.len(), 2);
    assert_eq!(result[0].source_url, "https://example.com/a.jpg");
    assert_eq!(result[1].source_url, "https://example.com/b.png");
}

#[test]
fn parse_webpage_images_reads_script_json_urls_and_titles() {
    let html = r#"
      <html><body>
        <img data-src="/cover.jpg" alt="封面图">
        <script>window.__DATA__={"image":"https://example.com/static/news.png"}</script>
      </body></html>
    "#;

    let images = parse_webpage_images("https://example.com/post", html).unwrap();

    assert!(images
        .iter()
        .any(|item| item.source_url == "https://example.com/cover.jpg" && item.title == "封面图"));
    assert!(images
        .iter()
        .any(|item| item.source_url == "https://example.com/static/news.png"));
}

#[test]
fn infer_download_format_from_source_name() {
    assert_eq!(
        infer_format_from_source("https://example.com/a.webp"),
        Some("webp".to_string())
    );
    assert_eq!(infer_format_from_source("https://example.com/a"), None);
}

#[test]
fn parse_webpage_images_reads_escaped_script_image_urls() {
    let html = r#"
      <html><body>
        <script>window.__NEXT_DATA__={"image":"https:\/\/img.36krcdn.com\/photo\/2026\/demo.jpeg?x-oss-process=image\/resize,w_600"}</script>
      </body></html>
    "#;

    let images = parse_webpage_images("https://www.36kr.com/", html).unwrap();

    assert!(images.iter().any(|item| item
        .source_url
        .starts_with("https://img.36krcdn.com/photo/2026/demo.jpeg")));
}

#[test]
fn parse_webpage_images_reads_protocol_relative_script_image_urls() {
    let html = r#"
      <html><body>
        <script>{"cover":"//cdn.example.com/path/cover.png"}</script>
      </body></html>
    "#;

    let images = parse_webpage_images("https://example.com/post", html).unwrap();

    assert!(images
        .iter()
        .any(|item| item.source_url == "https://cdn.example.com/path/cover.png"));
}

#[test]
fn parse_webpage_images_uses_url_stable_ids() {
    let first_html = r#"
      <html><body>
        <img src="/a.jpg" />
        <img src="/b.png" />
      </body></html>
    "#;
    let second_html = r#"
      <html><body>
        <img src="/inserted.webp" />
        <img src="/a.jpg" />
        <img src="/b.png" />
      </body></html>
    "#;

    let first = parse_webpage_images("https://example.com/post", first_html).unwrap();
    let second = parse_webpage_images("https://example.com/post", second_html).unwrap();
    let first_a = first
        .iter()
        .find(|item| item.source_url == "https://example.com/a.jpg")
        .unwrap();
    let second_a = second
        .iter()
        .find(|item| item.source_url == "https://example.com/a.jpg")
        .unwrap();

    assert_eq!(first_a.id, second_a.id);
    assert!(first_a.id.starts_with("img-"));
}

#[test]
fn parse_wechat_article_images_only_returns_article_body_images() {
    let html = r#"
      <html><body>
        <div id="page-content">
          <img data-src="https://mmbiz.qpic.cn/body-1.png" />
        </div>
        <div class="profile_meta">
          <img src="https://mmbiz.qpic.cn/avatar.png" />
        </div>
      </body></html>
    "#;

    let result = parse_wechat_article_images("https://mp.weixin.qq.com/s/demo", html).unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].source_url, "https://mmbiz.qpic.cn/body-1.png");
}

#[test]
fn parse_wechat_article_images_falls_back_to_document_scan_without_article_container() {
    let html = r#"
      <html><body>
        <div class="profile_meta">
          <img src="https://mmbiz.qpic.cn/avatar.png" />
        </div>
      </body></html>
    "#;

    let result = parse_wechat_article_images("https://mp.weixin.qq.com/s/demo", html).unwrap();

    // 找不到文章容器时不再返回空，而是回退为全文扫描。
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].source_url, "https://mmbiz.qpic.cn/avatar.png");
}

#[test]
fn parse_webpage_images_extracts_og_image_and_lazy_attrs() {
    let html = r#"
      <html>
        <head>
          <meta property="og:image" content="https://cdn.example.com/hero.jpg" />
        </head>
        <body>
          <img data-actualsrc="https://pic.example.com/lazy-1.jpg" src="data:image/svg;base64,xxx" />
        </body>
      </html>
    "#;

    let result = parse_webpage_images("https://example.com/post", html).unwrap();

    let urls: Vec<&str> = result.iter().map(|item| item.source_url.as_str()).collect();
    assert!(urls.contains(&"https://cdn.example.com/hero.jpg"));
    assert!(urls.contains(&"https://pic.example.com/lazy-1.jpg"));
}

#[test]
fn inspect_download_source_returns_page_title_and_items() {
    let html = r#"
      <html>
        <head><title>示例文章</title></head>
        <body><img src="https://example.com/a.jpg" /></body>
      </html>
    "#;

    let result =
        inspect_download_source_from_html("webpage", "https://example.com/post", html).unwrap();

    assert_eq!(result.page_title, "示例文章");
    assert_eq!(result.images.len(), 1);
    assert_eq!(result.images[0].name, "a.jpg");
}

#[test]
fn inspect_download_source_from_html_keeps_preview_remote_until_runtime_inspection() {
    let html = r#"
      <html><body><img src="https://example.com/a.jpg" /></body></html>
    "#;

    let result =
        inspect_download_source_from_html("webpage", "https://example.com/post", html).unwrap();

    assert_eq!(result.images[0].preview_url, "https://example.com/a.jpg");
}

#[test]
fn inspect_download_source_from_html_infers_static_metadata_without_network() {
    let html = r#"
      <html><body><img src="https://example.com/a.webp" /></body></html>
    "#;

    let result =
        inspect_download_source_from_html("webpage", "https://example.com/post", html).unwrap();

    assert_eq!(result.images[0].size_in_bytes, 0);
    assert_eq!(result.images[0].format.as_deref(), Some("webp"));
}

#[test]
fn metadata_event_payload_uses_item_id_size_and_format() {
    let html = r#"
      <html><body><img src="https://example.com/a.jpg" /></body></html>
    "#;
    let mut item = inspect_download_source_from_html("webpage", "https://example.com/post", html)
        .unwrap()
        .images
        .remove(0);
    item.size_in_bytes = 4096;
    item.format = Some("png".into());

    let payload = metadata_event_payload_for(&item);

    assert_eq!(payload.id, item.id);
    assert_eq!(payload.size_in_bytes, 4096);
    assert_eq!(payload.format.as_deref(), Some("png"));
}

#[test]
fn metadata_probe_candidates_are_limited_to_first_120_items() {
    let html = (0..130)
        .map(|index| format!(r#"<img src="https://example.com/{index}.jpg" />"#))
        .collect::<Vec<_>>()
        .join("\n");
    let result =
        inspect_download_source_from_html("webpage", "https://example.com/post", &html).unwrap();

    let candidates = metadata_probe_candidates_for(&result.images);

    assert_eq!(candidates.len(), 120);
    assert_eq!(candidates[0].source_url, "https://example.com/0.jpg");
    assert_eq!(candidates[119].source_url, "https://example.com/119.jpg");
}

#[test]
fn apply_image_response_metadata_updates_size_and_format() {
    let html = r#"
      <html><body><img src="https://example.com/a.jpg" /></body></html>
    "#;
    let mut item = inspect_download_source_from_html("webpage", "https://example.com/post", html)
        .unwrap()
        .images
        .remove(0);

    apply_image_response_metadata(&mut item, Some("image/png"), Some(4096));

    assert_eq!(item.size_in_bytes, 4096);
    assert_eq!(item.format.as_deref(), Some("png"));
}

#[test]
fn build_safe_output_name_strips_traversal_characters() {
    let result = build_safe_output_name("../../a:b*.png", "png", 1);
    assert_eq!(result, "a-b.png");
}

#[test]
fn build_safe_output_name_uses_fallback_for_empty_stem() {
    let result = build_safe_output_name("...", "jpg", 3);
    assert_eq!(result, "image-003.jpg");
}

#[test]
fn build_safe_output_name_trims_windows_trailing_dot_and_space() {
    let result = build_safe_output_name("photo .png", "jpg", 1);

    assert_eq!(result, "photo.jpg");
}

#[test]
fn build_safe_output_name_avoids_windows_reserved_device_names() {
    assert_eq!(build_safe_output_name("CON.png", "png", 1), "image-001.png");
    assert_eq!(
        build_safe_output_name("lpt9.jpg", "jpg", 2),
        "image-002.jpg"
    );
}

#[test]
fn build_safe_output_name_avoids_reserved_device_name_prefixes() {
    assert_eq!(
        build_safe_output_name("CON.foo.jpg", "jpg", 1),
        "image-001.jpg"
    );
}

#[test]
fn parse_webpage_images_handles_data_original_attribute() {
    let html = r#"
      <html><body>
        <img data-original="https://cdn.example.com/photo.webp" />
      </body></html>
    "#;

    let result = parse_webpage_images("https://example.com/page", html).unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].source_url, "https://cdn.example.com/photo.webp");
}

#[test]
fn parse_webpage_images_skips_empty_src() {
    let html = r#"
      <html><body>
        <img src="" />
        <img src="https://example.com/valid.jpg" />
      </body></html>
    "#;

    let result = parse_webpage_images("https://example.com/page", html).unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].source_url, "https://example.com/valid.jpg");
}

#[test]
fn infer_download_extension_uses_content_type() {
    assert_eq!(
        infer_download_extension(Some("image/png"), &[], "photo.jpg"),
        "png"
    );
    assert_eq!(infer_download_extension(Some("image/jpeg"), &[], ""), "jpg");
    assert_eq!(
        infer_download_extension(Some("image/webp; charset=utf-8"), &[], ""),
        "webp"
    );
}

#[test]
fn infer_download_extension_uses_bytes_without_content_type() {
    let png_header = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

    assert_eq!(
        infer_download_extension(None, &png_header, "unknown"),
        "png"
    );
}

#[test]
fn infer_download_extension_falls_back_to_source_name() {
    assert_eq!(
        infer_download_extension(None, &[0x00], "photo.webp"),
        "webp"
    );
    assert_eq!(infer_download_extension(None, &[0x00], "noext"), "bin");
}
