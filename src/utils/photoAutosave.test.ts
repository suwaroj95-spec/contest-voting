import { describe, expect, it } from 'vitest';
import { contestants } from '../data/contestants';
import type { ContestantPhoto } from '../types';
import { createPhotoAutosave } from './photoAutosave';

const file = (name: string) => ({ name }) as File;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('photo autosave', () => {
  it('persists a processed photo immediately without changing names or votes', async () => {
    const image = new Blob(['new photo']);
    const photos: ContestantPhoto[] = [];
    const votes = [{ contestantId: '01' }];
    const save = createPhotoAutosave(async () => image, async (photo) => { photos.push(photo); });

    expect(await save('01', file('portrait.jpg'))).toEqual({ status: 'saved', image });
    expect(photos).toMatchObject([{ contestantId: '01', image }]);
    expect(contestants[0].name).toBe('ศกบ.สนผ.กบ.ทอ.');
    expect(votes).toEqual([{ contestantId: '01' }]);
  });

  it('keeps the previous photo when conversion or persistence fails', async () => {
    const previous = new Blob(['previous photo']);
    const photos = new Map([['01', previous]]);
    const failedConversion = createPhotoAutosave(
      async () => { throw new Error('conversion failed'); },
      async (photo) => { photos.set(photo.contestantId, photo.image); }
    );
    const failedWrite = createPhotoAutosave(
      async () => new Blob(['replacement']),
      async () => { throw new Error('IndexedDB write failed'); }
    );

    expect((await failedConversion('01', file('bad.heic'))).status).toBe('failed');
    expect((await failedWrite('01', file('new.jpg'))).status).toBe('failed');
    expect(photos.get('01')).toBe(previous);
  });

  it('lets the latest selection win when processing completes out of order', async () => {
    const older = deferred<Blob>();
    const newer = new Blob(['newer']);
    const photos = new Map<string, Blob>();
    const save = createPhotoAutosave(
      (selected) => selected.name === 'old.jpg' ? older.promise : Promise.resolve(newer),
      async (photo) => { photos.set(photo.contestantId, photo.image); }
    );

    const first = save('01', file('old.jpg'));
    const second = save('01', file('new.jpg'));
    expect((await second).status).toBe('saved');
    older.resolve(new Blob(['older']));
    expect((await first).status).toBe('superseded');
    expect(photos.get('01')).toBe(newer);
  });

  it('serializes an already-started write before saving the newer selection', async () => {
    const olderWrite = deferred<void>();
    const writeStarted = deferred<void>();
    const oldImage = new Blob(['old']);
    const newImage = new Blob(['new']);
    const writes: Blob[] = [];
    const save = createPhotoAutosave(
      async (selected) => selected.name === 'old.jpg' ? oldImage : newImage,
      async (photo) => {
        if (photo.image === oldImage) {
          writeStarted.resolve();
          await olderWrite.promise;
        }
        writes.push(photo.image);
      }
    );

    const first = save('01', file('old.jpg'));
    await writeStarted.promise;
    const second = save('01', file('new.jpg'));
    olderWrite.resolve();
    expect((await first).status).toBe('superseded');
    expect((await second).status).toBe('saved');
    expect(writes[writes.length - 1]).toBe(newImage);
  });
});
