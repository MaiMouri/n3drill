import type { Ctx } from '../ctx';
import { DAYS, GOAL, curDay, perDay, pendingLessons, pendingWordItems, phaseOf } from '../plan';
import { dueIds, streak, weakIds, yesterdayWrongIds } from '../srs';
import { keyOf } from '../store';
import { esc, runBtn, task, type Task } from './common';

function startPanel(c: Ctx): string {
  const b = c.bank;
  return (
    `<section class="panel"><p class="eyebrow">40日プラン</p><h2>Start your 40 days</h2>` +
    `<p class="lead">Every day the app shows a short list: grammar lessons to study, new words, items due for review, and a daily question target. The schedule is kept for you.</p>` +
    `<ul class="rules"><li><b>Days 1–30:</b> about ${perDay(b.patterns.length)} grammar patterns and ${perDay(b.wm.length)} words and ${perDay(b.wr.length)} kanji words a day, plus review.</li>` +
    `<li><b>Days 31–36:</b> drill your weak spots.</li><li><b>Days 37–40:</b> a 30-question mock test each day.</li></ul>` +
    `<p class="note">In the bank now: ${b.patterns.length} grammar patterns, ${b.questions.length} questions, ${b.wm.length} words, ${b.wr.length} kanji words. Add more in the Add/Save tab and the daily amounts grow with it.</p>` +
    `<div class="actions"><button class="primary" data-act="startplan">Start Day 1 today</button></div></section>`
  );
}

export function todayView(c: Ctx): string {
  const { S, bank, t } = c;
  const d = curDay(S, t);
  if (d === 0) return startPanel(c);

  const key = keyOf(t);
  const td = S.days[key] ?? { n: 0, c: 0 };
  const ph = phaseOf(d);
  const over = d > DAYS;
  const phName = over ? 'Plan complete' : ph === 'learn' ? 'Learn phase' : ph === 'weak' ? 'Weak-spot phase' : 'Mock-test phase';
  const tasks: Task[] = [];

  if (ph === 'learn' && !over) {
    const pl = pendingLessons(S, bank, t);
    tasks.push({
      title: '新しい文法 · Grammar lessons',
      done: pl.length === 0,
      sub: pl.length
        ? `${pl.length} waiting: ${pl.slice(0, 3).map((p) => p.pattern).join('  ')}${pl.length > 3 ? ' …' : ''}. After the lessons, a check quiz follows.`
        : 'All unlocked lessons studied.',
      btn: pl.length ? runBtn('Start lessons', 'lesson', 'lesson') : '',
    });
    const wi = pendingWordItems(S, bank, t);
    tasks.push({
      title: '新しい単語・漢字語 · Words',
      done: wi.length === 0,
      sub: wi.length ? `${wi.length} waiting. Missed days pile up here.` : 'All unlocked words studied.',
      btn: wi.length ? runBtn('Start flashcards', 'learn', 'cards') : '',
    });
  }
  if (ph === 'weak' && !over) {
    const wk = weakIds(S, bank).length;
    tasks.push({
      title: '苦手 · Weak-spot drill',
      done: wk === 0,
      sub: wk ? `${wk} items you missed or keep getting wrong.` : 'No weak items right now.',
      btn: wk ? runBtn('Start drill', 'weak', 'quiz') : '',
    });
  }
  if (ph === 'mock' || over) {
    const m = S.mocks.filter((x) => x.k === key);
    const last = S.mocks[S.mocks.length - 1];
    tasks.push({
      title: '模擬テスト · Mock test',
      done: m.length > 0,
      sub: `30 questions, 10 from each section.${last ? ` Last score: ${last.s} / ${last.n} (${Math.round((last.s / last.n) * 100)}%).` : ' Not taken yet.'}`,
      btn: runBtn('Start mock test', 'mock', 'quiz'),
    });
  }
  const yw = yesterdayWrongIds(S, bank, t).length;
  if (yw) {
    tasks.push({
      title: '昨日の間違い · Yesterday\'s mistakes',
      done: false,
      sub: `${yw} question${yw === 1 ? '' : 's'} you got wrong yesterday.`,
      btn: runBtn('Try them again', 'yesterday', 'quiz'),
    });
  }
  const dueN = dueIds(S, bank, t).length;
  tasks.push({
    title: '復習 · Review',
    done: dueN === 0,
    sub: dueN ? `${dueN} items are due for review.` : 'Nothing due.',
    btn: dueN ? runBtn('Start review', 'review', 'quiz') : '',
  });
  tasks.push({
    title: '今日の目標 · Daily target',
    done: td.n >= GOAL,
    sub: `${td.n} of ${GOAL} questions answered today.${td.n ? ` Accuracy ${Math.round((td.c / td.n) * 100)}%.` : ''}`,
    btn: runBtn('Practice 10 more', 'unlocked', 'quiz', 'secondary'),
  });
  const off = !!S.off[key];
  tasks.push({
    title: '読解・聴解 · Reading and listening',
    done: off,
    sub: 'Not covered by this app. 30 minutes of past papers, short readings or listening practice.',
    btn: `<button class="${off ? 'secondary' : 'primary'} sm" data-act="off">${off ? 'Undo' : 'Mark as done'}</button>`,
  });

  const allDone = tasks.every((x) => x.done);
  const st = streak(S, t);
  const nudge =
    Object.keys(S.items).length >= 20 && (!S.backupAt || t - S.backupAt >= 7)
      ? '<p class="note">You have not backed up your progress in a while. Open Add/Save to make a backup.</p>'
      : '';
  return (
    `<section class="panel"><p class="eyebrow">${phName.toUpperCase()} · ${keyOf(t)}</p>` +
    `<div class="big">Day ${Math.min(d, DAYS)}${over ? '+' : ''} <small>of ${DAYS}${st ? ` · ${st}-day streak` : ''}</small></div>` +
    `<div class="bar"><i style="width:${Math.min(100, (Math.min(d, DAYS) / DAYS) * 100)}%"></i></div>` +
    (allDone ? `<p class="verdict" style="margin:0;color:var(--good)">${esc("Today's plan is complete.")}</p>` : '') +
    `<ul class="tasks">${tasks.map(task).join('')}</ul>${nudge}</section>`
  );
}
