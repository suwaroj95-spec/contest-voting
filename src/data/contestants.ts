import type { Contestant } from '../types';

const contestantNames = [
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
] as const;

export const contestants: Contestant[] = contestantNames.map((name, index) => {
  const number = index + 1;
  const id = String(number).padStart(2, '0');

  return {
    id,
    number,
    name
  };
});
