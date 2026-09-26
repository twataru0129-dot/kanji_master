# 漢字マスター

5歳の子どもから高校生まで使える漢字学習 Web アプリです。
「漢字図鑑 × 習熟度管理 × ゲーム・実績システム」を中心にしています。
HTML / CSS / JavaScript だけで動くので、ビルドもサーバーも不要です。GitHub Pages でそのまま公開できます。

## 公開方法（GitHub Pages）

1. リポジトリの **Settings → Pages** を開く
2. **Source** を「Deploy from a branch」、ブランチを公開したいもの（例: `main`）、フォルダを `/ (root)` にして保存
3. 数分後に `https://<ユーザー名>.github.io/kanji_master/` で開けます

iPhone / iPad は Safari の共有ボタン →「ホーム画面に追加」で、アプリのように使えます（オフラインでも動作）。

ローカルで試すとき: `python3 -m http.server 8000` を実行して `http://localhost:8000/` を開きます。

## ファイル構成

```
index.html              画面の骨組み・読み込むファイルの一覧
style.css               基本スタイル（色・ボタン・カードなど）
css/screens.css         各画面のスタイル・レスポンシブ
css/kids.css            キッズ表示用
css/effects.css         称号獲得などの演出
app.js                  起動処理
sw.js                   Service Worker（オフライン対応）
manifest.webmanifest    PWA 設定

js/version.js           ★バージョン番号と更新履歴（ここ1か所で管理）
js/utils.js             共通関数
js/storage.js           localStorage 保存・マイグレーション・バックアップ
js/kanji-db.js          学習レベル定義・漢字データ管理
js/profiles.js          プロフィール
js/proficiency.js       習熟度・苦手判定
js/history.js           学習履歴（過去30回）・累計成績
js/quiz.js              出題・答え合わせ（問題形式を追加できる設計）
js/achievements.js      称号・実績（119個、うち隠し15・将来用6）
js/medals.js            メダル
js/learning.js          回答・クイズ終了時の記録をまとめて行う
js/sound.js             効果音
js/romaji.js            ローマ字→ひらがな変換
js/ui.js                画面部品・モーダル・演出
js/kana-pad.js          ひらがな入力パネル
js/router.js            画面切り替え
js/screens/*.js         各画面

data/kanji-grade1〜6.js 小学1〜6年の漢字（1,026字）
data/sources.js         情報源・ライセンス表示
assets/icons/           アプリアイコン（kanji- で始まる名前）
tools/                  データ・アイコン生成スクリプト
```

## よくある変更

### バージョンを上げる
`js/version.js` の `APP_VERSION` を変更し、`CHANGELOG` の先頭に新しい版を追加します。
画面右上の表示・バージョン詳細・オフライン用キャッシュはすべて自動で更新されます。

### 保存形式を変える（既存データを壊さないために）
学習データは localStorage の `kanjiAppData` にまとめて保存されています。
形式を変えるときは `js/storage.js` の `CURRENT_DATA_VERSION` を上げ、`MIGRATIONS` に変換関数を追加してください。
新しい項目を足すだけなら、`js/profiles.js` の `defaultProfile()` / `defaultStats()` に追加すれば、既存プロフィールにも自動で補われます。

### 中学・高校の漢字を追加する
`data/kanji-junior1.js` などを作って `KanjiApp.KanjiDB.registerLevel('j1', [...])` を呼び、`index.html` と `sw.js` に追加します。
クイズ・図鑑・習熟度マップに自動で表示されます（レベルIDは `js/kanji-db.js` の `LEVELS` を参照）。
中学〜高校はアプリ独自の学習レベルなので、`officialGrade` は `null` にしてください。

### 問題形式を追加する（熟語・部首・送り仮名など）
`js/quiz.js` の `QUESTION_TYPES` に `build` と `check` を実装し `available: true` にします。

### 称号を追加する
`js/achievements.js` の `DEFS` の末尾に追加します。`id` は保存データに残るため、公開後は変更しないでください。

### アイコンを差し替える
正方形の画像を `assets/icons/kanji-icon-source.png` として置き、`python3 tools/make_icons.py` を実行すると全サイズが作り直されます（要 Pillow）。

### 漢字データを作り直す
`python3 tools/build_kanji_data.py`（熟語を選び直すときは `--vocab` に JMdict 由来の語彙 JSON を指定）。
部首名・例文・熟語の手動補正もこのスクリプト内にあります。

## データの出典

- 学年区分: 文部科学省「学年別漢字配当表」（平成29年告示・2020年度施行）
- 音訓・画数・部首: 文化庁「常用漢字表」（平成22年内閣告示）
- 熟語: JMdict © EDRDG（CC BY-SA 4.0）— `data/kanji-grade*.js` の `compounds` は同ライセンスで提供します
- 詳細はアプリの「このアプリについて」画面を参照してください
