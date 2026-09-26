/*
 * 情報源・ライセンス表示
 * 外部データを追加したら、ここに追記すると「情報源」画面に表示されます。
 * used: true = 現在のデータで実際に使用 / false = 将来の利用を想定（対応できる構造のみ）
 */
KanjiApp.SOURCES = [
  {
    name: '文部科学省「小学校学習指導要領（平成29年告示）」別表 学年別漢字配当表',
    usage: '小学1〜6年の学年区分（1,026字）。2020年度施行の配当に準拠。',
    license: '公的資料',
    url: 'https://www.mext.go.jp/a_menu/shotou/new-cs/1385768.htm',
    used: true,
  },
  {
    name: '文化庁「常用漢字表」（平成22年内閣告示第2号）',
    usage: '音読み・訓読み・画数・部首の元データ。（ ）付きの読みは「特別な読み」として表示。',
    license: '公的資料（npm パッケージ joyo-kanji-counts〔MIT License〕経由で取得）',
    url: 'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/',
    used: true,
  },
  {
    name: 'JMdict（Electronic Dictionary Research and Development Group）',
    usage: '熟語とその読み。常用語から学年に合うものを自動選定し、一部を手作業で補正。',
    license: 'CC BY-SA 4.0 © EDRDG。熟語データ（data/kanji-grade*.js の compounds）は同ライセンスで提供します。',
    url: 'https://www.edrdg.org/edrdg/licence.html',
    used: true,
  },
  {
    name: 'KANJIDIC2（EDRDG）',
    usage: '将来、意味・難易度などの追加データに利用できる構造にしています（現在は未使用）。',
    license: 'CC BY-SA 4.0 © EDRDG',
    url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    used: false,
  },
  {
    name: 'KanjiVG（Ulrich Apel）',
    usage: '将来の書き順アニメーションで利用予定（現在は未使用）。',
    license: 'CC BY-SA 3.0',
    url: 'https://kanjivg.tagaini.net/',
    used: false,
  },
];

KanjiApp.SOURCE_NOTES = [
  '中学1年〜高校3年のレベル分けは、このアプリ独自の学習レベルです（公式の学年配当ではありません）。',
  '部首は、学習用漢字辞典で一般的な分類を参考にしています。辞書によって異なる場合があります。',
  '小学1年の例文はこのアプリで作成したものです。',
];
