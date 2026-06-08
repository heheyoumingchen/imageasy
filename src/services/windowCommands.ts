import { getCurrentWindow } from '@tauri-apps/api/window';

export const minimizeWindow = () => getCurrentWindow().minimize();

export const toggleMaximizeWindow = () => getCurrentWindow().toggleMaximize();

export const closeWindow = () => getCurrentWindow().close();

export const startWindowDrag = () => getCurrentWindow().startDragging();
