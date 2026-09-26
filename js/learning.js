/*
 * 学習の記録（まとめ役）
 * ------------------------------------------------------------
 * 1 問答えたとき・クイズが終わったときに、
 *   習熟度（proficiency） → 履歴・累計（history） → 称号（achievements） → メダル（medals）
 * の順にまとめて更新し、保存します。画面側はここだけを呼べば OK です。
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;

  const Learning = {
    /**
     * 1 問の結果を記録
     * @param {object} result { correct, matched, inputMethod, answer }
     */
    answer(profile, session, result) {
      const now = Date.now();
      const q = KA.Quiz.currentQuestion(session);
      const ptype = q.ptype || 'single';
      // 一文字は profile.kanji、文の中・生活漢字は profile.records[問題タイプ] に記録（q.kanji は漢字または問題ID）
      const store = KA.Proficiency.storeFor(profile, ptype);
      const info = KA.Proficiency.recordAnswerIn(store, q.kanji, result.correct, now);
      KA.History.recordAnswer(profile, {
        kanji: q.kanji,
        correct: result.correct,
        readingType: ptype === 'single' && result.matched ? result.matched.type : null,
        inputMethod: result.inputMethod,
        problemType: ptype,
        category: q.entry && q.entry.category,
        now,
      });
      if (info.overcame) profile.stats.overcomeCount++;
      if (info.effortComeback) profile.counters.flags.effortComeback = true;

      session.results.push({
        kanji: q.kanji, // 一文字は漢字、それ以外は問題ID
        ptype,
        label: ptype === 'single' ? q.kanji : q.word,
        correct: result.correct,
        answer: result.answer || '',
        matched: result.matched ? result.matched.reading : null,
        levelAfter: info.afterLevel,
        overcame: info.overcame,
      });
      if (result.correct) {
        session.streak++;
        if (session.streak > session.maxStreak) session.maxStreak = session.streak;
      } else {
        session.streak = 0;
      }
      session.index++;
      KA.Store.save();
      return info;
    },

    /**
     * クイズ終了（途中でやめた場合は completed=false）
     * @returns {object} 結果画面で使う情報
     */
    finish(profile, session, completed) {
      const now = Date.now();
      session.finishedAt = now;
      session.completed = !!completed;
      const total = session.results.length;
      const correct = session.results.filter((r) => r.correct).length;
      const perfect = completed && total > 0 && correct === total;
      const record = KA.History.addSession(profile, session);
      const st = profile.stats;
      const flags = profile.counters.flags;

      if (completed && total > 0) {
        // モード別
        if (session.mode === 'today') st.todaySessions++;
        if (session.mode === 'review' || session.mode === 'weak') st.reviewSessions++;
        if (session.mode === 'normal' && session.problemType === 'single') profile.counters.modesCleared[String(session.size)] = true;
        if (session.mode === 'normal' && session.problemType !== 'single') profile.counters.modesCleared[session.problemType + '-' + session.size] = true;

        // 満点
        if (perfect) {
          st.perfect.total++;
          if (session.mode === 'normal' && session.problemType === 'single') {
            if (session.size === 10) st.perfect.n10++;
            if (session.size === 20) st.perfect.n20++;
            if (session.size === 30) st.perfect.n30++;
            if (session.size === 'all') st.perfect.all++;
          } else if (session.mode === 'today' && total >= 10) {
            st.perfect.n10++;
          }
          if ((session.mode === 'weak' || session.mode === 'review') && total >= 5) flags.weakPerfect = true;
          if (total >= 10 && (now - session.startedAt) / 1000 <= total * 6) flags.speed = true;
        }

        // 時間帯
        const h = new Date(now).getHours();
        if (h >= 5 && h < 8) flags.morning = true;
        if (h >= 20 && h < 22) flags.evening = true;
        if (h >= 22 || h < 4) flags.night = true;
        const d = new Date(now);
        if (d.getMonth() === 0 && d.getDate() === 1) flags.newyear = true;
        if (d.getMonth() === 11 && d.getDate() === 12) flags.kanjiday = true;

        // 逆転: 最初の 3 問を間違えたあと、残り（7問以上）を全部正解
        const r = session.results;
        if (r.length >= 10 && r.slice(0, 3).every((x) => !x.correct) && r.slice(3).every((x) => x.correct)) {
          flags.comeback = true;
        }
        // 七転び八起き
        if (total - correct >= 8) flags.neverGiveUp = true;
        // 大躍進
        if (st.bestStreak - (session.prevBestStreak || 0) >= 10) flags.leap = true;
      }

      // 昨日間違えた漢字（3字以上）を今日すべて正解したか
      const yWrong = KA.History.yesterdayWrong(profile, now);
      const today = profile.daily[U.dateKey(now)];
      if (yWrong.length >= 3 && today && yWrong.every((k) => today.right.includes(k))) {
        flags.yesterdayClear = true;
      }

      const newAchievements = KA.Achievements.evaluate(profile, now);
      const newMedals = KA.Medals.evaluate(profile, now);
      KA.Store.save();
      return { record, total, correct, perfect, newAchievements, newMedals };
    },

    /** クイズ以外の出来事（図鑑を見た・バックアップした など）の後に呼ぶ */
    checkEvents(profile) {
      const newAchievements = KA.Achievements.evaluate(profile);
      const newMedals = KA.Medals.evaluate(profile);
      KA.Store.save();
      if (KA.UI) KA.UI.celebrateAll(newAchievements, newMedals);
      return { newAchievements, newMedals };
    },

    /** 図鑑で漢字を見た */
    viewedKanji(profile, kanji) {
      const list = profile.counters.zukanViewed;
      if (!list.includes(kanji)) {
        list.push(kanji);
        Learning.checkEvents(profile);
      }
    },
  };

  KA.Learning = Learning;
})(window.KanjiApp);
