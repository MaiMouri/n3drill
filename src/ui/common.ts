import { BLANK } from '../bank';
import type { Ctx } from '../ctx';
import type { RQ } from '../quiz';
import type { Bi, Pattern } from '../types';

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** Text in the language the learner chose. 'both' shows Japanese with English underneath. */
export function tx(c: Ctx, b: Bi): string {
  const lang = c.S.settings.lang;
  const ja = b.ja.trim();
  const en = b.en.trim();
  if (lang === 'ja') return esc(ja || en);
  if (lang === 'en') return esc(en || ja);
  if (ja && en) return `${esc(ja)}<br><span class="tr">${esc(en)}</span>`;
  return esc(ja || en);
}

export function chips(list: [string, string][], cur: string, key: string): string {
  return (
    '<div class="chips">' +
    list
      .map(([v, label]) => `<button class="chip" data-chip="${key}:${v}" aria-pressed="${v === cur}">${esc(label)}</button>`)
      .join('') +
    '</div>'
  );
}

export function meter(c: { m: number; l: number; n: number }, n: number): string {
  const m = n ? (c.m / n) * 100 : 0;
  const l = n ? (c.l / n) * 100 : 0;
  return (
    `<div class="meter"><div class="stack" role="img" aria-label="${c.m} mastered, ${c.l} learning, ${c.n} new">` +
    `<i class="m" style="width:${m}%"></i><i class="l" style="width:${l}%"></i></div>` +
    `<div class="legend"><span><i class="sw m"></i>Mastered ${c.m}</span><span><i class="sw l"></i>Learning ${c.l}</span><span><i class="sw n"></i>New ${c.n}</span></div></div>`
  );
}

export interface Task {
  title: string;
  sub: string;
  done: boolean;
  btn?: string;
}

export function task(t: Task): string {
  return (
    `<li class="task${t.done ? ' done' : ''}"><div class="th"><b>${esc(t.title)}</b>` +
    `<span class="pill ${t.done ? 'ok' : 'todo'}">${t.done ? 'Done' : 'To do'}</span></div>` +
    `<p class="ts">${esc(t.sub)}</p>${t.btn ? `<div class="actions">${t.btn}</div>` : ''}</li>`
  );
}

export function runBtn(label: string, kind: string, mode: string, cls = 'primary', extra = ''): string {
  return `<button class="${cls} sm" data-act="run" data-kind="${kind}" data-mode="${mode}"${extra}>${esc(label)}</button>`;
}

/** The sentence of a question, with the blank (or the star slot) drawn. `filled` shows the correct answer in it. */
export function stemHtml(q: RQ, filled: boolean): string {
  if (q.big) return `<p class="bigstem${/^[\x00-\x7f]/.test(q.stem) ? ' en' : ''}">${esc(q.stem)}</p>`;
  const answer = q.opts[q.ans]?.text ?? '';
  const slot = (): string => `<span class="blank">${filled ? esc(answer) : ''}</span>`;
  if (q.stem.includes('★')) {
    const [a, b] = q.stem.split('★');
    return `<p class="gstem">${esc(a)}${slot()}${esc(b)}</p>`;
  }
  const m = BLANK.exec(q.stem);
  if (m) {
    const before = q.stem.slice(0, m.index);
    const after = q.stem.slice(m.index + m[0].length);
    return `<p class="gstem">${esc(before)}${slot()}${esc(after)}</p>`;
  }
  return `<p class="gstem">${esc(q.stem).replace(/【(.+?)】/g, '<b class="tgt">【$1】</b>')}</p>`;
}

/** The full explanation of a grammar pattern. */
export function lessonBody(c: Ctx, p: Pattern): string {
  const group = c.bank.groupById.get(p.groupId);
  const qn = c.bank.questionsByPattern.get(p.id)?.length ?? 0;
  const ex = p.examples
    .map((e) => {
      const ja = p.answer && e.ja.includes(p.answer) ? esc(e.ja).replace(esc(p.answer), `<mark>${esc(p.answer)}</mark>`) : esc(e.ja);
      return `<li>${ja}${e.en ? `<br><span class="t">${esc(e.en)}</span>` : ''}</li>`;
    })
    .join('');
  return (
    `<div class="lesson">` +
    (group ? `<p class="eyebrow">${esc(group.ja)} · ${esc(group.en)}</p>` : '') +
    `<p class="pat">${esc(p.pattern)}</p>` +
    `<p class="mean">${tx(c, p.meaning)}</p>` +
    (p.connection ? `<p class="conn"><b>接続 Form</b><br>${esc(p.connection)}</p>` : '') +
    (p.nuance.ja || p.nuance.en ? `<p><b>違い Nuance</b><br>${tx(c, p.nuance)}</p>` : '') +
    (p.mistake.ja || p.mistake.en ? `<p><b>よくある間違い Common mistake</b><br>${tx(c, p.mistake)}</p>` : '') +
    (ex ? `<div><p class="lab"><b>例文 Examples</b></p><ul class="exs">${ex}</ul></div>` : '') +
    `<p class="note">${qn} practice question${qn === 1 ? '' : 's'}</p></div>`
  );
}
