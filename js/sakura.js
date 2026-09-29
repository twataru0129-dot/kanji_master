/*
 * サクラモード（学校専用の特別モード）の進み具合の計算
 * ------------------------------------------------------------
 * 学習記録は profile.records.sakura[問題ID]（形式は生活漢字と同じ。proficiency.js 参照）。
 * 通常の生活漢字の記録（records.life）は使わないので、生活漢字で正解してもサクラの進み具合は変わりません。
 *
 * ■ 桜の成長ゲージ … 「一度でも正解したことがある語の数」（同じ語を何回正解しても 1語）
 *     つぼみ 0〜 / 一分咲き 30〜 / 三分咲き 90〜 / 五分咲き 150〜 / 八分咲き 210〜 / もうすぐ満開 270〜 / 満開 300
 *     （300語のときの語数。語を追加したときは同じ割合で自動計算）
 * ■ 校章バッジ … 「一度でもマスター習熟度になった語（rec.mx）」の割合
 *     通常 0〜 / 銀 20%〜 / 金 50%〜 / 桜色発光 80%〜 / 虹色・特別校章 100%
 *     マスター判定は Proficiency（習熟度）の判定をそのまま使う
 * ■ profile.counters.sakura … 連続正解・苦手克服数・満開になった日時・隠し実績用のフラグ
 */
