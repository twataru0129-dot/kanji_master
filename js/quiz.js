/*
 * クイズエンジン
 * ------------------------------------------------------------
 * ・出題する漢字の選び方（通常 / 今日の10問 / おまかせ復習 / 苦手復習）
 * ・問題形式の登録（v1.0 は「読み」。熟語・部首・送り仮名などを後から追加できる）
 * ・答え合わせ
 *
 * 問題形式を追加するときは QUESTION_TYPES に
 *   { id, label, available: true, build(entry, ctx), check(question, answer) }
 * を追加します。画面側は question.type を見て表示を切り替えます。
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;
  const DB = KA.KanjiDB;
  const P = KA.Proficiency;

  /* ============================================================
   * 問題形式
   * ============================================================ */
  const QUESTION_TYPES = {
    reading: {
      id: 'reading',
      label: '読み',
      available: true,
      prompt: { kids: 'この かんじ の よみ は？', standard: 'この漢字の読みを答えましょう' },
      build(entry, ctx) {
        const accepted = DB.acceptedReadings(entry);
        const q = { type: 'reading', kanji: entry.kanji, entry, accepted };
        if (ctx && ctx.withChoices) Object.assign(q, buildReadingChoices(entry, accepted, ctx.pool));
        return q;
      },
      check(question, answer) {
        const norm = normalizeKanaAnswer(answer);
        const hit = question.accepted.find((r) => r.reading === norm);
        return { correct: !!hit, matched: hit || null, normalized: norm };
      },
    },
    // ---- 以下は将来追加する形式（available: false の間は画面に出ません） ----
    compound: { id: 'compound', label: '熟語の読み', available: false },
    radical: { id: 'radical', label: '部首', available: false },
    okurigana: { id: 'okurigana', label: '送り仮名', available: false },
    sentence: { id: 'sentence', label: '例文穴埋め', available: false },
    writing: { id: 'writing', label: '書き取り', available: false },
  };

  /** ひらがな・カタカナ・ローマ字のどれで入力されても比較できる形にする */
  function normalizeKanaAnswer(answer) {
    let s = U.normalizeAnswer(answer);
    if (KA.Romaji.hasLatin(s)) s = KA.Romaji.toHiragana(s, true);
    return s.replace(/[・\-‐ー]$/, '');
  }

  /** 4択の選択肢を作る */
  function buildReadingChoices(entry, accepted, pool) {
    const acceptedSet = new Set(accepted.map((r) => r.reading));
    const primary = DB.primaryReadings(entry);
    // 子ども向けには訓読み（意味が分かりやすい）を少し優先
    const kun = primary.filter((r) => r.type === 'kun');
    const answer = kun.length && Math.random() < 0.6 ? U.shuffle(kun)[0] : U.shuffle(primary)[0];

    const candidates = [];
    const source = (pool && pool.length > 8 ? pool : DB.getAllKanji()).filter((e) => e.kanji !== entry.kanji);
    U.shuffle(source).some((e) => {
      const rs = DB.primaryReadings(e).filter((r) => r.type === answer.type);
      const pick = rs.length ? U.shuffle(rs)[0] : null;
      if (pick && !acceptedSet.has(pick.reading) && !candidates.includes(pick.reading)) {
        candidates.push(pick.reading);
      }
      return candidates.length >= 12;
    });
    // 文字数が近いものを優先して 3 つ
    candidates.sort((a, b) => Math.abs(a.length - answer.reading.length) - Math.abs(b.length - answer.reading.length));
    const distractors = U.shuffle(candidates.slice(0, 6)).slice(0, 3);
    const choices = U.shuffle([answer.reading].concat(distractors));
    return { choices, choiceAnswer: answer.reading };
  }

  /* ============================================================
   * 出題の選び方
   * ============================================================ */

  /** 最近出た漢字を少し後回しにしつつランダムに並べる（偏り防止） */
  function spreadShuffle(entries, profile, now) {
    return entries
      .map((e) => {
        const rec = profile.kanji[e.kanji];
        const hours = rec && rec.t ? (now - rec.t) / 3600000 : Infinity;
        const penalty = hours < 1 ? 0.7 : hours < 12 ? 0.35 : 0;
        return { e, score: Math.random() + penalty };
      })
      .sort((a, b) => a.score - b.score)
      .map((x) => x.e);
  }

  function takeFrom(list, n, used) {
    const out = [];
    for (const e of list) {
      if (out.length >= n) break;
      if (!used.has(e.kanji)) {
        out.push(e);
        used.add(e.kanji);
      }
    }
    return out;
  }

  const Selection = {
    /** 通常クイズ: 学年から size 問（'all' で全漢字） */
    normal(profile, levelId, size) {
      const now = Date.now();
      const list = spreadShuffle(DB.getKanjiList(levelId), profile, now);
      return size === 'all' ? list : list.slice(0, size);
    },

    /**
     * 今日の10問
     * 最近間違えた漢字・習熟度が低い漢字・しばらく出ていない漢字・未学習の漢字を組み合わせる
     */
    today(profile, count) {
      count = count || 10;
      const now = Date.now();
      const pool = DB.getKanjiList(profile.level).length ? DB.getKanjiList(profile.level) : DB.getKanjiList('e1');
      const rec = (e) => profile.kanji[e.kanji];
      const used = new Set();

      const recentWrong = pool
        .filter((e) => rec(e) && rec(e).lw && U.daysSince(rec(e).lw, now) <= 7 && (rec(e).s || 0) < 2)
        .sort((a, b) => rec(b).lw - rec(a).lw);
      const lowLevel = U.shuffle(pool.filter((e) => rec(e) && P.level(rec(e), now) <= 2)).sort(
        (a, b) => P.level(rec(a), now) - P.level(rec(b), now)
      );
      const stale = pool
        .filter((e) => rec(e) && P.isReviewDue(rec(e), now))
        .sort((a, b) => rec(a).t - rec(b).t);
      const unseen = U.shuffle(pool.filter((e) => !rec(e)));

      let picked = [];
      picked = picked.concat(takeFrom(recentWrong, 3, used));
      picked = picked.concat(takeFrom(lowLevel, 3, used));
      picked = picked.concat(takeFrom(stale, 2, used));
      picked = picked.concat(takeFrom(unseen, 2, used));
      // 足りない分は、未学習 → 低習熟 → 復習候補 → ランダム の順に補う
      [unseen, lowLevel, stale, recentWrong, spreadShuffle(pool, profile, now)].forEach((list) => {
        if (picked.length < count) picked = picked.concat(takeFrom(list, count - picked.length, used));
      });
      return U.shuffle(picked.slice(0, count));
    },

    /**
     * おまかせ復習: 学年をまたいで、苦手・最近の間違い・習熟度の低い漢字を優先
     */
    review(profile, count) {
      count = count || 10;
      const now = Date.now();
      const used = new Set();
      const studied = Object.keys(profile.kanji)
        .map((k) => DB.get(k))
        .filter(Boolean);
      const rec = (e) => profile.kanji[e.kanji];
      const weak = studied.filter((e) => P.isWeak(rec(e), now)).sort((a, b) => P.weakScore(rec(b), now) - P.weakScore(rec(a), now));
      const recentWrong = studied
        .filter((e) => rec(e).lw && U.daysSince(rec(e).lw, now) <= 14)
        .sort((a, b) => rec(b).lw - rec(a).lw);
      const low = U.shuffle(studied.filter((e) => P.level(rec(e), now) <= 2)).sort(
        (a, b) => P.level(rec(a), now) - P.level(rec(b), now)
      );
      const due = studied.filter((e) => P.isReviewDue(rec(e), now)).sort((a, b) => rec(a).t - rec(b).t);
      let picked = [];
      [weak, recentWrong, low, due].forEach((list) => {
        if (picked.length < count) picked = picked.concat(takeFrom(list, count - picked.length, used));
      });
      return U.shuffle(picked);
    },

    /** 苦手漢字だけ */
    weak(profile, count) {
      const list = P.weakList(profile).map((k) => DB.get(k)).filter(Boolean);
      return U.shuffle(count ? list.slice(0, count) : list);
    },

    /** 指定した漢字（まちがい直し・苦手一覧から直接復習など） */
    fixed(kanjiList) {
      return U.shuffle(kanjiList.map((k) => DB.get(k)).filter(Boolean));
    },
  };

  /* ============================================================
   * セッション（1 回のクイズ）
   * ============================================================ */
  const Quiz = {
    QUESTION_TYPES,
    Selection,
    normalizeKanaAnswer,

    availableTypes() {
      return Object.values(QUESTION_TYPES).filter((t) => t.available);
    },

    /**
     * @param {object} opts { mode, levelId, size, entries, questionType }
     */
    createSession(opts) {
      const type = QUESTION_TYPES[opts.questionType || 'reading'];
      const entries = (opts.entries || []).filter(Boolean);
      return {
        mode: opts.mode || 'normal',
        levelId: opts.levelId || 'mixed',
        size: opts.size || entries.length,
        questionType: type.id,
        entries,
        pool: opts.levelId && DB.isAvailable(opts.levelId) ? DB.getKanjiList(opts.levelId) : null,
        index: 0,
        results: [],
        streak: 0,
        maxStreak: 0,
        startedAt: Date.now(),
        finishedAt: null,
        completed: false,
        current: null,
      };
    },

    /** 現在の問題を作る（4択の選択肢も含めて毎回作る） */
    currentQuestion(session) {
      const entry = session.entries[session.index];
      if (!entry) return null;
      if (!session.current || session.current.kanji !== entry.kanji || session.current._index !== session.index) {
        const type = QUESTION_TYPES[session.questionType];
        session.current = type.build(entry, { withChoices: true, pool: session.pool });
        session.current._index = session.index;
      }
      return session.current;
    },

    check(session, answer) {
      const q = Quiz.currentQuestion(session);
      return QUESTION_TYPES[q.type].check(q, answer);
    },

    isFinished(session) {
      return session.index >= session.entries.length;
    },
  };

  KA.Quiz = Quiz;
})(window.KanjiApp);
