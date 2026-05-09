import { applyResult, newCardState } from './srs';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe('SRS', () => {
  it('first correct sets interval to 1 day and bumps ease', () => {
    const s = applyResult(newCardState('c1'), 'correct', NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.reps).toBe(1);
    expect(s.due).toBe(NOW + DAY);
    expect(s.ease).toBeCloseTo(2.55, 5);
    expect(s.lastResult).toBe('correct');
  });

  it('second correct multiplies interval by ease', () => {
    let s = applyResult(newCardState('c1'), 'correct', NOW);
    s = applyResult(s, 'correct', NOW + DAY);
    expect(s.reps).toBe(2);
    expect(s.intervalDays).toBe(Math.round(1 * 2.55));
    expect(s.ease).toBeCloseTo(2.6, 5);
  });

  it('incorrect resets interval and reduces ease', () => {
    let s = applyResult(newCardState('c1'), 'correct', NOW);
    s = applyResult(s, 'correct', NOW + DAY);
    const before = s.ease;
    s = applyResult(s, 'incorrect', NOW + 2 * DAY);
    expect(s.intervalDays).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.due).toBe(NOW + 2 * DAY);
    expect(s.ease).toBeCloseTo(Math.max(1.3, before - 0.2), 5);
    expect(s.lastResult).toBe('incorrect');
  });

  it('idk behaves like incorrect for SRS but records lastResult=idk', () => {
    const s = applyResult(newCardState('c1'), 'idk', NOW);
    expect(s.lastResult).toBe('idk');
    expect(s.lapses).toBe(1);
    expect(s.intervalDays).toBe(0);
  });

  it('skipped only updates lastShownAt', () => {
    const s0 = newCardState('c1');
    const s1 = applyResult(s0, 'skipped', NOW);
    expect(s1.lastShownAt).toBe(NOW);
    expect(s1.lastResult).toBe(null);
    expect(s1.intervalDays).toBe(0);
    expect(s1.due).toBe(0);
  });

  it('ease floored at 1.3', () => {
    let s = newCardState('c1');
    for (let i = 0; i < 20; i++) s = applyResult(s, 'incorrect', NOW + i * DAY);
    expect(s.ease).toBe(1.3);
  });

  it('ease capped at 2.8', () => {
    let s = newCardState('c1');
    for (let i = 0; i < 20; i++) s = applyResult(s, 'correct', NOW + i * DAY);
    expect(s.ease).toBe(2.8);
  });
});