(function (KA) {
  'use strict';

  const P = KA.Proficiency;

  /** 桜の成長段階（ratio: 全語数に対する正解済み語の割合。300語なら 30語 = 0.1） */
  const STAGES = [
    { id: 'bud', ratio: 0, label: 'つぼみ', icon: '🌱' },
    { id: 'bloom1', ratio: 0.1, label: '一分咲き', icon: '🌸' },
    { id: 'bloom3', ratio: 0.3, label: '三分咲き', icon: '🌸' },
    { id: 'bloom5', ratio: 0.5, label: '五分咲き', icon: '🌸' },
    { id: 'bloom8', ratio: 0.7, label: '八分咲き', icon: '🌸' },
    { id: 'soon', ratio: 0.9, label: 'もうすぐ満開', icon: '🌸' },
    { id: 'full', ratio: 1, label: '満開', icon: '🌸' },
  ];

  /** 校章バッジ（ratio: マスターした語の割合） */
  const BADGES = [
    { id: 'normal', ratio: 0, label: '通常校章', short: '校章', icon: '🏫' },
    { id: 'silver', ratio: 0.2, label: '銀バッジ', short: '銀', icon: '🥈' },
    { id: 'gold', ratio: 0.5, label: '金バッジ', short: '金', icon: '🥇' },
    { id: 'sakura', ratio: 0.8, label: '桜色発光バッジ', short: '桜色', icon: '🌸' },
    { id: 'rainbow', ratio: 1, label: '虹色・特別校章', short: '虹色', icon: '🌈' },
  ];

  /** 段階に必要な語数（全語数から計算） */
  function need(ratio, total) {
    return Math.ceil(ratio * total - 1e-9);
  }

  function stageFor(count, total) {
    let cur = STAGES[0];
    STAGES.forEach((s) => {
      if (total > 0 && count >= need(s.ratio, total)) cur = s;
    });
    return cur;
  }

  function badgeFor(count, total) {
    let cur = BADGES[0];
    BADGES.forEach((b) => {
      if (total > 0 && count >= need(b.ratio, total)) cur = b;
    });
    return cur;
  }

  function pct(n, total) {
    if (!total) return 0;
    const v = Math.round((n / total) * 100);
    return n < total ? Math.min(v, 99) : 100;
  }

  function counters(profile) {
    const c = profile.counters;
    if (!c.sakura || typeof c.sakura !== 'object') c.sakura = {};
    const sk = c.sakura;
    ['streak', 'bestStreak', 'overcame'].forEach((k) => {
      if (typeof sk[k] !== 'number') sk[k] = 0;
    });
    if (!sk.flags || typeof sk.flags !== 'object') sk.flags = {};
    return sk;
  }

  const Sakura = {
    STAGES,
    BADGES,
    need,
    stageFor,
    badgeFor,
    counters,

    items() {
      return KA.ReadingData ? KA.ReadingData.items('sakura') : [];
    },

    store(profile) {
      return P.storeFor(profile, 'sakura');
    },

    /**
     * 進み具合のまとめ
     * @returns {{ total, seen, correct, mastered, masteredNow, weak, stage, nextStage, nextNeed, badge, nextBadge, rate, masterRate }}
     */
    status(profile, now) {
      now = now || Date.now();
      const items = Sakura.items();
      const store = Sakura.store(profile);
      let seen = 0;
      let correct = 0;
      let mastered = 0;
      let masteredNow = 0;
      let weak = 0;
      items.forEach((it) => {
        const rec = store[it.id];
        if (!rec) return;
        seen++;
        if ((rec.c || 0) > 0) correct++;
        if (rec.mx) mastered++;
        if (P.level(rec, now) === 4) masteredNow++;
        if (P.isWeak(rec, now)) weak++;
      });
      const total = items.length;
      const stage = stageFor(correct, total);
      const nextStage = STAGES[STAGES.indexOf(stage) + 1] || null;
      const badge = badgeFor(mastered, total);
      const nextBadge = BADGES[BADGES.indexOf(badge) + 1] || null;
      return {
        total,
        seen,
        correct,
        mastered,
        masteredNow,
        weak,
        stage,
        nextStage,
        nextNeed: nextStage ? need(nextStage.ratio, total) : total,
        badge,
        nextBadge,
        nextBadgeNeed: nextBadge ? need(nextBadge.ratio, total) : total,
        // 四捨五入。ただし全部そろうまでは 100% と表示しない
        rate: pct(correct, total),
        masterRate: pct(mastered, total),
        bloomed: total > 0 && correct >= total,
      };
    },

    /**
     * 内部タグ（いずれかを持つ語）ごとの集計。トロフィーの判定に使う
     * @param {string[]} tagIds
     */
    tagStatus(profile, tagIds) {
      const items = KA.ReadingData ? KA.ReadingData.sakura(tagIds) : [];
      const store = Sakura.store(profile);
      let correct = 0;
      let mastered = 0;
      items.forEach((it) => {
        const rec = store[it.id];
        if (rec && (rec.c || 0) > 0) correct++;
        if (rec && rec.mx) mastered++;
      });
      return { total: items.length, correct, mastered };
    },

    /** 1問答えたとき（learning.js から呼ぶ） */
    onAnswer(profile, correct, info, now) {
      const sk = counters(profile);
      sk.lastPlayedAt = now || Date.now();
      if (correct) {
        sk.streak++;
        if (sk.streak > sk.bestStreak) sk.bestStreak = sk.streak;
      } else {
        sk.streak = 0;
      }
      if (info && info.overcame) sk.overcame++;
    },

    /**
     * サクラモードの問題が終わったとき（learning.js から呼ぶ）
     * @returns {{ bloom: boolean }} bloom = 今回はじめて満開になった
     */
    onFinish(profile, session, now) {
      now = now || Date.now();
      const sk = counters(profile);
      const f = sk.flags;
      const total = session.results.length;
      const correct = session.results.filter((r) => r.correct).length;
      if (session.completed && total > 0) {
        f.sessions = (f.sessions || 0) + 1;
        const perfect = correct === total;
        const hour = new Date(now).getHours();
        if (perfect && total >= 10) {
          f.perfect10 = (f.perfect10 || 0) + 1;
          if (hour >= 19 || hour < 5) f.yozakura = true; // 夜（19時〜翌5時）
          if (hour >= 5 && hour < 9) f.asazakura = true; // 朝（5時〜9時）
        }
        if (session.size === 'all' && total >= Sakura.items().length) f.namiki = true;
      }
      const st = Sakura.status(profile, now);
      let bloom = false;
      if (st.bloomed && !sk.bloomAt) {
        sk.bloomAt = now;
        bloom = true;
      }
      return { bloom, status: st };
    },

    /** 画面表示用: 「五分咲き 51%」 */
    shortLabel(st) {
      return `${st.stage.label} ${st.rate}%`;
    },
  };

  KA.Sakura = Sakura;
})(window.KanjiApp);
