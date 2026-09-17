import { describe, expect, it } from 'vitest';
import { contestants } from '../data/contestants';
import { resolveContestants } from './contestantProfiles';

const expectedNames = [
  'ศกบ.สนผ.กบ.ทอ.',
  'สนผ.+ สกบ.+ สจย.',
  'กคซ.สกบ.กบ.ทอ.',
  'กอส.สกบ.กบ.ทอ.',
  'กจย.สจย.กบ.ทอ.',
  'กสล.สกบ.กบ.ทอ.',
  'กจท.สจย.กบ.ทอ.',
  'กผท.สนผ.กบ.ทอ.',
  'กคง.สนผ.กบ.ทอ.',
  'กคพ.สกบ.กบ.ทอ.',
  'กบย.สกบ.กบ.ทอ.',
  'กนผ.สนผ.กบ.ทอ.',
  'บก.กบ.ทอ.'
];

describe('contestant profile resolution', () => {
  it('maps exactly 13 static names to immutable No.01–No.13', () => {
    expect(contestants).toHaveLength(13);
    expect(contestants.map(({ id, number, name }) => ({ id, number, name }))).toEqual(
      expectedNames.map((name, index) => ({
        id: String(index + 1).padStart(2, '0'),
        number: index + 1,
        name
      }))
    );
  });

  it('ignores legacy persisted name overrides', () => {
    const resolved = resolveContestants(contestants, [
      {
        contestantId: '01',
        displayName: 'นางสาวตัวอย่าง ใจดี',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    expect(resolved[0].name).toBe(expectedNames[0]);
  });

  it('keeps contestant numbers immutable', () => {
    const resolved = resolveContestants(contestants, [
      {
        contestantId: '01',
        displayName: 'ชื่อใหม่',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    expect(resolved[0].id).toBe('01');
    expect(resolved[0].number).toBe(1);
  });

  it('keeps photo lookup tied to the same contestant ID', () => {
    const photos: Record<string, string> = { '01': 'indexeddb-photo-url' };
    const resolved = resolveContestants(contestants, []);

    expect(photos[resolved[0].id]).toBe('indexeddb-photo-url');
  });

  it('retains static names after a voting reset', () => {
    const before = contestants.map((contestant) => contestant.name);
    const votes: string[] = ['01'];
    votes.length = 0;

    expect(resolveContestants(contestants, []).map((contestant) => contestant.name)).toEqual(before);
  });
});
