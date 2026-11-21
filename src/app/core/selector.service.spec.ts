import { CardState } from '../models/types';
import { adjCellId, allAdjCells } from './adjective';
import { planAdjSession } from './selector.service';

const NOW = 1_000_000_000_000;
const DAY = 86_400_000;

function state(cardId: string, due: number): CardState {
  return {
    cardId, ease: 2.5, intervalDays: 1, reps: 1, due, lapses: 0,
    lastShownAt: due - DAY, lastResult: 'correct',
  };
}

// Deterministic PRNG so shuffles are reproducible.
function seeded(seed = 42): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

describe('planAdjSession', () => {
  const all = allAdjCells().map(adjCellId);
  const isGen = (id: string) => id.includes('|gen');
  // Every pre-genitive cell has been reviewed and is due now.
  const oldDue = new Map(all.filter((id) => !isGen(id)).map((id, i) => [id, state(id, NOW - i)]));

  it('reserves slots for unseen cells despite a big review backlog', () => {
    const picked = planAdjSession(all, oldDue, 30, NOW, seeded());
    expect(picked.length).toBe(30);
    expect(picked.filter(isGen).length).toBe(8);
    expect(new Set(picked).size).toBe(30);
  });

  it('fills the session with unseen cells when there are few reviews', () => {
    const few = new Map([...oldDue].slice(0, 5));
    const picked = planAdjSession(all, few, 30, NOW, seeded());
    expect(picked.length).toBe(30);
    expect(picked.filter((id) => few.has(id)).length).toBe(5);
  });

  it('uses all slots for reviews once nothing is unseen', () => {
    const everything = new Map(all.map((id, i) => [id, state(id, NOW - i)]));
    const picked = planAdjSession(all, everything, 30, NOW, seeded());
    expect(picked.length).toBe(30);
  });

  it('does not schedule cells that are neither due, failed nor unseen', () => {
    const future = new Map(all.map((id) => [id, state(id, NOW + DAY)]));
    expect(planAdjSession(all, future, 30, NOW, seeded())).toEqual([]);
  });
});
