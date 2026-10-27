export type Row = Record<string, string>;

/** Parses CSV or TSV text. Handles quotes, escaped quotes, CRLF and a BOM. */
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] ?? '';
  const delim = first.includes('\t') && !first.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** First line is the header. Returns one object per data row, values trimmed. */
export function parseTable(text: string): Row[] {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Row = {};
    head.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
}
