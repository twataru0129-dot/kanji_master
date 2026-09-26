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
    threshold('first_clear', 'beginner', '初クイズクリア', 'クイズを最後までやりきる', '🏁', s('totalSessions'), 1, '回'),
    threshold('today_first', 'beginner', '今日の挑戦者', '「今日の10問」をクリアする', '📅', s('todaySessions'), 1, '回'),
    threshold('review_first', 'beginner', '復習デビュー', '「おまかせ復習」をクリアする', '🔁', s('reviewSessions'), 1, '回'),
    { id: 'zukan_open', cat: 'beginner', name: '図鑑デビュー', desc: '漢字図鑑で漢字をしらべる', icon: '📖', check: (c) => c.zukanViewed >= 1 },
    { id: 'equip', cat: 'beginner', name: 'おしゃれさん', desc: '称号を装備する', icon: '🎀', check: (c) => !!c.flags.equipped },
    { id: 'backup', cat: 'beginner', name: 'そなえあれば', desc: '学習データを書き出す（バックアップ）', icon: '💾', check: (c) => !!c.flags.backup },
    { id: 'first_perfect', cat: 'beginner', name: 'はじめての満点', desc: 'クイズで満点をとる', icon: '💮', check: (c) => (c.stats.perfect.total || 0) >= 1 },

    /* ---------- 挑戦回数 ---------- */
    threshold('sess_3', 'challenge', 'チャレンジャー', 'クイズを3回クリア', '🎯', s('totalSessions'), 3, '回'),
    threshold('sess_10', 'challenge', '10回挑戦', 'クイズを10回クリア', '🥉', s('totalSessions'), 10, '回'),
    threshold('sess_30', 'challenge', '30回挑戦', 'クイズを30回クリア', '🥈', s('totalSessions'), 30, '回'),
    threshold('sess_50', 'challenge', 'がんばりの星', 'クイズを50回クリア', '🌟', s('totalSessions'), 50, '回'),
    threshold('sess_100', 'challenge', '100回挑戦', 'クイズを100回クリア', '🥇', s('totalSessions'), 100, '回'),
    threshold('sess_300', 'challenge', '不屈の挑戦者', 'クイズを300回クリア', '🏔️', s('totalSessions'), 300, '回'),
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
    { id: 'morning', cat: 'style', name: '朝の漢字マスター', desc: '朝5時〜8時にクイズをクリア', icon: '🌄', check: (c) => !!c.flags.morning },
    { id: 'evening', cat: 'style', name: '夜の学習家', desc: '夜8時〜10時にクイズをクリア', icon: '🌙', check: (c) => !!c.flags.evening },
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
    { id: 'h_leap', cat: 'hidden', hidden: true, name: '大躍進', desc: '歴代最高の連続正解を、1回のクイズで10以上更新', icon: '🦘', check: (c) => !!c.flags.leap },
    { id: 'h_comeback', cat: 'hidden', hidden: true, name: '逆転の達人', desc: '最初の3問を間違えたあと、残り（7問以上）を全部正解', icon: '🔃', check: (c) => !!c.flags.comeback },
    { id: 'h_night', cat: 'hidden', hidden: true, name: '夜ふかし漢字', desc: '夜10時〜朝4時に学習する', icon: '🦉', check: (c) => !!c.flags.night },
    { id: 'h_newyear', cat: 'hidden', hidden: true, name: '書き初め', desc: '1月1日に学習する', icon: '🎍', check: (c) => !!c.flags.newyear },
    { id: 'h_kanjiday', cat: 'hidden', hidden: true, name: '漢字の日', desc: '12月12日（漢字の日）に学習する', icon: '🈴', check: (c) => !!c.flags.kanjiday },
    { id: 'h_speed', cat: 'hidden', hidden: true, name: '電光石火', desc: '10問以上のクイズを1問平均6秒以内・全問正解', icon: '⚡', check: (c) => !!c.flags.speed },
    { id: 'h_allmodes', cat: 'hidden', hidden: true, name: '全部のせ', desc: '10問・20問・30問・全問のすべてをクリア', icon: '🍱', check: (c) => ['10', '20', '30', 'all'].every((m) => c.modesCleared[m]) },
    { id: 'h_busy', cat: 'hidden', hidden: true, name: 'がんばり屋', desc: '1日にクイズを5回クリア', icon: '🐝', check: (c) => (c.todayRecord.sessions || 0) >= 5 },
    { id: 'h_never_give_up', cat: 'hidden', hidden: true, name: '七転び八起き', desc: '1回のクイズで8問以上間違えても最後までやりきる', icon: '🎎', check: (c) => !!c.flags.neverGiveUp },
    { id: 'h_marathon', cat: 'hidden', hidden: true, name: 'マラソンランナー', desc: '1日に100問以上答える', icon: '🏃', check: (c) => (c.todayRecord.q || 0) >= 100 },

    /* ---------- これから登場（将来の機能） ---------- */
    { id: 'f_radical', cat: 'future', future: true, name: '部首博士', desc: '部首クイズで活躍する（近日登場）', icon: '🧩', check: () => false },
    { id: 'f_compound', cat: 'future', future: true, name: '熟語博士', desc: '熟語クイズで活躍する（近日登場）', icon: '🔗', check: () => false },
    { id: 'f_okurigana', cat: 'future', future: true, name: '送り仮名名人', desc: '送り仮名クイズで活躍する（近日登場）', icon: '🖋️', check: () => false },
    { id: 'f_rare', cat: 'future', future: true, name: '難読漢字ハンター', desc: '難読漢字に挑戦する（近日登場）', icon: '🐉', check: () => false },
    { id: 'f_stroke', cat: 'future', future: true, name: '書き順名人', desc: '書き順を覚える（近日登場）', icon: '🖌️', check: () => false },
    { id: 'f_write', cat: 'future', future: true, name: '書き取り名人', desc: '書き取り問題で活躍する（近日登場）', icon: '📝', check: () => false }
  );

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
    };
  }

  const Achievements = {
    CATEGORIES,
    DEFS,

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
