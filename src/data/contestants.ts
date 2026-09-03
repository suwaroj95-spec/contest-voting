import type { Contestant } from '../types';

export const contestants: Contestant[] = Array.from({ length: 13 }, (_, index) => {
  const number = index + 1;
  const id = String(number).padStart(2, '0');

  return {
    id,
    number,
    name: `ผู้เข้าประกวด ${id}`
  };
});
