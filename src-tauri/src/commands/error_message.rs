//! 对外错误脱敏：避免把完整本地路径、用户主目录等直接回传给前端。

use std::path::Path;

/// 将错误文本中的绝对路径替换为文件名或占位符，保留业务语义。
pub fn redact_user_error(message: impl AsRef<str>) -> String {
    let mut out = message.as_ref().to_string();
    out = redact_windows_paths(&out);
    out = redact_unix_paths(&out);
    out
}

fn redact_windows_paths(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut result = String::with_capacity(input.len());
    let mut i = 0;
    while i < chars.len() {
        // drive letter path: X:\ or X:/
        if i + 2 < chars.len()
            && chars[i].is_ascii_alphabetic()
            && chars[i + 1] == ':'
            && (chars[i + 2] == '\\' || chars[i + 2] == '/')
        {
            let start = i;
            i += 3;
            while i < chars.len() {
                let c = chars[i];
                if c.is_whitespace() || matches!(c, '"' | '\'' | ')' | ',' | ']') {
                    break;
                }
                i += 1;
            }
            let path: String = chars[start..i].iter().collect();
            result.push_str(&redact_path_token(&path));
            continue;
        }

        // UNC path \\server\share\...
        if i + 1 < chars.len() && chars[i] == '\\' && chars[i + 1] == '\\' {
            let start = i;
            i += 2;
            while i < chars.len() {
                let c = chars[i];
                if c.is_whitespace() || matches!(c, '"' | '\'' | ')' | ',') {
                    break;
                }
                i += 1;
            }
            let path: String = chars[start..i].iter().collect();
            result.push_str(&redact_path_token(&path));
            continue;
        }

        result.push(chars[i]);
        i += 1;
    }
    result
}

fn redact_unix_paths(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let is_abs = chars[i] == '/'
            && i + 1 < chars.len()
            && (chars[i + 1].is_alphanumeric() || chars[i + 1] == '.' || chars[i + 1] == '_');
        let boundary_ok = i == 0
            || chars[i - 1].is_whitespace()
            || matches!(chars[i - 1], ':' | '"' | '\'' | '(' | '[' | '=');

        if is_abs && boundary_ok {
            let start = i;
            i += 1;
            while i < chars.len() {
                let c = chars[i];
                if c.is_whitespace() || matches!(c, '"' | '\'' | ')' | ',' | ']' | ';') {
                    break;
                }
                i += 1;
            }
            let path: String = chars[start..i].iter().collect();
            // 至少两段才当作路径（/a/b），避免误伤单独片段。
            if path.matches('/').count() >= 2 {
                result.push_str(&redact_path_token(&path));
                continue;
            }
            result.push_str(&path);
            continue;
        }

        result.push(chars[i]);
        i += 1;
    }
    result
}

fn redact_path_token(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty());
    match name {
        Some(name) => format!("[path:{name}]"),
        None => "[path]".to_string(),
    }
}

/// 统一把 anyhow/错误转成可展示、已脱敏的字符串。
pub fn to_user_error_string(error: impl std::fmt::Display) -> String {
    redact_user_error(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_windows_absolute_path_to_filename() {
        let message = r"cannot open image: C:\Users\Alice\Photos\secret.jpg";
        let redacted = redact_user_error(message);
        assert!(!redacted.contains(r"C:\Users"));
        assert!(!redacted.contains("Alice"));
        assert!(redacted.contains("[path:secret.jpg]"));
    }

    #[test]
    fn redacts_unix_absolute_path_to_filename() {
        let message = "cannot write output: /home/bob/docs/out.png";
        let redacted = redact_user_error(message);
        assert!(!redacted.contains("/home/bob"));
        assert!(redacted.contains("[path:out.png]"));
    }

    #[test]
    fn keeps_non_path_message() {
        assert_eq!(
            redact_user_error("unsupported output format"),
            "unsupported output format"
        );
    }

    #[test]
    fn keeps_chinese_business_message() {
        let message = "请至少选择 2 张图片进行拼接";
        assert_eq!(redact_user_error(message), message);
    }
}
