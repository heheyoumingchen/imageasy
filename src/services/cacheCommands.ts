import { invoke } from '@tauri-apps/api/core';
import type { CacheUsageResult } from '../types/cache';

export const getAppCacheUsage = () => invoke<CacheUsageResult>('get_app_cache_usage');
export const clearAppCache = () => invoke<CacheUsageResult>('clear_app_cache');
