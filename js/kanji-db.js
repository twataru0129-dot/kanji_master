/*
 * 漢字データベース
 * ------------------------------------------------------------
 * 学習レベル（カテゴリー）の定義と、data/*.js から登録される漢字データの管理。
 *
 * ・小学1〜6年: 文部科学省「学年別漢字配当表」（公式の学年配当）
 * ・中学1年〜高校3年: このアプリ独自の学習レベル（公式の学年配当ではありません）
 * ・難読漢字: このアプリ独自のカテゴリー
 *
 * 漢字 1 文字のデータ形式（data/kanji-grade1.js などを参照）:
 * {
 *   kanji: '学',
 *   officialGrade: 1,        // 公式の学年配当（小1〜小6）。無い場合は null
 *   appLevel: '小1',         // このアプリでの学習レベル
 *   onyomi: ['ガク'],        // 音読み（カタカナ）
 *   kunyomi: ['まな-ぶ'],    // 訓読み（ひらがな。「-」の後ろは送り仮名）
 *   specialReadings: [],     // 常用漢字表で（ ）付きの、使い方が限られる読み
 *   meanings: [],
 *   radical: '子', radicalName: 'こ',
 *   strokes: 8,
 *   compounds: [{ word: '学校', reading: 'がっこう' }],
 *   okurigana: ['学ぶ'],
 *   exampleSentences: ['学校へいく。'],
 *   difficulty: 1,
 *   source: 'MEXT',
 *   // 将来用: strokeOrder（KanjiVG の SVG パスなど）
 * }
 *
 * 新しいレベル（中学など）を追加するときは:
 *   1. data/kanji-junior1.js などを作り KanjiApp.KanjiDB.registerLevel('j1', [...]) を呼ぶ
 *   2. index.html に <script> を追加する
 * これだけでクイズ・図鑑・習熟度マップに自動的に表示されます。
 */
