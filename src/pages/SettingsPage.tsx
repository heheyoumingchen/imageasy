import { useEffect, useMemo, useState } from 'react';
import { createSettingsStore, type OutputDirectoryStrategy } from '../stores/settingsStore';

const SettingsPage = () => {
  const settingsStore = useMemo(() => createSettingsStore(), []);
  const [, setVersion] = useState(0);
  const state = settingsStore.getState();

  const sync = () => {
    setVersion((value) => value + 1);
  };

  useEffect(() => {
    void settingsStore.getState().load().finally(sync);
  }, [settingsStore]);

  return (
    <section className="max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="max-w-3xl">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-400">
          应用偏好
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-50">设置中心</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          管理全局默认值、图片编辑偏好和批量任务执行方式。
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
          <h4 className="text-base font-semibold text-slate-100">常规设置</h4>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-slate-300">
              最大并发任务数
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                type="number"
                min="1"
                max="8"
                value={state.maxConcurrency}
                onChange={(event) => {
                  void settingsStore.getState().updateSettings({
                    maxConcurrency: Number(event.target.value)
                  }).finally(sync);
                }}
              />
            </label>

            <label className="text-sm text-slate-300">
              默认输出目录策略
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={state.outputDirectoryStrategy}
                onChange={(event) => {
                  void settingsStore.getState().updateSettings({
                    outputDirectoryStrategy: event.target.value as OutputDirectoryStrategy
                  }).finally(sync);
                }}
              >
                <option value="same-as-source">与源文件同目录</option>
                <option value="custom">每次手动选择</option>
              </select>
            </label>
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h4 className="text-base font-semibold text-slate-100">图片编辑</h4>
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={state.rememberLastParams}
                onChange={(event) => {
                  void settingsStore.getState().updateSettings({
                    rememberLastParams: event.target.checked
                  }).finally(sync);
                }}
              />
              记住上次参数
            </label>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h4 className="text-base font-semibold text-slate-100">批量任务</h4>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              批量转换和图片提取将使用当前并发与输出目录策略。
            </p>
          </section>
        </div>
      </div>

      {state.errorMessage ? <p className="mt-4 text-sm text-rose-300">{state.errorMessage}</p> : null}
    </section>
  );
};

export default SettingsPage;
