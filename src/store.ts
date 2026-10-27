import type { CustomKind, CustomRows, Lang, State } from './types';

export const KEY = 'n3drill-v3';
export const KINDS: CustomKind[] = ['groups', 'patterns', 'questions', 'order', 'words'];

export function fresh(): State {
  return {
    ver: 3,
    items: {},
    days: {},
    plan: { start: null },
    learned: {},
    mocks: [],
    off: {},
    backupAt: 0,
    settings: { lang: 'both' },
    custom: { groups: [], patterns: [], questions: [], order: [], words: [] },
  };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Accepts anything and returns a valid State (used for loading and restoring backups). */
export function normalize(o: unknown): State {
  const s = fresh();
  if (!isObj(o)) return s;
  if (isObj(o.items)) s.items = o.items as State['items'];
  if (isObj(o.days)) s.days = o.days as State['days'];
  if (isObj(o.plan) && typeof o.plan.start === 'number') s.plan.start = o.plan.start;
  if (isObj(o.learned)) s.learned = o.learned as State['learned'];
  if (Array.isArray(o.mocks)) s.mocks = o.mocks as State['mocks'];
  if (isObj(o.off)) s.off = o.off as State['off'];
  if (typeof o.backupAt === 'number') s.backupAt = o.backupAt;
  if (isObj(o.settings) && (o.settings.lang === 'ja' || o.settings.lang === 'en' || o.settings.lang === 'both')) {
    s.settings.lang = o.settings.lang as Lang;
  }
  if (isObj(o.custom)) {
    for (const k of KINDS) {
      const v = o.custom[k];
      if (Array.isArray(v)) s.custom[k] = v as CustomRows;
    }
  }
  // fill in fields that older saves may not have
  for (const r of Object.values(s.items)) {
    if (!Array.isArray(r.wrongDays)) r.wrongDays = [];
    if (typeof r.lastChoice !== 'string') r.lastChoice = '';
    if (r.last !== 0 && r.last !== 1) r.last = 1;
    if (typeof r.unsure !== 'boolean') r.unsure = false;
  }
  return s;
}

/** Day number in the viewer's local time (days since 1970-01-01). */
export function today(now: number = Date.now(), offsetMin: number = new Date().getTimezoneOffset()): number {
  return Math.floor((now - offsetMin * 60000) / 86400000);
}

export function keyOf(n: number): string {
  const d = new Date(n * 86400000);
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

export function wdayOf(n: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(n * 86400000).getUTCDay()];
}

/** Keeps the State in localStorage. Never throws: if storage is blocked, `ok` turns false. */
export class Store {
  state: State = fresh();
  ok = true;

  constructor(private storage: Storage | null) {
    if (!storage) {
      this.ok = false;
      return;
    }
    try {
      const raw = storage.getItem(KEY);
      if (raw) this.state = normalize(JSON.parse(raw));
    } catch {
      this.ok = false;
    }
  }

  save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      this.ok = false;
    }
  }

  replace(s: State): void {
    this.state = s;
    this.save();
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
