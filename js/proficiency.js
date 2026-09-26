/*
 * 習熟度システム
 * ------------------------------------------------------------
 * 漢字 1 文字ごとに学習記録を持ち、そこから 5 段階の習熟度を計算します。
 *
 * 学習記録（profile.kanji[漢字]）:
 *   c  : 累計正解数
 *   w  : 累計不正解数
 *   s  : この漢字の連続正解数
 *   r  : 直近 10 回の結果（'1'=正解 '0'=不正解、右が新しい）
 *   f  : 初めて解いた日時
 *   t  : 最後に解いた日時
 *   lw : 最後に間違えた日時
 *   wk : 1 = 苦手と判定されたことがある（克服判定に使う）
 *   ov : 苦手を克服した日時
 *   mx : 初めてマスターになった日時
 *
 * 習熟度は保存せず、毎回この記録から計算します。
 * そのため「しばらく復習していないとマスターから下がる」ことが自然に表現できます。
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;

  /** 習熟度の段階（色だけに頼らず、記号と文字も併用） */
  const LEVELS = [
    { value: 0, label: '未学習', kidsLabel: 'まだ', stars: '☆☆☆☆', symbol: '・', className: 'lv0' },
    { value: 1, label: '練習中', kidsLabel: 'れんしゅう', stars: '★☆☆☆', symbol: '△', className: 'lv1' },
    { value: 2, label: 'もう少し', kidsLabel: 'もうすこし', stars: '★★☆☆', symbol: '◇', className: 'lv2' },
    { value: 3, label: 'だいたいOK', kidsLabel: 'だいたいOK', stars: '★★★☆', symbol: '○', className: 'lv3' },
    { value: 4, label: 'マスター', kidsLabel: 'マスター', stars: '★★★★', symbol: '◎', className: 'lv4' },
  ];

  /** 復習が必要になるまでの日数 */
  const REVIEW_AFTER_DAYS = { 3: 10, 4: 30 };
  /** この日数以上あくとマスターから 1 段階下がる */
  const MASTER_DECAY_DAYS = 30;
  /** この日数以上あくと、さらに下がる */
  const LONG_DECAY_DAYS = 90;

  function recentResults(rec, n) {
    const r = (rec && rec.r) || '';
    return r.slice(-n);
  }

  function recentAccuracy(rec, n) {
    const r = recentResults(rec, n);
    if (!r.length) return 0;
    let ok = 0;
    for (const ch of r) if (ch === '1') ok++;
    return ok / r.length;
  }

  const Proficiency = {
    LEVELS,

    getRecord(profile, kanji) {
      return profile.kanji[kanji] || null;
    },

    attempts(rec) {
      return rec ? (rec.c || 0) + (rec.w || 0) : 0;
    },

    /** 習熟度（0〜4） */
    level(rec, now) {
      if (!rec || Proficiency.attempts(rec) === 0) return 0;
      now = now || Date.now();
      const acc5 = recentAccuracy(rec, 5);
      const c = rec.c || 0;
      const s = rec.s || 0;
      let lv;
      if (c >= 4 && s >= 3 && acc5 >= 0.8) lv = 4;
      else if (c >= 2 && s >= 1 && acc5 >= 0.6) lv = 3;
      else if (s >= 1 || acc5 >= 0.4) lv = 2;
      else lv = 1;

      // 最後に間違えた漢字は「もう少し」まで
      if (s === 0) lv = Math.min(lv, 2);

      // しばらく解いていない漢字は段階を下げて復習候補へ
      const days = U.daysSince(rec.t, now);
      if (lv === 4 && days > MASTER_DECAY_DAYS) lv = 3;
      if (lv >= 3 && days > LONG_DECAY_DAYS) lv = 2;
      return lv;
    },

    levelInfo(value) {
      return LEVELS[U.clamp(value, 0, 4)];
    },

    /** 復習のタイミングが来ているか */
    isReviewDue(rec, now) {
      if (!rec || Proficiency.attempts(rec) === 0) return false;
      const lv = Proficiency.level(rec, now);
      const days = U.daysSince(rec.t, now);
      if (lv <= 2) return days >= 1;
      return days >= (REVIEW_AFTER_DAYS[lv] || 30);
    },

    /**
     * 苦手判定
     * 1 回間違えただけでは苦手にせず、
     * 「複数回間違えている」かつ「最近の正答率が低い」または「短期間に繰り返し間違えた」場合に苦手とする。
     */
    isWeak(rec, now) {
      if (!rec || (rec.w || 0) < 2) return false;
      if ((rec.s || 0) >= 3) return false; // 3 連続正解中なら立ち直り中
      now = now || Date.now();
      const acc5 = recentAccuracy(rec, 5);
      const recent = recentResults(rec, 5);
      const wrongRecent = recent.split('').filter((x) => x === '0').length;
      const recentlyWrong = U.daysSince(rec.lw, now) <= 14;
      return acc5 < 0.6 || (wrongRecent >= 2 && recentlyWrong);
    },

    /** 苦手の度合い（大きいほど苦手）。並べ替えに使う */
    weakScore(rec, now) {
      if (!rec) return 0;
      now = now || Date.now();
      const acc5 = recentAccuracy(rec, 5);
      const days = U.daysSince(rec.lw, now);
      return (rec.w || 0) * 2 + (1 - acc5) * 10 + (days < 3 ? 5 : days < 14 ? 2 : 0) - (rec.s || 0) * 2;
    },

    /**
     * 回答を記録する
     * @returns {object} 変化の情報（実績判定などに使う）
     */
    recordAnswer(profile, kanji, correct, now) {
      now = now || Date.now();
      let rec = profile.kanji[kanji];
      if (!rec) {
        rec = { c: 0, w: 0, s: 0, r: '', f: now, t: 0 };
        profile.kanji[kanji] = rec;
      }
      const beforeLevel = Proficiency.level(rec, now);
      const wasWeak = Proficiency.isWeak(rec, now) || rec.wk === 1;

      if (correct) {
        rec.c = (rec.c || 0) + 1;
        rec.s = (rec.s || 0) + 1;
      } else {
        rec.w = (rec.w || 0) + 1;
        rec.s = 0;
        rec.lw = now;
      }
      rec.r = ((rec.r || '') + (correct ? '1' : '0')).slice(-10);
      rec.t = now;

      const afterLevel = Proficiency.level(rec, now);
      const info = {
        kanji,
        correct,
        beforeLevel,
        afterLevel,
        becameWeak: false,
        overcame: false,
        firstMaster: false,
        effortComeback: false,
      };

      if (Proficiency.isWeak(rec, now) && rec.wk !== 1) {
        rec.wk = 1;
        info.becameWeak = true;
      }
      // 苦手だった漢字が「だいたいOK」以上 & 3 連続正解になったら克服
      if (wasWeak && rec.wk === 1 && afterLevel >= 3 && rec.s >= 3) {
        rec.wk = 0;
        rec.ov = now;
        info.overcame = true;
      }
      if (afterLevel === 4 && !rec.mx) {
        rec.mx = now;
        info.firstMaster = true;
      }
      // 何度も間違えた漢字（3回以上）を 3 連続正解
      if (correct && rec.w >= 3 && rec.s === 3) info.effortComeback = true;
      return info;
    },

    /** 漢字リストの習熟度の集計 */
    summarize(profile, entries, now) {
      now = now || Date.now();
      const counts = [0, 0, 0, 0, 0];
      let sum = 0;
      let seen = 0;
      entries.forEach((e) => {
        const lv = Proficiency.level(profile.kanji[e.kanji], now);
        counts[lv]++;
        sum += lv;
        if (profile.kanji[e.kanji]) seen++;
      });
      const total = entries.length;
      return {
        total,
        counts,
        seen,
        mastered: counts[4],
        // 習熟率: 全員がマスターで 100%
        rate: total ? Math.round((sum / (total * 4)) * 100) : 0,
      };
    },

    levelSummary(profile, levelId, now) {
      return Proficiency.summarize(profile, KA.KanjiDB.getKanjiList(levelId), now);
    },

    /** 全漢字のうち現在マスターの数 */
    masteredCount(profile, now) {
      now = now || Date.now();
      return Object.keys(profile.kanji).filter((k) => Proficiency.level(profile.kanji[k], now) === 4).length;
    },

    /** 一度でもマスターになった漢字の数 */
    everMasteredCount(profile) {
      return Object.keys(profile.kanji).filter((k) => profile.kanji[k].mx).length;
    },

    /** 苦手漢字の一覧（苦手な順） */
    weakList(profile, now) {
      now = now || Date.now();
      return Object.keys(profile.kanji)
        .filter((k) => KA.KanjiDB.get(k) && Proficiency.isWeak(profile.kanji[k], now))
        .sort((a, b) => Proficiency.weakScore(profile.kanji[b], now) - Proficiency.weakScore(profile.kanji[a], now));
    },

    /** 得意な漢字（習熟度・正解数が高い順） */
    strongList(profile, now) {
      now = now || Date.now();
      return Object.keys(profile.kanji)
        .filter((k) => KA.KanjiDB.get(k) && Proficiency.level(profile.kanji[k], now) >= 3)
        .sort((a, b) => {
          const ra = profile.kanji[a];
          const rb = profile.kanji[b];
          return Proficiency.level(rb, now) - Proficiency.level(ra, now) || (rb.c || 0) - (ra.c || 0);
        });
    },

    recentAccuracy,
  };

  KA.Proficiency = Proficiency;
})(window.KanjiApp);
