/*
 * メダル
 * ------------------------------------------------------------
 * 称号とは別に、成長の段階を表すメダル。
 * 総正解数とマスターした漢字数（一度でもマスターになった数）の両方で判定します。
 */
(function (KA) {
  'use strict';

  const TIERS = [
    { id: 'bronze', name: 'ブロンズ', icon: '🥉', color: '#c7824a', correct: 50, mastered: 0 },
    { id: 'silver', name: 'シルバー', icon: '🥈', color: '#9ea7b3', correct: 300, mastered: 20 },
    { id: 'gold', name: 'ゴールド', icon: '🥇', color: '#e0b020', correct: 1000, mastered: 100 },
    { id: 'platinum', name: 'プラチナ', icon: '🎖️', color: '#7fb8c9', correct: 3000, mastered: 300 },
    { id: 'diamond', name: 'ダイヤ', icon: '💎', color: '#4aa3ff', correct: 6000, mastered: 600 },
    { id: 'rainbow', name: 'レインボー', icon: '🌈', color: 'rainbow', correct: 10000, mastered: 900 },
  ];

  const Medals = {
    TIERS,

    get(id) {
      return TIERS.find((t) => t.id === id) || null;
    },

    values(profile) {
      return {
        correct: profile.stats.totalCorrect || 0,
        mastered: KA.Proficiency.everMasteredCount(profile),
      };
    },

    isEarnedBy(tier, v) {
      return v.correct >= tier.correct && v.mastered >= tier.mastered;
    },

    /** 新しく獲得したメダルを記録して返す */
    evaluate(profile, now) {
      now = now || Date.now();
      const v = Medals.values(profile);
      const earned = [];
      TIERS.forEach((tier) => {
        if (!profile.medals[tier.id] && Medals.isEarnedBy(tier, v)) {
          profile.medals[tier.id] = { at: now };
          earned.push(tier);
        }
      });
      return earned;
    },

    /** いちばん上のメダル */
    current(profile) {
      let best = null;
      TIERS.forEach((t) => {
        if (profile.medals[t.id]) best = t;
      });
      return best;
    },

    /** 次のメダルと、そこまでの進み具合 */
    next(profile) {
      const v = Medals.values(profile);
      const tier = TIERS.find((t) => !profile.medals[t.id]);
      if (!tier) return null;
      const parts = [Math.min(1, v.correct / tier.correct)];
      if (tier.mastered > 0) parts.push(Math.min(1, v.mastered / tier.mastered));
      return {
        tier,
        correct: v.correct,
        mastered: v.mastered,
        needCorrect: Math.max(0, tier.correct - v.correct),
        needMastered: Math.max(0, tier.mastered - v.mastered),
        ratio: Math.min.apply(null, parts),
      };
    },
  };

  KA.Medals = Medals;
})(window.KanjiApp);
