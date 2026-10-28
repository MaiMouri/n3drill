import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boot } from '../src/app';
import { buildBank, ID_KEY, type RawData } from '../src/bank';
import { parseCSV, parseTable } from '../src/csv';
import { unlockCount } from '../src/plan';
import { record, setUnsure, yesterdayWrongIds, dueIds } from '../src/srs';
import { KINDS, fresh } from '../src/store';

const FILES: Record<string, string> = {
  groups: 'grammar_groups', patterns: 'grammar_patterns', questions: 'questions', order: 'grammar_order', words: 'words',
};
const read = (name: string): string => readFileSync(`public/data/${name}.csv`, 'utf-8');
function raw(): RawData {
  const r = {} as RawData;
  for (const k of KINDS) r[k] = parseTable(read(FILES[k]));
  return r;
}

describe('csv', () => {
  it('handles quotes, commas, newlines and BOM', () => {
    expect(parseCSV('﻿a,b\n"x, y","he said ""hi"""\r\n1,2')).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['1', '2']]);
  });
  it('reads tab separated text', () => {
    expect(parseTable('id\tname\nQ1\tfoo')).toEqual([{ id: 'Q1', name: 'foo' }]);
  });
});

describe('bank', () => {
  const bank = buildBank(raw());
  it('loads the shipped CSVs without warnings', () => {
    expect(bank.warnings).toEqual([]);
    expect(bank.groups.length).toBe(8);
    expect(bank.patterns.length).toBe(57);
    expect(bank.words.length).toBe(288);
    expect(bank.questions.length).toBeGreaterThanOrEqual(72);
  });
  it('has an id column for every file', () => {
    for (const k of KINDS) expect(Object.keys(raw()[k][0])).toContain(ID_KEY[k]);
  });
});

describe('srs', () => {
  const bank = buildBank(raw());
  it('wrong answers are due today and show up as yesterday’s mistakes the next day', () => {
    const S = fresh();
    record(S, 'Q0001', false, 'x', false, 100);
    expect(dueIds(S, bank, 100)).toContain('Q0001');
    expect(yesterdayWrongIds(S, bank, 101)).toContain('Q0001');
    expect(yesterdayWrongIds(S, bank, 100)).not.toContain('Q0001');
  });
  it('right but unsure keeps the box and returns tomorrow', () => {
    const S = fresh();
    record(S, 'Q0001', true, '', true, 100);
    expect(S.items['Q0001'].box).toBe(0);
    expect(S.items['Q0001'].due).toBe(101);
    record(S, 'Q0001', true, '', false, 101);
    expect(S.items['Q0001'].box).toBe(1);
    setUnsure(S, 'Q0001', true, 101);
    expect(S.items['Q0001'].unsure).toBe(true);
  });
});

describe('plan', () => {
  it('unlocks everything by day 30', () => {
    expect(unlockCount(57, 1)).toBe(2);
    expect(unlockCount(57, 30)).toBe(57);
    expect(unlockCount(57, 0)).toBe(0);
  });
});

describe('app', () => {
  it('runs a lesson and a quiz end to end', async () => {
    window.scrollTo = () => {};
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.getElementById('app') as HTMLElement;
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) } as unknown as Storage;
    const files = new Map(Object.values(FILES).map((f) => [`data/${f}.csv`, read(f)]));
    await boot(root, { storage, fetchText: async (u) => files.get(u) as string, now: () => Date.UTC(2026, 0, 10, 12), offsetMin: 0 });
    const click = (sel: string): void => (document.querySelector(sel) as HTMLElement).click();
    expect(document.body.textContent).toContain('Start your 40 days');
    click('[data-act="startplan"]');
    expect(document.body.textContent).toContain('Day 1');
    click('[data-act="run"][data-kind="lesson"]');
    expect(document.querySelector('.lesson')).not.toBeNull();
    click('[data-act="understood"]');
    click('[data-act="understood"]');
    expect(document.body.textContent).toContain('lessons studied');
    click('[data-act="check"]');
    // answer the first question wrongly or rightly, then continue to the end
    for (let g = 0; g < 30 && document.querySelector('[data-act="answer"]'); g++) {
      click('[data-act="answer"]');
      click('[data-act="next"]');
    }
    expect(document.querySelector('.score')).not.toBeNull();
    click('[data-act="quit"]');
    click('[data-tab="rev"]');
    expect(document.body.textContent).toContain('REVIEW');
    click('[data-tab="stat"]');
    expect(document.body.textContent).toContain('正答率');
    click('[data-tab="base"]');
    expect(document.querySelectorAll('.gref details').length).toBe(57);
    click('[data-tab="add"]');
    expect(document.body.textContent).toContain('Backup');
    expect(JSON.parse(store['n3drill-v3']).plan.start).not.toBeNull();
  });
});

import { plain, rich } from '../src/ui/common';
describe('notation', () => {
  it('turns 漢字[かな] into ruby and \\n into a line break', () => {
    expect(rich('経験[けいけん]を積む\\n次の行')).toBe('<ruby>経験<rt>けいけん</rt></ruby>を積む<br>次の行');
    expect(rich('a\nb')).toBe('a<br>b');
    expect(rich('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(plain('経験[けいけん]\\nです')).toBe('経験 です');
  });
});
