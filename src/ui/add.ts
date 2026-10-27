import type { Ctx } from '../ctx';
import { ID_KEY } from '../bank';
import { KINDS } from '../store';
import type { CustomKind } from '../types';
import { chips, esc } from './common';

const HELP: Record<CustomKind, { label: string; cols: string }> = {
  questions: { label: '問題 Questions', cols: 'question_id,category,subcategory,difficulty,ref_id,instruction,stem,choice_a,choice_b,choice_c,choice_d,answer,explain_a..d,summary,explain_a_en..d_en,summary_en,shuffle' },
  order: { label: '文の組み立て Order', cols: 'question_id,pattern_id,prefix,c1,c2,c3,c4,star,suffix,translation_en' },
  patterns: { label: '文法 Patterns', cols: 'pattern_id,group_id,pattern,answer,connection,meaning_ja,meaning_en,nuance_ja,nuance_en,mistake_ja,mistake_en,ex1,ex1_en,ex2,ex2_en,ex3,ex3_en' },
  groups: { label: 'グループ Groups', cols: 'group_id,ja,en (see grammar_groups.csv)' },
  words: { label: '単語 Words', cols: 'word_id,word,reading,meaning,pos,quiz,example,example_tr' },
};

export function addView(c: Ctx): string {
  const { S, ui } = c;
  const k = ui.addKind;
  const counts = KINDS.map((x) => S.custom[x].length ? `${HELP[x].label}: ${S.custom[x].length}` : '').filter(Boolean).join(' · ');
  const cf = ui.cf;
  const confirm = (text: string, act: string): string =>
    `<div class="confirm"><p>${esc(text)}</p><div class="actions"><button class="danger" data-act="${act}">はい · Yes</button><button class="secondary sm" data-act="cfno">キャンセル · Cancel</button></div></div>`;
  return (
    (c.storeOk ? '' : '<div class="warn">Progress cannot be saved in this browser (private mode or blocked storage). Use the backup below before you close the page.</div>') +
    (ui.addMsg ? `<div class="msg">${esc(ui.addMsg)}</div>` : '') +
    `<section class="panel"><p class="eyebrow">CSV</p><h2>問題を追加 Add content</h2>` +
    `<p class="lead">Paste CSV text or choose a file. Rows with an id that already exists replace the built-in row; new ids are added.</p>` +
    chips(KINDS.map((x) => [x, HELP[x].label] as [string, string]), k, 'add') +
    `<p class="note">Columns: ${esc(HELP[k].cols)}. The id column is <b>${ID_KEY[k]}</b>.</p>` +
    `<textarea id="addtext" class="field" placeholder="Paste CSV with a header row" aria-label="CSV text">${esc(ui.addText)}</textarea>` +
    `<div class="actions"><input id="addfile" type="file" accept=".csv,.tsv,.txt,text/csv" class="field"><button class="primary" data-act="import">取り込む · Import</button></div>` +
    (counts ? `<p class="note">Added so far: ${esc(counts)}</p><div class="actions"><button class="ghost" data-act="clearcustom">追加分をすべて削除 · Remove all added rows</button></div>` : '') +
    `</section>` +
    `<section class="panel"><p class="eyebrow">LANGUAGE</p><h2>説明の言語 Explanations</h2><div class="radio">` +
    (['ja', 'en', 'both'] as const)
      .map((l) => `<button class="chip" data-act="lang" data-v="${l}" aria-pressed="${S.settings.lang === l}">${l === 'ja' ? '日本語' : l === 'en' ? 'English' : '両方 Both'}</button>`)
      .join('') +
    `</div></section>` +
    `<section class="panel"><p class="eyebrow">BACKUP</p><h2>保存と復元 Backup and restore</h2>` +
    `<p class="lead">Progress lives in this browser only. Copy the text below somewhere safe now and then, and paste it back to restore on another device.</p>` +
    `<div class="actions"><button class="primary" data-act="backup">バックアップを作る · Make backup</button>${c.canDownload ? '<button class="secondary" data-act="download">ファイルで保存 · Download</button>' : ''}</div>` +
    `<textarea id="bktext" class="field" placeholder="Backup text appears here. Paste a backup here to restore." aria-label="Backup text">${esc(ui.bkText)}</textarea>` +
    `<div class="actions"><button class="secondary" data-act="restore">復元する · Restore</button></div>` +
    (cf === 'restore' ? confirm('Replace all progress on this device with the pasted backup?', 'dorestore') : '') +
    `</section>` +
    `<section class="panel"><p class="eyebrow">RESET</p><h2>やり直し Reset</h2>` +
    `<div class="actions"><button class="secondary" data-act="cf" data-v="restart">40日プランを最初から · Restart plan</button><button class="secondary" data-act="cf" data-v="reset">すべて消す · Erase everything</button></div>` +
    (cf === 'restart' ? confirm('Restart the plan from Day 1 today? Your answers and accuracy stay.', 'dorestart') : '') +
    (cf === 'reset' ? confirm('Erase all progress and added rows on this device? This cannot be undone.', 'doreset') : '') +
    `</section>`
  );
}
