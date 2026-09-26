/*
 * 画面: 学習記録（成績・過去30回）/ 苦手漢字
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;
  const DB = KA.KanjiDB;
  const P = KA.Proficiency;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    children.forEach((c) => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  /**
   * 直近の正答率の棒グラフ（古い → 新しい）
   * 1 系列なので凡例なし。各棒にホバー/タップで日付と正答率を表示（<title>）。
   * 同じ内容は下の履歴一覧（表）でも確認できる。
   */
  function rateChart(history) {
    const items = history.slice().reverse();
    const W = 600;
    const H = 180;
    const pad = { l: 34, r: 8, t: 10, b: 22 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const slot = iw / Math.max(items.length, 10);
    const bw = Math.max(4, Math.min(28, slot - 2));
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': '直近の問題の正答率グラフ' });
    [0, 50, 100].forEach((v) => {
      const y = pad.t + ih - (v / 100) * ih;
      root.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'chart-grid' }));
      root.appendChild(svg('text', { x: pad.l - 6, y: y + 4, class: 'chart-axis', 'text-anchor': 'end' }, v + '%'));
    });
    items.forEach((r, i) => {
      const x = pad.l + i * slot + (slot - bw) / 2;
      const bh = Math.max(2, (r.rate / 100) * ih);
      const y = pad.t + ih - bh;
      const rad = Math.min(4, bw / 2, bh);
      // 上の角だけ丸めた棒（下端はベースラインに接する）
      const d = `M${x},${pad.t + ih} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + bw - rad} Q${x + bw},${y} ${x + bw},${y + rad} V${pad.t + ih} Z`;
      const g = svg('g', { class: 'chart-bar-g' });
      g.appendChild(svg('rect', { x: pad.l + i * slot, y: pad.t, width: slot, height: ih, class: 'chart-hit' }));
      g.appendChild(svg('path', { d, class: 'chart-bar' + (r.rate === 100 ? ' perfect' : '') }));
      g.appendChild(svg('title', {}, `${U.formatShortDate(r.date)} ${DB.levelLabel(r.levelId) || 'いろいろ'} ${r.correct}/${r.total}問 ${r.rate}%`));
      root.appendChild(g);
    });
    if (items.length) {
      root.appendChild(svg('text', { x: pad.l, y: H - 6, class: 'chart-axis' }, U.formatShortDate(items[0].date)));
      root.appendChild(svg('text', { x: W - pad.r, y: H - 6, class: 'chart-axis', 'text-anchor': 'end' }, U.formatShortDate(items[items.length - 1].date)));
    }
    root.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih, class: 'chart-baseline' }));
    return h('div', { class: 'chart-wrap' }, root);
  }

  /** 学年別の習熟率（横棒） */
  function gradeBars(profile, kids) {
    return h(
      'div',
      { class: 'grade-bars' },
      DB.availableLevels().map((lv) => {
        const sum = P.levelSummary(profile, lv.id);
        return h(
          'button',
          { class: 'grade-bar-row', type: 'button', onclick: () => KA.Router.go('mastery', { level: lv.id }) },
          h('span', { class: 'grade-bar-label' }, lv.short),
          KA.UI.progressBar(sum.rate / 100, lv.label + 'の習熟率'),
          h('span', { class: 'grade-bar-value' }, sum.rate + '%'),
          kids ? null : h('span', { class: 'grade-bar-sub' }, `◎${sum.mastered}/${sum.total}`)
        );
      })
    );
  }

  /** 問題タイプ別の正答率（一文字・文の中・生活漢字） */
  function typeRows(profile, kids) {
    const RD = KA.ReadingData;
    return h(
      'div',
      { class: 'grade-bars' },
      ['single', 'sentence', 'life'].map((t) => {
        const ts = (profile.stats.typeStats && profile.stats.typeStats[t]) || { q: 0, c: 0, sessions: 0 };
        const rate = U.percent(ts.c, ts.q);
        return h(
          'div',
          { class: 'grade-bar-row type-row' },
          h('span', { class: 'grade-bar-label' }, RD.PROBLEM_TYPES[t].icon),
          h('span', { class: 'type-row-main' }, h('span', { class: 'type-row-name' }, RD.typeLabel(t, kids)), KA.UI.progressBar(ts.q ? ts.c / ts.q : 0, RD.typeLabel(t) + 'の正答率')),
          h('span', { class: 'grade-bar-value' }, ts.q ? rate + '%' : '―'),
          kids ? null : h('span', { class: 'grade-bar-sub' }, `${ts.c}/${ts.q}問`)
        );
      })
    );
  }

  /** 文の中・生活漢字の語のボタン一覧 */
  function wordChips(ids, profile, ptype) {
    const store = P.storeFor(profile, ptype);
    return h(
      'div',
      { class: 'kanji-chip-list' },
      ids.map((id) => {
        const item = KA.ReadingData.get(id);
        const rec = store[id] || {};
        return h(
          'button',
          { class: 'kanji-chip word-chip ' + P.levelInfo(P.level(store[id])).className, type: 'button', onclick: () => KA.WordDetail.open(id) },
          h('span', { class: 'kanji-chip-char', lang: 'ja' }, item.word),
          h('span', { class: 'kanji-chip-sub' }, `○${rec.c || 0} ×${rec.w || 0}`)
        );
      })
    );
  }

  function kanjiChips(list, profile) {
    return h(
      'div',
      { class: 'kanji-chip-list' },
      list.map((k) => {
        const rec = profile.kanji[k];
        return h(
          'button',
          { class: 'kanji-chip ' + P.levelInfo(P.level(rec)).className, type: 'button', onclick: () => KA.KanjiDetail.open(k) },
          h('span', { class: 'kanji-chip-char', lang: 'ja' }, k),
          h('span', { class: 'kanji-chip-sub' }, `○${rec.c || 0} ×${rec.w || 0}`)
        );
      })
    );
  }

  function historyList(profile, kids) {
    if (!profile.history.length) return h('p', { class: 'muted' }, kids ? 'まだ きろくが ないよ。もんだいに ちょうせんしよう！' : 'まだ記録がありません');
    return h(
      'ol',
      { class: 'history-list' },
      profile.history.map((r) => {
        const label = KA.History.sessionLabel(r, kids);
        const sub = [label.mode];
        if (label.level !== label.type && label.type && label.mode !== label.type) sub.push(label.type);
        return h(
          'li',
          { class: 'history-item' + (r.rate === 100 ? ' perfect' : '') },
          h('span', { class: 'history-date' }, U.formatShortDate(r.date)),
          h('span', { class: 'history-main' }, h('span', { class: 'history-level' }, label.title), h('span', { class: 'history-mode' }, `${sub.join('・')}・${r.total}問` + (r.completed ? '' : '（中断）'))),
          h('span', { class: 'history-score' }, `${r.correct}問正解`),
          h('span', { class: 'history-rate' }, r.rate === 100 ? '💮 100%' : r.rate + '%')
        );
      })
    );
  }

  KA.Screens.register('records', {
    title: '学習記録',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const st = p.stats;
      const now = Date.now();
      el.appendChild(KA.UI.screenHeader(kids ? 'がくしゅう きろく' : '学習記録・成績'));

      const tile = KA.UI.statTile;
      if (kids) {
        el.appendChild(
          h(
            'section',
            { class: 'stat-row kids' },
            tile('せいかい', st.totalCorrect + 'もん', ''),
            tile('れんぞく せいかい', st.bestStreak + 'もん', 'さいこう きろく'),
            tile('つづけた ひ', KA.History.currentDayStreak(p, now) + 'にち', ''),
            tile('マスター', P.everMasteredCount(p) + 'じ', '')
          )
        );
      } else {
        el.appendChild(
          h(
            'section',
            { class: 'stat-row' },
            tile('総問題数', st.totalQuestions + '問', `問題 ${st.totalSessions}回クリア`),
            tile('総正解数', st.totalCorrect + '問', `正答率 ${U.percent(st.totalCorrect, st.totalQuestions)}%`),
            tile('現在の連続正解', st.currentStreak + '問', `歴代最高 ${st.bestStreak}問`),
            tile('連続学習日数', KA.History.currentDayStreak(p, now) + '日', `最高 ${st.bestDayStreak}日・合計 ${st.studyDays}日`)
          )
        );
      }

      if (!kids && p.history.length) {
        el.appendChild(
          h('section', { class: 'card' }, h('h2', { class: 'card-title' }, `直近${p.history.length}回の正答率`), rateChart(p.history), h('p', { class: 'muted small' }, '棒にふれると日付と点数が表示されます'))
        );
      }

      el.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, kids ? 'がくねんごとの しゅうじゅくど' : '学年別の習熟率'), gradeBars(p, kids)));
      el.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, kids ? 'もんだいの しゅるいごと' : '問題タイプ別の成績'), typeRows(p, kids)));

      const weak = P.weakList(p, now).slice(0, 10);
      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h(
            'div',
            { class: 'card-title-row' },
            h('h2', { class: 'card-title' }, kids ? 'にがてな かんじ' : '苦手漢字 TOP10'),
            weak.length ? h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => KA.QuizFlow.startFixed(weak, 'weak') }, kids ? 'れんしゅう' : 'この10字を復習') : null
          ),
          weak.length ? kanjiChips(weak, p) : h('p', { class: 'muted' }, kids ? 'にがてな かんじは ないよ！' : '苦手漢字はありません')
        )
      );

      if (!kids) {
        const strong = P.strongList(p, now).slice(0, 20);
        el.appendChild(
          h('section', { class: 'card' }, h('h2', { class: 'card-title' }, '習熟度が高い漢字'), strong.length ? kanjiChips(strong, p) : h('p', { class: 'muted' }, 'まだありません'))
        );
      }

      el.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, kids ? 'さいきんの きろく' : `過去${KA.History.MAX_HISTORY}回の記録`), historyList(p, kids)));
    },
  });

  /* ============================================================
   * 苦手漢字
   * ============================================================ */
  KA.Screens.register('weak', {
    title: '苦手漢字',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const now = Date.now();
      const weak = P.weakList(p, now);
      el.appendChild(KA.UI.screenHeader(kids ? 'にがてな かんじ' : '苦手漢字'));

      el.appendChild(
        h(
          'button',
          { class: 'today-button review', type: 'button', onclick: () => KA.QuizFlow.startReview(10) },
          h('span', { class: 'today-icon', 'aria-hidden': 'true' }, '🔁'),
          h(
            'span',
            { class: 'today-text' },
            h('span', { class: 'today-title' }, 'おまかせ復習'),
            h('span', { class: 'today-sub' }, kids ? 'にがてな かんじを えらんで だすよ' : '苦手・最近間違えた・習熟度が低い漢字を優先して10問')
          ),
          h('span', { class: 'today-go', 'aria-hidden': 'true' }, 'スタート ›')
        )
      );

      const card = h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'card-title-row' },
          h('h2', { class: 'card-title' }, (kids ? 'にがてな かんじ ' : '苦手漢字 ') + weak.length + (kids ? 'こ' : '字')),
          weak.length ? h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => KA.QuizFlow.startWeak() }, kids ? 'にがてだけ れんしゅう' : '苦手漢字だけ復習') : null
        )
      );
      if (weak.length) {
        card.appendChild(kanjiChips(weak, p));
        if (!kids) card.appendChild(h('p', { class: 'muted small' }, '複数回間違えていて、最近の正答率が低い漢字を「苦手」と判定しています。3回連続で正解すると克服です。'));
      } else {
        card.appendChild(h('p', { class: 'muted' }, kids ? 'にがてな かんじは ないよ！ すごい！' : '苦手漢字はありません。この調子！'));
      }
      el.appendChild(card);

      // 文の中・生活漢字の苦手（問題タイプ別）
      ['sentence', 'life'].forEach((ptype) => {
        const ids = P.weakItems(p, ptype, now);
        if (!ids.length) return;
        el.appendChild(
          h(
            'section',
            { class: 'card' },
            h(
              'div',
              { class: 'card-title-row' },
              h('h2', { class: 'card-title' }, (kids ? 'にがて：' : '苦手：') + KA.ReadingData.typeLabel(ptype, kids) + ` ${ids.length}${kids ? 'こ' : '問'}`),
              h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => KA.QuizFlow.startFixed(ids.slice(0, 10), 'weak') }, kids ? 'れんしゅう' : '復習する')
            ),
            wordChips(ids, p, ptype)
          )
        );
      });

      const recentWrong = Object.keys(p.kanji)
        .filter((k) => DB.get(k) && p.kanji[k].lw && U.daysSince(p.kanji[k].lw, now) <= 7 && !weak.includes(k))
        .sort((a, b) => p.kanji[b].lw - p.kanji[a].lw)
        .slice(0, 20);
      if (recentWrong.length) {
        el.appendChild(
          h(
            'section',
            { class: 'card' },
            h(
              'div',
              { class: 'card-title-row' },
              h('h2', { class: 'card-title' }, kids ? 'さいきん まちがえた かんじ' : '最近（7日以内）間違えた漢字'),
              h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: () => KA.QuizFlow.startFixed(recentWrong, 'retry') }, kids ? 'れんしゅう' : '復習する')
            ),
            kanjiChips(recentWrong, p)
          )
        );
      }
    },
  });
})(window.KanjiApp);
