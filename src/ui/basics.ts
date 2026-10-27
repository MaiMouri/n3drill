import type { Ctx } from '../ctx';
import { statusOf } from '../srs';
import { chips, esc, lessonBody } from './common';

function formsHtml(): string {
  const rows = [
    ['辞書形', '書く', '食べる', 'する', '来る'],
    ['ます形', '書きます', '食べます', 'します', '来ます'],
    ['て形', '書いて', '食べて', 'して', '来て'],
    ['た形', '書いた', '食べた', 'した', '来た'],
    ['ない形', '書かない', '食べない', 'しない', '来ない'],
    ['可能形', '書ける', '食べられる', 'できる', '来られる'],
    ['受身', '書かれる', '食べられる', 'される', '来られる'],
    ['使役', '書かせる', '食べさせる', 'させる', '来させる'],
    ['意向形', '書こう', '食べよう', 'しよう', '来よう'],
    ['ば形', '書けば', '食べれば', 'すれば', '来れば'],
  ];
  return (
    `<h2>活用 Verb forms</h2><div class="tblwrap"><table><thead><tr><th>Form</th><th>書く (group 1)</th><th>食べる (group 2)</th><th>する</th><th>来る</th></tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('') +
    `</tbody></table></div>` +
    `<h3>て形 / た形 for group 1 verbs</h3><ul class="rules"><li>く → いて (書いて). ぐ → いで (泳いで). 行く is the exception: 行って.</li><li>す → して (話して).</li><li>む・ぶ・ぬ → んで (飲んで・遊んで・死んで).</li><li>る・う・つ → って (取って・買って・待って).</li><li>Group 2: drop る and add て (食べて).</li></ul>` +
    `<h3>Notation used in the grammar notes</h3><ul class="rules"><li><b>V辞</b>: dictionary form (書く). <b>Vない</b>: negative (書かない). <b>Vた</b>: past (書いた). <b>Vて</b>: て-form (書いて).</li>` +
    `<li><b>V-stem</b>: ます-form without ます (書き, 食べ).</li><li><b>Plain form</b>: 書く / 書かない / 書いた / 書かなかった.</li>` +
    `<li><b>N</b> noun, <b>イAdj</b> い-adjective, <b>ナAdj</b> な-adjective.</li>` +
    `<li>Before a noun-like word: <b>N の</b>, <b>ナAdj な</b>, イAdj as is, verbs in plain form. Example: 子どもの / 静かな / 高い / 行く + ために・おかげで・せいで.</li></ul>`
  );
}

function examHtml(): string {
  return (
    `<h2>試験 The N3 exam</h2><div class="tblwrap"><table><thead><tr><th>Section</th><th>Time</th></tr></thead><tbody>` +
    `<tr><td>言語知識（文字・語彙）</td><td>30 min</td></tr><tr><td>言語知識（文法）・読解</td><td>70 min</td></tr><tr><td>聴解</td><td>40 min</td></tr></tbody></table></div>` +
    `<ul class="rules"><li>The score is out of 180 (60 each for language knowledge, reading and listening). You need 95 or more in total, and at least 19 in each of the three areas.</li>` +
    `<li>Check the official JLPT website for the current format before the exam day.</li>` +
    `<li>This app covers vocabulary, kanji readings and grammar. Reading and listening are about two-thirds of the points, so the daily plan asks for 30 minutes of them outside the app.</li></ul>`
  );
}

function matches(q: string, ...parts: string[]): boolean {
  return !q || parts.join(' ').toLowerCase().includes(q);
}

/** The list under the search box. Re-rendered on its own while typing. */
export function basicsList(c: Ctx): string {
  const q = c.ui.bq.trim().toLowerCase();
  const { bank, S } = c;
  if (c.ui.bsub === 'g') {
    let out = '';
    let n = 0;
    let lastGroup = '';
    for (const p of bank.patterns) {
      if (!matches(q, p.pattern, p.meaning.ja, p.meaning.en, p.connection, p.nuance.ja, p.nuance.en, ...p.examples.map((e) => e.ja + ' ' + e.en))) continue;
      n++;
      const g = bank.groupById.get(p.groupId);
      if (g && g.id !== lastGroup) {
        lastGroup = g.id;
        out += `<li class="gh">${esc(g.ja)} · ${esc(g.en)}</li>`;
      }
      const learned = S.learned[p.id] ? '学習済み' : '';
      out +=
        `<li><details><summary><span class="pat">${esc(p.pattern)}</span><span class="sm2">${esc(p.meaning.en || p.meaning.ja)}</span>${learned ? `<span class="st">${learned}</span>` : ''}</summary>` +
        `${lessonBody(c, p)}<div class="actions"><button class="secondary sm" data-act="practice-pattern" data-id="${esc(p.id)}">この文法を練習 · Practice</button></div></details></li>`;
    }
    if (!n) return '<p class="empty">No matches.</p>';
    return `<p class="note" style="margin-bottom:6px">${n} shown</p><ul class="gref">${out}</ul>`;
  }
  const kind = c.ui.bsub === 'v' ? 'wm' : 'wr';
  const ids = kind === 'wm' ? bank.wm : bank.wr;
  let out = '';
  let n = 0;
  for (const id of ids) {
    const w = bank.items.get(id)?.w;
    if (!w || !matches(q, w.word, w.reading, w.meaning)) continue;
    n++;
    out += `<li><span class="w">${esc(w.word)}</span><span class="d">${esc(w.reading)}<small>${esc(w.meaning)}</small></span><span class="st">${statusOf(S, id)}</span></li>`;
  }
  if (!n) return '<p class="empty">No matches.</p>';
  return `<p class="note" style="margin-bottom:6px">${n} shown</p><ul class="list">${out}</ul>`;
}

export function basicsView(c: Ctx): string {
  const s = c.ui.bsub;
  const cs = chips(
    [
      ['g', '文法 Grammar'],
      ['v', '語彙 Vocab'],
      ['k', '漢字語 Kanji'],
      ['f', '活用 Forms'],
      ['e', '試験 Exam'],
    ],
    s,
    'base',
  );
  let body: string;
  if (s === 'f') body = formsHtml();
  else if (s === 'e') body = examHtml();
  else {
    const title = { g: `文法 Grammar patterns (${c.bank.patterns.length})`, v: `語彙 Vocabulary (${c.bank.wm.length})`, k: `漢字語 Kanji words (${c.bank.wr.length})` }[s];
    body =
      `<h2>${title}</h2><label class="lb" for="bq">Search</label>` +
      `<input id="bq" class="field" type="search" placeholder="Japanese, English or pattern" value="${esc(c.ui.bq)}" autocomplete="off">` +
      `<div id="blist">${basicsList(c)}</div>`;
  }
  return cs + `<section class="panel">${body}</section>`;
}
