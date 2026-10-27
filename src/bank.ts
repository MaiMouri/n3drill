import type { Row } from './csv';
import type { CustomKind, CustomRows, Group, Item, Pattern, Question, Section, Word } from './types';

/** Raw CSV rows, one array per file. */
export type RawData = Record<CustomKind, Row[]>;

/** Which column identifies a row, per file. Used for merging added rows over the built-in ones. */
export const ID_KEY: Record<CustomKind, string> = {
  groups: 'group_id',
  patterns: 'pattern_id',
  questions: 'question_id',
  order: 'question_id',
  words: 'word_id',
};

/** The blank in a sentence can be written （　）, ( ) or ＿＿. */
export const BLANK = /（[\s　]*）|\([\s　]*\)|＿{2,}/;

const LETTERS: Record<string, number> = {
  ア: 0, イ: 1, ウ: 2, エ: 3,
  A: 0, B: 1, C: 2, D: 3,
  a: 0, b: 1, c: 2, d: 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
};

export interface Bank {
  groups: Group[];
  /** in study order: by group order, then by position in the file */
  patterns: Pattern[];
  questions: Question[];
  words: Word[];
  items: Map<string, Item>;
  itemIds: string[];
  patternById: Map<string, Pattern>;
  groupById: Map<string, Group>;
  questionsByPattern: Map<string, string[]>;
  /** item ids of word meaning / word reading quizzes, in file order */
  wm: string[];
  wr: string[];
  warnings: string[];
}

/** Rows in `extra` replace rows with the same id in `base`; new ids are appended. */
export function mergeRows(base: Row[], extra: CustomRows, idKey: string): Row[] {
  const out = base.slice();
  const pos = new Map<string, number>();
  out.forEach((r, i) => pos.set(r[idKey], i));
  for (const r of extra) {
    const id = r[idKey];
    if (!id) continue;
    const at = pos.get(id);
    if (at === undefined) {
      pos.set(id, out.length);
      out.push(r);
    } else {
      out[at] = r;
    }
  }
  return out;
}

function sectionOf(category: string, subcategory: string): Section {
  if (category.includes('文法')) return 'g';
  if (subcategory.includes('漢字読み')) return 'k';
  return 'v';
}

function defaultInstruction(section: Section, stem: string): string {
  if (section === 'g') return '（　）に入る最も適切なものを選んでください。';
  if (section === 'k') return '【　】の言葉の読み方として最も適切なものを選んでください。';
  return BLANK.test(stem) ? '（　）に入る最も適切なものを選んでください。' : '最も適切なものを選んでください。';
}

function mcQuestion(r: Row, warnings: string[]): Question | null {
  const id = r.question_id;
  const texts = ['a', 'b', 'c', 'd'].map((k) => r['choice_' + k] ?? '');
  if (texts.some((t) => !t)) {
    warnings.push(`${id}: needs four choices`);
    return null;
  }
  if (new Set(texts).size !== 4) {
    warnings.push(`${id}: choices must all differ`);
    return null;
  }
  const answer = LETTERS[(r.answer ?? '').trim()];
  if (answer === undefined) {
    warnings.push(`${id}: answer must be ア イ ウ エ (or A-D)`);
    return null;
  }
  if (!r.stem) {
    warnings.push(`${id}: stem is empty`);
    return null;
  }
  const category = r.category || (BLANK.test(r.stem) ? '文法' : '文字・語彙');
  if (category.includes('読解') || category.includes('聴解')) {
    warnings.push(`${id}: reading and listening questions are not supported yet`);
    return null;
  }
  const subcategory = r.subcategory ?? '';
  const section = sectionOf(category, subcategory);
  return {
    id,
    type: 'mc',
    section,
    category,
    subcategory,
    difficulty: r.difficulty ?? '',
    refId: r.ref_id ?? '',
    instruction: r.instruction || defaultInstruction(section, r.stem),
    stem: r.stem,
    choices: texts.map((text, i) => {
      const k = 'abcd'[i];
      return { text, explain: { ja: r['explain_' + k] ?? '', en: r['explain_' + k + '_en'] ?? '' } };
    }),
    answer,
    summary: { ja: r.summary ?? '', en: r.summary_en ?? '' },
    shuffle: (r.shuffle ?? '').toUpperCase() !== 'N',
    translation: '',
  };
}

