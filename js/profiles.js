/*
 * プロフィール
 * ------------------------------------------------------------
 * 学習記録・習熟度・称号などはすべてプロフィールの中に入れ、
 * プロフィールごとに完全に分離します。
 */
(function (KA) {
  'use strict';

  const ICONS = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧',
    '🐤', '🦄', '🐲', '🐬', '🌸', '⭐', '🌈', '🚀', '⚽', '🎹', '📚', '🍙'];

  const INPUT_METHODS = {
    hiragana: { label: 'ひらがな入力', short: 'ひらがな', desc: '画面の大きなひらがなパネルやスマホのかな入力で答えます（幼児向け）' },
    romaji: { label: 'ローマ字入力', short: 'ローマ字', desc: 'キーボードで入力します。ローマ字のまま打っても自動でひらがなになります' },
    choice: { label: 'えらんでこたえる（4択）', short: '4択', desc: '4つの中から正しい読みをタップします（文字入力がまだ難しい子向け）' },
  };

  const DISPLAY_MODES = {
    kids: { label: 'キッズ表示', desc: '大きな文字とボタン。数字は少なめで、称号やメダルが目立ちます' },
    standard: { label: '標準表示', desc: '習熟度・正答率・苦手漢字・グラフなど詳しい情報を表示します' },
  };

  function defaultStats() {
    return {
      totalQuestions: 0,
      totalCorrect: 0,
      totalSessions: 0, // 最後まで終えたクイズの回数
      startedSessions: 0,
      currentStreak: 0, // 現在の連続正解（クイズをまたいで続く）
      bestStreak: 0, // 歴代最高の連続正解
      perfect: { n10: 0, n20: 0, n30: 0, all: 0, total: 0 },
      onCorrect: 0, // 音読みで正解した数
      kunCorrect: 0, // 訓読みで正解した数
      inputCorrect: { hiragana: 0, romaji: 0, choice: 0 },
      todaySessions: 0, // 「今日の10問」をクリアした回数
      reviewSessions: 0, // 「おまかせ復習」をクリアした回数
      overcomeCount: 0, // 苦手を克服した漢字の数
      studyDays: 0, // 学習した日数（合計）
      dayStreak: 0, // 連続学習日数
      bestDayStreak: 0,
      lastStudyDate: null, // 'YYYY-MM-DD'
    };
  }

  function defaultProfile() {
    const now = Date.now();
    return {
      id: KA.Utils.uid('p'),
      name: '',
      icon: ICONS[0],
      createdAt: now,
      updatedAt: now,
      level: 'e1', // 現在の学習レベル
      inputMethod: 'hiragana',
      displayMode: 'kids',
      showKanaPad: true,
      equippedTitle: null, // 装備中の称号（実績ID）
      stats: defaultStats(),
      kanji: {}, // 漢字ごとの学習記録（proficiency.js 参照）
      history: [], // 直近30回のクイズ記録
      daily: {}, // 日ごとの記録 { 'YYYY-MM-DD': { q, c, wrong: [] } }
      achievements: {}, // { [id]: { at } }
      medals: {}, // { [id]: { at } }
      counters: { zukanViewed: [], modesCleared: {}, flags: {} },
    };
  }

  /** 古いデータや欠けた項目を補う（読み込み時に毎回実行） */
  function normalizeProfile(p) {
    const U = KA.Utils;
    const base = defaultProfile();
    Object.keys(base).forEach((key) => {
      if (p[key] === undefined || p[key] === null) {
        if (key !== 'equippedTitle') p[key] = base[key];
      }
    });
    if (!U.isPlainObject(p.stats)) p.stats = defaultStats();
    const ds = defaultStats();
    Object.keys(ds).forEach((k) => {
      if (p.stats[k] === undefined || p.stats[k] === null) p.stats[k] = ds[k];
    });
    if (!U.isPlainObject(p.stats.perfect)) p.stats.perfect = ds.perfect;
    if (!U.isPlainObject(p.stats.inputCorrect)) p.stats.inputCorrect = ds.inputCorrect;
    ['kanji', 'daily', 'achievements', 'medals'].forEach((k) => {
      if (!U.isPlainObject(p[k])) p[k] = {};
    });
    if (!Array.isArray(p.history)) p.history = [];
    if (!U.isPlainObject(p.counters)) p.counters = base.counters;
    if (!Array.isArray(p.counters.zukanViewed)) p.counters.zukanViewed = [];
    if (!U.isPlainObject(p.counters.modesCleared)) p.counters.modesCleared = {};
    if (!U.isPlainObject(p.counters.flags)) p.counters.flags = {};
    if (!INPUT_METHODS[p.inputMethod]) p.inputMethod = 'hiragana';
    if (!DISPLAY_MODES[p.displayMode]) p.displayMode = 'kids';
    if (!p.name) p.name = 'なまえ';
    if (p.equippedTitle && !p.achievements[p.equippedTitle]) p.equippedTitle = null;
    return p;
  }

  KA.Store.registerNormalizer((data) => {
    Object.keys(data.profiles).forEach((id) => {
      data.profiles[id].id = id;
      normalizeProfile(data.profiles[id]);
    });
  });

  const Profiles = {
    ICONS,
    INPUT_METHODS,
    DISPLAY_MODES,

    list() {
      const d = KA.Store.data;
      return d.profileOrder.map((id) => d.profiles[id]).filter(Boolean);
    },

    get(id) {
      return KA.Store.data.profiles[id] || null;
    },

    active() {
      const id = KA.Store.settings.activeProfileId;
      return id ? Profiles.get(id) : null;
    },

    setActive(id) {
      if (!Profiles.get(id)) return;
      KA.Store.settings.activeProfileId = id;
      KA.Store.save();
    },

    create(fields) {
      const p = defaultProfile();
      Profiles.applyFields(p, fields);
      const d = KA.Store.data;
      d.profiles[p.id] = p;
      d.profileOrder.push(p.id);
      d.settings.activeProfileId = p.id;
      KA.Store.save();
      return p;
    },

    /** 編集フォームで変更できる項目だけ反映 */
    applyFields(p, fields) {
      if (!fields) return p;
      if (typeof fields.name === 'string') p.name = fields.name.trim().slice(0, 20) || p.name || 'なまえ';
      if (fields.icon) p.icon = fields.icon;
      if (fields.level && KA.KanjiDB.getLevel(fields.level)) p.level = fields.level;
      if (INPUT_METHODS[fields.inputMethod]) p.inputMethod = fields.inputMethod;
      if (DISPLAY_MODES[fields.displayMode]) p.displayMode = fields.displayMode;
      if (typeof fields.showKanaPad === 'boolean') p.showKanaPad = fields.showKanaPad;
      p.updatedAt = Date.now();
      return p;
    },

    update(id, fields) {
      const p = Profiles.get(id);
      if (!p) return null;
      Profiles.applyFields(p, fields);
      KA.Store.save();
      return p;
    },

    remove(id) {
      const d = KA.Store.data;
      delete d.profiles[id];
      d.profileOrder = d.profileOrder.filter((x) => x !== id);
      if (d.settings.activeProfileId === id) d.settings.activeProfileId = d.profileOrder[0] || null;
      KA.Store.save();
    },

    /** 学習データだけ初期化（名前・設定は残す） */
    resetLearning(id) {
      const p = Profiles.get(id);
      if (!p) return;
      const fresh = defaultProfile();
      ['stats', 'kanji', 'history', 'daily', 'achievements', 'medals', 'counters'].forEach((k) => {
        p[k] = fresh[k];
      });
      p.equippedTitle = null;
      p.updatedAt = Date.now();
      KA.Store.save();
    },

    equipTitle(id, achievementId) {
      const p = Profiles.get(id);
      if (!p) return;
      p.equippedTitle = achievementId && p.achievements[achievementId] ? achievementId : null;
      if (p.equippedTitle) p.counters.flags.equipped = true;
      KA.Store.save();
    },

    isKids(p) {
      return (p || Profiles.active() || {}).displayMode === 'kids';
    },
  };

  KA.Profiles = Profiles;
})(window.KanjiApp);
