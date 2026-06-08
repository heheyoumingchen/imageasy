export type DisplayedImageRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const getDisplayedImageRect = ({
  viewportWidth,
  viewportHeight,
  imageWidth,
  imageHeight,
  scale,
  offsetX,
  offsetY
}: {
  viewportWidth: number;
  viewportHeight: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}): DisplayedImageRect => {
  const fitScale = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  const width = imageWidth * fitScale * scale;
  const height = imageHeight * fitScale * scale;

  return {
    left: (viewportWidth - width) / 2 + offsetX,
    top: (viewportHeight - height) / 2 + offsetY,
    width,
    height
  };
};

export const cropToOverlayRect = (
  crop: { x: number; y: number; width: number; height: number },
  displayedRect: DisplayedImageRect,
  image: { width: number; height: number }
) => ({
  left: displayedRect.left + (crop.x / image.width) * displayedRect.width,
  top: displayedRect.top + (crop.y / image.height) * displayedRect.height,
  width: (crop.width / image.width) * displayedRect.width,
  height: (crop.height / image.height) * displayedRect.height
});

export const pointerDeltaToImageDelta = ({
  displayedRect,
  imageWidth,
  imageHeight,
  deltaX,
  deltaY
}: {
  displayedRect: DisplayedImageRect;
  imageWidth: number;
  imageHeight: number;
  deltaX: number;
  deltaY: number;
}) => ({
  x: Math.round(deltaX * (imageWidth / displayedRect.width)),
  y: Math.round(deltaY * (imageHeight / displayedRect.height))
});
