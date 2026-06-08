export type CanvasRatio = '1:1' | '3:4' | '9:16' | '4:3' | '16:9';

export type LayoutCell = {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
};

export type LayoutTemplate = {
  id: string;
  imageCount: number;
  rows: number;
  cols: number;
  cells: LayoutCell[];
};

// 根据设计稿详细还原的布局模板
export const layoutTemplates: Record<number, LayoutTemplate[]> = {
  1: [
    { id: '1-single', imageCount: 1, rows: 1, cols: 1, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  2: [
    { id: '2-v', imageCount: 2, rows: 2, cols: 1, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '2-h', imageCount: 2, rows: 1, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  3: [
    { id: '3-v', imageCount: 3, rows: 3, cols: 1, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '3-h', imageCount: 3, rows: 1, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '3-top-merge', imageCount: 3, rows: 2, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '3-bottom-merge', imageCount: 3, rows: 2, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 }
    ]},
    { id: '3-left-merge', imageCount: 3, rows: 2, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '3-right-merge', imageCount: 3, rows: 2, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 }
    ]}
  ],
  4: [
    // 布局4-01: 均匀四宫格
    { id: '4-grid-2x2', imageCount: 4, rows: 2, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-02: 四横排
    { id: '4-four-rows', imageCount: 4, rows: 4, cols: 1, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-03: 四竖排
    { id: '4-four-cols', imageCount: 4, rows: 1, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-04: 顶一大，底左大右二小
    { id: '4-top1-bottom-left-right', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-05: 顶一大，底三竖
    { id: '4-top1-bottom3', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-06: 左上一横左下两竖，右一贯穿大图
    { id: '4-left-top-bottom-right', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 3, colSpan: 1 }
    ]},
    // 布局4-07: 顶一底一，中间两横
    { id: '4-top1-mid2-bottom1', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局4-08: 左右两竖，中间两方
    { id: '4-left1-mid2-right1', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 }
    ]},
    // 布局4-09: 上两层各一，底下一层两横
    { id: '4-layer-112', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-10: 左两小方，中右三大竖
    { id: '4-left2-mid1-right1', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 }
    ]},
    // 布局4-11: 底下一横，顶部左两方右一方
    { id: '4-top-left2-right1-bottom1', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 3 }
    ]},
    // 布局4-12: 不等宽的四宫格
    { id: '4-uneven-2x2', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局4-13: 左一大竖，右三小方
    { id: '4-left1-right3', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-14: 高度错位的2x2（左上高，右上矮）
    { id: '4-stagger-left-high', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 1 }
    ]},
    // 布局4-15: 对角线错位布局A
    { id: '4-diagonal-a', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局4-16: 高度错位的2x2（左上矮，右上高）
    { id: '4-stagger-right-high', imageCount: 4, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局4-17: 风车状错落拼接
    { id: '4-windmill', imageCount: 4, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 2 }
    ]},
    // 布局4-18: 对角线错位布局B
    { id: '4-diagonal-b', imageCount: 4, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  5: [
    { id: '5-01-five-rows', imageCount: 5, rows: 5, cols: 1, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 0, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-02-five-cols', imageCount: 5, rows: 1, cols: 5, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-03-windmill-a', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-04-windmill-b', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 3, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-05-top1-bottom4', imageCount: 5, rows: 2, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 4 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-06-top2-bottom3', imageCount: 5, rows: 2, cols: 6, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 2 }
    ]},
    { id: '5-07-left3-right2', imageCount: 5, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-08-topleft-large-bottom3', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-09-topright-large-bottom3', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-10-left2-right3', imageCount: 5, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-11-left3-right2', imageCount: 5, rows: 4, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 3, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-12-left2-right3', imageCount: 5, rows: 6, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 4, col: 1, rowSpan: 2, colSpan: 1 }
    ]},
    { id: '5-13-left2-square-right3', imageCount: 5, rows: 4, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 2, colSpan: 1 }
    ]},
    { id: '5-14-hamburger', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 }
    ]},
    { id: '5-15-sides-center', imageCount: 5, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-16-top4-bottom1', imageCount: 5, rows: 2, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 4 }
    ]},
    { id: '5-17-left4-right1', imageCount: 5, rows: 4, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 4, colSpan: 1 }
    ]},
    { id: '5-18-sides-center3', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 3, colSpan: 1 }
    ]},
    { id: '5-19-top-grid-bottom', imageCount: 5, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 }
    ]},
    { id: '5-20-mid-banner', imageCount: 5, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '5-21-top3-bottom2-banners', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 }
    ]},
    { id: '5-22-left-center-grid-right', imageCount: 5, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 }
    ]},
    { id: '5-23-left-mid-pillars-right3', imageCount: 5, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]}
  ],  6: [
    // 布局6-01: 3x2均匀网格
    { id: '6-grid-3x2', imageCount: 6, rows: 3, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-02: 2x3均匀网格
    { id: '6-grid-2x3', imageCount: 6, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-03: 上一大，下五小
    { id: '6-top1-bottom5', imageCount: 6, rows: 2, cols: 5, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 5 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-04: 左五小，右一大
    { id: '6-left5-right1', imageCount: 6, rows: 5, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 5, colSpan: 1 }
    ]},
    // 布局6-05: 左上大正方形环绕
    { id: '6-topleft-surround', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-06: 右上大正方形环绕
    { id: '6-topright-surround', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-07: 左下大正方形环绕
    { id: '6-bottomleft-surround', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 1, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-08: 右下大正方形环绕
    { id: '6-bottomright-surround', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-09: 错落砌砖布局（简化版）
    { id: '6-masonry', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局6-10: 错位3x2网格
    { id: '6-stagger-3x2', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局6-11: 左一大二小，右三小
    { id: '6-left-complex', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 }
    ]},
    // 布局6-12: 左四小(2x2)，右二大
    { id: '6-left-grid-right-stack', imageCount: 6, rows: 2, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-13: 三列高度错落
    { id: '6-three-cols-stagger', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 2, colSpan: 1 }
    ]},
    // 布局6-14: 上一，中二，下三
    { id: '6-top1-mid2-bottom3', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局6-17: 左一竖，中三竖，右二竖
    { id: '6-three-cols-123', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 2, colSpan: 1 }
    ]},
    // 布局6-18: 错落对称横图
    { id: '6-symmetric-stagger', imageCount: 6, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  7: [
    { id: '7-01-top4-bottom3', imageCount: 7, rows: 2, cols: 12, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 3 },
      { row: 0, col: 6, rowSpan: 1, colSpan: 3 },
      { row: 0, col: 9, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 4 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 4 },
      { row: 1, col: 8, rowSpan: 1, colSpan: 4 }
    ]},
    { id: '7-02-hamburger', imageCount: 7, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-03-232', imageCount: 7, rows: 3, cols: 6, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 3 }
    ]},
    { id: '7-04-top6-bottom1', imageCount: 7, rows: 2, cols: 6, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 5, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 6 }
    ]},
    { id: '7-05-topleft-large-bottom4', imageCount: 7, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-06-topright-large-bottom4', imageCount: 7, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-07-top3-left-large-right3', imageCount: 7, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 3, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-08-top4-left2-right-large', imageCount: 7, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 2, colSpan: 2 }
    ]},
    { id: '7-09-left-complex-right4', imageCount: 7, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-10-left2-right-top-grid', imageCount: 7, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-11-left2-right-3-2', imageCount: 7, rows: 5, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    { id: '7-12-three-cols-232', imageCount: 7, rows: 6, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 4, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 3, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 3, colSpan: 1 }
    ]},
    { id: '7-13-stagger-322', imageCount: 7, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    { id: '7-14-232-alt', imageCount: 7, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 2 }
    ]},
    { id: '7-15-left-center3-right1', imageCount: 7, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 3, colSpan: 1 }
    ]},
    { id: '7-16-brick-a', imageCount: 7, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 3 }
    ]},
    { id: '7-17-three-cols-322', imageCount: 7, rows: 6, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 4, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 3, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 4, colSpan: 1 }
    ]},
    { id: '7-18-brick-b', imageCount: 7, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]}
  ],  8: [
    // 布局8-01: 4x2均匀网格
    { id: '8-grid-4x2', imageCount: 8, rows: 4, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-02: 2x4均匀网格
    { id: '8-grid-2x4', imageCount: 8, rows: 2, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-03: 左宽右窄四行排布
    { id: '8-left-wide-right-narrow', imageCount: 8, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-04: 交错砖块布局A（宽窄交替）
    { id: '8-brick-alternate-a', imageCount: 8, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局8-05: 右上大方图，左/下包围
    { id: '8-topright-large-surround', imageCount: 8, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 3, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-06: 左上大方图，右/下包围
    { id: '8-topleft-large-surround', imageCount: 8, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 3 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-07: 右下大方图，左/上包围
    { id: '8-bottomright-large-surround', imageCount: 8, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 3, colSpan: 3 }
    ]},
    // 布局8-08: 交错砖块布局B（窄宽交替）
    { id: '8-brick-alternate-b', imageCount: 8, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-09: 上下双横，中间四方
    { id: '8-top2-mid4-bottom2', imageCount: 8, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 2 }
    ]},
    // 布局8-10: 上下三方，中间双大横
    { id: '8-top3-mid2-bottom3', imageCount: 8, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-11: 左右三小方，中间双大竖
    { id: '8-left3-mid2-right3', imageCount: 8, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-13: 垂直高度交错叠排
    { id: '8-vertical-stagger', imageCount: 8, rows: 4, cols: 2, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-14: 阶梯式横排，底座全宽
    { id: '8-pyramid', imageCount: 8, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 3 }
    ]},
    // 布局8-15: 左列双竖大，中右列三竖小
    { id: '8-left2-mid3-right3', imageCount: 8, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局8-16: 上方2x2网格，下方1x4竖排
    { id: '8-top-grid-bottom-row', imageCount: 8, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  9: [
    // 布局9-01: 均匀九宫格
    { id: '9-grid', imageCount: 9, rows: 3, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-02: 左右护法（侧边密集，中间贯穿）
    { id: '9-left-right-guard', imageCount: 9, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 4, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-03: 上下夹击（上下密集，中间贯穿）
    { id: '9-top-bottom-guard', imageCount: 9, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 4 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-04: 四象限错落混排
    { id: '9-quadrant-mix', imageCount: 9, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-05: 左侧一柱擎天，右侧2x4网格
    { id: '9-left-pillar-right-grid', imageCount: 9, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 4, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-06: 顶部一马平川，底部4x2网格
    { id: '9-top-banner-bottom-grid', imageCount: 9, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 4 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-07: 顶二、中三、底四（阶梯递增）
    { id: '9-stair-234', imageCount: 9, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局9-08: 极限细分（三大方 + 一中方 + 五微雕）
    { id: '9-extreme-subdivision', imageCount: 9, rows: 6, cols: 6, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 3, colSpan: 3 },
      { row: 3, col: 0, rowSpan: 3, colSpan: 3 },
      { row: 3, col: 3, rowSpan: 3, colSpan: 3 }
    ]}
  ],
  10: [
    // 布局10-01: 2x5均匀网格
    { id: '10-grid-2x5', imageCount: 10, rows: 2, cols: 5, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-02: 左上大方图，右底L型环绕
    { id: '10-topleft-L-surround', imageCount: 10, rows: 5, cols: 5, cells: [
      { row: 0, col: 0, rowSpan: 4, colSpan: 4 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 4, col: 4, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-03: 顶部一横大图，底部3x3九宫格
    { id: '10-top1-bottom9', imageCount: 10, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-04: 左侧一竖大图，右侧3x3九宫格
    { id: '10-left1-right9', imageCount: 10, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-05: 棋盘式交错对角布局
    { id: '10-checkerboard', imageCount: 10, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 2, colSpan: 2 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-06: 左侧两竖大图，右侧2x4网格
    { id: '10-left2-right8', imageCount: 10, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-07: 上下四小图，中间双大图
    { id: '10-top4-mid2-bottom4', imageCount: 10, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-08: 左右各三小竖，中间2x2核心
    { id: '10-left3-center4-right3', imageCount: 10, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-09: 两侧双大图，中心2x3网格
    { id: '10-sides2-center6', imageCount: 10, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局10-10: 复杂模块化错落拼贴
    { id: '10-modular', imageCount: 10, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  11: [
    // 布局11-03: 中心大图，左右合并
    { id: '11-center-lr-merge', imageCount: 11, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 2, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  12: [
    // 布局12-01: 2x6均匀网格
    { id: '12-grid-2x6', imageCount: 12, rows: 2, cols: 6, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 5, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 5, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局12-02: 3x4均匀网格
    { id: '12-grid-3x4', imageCount: 12, rows: 3, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局12-03: 4x3均匀网格
    { id: '12-grid-4x3', imageCount: 12, rows: 4, cols: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  13: [
    // 布局13-01: 四周12小图环绕中心大图
    { id: '13-center-surround', imageCount: 13, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局13-02: 左上角大图，其余网格
    { id: '13-topleft-large', imageCount: 13, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局13-03: 右下角大图，其余网格
    { id: '13-bottomright-large', imageCount: 13, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 2, colSpan: 2 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  14: [
    // 布局14-01: 2x7均匀网格
    { id: '14-grid-2x7', imageCount: 14, rows: 2, cols: 7, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 5, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 6, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 5, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 6, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局14-02: 中心双横图合并
    { id: '14-center-horizontal', imageCount: 14, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局14-03: 中心双竖图合并
    { id: '14-center-vertical', imageCount: 14, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 2, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 2, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  15: [
    // 布局15-01: 3x5均匀网格
    { id: '15-grid', imageCount: 15, rows: 3, cols: 5, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 4, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 4, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局15-02: 仅第2行中间合并
    { id: '15-row2-merge', imageCount: 15, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]},
    // 布局15-03: 仅第3行中间合并
    { id: '15-row3-merge', imageCount: 15, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]}
  ],
  16: [
    // 布局16-01: 4x4完美均匀网格
    { id: '16-grid', imageCount: 16, rows: 4, cols: 4, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 3, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 3, col: 3, rowSpan: 1, colSpan: 1 }
    ]}
  ]
};

