import { AnswerResult, CardState } from '../models/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const EASE_DEFAULT = 2.5;
const EASE_MIN = 1.3;
const EASE_MAX = 2.8;

export function newCardState(cardId: string): CardState {
  return {
    cardId,
    ease: EASE_DEFAULT,
    intervalDays: 0,
    reps: 0,
    due: 0,
    lapses: 0,
    lastShownAt: null,
    lastResult: null,
  };
}

export function applyResult(
  state: CardState,
  result: AnswerResult,
  now: number,
): CardState {
  if (result === 'skipped') {
    return { ...state, lastShownAt: now };
  }

  if (result === 'correct') {
    const reps = state.reps + 1;
    const intervalDays =
      state.intervalDays === 0 ? 1 : Math.max(1, Math.round(state.intervalDays * state.ease));
    const ease = Math.min(EASE_MAX, state.ease + 0.05);
    return {
      ...state,
      ease,
      intervalDays,
      reps,
      due: now + intervalDays * DAY_MS,
      lastShownAt: now,
      lastResult: 'correct',
    };
  }

  // incorrect or idk
  const ease = Math.max(EASE_MIN, state.ease - 0.2);
  return {
    ...state,
    ease,
    intervalDays: 0,
    reps: 0,
    due: now,
    lapses: state.lapses + 1,
    lastShownAt: now,
    lastResult: result,
  };
}
