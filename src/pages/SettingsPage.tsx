import { useMemo, useState } from 'react';
import { createSettingsStore, type OutputDirectoryStrategy } from '../stores/settingsStore';

const SettingsPage = () => {
  const settingsStore = useMemo(() => createSettingsStore(), []);
  const [, setVersion] = useState(0);
  const state = settingsStore.getState();

  const sync = () => {
    setVersion((value) => value + 1);
  };

  return (
    <section className="max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="max-w-2xl">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-400">
          P0 最小设置
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-50">设置</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          当前先提供图片编辑 P0 所需的最小持久化设置项。
        </p>

        <div className="mt-6 grid gap-4">
          <label className="text-sm text-slate-300">
            最大并发任务数
            <input
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              type="number"
              min="1"
              max="8"
              value={state.maxConcurrency}
              onChange={(event) => {
                settingsStore.getState().updateSettings({
                  maxConcurrency: Number(event.target.value)
                });
                sync();
              }}
            />
          </label>

          <label className="text-sm text-slate-300">
            默认输出目录策略
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={state.outputDirectoryStrategy}
              onChange={(event) => {
                settingsStore.getState().updateSettings({
                  outputDirectoryStrategy: event.target.value as OutputDirectoryStrategy
                });
                sync();
              }}
            >
              <option value="same-as-source">与原图同目录</option>
              <option value="custom">自定义目录（P1 接入）</option>
            </select>
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={state.rememberLastParams}
              onChange={(event) => {
                settingsStore.getState().updateSettings({
                  rememberLastParams: event.target.checked
                });
                sync();
              }}
            />
            记住上次参数
          </label>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
