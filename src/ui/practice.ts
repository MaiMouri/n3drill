import type { Ctx } from '../ctx';
import { counts } from '../srs';
import type { Section } from '../types';
import { chips, esc, meter, runBtn } from './common';

export const SECS: Record<Section, { jp: string; en: string; tag: string; unit: string; desc: string }> = {
  g: {
    jp: '文法',
    en: 'Grammar',
    tag: '文法形式の判断',
    unit: 'questions',
    desc: 'Choose the form that completes the sentence, as in the exam. Every answer comes with an explanation.',
  },
  v: {
    jp: '単語',
    en: 'Vocab',
    tag: '文字・語彙',
    unit: 'items',
    desc: 'Everyday N3 words. Quizzes mix Japanese to English and English to Japanese.',
  },
  k: {
    jp: '漢字',
    en: 'Kanji',
    tag: '漢字読み',
    unit: 'items',
    desc: 'Pick the correct reading of each kanji word, as in the exam.',
  },
};

export function sectionIds(c: Ctx, s: Section): string[] {
  return c.bank.itemIds.filter((id) => c.bank.items.get(id)?.section === s);
}

export function practiceView(c: Ctx): string {
  const s = c.ui.psub;
  const info = SECS[s];
  const ids = sectionIds(c, s);
  const sec = ` data-sec="${s}"`;
  return (
    chips(
      [
        ['g', '文法 Grammar'],
        ['v', '単語 Vocab'],
        ['k', '漢字 Kanji'],
      ],
      s,
      'prac',
    ) +
    `<section class="panel"><p class="eyebrow">${esc(info.tag)} · ${ids.length} ${info.unit}</p><h2>${esc(info.jp)} ${esc(info.en)}</h2>` +
    `<p class="lead">${esc(info.desc)} Items you miss come back more often.</p>${meter(counts(c.S, ids), ids.length)}` +
    `<div class="actions">${runBtn('Quiz · 10 questions', 'free', 'quiz', 'primary', sec).replace(' sm', '')}` +
    (s === 'g' ? '' : runBtn('Flashcards', 'free', 'cards', 'secondary', sec).replace(' sm', '')) +
    `</div></section>` +
    `<section class="panel"><p class="eyebrow">模擬 MOCK TEST</p><h2>30 questions, all sections</h2>` +
    `<p class="lead">Ten grammar, ten vocabulary and ten kanji reading questions picked at random from the whole bank. Your score is saved under Stats.</p>` +
    `<div class="actions">${runBtn('Start mock test', 'mock', 'quiz', 'secondary').replace(' sm', '')}</div></section>`
  );
}
