import type { Ctx, Run } from '../ctx';
import { esc, lessonBody, rich, stemHtml, tx } from './common';

const LETTERS = ['ア', 'イ', 'ウ', 'エ'];

function head(r: Run, n: number): string {
  const shown = Math.min(r.i + 1, n);
  return (
    `<div class="qhead"><p class="eyebrow">${esc(r.title)}</p><span class="count">${shown} / ${n}</span></div>` +
    `<div class="bar"><i style="width:${n ? (r.i / n) * 100 : 0}%"></i></div>`
  );
}

function quizView(c: Ctx, r: Run): string {
  const q = r.qs[r.i];
  const answered = r.sel !== null;
  const opts = q.opts
    .map((o, i) => {
      let cl = 'opt';
      if (answered) cl += i === q.ans ? ' good' : i === r.sel ? ' bad' : ' dim';
      return `<button class="${cl}" data-act="answer" data-i="${i}"${answered ? ' disabled' : ''}><span class="n">${LETTERS[i]}</span><span class="tx">${rich(o.text)}</span></button>`;
    })
    .join('');
  let fb = '';
  if (answered) {
    const ok = r.sel === q.ans;
    const chosen = q.opts[r.sel as number];
    const right = q.opts[q.ans];
    let body = '';
    if (q.detail) body += `<p>${q.detail}</p>`;
    if (!ok && (chosen.explain.ja || chosen.explain.en)) body += `<p><b>${rich(chosen.text)}</b><br>${tx(c, chosen.explain)}</p>`;
    if (right.explain.ja || right.explain.en) body += `<p><b>${rich(right.text)}</b><br>${tx(c, right.explain)}</p>`;
    if (q.summary.ja || q.summary.en) body += `<p>${tx(c, q.summary)}</p>`;
    const pat = q.refId ? c.bank.patternById.get(q.refId) : undefined;
    if (pat) body += `<button class="ghost" data-act="lesson" data-id="${esc(pat.id)}">解説を見る · ${esc(pat.pattern)}</button>`;
    fb =
      `<div class="fb ${ok ? 'good' : 'bad'}" role="status"><p class="verdict">${ok ? '正解 Correct' : `不正解 · 答え: ${rich(right.text)}`}</p>${body}</div>`;
  }
  return (
    head(r, r.qs.length) +
    (q.instruction ? `<p class="hint">${rich(q.instruction)}</p>` : q.hint ? `<p class="hint">${esc(q.hint)}</p>` : '') +
    stemHtml(q, answered) +
    `<div class="opts">${opts}</div>` +
    `<button class="secondary sm flagbtn" data-act="flag" aria-pressed="${r.flag}">迷った · Not sure${r.flag ? ' ✓' : ''}</button>` +
    fb +
    (answered ? `<div class="actions"><button class="primary" data-act="next">${r.i + 1 >= r.qs.length ? '結果を見る · Results' : '次へ · Next'}</button></div>` : '') +
    `<div class="actions"><button class="ghost" data-act="quit">終了 · Quit</button></div>`
  );
}

function cardsView(c: Ctx, r: Run): string {
  const id = r.ids[r.i];
  const w = c.bank.items.get(id)?.w;
  if (!w) return '';
  const front = id.endsWith(':r') ? w.word : w.word;
  const back =
    `<span class="rd">${esc(w.reading)}</span><span class="mn">${esc(w.meaning)}</span>` +
    (w.example ? `<span class="ex">${esc(w.example)}</span>${w.exampleTr ? `<span class="cn">${esc(w.exampleTr)}</span>` : ''}` : '');
  return (
    head(r, r.ids.length) +
    `<button class="flash" data-act="flip" aria-label="Flip card"><span class="wsm">${esc(front)}</span>` +
    (r.flip ? back : '<span class="tap">タップして答えを見る · Tap to flip</span>') +
    `</button>` +
    (r.flip
      ? `<div class="rate"><button class="secondary" data-act="again">もう一度 · Again</button><button class="primary" data-act="got">覚えた · Got it</button></div>`
      : '') +
    `<div class="actions"><button class="ghost" data-act="quit">終了 · Quit</button></div>`
  );
}

function lessonView(c: Ctx, r: Run): string {
  const p = c.bank.patternById.get(r.ids[r.i]);
  if (!p) return '';
  return (
    head(r, r.ids.length) +
    lessonBody(c, p) +
    `<div class="rate"><button class="secondary" data-act="later">あとで · Later</button><button class="primary" data-act="understood">理解した · Understood</button></div>` +
    `<div class="actions"><button class="ghost" data-act="quit">終了 · Quit</button></div>`
  );
}

function resultView(c: Ctx, r: Run): string {
  if (r.mode === 'lesson') {
    const n = r.learnedNow.length;
    const check = r.learnedNow.some((id) => (c.bank.questionsByPattern.get(id) ?? []).length);
    return (
      `<p class="eyebrow">${esc(r.title)}</p><h2>${n} lesson${n === 1 ? '' : 's'} studied</h2>` +
      `<p class="lead">${check ? 'Now try the check questions for what you just studied.' : 'Nice work.'}</p>` +
      `<div class="actions">${check ? '<button class="primary" data-act="check">確認問題 · Check quiz</button>' : ''}<button class="secondary" data-act="quit">閉じる · Close</button></div>`
    );
  }
  if (r.mode === 'cards') {
    return (
      `<p class="eyebrow">${esc(r.title)}</p><h2>${r.got.length} remembered, ${r.again.length} to see again</h2>` +
      `<div class="actions"><button class="primary" data-act="quit">閉じる · Close</button></div>`
    );
  }
  const n = r.qs.length;
  const miss = r.missed
    .map((id) => {
      const q = r.qs.find((x) => x.id === id);
      return q ? `<li><b>${rich(q.completed)}</b></li>` : '';
    })
    .join('');
  return (
    `<p class="eyebrow">${esc(r.title)}</p><p class="score">${r.score} / ${n}</p>` +
    `<p class="lead">${n ? Math.round((r.score / n) * 100) : 0}% correct</p>` +
    (miss ? `<div><p class="eyebrow" style="margin-bottom:6px">間違い MISSED · saved to your notebook</p><ul class="miss">${miss}</ul></div>` : '<p class="verdict" style="color:var(--good)">全問正解 All correct.</p>') +
    `<div class="actions">${miss ? '<button class="primary" data-act="retry">間違いをもう一度 · Retry missed</button>' : ''}<button class="${miss ? 'secondary' : 'primary'}" data-act="quit">閉じる · Close</button></div>`
  );
}

export function runView(c: Ctx): string {
  const r = c.ui.run;
  if (!r) return '';
  const inner = r.done ? resultView(c, r) : r.mode === 'quiz' ? quizView(c, r) : r.mode === 'cards' ? cardsView(c, r) : lessonView(c, r);
  return `<section class="panel">${inner}</section>`;
}
