import type { Ctx } from '../ctx';
import { DAYS, GOAL } from '../plan';
import { accuracy, counts, patternStats, weakIds } from '../srs';
import { keyOf, wdayOf } from '../store';
import type { Section } from '../types';
import { esc } from './common';
import { SECS, sectionIds } from './practice';

function pct(r: number, s: number): number | null {
  return s ? Math.round((r / s) * 100) : null;
}

export function statsView(c: Ctx): string {
  const { S, bank, t } = c;
  const total = accuracy(S, bank.itemIds);
  if (!total.seen) {
    return `<section class="panel"><h2>Stats</h2><p class="empty">Answer a few questions and your accuracy, mastery and daily results will appear here.</p><p class="note">Progress is saved in this browser on this device.</p></section>`;
  }
  const secs = (['g', 'v', 'k'] as Section[])
    .map((s) => {
      const ids = sectionIds(c, s);
      const cn = counts(S, ids);
      const a = accuracy(S, ids);
      const p = pct(a.right, a.seen);
      const n = ids.length || 1;
      return (
        `<div class="row"><div class="lab">${SECS[s].jp}<small>${cn.m} / ${ids.length} mastered</small></div>` +
        `<div class="stack" role="img" aria-label="${SECS[s].en}: ${cn.m} mastered, ${cn.l} learning, ${cn.n} new"><i class="m" style="width:${(cn.m / n) * 100}%"></i><i class="l" style="width:${(cn.l / n) * 100}%"></i></div>` +
        `<span class="pc">${p === null ? '–' : p + '%'}</span></div>`
      );
    })
    .join('');

  const days: { n: number; a: number | null; w: string; now: boolean }[] = [];
  for (let i = 9; i >= 0; i--) {
    const d = S.days[keyOf(t - i)] ?? { n: 0, c: 0 };
    days.push({ n: d.n, a: pct(d.c, d.n), w: wdayOf(t - i), now: i === 0 });
  }
  const acc = days
    .map(
      (d) =>
        `<div class="col${d.now ? ' today' : ''}"><span>${d.a === null ? '–' : d.a}</span><div class="bx" style="height:${d.a === null ? 0 : d.a * 0.8}%"></div><span>${d.w}</span><span>${d.n}</span></div>`,
    )
    .join('');

  let grid = '';
  if (S.plan.start != null) {
    let cells = '';
    for (let i = 1; i <= DAYS; i++) {
      const n = S.plan.start + i - 1;
      const d = S.days[keyOf(n)] ?? { n: 0, c: 0 };
      let cl = 'cell';
      if (n > t) cl += ' fut';
      else if (d.n >= GOAL) cl += ' full';
      else if (d.n > 0) cl += ' part';
      if (n === t) cl += ' now';
      cells += `<div class="${cl}" aria-label="Day ${i}: ${d.n} questions">${i}</div>`;
    }
    grid = `<div><p class="eyebrow" style="margin-bottom:10px">40-DAY PLAN · FILLED = ${GOAL}+ QUESTIONS</p><div class="grid40">${cells}</div></div>`;
  }

  const mocks = S.mocks
    .slice(-5)
    .reverse()
    .map((m) => `<li><span>${m.k}</span><span>${m.s} / ${m.n} (${Math.round((m.s / m.n) * 100)}%)</span></li>`)
    .join('');

  const pats = patternStats(S, bank)
    .filter((p) => p.seen >= 2 && p.right < p.seen)
    .sort((a, b) => a.right / a.seen - b.right / b.seen || b.seen - a.seen)
    .slice(0, 6)
    .map((p) => {
      const pat = bank.patternById.get(p.id);
      return `<li><span>${esc(pat?.pattern ?? p.id)}</span><span>${p.right}/${p.seen}</span></li>`;
    })
    .join('');

  const weak = weakIds(S, bank)
    .slice(0, 8)
    .map((id) => {
      const it = bank.items.get(id);
      const r = S.items[id];
      const label = it?.q ? (it.q.type === 'order' ? it.q.order?.chunks.join('') ?? id : it.q.stem) : it?.w ? it.w.word + ' ' + (it.w.reading || '') : id;
      const short = label.length > 26 ? label.slice(0, 26) + '…' : label;
      return `<li><span>${esc(short)}</span><span>${r.right}/${r.seen}</span></li>`;
    })
    .join('');

  return (
    `<section class="panel">` +
    `<div><p class="eyebrow" style="margin-bottom:6px">OVERALL ACCURACY 正答率</p><div class="big">${pct(total.right, total.seen)}% <small>${total.right} of ${total.seen} answers correct</small></div></div>` +
    `<div><p class="eyebrow" style="margin-bottom:10px">BY SECTION · MASTERY AND ACCURACY</p><div style="display:flex;flex-direction:column;gap:10px">${secs}</div>` +
    `<div class="legend" style="margin-top:8px"><span><i class="sw m"></i>Mastered</span><span><i class="sw l"></i>Learning</span><span><i class="sw n"></i>New</span></div></div>` +
    `<div><p class="eyebrow" style="margin-bottom:10px">ACCURACY % BY DAY · QUESTIONS BELOW</p><div class="week" style="grid-template-columns:repeat(10,1fr);height:150px">${acc}</div></div>` +
    grid +
    (mocks ? `<div><p class="eyebrow" style="margin-bottom:6px">MOCK TESTS</p><ul class="weak">${mocks}</ul></div>` : '') +
    (pats ? `<div><p class="eyebrow" style="margin-bottom:6px">GRAMMAR PATTERNS TO REVISIT</p><ul class="weak">${pats}</ul></div>` : '') +
    `<div><p class="eyebrow" style="margin-bottom:6px">NEEDS PRACTICE</p>${weak ? `<ul class="weak">${weak}</ul>` : '<p class="empty">Nothing missed right now.</p>'}</div>` +
    `<p class="note">Mastered means answered correctly three times in a row. Progress is saved in this browser on this device.</p></section>`
  );
}
