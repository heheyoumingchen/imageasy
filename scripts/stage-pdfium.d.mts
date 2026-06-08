type StagePdfiumOptions = {
  binDir: string | undefined;
  platform: string;
  stageDir: string;
};

type StagePdfiumResult = {
  sourcePath: string;
  destPath: string;
  fileName: string;
};

export function stagePdfium(options: StagePdfiumOptions): Promise<StagePdfiumResult>;
