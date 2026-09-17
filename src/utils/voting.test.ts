import { describe, expect, it, vi } from 'vitest';
import { contestants } from '../data/contestants';
import type { TieBreakRound, TieBreakVoteRecord, VoteRecord } from '../types';
import {
  calculateDenseRankings,
  calculateVoteTotals,
  confirmSelection,
  createTieBreakRound,
  detectTopThreeTieGroups,
  getStillTiedContestants,
  resolveFinalPodium,
  undoLatestVote
} from './voting';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `id-${Math.random()}`)
});

function vote(contestantId: string, index: number): VoteRecord {
  return {
    id: `vote-${contestantId}-${index}`,
    contestantId,
    createdAt: new Date(2026, 0, 1, 10, index).toISOString()
  };
}

function votesFromCounts(counts: Record<string, number>) {
  return Object.entries(counts).flatMap(([contestantId, count]) =>
    Array.from({ length: count }, (_, index) => vote(contestantId, index))
  );
}

function round(
  id: string,
  rank: number,
  roundContestants: string[],
  status: TieBreakRound['status'] = 'closed',
  index = 0,
  sourceRoundId?: string
): TieBreakRound {
  return {
    id,
    rank,
    contestants: roundContestants,
    createdAt: new Date(2026, 0, 2, 10, index).toISOString(),
    status,
    sourceRoundId
  };
}

function tieVotes(roundId: string, counts: Record<string, number>): TieBreakVoteRecord[] {
  return Object.entries(counts).flatMap(([contestantId, count]) =>
    Array.from({ length: count }, (_, index) => ({
      ...vote(contestantId, index),
      id: `${roundId}-${contestantId}-${index}`,
      roundId
    }))
  );
}

function podiumFor(
  counts: Record<string, number>,
  rounds: TieBreakRound[] = [],
  tieBreakVotes: TieBreakVoteRecord[] = []
) {
  return resolveFinalPodium(calculateDenseRankings(counts), rounds, tieBreakVotes);
}

function podiumGroups(podium: ReturnType<typeof podiumFor>) {
  return [1, 2, 3].map((rank) =>
    podium.placements
      .filter((placement) => placement.denseRank === rank)
      .map((placement) => placement.contestantId)
  );
}

