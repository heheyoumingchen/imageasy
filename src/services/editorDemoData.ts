import type { EditorDirectoryImage, EditorImageSummary } from '../types/editor';

const demoDirectoryImages: EditorDirectoryImage[] = [
  {
    index: 0,
    path: 'F:/Demo/示例图片_A.jpg',
    name: '示例图片_A.jpg',
    extension: 'jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 428512
  },
  {
    index: 1,
    path: 'F:/Demo/示例图片_B.png',
    name: '示例图片_B.png',
    extension: 'png',
    width: 1280,
    height: 720,
    sizeBytes: 285104
  },
  {
    index: 2,
    path: 'F:/Demo/示例图片_C.webp',
    name: '示例图片_C.webp',
    extension: 'webp',
    width: 1600,
    height: 900,
    sizeBytes: 319872
  }
];

export const getDemoEditorPayload = () => {
  const currentImage = demoDirectoryImages[0] as EditorImageSummary;

  return {
    currentImage,
    directoryImages: demoDirectoryImages,
    currentIndex: 0
  };
};
