/*
 * 画面: 漢字図鑑 / 習熟度マップ / 漢字の詳細
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;
  const DB = KA.KanjiDB;
  const P = KA.Proficiency;

  /* ============================================================
   * 漢字の詳細（図鑑・結果画面・苦手一覧などから開く）
   * ============================================================ */
  const KanjiDetail = {
    open(kanji) {
      const entry = DB.get(kanji);
      if (!entry) return;
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const rec = p.kanji[kanji];
      const lv = P.level(rec);
      const level = DB.getLevel(entry.levelId);

      const row = (label, value) => (value ? h('div', { class: 'detail-row' }, h('dt', null, label), h('dd', null, value)) : null);
      const pending = h('span', { class: 'muted' }, '準備中');

      const history = rec
        ? h(
            'div',
            { class: 'detail-history' },
            h('div', { class: 'recent-marks', 'aria-label': '直近の結果' }, (rec.r || '').split('').map((x) => h('span', { class: x === '1' ? 'mark ok' : 'mark ng' }, x === '1' ? '○' : '×'))),
            h('div', { class: 'muted small' }, `正解 ${rec.c || 0}回・不正解 ${rec.w || 0}回` + (rec.t ? `・最後に学習した日 ${U.formatDate(rec.t)}` : ''))
          )
        : h('span', { class: 'muted' }, kids ? 'まだ といていないよ' : 'まだ出題されていません');

      const content = h(
        'div',
        { class: 'kanji-detail' },
        h(
          'div',
          { class: 'detail-head' },
          h('div', { class: 'detail-kanji', lang: 'ja' }, entry.kanji),
          h(
            'div',
            { class: 'detail-head-info' },
            h('span', { class: 'chip', style: { '--chip-color': level ? level.color : '#999' } }, entry.officialGrade ? `小学${entry.officialGrade}年` : entry.appLevel),
            KA.UI.levelBadge(lv, kids),
            P.isWeak(rec) ? h('span', { class: 'chip chip-weak' }, '⚠ 苦手') : null,
            entry.strokes ? h('span', { class: 'chip' }, `${entry.strokes}画`) : null
          )
        ),
        h(
          'dl',
          { class: 'detail-list' },
          row(kids ? 'おんよみ' : '音読み', entry.onyomi.length ? entry.onyomi.join('・') : '―'),
          row(kids ? 'くんよみ' : '訓読み', entry.kunyomi.length ? entry.kunyomi.map(DB.formatKun).join('・') : '―'),
          entry.specialReadings.length ? row(kids ? 'とくべつな よみ' : '特別な読み', entry.specialReadings.map(DB.formatKun).join('・')) : null,
          row(kids ? 'ぶしゅ' : '部首', entry.radical ? `${entry.radical}（${entry.radicalName}）` : pending),
          row(kids ? 'かくすう' : '画数', entry.strokes ? `${entry.strokes}画` : pending),
          entry.meanings.length ? row(kids ? 'いみ' : '意味', entry.meanings.join('、')) : null,
          row(
            kids ? 'ことば' : '熟語',
            entry.compounds.length
              ? h('div', { class: 'compound-list' }, entry.compounds.map((c) => h('span', { class: 'compound-chip' }, c.word, h('small', null, c.reading))))
              : pending
          ),
          row(kids ? 'おくりがな' : '送り仮名', entry.okurigana.length ? entry.okurigana.join('・') : '―'),
          row(kids ? 'れいぶん' : '例文', entry.exampleSentences.length ? h('div', null, entry.exampleSentences.map((s) => h('div', { class: 'example' }, s))) : pending),
          row(kids ? 'かきじゅん' : '書き順', h('span', { class: 'muted' }, '近日登場（KanjiVG対応予定）')),
          row(kids ? 'きろく' : '学習記録', history)
        ),
        h(
          'div',
          { class: 'btn-row' },
          h(
            'button',
            {
              class: 'btn btn-primary',
              type: 'button',
              onclick: () => {
                modal.close();
                KA.QuizFlow.startFixed([entry.kanji], 'retry');
              },
            },
            kids ? 'この かんじを れんしゅう' : 'この漢字を練習する'
          )
        )
      );
      const modal = KA.UI.openModal(content, { className: 'modal-detail', label: entry.kanji + ' の詳細' });
      KA.Learning.viewedKanji(p, entry.kanji);
    },
  };
  KA.KanjiDetail = KanjiDetail;

  /* ============================================================
   * 漢字図鑑
   * ============================================================ */
  KA.Screens.register('zukan', {
    title: '漢字図鑑',
    render(el, params) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      let levelId = params.level && DB.isAvailable(params.level) ? params.level : DB.isAvailable(p.level) ? p.level : 'e1';
      let query = '';

      el.appendChild(KA.UI.screenHeader(kids ? 'かんじ ずかん' : '漢字図鑑'));
      const tabsWrap = h('div');
      const search = kids
        ? null
        : h('input', { type: 'search', class: 'text-input search-input', placeholder: '漢字・読み・部首でさがす（全学年）', 'aria-label': '漢字をさがす' });
      const info = h('p', { class: 'level-note' });
      const grid = h('div', { class: 'zukan-grid' });
      el.appendChild(tabsWrap);
      if (search) el.appendChild(search);
      el.appendChild(info);
      el.appendChild(grid);

      const matches = (e, q) => {
        if (e.kanji === q) return true;
        const hira = U.kataToHira(q);
        return (
          e.onyomi.some((r) => U.kataToHira(r).startsWith(hira)) ||
          e.kunyomi.some((r) => DB.kunFull(r).startsWith(hira)) ||
          e.radical === q ||
          e.radicalName.startsWith(hira)
        );
      };

      const render = () => {
        KA.UI.clear(tabsWrap);
        tabsWrap.appendChild(
          KA.UI.levelTabs(
            levelId,
            (id) => {
              levelId = id;
              if (search) search.value = '';
              query = '';
              render();
            },
            { showUnavailable: true }
          )
        );
        const list = query ? DB.getAllKanji().filter((e) => matches(e, query)) : DB.getKanjiList(levelId);
        const seen = list.filter((e) => p.kanji[e.kanji]).length;
        info.textContent = query ? `「${query}」の検索結果：${list.length}字` : `${DB.levelLabel(levelId)}：${list.length}字（${kids ? 'といた かんじ' : '学習済み'} ${seen}字）`;
        KA.UI.clear(grid);
        list.forEach((e) => {
          const lv = P.level(p.kanji[e.kanji]);
          const lvInfo = P.levelInfo(lv);
          grid.appendChild(
            h(
              'button',
              { class: 'zukan-cell ' + lvInfo.className, type: 'button', 'aria-label': `${e.kanji} ${lvInfo.label}`, onclick: () => KanjiDetail.open(e.kanji) },
              h('span', { class: 'zukan-kanji', lang: 'ja' }, e.kanji),
              h('span', { class: 'zukan-mark', 'aria-hidden': 'true' }, lvInfo.symbol)
            )
          );
        });
        if (!list.length) grid.appendChild(h('p', { class: 'muted' }, '見つかりませんでした'));
      };
      if (search) {
        search.addEventListener(
          'input',
          U.debounce(() => {
            query = search.value.trim();
            render();
          }, 200)
        );
      }
      render();
    },
  });

  /* ============================================================
   * 習熟度マップ
   * ============================================================ */
  KA.Screens.register('mastery', {
    title: '習熟度マップ',
    render(el, params) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      let levelId = params.level && DB.isAvailable(params.level) ? params.level : DB.isAvailable(p.level) ? p.level : 'e1';
      el.appendChild(KA.UI.screenHeader(kids ? 'しゅうじゅくど マップ' : '習熟度マップ'));
      const body = h('div');
      el.appendChild(body);

      const render = () => {
        KA.UI.clear(body);
        body.appendChild(
          KA.UI.levelTabs(
            levelId,
            (id) => {
              levelId = id;
              render();
            },
            { showUnavailable: true }
          )
        );
        const sum = P.levelSummary(p, levelId);
        body.appendChild(
          h(
            'div',
            { class: 'card mastery-summary' },
            h('div', { class: 'card-title-row' }, h('h2', { class: 'card-title' }, DB.levelLabel(levelId)), h('span', { class: 'big-number' }, sum.rate + '%')),
            KA.UI.progressBar(sum.rate / 100, '習熟率'),
            h(
              'div',
              { class: 'legend' },
              P.LEVELS.slice()
                .reverse()
                .map((lv) =>
                  h(
                    'span',
                    { class: 'legend-item ' + lv.className },
                    h('span', { class: 'legend-swatch', 'aria-hidden': 'true' }, lv.symbol),
                    `${kids ? lv.kidsLabel : lv.label}${kids ? '' : ' ' + lv.stars} ${sum.counts[lv.value]}`
                  )
                )
            )
          )
        );
        const list = DB.getKanjiList(levelId);
        const map = h('div', { class: 'mastery-grid' + (kids ? ' kids' : '') });
        list.forEach((e) => {
          const rec = p.kanji[e.kanji];
          const lv = P.level(rec);
          const lvInfo = P.levelInfo(lv);
          const due = P.isReviewDue(rec) && lv >= 3;
          map.appendChild(
            h(
              'button',
              { class: 'mastery-cell ' + lvInfo.className, type: 'button', 'aria-label': `${e.kanji} ${lvInfo.label}${due ? ' 復習の時期' : ''}`, onclick: () => KanjiDetail.open(e.kanji) },
              h('span', { class: 'mastery-kanji', lang: 'ja' }, e.kanji),
              h('span', { class: 'mastery-stars', 'aria-hidden': 'true' }, lv === 0 ? (kids ? 'まだ' : '未学習') : lvInfo.stars),
              due ? h('span', { class: 'due-dot', title: '復習の時期' }, '↻') : null
            )
          );
        });
        body.appendChild(map);
        if (!kids) body.appendChild(h('p', { class: 'muted small' }, '↻ = しばらく解いていないため復習がおすすめの漢字'));
      };
      render();
    },
  });
})(window.KanjiApp);
