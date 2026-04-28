type EditorPreviewToolbarProps = {
  disabled: boolean;
  isCropping: boolean;
  isZoomSliderOpen: boolean;
  zoomValue: number;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onStartCrop: () => void;
  onToggleZoomSlider: () => void;
  onZoomChange: (value: number) => void;
};

const toolButtonClass =
  'inline-flex h-9 items-center justify-center rounded-full border border-[#ececf2] bg-white px-3.5 text-sm text-[#575e6b] transition hover:border-[#ff9fbd] hover:text-[#ff5c93] disabled:cursor-not-allowed disabled:opacity-40';

const EditorPreviewToolbar = ({
  disabled,
  isCropping,
  isZoomSliderOpen,
  zoomValue,
  onRotateLeft,
  onRotateRight,
  onStartCrop,
  onToggleZoomSlider,
  onZoomChange
}: EditorPreviewToolbarProps) => {
  const actionDisabled = disabled || isCropping;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={toolButtonClass} onClick={onRotateLeft} disabled={actionDisabled}>
        左转
      </button>
      <button type="button" className={toolButtonClass} onClick={onRotateRight} disabled={actionDisabled}>
        右转
      </button>
      <button type="button" className={toolButtonClass} onClick={onStartCrop} disabled={actionDisabled}>
        裁剪
      </button>
      <button
        type="button"
        className={`${toolButtonClass} ${isZoomSliderOpen ? 'border-[#ffb4cc] bg-[#fff3f8] text-[#ff5c93]' : ''}`}
        onClick={onToggleZoomSlider}
        disabled={disabled || isCropping}
      >
        放大
      </button>
      {isZoomSliderOpen ? (
        <label className="flex items-center gap-3 rounded-full border border-[#f0d6e1] bg-[#fff8fb] px-3 py-1 text-xs text-[#7e6f79]">
          <span>缩放</span>
          <input
            aria-label="缩放倍率"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={zoomValue}
            onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
          />
          <span>{zoomValue.toFixed(1)}</span>
        </label>
      ) : null}
    </div>
  );
};

export default EditorPreviewToolbar;
