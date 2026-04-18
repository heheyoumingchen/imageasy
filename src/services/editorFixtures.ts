import type { OpenImageSessionResult } from '../types/editor';

const thumbnailPlaceholder =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="16" fill="%230f172a"/><rect x="16" y="16" width="128" height="88" rx="12" fill="%231e293b"/><circle cx="54" cy="48" r="12" fill="%2322d3ee"/><path d="M24 92l32-28 20 16 26-22 34 34H24z" fill="%2364748b"/></svg>';

export const editorSessionFixture: OpenImageSessionResult = {
  currentImage: {
    path: 'F:/Demo/示例图片_A.jpg',
    name: '示例图片_A.jpg',
    extension: 'jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 428512
  },
  directoryImages: [
    {
      index: 0,
      path: 'F:/Demo/示例图片_A.jpg',
      name: '示例图片_A.jpg',
      extension: 'jpg',
      width: 1920,
      height: 1080,
      sizeBytes: 428512,
      thumbnailDataUrl: thumbnailPlaceholder
    },
    {
      index: 1,
      path: 'F:/Demo/示例图片_B.png',
      name: '示例图片_B.png',
      extension: 'png',
      width: 1280,
      height: 720,
      sizeBytes: 285104,
      thumbnailDataUrl: thumbnailPlaceholder
    },
    {
      index: 2,
      path: 'F:/Demo/示例图片_C.webp',
      name: '示例图片_C.webp',
      extension: 'webp',
      width: 1600,
      height: 900,
      sizeBytes: 319872,
      thumbnailDataUrl: thumbnailPlaceholder
    }
  ],
  currentIndex: 0
};
