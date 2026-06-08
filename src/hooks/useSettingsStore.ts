import { createSettingsStore } from '../stores/settingsStore';

let settingsStore: ReturnType<typeof createSettingsStore> | null = null;

export const getSettingsStore = () => {
  if (!settingsStore) {
    settingsStore = createSettingsStore();
  }

  return settingsStore;
};
