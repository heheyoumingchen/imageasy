import { layoutTemplates, type LayoutTemplate } from '../../types/stitchingLayout';

type Props = {
  selectedTemplate: LayoutTemplate | null;
  onSelectTemplate: (template: LayoutTemplate) => void;
};

const imageCountOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const LayoutSelector = ({ selectedTemplate, onSelectTemplate }: Props) => {
  return (
    <div className="flex w-full flex-col">
      {/* 数字选项卡 - 每行5个 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {imageCountOptions.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => {
              const templates = layoutTemplates[count];
              if (templates && templates.length > 0) {
                onSelectTemplate(templates[0]);
              }
            }}
            className={`flex items-center justify-center w-full h-10 rounded-lg text-sm font-bold transition-all ${
              selectedTemplate?.imageCount === count
                ? 'bg-meitu text-white'
                : 'bg-[#F3F4F8] text-[#8C93A1] hover:bg-[#E8EAF0]'
            }`}
          >
            {count}
          </button>
        ))}
      </div>

      {/* 布局模板列表 */}
      <div className="grid grid-cols-3 gap-3">
        {selectedTemplate && layoutTemplates[selectedTemplate.imageCount]?.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template)}
            className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center ${
              selectedTemplate?.id === template.id
                ? 'border-meitu bg-meitu-light'
                : 'border-border-light bg-white hover:border-[#E8EAF0]'
            }`}
          >
            <LayoutPreviewMiniature template={template} isSelected={selectedTemplate?.id === template.id} />
          </button>
        ))}
      </div>
    </div>
  );
};

// 缩略图预览
const LayoutPreviewMiniature = ({ template, isSelected }: { template: LayoutTemplate; isSelected: boolean }) => {
  const cellSize = 12;
  const gap = 2;
  const width = template.cols * cellSize + (template.cols - 1) * gap;
  const height = template.rows * cellSize + (template.rows - 1) * gap;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {template.cells.map((cell, index) => {
        const x = cell.col * (cellSize + gap);
        const y = cell.row * (cellSize + gap);
        const w = cell.colSpan * cellSize + (cell.colSpan - 1) * gap;
        const h = cell.rowSpan * cellSize + (cell.rowSpan - 1) * gap;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={1}
            fill={isSelected ? 'var(--color-meitu)' : '#C5CAD3'}
          />
        );
      })}
    </svg>
  );
};

export default LayoutSelector;
