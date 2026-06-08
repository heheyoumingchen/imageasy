export type SourceSelection = {
  files: string[];
  directories: string[];
  cancelled: boolean;
};

export const sourceName = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path;

export const sourceDirectory = (path: string) => path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

export const splitSourcePaths = (paths: string[]): Pick<SourceSelection, 'files' | 'directories'> => ({
  files: paths.filter((path) => sourceName(path).includes('.')),
  directories: paths.filter((path) => !sourceName(path).includes('.'))
});
