/*
 * 学習履歴と累計成績
 * ------------------------------------------------------------
 * ・クイズ 1 回ごとの記録（直近 30 回だけ残す）
 * ・日ごとの記録（連続学習日数・「昨日間違えた漢字」の判定に使う。60 日分）
 * ・累計の問題数・正解数・連続正解など（履歴を消しても残る）
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;
  const MAX_HISTORY = 30;
  const MAX_DAILY_DAYS = 60;

  const MODE_LABELS = {
    normal: '問題',
    today: '今日の10問',
    review: 'おまかせ復習',
    weak: '苦手漢字の復習',
    retry: 'まちがい直し',
  };

  const History = {
    MAX_HISTORY,
    MODE_LABELS,

    /** 1 問答えるたびに呼ぶ: 累計・日ごとの記録を更新 */
    recordAnswer(profile, { kanji, correct, readingType, inputMethod, now, problemType, category }) {
      now = now || Date.now();
      const st = profile.stats;
      st.totalQuestions++;
      // 問題タイプ別の累計（kanji には一文字なら漢字、それ以外は問題IDが入る）
      const ts = st.typeStats && st.typeStats[problemType || 'single'];
      if (ts) {
        ts.q++;
        if (correct) ts.c++;
      }
      if (correct && problemType === 'life' && category) {
        st.lifeCategoryCorrect[category] = (st.lifeCategoryCorrect[category] || 0) + 1;
      }
      if (correct) {
        st.totalCorrect++;
        st.currentStreak++;
        if (st.currentStreak > st.bestStreak) st.bestStreak = st.currentStreak;
        if (readingType === 'on') st.onCorrect++;
        if (readingType === 'kun') st.kunCorrect++;
        if (inputMethod && st.inputCorrect[inputMethod] !== undefined) st.inputCorrect[inputMethod]++;
      } else {
        st.currentStreak = 0;
      }
      History.touchStudyDay(profile, now);
      const day = History.dayRecord(profile, U.dateKey(now));
      day.q++;
      if (correct) day.c++;
      else if (!day.wrong.includes(kanji)) day.wrong.push(kanji);
      if (correct && !day.right.includes(kanji)) day.right.push(kanji);
    },

    dayRecord(profile, key) {
      if (!profile.daily[key]) profile.daily[key] = { q: 0, c: 0, sessions: 0, wrong: [], right: [] };
      const d = profile.daily[key];
      if (!Array.isArray(d.wrong)) d.wrong = [];
      if (!Array.isArray(d.right)) d.right = [];
      d.sessions = d.sessions || 0;
      return d;
    },

    /** 連続学習日数の更新 */
    touchStudyDay(profile, now) {
      const st = profile.stats;
      const today = U.dateKey(now);
      if (st.lastStudyDate === today) return;
      if (st.lastStudyDate && U.daysBetweenKeys(st.lastStudyDate, today) === 1) {
        st.dayStreak++;
      } else {
        st.dayStreak = 1;
      }
      st.studyDays++;
      st.lastStudyDate = today;
      if (st.dayStreak > st.bestDayStreak) st.bestDayStreak = st.dayStreak;
      History.pruneDaily(profile, today);
    },

    /** 今日の時点で連続学習が途切れていないか（表示用） */
    currentDayStreak(profile, now) {
      const st = profile.stats;
      if (!st.lastStudyDate) return 0;
      const diff = U.daysBetweenKeys(st.lastStudyDate, U.dateKey(now || Date.now()));
      return diff <= 1 ? st.dayStreak : 0;
    },

    pruneDaily(profile, todayKey) {
      Object.keys(profile.daily).forEach((key) => {
        if (U.daysBetweenKeys(key, todayKey) > MAX_DAILY_DAYS) delete profile.daily[key];
      });
    },

    /**
     * クイズ 1 回分の記録を追加
     * session: { mode, levelId, size, results:[{kanji, correct}], startedAt, finishedAt, completed, maxStreak }
     */
    addSession(profile, session) {
      const total = session.results.length;
      if (total === 0) return null;
      const correct = session.results.filter((r) => r.correct).length;
      const record = {
        id: U.uid('s'),
        date: session.finishedAt || Date.now(),
        dateKey: U.dateKey(session.finishedAt || Date.now()),
        mode: session.mode,
        problemType: session.problemType || 'single', // single / sentence / life / mixed
        levelId: session.levelId,
        size: session.size, // 10 / 20 / 30 / 'all'
        total,
        correct,
        rate: U.percent(correct, total),
        completed: !!session.completed,
        durationSec: Math.round(((session.finishedAt || Date.now()) - session.startedAt) / 1000),
        maxStreak: session.maxStreak || 0,
        // [キー, 正解=1, 問題タイプ（一文字は省略）]
        results: session.results.map((r) => (r.ptype && r.ptype !== 'single' ? [r.kanji, r.correct ? 1 : 0, r.ptype] : [r.kanji, r.correct ? 1 : 0])),
      };
      // 生活漢字の場面: 1つなら lifeCategory: 'school'、すべてなら 'all'、複数なら lifeCategories も保存
      // （v1.2.0 より前の履歴には無い。無い場合は場面なしとして表示）
      if (record.problemType === 'life') {
        const cats = session.lifeCategories;
        record.lifeCategory = cats && cats.length === 1 ? cats[0] : cats && cats.length > 1 ? 'multi' : 'all';
        if (cats && cats.length > 1) record.lifeCategories = cats.slice();
      }
      profile.history.unshift(record);
      if (profile.history.length > MAX_HISTORY) profile.history.length = MAX_HISTORY;
      if (session.completed) {
        profile.stats.totalSessions++;
        const ts = profile.stats.typeStats && profile.stats.typeStats[record.problemType];
        if (ts) {
          ts.sessions++;
          if (correct === total) ts.perfect++;
        }
        History.dayRecord(profile, record.dateKey).sessions++;
      }
      return record;
    },

    /** 昨日間違えた漢字 */
    yesterdayWrong(profile, now) {
      const y = U.prevDateKey(U.dateKey(now || Date.now()));
      const d = profile.daily[y];
      return d && Array.isArray(d.wrong) ? d.wrong.slice() : [];
    },

    /**
     * 表示用のラベル
     * mode: 問題 / 今日の10問 など、type: 一文字の読み / 文の中の読み / 生活漢字、level: 学年など
     */
    sessionLabel(record, kids) {
      const ptype = record.problemType || 'single';
      const mode = MODE_LABELS[record.mode] || '問題';
      const type = KA.ReadingData.typeLabel(ptype, kids);
      let level = '';
      if (ptype === 'single' && record.levelId && record.levelId !== 'mixed') level = KA.KanjiDB.levelLabel(record.levelId);
      // 生活漢字の場面: 「生活漢字（学校）」のように表示
      let scene = '';
      if (ptype === 'life' && record.lifeCategory) {
        const cats = record.lifeCategory === 'multi' ? record.lifeCategories : record.lifeCategory === 'all' ? null : [record.lifeCategory];
        scene = KA.ReadingData.categoriesLabel(cats, kids, false);
      }
      // 見出し: 一文字は「小学1年」、それ以外は問題タイプ名
      const title = level || (scene ? `${type}（${scene}）` : type) || (kids ? 'いろいろ' : 'ミックス');
      return { mode, level: title, type, title, scene };
    },
  };

  KA.History = History;
})(window.KanjiApp);
