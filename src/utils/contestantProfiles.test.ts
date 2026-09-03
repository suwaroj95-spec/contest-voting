import { describe, expect, it } from 'vitest';
import { contestants } from '../data/contestants';
import { createContestantProfiles, resolveContestants } from './contestantProfiles';

describe('contestant profile resolution', () => {
  it('uses default names when no saved profile exists', () => {
    const resolved = resolveContestants(contestants, []);

    expect(resolved[0].id).toBe('01');
    expect(resolved[0].number).toBe(1);
    expect(resolved[0].name).toBe('ผู้เข้าประกวด 01');
  });

  it('uses saved display names over defaults', () => {
    const resolved = resolveContestants(contestants, [
      {
        contestantId: '01',
        displayName: 'นางสาวตัวอย่าง ใจดี',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]);

    expect(resolved[0].name).toBe('นางสาวตัวอย่าง ใจดี');
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

  it('maps profile data by stable contestant ID', () => {
    const profiles = createContestantProfiles(
      contestants,
      { '01': 'ชื่อหมายเลขหนึ่ง', '02': 'ชื่อหมายเลขสอง' },
      new Date('2026-01-01T00:00:00.000Z')
    );

    expect(profiles[0]).toMatchObject({
      contestantId: '01',
      displayName: 'ชื่อหมายเลขหนึ่ง'
    });
    expect(profiles[1]).toMatchObject({
      contestantId: '02',
      displayName: 'ชื่อหมายเลขสอง'
    });
  });
});
