import { BLANK } from '../bank';
import type { Ctx } from '../ctx';
import type { RQ } from '../quiz';
import type { Bi, Pattern } from '../types';

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/**
 * Escapes text and applies the two bits of CSV notation:
 * 漢字[かんじ] becomes ruby, and a line break (a real one or a typed \\n) becomes <br>.
 */
export function rich(s: string): string {
  return esc(s)
    .replace(/([\u4e00-\u9fff々〆ヶ]+)\[([^\]\n]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/\\n|\r?\n/g, '<br>');
}

/** Same text without the notation, for places that cannot show ruby. */
export function plain(s: string): string {
  return s.replace(/([\u4e00-\u9fff々〆ヶ]+)\[[^\]\n]+\]/g, '$1').replace(/\\n|\r?\n/g, ' ');
}

/** Text in the language the learner chose. 'both' shows Japanese with English underneath. */
export function tx(c: Ctx, b: Bi): string {
  const lang = c.S.settings.lang;
  const ja = b.ja.trim();
  const en = b.en.trim();
  if (lang === 'ja') return rich(ja || en);
  if (lang === 'en') return rich(en || ja);
  if (ja && en) return `${rich(ja)}<br><span class="tr">${rich(en)}</span>`;
  return rich(ja || en);
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
  if (q.big) return `<p class="bigstem${/^[\x00-\x7f]/.test(q.stem) ? ' en' : ''}">${rich(q.stem)}</p>`;
  const answer = q.opts[q.ans]?.text ?? '';
  const slot = (): string => `<span class="blank">${filled ? rich(answer) : ''}</span>`;
  if (q.stem.includes('★')) {
    const [a, b] = q.stem.split('★');
    return `<p class="gstem">${rich(a)}${slot()}${rich(b)}</p>`;
  }
  const m = BLANK.exec(q.stem);
  if (m) {
    const before = q.stem.slice(0, m.index);
    const after = q.stem.slice(m.index + m[0].length);
    return `<p class="gstem">${rich(before)}${slot()}${rich(after)}</p>`;
  }
  return `<p class="gstem">${rich(q.stem).replace(/【(.+?)】/g, '<b class="tgt">【$1】</b>')}</p>`;
}

/** The full explanation of a grammar pattern. */
export function lessonBody(c: Ctx, p: Pattern): string {
  const group = c.bank.groupById.get(p.groupId);
  const qn = c.bank.questionsByPattern.get(p.id)?.length ?? 0;
  const ex = p.examples
    .map((e) => {
      const ja = p.answer && e.ja.includes(p.answer) ? rich(e.ja).replace(esc(p.answer), `<mark>${esc(p.answer)}</mark>`) : rich(e.ja);
      return `<li>${ja}${e.en ? `<br><span class="t">${rich(e.en)}</span>` : ''}</li>`;
    })
    .join('');
  return (
    `<div class="lesson">` +
    (group ? `<p class="eyebrow">${esc(group.ja)} · ${esc(group.en)}</p>` : '') +
    `<p class="pat">${rich(p.pattern)}</p>` +
    `<p class="mean">${tx(c, p.meaning)}</p>` +
    (p.connection ? `<p class="conn"><b>接続 Form</b><br>${rich(p.connection)}</p>` : '') +
    (p.nuance.ja || p.nuance.en ? `<p><b>違い Nuance</b><br>${tx(c, p.nuance)}</p>` : '') +
    (p.mistake.ja || p.mistake.en ? `<p><b>よくある間違い Common mistake</b><br>${tx(c, p.mistake)}</p>` : '') +
    (ex ? `<div><p class="lab"><b>例文 Examples</b></p><ul class="exs">${ex}</ul></div>` : '') +
    `<p class="note">${qn} practice question${qn === 1 ? '' : 's'}</p></div>`
  );
}
