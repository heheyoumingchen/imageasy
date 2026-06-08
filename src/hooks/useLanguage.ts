import { useSyncExternalStore } from 'react';
import { getSettingsStore } from './useSettingsStore';

export const useLanguage = () => {
  const settingsStore = getSettingsStore();

  return useSyncExternalStore(
    settingsStore.subscribe,
    () => settingsStore.getState().language,
    () => settingsStore.getState().language
  );
};