(function (KA) {
  'use strict';

  /** 学習レベル（カテゴリー）の一覧。順番が画面の表示順になります。 */
  const LEVELS = [
    { id: 'e1', label: '小学1年', short: '小1', group: 'elementary', official: true, grade: 1, color: '#ff8a80' },
    { id: 'e2', label: '小学2年', short: '小2', group: 'elementary', official: true, grade: 2, color: '#ffb74d' },
    { id: 'e3', label: '小学3年', short: '小3', group: 'elementary', official: true, grade: 3, color: '#ffd54f' },
    { id: 'e4', label: '小学4年', short: '小4', group: 'elementary', official: true, grade: 4, color: '#81c784' },
    { id: 'e5', label: '小学5年', short: '小5', group: 'elementary', official: true, grade: 5, color: '#4fc3f7' },
    { id: 'e6', label: '小学6年', short: '小6', group: 'elementary', official: true, grade: 6, color: '#9575cd' },
    { id: 'j1', label: '中学1年', short: '中1', group: 'junior', official: false, color: '#5c6bc0' },
    { id: 'j2', label: '中学2年', short: '中2', group: 'junior', official: false, color: '#3f51b5' },
    { id: 'j3', label: '中学3年', short: '中3', group: 'junior', official: false, color: '#303f9f' },
    { id: 'h1', label: '高校1年', short: '高1', group: 'high', official: false, color: '#00897b' },
    { id: 'h2', label: '高校2年', short: '高2', group: 'high', official: false, color: '#00796b' },
    { id: 'h3', label: '高校3年', short: '高3', group: 'high', official: false, color: '#00695c' },
    { id: 'rare', label: '難読漢字・珍しい漢字', short: '難読', group: 'rare', official: false, color: '#6d4c41' },
  ];

  const GROUP_LABELS = {
    elementary: '小学校（文部科学省 学年別漢字配当表）',
    junior: '中学校（アプリ独自の学習レベル）',
    high: '高校（アプリ独自の学習レベル）',
    rare: 'チャレンジ',
  };

  const byLevel = {}; // levelId -> [entry]
  const extraReadings = {}; // kanji -> [{ reading, type, word }]（一文字の読みだけで正解にする追加の読み）
  const byKanji = {}; // kanji -> entry

  function toArray(v) {
    if (Array.isArray(v)) return v;
    if (v == null || v === '') return [];
    return [v];
  }

  /** データの欠けや表記ゆれを吸収して、必ず同じ形にそろえる */
  function normalizeEntry(raw, levelId) {
    const level = LEVELS.find((l) => l.id === levelId);
    const compounds = toArray(raw.compounds)
      .map((c) => {
        if (typeof c === 'string') {
          const [word, reading] = c.split('|');
          return { word, reading: reading || '' };
        }
        return c && c.word ? { word: c.word, reading: c.reading || '' } : null;
      })
      .filter(Boolean);
    return {
      kanji: raw.kanji,
      officialGrade: raw.officialGrade == null ? null : raw.officialGrade,
      appLevel: raw.appLevel || (level ? level.short : ''),
      levelId,
      onyomi: toArray(raw.onyomi),
      kunyomi: toArray(raw.kunyomi),
      specialReadings: toArray(raw.specialReadings),
      meanings: toArray(raw.meanings),
      radical: raw.radical || '',
      radicalName: raw.radicalName || '',
      strokes: raw.strokes || null,
      compounds,
      okurigana: toArray(raw.okurigana),
      exampleSentences: toArray(raw.exampleSentences),
      difficulty: raw.difficulty || 1,
      source: raw.source || '',
      strokeOrder: raw.strokeOrder || null,
    };
  }

  const KanjiDB = {
    LEVELS,
    GROUP_LABELS,

    /**
     * 一文字の読み問題だけで追加で正解にする読み（data/kanji-extra-readings.js から呼ばれる）
     *   { kanji: '暮', reading: 'くれ', word: '暮れ', type: 'kun' }
     * 漢字データの音訓・送り仮名の表示は変えず、acceptedReadings（一文字の読みの判定）にだけ加える。
     * 文の中の読み・生活漢字・サクラモードは、それぞれの問題に登録された読みで判定するので影響しない。
     */
    registerExtraReadings(list) {
      (list || []).forEach((x) => {
        if (!x || !x.kanji || !/^[ぁ-ゖー]+$/.test(x.reading || '')) {
          console.warn('[KanjiDB] 追加の読みの形式が正しくありません:', x);
          return;
        }
        if (!extraReadings[x.kanji]) extraReadings[x.kanji] = [];
        if (!extraReadings[x.kanji].some((r) => r.reading === x.reading)) {
          extraReadings[x.kanji].push({ reading: x.reading, type: x.type === 'on' ? 'on' : 'kun', word: x.word || '' });
        }
      });
    },

    /** 一文字の読み問題で追加で正解にする読み（無ければ空の配列） */
    extraReadings(kanji) {
      return (extraReadings[kanji] || []).slice();
    },

    /** data/*.js から呼ばれる */
    registerLevel(levelId, entries) {
      if (!LEVELS.some((l) => l.id === levelId)) {
        console.warn('[KanjiDB] unknown level:', levelId);
        return;
      }
      const list = [];
      (entries || []).forEach((raw) => {
        if (!raw || !raw.kanji) return;
        if (byKanji[raw.kanji]) {
          console.warn('[KanjiDB] duplicate kanji:', raw.kanji);
          return;
        }
        const entry = normalizeEntry(raw, levelId);
        byKanji[entry.kanji] = entry;
        list.push(entry);
      });
      byLevel[levelId] = (byLevel[levelId] || []).concat(list);
    },

    getLevel(levelId) {
      return LEVELS.find((l) => l.id === levelId) || null;
    },

    /** データが登録済み（遊べる）かどうか */
    isAvailable(levelId) {
      return (byLevel[levelId] || []).length > 0;
    },

    availableLevels() {
      return LEVELS.filter((l) => KanjiDB.isAvailable(l.id));
    },

    getKanjiList(levelId) {
      return byLevel[levelId] || [];
    },

    getAllKanji() {
      return LEVELS.reduce((all, l) => all.concat(byLevel[l.id] || []), []);
    },

    get(kanji) {
      return byKanji[kanji] || null;
    },

    count(levelId) {
      return levelId ? (byLevel[levelId] || []).length : Object.keys(byKanji).length;
    },

    levelLabel(levelId) {
      const l = KanjiDB.getLevel(levelId);
      return l ? l.label : levelId || '';
    },

    /* ---------------- 読み ---------------- */

    /** 訓読み表記「まな-ぶ」→ 表示用「まな(ぶ)」 */
    formatKun(reading) {
      const [stem, tail] = String(reading).split('-');
      return tail ? `${stem}(${tail})` : stem;
    },

    /** 訓読み表記「まな-ぶ」→ 読み全体「まなぶ」 */
    kunFull(reading) {
      return String(reading).replace('-', '');
    },

    /**
     * 正解として受け付ける読みの一覧
     * [{ reading: 'まなぶ', type: 'kun' }, { reading: 'がく', type: 'on' }, ...]
     */
    acceptedReadings(entry) {
      const U = KA.Utils;
      const out = [];
      const add = (reading, type, display, word) => {
        if (!reading) return;
        if (out.some((r) => r.reading === reading)) return;
        const item = { reading, type, display: display || reading };
        if (word) item.word = word; // 追加の読み: どの言葉の読みか（例: 暮れ）
        out.push(item);
      };
      entry.onyomi.forEach((r) => add(U.kataToHira(r), 'on', r));
      entry.kunyomi.forEach((r) => {
        add(KanjiDB.kunFull(r), 'kun', KanjiDB.formatKun(r));
        // 送り仮名を除いた部分（例: まな）も正解にする
        if (r.includes('-')) add(r.split('-')[0], 'kun', KanjiDB.formatKun(r));
      });
      entry.specialReadings.forEach((r) => {
        const isOn = /^[ァ-ヶー]+$/.test(r);
        add(isOn ? U.kataToHira(r) : KanjiDB.kunFull(r), isOn ? 'on' : 'kun', r);
      });
      // 明示的に登録した追加の読み（例: 暮 → くれ〔暮れ〕）。前方一致や活用形の自動生成はしない
      KanjiDB.extraReadings(entry.kanji).forEach((x) => add(x.reading, x.type, x.word ? `${x.word}（${x.reading}）` : x.reading, x.word));
      return out;
    },

    /** 4択などで「正解の選択肢」として見せる代表的な読み */
    primaryReadings(entry) {
      const U = KA.Utils;
      const list = [];
      entry.kunyomi.forEach((r) => list.push({ reading: KanjiDB.kunFull(r), type: 'kun' }));
      entry.onyomi.forEach((r) => list.push({ reading: U.kataToHira(r), type: 'on' }));
      return list;
    },
  };

  KA.KanjiDB = KanjiDB;
})(window.KanjiApp);
