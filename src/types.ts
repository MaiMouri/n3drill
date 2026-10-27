/** g = grammar, v = vocabulary, k = kanji readings */
export type Section = 'g' | 'v' | 'k';
export type Lang = 'ja' | 'en' | 'both';

/** Text in both languages. Either side may be empty. */
export interface Bi {
  ja: string;
  en: string;
}

export interface Group {
  id: string;
  ja: string;
  en: string;
  order: number;
}

export interface Pattern {
  id: string;
  groupId: string;
  pattern: string;
  answer: string;
  connection: string;
  meaning: Bi;
  nuance: Bi;
  mistake: Bi;
  examples: Bi[];
}

export interface Choice {
  text: string;
  explain: Bi;
}

export interface OrderData {
  prefix: string;
  chunks: string[];
  /** 1-based index of the chunk that goes into the star slot */
  star: number;
  suffix: string;
}

export interface Question {
  id: string;
  type: 'mc' | 'order';
  section: Section;
  category: string;
  subcategory: string;
  difficulty: string;
  refId: string;
  instruction: string;
  stem: string;
  choices: Choice[];
  /** index into choices */
  answer: number;
  summary: Bi;
  shuffle: boolean;
  order?: OrderData;
  translation: string;
}

export interface Word {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: string;
  quiz: 'meaning' | 'reading' | 'both';
  example: string;
  exampleTr: string;
}

/** q = a question row, wm = word meaning quiz, wr = word reading quiz */
export type ItemKind = 'q' | 'wm' | 'wr';

/** Anything that can be asked and scheduled for review. */
export interface Item {
  id: string;
  kind: ItemKind;
  section: Section;
  q?: Question;
  w?: Word;
}

/** Progress record for one item. */
export interface Rec {
  box: number;
  seen: number;
  right: number;
  /** day number when the item is next due */
  due: number;
  /** day numbers on which the item was answered wrongly (latest last, capped) */
  wrongDays: number[];
  lastChoice: string;
  /** result of the latest answer */
  last: 0 | 1;
  /** marked as unsure */
  unsure: boolean;
}

export interface DayStat {
  n: number;
  c: number;
}

export interface Mock {
  k: string;
  s: number;
  n: number;
}

export type CustomKind = 'groups' | 'patterns' | 'questions' | 'order' | 'words';

export type CustomRows = Record<string, string>[];

export interface State {
  ver: 3;
  items: Record<string, Rec>;
  days: Record<string, DayStat>;
  plan: { start: number | null };
  /** pattern id -> day number when the lesson was studied */
  learned: Record<string, number>;
  mocks: Mock[];
  /** date key -> reading/listening done outside the app */
  off: Record<string, boolean>;
  backupAt: number;
  settings: { lang: Lang };
  /** rows added from the Add tab; they override or extend the built-in CSV by id */
  custom: Record<CustomKind, CustomRows>;
}
