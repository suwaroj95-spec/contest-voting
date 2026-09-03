export function formatContestantNumber(number: number) {
  return `No.${String(number).padStart(2, '0')}`;
}

export function rankLabel(rank: number, isJoint = false) {
  return `อันดับ ${rank}${isJoint ? ' ร่วม' : ''}`;
}