function orderQuestion(r: Row, warnings: string[]): Question | null {
  const id = r.question_id;
  const chunks = ['c1', 'c2', 'c3', 'c4'].map((k) => r[k] ?? '');
  const star = Number(r.star);
  if (chunks.some((c) => !c) || new Set(chunks).size !== 4) {
    warnings.push(`${id}: needs four different chunks (c1-c4)`);
    return null;
  }
  if (!Number.isInteger(star) || star < 1 || star > 4) {
    warnings.push(`${id}: star must be 1-4`);
    return null;
  }
  return {
    id,
    type: 'order',
    section: 'g',
    category: '文法',
    subcategory: '文の組み立て',
    difficulty: r.difficulty ?? '',
    refId: r.pattern_id ?? '',
    instruction: '並べかえて、★に入るものを選んでください。',
    stem: '',
    choices: chunks.map((text) => ({ text, explain: { ja: '', en: '' } })),
    answer: star - 1,
    summary: { ja: '', en: '' },
    shuffle: true,
    order: { prefix: r.prefix ?? '', chunks, star, suffix: r.suffix ?? '' },
    translation: r.translation_en ?? '',
  };
}

export function buildBank(raw: RawData): Bank {
  const warnings: string[] = [];

  const groups: Group[] = raw.groups
    .filter((r) => r.group_id)
    .map((r) => ({ id: r.group_id, ja: r.group_name_ja ?? '', en: r.group_name_en ?? '', order: Number(r.order) || 999 }));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const rawPatterns: Pattern[] = raw.patterns
    .filter((r) => r.pattern_id && r.pattern)
    .map((r) => ({
      id: r.pattern_id,
      groupId: r.group_id ?? '',
      pattern: r.pattern,
      answer: r.answer ?? '',
      connection: r.connection ?? '',
      meaning: { ja: r.meaning_ja ?? '', en: r.meaning_en ?? '' },
      nuance: { ja: r.nuance_ja ?? '', en: r.nuance_en ?? '' },
      mistake: { ja: r.mistake_ja ?? '', en: r.mistake_en ?? '' },
      examples: ['1', '2', '3']
        .map((n) => ({ ja: r['ex' + n] ?? '', en: r['ex' + n + '_en'] ?? '' }))
        .filter((e) => e.ja),
    }));
  const patterns = rawPatterns
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ga = groupById.get(a.p.groupId)?.order ?? 999;
      const gb = groupById.get(b.p.groupId)?.order ?? 999;
      return ga - gb || a.i - b.i;
    })
    .map((x) => x.p);
  const patternById = new Map(patterns.map((p) => [p.id, p]));

  const questions: Question[] = [];
  const seenQ = new Set<string>();
  const addQ = (q: Question | null): void => {
    if (!q) return;
    if (seenQ.has(q.id)) {
      warnings.push(`${q.id}: duplicate question id`);
      return;
    }
    seenQ.add(q.id);
    questions.push(q);
  };
  for (const r of raw.questions) if (r.question_id) addQ(mcQuestion(r, warnings));
  for (const r of raw.order) if (r.question_id) addQ(orderQuestion(r, warnings));

  const words: Word[] = [];
  const seenW = new Set<string>();
  for (const r of raw.words) {
    if (!r.word_id || !r.word) continue;
    if (seenW.has(r.word_id)) {
      warnings.push(`${r.word_id}: duplicate word id`);
      continue;
    }
    const quiz = r.quiz === 'reading' || r.quiz === 'both' ? r.quiz : 'meaning';
    if ((quiz !== 'meaning' && !r.reading) || (quiz !== 'reading' && !r.meaning)) {
      warnings.push(`${r.word_id}: reading or meaning is missing`);
      continue;
    }
    seenW.add(r.word_id);
    words.push({
      id: r.word_id,
      word: r.word,
      reading: r.reading ?? '',
      meaning: r.meaning ?? '',
      pos: r.pos ?? '',
      quiz,
      example: r.example ?? '',
      exampleTr: r.example_tr ?? '',
    });
  }

  const items = new Map<string, Item>();
  const questionsByPattern = new Map<string, string[]>();
  for (const q of questions) {
    items.set(q.id, { id: q.id, kind: 'q', section: q.section, q });
    if (q.refId) {
      const list = questionsByPattern.get(q.refId) ?? [];
      list.push(q.id);
      questionsByPattern.set(q.refId, list);
    }
  }
  const wm: string[] = [];
  const wr: string[] = [];
  for (const w of words) {
    if (w.quiz !== 'reading') {
      const id = w.id + ':m';
      items.set(id, { id, kind: 'wm', section: 'v', w });
      wm.push(id);
    }
    if (w.quiz !== 'meaning') {
      const id = w.id + ':r';
      items.set(id, { id, kind: 'wr', section: 'k', w });
      wr.push(id);
    }
  }

  return {
    groups,
    patterns,
    questions,
    words,
    items,
    itemIds: [...items.keys()],
    patternById,
    groupById,
    questionsByPattern,
    wm,
    wr,
    warnings,
  };
}
