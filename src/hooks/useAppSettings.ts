import { useSyncExternalStore } from 'react';
import { getSettingsStore } from './useSettingsStore';

export const useAppSettings = () => {
  const settingsStore = getSettingsStore();

  return useSyncExternalStore(
    settingsStore.subscribe,
    () => settingsStore.getState(),
    () => settingsStore.getState()
  );
};
