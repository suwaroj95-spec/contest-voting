import type {
  AppState,
  Contestant,
  FinalPodium,
  PendingPodiumDecision,
  RankedContestant,
  TieBreakRound,
  TieBreakVoteRecord,
  TieGroup,
  VoteRecord,
  VoteTotals
} from '../types';

export const initialAppState: AppState = {
  mode: 'setup',
  votingStarted: false
};

export function createVoteRecord(contestantId: string, now = new Date()): VoteRecord {
  return {
    id: crypto.randomUUID(),
    contestantId,
    createdAt: now.toISOString()
  };
}

export function createTieBreakVoteRecord(
  roundId: string,
  contestantId: string,
  now = new Date()
): TieBreakVoteRecord {
  return {
    ...createVoteRecord(contestantId, now),
    roundId
  };
}

export function createTieBreakRound(
  rank: number,
  contestants: string[],
  sourceRoundId?: string,
  now = new Date()
): TieBreakRound {
  return {
    id: crypto.randomUUID(),
    rank,
    contestants,
    createdAt: now.toISOString(),
    status: 'active',
    sourceRoundId
  };
}

export function confirmSelection(
  votes: VoteRecord[],
  selectedContestantId: string | null,
  now = new Date()
): VoteRecord[] {
  if (!selectedContestantId) {
    return votes;
  }

  return [...votes, createVoteRecord(selectedContestantId, now)];
}

export function calculateVoteTotals(contestants: Contestant[], votes: VoteRecord[]): VoteTotals {
  const totals = Object.fromEntries(contestants.map((contestant) => [contestant.id, 0]));

  for (const vote of votes) {
    if (vote.contestantId in totals) {
      totals[vote.contestantId] += 1;
    }
  }

  return totals;
}

export function calculateTotalsForIds(contestantIds: string[], votes: VoteRecord[]): VoteTotals {
  const totals = Object.fromEntries(contestantIds.map((contestantId) => [contestantId, 0]));

  for (const vote of votes) {
    if (vote.contestantId in totals) {
      totals[vote.contestantId] += 1;
    }
  }

  return totals;
}

export function calculateDenseRankings(totals: VoteTotals): RankedContestant[] {
  const sorted = Object.entries(totals)
    .map(([contestantId, votes]) => ({ contestantId, votes }))
    .sort((a, b) => b.votes - a.votes || a.contestantId.localeCompare(b.contestantId));

  let currentRank = 0;
  let previousVotes: number | null = null;
  const countsByVotes = sorted.reduce<Record<number, number>>((acc, item) => {
    acc[item.votes] = (acc[item.votes] ?? 0) + 1;
    return acc;
  }, {});

  return sorted.map((item) => {
    if (previousVotes === null || item.votes !== previousVotes) {
      currentRank += 1;
      previousVotes = item.votes;
    }

    return {
      ...item,
      denseRank: currentRank,
      isJoint: countsByVotes[item.votes] > 1
    };
  });
}

export function getPublicTopThree(rankings: RankedContestant[]): RankedContestant[] {
  return rankings.filter((ranking) => ranking.votes > 0 && ranking.denseRank <= 3);
}

export function detectTopThreeTieGroups(rankings: RankedContestant[]): TieGroup[] {
  const groups = new Map<number, string[]>();

  for (const ranking of rankings) {
    if (ranking.votes <= 0 || ranking.denseRank > 3) {
      continue;
    }

    const rankGroup = groups.get(ranking.denseRank) ?? [];
    rankGroup.push(ranking.contestantId);
    groups.set(ranking.denseRank, rankGroup);
  }

  return [...groups.entries()]
    .filter(([, contestantIds]) => contestantIds.length > 1)
    .sort(([rankA], [rankB]) => rankA - rankB)
    .map(([rank, contestantIds]) => ({ rank, contestantIds }));
}

