# N3ドリル

JLPT N3 の40日プラン学習アプリ / A 40-day JLPT N3 study app. 文法を学ぶ → 問題を解く → 間違いを記録 → 後で復習。
Vite + TypeScript, no UI framework. Progress is saved in the browser (localStorage).

## Run
```
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # output in dist/
```

## Publish (GitHub Pages)
Repo Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml`.
The site is served from a new address, so progress from another address does not carry over: use Add/Save → backup first.

## Content (CSV)
All content is in `public/data/` (UTF-8). Edit the files and reload, or paste rows in the app's Add/Save tab
(rows with an existing id replace the built-in row, new ids are added; stored in the browser only).

| file | id column | notes |
|---|---|---|
| grammar_groups.csv | group_id | the 8 groups, in study order |
| grammar_patterns.csv | pattern_id | lesson text: connection, meaning, nuance, mistake, 3 examples (ja/en) |
| questions.csv | question_id | 4 choices, answer ア–エ (or A–D / 1–4), per-choice explanations ja/en, `ref_id` = pattern_id |
| grammar_order.csv | question_id | 文の組み立て: `c1..c4` in correct order, `star` = which chunk sits in ★ |
| words.csv | word_id | `quiz` = meaning / reading / both |

Reading and listening questions are not supported yet; the daily plan has a checkbox for studying them outside the app.

## How the plan works
Days 1–30 unlock grammar lessons, words and kanji words in equal daily amounts; days 31–36 drill weak spots; days 37–40 are mock tests.
Review uses boxes with 0/1/3/6/12-day gaps: a wrong answer is due again today, a right answer moves up. "迷った" keeps an item from moving up.
