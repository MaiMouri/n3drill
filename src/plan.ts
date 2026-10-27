import type { Bank } from './bank';
import type { Pattern, State } from './types';

export const DAYS = 40;
export const LEARN_DAYS = 30;
export const WEAK_UNTIL = 36;
export const GOAL = 40;

/** 0 = the plan has not started. Keeps counting past DAYS. */
export function curDay(S: State, t: number): number {
  return S.plan.start == null ? 0 : Math.max(1, t - S.plan.start + 1);
}

export type Phase = 'learn' | 'weak' | 'mock';

export function phaseOf(day: number): Phase {
  return day <= LEARN_DAYS ? 'learn' : day <= WEAK_UNTIL ? 'weak' : 'mock';
}

/** How many of n items are unlocked on the given day. All of them from day LEARN_DAYS on. */
export function unlockCount(n: number, day: number): number {
  if (day === 0) return 0;
  if (day >= LEARN_DAYS) return n;
  return Math.min(n, Math.ceil(n / LEARN_DAYS) * day);
}

export function perDay(n: number): number {
  return Math.ceil(n / LEARN_DAYS);
}

export function unlockedPatterns(S: State, bank: Bank, t: number): Pattern[] {
  return bank.patterns.slice(0, unlockCount(bank.patterns.length, curDay(S, t)));
}

/** Unlocked grammar lessons that have not been studied yet. */
export function pendingLessons(S: State, bank: Bank, t: number): Pattern[] {
  return unlockedPatterns(S, bank, t).filter((p) => !S.learned[p.id]);
}

export function unlockedWordItems(S: State, bank: Bank, t: number): string[] {
  const d = curDay(S, t);
  return [
    ...bank.wm.slice(0, unlockCount(bank.wm.length, d)),
    ...bank.wr.slice(0, unlockCount(bank.wr.length, d)),
  ];
}

/** Unlocked word and kanji-reading items that have never been answered. */
export function pendingWordItems(S: State, bank: Bank, t: number): string[] {
  return unlockedWordItems(S, bank, t).filter((id) => !S.items[id]);
}

/** Every item the learner has unlocked so far: studied grammar questions and unlocked words. */
export function unlockedItemIds(S: State, bank: Bank, t: number): string[] {
  const out: string[] = [];
  for (const p of unlockedPatterns(S, bank, t)) out.push(...(bank.questionsByPattern.get(p.id) ?? []));
  out.push(...unlockedWordItems(S, bank, t));
  // questions that are not tied to a grammar lesson are always available
  for (const q of bank.questions) if (!q.refId || !bank.patternById.has(q.refId)) out.push(q.id);
  return out;
}
