# 漢字マスター

5歳の子どもから高校生まで使える漢字学習 Web アプリです（常用漢字2,136字に対応）。
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
css/print.css           プリントの A4 レイアウトと印刷用 CSS（@media print）
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
js/quiz.js              出題・答え合わせ（一文字・文の中・生活漢字。問題形式を追加できる設計）
js/reading-data.js      文の中の読み・生活漢字のデータ管理（問題タイプ・場面カテゴリー）
js/achievements.js      称号・実績（152個、うち隠し16・将来用6）
js/medals.js            メダル
js/learning.js          回答・クイズ終了時の記録をまとめて行う
js/print.js             プリントメーカーの問題づくり（対象漢字の選択・問題・答え）
js/sound.js             効果音
js/romaji.js            ローマ字→ひらがな変換
js/ui.js                画面部品・モーダル・演出
js/kana-pad.js          ひらがな入力パネル
js/level-picker.js      ホームからの学習レベル切り替え（LEVELS から自動生成）
js/router.js            画面切り替え
js/screens/*.js         各画面

data/kanji-grade1〜6.js 小学1〜6年の漢字（1,026字）
data/kanji-junior1〜3.js 中学1〜3年の漢字（1,110字・370字ずつ。アプリ独自の目安）
data/sentences.js       文の中の読み（148問。漢字部分だけを答える answerMode: whole / segments）
data/life-kanji.js      生活漢字（10場面・154語）
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

### 中学校の漢字（v1.5.0〜）
常用漢字のうち小学校で習わない1,110字を、中1〜中3に370字ずつ分けています（公式の学年配当ではなく、アプリ独自の目安）。
使用頻度（重み0.55）・JLPT レベル（0.25）・画数（0.10）・2010年追加字（0.10）から難しさを計算し、やさしい順に並べています。
作り直すときは `python3 tools/build_junior_data.py --kanji-data kanji.json --vocab 語彙.json`
（`kanji.json` は [kanji-data](https://github.com/davidluzgouveia/kanji-data)〔MIT〕）。小学校のデータは変わりません。
部首は常用漢字表（旧字体による分類）を元に、新字体と合わないものをスクリプト内で補正しています。
さんずい・にんべんのように位置で名前が変わる部首は、1字ずつ確認していないため「みず・さんずい」のように両方の名前を表示します。

### 高校の漢字を追加する
`data/kanji-high1.js` などを作って `KanjiApp.KanjiDB.registerLevel('h1', [...])` を呼び、`index.html` と `sw.js` に追加します。
ホームの学習レベル切り替え（`js/level-picker.js`）も `LEVELS` から自動で作られるので、データを登録すれば「高校」の欄に並びます。

### 学習レベルの切り替え（v1.6.0〜）
ホームのプロフィールカードで、名前をタップするとプロフィール切り替え、「📘 小学1年 ▼」をタップすると学習レベルの切り替えです。
どちらもプロフィールの `level`（設定画面の「いまの学習レベル」と同じ値）を更新するだけで、別の設定は保存しません。
クイズ・図鑑・習熟度マップに自動で表示されます（レベルIDは `js/kanji-db.js` の `LEVELS` を参照）。
中学〜高校はアプリ独自の学習レベルなので、`officialGrade` は `null` にしてください。

### 文の中の読み・生活漢字の問題を追加する
文の中の読みは「漢字で書かれている部分の読みだけ」を答えます（v1.3.0〜）。
- 熟語・熟字訓・漢字1字 → `answerMode: 'whole', reading: 'うちゅう'`（語全体で1つの解答欄）
- 送り仮名つき → `answerMode: 'segments', segments: [{ text: '急', reading: 'いそ' }, { text: 'いで' }]`
- 解答欄が複数 → `segments: [{ text: '受', reading: 'う' }, { text: 'け' }, { text: '取', reading: 'と' }, { text: 'る' }]`

segments の text をつなげると target と一致する必要があります（読み込み時にブラウザのコンソールへ警告が出ます）。

`data/sentences.js` / `data/life-kanji.js` の末尾に1行追加するだけです（形式は各ファイル冒頭のコメント参照）。
`id` は学習記録のキーなので、一度公開したら変更しないでください。
生活漢字の場面（カテゴリー）は `registerLifeCategories` に追加できます。
追加した場面は、生活漢字の「場面をえらぼう」画面に自動で表示されます（`kidsLabel` でキッズ表示用の名前も指定できます）。
場面は URL `#/quiz-words?type=life&scene=school` で指定でき、`scene=school,work` のようにカンマ区切りで複数指定にも拡張できる設計です。`meaning`（意味問題用）、`image` / `display`（看板風の表示用）も持たせられます。

### 問題形式を追加する（熟語・部首・送り仮名など）
`js/quiz.js` の `QUESTION_TYPES` に `build` と `check` を実装し `available: true` にします。

### プリントの形式を追加する
`js/print.js` の `FORMATS` に `build(entry)` を持つ形式を追加し、`js/screens/print.js` に表示（問題・答え）を追加します。
答えが1つに決まらない問題は `build` で `null` を返してください（その漢字は自動で除かれます）。
プリントを作っても学習記録は変わりません（PrintEngine は読み取りのみ）。

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
- 熟語: JMdict © EDRDG（CC BY-SA 4.0）— `data/kanji-grade*.js`・`data/kanji-junior*.js` の `compounds` は同ライセンスで提供します
- 中学1〜3年の分け方に使った使用頻度・JLPT レベル: [kanji-data](https://github.com/davidluzgouveia/kanji-data)（MIT License）
- 詳細はアプリの「このアプリについて」画面を参照してください
