//! 可复现的 Release 图片转换性能证据。
//!
//! 仅在 `benchmarking` feature 下编译：
//!   cargo build   --release --features benchmarking --example conversion_benchmark
//!   cargo run     --release --features benchmarking --example conversion_benchmark -- prepare-fixtures --output <dir>
//!   cargo run     --release --features benchmarking --example conversion_benchmark -- run --fixtures <dir> --report <file>
//!
//! 每个场景在独立子进程中运行，确保常驻集峰值互不污染；父进程汇总为一份 JSON。
//! 正确性失败会让对应场景失败；耗时仅记录，不设固定阈值。

#[cfg(not(feature = "benchmarking"))]
fn main() {
    eprintln!("此示例需要 `--features benchmarking` 才能编译运行。");
    std::process::exit(2);
}

#[cfg(feature = "benchmarking")]
fn main() {
    if let Err(error) = imp::run() {
        eprintln!("benchmark 失败: {error:#}");
        std::process::exit(1);
    }
}

#[cfg(feature = "benchmarking")]
mod imp {
    use anyhow::{bail, Context, Result};
    use imageasy_lib::commands::conversion::benchmarking::{
        environment, fixture_by_name, fixture_path, generate_fixture, hash_file, run_scenario,
        scenario_by_name, BenchEnvironment, FixtureManifest, ScenarioReport, FIXTURES, SCENARIOS,
    };
    use serde::Serialize;
    use std::collections::BTreeMap;
    use std::env;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    #[derive(Debug, Serialize)]
    struct BenchmarkReport {
        environment: BenchEnvironment,
        fixtures: Vec<FixtureManifest>,
        scenarios: Vec<ScenarioReport>,
    }

    pub fn run() -> Result<()> {
        let mut args = env::args().skip(1);
        let command = args
            .next()
            .context("缺少子命令: prepare-fixtures | run | run-one")?;
        let rest: Vec<String> = args.collect();
        match command.as_str() {
            "prepare-fixtures" => prepare_fixtures(&parse_flags(&rest)?),
            "run" => run_all(&parse_flags(&rest)?),
            "run-one" => run_one(&parse_flags(&rest)?),
            other => bail!("未知子命令: {other}"),
        }
    }

    fn parse_flags(args: &[String]) -> Result<BTreeMap<String, String>> {
        let mut flags = BTreeMap::new();
        let mut iter = args.iter();
        while let Some(flag) = iter.next() {
            let key = flag
                .strip_prefix("--")
                .with_context(|| format!("非法参数: {flag}"))?;
            let value = iter.next().with_context(|| format!("参数 {flag} 缺少值"))?;
            flags.insert(key.to_string(), value.clone());
        }
        Ok(flags)
    }

    fn required<'a>(flags: &'a BTreeMap<String, String>, key: &str) -> Result<&'a str> {
        flags
            .get(key)
            .map(String::as_str)
            .with_context(|| format!("缺少 --{key}"))
    }

    fn prepare_fixtures(flags: &BTreeMap<String, String>) -> Result<()> {
        let output = PathBuf::from(required(flags, "output")?);
        for spec in FIXTURES.iter() {
            let manifest = generate_fixture(spec, &output)?;
            eprintln!(
                "生成素材 {} {}x{} {} 字节 hash={}",
                manifest.name, manifest.width, manifest.height, manifest.bytes, manifest.hash
            );
        }
        Ok(())
    }

    fn ensure_fixtures(dir: &Path) -> Result<Vec<FixtureManifest>> {
        let mut manifests = Vec::new();
        for spec in FIXTURES.iter() {
            let path = fixture_path(dir, spec);
            if !path.exists() {
                bail!("素材缺失: {}；请先运行 prepare-fixtures", path.display());
            }
            let hash = hash_file(&path)?;
            manifests.push(FixtureManifest {
                name: spec.name.into(),
                path: path.to_string_lossy().into_owned(),
                width: spec.width,
                height: spec.height,
                bytes: std::fs::metadata(&path)?.len(),
                hash,
            });
        }
        Ok(manifests)
    }

    /// 父进程：为每个场景 spawn 一个 `run-one` 子进程，收集其 stdout 的 JSON 报告。
    fn run_all(flags: &BTreeMap<String, String>) -> Result<()> {
        let fixtures_dir = PathBuf::from(required(flags, "fixtures")?);
        let report_path = PathBuf::from(required(flags, "report")?);
        let manifests = ensure_fixtures(&fixtures_dir)?;
        let out_dir = fixtures_dir.join("outputs");
        let exe = env::current_exe().context("无法定位基准可执行文件")?;

        let mut scenarios = Vec::new();
        let mut any_failed = false;
        for scenario in SCENARIOS.iter() {
            eprintln!("运行场景 {} (素材 {})", scenario.name, scenario.fixture);
            let output = Command::new(&exe)
                .args([
                    "run-one",
                    "--scenario",
                    scenario.name,
                    "--fixtures",
                    &fixtures_dir.to_string_lossy(),
                    "--out",
                    &out_dir.to_string_lossy(),
                ])
                .output()
                .with_context(|| format!("无法启动场景子进程: {}", scenario.name))?;

            if !output.status.success() {
                any_failed = true;
                eprintln!(
                    "场景 {} 子进程失败:\n{}",
                    scenario.name,
                    String::from_utf8_lossy(&output.stderr)
                );
                continue;
            }

            let report: ScenarioReport = serde_json::from_slice(&output.stdout)
                .with_context(|| format!("无法解析场景报告: {}", scenario.name))?;
            if !report.correctness_ok {
                any_failed = true;
                eprintln!(
                    "场景 {} 正确性失败: {}",
                    report.scenario, report.correctness_detail
                );
            }
            eprintln!(
                "场景 {} {} 用时 {:.3} ms 峰值 {:.1} MiB 输出 {} 字节",
                report.scenario,
                report.operation,
                report.timings.total_us as f64 / 1000.0,
                report.peak_working_set_bytes as f64 / (1024.0 * 1024.0),
                report.output_bytes,
            );
            scenarios.push(report);
        }

        let report = BenchmarkReport {
            environment: environment(),
            fixtures: manifests,
            scenarios,
        };
        let json = serde_json::to_string_pretty(&report).context("无法序列化基准报告")?;
        if let Some(parent) = report_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("无法创建报告目录: {}", parent.display()))?;
        }
        std::fs::write(&report_path, json)
            .with_context(|| format!("无法写入报告: {}", report_path.display()))?;
        eprintln!("报告已写入 {}", report_path.display());

        if any_failed {
            bail!("存在失败或不正确的场景");
        }
        Ok(())
    }

    /// 子进程：运行单个场景并将 JSON 报告打印到 stdout。
    fn run_one(flags: &BTreeMap<String, String>) -> Result<()> {
        let scenario_name = required(flags, "scenario")?;
        let fixtures_dir = PathBuf::from(required(flags, "fixtures")?);
        let out_dir = PathBuf::from(required(flags, "out")?);
        let scenario = scenario_by_name(scenario_name)
            .with_context(|| format!("未知场景: {scenario_name}"))?;
        let spec = fixture_by_name(scenario.fixture).context("未知素材")?;
        let source = fixture_path(&fixtures_dir, &spec);
        let hash = hash_file(&source)?;

        let report = run_scenario(&scenario, &source, &hash, &out_dir)?;
        let json = serde_json::to_string(&report).context("无法序列化场景报告")?;
        println!("{json}");
        Ok(())
    }
}
