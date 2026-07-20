use std::path::PathBuf;
use std::sync::OnceLock;

/// 便携模式检测与路径管理。
///
/// 当可执行文件同级目录存在 `.portable` 标记文件时，应用进入便携模式：
/// - 设置文件存放在程序目录的 `data/` 子目录
/// - 缓存文件存放在程序目录的 `cache/` 子目录
///
/// 否则走系统默认路径（临时目录、当前目录）。
static PORTABLE_STATE: OnceLock<PortableState> = OnceLock::new();

#[derive(Debug)]
struct PortableState {
    enabled: bool,
    exe_dir: PathBuf,
}

fn detect() -> PortableState {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let marker = exe_dir.join(".portable");
    PortableState {
        enabled: marker.exists(),
        exe_dir,
    }
}

fn state() -> &'static PortableState {
    PORTABLE_STATE.get_or_init(detect)
}

/// 是否处于便携模式
pub fn is_portable() -> bool {
    state().enabled
}

/// 便携模式下的数据目录（程序目录/data），用于存放设置等持久文件。
/// 非便携模式返回 None。
pub fn portable_data_dir() -> Option<PathBuf> {
    if is_portable() {
        Some(state().exe_dir.join("data"))
    } else {
        None
    }
}

/// 便携模式下的缓存目录（程序目录/cache），用于存放缩略图等临时文件。
/// 非便携模式返回 None。
pub fn portable_cache_dir() -> Option<PathBuf> {
    if is_portable() {
        Some(state().exe_dir.join("cache"))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_is_consistent() {
        let s = detect();
        // 测试环境下 .portable 不存在，应为非便携模式
        assert!(!s.enabled || s.exe_dir.join(".portable").exists());
    }
}
