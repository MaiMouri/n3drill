import { BLANK, type Bank } from './bank';
import type { Section } from './types';
import type { Bi } from './types';

export interface Opt {
  text: string;
  explain: Bi;
}

/** A question ready to show: options already shuffled, answer index resolved. */
export interface RQ {
  id: string;
  section: Section;
  hint: string;
  instruction: string;
  /** plain text. For order questions the star slot is already drawn into it. */
  stem: string;
  /** big centered word (vocab and kanji words) or a sentence */
  big: boolean;
  opts: Opt[];
  ans: number;
  /** ready-made feedback for generated questions (words, order) */
  detail: string;
  summary: Bi;
  refId: string;
  /** the sentence with the correct choice filled in */
  completed: string;
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

const NO_BI: Bi = { ja: '', en: '' };

/** Builds the question for an item id. Returns null if the item cannot be asked. */
export function makeRQ(bank: Bank, id: string, rnd: () => number = Math.random): RQ | null {
  const it = bank.items.get(id);
  if (!it) return null;

  if (it.kind === 'q' && it.q) {
    const q = it.q;
    if (q.type === 'order' && q.order) {
      const o = q.order;
      const idx = shuffle([0, 1, 2, 3], rnd);
      const stem = `${o.prefix} ＿ ＿ ★ ＿ ${o.suffix}`.replace(/\s+/g, ' ').trim();
      const completed = o.prefix + o.chunks.join('') + o.suffix;
      const detail =
        `<b>${esc(o.chunks.join(' → '))}</b><br>${esc(completed)}` +
        (q.translation ? `<br><span class="tr">${esc(q.translation)}</span>` : '');
      return {
        id,
        section: 'g',
        hint: '文の組み立て',
        instruction: q.instruction,
        stem,
        big: false,
        opts: idx.map((i) => ({ text: o.chunks[i], explain: NO_BI })),
        ans: idx.indexOf(q.answer),
        detail,
        summary: NO_BI,
        refId: q.refId,
        completed,
      };
    }
    const order = q.shuffle ? shuffle([0, 1, 2, 3], rnd) : [0, 1, 2, 3];
    const correct = q.choices[q.answer].text;
    return {
      id,
      section: q.section,
      hint: q.subcategory || q.category,
      instruction: q.instruction,
      stem: q.stem,
      big: false,
      opts: order.map((i) => q.choices[i]),
      ans: order.indexOf(q.answer),
      detail: '',
      summary: q.summary,
      refId: q.refId,
      completed: q.stem.replace(BLANK, correct),
    };
  }

  const w = it.w;
  if (!w) return null;
  const example = w.example ? `<br><span class="tr">${esc(w.example)}${w.exampleTr ? ' · ' + esc(w.exampleTr) : ''}</span>` : '';
  const detail = `<b class="wd">${esc(w.word)}</b>　${esc(w.reading)}${w.meaning ? ' · ' + esc(w.meaning) : ''}${example}`;

  if (it.kind === 'wm') {
    const rev = rnd() < 0.3;
    const others = shuffle(
      bank.words.filter((x) => x.id !== w.id && x.quiz !== 'reading' && x.meaning !== w.meaning && x.word !== w.word),
      rnd,
    ).slice(0, 3);
    if (others.length < 3) return null;
    const correct = rev ? w.word : w.meaning;
    const opts = shuffle([correct, ...others.map((x) => (rev ? x.word : x.meaning))], rnd);
    return {
      id,
      section: 'v',
      hint: rev ? 'Which word means this?' : 'What does it mean?',
      instruction: '',
      stem: rev ? w.meaning : w.word,
      big: true,
      opts: opts.map((text) => ({ text, explain: NO_BI })),
      ans: opts.indexOf(correct),
      detail,
      summary: NO_BI,
      refId: '',
      completed: w.word,
    };
  }

  // reading quiz: prefer wrong readings of a similar length
  const others = shuffle(bank.words.filter((x) => x.id !== w.id && x.quiz !== 'meaning' && x.reading !== w.reading), rnd);
  const near = others.filter((x) => Math.abs(x.reading.length - w.reading.length) <= 1);
  const rest = others.filter((x) => !near.includes(x));
  const wrong = [...near, ...rest].slice(0, 3);
  if (wrong.length < 3) return null;
  const opts = shuffle([w.reading, ...wrong.map((x) => x.reading)], rnd);
  return {
    id,
    section: 'k',
    hint: 'How is it read?',
    instruction: '',
    stem: w.word,
    big: true,
    opts: opts.map((text) => ({ text, explain: NO_BI })),
    ans: opts.indexOf(w.reading),
    detail,
    summary: NO_BI,
    refId: '',
    completed: w.word,
  };
}
