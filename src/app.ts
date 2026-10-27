import { ID_KEY, buildBank, mergeRows, type Bank, type RawData } from './bank';
import type { Ctx, Run, Tab, UI } from './ctx';
import { parseTable, type Row } from './csv';
import { pendingLessons, pendingWordItems, unlockedItemIds } from './plan';
import { makeRQ, shuffle } from './quiz';
import { dueIds, lowAccuracyIds, pickWeighted, record, setUnsure, unsureIds, weakIds, yesterdayWrongIds } from './srs';
import { KINDS, Store, fresh, keyOf, normalize, today } from './store';
import type { CustomKind, Lang, Section } from './types';
import { addView } from './ui/add';
import { basicsList, basicsView } from './ui/basics';
import { esc } from './ui/common';
import { practiceView, sectionIds } from './ui/practice';
import { reviewView } from './ui/review';
import { runView } from './ui/run';
import { statsView } from './ui/stats';
import { todayView } from './ui/today';

export interface BootOpts {
  fetchText: (url: string) => Promise<string>;
  storage: Storage | null;
  now?: () => number;
  offsetMin?: number;
}

const FILES: Record<CustomKind, string> = {
  groups: 'data/grammar_groups.csv',
  patterns: 'data/grammar_patterns.csv',
  questions: 'data/questions.csv',
  order: 'data/grammar_order.csv',
  words: 'data/words.csv',
};

const TABS: [Tab, string, string][] = [
  ['today', '今日', 'Today'],
  ['prac', '練習', 'Practice'],
  ['rev', '復習', 'Review'],
  ['base', '基礎', 'Basics'],
  ['stat', '記録', 'Stats'],
  ['add', '追加', 'Add/Save'],
];

const TITLES: Record<string, string> = {
  free: 'Practice',
  review: 'Review',
  yesterday: "Yesterday's mistakes",
  low: 'Low accuracy',
  unsure: 'Unsure',
  weak: 'Weak spots',
  unlocked: 'Daily practice',
  mock: 'Mock test',
  learn: 'New words',
  lesson: 'Grammar lessons',
  check: 'Check quiz',
  retry: 'Retry missed',
  view: 'Lesson',
};

function newUI(): UI {
  return {
    tab: 'today', psub: 'g', bsub: 'g', bq: '', rsub: 'review', rsec: '', nbAll: false, nbOpen: {},
    addKind: 'questions', addText: '', bkText: '', addMsg: '', cf: '', note: '', run: null, back: null,
  };
}

function newRun(kind: string, mode: Run['mode'], ids: string[]): Run {
  return {
    kind, mode, ids, i: 0, done: false, title: TITLES[kind] ?? kind, qs: [], sel: null, flag: false,
    score: 0, missed: [], flip: false, got: [], again: [], learnedNow: [],
  };
}

