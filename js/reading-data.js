/*
 * 読み問題データ（文の中の読み・生活漢字）の管理
 * ------------------------------------------------------------
 * 問題ロジック（js/quiz.js）とデータ（data/sentences.js, data/life-kanji.js）を分けるための登録窓口です。
 *
 * ■ 問題タイプ（problemType）
 *   single   … 一文字の読み（従来の読み問題。データは data/kanji-grade*.js）
 *   sentence … 文の中の読み
 *   life     … 生活漢字
 *
 * ■ 文の中の読み（data/sentences.js）
 *   { id: 'sen_001', sentence: '宇宙は広い。', target: '宇宙', reading: 'うちゅう',
 *     readings?: ['別の正しい読み'], targetIndex?: 文中の位置（同じ語が2回出る場合）,
 *     difficulty: 1〜3, tags: ['自然'] }
 *
 * ■ 生活漢字（data/life-kanji.js）
 *   { id: 'life_station_001', word: '改札', reading: 'かいさつ', readings?: [...],
 *     sentence: '改札を通ります。', category: 'station', difficulty: 1〜3,
 *     tags: [...], meaning?: '意味（将来の意味問題用）',
 *     image?: '画像パス（将来の看板風・画像付き問題用）', display?: 'sign' など表示スタイル }
 *
 *   カテゴリーは registerLifeCategories で追加できます。
 *
 * id は学習記録のキーとして保存されるため、公開後は変更しないでください。
 */
(function (KA) {
  'use strict';

  /** 問題タイプの表示名 */
  const PROBLEM_TYPES = {
    single: { id: 'single', label: '一文字の読み', kids: '一文字', icon: '字', desc: 'かんじを見て、よみをこたえよう', kidsDesc: 'かんじの よみ' },
    sentence: { id: 'sentence', label: '文の中の読み', kids: '文の中', icon: '📖', desc: '文の中のことばを読んでみよう', kidsDesc: 'ぶんの なかの ことば' },
    life: { id: 'life', label: '生活漢字', kids: '生活漢字', icon: '🏙️', desc: '生活の中でよく見ることばを読もう', kidsDesc: 'まちで みる ことば' },
  };

  const categories = []; // { id, label, kidsLabel, icon, order }
  const ALL_SCENES = { id: 'all', label: 'すべて', kidsLabel: 'ぜんぶ', icon: '🌈' };
  const sentences = [];
  const lifeItems = [];
  const byId = {};

  function toArray(v) {
    if (Array.isArray(v)) return v;
    return v == null || v === '' ? [] : [v];
  }

  function register(list, raw, ptype) {
    if (!raw || !raw.id || byId[raw.id]) {
      if (raw && byId[raw.id]) console.warn('[ReadingData] duplicate id:', raw.id);
      return;
    }
    const word = ptype === 'sentence' ? raw.target : raw.word;
    if (!word || !raw.reading) return;
    const item = {
      id: raw.id,
      ptype,
      word,
      reading: raw.reading,
      readings: [raw.reading].concat(toArray(raw.readings)),
      sentence: raw.sentence || '',
      targetIndex: typeof raw.targetIndex === 'number' ? raw.targetIndex : null,
      category: raw.category || null,
      difficulty: raw.difficulty || 1,
      tags: toArray(raw.tags),
      meaning: raw.meaning || '',
      image: raw.image || null,
      display: raw.display || null,
    };
    // 生活漢字のカテゴリーは表示名でも指定できる
    if (ptype === 'life' && item.category) {
      const cat = categories.find((c) => c.id === item.category || c.label === item.category);
      item.category = cat ? cat.id : item.category;
    }
    byId[item.id] = item;
    list.push(item);
  }

  const ReadingData = {
    PROBLEM_TYPES,

    registerLifeCategories(list) {
      (list || []).forEach((c) => {
        if (c && c.id && !categories.some((x) => x.id === c.id)) categories.push(Object.assign({ order: categories.length }, c));
      });
    },

    registerSentences(list) {
      (list || []).forEach((raw) => register(sentences, raw, 'sentence'));
    },

    registerLife(list) {
      (list || []).forEach((raw) => register(lifeItems, raw, 'life'));
    },

    sentences() {
      return sentences;
    },

    life(categoryId) {
      return categoryId ? lifeItems.filter((i) => i.category === categoryId) : lifeItems;
    },

    items(ptype) {
      return ptype === 'sentence' ? sentences : ptype === 'life' ? lifeItems : [];
    },

    lifeCategories() {
      return categories.slice().sort((a, b) => a.order - b.order);
    },

    category(id) {
      if (id === ALL_SCENES.id) return ALL_SCENES;
      return categories.find((c) => c.id === id) || { id, label: id || 'その他', icon: '📍' };
    },

    /** 「すべて」を表す場面（カテゴリー指定なし） */
    ALL_SCENES,

    /**
     * 場面の指定を正規化する
     * 'all' / 未指定 → null（すべて）、'school' → ['school']、'school,work' → ['school', 'work']（将来の複数選択用）
     * 存在しないカテゴリーは取り除く
     */
    parseCategories(value) {
      if (!value || value === ALL_SCENES.id) return null;
      const list = (Array.isArray(value) ? value : String(value).split(','))
        .map((v) => String(v).trim())
        .filter((v) => categories.some((c) => c.id === v));
      return list.length ? Array.from(new Set(list)) : null;
    },

    /** 場面の指定 → URL などに載せる文字列（null → 'all'） */
    categoriesKey(list) {
      return list && list.length ? list.join(',') : ALL_SCENES.id;
    },

    /** 指定した場面の生活漢字（null ならすべて） */
    lifeIn(list) {
      return list && list.length ? lifeItems.filter((i) => list.includes(i.category)) : lifeItems;
    },

    /** 場面の表示名（例: 「🏫 学校」「🏫 学校・🏢 仕事・職場」「🌈 すべて」） */
    categoriesLabel(list, kids, withIcon) {
      const cats = list && list.length ? list.map((id) => ReadingData.category(id)) : [ALL_SCENES];
      return cats.map((c) => (withIcon === false ? '' : c.icon + ' ') + (kids && c.kidsLabel ? c.kidsLabel : c.label)).join('・');
    },

    get(id) {
      return byId[id] || null;
    },

    typeLabel(ptype, kids) {
      const t = PROBLEM_TYPES[ptype];
      if (!t) return ptype === 'mixed' ? (kids ? 'いろいろ' : 'ミックス') : '';
      return kids ? t.kids : t.label;
    },

    /** 文を [前, 対象の語, 後] に分ける（強調表示用） */
    splitSentence(item) {
      const s = item.sentence || '';
      let idx = item.targetIndex != null ? item.targetIndex : s.indexOf(item.word);
      if (idx < 0 || s.substr(idx, item.word.length) !== item.word) idx = s.indexOf(item.word);
      if (idx < 0) return [s, item.word, ''];
      return [s.slice(0, idx), item.word, s.slice(idx + item.word.length)];
    },
  };

  KA.ReadingData = ReadingData;
})(window.KanjiApp);
