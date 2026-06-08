export type AppPageKey = 'image-editor' | 'convert-image' | 'extract-image' | 'split-image' | 'stitch-image' | 'image-download' | 'settings';
export type AppLanguage = 'zh-CN' | 'en-US';

export type NavItem = {
  key: AppPageKey;
  label: string;
};

export const getNavItems = (language: AppLanguage): NavItem[] =>
  language === 'en-US'
    ? [
        { key: 'image-editor', label: 'Editor' },
        { key: 'convert-image', label: 'Convert' },
        { key: 'extract-image', label: 'Extract' },
        { key: 'split-image', label: 'Split' },
        { key: 'stitch-image', label: 'Stitch' },
        { key: 'image-download', label: 'Download' }
      ]
    : [
        { key: 'image-editor', label: '图片编辑' },
        { key: 'convert-image', label: '格式转换' },
        { key: 'extract-image', label: '图片提取' },
        { key: 'split-image', label: '图片分割' },
        { key: 'stitch-image', label: '图片拼接' },
        { key: 'image-download', label: '图片下载' }
      ];
