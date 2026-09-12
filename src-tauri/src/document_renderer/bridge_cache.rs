//! 进程内 Office→PDF 桥接缓存。
//!
//! 同一源文件（路径 + mtime + size）在改输出格式/质量时复用已导出的私有 PDF，
//! 避免重复启动 Office。缓存命中时复制一份到调用方私有 TempDir，
//! 不改变现有 `PrivatePdfBridge` 的按任务清理语义。

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Instant, SystemTime};

use tempfile::TempDir;

use super::error::{CommandError, CommandErrorCode, RendererStage};

const BRIDGE_FILE_NAME: &str = "bridge.pdf";
const PDF_SIGNATURE: &[u8] = b"%PDF-";
/// 进程内最多保留的桥接 PDF 份数；超出按最久未用淘汰。
const MAX_ENTRIES: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CacheKey {
    path: PathBuf,
    modified_ms: u128,
    len: u64,
}

#[derive(Debug)]
struct CacheEntry {
    /// 持有 master 副本的临时目录；淘汰时随 entry 一起释放。
    _temp_dir: TempDir,
    bridge_path: PathBuf,
    last_used: Instant,
}

#[derive(Debug, Default)]
struct BridgeCacheState {
    entries: HashMap<CacheKey, CacheEntry>,
}

static BRIDGE_CACHE: Mutex<Option<BridgeCacheState>> = Mutex::new(None);

fn with_cache<T>(f: impl FnOnce(&mut BridgeCacheState) -> T) -> T {
    let mut guard = BRIDGE_CACHE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let state = guard.get_or_insert_with(BridgeCacheState::default);
    f(state)
}

/// 测试/设置清理：丢弃全部缓存条目。
pub fn clear_bridge_cache() {
    with_cache(|state| {
        state.entries.clear();
    });
}

#[cfg(test)]
pub fn bridge_cache_len() -> usize {
    with_cache(|state| state.entries.len())
}

/// 从源文件元数据构造缓存键。路径规范化失败时仍用原始路径。
fn cache_key_for_source(source: &Path) -> Result<CacheKey, CommandError> {
    let metadata = fs::metadata(source).map_err(|_| {
        CommandError::new(
            CommandErrorCode::DocumentRendererExportFailed,
            "无法读取源文档元数据",
        )
        .with_stage(RendererStage::Inspect)
    })?;
    if !metadata.is_file() {
        return Err(CommandError::new(
            CommandErrorCode::DocumentRendererExportFailed,
            "源路径不是文件",
        )
        .with_stage(RendererStage::Inspect));
    }
    let modified_ms = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let path = fs::canonicalize(source).unwrap_or_else(|_| source.to_path_buf());
    Ok(CacheKey {
        path,
        modified_ms,
        len: metadata.len(),
    })
}

/// 缓存命中：复制 master 桥接到新的私有 TempDir。
/// 源文件不可读或无元数据时视为未命中（不阻断后续 Office 导出）。
pub fn try_clone_cached_bridge(source: &Path) -> Result<Option<(TempDir, PathBuf)>, CommandError> {
    let Ok(key) = cache_key_for_source(source) else {
        return Ok(None);
    };
    with_cache(|state| {
        let Some(entry) = state.entries.get_mut(&key) else {
            return Ok(None);
        };
        if !entry.bridge_path.is_file() {
            state.entries.remove(&key);
            return Ok(None);
        }
        entry.last_used = Instant::now();
        let master = entry.bridge_path.clone();

        let temp_dir = tempfile::tempdir().map_err(|_| {
            CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "无法创建私有 PDF 工作目录",
            )
            .with_stage(RendererStage::Bridging)
        })?;
        let dest = temp_dir.path().join(BRIDGE_FILE_NAME);
        fs::copy(&master, &dest).map_err(|_| {
            CommandError::new(
                CommandErrorCode::DocumentRendererExportFailed,
                "无法复制缓存的私有 PDF",
            )
            .with_stage(RendererStage::Bridging)
        })?;
        Ok(Some((temp_dir, dest)))
    })
}

/// 将刚导出并校验过的桥接 PDF 写入缓存（复制一份 master）。
/// 源文件元数据不可用时静默跳过，不把缓存失败抬成业务错误。
pub fn store_bridge(source: &Path, bridge_path: &Path) -> Result<(), CommandError> {
    let Ok(key) = cache_key_for_source(source) else {
        return Ok(());
    };
    validate_cached_pdf(bridge_path)?;

    let temp_dir = tempfile::tempdir().map_err(|_| {
        CommandError::new(
            CommandErrorCode::DocumentRendererExportFailed,
            "无法创建 PDF 缓存目录",
        )
        .with_stage(RendererStage::Bridging)
    })?;
    let master = temp_dir.path().join(BRIDGE_FILE_NAME);
    fs::copy(bridge_path, &master).map_err(|_| {
        CommandError::new(
            CommandErrorCode::DocumentRendererExportFailed,
            "无法写入 PDF 缓存",
        )
        .with_stage(RendererStage::Bridging)
    })?;

    with_cache(|state| {
        if state.entries.len() >= MAX_ENTRIES && !state.entries.contains_key(&key) {
            evict_oldest(state);
        }
        state.entries.insert(
            key,
            CacheEntry {
                _temp_dir: temp_dir,
                bridge_path: master,
                last_used: Instant::now(),
            },
        );
    });
    Ok(())
}

