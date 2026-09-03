export type Contestant = {
  id: string;
  number: number;
  name: string;
};

export type ContestantPhoto = {
  contestantId: string;
  image: Blob;
  updatedAt: string;
};

export type ContestantProfile = {
  contestantId: string;
  displayName: string;
  updatedAt: string;
};

export type VoteRecord = {
  id: string;
  contestantId: string;
  createdAt: string;
};

export type TieBreakRoundStatus = 'active' | 'closed' | 'kept-joint';

export type TieBreakRound = {
  id: string;
  rank: number;
  contestants: string[];
  createdAt: string;
  status: TieBreakRoundStatus;
  sourceRoundId?: string;
};

export type TieBreakVoteRecord = VoteRecord & {
  roundId: string;
};

export type AppMode = 'setup' | 'voting' | 'results' | 'tie-break';

export type AppState = {
  mode: AppMode;
  votingStarted: boolean;
};

export type VoteTotals = Record<string, number>;

export type RankedContestant = {
  contestantId: string;
  votes: number;
  denseRank: number;
  isJoint: boolean;
};

export type TieGroup = {
  rank: number;
  contestantIds: string[];
};

export type PodiumDecisionReason = 'unresolved' | 'tie-break-tied';

export type PendingPodiumDecision = TieGroup & {
  reason: PodiumDecisionReason;
  sourceRoundId?: string;
};

export type FinalPodium = {
  placements: RankedContestant[];
  pendingDecision: PendingPodiumDecision | null;
};

export type ExportData = {
  exportedAt: string;
  mainVotes: VoteRecord[];
  mainTotals: VoteTotals;
  tieBreakRounds: TieBreakRound[];
  tieBreakVotes: TieBreakVoteRecord[];
};
