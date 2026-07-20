use std::sync::{Arc, OnceLock};

use anyhow::{Context, Result};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

/// 1 MiB 许可粒度。
pub(crate) const MIB: u64 = 1024 * 1024;
/// 并发转换估算硬顶：2 GiB。
pub(crate) const HARD_CAP_BYTES: u64 = 2 * 1024 * 1024 * 1024;
/// 可用物理内存的使用比例。
pub(crate) const AVAILABLE_FRACTION_NUM: u64 = 1;
pub(crate) const AVAILABLE_FRACTION_DEN: u64 = 2;

/// 根据可用物理内存计算预算容量（字节）。
pub(crate) fn capacity_from_available_bytes(available: u64) -> u64 {
    let half = available / AVAILABLE_FRACTION_DEN * AVAILABLE_FRACTION_NUM;
    let capped = half.min(HARD_CAP_BYTES);
    // 至少 1 MiB，避免零容量死锁。
    capped.max(MIB)
}

/// 将字节估算转为 MiB 许可数（向上取整，至少 1）。
pub(crate) fn bytes_to_permits(bytes: u64, capacity_bytes: u64) -> u32 {
    if capacity_bytes == 0 {
        return 1;
    }
    let needed = bytes.max(1).div_ceil(MIB);
    let capacity_mib = capacity_bytes.div_ceil(MIB).max(1);
    // 超大任务占用整个池。
    let permits = needed.min(capacity_mib);
    u32::try_from(permits).unwrap_or(u32::MAX).max(1)
}

pub(crate) struct MemoryBudget {
    capacity_bytes: u64,
    semaphore: Arc<Semaphore>,
}

impl MemoryBudget {
    pub(crate) fn new(capacity_bytes: u64) -> Self {
        let capacity_bytes = capacity_bytes.max(MIB);
        let permits = capacity_bytes.div_ceil(MIB).max(1);
        let permits = usize::try_from(permits).unwrap_or(usize::MAX);
        Self {
            capacity_bytes,
            semaphore: Arc::new(Semaphore::new(permits)),
        }
    }

    #[cfg(test)]
    pub(crate) fn capacity_bytes(&self) -> u64 {
        self.capacity_bytes
    }

    #[cfg(test)]
    pub(crate) fn available_permits(&self) -> usize {
        self.semaphore.available_permits()
    }

    /// 按估算字节获取加权许可；超大任务拿满整个池。
    pub(crate) async fn acquire(&self, estimated_bytes: u64) -> Result<OwnedSemaphorePermit> {
        let n = bytes_to_permits(estimated_bytes, self.capacity_bytes);
        self.semaphore
            .clone()
            .acquire_many_owned(n)
            .await
            .context("内存预算信号量已关闭")
    }

    /// 同步测试辅助：尝试立即获取，失败返回 None。
    #[cfg(test)]
    pub(crate) fn try_acquire(&self, estimated_bytes: u64) -> Option<OwnedSemaphorePermit> {
        let n = bytes_to_permits(estimated_bytes, self.capacity_bytes);
        self.semaphore.clone().try_acquire_many_owned(n).ok()
    }
}

static PROCESS_BUDGET: OnceLock<MemoryBudget> = OnceLock::new();

fn refresh_available_memory_bytes() -> u64 {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    system.available_memory()
}

/// 进程级懒初始化预算，基于当前可用内存。
pub(crate) fn process_memory_budget() -> &'static MemoryBudget {
    PROCESS_BUDGET.get_or_init(|| {
        let available = refresh_available_memory_bytes();
        let capacity = capacity_from_available_bytes(available);
        MemoryBudget::new(capacity)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn capacity_caps_at_2gib_and_half_available() {
        let eight_gib = 8 * 1024 * 1024 * 1024u64;
        assert_eq!(capacity_from_available_bytes(eight_gib), HARD_CAP_BYTES);

        let one_gib = 1024 * 1024 * 1024u64;
        assert_eq!(capacity_from_available_bytes(one_gib), one_gib / 2);

        assert_eq!(capacity_from_available_bytes(0), MIB);
        assert_eq!(capacity_from_available_bytes(100), MIB);
    }

    #[test]
    fn bytes_to_permits_rounds_up_and_clamps_to_pool() {
        let capacity = 4 * MIB;
        assert_eq!(bytes_to_permits(1, capacity), 1);
        assert_eq!(bytes_to_permits(MIB, capacity), 1);
        assert_eq!(bytes_to_permits(MIB + 1, capacity), 2);
        assert_eq!(bytes_to_permits(100 * MIB, capacity), 4);
    }

    #[test]
    fn oversized_task_requests_whole_pool() {
        let budget = MemoryBudget::new(4 * MIB);
        let permit = budget
            .try_acquire(100 * MIB)
            .expect("should take whole pool");
        assert_eq!(budget.available_permits(), 0);
        drop(permit);
        assert_eq!(budget.available_permits(), 4);
    }

    #[tokio::test]
    async fn large_waiting_job_is_not_starved_by_stream_of_small_jobs() {
        let budget = Arc::new(MemoryBudget::new(4 * MIB));
        let holder = budget.acquire(4 * MIB).await.unwrap();

        let budget_large = Arc::clone(&budget);
        let large = tokio::spawn(async move {
            let permit = budget_large.acquire(4 * MIB).await.unwrap();
            drop(permit);
            "large"
        });

        // large 进入等待后，持续提交小任务；大任务最终仍应完成（非永久饿死）。
        tokio::time::sleep(Duration::from_millis(20)).await;
        drop(holder);

        let budget_small = Arc::clone(&budget);
        let smalls = tokio::spawn(async move {
            for _ in 0..8 {
                let permit = budget_small.acquire(MIB).await.unwrap();
                drop(permit);
            }
            "smalls"
        });

        let large_result = tokio::time::timeout(Duration::from_secs(2), large)
            .await
            .expect("large timed out");
        assert_eq!(large_result.unwrap(), "large");
        let _ = tokio::time::timeout(Duration::from_secs(2), smalls)
            .await
            .expect("smalls timed out");
    }

    #[tokio::test]
    async fn error_path_releases_permits() {
        let budget = MemoryBudget::new(2 * MIB);
        {
            let _permit = budget.acquire(2 * MIB).await.unwrap();
            // 模拟任务失败：permit 在作用域结束时释放。
        }
        assert_eq!(budget.available_permits(), 2);
        let again = budget.acquire(2 * MIB).await;
        assert!(again.is_ok());
    }

    #[test]
    fn overflow_capacity_construction_stays_sane() {
        // 极大容量不应 panic。
        let budget = MemoryBudget::new(u64::MAX / 2);
        assert!(budget.capacity_bytes() >= MIB);
        assert!(budget.available_permits() >= 1);
    }
}