export function undoLatestVote(votes: VoteRecord[]): VoteRecord[] {
  if (votes.length === 0) {
    return votes;
  }

  const latestVote = [...votes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  return votes.filter((vote) => vote.id !== latestVote.id);
}

export function getLatestVote(votes: VoteRecord[]): VoteRecord | undefined {
  return [...votes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

export function getTieBreakVotesForRound(
  roundId: string,
  votes: TieBreakVoteRecord[]
): TieBreakVoteRecord[] {
  return votes.filter((vote) => vote.roundId === roundId);
}

export function getStillTiedContestants(round: TieBreakRound, votes: TieBreakVoteRecord[]): string[] {
  const roundVotes = getTieBreakVotesForRound(round.id, votes);
  const totals = calculateTotalsForIds(round.contestants, roundVotes);
  const highestScore = Math.max(...Object.values(totals));

  return Object.entries(totals)
    .filter(([, total]) => total === highestScore)
    .map(([contestantId]) => contestantId);
}

function sameContestantSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((contestantId) => b.includes(contestantId));
}

function groupMainRankings(rankings: RankedContestant[]): string[][] {
  const groups = new Map<number, string[]>();

  for (const ranking of rankings) {
    if (ranking.votes <= 0) {
      continue;
    }

    const group = groups.get(ranking.denseRank) ?? [];
    group.push(ranking.contestantId);
    groups.set(ranking.denseRank, group);
  }

  return [...groups.entries()]
    .sort(([rankA], [rankB]) => rankA - rankB)
    .map(([, contestantIds]) => contestantIds);
}

function findLatestRoundForDecision(
  rounds: TieBreakRound[],
  rank: number,
  contestantIds: string[]
): TieBreakRound | undefined {
  return [...rounds]
    .filter(
      (round) =>
        round.rank === rank &&
        round.status !== 'active' &&
        sameContestantSet(round.contestants, contestantIds)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function calculateTieBreakResultGroups(round: TieBreakRound, votes: TieBreakVoteRecord[]): string[][] {
  const totals = calculateTotalsForIds(round.contestants, getTieBreakVotesForRound(round.id, votes));
  const sorted = Object.entries(totals).sort(
    ([contestantA, votesA], [contestantB, votesB]) => votesB - votesA || contestantA.localeCompare(contestantB)
  );
  const groups: string[][] = [];

  for (const [contestantId, total] of sorted) {
    const previousContestant = groups[groups.length - 1]?.[0];
    if (previousContestant && totals[previousContestant] === total) {
      groups[groups.length - 1].push(contestantId);
    } else {
      groups.push([contestantId]);
    }
  }

  return groups;
}

export function resolveFinalPodium(
  rankings: RankedContestant[],
  rounds: TieBreakRound[],
  tieBreakVotes: TieBreakVoteRecord[]
): FinalPodium {
  const mainByContestant = new Map(rankings.map((ranking) => [ranking.contestantId, ranking]));
  const queue = groupMainRankings(rankings);
  const placements: RankedContestant[] = [];
  let pendingDecision: PendingPodiumDecision | null = null;
  let podiumRank = 1;

  while (queue.length > 0 && podiumRank <= 3) {
    const group = queue.shift() ?? [];

    if (group.length <= 1) {
      const contestantId = group[0];
      const mainRanking = contestantId ? mainByContestant.get(contestantId) : undefined;
      if (mainRanking) {
        placements.push({ ...mainRanking, denseRank: podiumRank, isJoint: false });
        podiumRank += 1;
      }
      continue;
    }

    const round = findLatestRoundForDecision(rounds, podiumRank, group);

    if (round?.status === 'closed') {
      const resultGroups = calculateTieBreakResultGroups(round, tieBreakVotes);
      if (resultGroups.length > 1 || !sameContestantSet(resultGroups[0] ?? [], group)) {
        queue.unshift(...resultGroups);
        continue;
      }
    }

    const reason = round?.status === 'closed' ? 'tie-break-tied' : 'unresolved';
    if (round?.status !== 'kept-joint' && !pendingDecision) {
      pendingDecision = {
        rank: podiumRank,
        contestantIds: group,
        reason,
        sourceRoundId: round?.id
      };
    }

    for (const contestantId of group) {
      const mainRanking = mainByContestant.get(contestantId);
      if (mainRanking) {
        placements.push({ ...mainRanking, denseRank: podiumRank, isJoint: true });
      }
    }
    podiumRank += 1;
  }

  return { placements, pendingDecision };
}
