import { describe, expect, it, vi } from 'vitest';

const mockOpen = vi.fn();
const mockSave = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: (...args: unknown[]) => mockOpen(...args), save: (...args: unknown[]) => mockSave(...args) }));

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

import {
  openImageFile,
  chooseJpgSavePath,
  chooseOutputDirectory,
  openDirectoryInSystem,
  openConversionSources,
  openSplittingSources,
  openStitchingSources
} from '../../src/services/fileDialog';

describe('fileDialog service', () => {
  it('openImageFile returns path on selection', async () => {
    mockOpen.mockResolvedValue('/test/photo.jpg');
    const result = await openImageFile();
    expect(result).toBe('/test/photo.jpg');
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ directory: false, multiple: false }));
  });

  it('openImageFile returns null on cancel', async () => {
    mockOpen.mockResolvedValue(null);
    const result = await openImageFile();
    expect(result).toBeNull();
  });

  it('chooseJpgSavePath passes defaultPath and jpg filter', async () => {
    mockSave.mockResolvedValue('/out/saved.jpg');
    const result = await chooseJpgSavePath('/default.jpg');
    expect(result).toBe('/out/saved.jpg');
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: '/default.jpg' }));
  });

  it('chooseOutputDirectory opens directory picker', async () => {
    mockOpen.mockResolvedValue('/selected/dir');
    const result = await chooseOutputDirectory('/start');
    expect(result).toBe('/selected/dir');
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ directory: true, defaultPath: '/start' }));
  });

  it('openDirectoryInSystem invokes correct command', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await openDirectoryInSystem('/some/path');
    expect(mockInvoke).toHaveBeenCalledWith('open_directory_in_system', { path: '/some/path' });
  });

  it('openConversionSources accepts image and Office/PDF document sources', async () => {
    mockOpen.mockResolvedValue(['/demo/a.jpg', '/demo/report.docx', '/demo/legacy.wps']);

    const result = await openConversionSources();

    expect(result).toEqual({ files: ['/demo/a.jpg', '/demo/report.docx', '/demo/legacy.wps'], directories: [], cancelled: false });
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({
      directory: false,
      multiple: true,
      recursive: true,
      filters: [{ name: 'Supported files', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'pdf', 'docx', 'doc', 'wps'] }]
    }));
  });

  it('openSplittingSources accepts image and PDF sources', async () => {
    mockOpen.mockResolvedValue(['/demo/a.jpg', '/demo/manual.pdf']);

    const result = await openSplittingSources();

    expect(result).toEqual({ files: ['/demo/a.jpg', '/demo/manual.pdf'], directories: [], cancelled: false });
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({
      directory: false,
      multiple: true,
      recursive: true,
      filters: [{ name: 'Images and PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'pdf'] }]
    }));
  });

  it('openStitchingSources accepts image sources only', async () => {
    mockOpen.mockResolvedValue(['/demo/a.png', '/demo/b.webp']);

    const result = await openStitchingSources();

    expect(result).toEqual({ files: ['/demo/a.png', '/demo/b.webp'], directories: [], cancelled: false });
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({
      directory: false,
      multiple: true,
      recursive: true,
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
    }));
  });
});
