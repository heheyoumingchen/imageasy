export type AppPageKey = 'image-editor' | 'convert-image' | 'extract-image' | 'task-center' | 'settings';

export type NavItem = {
  key: AppPageKey;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { key: 'image-editor', label: '图片编辑', description: '单图编辑与预览' },
  { key: 'convert-image', label: '转换图片', description: '批量转换入口' },
  { key: 'extract-image', label: '提取图片', description: '文档抽图入口' },
  { key: 'task-center', label: '任务中心', description: '查看任务历史与状态' },
  { key: 'settings', label: '设置', description: '主题、并发与偏好' }
];

export default navItems;
