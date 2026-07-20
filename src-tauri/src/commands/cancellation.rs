//! 批处理任务取消令牌。
//!
//! 前端为一次批次注册 `task_id`，取消时 `cancel_task` 置位；长任务循环轮询
//! [`CancellationToken::check`]。当前项在检查点之间仍会跑完，但多页/多图循环可在下一轮停止。

use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};

/// 对外稳定文案：前端据此识别“取消”而非业务失败。
pub const CANCELLED_MESSAGE: &str = "任务已取消";

fn registry() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 注册可取消任务；重复注册会复用已有 flag（不会清掉已取消状态）。
pub fn register_task(task_id: String) {
    let trimmed = task_id.trim();
    if trimmed.is_empty() {
        return;
    }
    let mut map = registry().lock().expect("cancellation registry");
    map.entry(trimmed.to_string())
        .or_insert_with(|| Arc::new(AtomicBool::new(false)));
}

/// 请求取消；返回是否找到该任务。
pub fn cancel_task(task_id: String) -> bool {
    let trimmed = task_id.trim();
    if trimmed.is_empty() {
        return false;
    }
    let map = registry().lock().expect("cancellation registry");
    if let Some(flag) = map.get(trimmed) {
        flag.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
}

/// 任务结束时移除注册，避免 flag 泄漏。
pub fn complete_task(task_id: String) {
    let trimmed = task_id.trim();
    if trimmed.is_empty() {
        return;
    }
    let mut map = registry().lock().expect("cancellation registry");
    map.remove(trimmed);
}

/// 获取令牌；未知 id 时自动注册（兼容未先调用 register 的路径）。
pub fn token_for(task_id: Option<&str>) -> Option<CancellationToken> {
    let id = task_id.map(str::trim).filter(|value| !value.is_empty())?;
    let mut map = registry().lock().expect("cancellation registry");
    let flag = map
        .entry(id.to_string())
        .or_insert_with(|| Arc::new(AtomicBool::new(false)))
        .clone();
    Some(CancellationToken { flag })
}

#[derive(Clone, Debug)]
pub struct CancellationToken {
    flag: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::SeqCst)
    }

    pub fn check(&self) -> anyhow::Result<()> {
        if self.is_cancelled() {
            anyhow::bail!(CANCELLED_MESSAGE);
        }
        Ok(())
    }
}

/// 作用域结束时自动 complete_task。
pub struct TaskGuard {
    task_id: Option<String>,
}

impl TaskGuard {
    pub fn new(task_id: Option<String>) -> Self {
        let task_id = task_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        if let Some(id) = task_id.as_ref() {
            register_task(id.clone());
        }
        Self { task_id }
    }
}

impl Drop for TaskGuard {
    fn drop(&mut self) {
        if let Some(id) = self.task_id.take() {
            complete_task(id);
        }
    }
}

pub fn check_optional(token: Option<&CancellationToken>) -> anyhow::Result<()> {
    if let Some(token) = token {
        token.check()?;
    }
    Ok(())
}

pub fn is_cancelled_message(message: &str) -> bool {
    message.contains(CANCELLED_MESSAGE)
}

#[tauri::command]
pub fn register_batch_task(task_id: String) {
    register_task(task_id);
}

#[tauri::command]
pub fn cancel_batch_task(task_id: String) -> bool {
    cancel_task(task_id)
}

#[tauri::command]
pub fn complete_batch_task(task_id: String) {
    complete_task(task_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_stops_subsequent_checks() {
        let id = format!("test-{}", std::process::id());
        register_task(id.clone());
        let token = token_for(Some(&id)).expect("token");
        assert!(token.check().is_ok());
        assert!(cancel_task(id.clone()));
        assert!(token.is_cancelled());
        assert!(token.check().is_err());
        complete_task(id);
    }

    #[test]
    fn guard_removes_registration_on_drop() {
        let id = format!("guard-{}", std::process::id());
        {
            let _guard = TaskGuard::new(Some(id.clone()));
            assert!(token_for(Some(&id)).is_some());
            cancel_task(id.clone());
        }
        // complete 后重新 token_for 会新建未取消的 flag
        let token = token_for(Some(&id)).expect("fresh token");
        assert!(!token.is_cancelled());
        complete_task(id);
    }
}
