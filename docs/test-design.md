# VBA Trainer テスト設計

## 目的
- 学習導線、補完、採点結果の可視化、復習カードの追加が既存の演習体験を壊していないことを確認するんな。
- 問題データと UI ロジックを分けて検証し、どこが壊れたか追いやすくするんな。

## レベル分割
- 単体テスト
  - `lesson` バリデーション
  - 補完候補生成
  - 復習対象抽出と並び順
- コンポーネントテスト
  - 導入パネルの初期表示、開閉、問題切り替え
  - ヒント、模範解答、採点結果表示
  - 復習カードの表示、解答表示、問題復帰
- 回帰テスト
  - 既存 engine テスト
  - 模範解答一括検証

## 主なテストケース
- `tests/problem-validation.test.ts`
  - `lesson` 欠落の拒否
  - `focusItems` 構造不正の拒否
  - 全問題の validation 通過
- `tests/autocomplete.test.ts`
  - Excel 基本キーワード候補
  - 問題固有関数候補
  - Access ドメイン関数候補
  - `CurrentDb.` と `rs.` のメンバー候補
  - スニペット数の固定化
- `tests/review.test.ts`
  - 未挑戦問題の除外
  - `error` と `incorrect` の優先順
  - 正答率の低い問題の優先順
  - エンジン切り替え時の対象絞り込み
- `tests/app.ui.test.tsx`
  - 導入パネルの初期表示
  - `書いてみる` による導入パネル非表示
  - 問題切り替え時の導入パネル再表示
  - ヒントと模範解答の個別表示
  - 採点後の自動スクロール、フォーカス移動、`aria-live`
  - 実行エラー時の診断表示
  - 復習カードの解答表示と問題復帰

## 回帰確認手順
```bash
npm test
npm run check-problems
npm run build
```

## モック方針
- UI テストでは `ExecutionWorkerClient`、`listProgressRecords`、`saveAttempt` をモックするんな。
- CodeMirror は入力イベント検証だけに絞るため、`textarea` に置き換えるんな。
- `scrollIntoView` と `requestAnimationFrame` は jsdom 上でスパイ化して検証するんな。