fn evict_oldest(state: &mut BridgeCacheState) {
    let oldest = state
        .entries
        .iter()
        .min_by_key(|(_, entry)| entry.last_used)
        .map(|(key, _)| key.clone());
    if let Some(key) = oldest {
        state.entries.remove(&key);
    }
}

fn validate_cached_pdf(path: &Path) -> Result<(), CommandError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| bridge_error("缓存 PDF 不存在"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() == 0 {
        return Err(bridge_error("缓存 PDF 无效"));
    }
    let mut file = fs::File::open(path).map_err(|_| bridge_error("缓存 PDF 不可读"))?;
    let mut signature = [0; PDF_SIGNATURE.len()];
    file.read_exact(&mut signature)
        .map_err(|_| bridge_error("缓存 PDF 无效"))?;
    if signature != PDF_SIGNATURE {
        return Err(bridge_error("缓存内容不是 PDF"));
    }
    Ok(())
}

fn bridge_error(message: &str) -> CommandError {
    CommandError::new(CommandErrorCode::DocumentRendererExportFailed, message)
        .with_stage(RendererStage::Bridging)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::Mutex as StdMutex;
    use std::thread;
    use std::time::Duration;

    /// 进程级缓存是全局状态；单元测试串行化以避免互相污染。
    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    fn write_pdf(path: &Path, body: &[u8]) {
        let mut file = fs::File::create(path).unwrap();
        file.write_all(b"%PDF-1.7\n").unwrap();
        file.write_all(body).unwrap();
    }

    #[test]
    fn bridge_cache_hit_clones_private_copy_and_misses_after_source_change() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        clear_bridge_cache();
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("report.docx");
        fs::write(&source, b"office-bytes-v1").unwrap();

        let export_dir = tempfile::tempdir().unwrap();
        let exported = export_dir.path().join(BRIDGE_FILE_NAME);
        write_pdf(&exported, b"export-v1");

        store_bridge(&source, &exported).unwrap();
        assert_eq!(bridge_cache_len(), 1);

        let (clone_dir, clone_path) = try_clone_cached_bridge(&source).unwrap().unwrap();
        assert!(clone_path.ends_with(BRIDGE_FILE_NAME));
        assert_eq!(fs::read(&clone_path).unwrap(), fs::read(&exported).unwrap());
        // 调用方拿到的是独立副本，drop 后不影响 master。
        drop(clone_dir);
        assert!(try_clone_cached_bridge(&source).unwrap().is_some());

        // 源文件变更后键失效。
        thread::sleep(Duration::from_millis(20));
        fs::write(&source, b"office-bytes-v2").unwrap();
        assert!(try_clone_cached_bridge(&source).unwrap().is_none());
        clear_bridge_cache();
    }

    #[test]
    fn bridge_cache_evicts_oldest_when_full() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        clear_bridge_cache();
        let root = tempfile::tempdir().unwrap();
        for index in 0..MAX_ENTRIES {
            let source = root.path().join(format!("doc-{index}.docx"));
            fs::write(&source, format!("body-{index}")).unwrap();
            let export_dir = tempfile::tempdir().unwrap();
            let exported = export_dir.path().join(BRIDGE_FILE_NAME);
            write_pdf(&exported, format!("pdf-{index}").as_bytes());
            store_bridge(&source, &exported).unwrap();
            thread::sleep(Duration::from_millis(5));
        }
        assert_eq!(bridge_cache_len(), MAX_ENTRIES);

        let newest = root.path().join(format!("doc-{}.docx", MAX_ENTRIES));
        fs::write(&newest, b"body-new").unwrap();
        let export_dir = tempfile::tempdir().unwrap();
        let exported = export_dir.path().join(BRIDGE_FILE_NAME);
        write_pdf(&exported, b"pdf-new");
        store_bridge(&newest, &exported).unwrap();
        assert_eq!(bridge_cache_len(), MAX_ENTRIES);
        // 最早插入的 doc-0 应被淘汰。
        let oldest = root.path().join("doc-0.docx");
        assert!(try_clone_cached_bridge(&oldest).unwrap().is_none());
        assert!(try_clone_cached_bridge(&newest).unwrap().is_some());
        clear_bridge_cache();
    }
}
