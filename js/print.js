/*
 * プリントメーカー（PrintEngine）
 * ------------------------------------------------------------
 * アプリの学習データ（習熟度・苦手判定・最近の間違い）を使って、紙のプリントを作ります。
 *   1. 対象の漢字を選ぶ（にがて優先 / 学年 / 自分で選ぶ / 今日まちがえた漢字）
 *   2. 問題を作る（読みを書く / 漢字を書く / 漢字練習）
 *   3. 答えを作る
 *
 * ・苦手の判定は Proficiency（アプリ本体と同じ判定）をそのまま使います。
 * ・プリントを作っても学習記録・習熟度・称号は一切変わりません（読み取りのみ）。
 * ・問題形式は FORMATS に追加できます（build(entry, ctx) → 問題 or null）。
 *   あいまいな問題（同じ読みの漢字が複数ある など）は作らず null を返し、別の漢字を使います。
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;
  const DB = KA.KanjiDB;
  const P = KA.Proficiency;

  /* ============================================================
   * 問題づくりに使う索引（初回だけ作る）
   * ============================================================ */
  let index = null;

  function buildIndex() {
    if (index) return index;
    const kunOwners = {}; // 訓読み（送り仮名込みの全体）→ その読みを持つ漢字
    DB.getAllKanji().forEach((e) => {
      e.kunyomi.forEach((r) => {
        const full = DB.kunFull(r);
        (kunOwners[full] = kunOwners[full] || new Set()).add(e.kanji);
      });
    });
    // 文の中の読みデータ: 漢字 → その漢字の読みが分かる文
    const sentencesByKanji = {};
    (KA.ReadingData ? KA.ReadingData.sentences() : []).forEach((item) => {
      item.segments.forEach((seg, i) => {
        if (!seg.reading) return;
        if (item.answerMode === 'segments' && seg.text.length === 1) {
          // 漢字1字の解答欄 → その字の読みが確定している
          (sentencesByKanji[seg.text] = sentencesByKanji[seg.text] || []).push({ item, segIndex: i, whole: false });
        } else if (item.answerMode === 'whole') {
          // 熟語・熟字訓 → 語全体の読み（1字ずつには分けない）
          Array.from(seg.text).forEach((ch) => {
            if (DB.get(ch)) (sentencesByKanji[ch] = sentencesByKanji[ch] || []).push({ item, segIndex: i, whole: true });
          });
        }
      });
    });
    index = { kunOwners, sentencesByKanji };
    return index;
  }

  function pick(list) {
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  /**
   * 熟語データから使える語を選ぶ（その漢字を1回だけ含む 2〜3字の語）
   * 熟語データは「やさしく一般的な語」が先に並んでいるので、その順番を優先し、
   * できるだけ同じ学年以下の漢字だけでできた語を使う。
   */
  function usableCompounds(entry) {
    const all = basicCompounds(entry);
    // 小学校は学年（1〜6）、中学校はアプリの目安（中1=7〜中3=9）で比べる
    const grade = entry.officialGrade || entry.difficulty;
    if (!grade) return all;
    const easy = all.filter((c) => Array.from(c.word).every((ch) => {
      const e = DB.get(ch);
      const g = e && (e.officialGrade || e.difficulty);
      return g && g <= grade;
    }));
    return easy.length ? easy : all;
  }

  /** 上位の候補から選ぶ（変化をつけつつ、むずかしい語を避ける） */
  function pickTop(list, n) {
    return pick(list.slice(0, n || 3));
  }

  function basicCompounds(entry) {
    return entry.compounds.filter((c) => {
      const chars = Array.from(c.word);
      return (
        chars.length >= 2 &&
        chars.length <= 3 &&
        chars.filter((ch) => ch === entry.kanji).length === 1 &&
        chars.every((ch) => /[一-鿿]/.test(ch)) &&
        /^[ぁ-ゖー]+$/.test(c.reading || '')
      );
    });
  }

  /** 送り仮名つきの訓読み（例: まな-ぶ）。読みが1つの漢字にしか無いものに限る（書き問題用） */
  function kunWords(entry, requireUnique) {
    const idx = buildIndex();
    return entry.kunyomi
      .map((r) => {
        const [stem, tail] = String(r).split('-');
        return { stem, tail: tail || '', full: stem + (tail || '') };
      })
      .filter((k) => k.stem && (!requireUnique || idx.kunOwners[k.full].size === 1));
  }

  /* ============================================================
   * 問題形式
   *   各問題: { kanji, format, kind, parts（表示用の部品）, answer, answerParts, key }
   * ============================================================ */
  const FORMATS = {
    /* ---------- ① 漢字の読みを書く ---------- */
    reading: {
      id: 'reading',
      label: '読みを書く',
      kids: 'よみを かく',
      icon: '👀',
      desc: '漢字を見て、読みをひらがなで書く',
      build(entry) {
        const idx = buildIndex();
        const k = entry.kanji;
        // 1. 文の中（読みが確定しているもの）
        const sen = pick((idx.sentencesByKanji[k] || []).filter((x) => !x.whole));
        if (sen) {
          const seg = sen.item.segments[sen.segIndex];
          return { kanji: k, format: 'reading', kind: 'sentence', item: sen.item, segIndex: sen.segIndex, answer: seg.reading, key: 'r:' + sen.item.id };
        }
        // 2. 送り仮名つきの語（学（　）ぶ → まな）
        const okuri = pick(kunWords(entry, false).filter((w) => w.tail));
        if (okuri) return { kanji: k, format: 'reading', kind: 'okuri', stem: okuri.stem, tail: okuri.tail, answer: okuri.stem, key: 'r:o:' + k + okuri.full };
        // 3. 熟語（学校（　　）→ がっこう）
        const comp = pickTop(usableCompounds(entry));
        if (comp) return { kanji: k, format: 'reading', kind: 'compound', word: comp.word, answer: comp.reading, key: 'r:c:' + comp.word };
        // 4. 熟語・熟字訓の文（今日（　　）→ きょう）
        const wholeSen = pick((idx.sentencesByKanji[k] || []).filter((x) => x.whole));
        if (wholeSen) return { kanji: k, format: 'reading', kind: 'sentence', item: wholeSen.item, segIndex: wholeSen.segIndex, answer: wholeSen.item.segments[wholeSen.segIndex].reading, key: 'r:' + wholeSen.item.id };
        // 5. 読みが1つしかない漢字だけ、1字で出す
        const all = entry.onyomi.map(U.kataToHira).concat(entry.kunyomi.map(DB.kunFull));
        if (U.unique(all).length === 1) return { kanji: k, format: 'reading', kind: 'single', answer: all[0], key: 'r:s:' + k };
        return null;
      },
    },

    /* ---------- ② 漢字を書く（答えが1つに決まる問題だけ） ---------- */
    writing: {
      id: 'writing',
      label: '漢字を書く',
      kids: 'かんじを かく',
      icon: '✏️',
      desc: '読みと文・熟語をヒントに漢字を書く',
      build(entry) {
        const idx = buildIndex();
        const k = entry.kanji;
        // 1. 文の中（前後の文があるので書く漢字が決まる）
        const sen = pick((idx.sentencesByKanji[k] || []).filter((x) => !x.whole));
        if (sen) return { kanji: k, format: 'writing', kind: 'sentence', item: sen.item, segIndex: sen.segIndex, answer: k, reading: sen.item.segments[sen.segIndex].reading, key: 'w:' + sen.item.id };
        // 2. 熟語のほかの字を見せる（□校（がっこう）→ 学）
        const comp = pickTop(usableCompounds(entry));
        if (comp) return { kanji: k, format: 'writing', kind: 'compound', word: comp.word, reading: comp.reading, answer: k, key: 'w:c:' + comp.word };
        // 3. その読みを持つ漢字が1つしかない訓読み（やま → 山、まな＋ぶ → 学）
        const kun = pick(kunWords(entry, true));
        if (kun) return { kanji: k, format: 'writing', kind: 'kun', stem: kun.stem, tail: kun.tail, reading: kun.full, answer: k, key: 'w:k:' + k + kun.full };
        return null; // あいまいになるので出題しない
      },
    },

    /* ---------- ③ 漢字練習（見本・なぞり・自分で書く） ---------- */
    practice: {
      id: 'practice',
      label: '漢字練習',
      kids: 'れんしゅう',
      icon: '🖌️',
      desc: '見本を見て、なぞって、自分で書く',
      noAnswers: true,
      build(entry) {
        const readings = entry.kunyomi.map(DB.formatKun).concat(entry.onyomi).slice(0, 3);
        const comp = usableCompounds(entry)[0];
        return { kanji: entry.kanji, format: 'practice', kind: 'practice', readings, example: comp ? comp.word : '', key: 'p:' + entry.kanji };
      },
    },

    // ---- 将来追加する形式（available: false の間は画面に出ません） ----
    sentence: { id: 'sentence', label: '文の中の読み', available: false },
    life: { id: 'life', label: '生活漢字', available: false },
    compound: { id: 'compound', label: '熟語', available: false },
    radical: { id: 'radical', label: '部首', available: false },
    okurigana: { id: 'okurigana', label: '送り仮名', available: false },
    strokeOrder: { id: 'strokeOrder', label: '書き順', available: false },
    mixed: { id: 'mixed', label: 'ミックス', available: false },
  };

  /* ============================================================
   * 対象の漢字を選ぶ
   * ============================================================ */

  /** 対象範囲の漢字データ */
  function scopeEntries(profile, scope) {
    if (scope === 'studied') {
      return Object.keys(profile.kanji)
        .map((k) => DB.get(k))
        .filter(Boolean);
    }
    const levelId = scope && scope !== 'current' ? scope : profile.level;
    return DB.getKanjiList(levelId).length ? DB.getKanjiList(levelId) : DB.getKanjiList('e1');
  }

  /**
   * にがて優先の並び
   * 返り値: [{ entry, group }]（group: weak / recent / low / due / good / unseen / other）
   *   mix  … 苦手 約70%・最近の間違い＋低習熟 約20%・できている漢字 約10%。足りない分は
   *           苦手 → 最近間違えた → 習熟度が低い → 復習時期 → 未学習 → その他 の順に補う
   *   only … 苦手判定されている漢字だけ
   */
  function weakOrder(profile, entries, mode, now) {
    now = now || Date.now();
    const rec = (e) => profile.kanji[e.kanji];
    const used = new Set();
    const take = (list, group) =>
      list
        .filter((e) => !used.has(e.kanji))
        .map((e) => {
          used.add(e.kanji);
          return { entry: e, group };
        });

    // 苦手（アプリ本体と同じ判定）。苦手度が高い順
    const weak = entries.filter((e) => P.isWeak(rec(e), now)).sort((a, b) => P.weakScore(rec(b), now) - P.weakScore(rec(a), now));
    if (mode === 'only') return { weak: take(weak, 'weak') };

    // 最近間違えた（今日の間違いがいちばん先頭に来る）
    const recent = entries
      .filter((e) => rec(e) && rec(e).lw && U.daysSince(rec(e).lw, now) <= 14 && (rec(e).s || 0) < 3)
      .sort((a, b) => rec(b).lw - rec(a).lw);
    // 習熟度が低い（練習中・もう少し）
    const low = U.shuffle(entries.filter((e) => rec(e) && P.level(rec(e), now) <= 2)).sort((a, b) => P.level(rec(a), now) - P.level(rec(b), now));
    const due = entries.filter((e) => rec(e) && P.isReviewDue(rec(e), now)).sort((a, b) => rec(a).t - rec(b).t);
    const good = U.shuffle(entries.filter((e) => rec(e) && P.level(rec(e), now) >= 3));
    const unseen = U.shuffle(entries.filter((e) => !rec(e)));
    const other = U.shuffle(entries);

    return {
      weak: take(weak, 'weak'),
      recent: take(recent, 'recent').concat(take(low, 'low')),
      good: take(good, 'good'),
      fill: take(due, 'due').concat(take(unseen, 'unseen'), take(other, 'other')),
    };
  }

  const PrintEngine = {
    FORMATS,

    availableFormats() {
      return Object.values(FORMATS).filter((f) => f.available !== false);
    },

    /** 問題を1つ作る（作れなければ null） */
    buildQuestion(entry, format) {
      const f = FORMATS[format];
      return f && f.build ? f.build(entry) : null;
    },

    /** その形式で問題が作れる漢字だけにしぼる */
    usable(entries, format) {
      return entries.filter((e) => PrintEngine.buildQuestion(e, format));
    },

    /**
     * 出題する漢字の候補を、優先順に並べて返す
     * @param {object} opts { source: 'weak' | 'grade' | 'custom' | 'session', mode: 'mix' | 'only',
     *                        scope: 'current' | 'studied' | levelId, levelId, kanji: [...] }
     * @returns {{ order: [{entry, group}], quota: {weak, recent, good} | null }}
     */
    candidates(profile, opts) {
      const now = Date.now();
      if (opts.source === 'custom' || opts.source === 'session') {
        const list = U.unique(opts.kanji || []).map((k) => DB.get(k)).filter(Boolean);
        // 今日まちがえた漢字: 苦手度の高い順。自分で選ぶ: 選んだ順
        if (opts.source === 'session') list.sort((a, b) => P.weakScore(profile.kanji[b.kanji], now) - P.weakScore(profile.kanji[a.kanji], now));
        return { order: list.map((entry) => ({ entry, group: opts.source })), quota: null };
      }
      if (opts.source === 'grade') {
        return { order: U.shuffle(DB.getKanjiList(opts.levelId)).map((entry) => ({ entry, group: 'grade' })), quota: null };
      }
      // にがて優先
      const groups = weakOrder(profile, scopeEntries(profile, opts.scope), opts.mode, now);
      if (opts.mode === 'only') return { order: groups.weak, quota: null };
      return { order: null, groups, quota: { weak: 0.7, recent: 0.2, good: 0.1 } };
    },

    /**
     * 問題を作る
     * @returns {{ questions: [...], available: number, breakdown: {weak, recent, good, ...} }}
     */
    generate(profile, opts, count) {
      const format = opts.format || 'reading';
      const c = PrintEngine.candidates(profile, opts);
      const keys = new Set();
      const chosenKanji = new Set();
      const questions = [];
      const breakdown = {};
      const usedWords = new Set();

      const addFrom = (list, limit) => {
        for (const x of list) {
          if (questions.length >= count || limit <= 0) break;
          if (chosenKanji.has(x.entry.kanji)) continue; // 1枚の中で同じ漢字をくり返さない
          // 同じ語・同じ文を2回使わない（別の語で作り直す。答えが見えてしまうのも防ぐ）
          let q = null;
          for (let tries = 0; tries < 6; tries++) {
            const cand = PrintEngine.buildQuestion(x.entry, format);
            if (cand && !keys.has(cand.key) && !(cand.word && usedWords.has(cand.word)) && !(cand.item && usedWords.has(cand.item.id))) {
              q = cand;
              break;
            }
          }
          if (!q) continue;
          if (q.word) usedWords.add(q.word);
          if (q.item) usedWords.add(q.item.id);
          q.group = x.group;
          questions.push(q);
          keys.add(q.key);
          chosenKanji.add(x.entry.kanji);
          breakdown[x.group] = (breakdown[x.group] || 0) + 1;
          limit--;
        }
      };

      if (c.quota) {
        // にがてを多めに: 目安の割合で取り、足りない分は優先順に補う
        const g = c.groups;
        const nWeak = Math.round(count * c.quota.weak);
        const nGood = count >= 5 ? Math.max(1, Math.round(count * c.quota.good)) : 0;
        const nRecent = Math.max(0, count - nWeak - nGood);
        addFrom(g.weak, nWeak);
        addFrom(g.recent, nRecent);
        addFrom(g.good, nGood);
        [g.weak, g.recent, g.fill, g.good].forEach((list) => addFrom(list, count));
      } else {
        addFrom(c.order, count);
      }

      // にがて優先は苦手がかたよらないように混ぜる（自分で選んだ順・今日の間違いはそのまま）
      const ordered = opts.source === 'custom' ? questions : U.shuffle(questions);
      return { questions: ordered, available: PrintEngine.countAvailable(profile, opts), breakdown };
    },

    /** 作れる問題数（問題数ボタンの調整用） */
    countAvailable(profile, opts) {
      const format = opts.format || 'reading';
      const c = PrintEngine.candidates(profile, opts);
      const list = c.quota ? c.groups.weak.concat(c.groups.recent, c.groups.good, c.groups.fill) : c.order;
      const seen = new Set();
      let n = 0;
      list.forEach((x) => {
        if (seen.has(x.entry.kanji)) return;
        seen.add(x.entry.kanji);
        if (PrintEngine.buildQuestion(x.entry, format)) n++;
      });
      return n;
    },

    /** 苦手の数など（設定画面の案内用） */
    weakStats(profile, scope) {
      const now = Date.now();
      const entries = scopeEntries(profile, scope);
      const g = weakOrder(profile, entries, 'mix', now);
      return { total: entries.length, weak: g.weak.length, recent: g.recent.filter((x) => x.group === 'recent').length };
    },

    /**
     * 学習結果から「まちがえた漢字」を取り出す
     * 一文字: その漢字 / 文の中: まちがえた解答欄の漢字 / 生活漢字: 語に含まれる漢字
     */
    kanjiFromResults(results) {
      const out = [];
      (results || []).forEach((r) => {
        if (r.correct) return;
        if (!r.ptype || r.ptype === 'single') {
          out.push(r.kanji);
          return;
        }
        const item = KA.ReadingData && KA.ReadingData.get(r.kanji);
        if (!item) return;
        let texts = [item.word];
        if (r.ptype === 'sentence' && item.blanks) {
          const wrong = Array.isArray(r.blanks) ? item.blanks.filter((b, i) => !r.blanks[i] || !r.blanks[i].correct) : item.blanks;
          texts = (wrong.length ? wrong : item.blanks).map((b) => b.text);
        }
        texts.forEach((t) => Array.from(t).forEach((ch) => DB.get(ch) && out.push(ch)));
      });
      return U.unique(out);
    },

    /** 今日まちがえた漢字（日ごとの記録から） */
    todayWrongKanji(profile) {
      const d = profile.daily[U.dateKey()];
      if (!d || !Array.isArray(d.wrong)) return [];
      return PrintEngine.kanjiFromResults(d.wrong.map((k) => {
        const item = KA.ReadingData && KA.ReadingData.get(k);
        return { kanji: k, correct: false, ptype: item ? item.ptype : 'single' };
      }));
    },

    /** 問題数ボタン（作れる数に合わせる）。large=大きめ は少なめの数 */
    sizeOptions(available, large) {
      const steps = large ? [5, 10, 15] : [10, 20, 30];
      const list = steps.filter((n) => n < available);
      if (available > 0) list.push(available <= steps[steps.length - 1] ? 'all' : steps[steps.length - 1]);
      return U.unique(list);
    },
  };

  KA.PrintEngine = PrintEngine;
})(window.KanjiApp);
