/*
 * 問題エンジン
 * ------------------------------------------------------------
 * ・出題の選び方（通常 / 今日の10問 / おまかせ復習 / 苦手復習）
 * ・問題形式の登録
 *     reading  … 一文字の読み（problemType: single。出題データは漢字データ）
 *     sentence … 文の中の読み（problemType: sentence。data/sentences.js）
 *     life     … 生活漢字（problemType: life。data/life-kanji.js）
 * ・答え合わせ
 *
 * 1 回の問題（セッション）の entries には、漢字データ（ptype なし＝single）と
 * 読み問題データ（ptype: 'sentence' | 'life'）を混ぜて入れられます（今日の10問など）。
 *
 * 問題形式を追加するときは QUESTION_TYPES に
 *   { id, label, available: true, build(entry, ctx), check(question, answer) }
 * を追加し、PTYPE_TO_QUESTION で問題タイプと結びつけます。
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
    sentence: {
      id: 'sentence',
      label: '文の中の読み',
      available: true,
      prompt: { kids: 'せんの ことばの よみは？', standard: '線のことばの読みを答えましょう' },
      build: buildWordQuestion,
      check: checkWordQuestion,
    },
    life: {
      id: 'life',
      label: '生活漢字',
      available: true,
      prompt: { kids: 'なんと よむ？', standard: 'なんと読む？' },
      build: buildWordQuestion,
      check: checkWordQuestion,
    },
    // ---- 以下は将来追加する形式（available: false の間は画面に出ません） ----
    compound: { id: 'compound', label: '熟語の読み', available: false },
    radical: { id: 'radical', label: '部首', available: false },
    okurigana: { id: 'okurigana', label: '送り仮名', available: false },
    fillblank: { id: 'fillblank', label: '例文穴埋め', available: false },
    meaning: { id: 'meaning', label: '意味（生活漢字）', available: false },
    writing: { id: 'writing', label: '書き取り', available: false },
  };

  /** 問題タイプ → 問題形式 */
  const PTYPE_TO_QUESTION = { single: 'reading', sentence: 'sentence', life: 'life' };

  /** 出題データの問題タイプ（漢字データは single） */
  function ptypeOf(entry) {
    return (entry && entry.ptype) || 'single';
  }

  /** 学習記録のキー（漢字データは漢字、読み問題データは id） */
  function keyOf(entry) {
    return entry.ptype ? entry.id : entry.kanji;
  }

  function recOf(profile, entry) {
    return P.storeFor(profile, ptypeOf(entry))[keyOf(entry)];
  }

  /* ---------- 文の中の読み・生活漢字 ---------- */
  function buildWordQuestion(item, ctx) {
    const accepted = item.readings.map((r) => ({ reading: U.kataToHira(r), type: item.ptype }));
    const q = { type: item.ptype, kanji: item.id, word: item.word, entry: item, accepted };
    if (ctx && ctx.withChoices) Object.assign(q, buildWordChoices(item, accepted));
    return q;
  }

  function checkWordQuestion(question, answer) {
    const norm = normalizeKanaAnswer(answer);
    const hit = question.accepted.find((r) => r.reading === norm);
    return { correct: !!hit, matched: hit || null, normalized: norm };
  }

  /** 4択: 同じ種類の問題の読みから、文字数の近いものを選ぶ */
  function buildWordChoices(item, accepted) {
    const acceptedSet = new Set(accepted.map((r) => r.reading));
    const answer = U.kataToHira(item.reading);
    const pool = KA.ReadingData.items(item.ptype).length > 8 ? KA.ReadingData.items(item.ptype) : KA.ReadingData.items('sentence').concat(KA.ReadingData.items('life'));
    const candidates = U.unique(
      U.shuffle(pool)
        .filter((it) => it.id !== item.id)
        .map((it) => U.kataToHira(it.reading))
        .filter((r) => !acceptedSet.has(r))
    );
    candidates.sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
    const distractors = U.shuffle(candidates.slice(0, 6)).slice(0, 3);
    return { choices: U.shuffle([answer].concat(distractors)), choiceAnswer: answer };
  }

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

  /** 最近出た問題を少し後回しにしつつランダムに並べる（偏り防止） */
  function spreadShuffle(entries, profile, now) {
    return entries
      .map((e) => {
        const rec = recOf(profile, e);
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
      const key = ptypeOf(e) + ':' + keyOf(e);
      if (!used.has(key)) {
        out.push(e);
        used.add(key);
      }
    }
    return out;
  }

  /** 直前に出たばかりの問題は、優先リストからはずす（短期間の繰り返し防止） */
  const RECENT_BLOCK_MINUTES = 30;

  /**
   * 優先順位つきで選ぶ（今日の10問用。どの問題タイプにも使える）
   * 最近間違えた → 苦手 → 習熟度が低い → しばらく出ていない → 未学習 → ランダム
   */
  function pickPrioritized(profile, pool, count, now, used) {
    const rec = (e) => recOf(profile, e);
    const fresh = pool.filter((e) => !rec(e) || !rec(e).t || (now - rec(e).t) / 60000 > RECENT_BLOCK_MINUTES);
    const recentWrong = fresh
      .filter((e) => rec(e) && rec(e).lw && U.daysSince(rec(e).lw, now) <= 7 && (rec(e).s || 0) < 2)
      .sort((a, b) => rec(b).lw - rec(a).lw);
    const weak = fresh.filter((e) => rec(e) && P.isWeak(rec(e), now)).sort((a, b) => P.weakScore(rec(b), now) - P.weakScore(rec(a), now));
    const lowLevel = U.shuffle(fresh.filter((e) => rec(e) && P.level(rec(e), now) <= 2)).sort((a, b) => P.level(rec(a), now) - P.level(rec(b), now));
    const stale = fresh.filter((e) => rec(e) && P.isReviewDue(rec(e), now)).sort((a, b) => rec(a).t - rec(b).t);
    const unseen = U.shuffle(pool.filter((e) => !rec(e)));

    // 目安の配分（count=10 のとき: 間違い3・苦手/低習熟3・復習2・未学習2）
    const quota = (r) => Math.max(1, Math.round(count * r));
    let picked = [];
    picked = picked.concat(takeFrom(recentWrong, quota(0.3), used));
    picked = picked.concat(takeFrom(weak.concat(lowLevel), quota(0.3), used));
    picked = picked.concat(takeFrom(stale, quota(0.2), used));
    picked = picked.concat(takeFrom(unseen, quota(0.2), used));
    picked = picked.slice(0, count);
    // 足りない分は、未学習 → 低習熟 → 復習候補 → ランダム の順に補う
    [unseen, lowLevel, stale, recentWrong, spreadShuffle(pool, profile, now)].forEach((list) => {
      if (picked.length < count) picked = picked.concat(takeFrom(list, count - picked.length, used));
    });
    return picked.slice(0, count);
  }

  /**
   * 今日の10問の問題タイプ配分
   * 基本は 一文字4・文の中3・生活漢字3。
   * 各タイプを20問以上解いていれば、正答率がいちばん低いタイプを1問ふやし、いちばん高いタイプを1問へらす。
   * （苦手傾向に合わせた配分は、ここを変えるだけで調整できます）
   */
  function todayMix(profile, count) {
    count = count || 10;
    const base = { single: 0.4, sentence: 0.3, life: 0.3 };
    const types = Object.keys(base).filter((t) => t === 'single' || KA.ReadingData.items(t).length);
    const mix = {};
    let total = 0;
    types.forEach((t) => {
      mix[t] = Math.round(count * base[t]);
      total += mix[t];
    });
    mix[types[0]] += count - total;
    const ts = profile.stats.typeStats || {};
    const acc = types.map((t) => ({ t, q: (ts[t] && ts[t].q) || 0, rate: ts[t] && ts[t].q ? ts[t].c / ts[t].q : 1 }));
    if (types.length > 1 && acc.every((a) => a.q >= 20)) {
      acc.sort((a, b) => a.rate - b.rate);
      const low = acc[0].t;
      const high = acc[acc.length - 1].t;
      if (low !== high && mix[high] > 2) {
        mix[low]++;
        mix[high]--;
      }
    }
    return mix;
  }

  const Selection = {
    /** 一文字の読み: 学年から size 問（'all' で全漢字） */
    normal(profile, levelId, size) {
      const now = Date.now();
      const list = spreadShuffle(DB.getKanjiList(levelId), profile, now);
      return size === 'all' ? list : list.slice(0, size);
    },

    /**
     * 文の中の読み・生活漢字: 登録データから size 問（'all' で全問）。1回の中で同じ問題は出さない
     * opts.categories: 生活漢字の場面の配列（null = すべて）。opts.category（1つ）も受け付ける
     */
    words(profile, ptype, size, opts) {
      const now = Date.now();
      let pool = KA.ReadingData.items(ptype);
      if (ptype === 'life' && opts) {
        const cats = opts.categories || (opts.category ? [opts.category] : null);
        if (cats && cats.length) pool = KA.ReadingData.lifeIn(cats);
      }
      if (size === 'all' || !(size > 0)) size = pool.length;
      // 未学習・低習熟を少し優先しつつ、最近出た問題は後回し
      const scored = spreadShuffle(pool, profile, now).map((e, i) => {
        const rec = recOf(profile, e);
        const bonus = !rec ? 3 : P.level(rec, now) <= 2 ? 2 : 0;
        return { e, score: i - bonus * 2 };
      });
      return scored
        .sort((a, b) => a.score - b.score)
        .slice(0, size)
        .map((x) => x.e);
    },

    /**
     * 今日の10問（一文字・文の中・生活漢字をまぜる）
     * 一文字はプロフィールの学習レベルの漢字から、ほかは全データから選ぶ。
     */
    today(profile, count) {
      count = count || 10;
      const now = Date.now();
      const used = new Set();
      const mix = todayMix(profile, count);
      const pools = {
        single: DB.getKanjiList(profile.level).length ? DB.getKanjiList(profile.level) : DB.getKanjiList('e1'),
        sentence: KA.ReadingData.items('sentence'),
        life: KA.ReadingData.items('life'),
      };
      let picked = [];
      Object.keys(mix).forEach((t) => {
        picked = picked.concat(pickPrioritized(profile, pools[t], mix[t], now, used));
      });
      // データ不足などで足りない場合は一文字で補う
      if (picked.length < count) picked = picked.concat(pickPrioritized(profile, pools.single, count - picked.length, now, used));
      return U.shuffle(picked.slice(0, count));
    },

    /**
     * おまかせ復習: 問題タイプ・学年をまたいで、苦手・最近の間違い・習熟度の低い問題を優先
     */
    review(profile, count) {
      count = count || 10;
      const now = Date.now();
      const used = new Set();
      const studied = Object.keys(profile.kanji)
        .map((k) => DB.get(k))
        .concat(['sentence', 'life'].reduce((all, t) => all.concat(Object.keys(P.storeFor(profile, t)).map((id) => KA.ReadingData.get(id))), []))
        .filter(Boolean);
      const rec = (e) => recOf(profile, e);
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

    /** 苦手漢字だけ（一文字の読み） */
    weak(profile, count) {
      const list = P.weakList(profile).map((k) => DB.get(k)).filter(Boolean);
      return U.shuffle(count ? list.slice(0, count) : list);
    },

    /** 文の中・生活漢字の苦手だけ */
    weakItems(profile, ptype, count) {
      const list = P.weakItems(profile, ptype).map((id) => KA.ReadingData.get(id)).filter(Boolean);
      return U.shuffle(count ? list.slice(0, count) : list);
    },

    /** 指定した問題（まちがい直し・苦手一覧から直接復習など）。キーは漢字または問題ID */
    fixed(keys) {
      const used = new Set();
      return U.shuffle(takeFrom(keys.map((k) => DB.get(k) || KA.ReadingData.get(k)).filter(Boolean), keys.length, used));
    },
  };

  /* ============================================================
   * セッション（1 回の問題）
   * ============================================================ */
  const Quiz = {
    QUESTION_TYPES,
    PTYPE_TO_QUESTION,
    Selection,
    normalizeKanaAnswer,
    todayMix,
    ptypeOf,
    keyOf,

    availableTypes() {
      return Object.values(QUESTION_TYPES).filter((t) => t.available);
    },

    /**
     * @param {object} opts { mode, levelId, size, entries, problemType }
     *   problemType: single / sentence / life / mixed（省略時は entries から判定）
     */
    createSession(opts) {
      const entries = (opts.entries || []).filter(Boolean);
      const types = U.unique(entries.map(ptypeOf));
      const problemType = opts.problemType || (types.length === 1 ? types[0] : 'mixed');
      return {
        mode: opts.mode || 'normal',
        problemType,
        // 生活漢字の場面（null = すべて）。履歴・もう一度に使う
        lifeCategories: problemType === 'life' && opts.categories && opts.categories.length ? opts.categories.slice() : null,
        levelId: opts.levelId || 'mixed',
        size: opts.size || entries.length,
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

    /** 現在の問題を作る（4択の選択肢も含めて 1 問ごとに作る） */
    currentQuestion(session) {
      const entry = session.entries[session.index];
      if (!entry) return null;
      if (!session.current || session.current._index !== session.index) {
        const type = QUESTION_TYPES[PTYPE_TO_QUESTION[ptypeOf(entry)]];
        session.current = type.build(entry, { withChoices: true, pool: session.pool });
        session.current.ptype = ptypeOf(entry);
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
