# UIBridge

視覚的にUIパーツを調整し、AIコーディング支援ツールに渡せる形で出力するブラウザツール。仕様は [uibridge-spec.md](uibridge-spec.md)。

## 実行

ビルド不要。ローカルでは任意の静的サーバから `index.html` を開く（ES modules を使うため `file://` では動きません）。

```bash
python -m http.server 8000
```

または VS Code の Live Server 拡張など。

## デプロイ（GitHub Pages）

Settings → Pages で `main` ブランチのルートを公開。`.nojekyll` を置いてあるので `assets/` 配下がそのまま配信される。

## 実装状況

- [x] Step 1: リポジトリ骨組み
- [x] Step 2: データモデル + プレビューレンダラ
- [x] Step 3: 8種のビルトインプリセット + プリセット切替
- [ ] Step 4: コントロールパネル
- [ ] Step 5-10: localStorage/ユーザープリセット/出力/PNG/スマホ最適化
