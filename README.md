# VBAtraining

ローカルで動く VBA 学習アプリなんな。Excel と Access の小問を切り替えながら、コード記述、実行、採点、進捗記録までをブラウザ内で回せるんな。

## できること

- Excel 問題と Access 問題を切り替えて学習する
- 問題文、ヒント、模範解答を見ながら回答する
- VBA 風のコードを実行して採点する
- Debug.Print、戻り値、セル更新、テーブル更新、クエリ結果で判定する
- IndexedDB に挑戦回数、正答数、連続正解数、平均解答時間を保存する

## 収録問題

- Excel: 3問
- Access: 4問

問題データは次に置いてあるんな。

- `src/data/excel-problems.json`
- `src/data/access-problems.json`

## 技術構成

- React 19
- Vite
- TypeScript
- CodeMirror
- sql.js
- Vitest

採点ロジックの中心は `src/core/engine.ts` なんな。進捗保存は `src/core/storage.ts` で扱っているんな。

## セットアップ

```bash
npm install
```

`postinstall` で `sql.js` の wasm 配置をしているんな。

## 開発

```bash
npm run dev
```

通常は `http://localhost:5173` で確認できるんな。

## ビルド

```bash
npm run build
```

## テスト

```bash
npm run test
```

問題データと模範解答の整合性を確認するには次を使うんな。

```bash
npm run check-problems
```

## ディレクトリ

```text
src/
  core/       実行エンジン、モデル、進捗保存
  data/       Excel / Access の問題セット
  worker/     実行ワーカー
tests/        テスト
scripts/      補助スクリプト
```
