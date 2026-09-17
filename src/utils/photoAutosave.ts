import type { ContestantPhoto } from '../types';

type SaveResult =
  | { status: 'saved'; image: Blob }
  | { status: 'failed'; error: unknown }
  | { status: 'superseded' };

export function createPhotoAutosave(
  processImage: (file: File) => Promise<Blob>,
  persistPhoto: (photo: ContestantPhoto) => Promise<void>
) {
  const selections = new Map<string, number>();
  const writes = new Map<string, Promise<void>>();

  return async (contestantId: string, file: File): Promise<SaveResult> => {
    const selection = (selections.get(contestantId) ?? 0) + 1;
    selections.set(contestantId, selection);
    const isLatest = () => selections.get(contestantId) === selection;

    try {
      const image = await processImage(file);
      if (!isLatest()) return { status: 'superseded' };

      // Serialize writes for this contestant so an older in-flight put cannot finish last.
      const write = (writes.get(contestantId) ?? Promise.resolve()).then(async () => {
        if (isLatest()) {
          await persistPhoto({ contestantId, image, updatedAt: new Date().toISOString() });
        }
      });
      writes.set(contestantId, write.catch(() => {}));
      await write;

      return isLatest() ? { status: 'saved', image } : { status: 'superseded' };
    } catch (error) {
      return isLatest() ? { status: 'failed', error } : { status: 'superseded' };
    }
  };
}
