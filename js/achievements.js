/*
 * 称号・実績
 * ------------------------------------------------------------
 * 実績を達成すると、その名前の「称号」がもらえます。
 * 取得した称号は 1 つプロフィールに装備できます。
 *
 * 定義の形:
 *   { id, cat, name（称号名）, desc（解除条件）, icon,
 *     hidden?: true   … 取得するまで「？？？」表示
 *     future?: true   … 将来の機能用（まだ取得できない）
 *     rarity?: 'rare' | 'super' | 'legend'  … レア / 超レア / 最高レア（省略時は通常）。超レア以上は豪華な演出
 *     title?: '称号名' … 装備したときの称号名（省略時は name）
 *     image?: '画像パス' … アイコンの代わりに表示する画像（校章など）
 *     check(ctx) → true/false
 *     progress?(ctx) → [現在値, 目標値]   … 「あと○問で解除」の表示に使う }
 *
 * id は保存データに記録されるので、公開後は変更しないでください。
 * 新しい実績は末尾に追加するだけで、既存ユーザーにも自動で判定されます。
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;

  const CATEGORIES = [
    { id: 'beginner', label: '初心者' },
    { id: 'challenge', label: '挑戦回数' },
    { id: 'correct', label: '正解数' },
    { id: 'streak', label: '連続正解' },
    { id: 'perfect', label: '満点' },
    { id: 'continue', label: '継続学習' },
    { id: 'grade', label: '学年制覇' },
    { id: 'master', label: 'マスター' },
    { id: 'overcome', label: '苦手克服' },
    { id: 'reading', label: '読み' },
    { id: 'style', label: 'いろいろ' },
    { id: 'sentence', label: '文の中の読み' },
    { id: 'life', label: '生活漢字' },
    { id: 'sakura', label: '🌸 サクラモード' },
    { id: 'legend', label: '伝説' },
    { id: 'hidden', label: '隠し称号' },
    { id: 'future', label: 'これから登場' },
  ];

  /** 「○○が N 以上」で解除される実績をまとめて作る */
  function threshold(id, cat, name, desc, icon, getter, target, unit) {
    return {
      id,
      cat,
      name,
      desc,
      icon,
      unit: unit || '',
      check: (ctx) => getter(ctx) >= target,
      progress: (ctx) => [Math.min(getter(ctx), target), target],
    };
  }

  const s = (key) => (ctx) => ctx.stats[key] || 0;

  const gradeIds = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
  const gradeNames = ['1', '2', '3', '4', '5', '6'];
  const gradeTitles = ['一年生', '二年生', '三年生', '四年生', '五年生', '六年生'];

  const DEFS = [
    /* ---------- 初心者 ---------- */
    { id: 'start', cat: 'beginner', name: '漢字学習スタート', desc: 'プロフィールを作る', icon: '🌱', check: () => true },
    threshold('first_step', 'beginner', 'はじめの一歩', 'はじめて問題に答える', '👣', s('totalQuestions'), 1, '問'),
    threshold('first_correct', 'beginner', 'はじめての正解', 'はじめて正解する', '⭕', s('totalCorrect'), 1, '問'),
    threshold('first_clear', 'beginner', '初クイズクリア', '問題を最後までやりきる', '🏁', s('totalSessions'), 1, '回'),
    threshold('today_first', 'beginner', '今日の挑戦者', '「今日の10問」をクリアする', '📅', s('todaySessions'), 1, '回'),
    threshold('review_first', 'beginner', '復習デビュー', '「おまかせ復習」をクリアする', '🔁', s('reviewSessions'), 1, '回'),
    { id: 'zukan_open', cat: 'beginner', name: '図鑑デビュー', desc: '漢字図鑑で漢字をしらべる', icon: '📖', check: (c) => c.zukanViewed >= 1 },
    { id: 'equip', cat: 'beginner', name: 'おしゃれさん', desc: '称号を装備する', icon: '🎀', check: (c) => !!c.flags.equipped },
    { id: 'backup', cat: 'beginner', name: 'そなえあれば', desc: '学習データを書き出す（バックアップ）', icon: '💾', check: (c) => !!c.flags.backup },
    { id: 'first_perfect', cat: 'beginner', name: 'はじめての満点', desc: '問題で満点をとる', icon: '💮', check: (c) => (c.stats.perfect.total || 0) >= 1 },

    /* ---------- 挑戦回数 ---------- */
    threshold('sess_3', 'challenge', 'チャレンジャー', '問題を3回クリア', '🎯', s('totalSessions'), 3, '回'),
    threshold('sess_10', 'challenge', '10回挑戦', '問題を10回クリア', '🥉', s('totalSessions'), 10, '回'),
    threshold('sess_30', 'challenge', '30回挑戦', '問題を30回クリア', '🥈', s('totalSessions'), 30, '回'),
    threshold('sess_50', 'challenge', 'がんばりの星', '問題を50回クリア', '🌟', s('totalSessions'), 50, '回'),
    threshold('sess_100', 'challenge', '100回挑戦', '問題を100回クリア', '🥇', s('totalSessions'), 100, '回'),
    threshold('sess_300', 'challenge', '不屈の挑戦者', '問題を300回クリア', '🏔️', s('totalSessions'), 300, '回'),
    threshold('q_100', 'challenge', '100問突破', '合計100問に答える', '💯', s('totalQuestions'), 100, '問'),
    threshold('q_300', 'challenge', '300問突破', '合計300問に答える', '📈', s('totalQuestions'), 300, '問'),
    threshold('q_1000', 'challenge', '1000問突破', '合計1000問に答える', '🚀', s('totalQuestions'), 1000, '問'),
    threshold('q_3000', 'challenge', '3000問突破', '合計3000問に答える', '🛰️', s('totalQuestions'), 3000, '問'),
    threshold('q_5000', 'challenge', '5000問突破', '合計5000問に答える', '🌍', s('totalQuestions'), 5000, '問'),
    threshold('q_10000', 'challenge', '一万問の旅人', '合計10000問に答える', '🌌', s('totalQuestions'), 10000, '問'),

    /* ---------- 正解数 ---------- */
    threshold('c_10', 'correct', '10問正解', '合計10問正解', '✏️', s('totalCorrect'), 10, '問'),
    threshold('c_50', 'correct', '50問正解', '合計50問正解', '📝', s('totalCorrect'), 50, '問'),
    threshold('c_100', 'correct', '100問正解', '合計100問正解', '🎉', s('totalCorrect'), 100, '問'),
    threshold('c_500', 'correct', '500問正解', '合計500問正解', '🎊', s('totalCorrect'), 500, '問'),
    threshold('c_1000', 'correct', '1000問正解', '合計1000問正解', '🏅', s('totalCorrect'), 1000, '問'),
    threshold('c_2000', 'correct', '漢字の勇者', '合計2000問正解', '⚔️', s('totalCorrect'), 2000, '問'),
    threshold('c_5000', 'correct', '漢字の賢者', '合計5000問正解', '🧙', s('totalCorrect'), 5000, '問'),
    threshold('c_10000', 'correct', '漢字の大賢者', '合計10000問正解', '🔮', s('totalCorrect'), 10000, '問'),

    /* ---------- 連続正解 ---------- */
    threshold('st_5', 'streak', '5連続正解', '5問連続で正解', '🔥', s('bestStreak'), 5, '問'),
    threshold('st_10', 'streak', '10連続正解', '10問連続で正解', '🔥', s('bestStreak'), 10, '問'),
    threshold('st_20', 'streak', '連続の達人', '20問連続で正解', '⚡', s('bestStreak'), 20, '問'),
    threshold('st_30', 'streak', '30連続正解', '30問連続で正解', '🌪️', s('bestStreak'), 30, '問'),
    threshold('st_50', 'streak', '50連続正解', '50問連続で正解', '☄️', s('bestStreak'), 50, '問'),
    threshold('st_100', 'streak', 'ノーミス王', '100問連続で正解', '👑', s('bestStreak'), 100, '問'),

    /* ---------- 満点 ---------- */
    { id: 'pf_10', cat: 'perfect', name: '10問満点', desc: '10問モードで満点', icon: '🌸', check: (c) => c.stats.perfect.n10 >= 1 },
    { id: 'pf_20', cat: 'perfect', name: '20問満点', desc: '20問モードで満点', icon: '🌺', check: (c) => c.stats.perfect.n20 >= 1 },
    { id: 'pf_30', cat: 'perfect', name: '30問満点', desc: '30問モードで満点', icon: '🌻', check: (c) => c.stats.perfect.n30 >= 1 },
    { id: 'pf_all', cat: 'perfect', name: '全問満点', desc: '学年の全漢字モードで満点', icon: '🏆', check: (c) => c.stats.perfect.all >= 1 },
    threshold('pf_10x5', 'perfect', '満点ハンター', '10問モードで5回満点', '🎯', (c) => c.stats.perfect.n10, 5, '回'),
    threshold('pf_10x20', 'perfect', '満点マイスター', '10問モードで20回満点', '🎖️', (c) => c.stats.perfect.n10, 20, '回'),
    threshold('pf_total50', 'perfect', '満点の星', '満点を合計50回', '💫', (c) => c.stats.perfect.total, 50, '回'),

    /* ---------- 継続学習 ---------- */
    threshold('day_3', 'continue', '3日連続', '3日続けて学習', '📆', s('bestDayStreak'), 3, '日'),
    threshold('day_7', 'continue', '1週間の習慣', '7日続けて学習', '🗓️', s('bestDayStreak'), 7, '日'),
    threshold('day_14', 'continue', '2週間の努力家', '14日続けて学習', '🌿', s('bestDayStreak'), 14, '日'),
    threshold('day_30', 'continue', '30日連続', '30日続けて学習', '🌳', s('bestDayStreak'), 30, '日'),
    threshold('day_60', 'continue', '継続は力なり', '60日続けて学習', '🏯', s('bestDayStreak'), 60, '日'),
    threshold('day_100', 'continue', '百日の修行', '100日続けて学習', '⛩️', s('bestDayStreak'), 100, '日'),
    threshold('days_10', 'continue', '学習10日目', '学習した日が合計10日', '🔟', s('studyDays'), 10, '日'),
    threshold('days_50', 'continue', '学習50日目', '学習した日が合計50日', '📚', s('studyDays'), 50, '日'),
    threshold('days_100', 'continue', '学習100日目', '学習した日が合計100日', '🎓', s('studyDays'), 100, '日'),
    threshold('today_10', 'continue', '毎日コツコツ', '「今日の10問」を10回クリア', '☀️', s('todaySessions'), 10, '回'),
    threshold('today_30', 'continue', '今日の10問マスター', '「今日の10問」を30回クリア', '🌞', s('todaySessions'), 30, '回'),
    threshold('today_100', 'continue', '日課の達人', '「今日の10問」を100回クリア', '🌅', s('todaySessions'), 100, '回'),
  ];

  /* ---------- 学年制覇 ---------- */
  gradeIds.forEach((gid, i) => {
    DEFS.push({
      id: 'seen_' + gid,
      cat: 'grade',
      name: `小学${gradeNames[i]}年 全字挑戦`,
      desc: `小学${gradeNames[i]}年の漢字すべてに1回以上答える`,
      icon: '🗺️',
      check: (c) => c.gradeSeen(gid) >= c.gradeTotal(gid) && c.gradeTotal(gid) > 0,
      progress: (c) => [c.gradeSeen(gid), c.gradeTotal(gid)],
      unit: '字',
    });
    DEFS.push({
      id: 'master_' + gid,
      cat: 'grade',
      name: `小学${gradeTitles[i]}マスター`,
      desc: `小学${gradeNames[i]}年の漢字をすべてマスターする`,
      icon: '🎓',
      check: (c) => c.gradeMastered(gid) >= c.gradeTotal(gid) && c.gradeTotal(gid) > 0,
      progress: (c) => [c.gradeMastered(gid), c.gradeTotal(gid)],
      unit: '字',
    });
  });
  DEFS.push({
    id: 'seen_elementary',
    cat: 'grade',
    name: '小学校漢字 全字挑戦',
    desc: '小学校の漢字1,026字すべてに答える',
    icon: '🧭',
    check: (c) => gradeIds.every((g) => c.gradeSeen(g) >= c.gradeTotal(g) && c.gradeTotal(g) > 0),
    progress: (c) => [gradeIds.reduce((a, g) => a + c.gradeSeen(g), 0), gradeIds.reduce((a, g) => a + c.gradeTotal(g), 0)],
    unit: '字',
  });
  DEFS.push({
    id: 'master_elementary',
    cat: 'grade',
    name: '小学校漢字完全制覇',
    desc: '小学校の漢字1,026字をすべてマスターする',
    icon: '🏯',
    check: (c) => gradeIds.every((g) => c.gradeMastered(g) >= c.gradeTotal(g) && c.gradeTotal(g) > 0),
    progress: (c) => [gradeIds.reduce((a, g) => a + c.gradeMastered(g), 0), gradeIds.reduce((a, g) => a + c.gradeTotal(g), 0)],
    unit: '字',
  });

  /* ---------- 中学校の漢字（アプリ独自の学習レベル） ---------- */
  const juniorIds = ['j1', 'j2', 'j3'];
  const juniorNames = ['1', '2', '3'];
  const juniorTitles = ['一年', '二年', '三年'];
  juniorIds.forEach((gid, i) => {
    DEFS.push({
      id: 'seen_' + gid,
      cat: 'grade',
      name: `中学${juniorNames[i]}年 全字挑戦`,
      desc: `中学${juniorNames[i]}年（アプリの目安）の漢字すべてに1回以上答える`,
      icon: '🗺️',
      check: (c) => c.gradeSeen(gid) >= c.gradeTotal(gid) && c.gradeTotal(gid) > 0,
      progress: (c) => [c.gradeSeen(gid), c.gradeTotal(gid)],
      unit: '字',
    });
    DEFS.push({
      id: 'master_' + gid,
      cat: 'grade',
      name: `中学${juniorTitles[i]}マスター`,
      desc: `中学${juniorNames[i]}年（アプリの目安）の漢字をすべてマスターする`,
      icon: '🎓',
      check: (c) => c.gradeMastered(gid) >= c.gradeTotal(gid) && c.gradeTotal(gid) > 0,
      progress: (c) => [c.gradeMastered(gid), c.gradeTotal(gid)],
      unit: '字',
    });
  });
  const allLevels = (ids, fn) => (c) => ids.every((g) => fn(c, g) >= c.gradeTotal(g) && c.gradeTotal(g) > 0);
  const sumLevels = (ids, fn) => (c) => [ids.reduce((a, g) => a + fn(c, g), 0), ids.reduce((a, g) => a + c.gradeTotal(g), 0)];
  const seenOf = (c, g) => c.gradeSeen(g);
  const masteredOf = (c, g) => c.gradeMastered(g);
  const joyoIds = gradeIds.concat(juniorIds);
  DEFS.push(
    { id: 'seen_junior', cat: 'grade', name: '中学校漢字 全字挑戦', desc: '中学校の漢字1,110字すべてに答える', icon: '🧭',
      check: allLevels(juniorIds, seenOf), progress: sumLevels(juniorIds, seenOf), unit: '字' },
    { id: 'master_junior', cat: 'grade', name: '中学校漢字完全制覇', desc: '中学校の漢字1,110字をすべてマスターする', icon: '🏰',
      check: allLevels(juniorIds, masteredOf), progress: sumLevels(juniorIds, masteredOf), unit: '字' },
    { id: 'master_joyo', cat: 'grade', name: '常用漢字マスター', desc: '常用漢字2,136字（小学校＋中学校）をすべてマスターする', icon: '🗾',
      check: allLevels(joyoIds, masteredOf), progress: sumLevels(joyoIds, masteredOf), unit: '字' }
  );

  DEFS.push(
    /* ---------- マスター ---------- */
    threshold('mx_1', 'master', 'はじめてのマスター', '漢字を1字マスターする', '⭐', (c) => c.everMastered, 1, '字'),
    threshold('mx_10', 'master', '10字マスター', '漢字を10字マスターする', '🌟', (c) => c.everMastered, 10, '字'),
    threshold('mx_50', 'master', '50字マスター', '漢字を50字マスターする', '✨', (c) => c.everMastered, 50, '字'),
    threshold('mx_100', 'master', '100字マスター', '漢字を100字マスターする', '💎', (c) => c.everMastered, 100, '字'),
    threshold('mx_300', 'master', '300字マスター', '漢字を300字マスターする', '👑', (c) => c.everMastered, 300, '字'),
    threshold('mx_600', 'master', '600字マスター', '漢字を600字マスターする', '🏆', (c) => c.everMastered, 600, '字'),

    /* ---------- 苦手克服 ---------- */
    threshold('ov_1', 'overcome', '苦手を1個克服', '苦手漢字を1個克服する', '💪', s('overcomeCount'), 1, '個'),
    threshold('ov_10', 'overcome', '苦手を10個克服', '苦手漢字を10個克服する', '🦾', s('overcomeCount'), 10, '個'),
    threshold('ov_30', 'overcome', '逆境に強い', '苦手漢字を30個克服する', '🛡️', s('overcomeCount'), 30, '個'),
    threshold('ov_100', 'overcome', '苦手なし', '苦手漢字を100個克服する', '🏋️', s('overcomeCount'), 100, '個'),
    {
      id: 'yesterday_clear',
      cat: 'overcome',
      name: 'きのうの自分に勝つ',
      desc: '昨日間違えた漢字（3字以上）を、今日すべて正解する',
      icon: '🔄',
      check: (c) => !!c.flags.yesterdayClear,
    },
    threshold('review_10', 'overcome', '復習の鬼', '「おまかせ復習」を10回クリア', '👹', s('reviewSessions'), 10, '回'),

    /* ---------- 読み ---------- */
    threshold('on_10', 'reading', '音読み入門', '音読みで10問正解', '🔈', s('onCorrect'), 10, '問'),
    threshold('kun_10', 'reading', '訓読み入門', '訓読みで10問正解', '🗣️', s('kunCorrect'), 10, '問'),
    threshold('on_100', 'reading', '音読みマスター', '音読みで100問正解', '🔉', s('onCorrect'), 100, '問'),
    threshold('kun_100', 'reading', '訓読みマスター', '訓読みで100問正解', '💬', s('kunCorrect'), 100, '問'),
    threshold('on_500', 'reading', '音読み博士', '音読みで500問正解', '🔊', s('onCorrect'), 500, '問'),
    threshold('kun_500', 'reading', '訓読み博士', '訓読みで500問正解', '📣', s('kunCorrect'), 500, '問'),

    /* ---------- いろいろ ---------- */
    threshold('in_hira', 'style', 'ひらがな名人', 'ひらがな入力で50問正解', 'あ', (c) => c.stats.inputCorrect.hiragana, 50, '問'),
    threshold('in_romaji', 'style', 'タイピスト', 'ローマ字入力で100問正解', '⌨️', (c) => c.stats.inputCorrect.romaji, 100, '問'),
    threshold('in_choice', 'style', 'えらび上手', '4択で100問正解', '👆', (c) => c.stats.inputCorrect.choice, 100, '問'),
    { id: 'morning', cat: 'style', name: '朝の漢字マスター', desc: '朝5時〜8時に問題をクリア', icon: '🌄', check: (c) => !!c.flags.morning },
    { id: 'evening', cat: 'style', name: '夜の学習家', desc: '夜8時〜10時に問題をクリア', icon: '🌙', check: (c) => !!c.flags.evening },
    threshold('zukan_10', 'style', '図鑑めくり', '漢字図鑑で10字しらべる', '🔍', (c) => c.zukanViewed, 10, '字'),
    threshold('zukan_50', 'style', '図鑑マニア', '漢字図鑑で50字しらべる', '🔎', (c) => c.zukanViewed, 50, '字'),
    threshold('zukan_200', 'style', '漢字ものしり', '漢字図鑑で200字しらべる', '🧐', (c) => c.zukanViewed, 200, '字'),

    /* ---------- 伝説 ---------- */
    {
      id: 'hakase',
      cat: 'legend',
      name: '漢字博士',
      desc: '300字マスター＆合計3000問正解',
      icon: '🎓',
      check: (c) => c.everMastered >= 300 && c.stats.totalCorrect >= 3000,
      progress: (c) => [Math.min(c.everMastered, 300) + Math.min(c.stats.totalCorrect, 3000) / 10, 600],
    },
    {
      id: 'kanji_king',
      cat: 'legend',
      name: '漢字王',
      desc: '600字マスター＆合計6000問正解',
      icon: '🤴',
      check: (c) => c.everMastered >= 600 && c.stats.totalCorrect >= 6000,
      progress: (c) => [Math.min(c.everMastered, 600) + Math.min(c.stats.totalCorrect, 6000) / 10, 1200],
    },
    {
      id: 'kanji_god',
      cat: 'legend',
      name: '漢字神',
      desc: '小学校漢字をすべてマスター＆合計10000問正解',
      icon: '⚜️',
      check: (c) => c.everMastered >= 1026 && c.stats.totalCorrect >= 10000,
      progress: (c) => [Math.min(c.everMastered, 1026) + Math.min(c.stats.totalCorrect, 10000) / 10, 2026],
    },

    /* ---------- 隠し称号 ---------- */
    { id: 'h_effort', cat: 'hidden', hidden: true, name: '努力の天才', desc: '3回以上間違えた漢字を、3回連続で正解する', icon: '💡', check: (c) => !!c.flags.effortComeback },
    { id: 'h_weak_perfect', cat: 'hidden', hidden: true, name: '苦手ハンター', desc: '苦手漢字の復習（5問以上）で満点', icon: '🏹', check: (c) => !!c.flags.weakPerfect },
    { id: 'h_lucky7', cat: 'hidden', hidden: true, name: 'ラッキーセブン', desc: 'マスターした漢字がちょうど77字になる', icon: '🍀', check: (c) => c.everMastered === 77 },
    { id: 'h_titles_20', cat: 'hidden', hidden: true, name: '称号コレクター', desc: '称号を20個あつめる', icon: '🗃️', check: (c) => c.achievementCount >= 20 },
    { id: 'h_titles_50', cat: 'hidden', hidden: true, name: '称号マニア', desc: '称号を50個あつめる', icon: '🏛️', check: (c) => c.achievementCount >= 50 },
    { id: 'h_leap', cat: 'hidden', hidden: true, name: '大躍進', desc: '歴代最高の連続正解を、1回の問題で10以上更新', icon: '🦘', check: (c) => !!c.flags.leap },
    { id: 'h_comeback', cat: 'hidden', hidden: true, name: '逆転の達人', desc: '最初の3問を間違えたあと、残り（7問以上）を全部正解', icon: '🔃', check: (c) => !!c.flags.comeback },
    { id: 'h_night', cat: 'hidden', hidden: true, name: '夜ふかし漢字', desc: '夜10時〜朝4時に学習する', icon: '🦉', check: (c) => !!c.flags.night },
    { id: 'h_newyear', cat: 'hidden', hidden: true, name: '書き初め', desc: '1月1日に学習する', icon: '🎍', check: (c) => !!c.flags.newyear },
    { id: 'h_kanjiday', cat: 'hidden', hidden: true, name: '漢字の日', desc: '12月12日（漢字の日）に学習する', icon: '🈴', check: (c) => !!c.flags.kanjiday },
    { id: 'h_speed', cat: 'hidden', hidden: true, name: '電光石火', desc: '10問以上の問題を1問平均6秒以内・全問正解', icon: '⚡', check: (c) => !!c.flags.speed },
    { id: 'h_allmodes', cat: 'hidden', hidden: true, name: '全部のせ', desc: '10問・20問・30問・全問のすべてをクリア', icon: '🍱', check: (c) => ['10', '20', '30', 'all'].every((m) => c.modesCleared[m]) },
    { id: 'h_busy', cat: 'hidden', hidden: true, name: 'がんばり屋', desc: '1日に問題を5回クリア', icon: '🐝', check: (c) => (c.todayRecord.sessions || 0) >= 5 },
    { id: 'h_never_give_up', cat: 'hidden', hidden: true, name: '七転び八起き', desc: '1回の問題で8問以上間違えても最後までやりきる', icon: '🎎', check: (c) => !!c.flags.neverGiveUp },
    { id: 'h_marathon', cat: 'hidden', hidden: true, name: 'マラソンランナー', desc: '1日に100問以上答える', icon: '🏃', check: (c) => (c.todayRecord.q || 0) >= 100 },

    /* ---------- これから登場（将来の機能） ---------- */
    { id: 'f_radical', cat: 'future', future: true, name: '部首博士', desc: '部首クイズで活躍する（近日登場）', icon: '🧩', check: () => false },
    { id: 'f_compound', cat: 'future', future: true, name: '熟語博士', desc: '熟語クイズで活躍する（近日登場）', icon: '🔗', check: () => false },
    { id: 'f_okurigana', cat: 'future', future: true, name: '送り仮名名人', desc: '送り仮名クイズで活躍する（近日登場）', icon: '🖋️', check: () => false },
    { id: 'f_rare', cat: 'future', future: true, name: '難読漢字ハンター', desc: '難読漢字に挑戦する（近日登場）', icon: '🐉', check: () => false },
    { id: 'f_stroke', cat: 'future', future: true, name: '書き順名人', desc: '書き順を覚える（近日登場）', icon: '🖌️', check: () => false },
    { id: 'f_write', cat: 'future', future: true, name: '書き取り名人', desc: '書き取り問題で活躍する（近日登場）', icon: '📝', check: () => false }
  );

  /* ---------- v1.1.0: 文の中の読み・生活漢字 ---------- */
  const ts = (type, key) => (c) => (c.stats.typeStats && c.stats.typeStats[type] && c.stats.typeStats[type][key]) || 0;
  const lifeCat = (cat) => (c) => (c.stats.lifeCategoryCorrect && c.stats.lifeCategoryCorrect[cat]) || 0;
  const LIFE_CAT_TITLES = [
    ['school', '学校ことば名人', '🏫'],
    ['home', 'くらし上手', '🏠'],
    ['station', '電車マスター', '🚉'],
    ['shopping', '買い物上手', '🛒'],
    ['hospital', '病院ことば博士', '🏥'],
    ['work', '職場ことばマスター', '🏢'],
    ['public', 'まちの手続き名人', '🏛️'],
    ['restaurant', 'お店ことば名人', '🍽️'],
    ['safety', '安全第一！', '🚨'],
    ['signs', '標識ハンター', '🪧'],
  ];
  const LIFE_CAT_TARGET = 20;

  DEFS.push(
    threshold('sen_first', 'sentence', '文の中への第一歩', '「文の中の読み」を初めてクリア', '📖', ts('sentence', 'sessions'), 1, '回'),
    threshold('sen_c30', 'sentence', '文章読みデビュー', '文の中の読みで30問正解', '📘', ts('sentence', 'c'), 30, '問'),
    threshold('sen_c100', 'sentence', '文章読みの達人', '文の中の読みで100問正解', '📚', ts('sentence', 'c'), 100, '問'),
    threshold('sen_c300', 'sentence', '文章読みの名人', '文の中の読みで300問正解', '🏅', ts('sentence', 'c'), 300, '問'),
    threshold('sen_perfect', 'sentence', '文の中で満点', '文の中の読みで満点をとる', '💮', ts('sentence', 'perfect'), 1, '回'),
    {
      id: 'sen_all',
      cat: 'sentence',
      name: '例文コンプリート',
      desc: '文の中の読みの問題すべてに1回以上答える',
      icon: '🗂️',
      unit: '問',
      check: (c) => c.itemsSeen('sentence') >= c.itemsTotal('sentence') && c.itemsTotal('sentence') > 0,
      progress: (c) => [c.itemsSeen('sentence'), c.itemsTotal('sentence')],
    },
    threshold('life_first', 'life', '生活漢字デビュー', '「生活漢字」を初めてクリア', '🏙️', ts('life', 'sessions'), 1, '回'),
    threshold('life_c50', 'life', 'まちの漢字ウォッチャー', '生活漢字で50問正解', '👀', ts('life', 'c'), 50, '問'),
    threshold('life_c150', 'life', 'くらしの漢字名人', '生活漢字で150問正解', '🌆', ts('life', 'c'), 150, '問'),
    threshold('life_perfect', 'life', '生活漢字で満点', '生活漢字で満点をとる', '💯', ts('life', 'perfect'), 1, '回')
  );
  LIFE_CAT_TITLES.forEach(([cat, name, icon]) => {
    const label = () => (KA.ReadingData ? KA.ReadingData.category(cat).label : cat);
    DEFS.push({
      id: 'life_cat_' + cat,
      cat: 'life',
      name,
      get desc() {
        return `生活漢字の「${label()}」で${LIFE_CAT_TARGET}問正解`;
      },
      icon,
      unit: '問',
      check: (c) => lifeCat(cat)(c) >= LIFE_CAT_TARGET,
      progress: (c) => [Math.min(lifeCat(cat)(c), LIFE_CAT_TARGET), LIFE_CAT_TARGET],
    });
  });
  DEFS.push(
    {
      id: 'life_all_scenes',
      cat: 'life',
      name: '場面コンプリート',
      desc: '生活漢字のすべての場面で1問以上正解',
      icon: '🧭',
      unit: '場面',
      check: (c) => c.lifeCategoriesCleared() >= c.lifeCategoryTotal() && c.lifeCategoryTotal() > 0,
      progress: (c) => [c.lifeCategoriesCleared(), c.lifeCategoryTotal()],
    },
    {
      id: 'life_king',
      cat: 'life',
      name: 'くらしの漢字王',
      desc: '生活漢字で300問正解＆すべての場面で10問以上正解',
      icon: '👑',
      check: (c) => ts('life', 'c')(c) >= 300 && LIFE_CAT_TITLES.every(([cat]) => lifeCat(cat)(c) >= 10),
      progress: (c) => [Math.min(ts('life', 'c')(c), 300), 300],
      unit: '問',
    },
    {
      id: 'three_types',
      cat: 'life',
      name: '三つの読みマスター',
      desc: '一文字・文の中・生活漢字のすべてをクリア',
      icon: '🎌',
      check: (c) => ['single', 'sentence', 'life'].every((t) => ts(t, 'sessions')(c) >= 1),
    },
    {
      id: 'h_yomiwake',
      cat: 'hidden',
      hidden: true,
      name: '読み分け名人',
      desc: '「上る」「上げる」「上」の文をすべて正解する',
      icon: '🔀',
      check: (c) => ['sen_008', 'sen_009', 'sen_010'].every((id) => c.itemCorrect('sentence', id) >= 1),
    }
  );

  /* ---------- v1.7.0: サクラモード ---------- */
  // 判定は records.sakura（サクラモードでの学習結果）だけを使う。通常の生活漢字の結果は数えない
  const SK = (c) => c.sakura();
  const skStage = (stageId) => KA.Sakura.STAGES.find((st) => st.id === stageId);
  const skNeed = (stageId, c) => KA.Sakura.need(skStage(stageId).ratio, SK(c).total);
  const skFlag = (key) => (c) => c.profile.counters.sakura && c.profile.counters.sakura.flags ? c.profile.counters.sakura.flags[key] : 0;
  const skCounter = (key) => (c) => (c.profile.counters.sakura && c.profile.counters.sakura[key]) || 0;

  /** 成長系（異なる語をいくつ正解したか） */
  function skBloom(id, stageId, name, icon, extra) {
    return Object.assign(
      {
        id,
        cat: 'sakura',
        name,
        get desc() {
          const total = KA.Sakura ? KA.Sakura.items().length : 300;
          const n = KA.Sakura ? KA.Sakura.need(skStage(stageId).ratio, total) : 0;
          return n >= total ? `サクラモードの${total}語すべてを、一度以上正解する` : `サクラモードで、ちがう語を${n}語正解する`;
        },
        icon,
        unit: '語',
        check: (c) => SK(c).total > 0 && SK(c).correct >= skNeed(stageId, c),
        progress: (c) => [Math.min(SK(c).correct, skNeed(stageId, c)), skNeed(stageId, c)],
      },
      extra || {}
    );
  }

  /**
   * ジャンル制覇（内部タグに属するすべての問題が対象。簡単には取れない）
   * mode: 'correct' = すべて一度以上正解 / 'master' = すべてマスター
   */
  const SAKURA_GENRES = [
    { id: 'sk_g_commute', tags: ['commute', 'transport'], mode: 'correct', name: '通学の達人', icon: '🚃', label: '通学・交通' },
    { id: 'sk_g_school', tags: ['school'], mode: 'master', name: '学校生活マスター', icon: '🏫', label: '学校生活' },
    { id: 'sk_g_work', tags: ['practicum', 'work'], mode: 'correct', name: '実習の達人', icon: '🧰', label: '実習・仕事' },
    { id: 'sk_g_events', tags: ['events'], mode: 'correct', name: '行事名人', icon: '🎪', label: '学校行事' },
    { id: 'sk_g_friends', tags: ['relationships'], mode: 'correct', name: 'なかまの達人', icon: '🤝', label: '友達・人間関係' },
    { id: 'sk_g_japanese', tags: ['japanese'], mode: 'master', name: '国語マスター', icon: '📝', label: '国語' },
    { id: 'sk_g_career', tags: ['career'], mode: 'master', name: '進路マスター', icon: '🧭', label: '進路・就職' },
    { id: 'sk_g_safety', tags: ['safety', 'disaster'], mode: 'correct', name: '安全第一', icon: '🚨', label: '安全・防災' },
    { id: 'sk_g_ict', tags: ['ict'], mode: 'master', name: 'ICTマスター', icon: '💻', label: 'ICT・情報モラル' },
    { id: 'sk_g_life', tags: ['money', 'shopping', 'public', 'independent_living'], mode: 'master', name: '生活力マスター', icon: '💴', label: 'お金・買い物・公共手続き・自立生活' },
    // 追加のジャンル（校章の輝きの条件には含めない）
    { id: 'sk_g_health', tags: ['health'], mode: 'correct', name: '元気の達人', icon: '🩺', label: '健康・保健', extra: true },
    { id: 'sk_g_manners', tags: ['rules', 'manners'], mode: 'correct', name: 'マナー名人', icon: '🎀', label: 'ルール・マナー', extra: true },
  ];
  const SAKURA_MAIN_GENRES = SAKURA_GENRES.filter((g) => !g.extra).map((g) => g.id);

  DEFS.push(
    // 成長
    {
      id: 'sk_bud',
      cat: 'sakura',
      name: '桜のつぼみ',
      desc: 'サクラモードを初めてプレイする',
      icon: '🌱',
      check: (c) => ts('sakura', 'q')(c) >= 1,
    },
    skBloom('sk_bloom1', 'bloom1', '一分咲き', '🌸'),
    skBloom('sk_bloom3', 'bloom3', '三分咲き', '🌸'),
    skBloom('sk_bloom5', 'bloom5', '五分咲き', '🌸'),
    skBloom('sk_bloom8', 'bloom8', '八分咲き', '🌸', { rarity: 'rare' }),
    skBloom('sk_bloom_soon', 'soon', 'もうすぐ満開', '🌸', { rarity: 'rare' }),
    skBloom('sk_bloom_full', 'full', '満開', '🌸', { rarity: 'rare', title: '桜を咲かせし者' })
  );
  SAKURA_GENRES.forEach((g) => {
    const master = g.mode === 'master';
    DEFS.push({
      id: g.id,
      cat: 'sakura',
      name: g.name,
      desc: master ? `サクラモードの「${g.label}」の問題を、すべてマスターにする` : `サクラモードの「${g.label}」の問題を、すべて一度以上正解する`,
      icon: g.icon,
      rarity: 'rare',
      unit: '語',
      check: (c) => {
        const t = c.sakuraTag(g.tags);
        return t.total > 0 && (master ? t.mastered : t.correct) >= t.total;
      },
      progress: (c) => {
        const t = c.sakuraTag(g.tags);
        return [master ? t.mastered : t.correct, t.total];
      },
    });
  });
  DEFS.push(
    // 連続正解・満点
    { id: 'sk_perfect_day', cat: 'sakura', name: '完璧な一日', desc: 'サクラモード10問を全問正解する', icon: '🌸', check: (c) => skFlag('perfect10')(c) >= 1 },
    Object.assign(threshold('sk_fubuki', 'sakura', '桜吹雪', 'サクラモードで30問連続正解（回をまたいでもOK）', '🌪️', skCounter('bestStreak'), 30, '問'), { rarity: 'rare' }),
    Object.assign(threshold('sk_sprint', 'sakura', '桜の疾走', 'サクラモードで50問連続正解（回をまたいでもOK）', '🌸🚀', skCounter('bestStreak'), 50, '問'), { rarity: 'rare' }),
    // 超レア（最上位）
    {
      id: 'sk_complete',
      cat: 'sakura',
      rarity: 'super',
      name: 'サクラ完全制覇',
      title: 'サクラの達人',
      get desc() {
        return `サクラモードの${KA.Sakura ? KA.Sakura.items().length : 300}語すべてを、一度以上正解する`;
      },
      icon: '🌸🏆',
      unit: '語',
      check: (c) => SK(c).total > 0 && SK(c).correct >= SK(c).total,
      progress: (c) => [SK(c).correct, SK(c).total],
    },
    {
      id: 'sk_master',
      cat: 'sakura',
      rarity: 'super',
      name: 'サクラマスター',
      title: 'サクラマスター',
      get desc() {
        return `サクラモードの${KA.Sakura ? KA.Sakura.items().length : 300}語すべてを、マスター習熟度にする`;
      },
      icon: '🌸👑',
      unit: '語',
      check: (c) => SK(c).total > 0 && SK(c).mastered >= SK(c).total,
      progress: (c) => [SK(c).mastered, SK(c).total],
    },
    {
      id: 'sk_eternal',
      cat: 'sakura',
      rarity: 'super',
      name: '永久満開',
      title: '永久満開',
      desc: 'サクラモードの全語が「いま」マスター状態で、サクラの苦手問題が0',
      icon: '🌸💎',
      unit: '語',
      check: (c) => SK(c).total > 0 && SK(c).masteredNow >= SK(c).total && SK(c).weak === 0,
      progress: (c) => [SK(c).masteredNow, SK(c).total],
    },
    // 最高レア: 校章の輝き
    {
      id: 'sk_emblem',
      cat: 'sakura',
      rarity: 'legend',
      name: '校章の輝き',
      title: '桜を極めし者',
      desc: 'サクラモードの主要ジャンル制覇（10個）・サクラマスター・永久満開・桜吹雪をすべて獲得する',
      icon: '🌸',
      image: 'assets/sakura/sakura-emblem-192.png',
      unit: '個',
      check: (c) => SAKURA_EMBLEM_REQUIRES.every((id) => !!c.profile.achievements[id]),
      progress: (c) => [SAKURA_EMBLEM_REQUIRES.filter((id) => !!c.profile.achievements[id]).length, SAKURA_EMBLEM_REQUIRES.length],
    },
    // 隠し実績
    { id: 'sk_h_yozakura', cat: 'sakura', hidden: true, name: '夜桜', desc: '夜（19時〜朝5時）にサクラモード10問以上を全問正解', icon: '🌙', check: (c) => !!skFlag('yozakura')(c) },
    { id: 'sk_h_asazakura', cat: 'sakura', hidden: true, name: '朝桜', desc: '朝（5時〜9時）にサクラモード10問以上を全問正解', icon: '🌅', check: (c) => !!skFlag('asazakura')(c) },
    { id: 'sk_h_revive', cat: 'sakura', hidden: true, name: '復活の桜', desc: '苦手になったサクラの問題を、10語以上克服する', icon: '🔁', check: (c) => skCounter('overcame')(c) >= 10 },
    {
      id: 'sk_h_300',
      cat: 'sakura',
      hidden: true,
      name: '三百の花',
      get desc() {
        return `サクラモードの${KA.Sakura ? KA.Sakura.items().length : 300}語すべてに、一度以上出会う（正解でなくてもOK）`;
      },
      icon: '🌸🌸🌸',
      check: (c) => SK(c).total > 0 && SK(c).seen >= SK(c).total,
    },
    {
      id: 'sk_h_dango',
      cat: 'sakura',
      hidden: true,
      name: '花より団子',
      desc: 'サクラモードの給食・食事の問題を、すべて一度以上正解する',
      icon: '🍡',
      check: (c) => {
        const t = c.sakuraTag(['meals']);
        return t.total > 0 && t.correct >= t.total;
      },
    },
    { id: 'sk_h_namiki', cat: 'sakura', hidden: true, name: '桜並木', desc: 'サクラモードの全問チャレンジを、最後までやりきる', icon: '🛤️', check: (c) => !!skFlag('namiki')(c) }
  );
  const SAKURA_EMBLEM_REQUIRES = SAKURA_MAIN_GENRES.concat(['sk_master', 'sk_eternal', 'sk_fubuki']);

  const DEF_MAP = {};
  DEFS.forEach((d) => {
    DEF_MAP[d.id] = d;
  });

  /** 判定に使う情報をまとめる */
  function buildContext(profile, now) {
    now = now || Date.now();
    const P = KA.Proficiency;
    const DB = KA.KanjiDB;
    const cache = {};
    const gradeStat = (gid) => {
      if (!cache[gid]) {
        const list = DB.getKanjiList(gid);
        let seen = 0;
        let mastered = 0;
        list.forEach((e) => {
          const rec = profile.kanji[e.kanji];
          if (rec) seen++;
          if (rec && rec.mx) mastered++;
        });
        cache[gid] = { total: list.length, seen, mastered };
      }
      return cache[gid];
    };
    return {
      profile,
      now,
      stats: profile.stats,
      flags: profile.counters.flags,
      modesCleared: profile.counters.modesCleared,
      zukanViewed: profile.counters.zukanViewed.length,
      everMastered: P.everMasteredCount(profile),
      achievementCount: Object.keys(profile.achievements).length,
      todayRecord: profile.daily[U.dateKey(now)] || {},
      gradeTotal: (gid) => gradeStat(gid).total,
      gradeSeen: (gid) => gradeStat(gid).seen,
      gradeMastered: (gid) => gradeStat(gid).mastered,
      // 文の中・生活漢字
      itemsTotal: (ptype) => (KA.ReadingData ? KA.ReadingData.items(ptype).length : 0),
      itemsSeen: (ptype) => {
        const store = P.storeFor(profile, ptype);
        return KA.ReadingData ? KA.ReadingData.items(ptype).filter((it) => store[it.id]).length : 0;
      },
      itemCorrect: (ptype, id) => {
        const rec = P.storeFor(profile, ptype)[id];
        return rec ? rec.c || 0 : 0;
      },
      // サクラモード（records.sakura だけで判定）
      sakura: () => {
        if (!cache.__sakura) cache.__sakura = KA.Sakura ? KA.Sakura.status(profile, now) : { total: 0, seen: 0, correct: 0, mastered: 0, masteredNow: 0, weak: 0 };
        return cache.__sakura;
      },
      sakuraTag: (tags) => {
        const key = '__sakuraTag:' + tags.join(',');
        if (!cache[key]) cache[key] = KA.Sakura ? KA.Sakura.tagStatus(profile, tags) : { total: 0, correct: 0, mastered: 0 };
        return cache[key];
      },
      lifeCategoryTotal: () => (KA.ReadingData ? KA.ReadingData.lifeCategories().length : 0),
      lifeCategoriesCleared: () =>
        KA.ReadingData ? KA.ReadingData.lifeCategories().filter((cat) => (profile.stats.lifeCategoryCorrect || {})[cat.id] > 0).length : 0,
    };
  }

  /** レア度の表示名（色だけに頼らず文字でも示す） */
  const RARITY = {
    rare: { label: 'レア', icon: '✦' },
    super: { label: '超レア', icon: '✦✦' },
    legend: { label: '最高レア', icon: '👑' },
  };

  const Achievements = {
    CATEGORIES,
    DEFS,
    RARITY,
    SAKURA_GENRES,
    SAKURA_EMBLEM_REQUIRES,

    /** 装備したときの称号名 */
    titleOf(def) {
      return def ? def.title || def.name : null;
    },

    get(id) {
      return DEF_MAP[id] || null;
    },

    /** 取得できる（将来用を除いた）実績の数 */
    totalCount() {
      return DEFS.filter((d) => !d.future).length;
    },

    isUnlocked(profile, id) {
      return !!profile.achievements[id];
    },

    /**
     * 未取得の実績を判定し、新しく取得したものを返す
     * 称号数に関する実績があるため、変化がなくなるまで繰り返す
     */
    evaluate(profile, now) {
      now = now || Date.now();
      const unlocked = [];
      for (let round = 0; round < 3; round++) {
        const ctx = buildContext(profile, now);
        let changed = false;
        DEFS.forEach((def) => {
          if (def.future || profile.achievements[def.id]) return;
          let ok = false;
          try {
            ok = !!def.check(ctx);
          } catch (e) {
            console.warn('[Achievements] check failed:', def.id, e);
          }
          if (ok) {
            profile.achievements[def.id] = { at: now };
            unlocked.push(def);
            changed = true;
          }
        });
        if (!changed) break;
      }
      return unlocked;
    },

    /** 進捗 [現在, 目標]（無いものは null） */
    progress(profile, def, ctx) {
      if (!def.progress) return null;
      try {
        const [cur, max] = def.progress(ctx || buildContext(profile));
        return [Math.floor(cur), max];
      } catch (e) {
        return null;
      }
    },

    buildContext,
  };

  KA.Achievements = Achievements;
})(window.KanjiApp);