export async function boot(root: HTMLElement, opts: BootOpts): Promise<{ dispose: () => void }> {
  const store = new Store(opts.storage);
  const ui = newUI();
  const nowFn = opts.now ?? Date.now;
  const T = (): number => today(nowFn(), opts.offsetMin);
  let bank!: Bank;
  let base!: RawData;

  root.innerHTML =
    `<div class="wrap"><header class="top"><div class="brand"><h1>N3ドリル</h1><p class="sub">日本語能力試験 N3 · 40日プラン</p></div>` +
    `<nav class="tabs" id="tabs" aria-label="Sections">${TABS.map(([v, jp, en]) => `<button class="tab" data-tab="${v}" aria-selected="false"><b>${jp}</b><span>${en}</span></button>`).join('')}</nav></header>` +
    `<div id="warn"></div><main id="view"><p class="empty">読み込み中… Loading…</p></main></div>`;
  const view = root.querySelector('#view') as HTMLElement;
  const warn = root.querySelector('#warn') as HTMLElement;

  const rebuild = (): void => {
    const raw = {} as RawData;
    for (const k of KINDS) raw[k] = mergeRows(base[k], store.state.custom[k], ID_KEY[k]);
    bank = buildBank(raw);
  };

  try {
    base = {} as RawData;
    const texts = await Promise.all(KINDS.map((k) => opts.fetchText(FILES[k])));
    KINDS.forEach((k, i) => (base[k] = parseTable(texts[i])));
    rebuild();
  } catch (e) {
    view.innerHTML = `<section class="panel"><h2>Could not load the data</h2><p class="lead">${esc(String(e))}</p><div class="actions"><button class="primary" onclick="location.reload()">Reload</button></div></section>`;
    return { dispose: () => {} };
  }

  const canDownload = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const ctx = (): Ctx => ({ S: store.state, bank, ui, t: T(), storeOk: store.ok, canDownload });

  function render(scroll = false): void {
    const c = ctx();
    root.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab && !ui.run)));
    warn.innerHTML =
      (store.ok ? '' : '<div class="warn">This browser is not saving your progress. Make a backup in Add/Save before closing.</div>') +
      (bank.warnings.length ? `<div class="warn">${bank.warnings.length} CSV row${bank.warnings.length === 1 ? '' : 's'} skipped: ${esc(bank.warnings.slice(0, 3).join(' / '))}${bank.warnings.length > 3 ? ' …' : ''}</div>` : '');
    const note = ui.note ? `<p class="notice">${esc(ui.note)}</p>` : '';
    let body: string;
    if (ui.run) body = runView(c);
    else if (ui.tab === 'today') body = todayView(c);
    else if (ui.tab === 'prac') body = practiceView(c);
    else if (ui.tab === 'rev') body = reviewView(c);
    else if (ui.tab === 'base') body = basicsView(c);
    else if (ui.tab === 'stat') body = statsView(c);
    else body = addView(c);
    view.innerHTML = note + body;
    if (scroll) {
      try {
        window.scrollTo(0, 0);
      } catch {
        /* not available */
      }
    }
  }

  /** ---- starting runs ---- */
  function pool(kind: string, sec: Section | undefined): { ids: string[]; mode: Run['mode'] } | null {
    const S = store.state;
    const t = T();
    switch (kind) {
      case 'review':
        return { ids: shuffle(dueIds(S, bank, t, sec)).slice(0, 20), mode: 'quiz' };
      case 'yesterday':
        return { ids: shuffle(yesterdayWrongIds(S, bank, t, sec)).slice(0, 20), mode: 'quiz' };
      case 'low':
        return { ids: shuffle(lowAccuracyIds(S, bank, sec)).slice(0, 20), mode: 'quiz' };
      case 'unsure':
        return { ids: shuffle(unsureIds(S, bank, sec)).slice(0, 20), mode: 'quiz' };
      case 'weak':
        return { ids: shuffle(weakIds(S, bank)).slice(0, 20), mode: 'quiz' };
      case 'unlocked': {
        const ids = S.plan.start == null ? bank.itemIds : unlockedItemIds(S, bank, t);
        return { ids: pickWeighted(S, ids, 10, t), mode: 'quiz' };
      }
      case 'mock': {
        const ids: string[] = [];
        for (const s of ['g', 'v', 'k'] as Section[]) ids.push(...shuffle(sectionIds(ctx(), s)).slice(0, 10));
        return { ids, mode: 'quiz' };
      }
      case 'lesson':
        return { ids: pendingLessons(S, bank, t).map((p) => p.id), mode: 'lesson' };
      case 'learn': {
        const seen = new Set<string>();
        const ids = pendingWordItems(S, bank, t).filter((id) => {
          const w = bank.items.get(id)?.w;
          if (!w || seen.has(w.id)) return false;
          seen.add(w.id);
          return true;
        });
        return { ids: ids.slice(0, 30), mode: 'cards' };
      }
      default:
        return null;
    }
  }

  function begin(run: Run): void {
    if (run.mode === 'quiz') {
      run.qs = run.ids.map((id) => makeRQ(bank, id)).filter((x): x is NonNullable<typeof x> => !!x);
      run.ids = run.qs.map((q) => q.id);
    }
    const n = run.mode === 'quiz' ? run.qs.length : run.ids.length;
    if (!n) {
      ui.note = 'Nothing to practise here yet.';
      ui.run = null;
      return;
    }
    ui.run = run;
  }

  function start(kind: string, mode: string, secAttr: string | undefined): void {
    const sec = (secAttr || (['review', 'yesterday', 'low', 'unsure'].includes(kind) ? ui.rsec : '') || undefined) as Section | undefined;
    if (kind === 'free') {
      const s = sec ?? ui.psub;
      const S = store.state;
      let ids = sectionIds(ctx(), s);
      if (S.plan.start != null) {
        const unlocked = new Set(unlockedItemIds(S, bank, T()));
        const u = ids.filter((id) => unlocked.has(id));
        if (u.length >= 4) ids = u;
      }
      if (mode === 'cards') {
        const seen = new Set<string>();
        ids = ids.filter((id) => {
          const w = bank.items.get(id)?.w;
          if (!w || seen.has(w.id)) return false;
          seen.add(w.id);
          return true;
        });
        begin(newRun(kind, 'cards', shuffle(ids).slice(0, 20)));
      } else {
        begin(newRun(kind, 'quiz', pickWeighted(S, ids, 10, T())));
      }
      return;
    }
    const p = pool(kind, sec);
    if (!p) return;
    begin(newRun(kind, p.mode, p.ids));
  }

  function checkQuiz(r: Run): void {
    const ids: string[] = [];
    for (const pid of r.learnedNow) ids.push(...(bank.questionsByPattern.get(pid) ?? []));
    begin(newRun('check', 'quiz', ids.slice(0, 15)));
  }

  function leave(): void {
    if (ui.run?.kind === 'view' && ui.back) {
      ui.run = ui.back;
      ui.back = null;
    } else {
      ui.run = null;
      ui.back = null;
    }
  }

  function advance(r: Run): void {
    r.i++;
    r.sel = null;
    r.flag = false;
    r.flip = false;
    const n = r.mode === 'quiz' ? r.qs.length : r.ids.length;
    if (r.i >= n) {
      r.done = true;
      if (r.kind === 'mock' && r.mode === 'quiz') store.state.mocks.push({ k: keyOf(T()), s: r.score, n: r.qs.length });
      if (r.kind === 'view') leave();
    }
    store.save();
  }

  function sibling(id: string): string | null {
    const o = id.endsWith(':m') ? id.slice(0, -2) + ':r' : id.endsWith(':r') ? id.slice(0, -2) + ':m' : '';
    return o && bank.items.has(o) ? o : null;
  }

  function importCsv(): void {
    const kind = ui.addKind;
    const idKey = ID_KEY[kind];
    let rows: Row[];
    try {
      rows = parseTable(ui.addText);
    } catch (e) {
      ui.addMsg = 'Could not read the CSV: ' + String(e);
      return;
    }
    if (!rows.length) {
      ui.addMsg = 'No rows found. The first line must be the header.';
      return;
    }
    if (!(idKey in rows[0])) {
      ui.addMsg = `The header needs a "${idKey}" column.`;
      return;
    }
    const good = rows.filter((r) => r[idKey]);
    const before = bank.warnings.length;
    const prev = store.state.custom[kind];
    store.state.custom[kind] = mergeRows(prev, good, idKey);
    rebuild();
    store.save();
    const newWarn = bank.warnings.length - before;
    ui.addMsg = `Imported ${good.length} row${good.length === 1 ? '' : 's'}.` + (rows.length - good.length ? ` ${rows.length - good.length} without an id were ignored.` : '') + (newWarn > 0 ? ` ${newWarn} could not be used, see the warning at the top.` : '');
    ui.addText = '';
  }

  /** ---- events ---- */
  function onClick(ev: Event): void {
    const el = ev.target as HTMLElement | null;
    if (!el) return;
    const S = store.state;
    const t = T();
    ui.note = '';

    const tab = el.closest<HTMLElement>('[data-tab]');
    if (tab) {
      ui.tab = tab.dataset.tab as Tab;
      ui.run = null;
      ui.back = null;
      ui.cf = '';
      render(true);
      return;
    }
    const chip = el.closest<HTMLElement>('[data-chip]');
    if (chip) {
      const raw = chip.dataset.chip as string;
      const at = raw.indexOf(':');
      const key = raw.slice(0, at);
      const v = raw.slice(at + 1);
      if (key === 'prac') ui.psub = v as Section;
      else if (key === 'rsub') ui.rsub = v as UI['rsub'];
      else if (key === 'rsec') ui.rsec = v as UI['rsec'];
      else if (key === 'base') ui.bsub = v as UI['bsub'];
      else if (key === 'add') ui.addKind = v as CustomKind;
      render();
      return;
    }
    const a = el.closest<HTMLElement>('[data-act]');
    if (!a) return;
    const d = a.dataset;
    const r = ui.run;
    switch (d.act) {
      case 'startplan':
        S.plan.start = t;
        store.save();
        break;
      case 'off':
        S.off[keyOf(t)] = !S.off[keyOf(t)];
        store.save();
        break;
      case 'run':
        start(d.kind as string, d.mode as string, d.sec);
        render(true);
        return;
      case 'practice-pattern': {
        const ids = bank.questionsByPattern.get(d.id as string) ?? [];
        if (ids.length) begin(newRun('free', 'quiz', shuffle(ids)));
        else ui.note = 'There are no practice questions for this pattern yet.';
        render(true);
        return;
      }
      case 'lesson':
        if (d.id) {
          if (ui.run && ui.run.kind !== 'view') ui.back = ui.run;
          ui.run = newRun('view', 'lesson', [d.id]);
          render(true);
          return;
        }
        break;
      case 'answer':
        if (r && r.mode === 'quiz' && r.sel === null) {
          const i = Number(d.i);
          const q = r.qs[r.i];
          r.sel = i;
          const ok = i === q.ans;
          record(S, q.id, ok, q.opts[i].text, r.flag, t);
          if (ok) r.score++;
          else r.missed.push(q.id);
          store.save();
        }
        break;
      case 'flag':
        if (r && r.mode === 'quiz') {
          r.flag = !r.flag;
          if (r.sel !== null) {
            setUnsure(S, r.qs[r.i].id, r.flag, t);
            store.save();
          }
        }
        break;
      case 'next':
        if (r) {
          advance(r);
          render(true);
          return;
        }
        break;
      case 'flip':
        if (r) r.flip = !r.flip;
        break;
      case 'got':
        if (r && r.mode === 'cards') {
          const id = r.ids[r.i];
          r.got.push(id);
          record(S, id, true, '', false, t);
          const sb = r.kind === 'learn' ? sibling(id) : null;
          if (sb && !S.items[sb]) record(S, sb, true, '', false, t);
          advance(r);
          render(true);
          return;
        }
        break;
      case 'again':
        if (r && r.mode === 'cards') {
          const id = r.ids[r.i];
          if (!r.again.includes(id)) {
            r.again.push(id);
            r.ids.push(id);
          }
          record(S, id, false, '', false, t);
          advance(r);
          render(true);
          return;
        }
        break;
      case 'understood':
      case 'later':
        if (r && r.mode === 'lesson') {
          const id = r.ids[r.i];
          if (d.act === 'understood') {
            if (!S.learned[id]) S.learned[id] = t;
            if (!r.learnedNow.includes(id)) r.learnedNow.push(id);
          }
          advance(r);
          render(true);
          return;
        }
        break;
      case 'check':
        if (r) checkQuiz(r);
        render(true);
        return;
      case 'retry':
        if (r) begin(newRun('retry', 'quiz', r.missed.slice()));
        render(true);
        return;
      case 'quit':
        leave();
        render(true);
        return;
      case 'nbtoggle':
        ui.nbOpen[d.id as string] = !ui.nbOpen[d.id as string];
        break;
      case 'nbfilter':
        ui.nbAll = d.v === 'all';
        break;
      case 'import':
        importCsv();
        break;
      case 'clearcustom':
        for (const k of KINDS) S.custom[k] = [];
        rebuild();
        store.save();
        ui.addMsg = 'Removed all added rows.';
        break;
      case 'lang':
        S.settings.lang = d.v as Lang;
        store.save();
        break;
      case 'backup':
        ui.bkText = JSON.stringify(S);
        S.backupAt = t;
        store.save();
        ui.addMsg = 'Backup made. Copy the text below and keep it somewhere safe.';
        break;
      case 'download': {
        const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `n3drill-backup-${keyOf(t)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        S.backupAt = t;
        store.save();
        break;
      }
      case 'restore':
        ui.cf = ui.bkText.trim() ? 'restore' : '';
        ui.addMsg = ui.bkText.trim() ? '' : 'Paste the backup text first.';
        break;
      case 'dorestore':
        try {
          const o = JSON.parse(ui.bkText);
          if (typeof o !== 'object' || o === null || !('items' in o)) throw new Error('not a backup');
          store.replace(normalize(o));
          rebuild();
          ui.addMsg = 'Restored.';
        } catch {
          ui.addMsg = 'That text is not a valid backup. Nothing was changed.';
        }
        ui.cf = '';
        break;
      case 'cf':
        ui.cf = d.v as string;
        break;
      case 'cfno':
        ui.cf = '';
        break;
      case 'dorestart':
        S.plan.start = t;
        store.save();
        ui.cf = '';
        ui.addMsg = 'The plan now starts today.';
        break;
      case 'doreset':
        store.replace(fresh());
        rebuild();
        ui.cf = '';
        ui.addMsg = 'Everything was erased.';
        break;
      default:
        return;
    }
    render();
  }

  function onInput(ev: Event): void {
    const el = ev.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    if (el.id === 'bq') {
      ui.bq = el.value;
      const list = view.querySelector('#blist');
      if (list) list.innerHTML = basicsList(ctx());
    } else if (el.id === 'addtext') ui.addText = el.value;
    else if (el.id === 'bktext') ui.bkText = el.value;
  }

  function onChange(ev: Event): void {
    const el = ev.target as HTMLInputElement | null;
    if (el?.id !== 'addfile' || !el.files?.[0]) return;
    const f = el.files[0];
    const rd = new FileReader();
    rd.onload = () => {
      ui.addText = String(rd.result ?? '').replace(/^﻿/, '');
      render();
    };
    rd.readAsText(f, 'utf-8');
  }

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  render();
  return {
    dispose: () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onChange);
    },
  };
}
