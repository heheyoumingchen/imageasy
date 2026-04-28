import { invoke } from '@tauri-apps/api/core';
import type { PersistedSettings } from '../stores/settingsStore';

export const loadSettings = () => invoke<PersistedSettings>('load_settings');
export const saveSettings = (settings: PersistedSettings) =>
  invoke<PersistedSettings>('save_settings', { settings });