describe('voting business logic', () => {
  it('selecting a contestant creates zero votes until confirmation', () => {
    expect(confirmSelection([], null)).toHaveLength(0);
  });

  it('confirming once creates exactly one vote and increases the main voter count', () => {
    const votes = confirmSelection([], '01', new Date('2026-01-01T00:00:00.000Z'));

    expect(votes).toHaveLength(1);
    expect(votes[0].contestantId).toBe('01');
  });

  it('calculates main vote totals', () => {
    const totals = calculateVoteTotals(contestants, votesFromCounts({ '01': 2, '02': 1 }));

    expect(totals['01']).toBe(2);
    expect(totals['02']).toBe(1);
    expect(totals['13']).toBe(0);
  });

  it('uses dense ranking', () => {
    const rankings = calculateDenseRankings({ '01': 8, '02': 8, '03': 6, '04': 5 });

    expect(rankings.map((ranking) => ranking.denseRank)).toEqual([1, 1, 2, 3]);
  });

  it('detects rank 1 ties', () => {
    const groups = detectTopThreeTieGroups(calculateDenseRankings({ '01': 3, '02': 3, '03': 1 }));

    expect(groups).toEqual([{ rank: 1, contestantIds: ['01', '02'] }]);
  });

  it('detects rank 2 ties', () => {
    const groups = detectTopThreeTieGroups(calculateDenseRankings({ '01': 4, '02': 2, '03': 2, '04': 1 }));

    expect(groups).toEqual([{ rank: 2, contestantIds: ['02', '03'] }]);
  });

  it('detects rank 3 ties', () => {
    const groups = detectTopThreeTieGroups(calculateDenseRankings({ '01': 4, '02': 3, '03': 2, '04': 2 }));

    expect(groups).toEqual([{ rank: 3, contestantIds: ['03', '04'] }]);
  });

  it('ignores rank 4 ties for tie-break prompting', () => {
    const groups = detectTopThreeTieGroups(calculateDenseRankings({ '01': 5, '02': 4, '03': 3, '04': 2, '05': 2 }));

    expect(groups).toEqual([]);
  });

  it('detects multiple Top-3 tie groups in rank order', () => {
    const groups = detectTopThreeTieGroups(
      calculateDenseRankings({ '01': 5, '02': 5, '03': 3, '04': 3, '05': 1, '06': 1 })
    );

    expect(groups).toEqual([
      { rank: 1, contestantIds: ['01', '02'] },
      { rank: 2, contestantIds: ['03', '04'] },
      { rank: 3, contestantIds: ['05', '06'] }
    ]);
  });

  it('keeps tie-break votes isolated from main vote totals', () => {
    const mainTotals = calculateVoteTotals(contestants, votesFromCounts({ '01': 10, '02': 10 }));
    const tieBreakVotes: TieBreakVoteRecord[] = [
      { ...vote('01', 1), id: 'tie-1', roundId: 'round-1' },
      { ...vote('01', 2), id: 'tie-2', roundId: 'round-1' },
      { ...vote('02', 3), id: 'tie-3', roundId: 'round-1' }
    ];

    expect(tieBreakVotes).toHaveLength(3);
    expect(mainTotals['01']).toBe(10);
    expect(mainTotals['02']).toBe(10);
  });

  it('represents repeated tie-break rounds with only still-tied contestants', () => {
    const round: TieBreakRound = {
      id: 'round-1',
      rank: 1,
      contestants: ['01', '02', '03'],
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'active'
    };
    const tieVotes: TieBreakVoteRecord[] = [
      { ...vote('01', 1), roundId: 'round-1' },
      { ...vote('01', 2), roundId: 'round-1' },
      { ...vote('02', 3), roundId: 'round-1' },
      { ...vote('02', 4), roundId: 'round-1' },
      { ...vote('03', 5), roundId: 'round-1' }
    ];

    const stillTied = getStillTiedContestants(round, tieVotes);
    const nextRound = createTieBreakRound(1, stillTied, round.id, new Date('2026-01-01T01:00:00.000Z'));

    expect(nextRound.contestants).toEqual(['01', '02']);
    expect(nextRound.sourceRoundId).toBe('round-1');
  });

  it('undo removes exactly the latest main vote', () => {
    const votes = [
      vote('01', 1),
      { ...vote('02', 2), createdAt: '2026-01-01T12:00:00.000Z' },
      vote('03', 3)
    ];

    expect(undoLatestVote(votes).map((item) => item.contestantId)).toEqual(['01', '03']);
  });

  it('reset clears voting records conceptually', () => {
    const afterReset: VoteRecord[] = [];

    expect(afterReset).toHaveLength(0);
  });

  it('reset does not clear contestant definitions or photo references conceptually', () => {
    const photoReferences = { '01': 'indexeddb-photo' };

    expect(contestants).toHaveLength(13);
    expect(contestants[0].name).toBe('ศกบ.สนผ.กบ.ทอ.');
    expect(photoReferences['01']).toBe('indexeddb-photo');
  });

  it('resolves a two-contestant rank 1 tie into consecutive podium slots', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8, '04': 6 },
      [round('round-1', 1, ['01', '02'])],
      tieVotes('round-1', { '01': 6, '02': 4 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('resolves a two-contestant rank 2 tie into rank 2 and rank 3', () => {
    const podium = podiumFor(
      { '01': 10, '02': 8, '03': 8, '04': 6 },
      [round('round-1', 2, ['02', '03'])],
      tieVotes('round-1', { '02': 5, '03': 2 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('resolves a rank 3 tie without including the losing contestant in the podium', () => {
    const podium = podiumFor(
      { '01': 10, '02': 8, '03': 6, '04': 6 },
      [round('round-1', 3, ['03', '04'])],
      tieVotes('round-1', { '03': 4, '04': 1 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('shifts an original rank 2 tie into a rank 3 decision after rank 1 is resolved', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8, '04': 8, '05': 6 },
      [round('round-1', 1, ['01', '02'])],
      tieVotes('round-1', { '01': 6, '02': 4 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03', '04']]);
    expect(podium.pendingDecision).toEqual({
      rank: 3,
      contestantIds: ['03', '04'],
      reason: 'unresolved',
      sourceRoundId: undefined
    });
  });

  it('keeps a shifted rank 3 group jointly and does not prompt for it again', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8, '04': 8, '05': 6 },
      [
        round('round-1', 1, ['01', '02']),
        round('keep-1', 3, ['03', '04'], 'kept-joint', 1)
      ],
      tieVotes('round-1', { '01': 6, '02': 4 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03', '04']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('tie-breaks a shifted rank 3 group independently', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8, '04': 8, '05': 6 },
      [
        round('round-1', 1, ['01', '02']),
        round('round-2', 3, ['03', '04'], 'closed', 1)
      ],
      [...tieVotes('round-1', { '01': 6, '02': 4 }), ...tieVotes('round-2', { '03': 3, '04': 1 })]
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('moves remaining contestants from a three-way rank 1 tie into the next unresolved podium slot', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 10, '04': 8 },
      [round('round-1', 1, ['01', '02', '03'])],
      tieVotes('round-1', { '01': 5, '02': 3, '03': 3 })
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02', '03'], ['04']]);
    expect(podium.pendingDecision).toEqual({
      rank: 2,
      contestantIds: ['02', '03'],
      reason: 'unresolved',
      sourceRoundId: undefined
    });
  });

  it('prompts for the same podium position when a tie-break round itself ties', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8 },
      [round('round-1', 1, ['01', '02'])],
      tieVotes('round-1', { '01': 4, '02': 4 })
    );

    expect(podiumGroups(podium)).toEqual([['01', '02'], ['03'], []]);
    expect(podium.pendingDecision).toEqual({
      rank: 1,
      contestantIds: ['01', '02'],
      reason: 'tie-break-tied',
      sourceRoundId: 'round-1'
    });
  });

  it('uses the latest repeated tie-break round and keeps previous tie-break history separate', () => {
    const podium = podiumFor(
      { '01': 10, '02': 10, '03': 8 },
      [
        round('round-1', 1, ['01', '02']),
        round('round-2', 1, ['01', '02'], 'closed', 1, 'round-1')
      ],
      [...tieVotes('round-1', { '01': 4, '02': 4 }), ...tieVotes('round-2', { '01': 3, '02': 1 })]
    );

    expect(podiumGroups(podium)).toEqual([['01'], ['02'], ['03']]);
    expect(podium.pendingDecision).toBeNull();
  });

  it('does not change main vote totals after tie-break processing', () => {
    const mainTotals = calculateVoteTotals(contestants, votesFromCounts({ '01': 10, '02': 10, '03': 8 }));

    podiumFor(
      mainTotals,
      [round('round-1', 1, ['01', '02'])],
      tieVotes('round-1', { '01': 6, '02': 4 })
    );

    expect(mainTotals['01']).toBe(10);
    expect(mainTotals['02']).toBe(10);
    expect(mainTotals['03']).toBe(8);
  });
});
