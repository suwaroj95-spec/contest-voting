import type { Contestant, ContestantProfile } from '../types';

export function resolveContestants(
  contestants: Contestant[],
  profiles: ContestantProfile[]
): Contestant[] {
  const profilesById = new Map(profiles.map((profile) => [profile.contestantId, profile]));

  return contestants.map((contestant) => {
    const displayName = profilesById.get(contestant.id)?.displayName.trim();

    return {
      ...contestant,
      name: displayName || contestant.name
    };
  });
}

export function createContestantProfiles(
  contestants: Contestant[],
  namesByContestantId: Record<string, string>,
  now = new Date()
): ContestantProfile[] {
  const updatedAt = now.toISOString();

  return contestants.map((contestant) => ({
    contestantId: contestant.id,
    displayName: namesByContestantId[contestant.id]?.trim() || contestant.name,
    updatedAt
  }));
}
