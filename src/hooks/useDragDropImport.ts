import { useEffect } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { splitSourcePaths, type SourceSelection } from '../utils/paths';

type ImportSources = (sources: SourceSelection) => void | Promise<void>;

export const useDragDropImport = (importSources: ImportSources, dependencies: readonly unknown[]) => {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') {
          return;
        }

        void importSources({ ...splitSourcePaths(event.payload.paths), cancelled: false });
      })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, dependencies);
};
