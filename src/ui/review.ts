import type { Ctx } from '../ctx';
import { IV, dueIds, lowAccuracyIds, notebook, unsureIds, yesterdayWrongIds } from '../srs';
import { keyOf, wdayOf } from '../store';
import type { Section } from '../types';
import { chips, esc, runBtn } from './common';

function secChips(c: Ctx): string {
  return chips(
    [
      ['', 'All'],
      ['g', '文法'],
      ['v', '単語'],
      ['k', '漢字'],
    ],
    c.ui.rsec,
    'rsec',
  );
}

function tile(label: string, n: number, kind: string, hint: string): string {
  return (
    `<div class="tile"><div class="big">${n}</div><p class="ts">${esc(label)}</p>` +
    (n ? runBtn('Start', kind, 'quiz', 'primary') : `<p class="note">${esc(hint)}</p>`) +
    `</div>`
  );
}

function reviewPanel(c: Ctx): string {
  const { S, bank, t } = c;
  const sec = (c.ui.rsec || undefined) as Section | undefined;
  const due = dueIds(S, bank, t, sec).length;
  const yw = yesterdayWrongIds(S, bank, t, sec).length;
  const low = lowAccuracyIds(S, bank, sec).length;
  const un = unsureIds(S, bank, sec).length;
  const up: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const id of Object.keys(S.items)) {
    const r = S.items[id];
    if (!bank.items.has(id) || r.seen === 0) continue;
    if (sec && bank.items.get(id)?.section !== sec) continue;
    const x = r.due - t;
    if (x >= 1 && x <= 7) up[x - 1]++;
  }
  const mx = Math.max(1, ...up);
  const cols = up
    .map((n, i) => `<div class="col"><span>${n}</span><div class="bx" style="height:${(n / mx) * 88}%"></div><span>${wdayOf(t + i + 1)}</span></div>`)
    .join('');
  return (
    secChips(c) +
    `<section class="panel"><p class="eyebrow">復習 REVIEW</p>` +
    `<div class="tiles">${tile('Due now 今日の復習', due, 'review', 'Nothing due.')}` +
    `${tile("Yesterday's mistakes 昨日の間違い", yw, 'yesterday', 'No mistakes yesterday.')}` +
    `${tile('Low accuracy 正答率70%未満', low, 'low', 'None below 70%.')}` +
    `${tile('Unsure 迷った', un, 'unsure', 'Nothing marked.')}</div>` +
    `<p class="note">Wrong answers are due again straight away. Each right answer moves an item out to ${IV.slice(1).join(', ')} days.</p>` +
    `<hr class="sep"><div><p class="eyebrow" style="margin-bottom:10px">COMING UP · NEXT 7 DAYS</p>` +
    `<div class="week" style="grid-template-columns:repeat(7,1fr)">${cols}</div></div></section>`
  );
}

function notebookPanel(c: Ctx): string {
  const { S, bank } = c;
  const sec = (c.ui.rsec || undefined) as Section | undefined;
  const all = notebook(S, bank, sec);
  const list = c.ui.nbAll ? all : all.filter((e) => !e.resolved);
  const rows = list
    .map((e) => {
      const it = bank.items.get(e.id);
      if (!it) return '';
      let title = '';
      let body = '';
      if (it.q) {
        const q = it.q;
        const right = q.choices[q.answer].text;
        const wrong = e.lastChoice;
        title = q.type === 'order' && q.order ? q.order.prefix + q.order.chunks.join('') + q.order.suffix : q.stem;
        body = `<p><b>正解:</b> ${esc(right)}</p>` + (wrong ? `<p><b>あなたの答え:</b> ${esc(wrong)}</p>` : '');
        const pat = q.refId ? bank.patternById.get(q.refId) : undefined;
        if (pat) body += `<button class="ghost" data-act="lesson" data-id="${esc(pat.id)}">解説を見る · ${esc(pat.pattern)}</button>`;
      } else if (it.w) {
        title = it.w.word;
        body = `<p>${esc(it.w.reading)} · ${esc(it.w.meaning)}</p>`;
      }
      const open = !!c.ui.nbOpen[e.id];
      return (
        `<li class="nb"><button class="nbhead" data-act="nbtoggle" data-id="${esc(e.id)}" aria-expanded="${open}">` +
        `<span class="nbt">${esc(title)}</span><span class="nbm">${e.resolved ? '解決済み' : '未解決'} · ×${e.wrongCount} · ${keyOf(e.lastWrong).slice(5)}${e.unsure ? ' · 迷った' : ''}</span></button>` +
        (open ? `<div class="nbbody">${body}</div>` : '') +
        `</li>`
      );
    })
    .join('');
  return (
    secChips(c) +
    `<section class="panel"><p class="eyebrow">間違いノート MISTAKE NOTEBOOK</p>` +
    `<div class="chips" style="margin:0">` +
    `<button class="chip" data-act="nbfilter" data-v="open" aria-pressed="${!c.ui.nbAll}">未解決 Open</button>` +
    `<button class="chip" data-act="nbfilter" data-v="all" aria-pressed="${c.ui.nbAll}">すべて All</button></div>` +
    (rows
      ? `<ul class="nblist">${rows}</ul>`
      : `<p class="empty">${all.length ? 'No open mistakes. Nice.' : 'No mistakes yet. Wrong answers are saved here with the answer you chose.'}</p>`) +
    `<p class="note">A mistake counts as solved after two right answers in a row. Tap a line to see the answer.</p></section>`
  );
}

export function reviewView(c: Ctx): string {
  return (
    chips(
      [
        ['review', '復習 Review'],
        ['notebook', '間違いノート Notebook'],
      ],
      c.ui.rsub,
      'rsub',
    ) + (c.ui.rsub === 'review' ? reviewPanel(c) : notebookPanel(c))
  );
}

