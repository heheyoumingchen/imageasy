//! 文档转换阶段耗时埋点。
//!
//! 仅写诊断日志，不暴露源路径。前端/用户默认不感知；开发与性能分析时看 stderr。

use std::time::Duration;

/// 记录阶段耗时。格式固定，便于 grep / 脚本聚合。
pub fn log_stage_timing(stage: &str, elapsed: Duration) {
    let ms = elapsed.as_secs_f64() * 1_000.0;
    eprintln!("[doc-timing] stage={stage} elapsed_ms={ms:.1}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_stage_timing_accepts_zero() {
        // 仅保证可调用；输出不在此断言。
        log_stage_timing("test_stage", Duration::from_millis(0));
    }
}
