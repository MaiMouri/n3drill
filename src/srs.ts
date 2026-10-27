import type { Bank } from './bank';
import type { Rec, Section, State } from './types';
import { keyOf } from './store';

/** Days until the next review, indexed by box (0 = answered wrongly, review again today). */
export const IV = [0, 1, 3, 6, 12];

export function record(S: State, id: string, ok: boolean, choice: string, unsure: boolean, t: number): void {
  const r: Rec =
    S.items[id] ?? (S.items[id] = { box: 0, seen: 0, right: 0, due: t, wrongDays: [], lastChoice: '', last: 1, unsure: false });
  r.seen++;
  if (ok) {
    r.right++;
    r.last = 1;
    if (unsure) {
      // right but not sure: do not move up, look at it again tomorrow
      r.unsure = true;
      r.due = t + 1;
    } else {
      r.unsure = false;
      r.box = Math.min(4, r.box + 1);
      r.due = t + IV[r.box];
    }
  } else {
    r.last = 0;
    r.box = 0;
    r.due = t;
    r.unsure = unsure;
    r.lastChoice = choice;
    r.wrongDays.push(t);
    if (r.wrongDays.length > 20) r.wrongDays.shift();
  }
  const k = keyOf(t);
  const d = S.days[k] ?? (S.days[k] = { n: 0, c: 0 });
  d.n++;
  if (ok) d.c++;
}

/** Toggles the unsure mark after an answer was already recorded. */
export function setUnsure(S: State, id: string, flag: boolean, t: number): void {
  const r = S.items[id];
  if (!r) return;
  r.unsure = flag;
  if (flag && r.last === 1 && r.due > t + 1) r.due = t + 1;
}

function inSection(bank: Bank, id: string, section?: Section): boolean {
  const it = bank.items.get(id);
  return !!it && (!section || it.section === section);
}

function seenIds(S: State, bank: Bank, section?: Section): string[] {
  return Object.keys(S.items).filter((id) => S.items[id].seen > 0 && inSection(bank, id, section));
}

export function dueIds(S: State, bank: Bank, t: number, section?: Section): string[] {
  return seenIds(S, bank, section)
    .filter((id) => S.items[id].due <= t)
    .sort((a, b) => S.items[a].box - S.items[b].box || S.items[a].due - S.items[b].due);
}

export function yesterdayWrongIds(S: State, bank: Bank, t: number, section?: Section): string[] {
  return seenIds(S, bank, section).filter((id) => S.items[id].wrongDays.includes(t - 1));
}

export function lowAccuracyIds(S: State, bank: Bank, section?: Section, below = 0.7): string[] {
  return seenIds(S, bank, section)
    .filter((id) => {
      const r = S.items[id];
      return r.seen >= 2 && r.right / r.seen < below;
    })
    .sort((a, b) => S.items[a].right / S.items[a].seen - S.items[b].right / S.items[b].seen);
}

export function unsureIds(S: State, bank: Bank, section?: Section): string[] {
  return seenIds(S, bank, section).filter((id) => S.items[id].unsure);
}

/** Items the learner keeps getting wrong: last answer wrong, or low accuracy and not yet solid. */
export function weakIds(S: State, bank: Bank, section?: Section): string[] {
  return seenIds(S, bank, section)
    .filter((id) => {
      const r = S.items[id];
      return r.box === 0 || (r.seen >= 2 && r.right / r.seen < 0.6 && r.box < 3);
    })
    .sort((a, b) => {
      const x = S.items[a];
      const y = S.items[b];
      return x.right / x.seen - y.right / y.seen || y.seen - x.seen;
    });
}

export function statusOf(S: State, id: string): 'new' | 'learning' | 'mastered' {
  const r = S.items[id];
  if (!r || r.seen === 0) return 'new';
  return r.box >= 3 ? 'mastered' : 'learning';
}

export function counts(S: State, ids: string[]): { m: number; l: number; n: number } {
  const c = { m: 0, l: 0, n: 0 };
  for (const id of ids) {
    const s = statusOf(S, id);
    if (s === 'mastered') c.m++;
    else if (s === 'learning') c.l++;
    else c.n++;
  }
  return c;
}

/** Picks n ids at random. Low boxes and overdue items are more likely. */
export function pickWeighted(S: State, ids: string[], n: number, t: number, rnd: () => number = Math.random): string[] {
  const pool = ids.slice();
  const out: string[] = [];
  const W = [6, 4, 3, 2, 1];
  while (out.length < n && pool.length) {
    const w = pool.map((id) => {
      const r = S.items[id];
      return W[r ? r.box : 0] + (r && r.due <= t ? 2 : 0);
    });
    const total = w.reduce((a, b) => a + b, 0);
    let x = rnd() * total;
    let j = 0;
    for (; j < pool.length; j++) {
      x -= w[j];
      if (x <= 0) break;
    }
    if (j >= pool.length) j = pool.length - 1;
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

export interface NotebookEntry {
  id: string;
  wrongCount: number;
  lastWrong: number;
  lastChoice: string;
  /** answered right twice in a row since the last mistake */
  resolved: boolean;
  unsure: boolean;
}

export function notebook(S: State, bank: Bank, section?: Section): NotebookEntry[] {
  const out: NotebookEntry[] = [];
  for (const id of Object.keys(S.items)) {
    const r = S.items[id];
    if (!r.wrongDays.length || !inSection(bank, id, section)) continue;
    out.push({
      id,
      wrongCount: r.seen - r.right,
      lastWrong: r.wrongDays[r.wrongDays.length - 1],
      lastChoice: r.lastChoice,
      resolved: r.last === 1 && r.box >= 2,
      unsure: r.unsure,
    });
  }
  return out.sort((a, b) => b.lastWrong - a.lastWrong || b.wrongCount - a.wrongCount);
}

/** Accuracy grouped by grammar pattern (questions with a ref_id). */
export function patternStats(S: State, bank: Bank): { id: string; seen: number; right: number }[] {
  const out: { id: string; seen: number; right: number }[] = [];
  for (const [pid, qids] of bank.questionsByPattern) {
    let seen = 0;
    let right = 0;
    for (const q of qids) {
      const r = S.items[q];
      if (r) {
        seen += r.seen;
        right += r.right;
      }
    }
    if (seen) out.push({ id: pid, seen, right });
  }
  return out;
}

export function accuracy(S: State, ids: string[]): { seen: number; right: number } {
  let seen = 0;
  let right = 0;
  for (const id of ids) {
    const r = S.items[id];
    if (r) {
      seen += r.seen;
      right += r.right;
    }
  }
  return { seen, right };
}

/** Consecutive days with at least one answer, counting back from today (or yesterday if today is empty). */
export function streak(S: State, t: number): number {
  let d = (S.days[keyOf(t)]?.n ?? 0) > 0 ? t : t - 1;
  let n = 0;
  while ((S.days[keyOf(d)]?.n ?? 0) > 0) {
    n++;
    d--;
  }
  return n;
}
