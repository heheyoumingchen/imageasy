const defaultMessageMap: Record<string, string> = {
  NO_SUPPORTED_IMAGES: '当前目录中没有可浏览的支持图片。',
  READ_IMAGE_FAILED: '图片读取失败，请检查文件是否仍可访问。',
  PREVIEW_FAILED: '预览生成失败，请稍后重试。',
  SAVE_IMAGE_FAILED: '保存 JPG 失败，请检查输出目录权限。'
};

export const mapAppError = (code: string, fallback = '发生未知错误。') => {
  return defaultMessageMap[code] ?? fallback;
};
