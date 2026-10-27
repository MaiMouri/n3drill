import type { Bank } from './bank';
import type { RQ } from './quiz';
import type { CustomKind, Section, State } from './types';

export type Tab = 'today' | 'prac' | 'rev' | 'base' | 'stat' | 'add';

/** One study session: a quiz, a set of flashcards, or a run of grammar lessons. */
export interface Run {
  kind: string;
  mode: 'quiz' | 'cards' | 'lesson';
  /** item ids (quiz, cards) or pattern ids (lesson) */
  ids: string[];
  i: number;
  done: boolean;
  title: string;
  qs: RQ[];
  /** index of the chosen option, null until answered */
  sel: number | null;
  /** unsure mark for the current question */
  flag: boolean;
  score: number;
  missed: string[];
  flip: boolean;
  got: string[];
  again: string[];
  /** patterns marked as understood during a lesson run */
  learnedNow: string[];
}

/** Everything about the screen that is not saved: which tab, filters, text boxes, the running session. */
export interface UI {
  tab: Tab;
  psub: Section;
  bsub: 'g' | 'v' | 'k' | 'f' | 'e';
  bq: string;
  rsub: 'review' | 'notebook';
  rsec: '' | Section;
  nbAll: boolean;
  nbOpen: Record<string, boolean>;
  addKind: CustomKind;
  addText: string;
  bkText: string;
  addMsg: string;
  /** which confirmation is showing ('' = none) */
  cf: string;
  note: string;
  run: Run | null;
  /** a run set aside while a lesson is opened from inside a quiz */
  back: Run | null;
}

/** Read-only view of the app handed to the screens. */
export interface Ctx {
  S: State;
  bank: Bank;
  ui: UI;
  /** today as a day number */
  t: number;
  storeOk: boolean;
  canDownload: boolean;
}
