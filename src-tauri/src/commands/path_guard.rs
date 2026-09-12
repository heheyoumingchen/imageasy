//! 路径边界校验：防止 command 层对敏感系统目录或明显非法路径做读写。

use anyhow::{bail, Context, Result};
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

/// 规范化已存在路径；不存在时规范化父目录并拼回文件名。
pub fn canonicalize_existing(path: &Path) -> Result<PathBuf> {
    path.canonicalize()
        .with_context(|| format!("无法访问路径: {}", path.display()))
}

/// 校验输入是已存在的普通文件。
pub fn require_existing_file(path: &Path) -> Result<PathBuf> {
    let canonical = canonicalize_existing(path)?;
    let metadata = fs::metadata(&canonical)
        .with_context(|| format!("无法读取路径元数据: {}", canonical.display()))?;
    if !metadata.is_file() {
        bail!("路径不是文件: {}", path.display());
    }
    reject_sensitive_system_path(&canonical)?;
    Ok(canonical)
}

/// 校验输入是已存在的目录。
pub fn require_existing_dir(path: &Path) -> Result<PathBuf> {
    let trimmed = path.as_os_str();
    if trimmed.is_empty() {
        bail!("目录路径不能为空");
    }
    if !path.exists() {
        bail!("目录不存在: {}", path.display());
    }
    let canonical = canonicalize_existing(path)?;
    let metadata = fs::metadata(&canonical)
        .with_context(|| format!("无法读取目录元数据: {}", canonical.display()))?;
    if !metadata.is_dir() {
        bail!("路径不是目录: {}", path.display());
    }
    reject_sensitive_system_path(&canonical)?;
    Ok(canonical)
}

/// 确保输出目录可用：必须是绝对路径（或可规范化），禁止敏感系统目录，必要时创建。
pub fn ensure_output_directory(path: &Path) -> Result<PathBuf> {
    if path.as_os_str().is_empty() {
        bail!("输出目录不能为空");
    }
    reject_path_traversal_components(path)?;

    if path.exists() {
        return require_existing_dir(path);
    }

    // 输出目录尚不存在时，要求至少能定位到一个已存在的祖先，避免写到漂移相对路径。
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .context("无法获取当前目录")?
            .join(path)
    };
    reject_sensitive_system_path(&absolute)?;

    fs::create_dir_all(&absolute)
        .with_context(|| format!("无法创建输出目录: {}", absolute.display()))?;
    require_existing_dir(&absolute)
}

/// 确保输出文件路径可写：父目录必须通过输出目录校验。
pub fn ensure_output_file_path(path: &Path) -> Result<PathBuf> {
    if path.as_os_str().is_empty() {
        bail!("输出路径不能为空");
    }
    reject_path_traversal_components(path)?;
    if path
        .file_name()
        .and_then(|name| name.to_str())
        .is_none_or(|name| name.is_empty() || name == "." || name == "..")
    {
        bail!("输出路径缺少有效文件名");
    }

    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty());
    let parent = match parent {
        Some(parent) => ensure_output_directory(parent)?,
        None => std::env::current_dir().context("无法获取当前目录")?,
    };
    let file_name = path.file_name().context("输出路径缺少文件名")?;
    let candidate = parent.join(file_name);
    reject_sensitive_system_path(&candidate)?;
    Ok(candidate)
}

fn reject_path_traversal_components(path: &Path) -> Result<()> {
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            bail!("路径不允许包含 '..'");
        }
    }
    Ok(())
}

/// 拒绝写入/打开明显危险的系统目录，降低被劫持前端后的破坏面。
pub fn reject_sensitive_system_path(path: &Path) -> Result<()> {
    let normalized = path
        .to_string_lossy()
        .replace('/', "\\")
        .to_ascii_lowercase();

    #[cfg(windows)]
    {
        let sensitive_markers = [
            "\\windows\\system32",
            "\\windows\\syswow64",
            "\\windows\\winsxs",
            "\\program files\\",
            "\\program files (x86)\\",
            "\\$recycle.bin",
            "\\boot\\",
            "\\efi\\",
        ];
        for marker in sensitive_markers {
            if normalized.contains(marker) {
                bail!("拒绝访问受保护的系统路径");
            }
        }

        // 盘符根目录本身不允许作为输出目录（如 C:\）。
        let bytes = normalized.as_bytes();
        let is_drive_root = (bytes.len() == 2 && bytes[1] == b':')
            || (bytes.len() == 3 && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/'));
        if is_drive_root {
            bail!("拒绝将盘符根目录作为输出目标");
        }
    }

    #[cfg(not(windows))]
    {
        let sensitive_prefixes = [
            "/bin",
            "/sbin",
            "/usr/bin",
            "/usr/sbin",
            "/etc",
            "/boot",
            "/dev",
            "/proc",
            "/sys",
        ];
        for prefix in sensitive_prefixes {
            if normalized == prefix || normalized.starts_with(&format!("{prefix}/")) {
                bail!("拒绝访问受保护的系统路径");
            }
        }
        if normalized == "/" {
            bail!("拒绝将系统根目录作为输出目标");
        }
    }

    let _ = normalized;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn require_existing_file_rejects_directory() {
        let dir = tempdir().unwrap();
        let error = require_existing_file(dir.path()).unwrap_err();
        assert!(error.to_string().contains("不是文件"));
    }

    #[test]
    fn ensure_output_directory_creates_missing_dir() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("nested").join("out");
        let created = ensure_output_directory(&target).unwrap();
        assert!(created.is_dir());
    }

    #[test]
    fn ensure_output_file_path_rejects_parent_dir_component() {
        let dir = tempdir().unwrap();
        let sneaky = dir.path().join("..").join("escape.txt");
        let error = ensure_output_file_path(&sneaky).unwrap_err();
        assert!(error.to_string().contains(".."));
    }

    #[test]
    fn reject_sensitive_windows_system32() {
        #[cfg(windows)]
        {
            let error = reject_sensitive_system_path(Path::new(r"C:\Windows\System32\drivers"))
                .unwrap_err();
            assert!(error.to_string().contains("受保护"));
        }
    }
}
