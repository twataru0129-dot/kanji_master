/*
 * 画面: プリントメーカー
 *   #/print          どんなプリントを作る？（にがて優先 / 学年から / 自分で選ぶ / 今日まちがえた漢字）
 *   #/print-setup    設定（範囲・形式・文字の大きさ・問題数）
 *   #/print-preview  プリント確認・印刷（window.print。PDF保存はブラウザの印刷機能から）
 *
 * 問題づくりは js/print.js（PrintEngine）、A4 レイアウトと印刷用 CSS は css/print.css。
 * プリントを作っても学習記録・習熟度は変わりません。
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;
  const DB = KA.KanjiDB;
  const PE = KA.PrintEngine;

  /* ============================================================
   * 状態（設定は次回のために保存。学習データとは別の settings.print に入れる）
   * ============================================================ */
  const PrintFlow = {
    state: null,
    result: null,

    prefs() {
      const s = KA.Store.settings;
      if (!U.isPlainObject(s.print)) s.print = {};
      return s.print;
    },

    savePrefs(patch) {
      Object.assign(PrintFlow.prefs(), patch);
      KA.Store.save();
    },

    /** 設定画面を開く */
    open(source, extra) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const prefs = PrintFlow.prefs();
      PrintFlow.state = Object.assign(
        {
          source, // weak / grade / custom / session
          mode: 'mix', // にがて優先: mix=にがてを多めに / only=にがてだけ
          scope: 'current', // current / level / studied
          levelId: DB.isAvailable(p.level) ? p.level : 'e1',
          custom: new Set(),
          sessionKanji: [],
          format: prefs.format || 'reading',
          size: prefs.size || (kids ? 'large' : 'standard'),
          titleStyle: prefs.titleStyle || 'review',
        },
        extra || {}
      );
      KA.Router.go('print-setup', { src: source });
    },

    /** 学習結果の「まちがえた漢字をプリント」から */
    fromKanji(kanjiList) {
      PrintFlow.open('session', { sessionKanji: U.unique(kanjiList) });
    },

    engineOpts() {
      const st = PrintFlow.state;
      return {
        source: st.source,
        mode: st.mode,
        scope: st.scope === 'level' ? st.levelId : st.scope,
        levelId: st.levelId,
        kanji: st.source === 'custom' ? Array.from(st.custom) : st.sessionKanji,
        format: st.format,
      };
    },

    build(count) {
      const p = KA.Profiles.active();
      const st = PrintFlow.state;
      st.count = count;
      const opts = PrintFlow.engineOpts();
      const available = PE.countAvailable(p, opts);
      const n = count === 'all' ? available : Math.min(count, available);
      const res = PE.generate(p, opts, n);
      if (!res.questions.length) {
        KA.UI.toast('この条件ではプリントを作れませんでした', 'info');
        return;
      }
      PrintFlow.savePrefs({ format: st.format, size: st.size, titleStyle: st.titleStyle });
      PrintFlow.result = Object.assign(res, { createdAt: Date.now(), opts, state: Object.assign({}, st, { custom: Array.from(st.custom) }) });
      KA.Router.go('print-preview');
    },

    rebuild() {
      if (PrintFlow.state && PrintFlow.state.count) PrintFlow.build(PrintFlow.state.count);
    },
  };
  KA.PrintFlow = PrintFlow;

  /* ============================================================
   * どんなプリントを作る？
   * ============================================================ */
  KA.Screens.register('print', {
    title: 'プリント',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      el.appendChild(KA.UI.screenHeader(kids ? 'ぷりんと' : 'プリントメーカー'));
      el.appendChild(h('p', { class: 'level-note' }, kids ? 'どんな ぷりんとを つくる？' : 'どんなプリントを作りますか？'));

      const ws = PE.weakStats(p, 'studied');
      const todayWrong = PE.todayWrongKanji(p);
      const card = (opts) =>
        h(
          'button',
          { class: 'ptype-card print-card' + (opts.cls ? ' ' + opts.cls : ''), type: 'button', onclick: opts.onclick },
          opts.badge ? h('span', { class: 'print-badge' }, opts.badge) : h('span', { class: 'ptype-step', 'aria-hidden': 'true' }),
          h('span', { class: 'ptype-icon', 'aria-hidden': 'true' }, opts.icon),
          h('span', { class: 'ptype-title' }, opts.title),
          h('span', { class: 'ptype-desc' }, opts.desc),
          opts.meta ? h('span', { class: 'ptype-meta' }, opts.meta) : null
        );

      el.appendChild(
        h(
          'div',
          { class: 'ptype-grid print-menu' },
          card({
            cls: 'print-weak',
            badge: kids ? 'おすすめ' : '★ おすすめ',
            icon: '💪',
            title: kids ? 'にがて ゆうせん' : 'にがて優先',
            desc: kids ? 'きみの にがてな かんじで つくるよ' : 'これまでの学習記録から、今練習したい漢字を選んで作ります',
            meta: kids ? null : `苦手 ${ws.weak}字・最近まちがえた ${ws.recent}字`,
            onclick: () => PrintFlow.open('weak'),
          }),
          card({
            cls: 'print-grade',
            icon: '🏫',
            title: kids ? 'がくねんから' : '学年から作る',
            desc: kids ? 'がくねんを えらんで つくるよ' : '学年の漢字からランダムに作ります',
            onclick: () => PrintFlow.open('grade'),
          }),
          card({
            cls: 'print-custom',
            icon: '☑️',
            title: kids ? 'じぶんで えらぶ' : '自分で選ぶ',
            desc: kids ? 'すきな かんじを えらぶよ' : '練習したい漢字を選んで作ります',
            onclick: () => PrintFlow.open('custom'),
          })
        )
      );

      if (todayWrong.length) {
        el.appendChild(
          h(
            'button',
            { class: 'today-button review print-today', type: 'button', onclick: () => PrintFlow.fromKanji(todayWrong) },
            h('span', { class: 'today-icon', 'aria-hidden': 'true' }, '📝'),
            h(
              'span',
              { class: 'today-text' },
              h('span', { class: 'today-title' }, kids ? 'きょう まちがえた かんじ' : '今日まちがえた漢字をプリント'),
              h('span', { class: 'today-sub' }, todayWrong.slice(0, 12).join('・') + (todayWrong.length > 12 ? ' …' : '') + `（${todayWrong.length}字）`)
            ),
            h('span', { class: 'today-go', 'aria-hidden': 'true' }, 'つくる ›')
          )
        );
      }
      el.appendChild(h('p', { class: 'muted small center-text' }, kids ? 'ぷりんとを つくっても きろくは かわらないよ' : 'プリントを作っても、アプリの学習記録・習熟度は変わりません。'));
    },
  });

  /* ============================================================
   * 設定
   * ============================================================ */
  function optionCards(options, current, onPick) {
    return h(
      'div',
      { class: 'choice-cards print-options' },
      options.map((o) =>
        h(
          'button',
          {
            class: 'choice-card' + (current === o.id ? ' selected' : ''),
            type: 'button',
            role: 'radio',
            'aria-checked': current === o.id ? 'true' : 'false',
            onclick: () => onPick(o.id),
          },
          h('span', { class: 'choice-check', 'aria-hidden': 'true' }, current === o.id ? '●' : '○'),
          h('span', { class: 'choice-title' }, o.title, o.badge ? h('span', { class: 'print-badge inline' }, o.badge) : null),
          o.desc ? h('span', { class: 'choice-desc' }, o.desc) : null
        )
      )
    );
  }

  const SOURCE_TITLES = {
    weak: ['にがて優先', 'にがて ゆうせん'],
    grade: ['学年から作る', 'がくねんから'],
    custom: ['自分で選ぶ', 'じぶんで えらぶ'],
    session: ['まちがえた漢字', 'まちがえた かんじ'],
  };

  KA.Screens.register('print-setup', {
    title: 'プリントの設定',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      if (!PrintFlow.state) return KA.Router.replace('print');
      const st = PrintFlow.state;
      el.appendChild(KA.UI.screenHeader('🖨️ ' + SOURCE_TITLES[st.source][kids ? 1 : 0], { backTo: 'print' }));
      const body = h('div', { class: 'print-setup' });
      el.appendChild(body);
      let step = 0;
      const section = (title) => h('h2', { class: 'section-title' }, `${'①②③④⑤⑥'[step++]} ${title}`);

      const render = () => {
        KA.UI.clear(body);
        step = 0;

        /* ---- 対象 ---- */
        if (st.source === 'weak') {
          body.appendChild(section(kids ? 'どれに する？' : 'プリントの内容'));
          body.appendChild(
            optionCards(
              [
                { id: 'mix', title: kids ? 'にがてを おおめに' : 'にがてを多めにする', badge: 'おすすめ', desc: kids ? 'できる かんじも すこし まぜるよ' : '苦手を中心に、できている漢字も少しまぜます（苦手 約7割・最近の間違い 約2割・できる漢字 約1割）' },
                { id: 'only', title: kids ? 'にがてだけ' : 'にがてだけ', desc: kids ? 'にがてな かんじ だけで つくるよ' : '今、苦手と判定されている漢字だけを使います' },
              ],
              st.mode,
              (id) => {
                st.mode = id;
                render();
              }
            )
          );
          body.appendChild(section(kids ? 'はんい' : '対象の範囲'));
          const lv = DB.getLevel(p.level);
          const scopes = [
            { id: 'current', title: kids ? `いまの がくねん（${lv ? lv.label : ''}）` : `今の学年（${lv ? lv.label : ''}）` },
            { id: 'studied', title: kids ? 'これまで やった ぜんぶ' : 'これまで学習したすべて' },
          ];
          if (!kids) scopes.splice(1, 0, { id: 'level', title: '学年を選ぶ' });
          body.appendChild(
            optionCards(scopes, st.scope, (id) => {
              st.scope = id;
              render();
            })
          );
          if (st.scope === 'level') {
            body.appendChild(
              KA.UI.levelTabs(st.levelId, (id) => {
                st.levelId = id;
                render();
              })
            );
          }
          const ws = PE.weakStats(p, st.scope === 'level' ? st.levelId : st.scope);
          body.appendChild(
            h('p', { class: 'level-note' }, kids ? `にがてな かんじ：${ws.weak}こ` : `この範囲の苦手漢字 ${ws.weak}字・最近まちがえた漢字 ${ws.recent}字`)
          );
        } else if (st.source === 'grade') {
          body.appendChild(section(kids ? 'がくねん' : '学年'));
          body.appendChild(
            KA.UI.levelTabs(
              st.levelId,
              (id) => {
                st.levelId = id;
                render();
              },
              { showUnavailable: true }
            )
          );
        } else if (st.source === 'custom') {
          body.appendChild(section(kids ? 'かんじを えらぼう' : '漢字を選ぶ'));
          body.appendChild(customPicker(p, kids, render));
        } else {
          body.appendChild(section(kids ? 'まちがえた かんじ' : 'まちがえた漢字'));
          body.appendChild(
            h(
              'div',
              { class: 'kanji-chip-list' },
              st.sessionKanji.map((k) => h('span', { class: 'kanji-chip ' + KA.Proficiency.levelInfo(KA.Proficiency.level(p.kanji[k])).className }, h('span', { class: 'kanji-chip-char' }, k)))
            )
          );
        }

        /* ---- 形式 ---- */
        body.appendChild(section(kids ? 'ぷりんとの しゅるい' : 'プリントの形式'));
        body.appendChild(
          h(
            'div',
            { class: 'format-grid' },
            PE.availableFormats().map((f) =>
              h(
                'button',
                {
                  class: 'format-card' + (st.format === f.id ? ' selected' : ''),
                  type: 'button',
                  'aria-pressed': st.format === f.id ? 'true' : 'false',
                  onclick: () => {
                    st.format = f.id;
                    render();
                  },
                },
                st.format === f.id ? h('span', { class: 'scene-check', 'aria-hidden': 'true' }, '✓') : null,
                h('span', { class: 'format-icon', 'aria-hidden': 'true' }, f.icon),
                h('span', { class: 'format-title' }, kids ? f.kids : f.label),
                kids ? null : h('span', { class: 'format-desc' }, f.desc)
              )
            )
          )
        );

        /* ---- 大きさ ---- */
        body.appendChild(section(kids ? 'もじの おおきさ' : '文字の大きさ'));
        body.appendChild(
          optionCards(
            [
              { id: 'large', title: kids ? 'おおきめ' : '大きめ', desc: kids ? null : '問題数少なめ・文字大きめ・書くところが広い' },
              { id: 'standard', title: kids ? 'ふつう' : '標準', desc: kids ? null : '学校のプリントくらい（それでも少し大きめ）' },
            ],
            st.size,
            (id) => {
              st.size = id;
              render();
            }
          )
        );

        /* ---- タイトル（にがて優先のみ） ---- */
        if (st.source === 'weak' && !kids) {
          body.appendChild(section('プリントのタイトル'));
          body.appendChild(
            optionCards(
              [
                { id: 'review', title: '復習プリント', desc: 'やわらかい表現（おすすめ）' },
                { id: 'weak', title: '苦手漢字 練習プリント' },
              ],
              st.titleStyle,
              (id) => {
                st.titleStyle = id;
                render();
              }
            )
          );
        }

        /* ---- 問題数 ---- */
        const available = PE.countAvailable(p, PrintFlow.engineOpts());
        const unit = st.format === 'practice' ? '字' : '問';
        body.appendChild(section(kids ? 'なんもん？' : st.format === 'practice' ? '字数を選んで作成' : '問題数を選んで作成'));
        if (!available) {
          body.appendChild(h('p', { class: 'muted' }, emptyMessage(st, kids)));
          return;
        }
        const sizes = PE.sizeOptions(available, st.size === 'large');
        body.appendChild(
          h(
            'div',
            { class: 'size-grid' + (sizes.length === 3 ? ' three' : sizes.length === 2 ? ' two' : sizes.length === 1 ? ' one' : '') },
            sizes.map((n) =>
              h(
                'button',
                { class: 'size-button' + (n === 'all' ? ' size-all' : ''), type: 'button', onclick: () => PrintFlow.build(n) },
                h('span', { class: 'size-label' }, n === 'all' ? `全${available}${unit}` : `${n}${unit}`),
                h('span', { class: 'size-sub' }, kids ? 'つくる' : 'で作る')
              )
            )
          )
        );
        if (st.format === 'writing' && !kids) {
          body.appendChild(h('p', { class: 'muted small' }, '「漢字を書く」は、書く漢字が1つに決まる問題（文・熟語・読みが1つの漢字）だけを作ります。作れない漢字は自動で除きます。'));
        }
      };
      render();
    },
  });

  function emptyMessage(st, kids) {
    if (st.source === 'weak' && st.mode === 'only') return kids ? 'にがてな かんじは まだ ないよ。「にがてを おおめに」を つかってね' : '苦手と判定されている漢字はまだありません。「にがてを多めにする」を使ってください。';
    if (st.source === 'custom') return kids ? 'かんじを えらんでね' : '漢字を選んでください。';
    return kids ? 'この じょうけんでは つくれないよ' : 'この条件で作れる問題がありません。形式や範囲を変えてみてください。';
  }

  /** 自分で選ぶ: 学年 → 漢字一覧（チェック式） */
  function customPicker(p, kids, rerender) {
    const st = PrintFlow.state;
    const wrap = h('div', { class: 'custom-picker' });
    wrap.appendChild(
      KA.UI.levelTabs(
        st.levelId,
        (id) => {
          st.levelId = id;
          rerender();
        },
        { showUnavailable: true }
      )
    );
    const list = DB.getKanjiList(st.levelId);
    const countLabel = h('span', { class: 'custom-count', 'aria-live': 'polite' }, `${st.custom.size}字選択中`);
    wrap.appendChild(
      h(
        'div',
        { class: 'custom-toolbar' },
        countLabel,
        h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: () => { list.forEach((e) => st.custom.add(e.kanji)); rerender(); } }, kids ? 'ぜんぶ えらぶ' : 'すべて選択'),
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: () => { list.forEach((e) => st.custom.delete(e.kanji)); rerender(); } }, kids ? 'ぜんぶ けす' : 'すべて解除'),
        st.custom.size ? h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: () => { st.custom.clear(); rerender(); } }, kids ? 'ほかの がくねんも けす' : '全学年の選択を解除') : null
      )
    );
    const grid = h('div', { class: 'custom-grid' });
    list.forEach((e) => {
      const info = KA.Proficiency.levelInfo(KA.Proficiency.level(p.kanji[e.kanji]));
      const on = st.custom.has(e.kanji);
      grid.appendChild(
        h(
          'button',
          {
            class: 'custom-cell ' + info.className + (on ? ' selected' : ''),
            type: 'button',
            'aria-pressed': on ? 'true' : 'false',
            'aria-label': `${e.kanji} ${info.label}${on ? ' 選択中' : ''}`,
            onclick: () => {
              if (st.custom.has(e.kanji)) st.custom.delete(e.kanji);
              else st.custom.add(e.kanji);
              rerender();
            },
          },
          h('span', { class: 'custom-check', 'aria-hidden': 'true' }, on ? '☑' : '☐'),
          h('span', { class: 'custom-kanji', lang: 'ja' }, e.kanji),
          h('span', { class: 'custom-mark', 'aria-hidden': 'true' }, info.symbol)
        )
      );
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /* ============================================================
   * プリントの組み立て（A4）
   * ============================================================ */
  const LAYOUT = {
    // 1ページに入れる問題数（大きめ / 標準）
    reading: { large: 6, standard: 10 },
    writing: { large: 5, standard: 8 },
    practice: { large: 6, standard: 8 },
    answers: { large: 16, standard: 30 },
  };

  function sheetTitle(res, kids) {
    const st = res.state;
    const f = PE.FORMATS[st.format];
    let title;
    if (st.source === 'weak') title = st.titleStyle === 'weak' ? (kids ? 'あなたの にがて れんしゅう プリント' : '苦手漢字 練習プリント') : kids ? 'ふくしゅう プリント' : '復習プリント';
    else if (st.source === 'grade') title = `${DB.levelLabel(st.levelId)} 漢字プリント`;
    else if (st.source === 'session') title = kids ? 'まちがえた かんじの プリント' : 'まちがえた漢字 練習プリント';
    else title = '漢字練習プリント';
    return { title, sub: f.label };
  }

  const INSTRUCTIONS = {
    reading: '（　　）に 読みを ひらがなで 書きましょう。',
    writing: '□に 漢字を 書きましょう。',
    practice: '見本を 見て、うすい字を なぞってから 書きましょう。',
  };

  function sheetHeader(res, kids, pageNo, pageCount, isAnswer) {
    const t = sheetTitle(res, kids);
    const scored = res.state.format !== 'practice';
    return h(
      'header',
      { class: 'ps-header' },
      h(
        'div',
        { class: 'ps-title-row' },
        h('div', { class: 'ps-brand' }, '漢字マスター'),
        h('div', { class: 'ps-title' }, isAnswer ? `${t.title}【こたえ】` : t.title),
        h('div', { class: 'ps-page' }, `${t.sub}　${pageNo}/${pageCount}`)
      ),
      isAnswer
        ? null
        : h(
            'div',
            { class: 'ps-fields' },
            h('span', { class: 'ps-field ps-name' }, '名前', h('span', { class: 'ps-line' })),
            h('span', { class: 'ps-field' }, '日付', h('span', { class: 'ps-line short' }), '月', h('span', { class: 'ps-line short' }), '日'),
            scored ? h('span', { class: 'ps-field' }, '得点', h('span', { class: 'ps-line short' }), `/ ${res.questions.length}`) : null
          ),
      !isAnswer && pageNo === 1 ? h('p', { class: 'ps-instruction' }, INSTRUCTIONS[res.state.format]) : null
    );
  }

  /** 読みを書く問題 */
  function readingQuestion(q) {
    const blank = (ans) => h('span', { class: 'pq-paren' }, '（', h('span', { class: 'pq-blank', style: { width: Math.min(9, Math.max(4, ans.length * 1.2 + 1.6)) + 'em' } }), '）');
    if (q.kind === 'sentence') {
      const [before, , after] = KA.ReadingData.splitSentence(q.item);
      const word = q.item.segments.map((seg, i) => {
        if (i !== q.segIndex) return h('span', null, seg.text);
        return h('span', { class: 'pq-target' }, h('b', { class: 'pq-kanji' }, seg.text), blank(q.answer));
      });
      return h('div', { class: 'pq-body' }, before, h('span', { class: 'pq-word' }, word), after);
    }
    if (q.kind === 'okuri') return h('div', { class: 'pq-body' }, h('span', { class: 'pq-target' }, h('b', { class: 'pq-kanji' }, q.kanji), blank(q.answer)), q.tail);
    if (q.kind === 'compound') {
      return h(
        'div',
        { class: 'pq-body' },
        h('span', { class: 'pq-word' }, Array.from(q.word).map((ch) => (ch === q.kanji ? h('b', { class: 'pq-kanji' }, ch) : h('span', null, ch)))),
        blank(q.answer)
      );
    }
    return h('div', { class: 'pq-body' }, h('b', { class: 'pq-kanji' }, q.kanji), blank(q.answer));
  }

  /** 書く□（上に読み） */
  function writeBox(reading, n) {
    return h('span', { class: 'pw-box-wrap' }, h('span', { class: 'pw-reading' }, reading), h('span', { class: 'pw-boxes' }, Array.from({ length: n || 1 }, () => h('span', { class: 'pw-box' }))));
  }

  /** 漢字を書く問題 */
  function writingQuestion(q) {
    if (q.kind === 'sentence') {
      const [before, , after] = KA.ReadingData.splitSentence(q.item);
      const word = q.item.segments.map((seg, i) => (i === q.segIndex ? writeBox(q.reading, 1) : h('span', null, seg.text)));
      return h('div', { class: 'pq-body pw' }, before, h('span', { class: 'pq-word' }, word), after);
    }
    if (q.kind === 'compound') {
      return h(
        'div',
        { class: 'pq-body pw' },
        h('span', { class: 'pq-word' }, Array.from(q.word).map((ch) => (ch === q.kanji ? writeBox('', 1) : h('span', { class: 'pw-given' }, ch)))),
        h('span', { class: 'pw-hint' }, `（${q.reading}）`)
      );
    }
    return h('div', { class: 'pq-body pw' }, writeBox(q.stem, 1), q.tail ? h('span', null, q.tail) : null);
  }

  /** 漢字練習の1行 */
  function practiceRow(q, size) {
    const cells = size === 'large' ? 7 : 9;
    return h(
      'div',
      { class: 'pp-row' },
      h('div', { class: 'pp-info' }, h('div', { class: 'pp-readings' }, q.readings.join('・')), q.example ? h('div', { class: 'pp-example' }, q.example) : null),
      h(
        'div',
        { class: 'pp-cells' },
        Array.from({ length: cells }, (_, i) => h('span', { class: 'pp-cell' + (i === 0 ? ' model' : i <= 2 ? ' trace' : '') }, i <= 2 ? q.kanji : ''))
      )
    );
  }

  function answerText(q) {
    if (q.format === 'reading') {
      if (q.kind === 'sentence') {
        const seg = q.item.segments[q.segIndex];
        return `${seg.text} … ${q.answer}`;
      }
      if (q.kind === 'okuri') return `${q.kanji}${q.tail} … ${q.answer}`;
      if (q.kind === 'compound') return `${q.word} … ${q.answer}`;
      return `${q.kanji} … ${q.answer}`;
    }
    if (q.kind === 'compound') return `${q.kanji}（${q.word}）`;
    if (q.kind === 'sentence') return `${q.kanji}（${q.item.word}）`;
    return `${q.kanji}（${q.kanji}${q.tail || ''}）`;
  }

  function chunk(list, n) {
    const out = [];
    for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  }

  /** プリント（問題用紙＋解答用紙）のページを作る */
  function buildSheets(res, kids, withAnswers) {
    const st = res.state;
    const size = st.size;
    const pages = [];
    const qPages = chunk(res.questions, LAYOUT[st.format][size]);
    const noAnswers = PE.FORMATS[st.format].noAnswers;
    const aPages = noAnswers ? [] : chunk(res.questions, LAYOUT.answers[size]);
    const total = qPages.length;
    let no = 0;
    qPages.forEach((qs, pi) => {
      const page = h('section', { class: `print-page size-${size} fmt-${st.format}` }, sheetHeader(res, kids, pi + 1, total, false));
      const list = h('ol', { class: 'pq-list', start: String(no + 1) });
      qs.forEach((q) => {
        no++;
        if (st.format === 'practice') list.appendChild(h('li', { class: 'pq-item pp' }, h('span', { class: 'pq-no' }, no), practiceRow(q, size)));
        else list.appendChild(h('li', { class: 'pq-item' }, h('span', { class: 'pq-no' }, no), st.format === 'reading' ? readingQuestion(q) : writingQuestion(q)));
      });
      page.appendChild(list);
      page.appendChild(h('footer', { class: 'ps-footer' }, `漢字マスター v${KA.APP_VERSION}`));
      pages.push(page);
    });
    let ano = 0;
    aPages.forEach((qs, pi) => {
      const page = h('section', { class: `print-page answer-page size-${size}` + (withAnswers ? '' : ' no-print') }, sheetHeader(res, kids, pi + 1, aPages.length, true));
      if (!withAnswers) page.appendChild(h('div', { class: 'no-print-label screen-only' }, '答えは印刷しません'));
      const list = h('ol', { class: 'pa-list' });
      qs.forEach((q) => {
        ano++;
        list.appendChild(h('li', { class: 'pa-item' }, h('span', { class: 'pq-no' }, ano), h('span', { class: 'pa-text' }, answerText(q))));
      });
      page.appendChild(list);
      pages.push(page);
    });
    return pages;
  }

  /* ============================================================
   * プリント確認・印刷
   * ============================================================ */
  const GROUP_LABELS = { weak: '苦手', recent: '最近の間違い', low: '習熟度が低い', due: '復習時期', good: 'できている', unseen: '未学習', other: 'その他' };

  let resizeHandler = null;

  function fitPages(container) {
    const wrap = container.querySelector('.print-sheets');
    if (!wrap) return;
    const first = wrap.querySelector('.print-page');
    if (!first) return;
    const pageW = first.offsetWidth;
    const scale = Math.min(1, (container.clientWidth - 4) / pageW);
    wrap.style.setProperty('--sheet-scale', String(scale));
    wrap.querySelectorAll('.page-holder').forEach((holder) => {
      const pg = holder.firstChild;
      holder.style.height = pg.offsetHeight * scale + 'px';
      holder.style.width = pageW * scale + 'px';
    });
  }

  KA.Screens.register('print-preview', {
    title: 'プリント確認',
    onLeave() {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
      document.body.classList.remove('print-mode');
    },
    render(el) {
      const res = PrintFlow.result;
      if (!res) return KA.Router.replace('print');
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const prefs = PrintFlow.prefs();
      const withAnswers = prefs.answers !== false;
      const st = res.state;
      const noAnswers = PE.FORMATS[st.format].noAnswers;
      document.body.classList.add('print-mode');

      el.appendChild(KA.UI.screenHeader(kids ? 'ぷりんと かくにん' : 'プリント確認', { onBack: () => KA.Router.go('print-setup', { src: st.source }) }));

      const answersCb = h('input', { type: 'checkbox', checked: withAnswers });
      answersCb.addEventListener('change', () => {
        PrintFlow.savePrefs({ answers: answersCb.checked });
        KA.Router.render();
      });
      const unit = st.format === 'practice' ? '字' : '問';
      const breakdown = Object.keys(res.breakdown)
        .filter((g) => GROUP_LABELS[g])
        .map((g) => `${GROUP_LABELS[g]} ${res.breakdown[g]}`)
        .join('・');
      el.appendChild(
        h(
          'section',
          { class: 'card print-toolbar' },
          h(
            'div',
            { class: 'print-summary' },
            h('div', { class: 'print-summary-main' }, `${sheetTitle(res, kids).title}（${kids ? PE.FORMATS[st.format].kids : PE.FORMATS[st.format].label}）`),
            h('div', { class: 'muted small' }, `${res.questions.length}${unit}・A4縦` + (breakdown && st.source === 'weak' ? `・内訳：${breakdown}` : '')),
            res.questions.length < (st.count === 'all' ? 0 : st.count) ? h('div', { class: 'small' }, `条件に合う漢字が少ないため ${res.questions.length}${unit} で作りました。`) : null
          ),
          h(
            'div',
            { class: 'btn-row wrap print-actions' },
            h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => window.print() }, kids ? '🖨️ いんさつ する' : '🖨️ 印刷する'),
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => PrintFlow.rebuild() }, kids ? '🔄 つくりなおす' : '🔄 作り直す')
          ),
          noAnswers ? h('p', { class: 'muted small' }, '漢字練習プリントには答えのページはありません。') : h('label', { class: 'toggle-row' }, answersCb, h('span', null, kids ? 'こたえも いんさつ する' : '答えも印刷する（2ページ目以降）')),
          h('p', { class: 'muted small' }, 'PDFにするときは、印刷画面で「PDFとして保存」を選んでください（iPhone・iPad は印刷画面の共有ボタンから保存できます）。')
        )
      );

      const sheets = h('div', { class: 'print-sheets' });
      buildSheets(res, kids, withAnswers).forEach((page) =>
        sheets.appendChild(h('div', { class: 'page-holder' + (page.classList.contains('no-print') ? ' no-print' : '') }, page))
      );
      el.appendChild(sheets);

      const fit = () => fitPages(el);
      setTimeout(fit, 0);
      resizeHandler = U.debounce(fit, 150);
      window.addEventListener('resize', resizeHandler);
    },
  });

  // 印刷の直前・直後にプレビューの縮小を解除・再計算する
  window.addEventListener('beforeprint', () => document.body.classList.add('printing'));
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    if (KA.Router.current === 'print-preview') fitPages(document.getElementById('app'));
  });

  KA.PrintSheets = { buildSheets };
})(window.KanjiApp);
