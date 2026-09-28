/*
 * 画面: 問題（問題形式の選択 → 学年・問題数の選択 → 出題 → 結果）
 *
 *   #/quiz          問題形式の選択（一文字の読み / 文の中の読み / 生活漢字）
 *   #/quiz-single   一文字の読み: 学年 → 10/20/30/全問
 *   #/quiz-words?type=sentence              文の中の読み: 10/20/30（学年選択なし）
 *   #/quiz-words?type=life                  生活漢字: 場面の選択（🌈すべて・🏫学校 …）
 *   #/quiz-words?type=life&scene=school     生活漢字: 選んだ場面の問題数の選択（件数に応じて 10/20/30/全問）
 *                                            scene は 'all' または カテゴリーID（将来は 'school,work' で複数も可）
 *   #/play          出題
 *   #/result        結果
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;
  const DB = KA.KanjiDB;

  /* ============================================================
   * クイズの開始・進行を管理
   * ============================================================ */
  const QuizFlow = {
    session: null,
    lastResult: null,

    begin(opts) {
      const p = KA.Profiles.active();
      if (!opts.entries || !opts.entries.length) {
        KA.UI.toast(opts.emptyMessage || '出題できる漢字がありません', 'info');
        return;
      }
      const session = KA.Quiz.createSession(opts);
      session.prevBestStreak = p.stats.bestStreak;
      session.inputMethod = p.inputMethod; // 一時的な切り替え用（プロフィールの設定は変えない）
      // 「もう一度」用に出題条件を保存（生活漢字の場面も含む）
      session.retryOpts = { mode: opts.mode, levelId: opts.levelId, size: opts.size, problemType: session.problemType, categories: opts.categories || null };
      p.stats.startedSessions++;
      QuizFlow.session = session;
      QuizFlow.lastResult = null;
      KA.Router.go('play');
    },

    startNormal(levelId, size) {
      const p = KA.Profiles.active();
      QuizFlow.begin({ mode: 'normal', problemType: 'single', levelId, size, entries: KA.Quiz.Selection.normal(p, levelId, size) });
    },

    /**
     * 文の中の読み・生活漢字
     * opts.categories: 生活漢字の場面IDの配列（null / 省略 = すべて）
     */
    startWords(ptype, size, opts) {
      const p = KA.Profiles.active();
      opts = opts || {};
      const categories = ptype === 'life' ? RD.parseCategories(opts.categories || opts.category) : null;
      if (ptype === 'life') QuizFlow.lastLifeScene = RD.categoriesKey(categories);
      QuizFlow.begin({
        mode: 'normal',
        problemType: ptype,
        levelId: 'mixed',
        size,
        categories,
        entries: KA.Quiz.Selection.words(p, ptype, size, { categories }),
        emptyMessage: '出題できる問題がありません',
      });
    },

    startToday() {
      const p = KA.Profiles.active();
      QuizFlow.begin({ mode: 'today', levelId: p.level, size: 10, entries: KA.Quiz.Selection.today(p, 10) });
    },

    startReview(count) {
      const p = KA.Profiles.active();
      QuizFlow.begin({
        mode: 'review',
        levelId: 'mixed',
        size: count || 10,
        entries: KA.Quiz.Selection.review(p, count || 10),
        emptyMessage: 'まだ復習する問題がありません。まずは問題に挑戦しよう！',
      });
    },

    startWeak() {
      const p = KA.Profiles.active();
      QuizFlow.begin({ mode: 'weak', levelId: 'mixed', size: 10, entries: KA.Quiz.Selection.weak(p, 10), emptyMessage: '苦手な漢字はありません！' });
    },

    /** 指定した問題だけ（キーは漢字または問題ID） */
    startFixed(kanjiList, mode) {
      const entries = KA.Quiz.Selection.fixed(kanjiList);
      QuizFlow.begin({ mode: mode || 'retry', levelId: 'mixed', size: entries.length, entries });
    },

    retry(opts) {
      if (!opts) return KA.Router.go('quiz');
      if (opts.mode === 'normal' && opts.problemType && opts.problemType !== 'single') return QuizFlow.startWords(opts.problemType, opts.size, { categories: opts.categories });
      if (opts.mode === 'normal') return QuizFlow.startNormal(opts.levelId, opts.size);
      if (opts.mode === 'today') return QuizFlow.startToday();
      if (opts.mode === 'review') return QuizFlow.startReview(opts.size);
      if (opts.mode === 'weak') return QuizFlow.startWeak();
      return KA.Router.go('quiz');
    },
  };
  KA.QuizFlow = QuizFlow;

  /* ============================================================
   * 問題形式の選択
   * ============================================================ */
  const RD = KA.ReadingData;

  function typeCount(ptype) {
    return ptype === 'single' ? DB.count() : RD.items(ptype).length;
  }

  KA.Screens.register('quiz', {
    title: '問題',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      el.appendChild(KA.UI.screenHeader(kids ? 'もんだい' : '問題'));
      el.appendChild(h('p', { class: 'level-note' }, kids ? 'どれに ちょうせんする？' : '問題の形式を選んでください'));
      const steps = ['single', 'sentence', 'life'];
      el.appendChild(
        h(
          'div',
          { class: 'ptype-grid' },
          steps.map((t, i) => {
            const info = RD.PROBLEM_TYPES[t];
            const count = typeCount(t);
            const ts = (p.stats.typeStats && p.stats.typeStats[t]) || { q: 0, c: 0 };
            return h(
              'button',
              {
                class: 'ptype-card ptype-' + t,
                type: 'button',
                disabled: count === 0,
                onclick: () => (t === 'single' ? KA.Router.go('quiz-single') : KA.Router.go('quiz-words', { type: t })),
              },
              h('span', { class: 'ptype-step', 'aria-hidden': 'true' }, kids ? '' : `STEP ${i + 1}`),
              h('span', { class: 'ptype-icon' + (t === 'single' ? ' kanji-icon-tile' : ''), 'aria-hidden': 'true' }, info.icon),
              h('span', { class: 'ptype-title' }, kids ? info.kids : info.label),
              h('span', { class: 'ptype-desc' }, kids ? info.kidsDesc : info.desc),
              kids
                ? null
                : h('span', { class: 'ptype-meta' }, `${count}${t === 'single' ? '字' : '問'}` + (ts.q ? `・正答率 ${U.percent(ts.c, ts.q)}%` : ''))
            );
          })
        )
      );
      if (!kids) {
        el.appendChild(h('p', { class: 'muted small center-text' }, '漢字単体で読める → 文章の中で読める → 実生活の中で読める、の3段階で学習できます。'));
      }
      el.appendChild(
        h(
          'div',
          { class: 'quiz-extra' },
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => QuizFlow.startToday() }, '☀️ 今日の10問'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => QuizFlow.startReview(10) }, '🔁 おまかせ復習')
        )
      );
    },
  });

  /* ============================================================
   * 文の中の読み・生活漢字（学年選択なし）
   *   文の中の読み: 問題数の選択
   *   生活漢字:     場面の選択 → 問題数の選択
   * ============================================================ */

  /**
   * 登録数に応じた問題数ボタン
   *   30問以上: 10 / 20 / 30 / 全問   20〜29問: 10 / 20 / 全問
   *   10〜19問: 10 / 全問              10問未満: 全問のみ
   *   ちょうど10・20・30問のときは、同じ数のボタンを重ねず「全問」だけにする
   */
  function lifeSizeOptions(total, kids) {
    const subs = { 10: kids ? 'かんたん' : '約3分', 20: kids ? 'ふつう' : '約6分', 30: kids ? 'がんばる' : '約9分' };
    const list = [10, 20, 30].filter((n) => n < total).map((n) => ({ size: n, label: `${n}問`, sub: subs[n] }));
    list.push({ size: 'all', label: `全${total}問`, sub: kids ? 'ぜんぶ' : 'すべて出題' });
    return list;
  }

  function sizeButtons(options, onPick) {
    return h(
      'div',
      { class: 'size-grid' + (options.length === 3 ? ' three' : options.length === 2 ? ' two' : options.length === 1 ? ' one' : '') },
      options.map((o) =>
        h(
          'button',
          { class: 'size-button' + (o.size === 'all' ? ' size-all' : ''), type: 'button', onclick: () => onPick(o.size) },
          h('span', { class: 'size-label' }, o.label),
          h('span', { class: 'size-sub' }, o.sub)
        )
      )
    );
  }

  /** 生活漢字: 場面の選択 */
  function renderSceneSelect(el, p, kids) {
    const info = RD.PROBLEM_TYPES.life;
    el.appendChild(KA.UI.screenHeader(info.icon + ' ' + (kids ? info.kids : info.label), { backTo: 'quiz' }));
    el.appendChild(h('h2', { class: 'section-title scene-title' }, kids ? 'ばめんを えらぼう' : '場面をえらぼう'));
    if (!kids) el.appendChild(h('p', { class: 'level-note' }, '生活の中でよく見ることばを、場面ごとに練習できます。「すべて」はすべての場面から出題します。'));
    const last = QuizFlow.lastLifeScene;
    const stats = p.stats.lifeCategoryCorrect || {};
    const scenes = [RD.ALL_SCENES].concat(RD.lifeCategories());
    el.appendChild(
      h(
        'div',
        { class: 'scene-grid', role: 'list' },
        scenes.map((c) => {
          const count = c.id === RD.ALL_SCENES.id ? RD.life().length : RD.life(c.id).length;
          const selected = last === c.id;
          const correct = c.id === RD.ALL_SCENES.id ? (p.stats.typeStats && p.stats.typeStats.life ? p.stats.typeStats.life.c : 0) : stats[c.id] || 0;
          return h(
            'button',
            {
              class: 'scene-button' + (c.id === RD.ALL_SCENES.id ? ' scene-all' : '') + (selected ? ' selected' : ''),
              type: 'button',
              role: 'listitem',
              disabled: count === 0,
              'aria-label': `${c.label}（${count}問）${selected ? '・前回えらんだ場面' : ''}`,
              onclick: () => KA.Router.go('quiz-words', { type: 'life', scene: c.id }),
            },
            selected ? h('span', { class: 'scene-check', 'aria-hidden': 'true' }, '✓') : null,
            h('span', { class: 'scene-icon', 'aria-hidden': 'true' }, c.icon),
            h('span', { class: 'scene-name' }, kids && c.kidsLabel ? c.kidsLabel : c.label),
            h('span', { class: 'scene-count' }, `${count}問` + (!kids && correct ? `・正解 ${correct}` : ''))
          );
        })
      )
    );
  }

  /** 生活漢字: 選んだ場面の問題数の選択 */
  function renderLifeSize(el, p, kids, sceneParam) {
    const info = RD.PROBLEM_TYPES.life;
    const categories = RD.parseCategories(sceneParam);
    const items = RD.lifeIn(categories);
    const backToScenes = () => KA.Router.go('quiz-words', { type: 'life' });
    el.appendChild(KA.UI.screenHeader(info.icon + ' ' + (kids ? info.kids : info.label), { onBack: backToScenes }));

    const sceneLabel = RD.categoriesLabel(categories, kids);
    el.appendChild(
      h(
        'section',
        { class: 'card scene-summary', 'aria-live': 'polite' },
        h(
          'div',
          { class: 'scene-summary-main' },
          h('div', { class: 'scene-summary-label' }, kids ? 'ばめん' : '出題場面'),
          h('div', { class: 'scene-summary-name' }, sceneLabel),
          h('div', { class: 'scene-summary-sub' }, kids ? `${items.length}もん あるよ` : `登録問題数：${items.length}問`),
          kids ? null : h('div', { class: 'muted small' }, categories ? `${RD.categoriesLabel(categories, false, false)} の問題を出題します` : 'すべての場面から出題します')
        ),
        h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: backToScenes }, kids ? 'ばめんを かえる' : '場面を変える')
      )
    );
    if (!kids && items.length) {
      const sum = KA.Proficiency.summarizeItems(p, 'life', items);
      el.appendChild(h('p', { class: 'muted small' }, `この場面の習熟度 ${sum.rate}%・マスター ${sum.mastered}問`));
    }
    el.appendChild(h('h2', { class: 'section-title' }, kids ? 'なんもん やる？' : '問題数を選んでください'));
    if (!items.length) {
      el.appendChild(h('p', { class: 'muted' }, 'この場面の問題はまだありません。'));
      return;
    }
    el.appendChild(sizeButtons(lifeSizeOptions(items.length, kids), (size) => QuizFlow.startWords('life', size, { categories })));
  }

  KA.Screens.register('quiz-words', {
    title: '問題',
    render(el, params) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const ptype = params.type === 'life' ? 'life' : 'sentence';
      if (ptype === 'life') {
        if (!params.scene) return renderSceneSelect(el, p, kids);
        return renderLifeSize(el, p, kids, params.scene);
      }

      // 文の中の読み
      const info = RD.PROBLEM_TYPES[ptype];
      const items = RD.items(ptype);
      el.appendChild(KA.UI.screenHeader(info.icon + ' ' + (kids ? info.kids : info.label), { backTo: 'quiz' }));
      el.appendChild(h('p', { class: 'level-note' }, kids ? info.kidsDesc : info.desc));
      if (!kids) {
        const sum = KA.Proficiency.summarizeItems(p, ptype, items);
        el.appendChild(h('p', { class: 'muted small' }, `登録されている問題 ${items.length}問から出題（習熟度 ${sum.rate}%・マスター ${sum.mastered}問）`));
      }
      el.appendChild(h('h2', { class: 'section-title' }, kids ? 'もんだいの かずを えらぼう' : '問題数を選ぶ'));
      const sizes = [
        { size: 10, label: '10問', sub: kids ? 'かんたん' : '約3分' },
        { size: 20, label: '20問', sub: kids ? 'ふつう' : '約6分' },
        { size: 30, label: '30問', sub: kids ? 'がんばる' : '約9分' },
      ];
      el.appendChild(sizeButtons(sizes, (size) => QuizFlow.startWords(ptype, size)));
    },
  });

  /* ============================================================
   * 一文字の読み: 学年・問題数の選択
   * ============================================================ */
  KA.Screens.register('quiz-single', {
    title: '一文字の読み',
    render(el, params) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      let levelId = params.level && DB.isAvailable(params.level) ? params.level : DB.isAvailable(p.level) ? p.level : 'e1';

      el.appendChild(KA.UI.screenHeader(kids ? '一文字' : '一文字の読み', { backTo: 'quiz' }));
      const body = h('div');
      el.appendChild(body);

      const render = () => {
        KA.UI.clear(body);
        body.appendChild(h('h2', { class: 'section-title' }, kids ? '① がくねんを えらぼう' : '① 学年を選ぶ'));
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
        const sum = KA.Proficiency.levelSummary(p, levelId);
        body.appendChild(
          h(
            'p',
            { class: 'level-note' },
            `${DB.levelLabel(levelId)}：${sum.total}字`,
            kids ? '' : `（習熟度 ${sum.rate}%・マスター ${sum.mastered}字）`
          )
        );

        body.appendChild(h('h2', { class: 'section-title' }, kids ? '② もんだいの かずを えらぼう' : '② 問題数を選ぶ'));
        const sizes = [
          { size: 10, label: '10問', sub: kids ? 'かんたん' : '約3分' },
          { size: 20, label: '20問', sub: kids ? 'ふつう' : '約6分' },
          { size: 30, label: '30問', sub: kids ? 'がんばる' : '約9分' },
          { size: 'all', label: '全問', sub: `${sum.total}問` },
        ];
        body.appendChild(
          h(
            'div',
            { class: 'size-grid' },
            sizes.map((s) =>
              h(
                'button',
                { class: 'size-button', type: 'button', onclick: () => QuizFlow.startNormal(levelId, s.size) },
                h('span', { class: 'size-label' }, s.label),
                h('span', { class: 'size-sub' }, s.sub)
              )
            )
          )
        );

        // 将来の問題形式
        const upcoming = Object.values(KA.Quiz.QUESTION_TYPES).filter((t) => !t.available);
        if (!kids && upcoming.length) {
          body.appendChild(
            h('p', { class: 'muted small' }, 'これから追加予定の問題形式：' + upcoming.map((t) => t.label).join('・'))
          );
        }
      };
      render();
    },
  });

  /* ============================================================
   * 出題画面
   * ============================================================ */
  let playState = null;

  function readingsSummary(entry, kids) {
    const rows = [];
    if (entry.onyomi.length) rows.push(h('div', { class: 'reading-row' }, h('span', { class: 'reading-tag on' }, kids ? 'おん' : '音'), entry.onyomi.join('・')));
    if (entry.kunyomi.length)
      rows.push(h('div', { class: 'reading-row' }, h('span', { class: 'reading-tag kun' }, kids ? 'くん' : '訓'), entry.kunyomi.map(DB.formatKun).join('・')));
    return h('div', { class: 'readings' }, rows);
  }

  KA.Screens.register('play', {
    title: '問題中',
    canLeave() {
      const s = QuizFlow.session;
      if (!s || s.completed || s.finishedAt || KA.Quiz.isFinished(s)) return Promise.resolve(true);
      return KA.UI.confirm({
        icon: '🚪',
        title: '問題をやめますか？',
        message: s.results.length ? 'ここまでの結果は記録されます。' : 'まだ1問も答えていません。',
        okLabel: 'やめる',
        cancelLabel: 'つづける',
      }).then((ok) => {
        if (ok) finishQuiz(false, true);
        return ok;
      });
    },
    onLeave() {
      if (playState && playState.timer) clearTimeout(playState.timer);
      document.removeEventListener('keydown', onKeyDown);
      playState = null;
    },
    render(el) {
      const s = QuizFlow.session;
      if (!s || s.finishedAt) return KA.Router.replace('home');
      playState = { el, answered: false, timer: null, usePad: null };
      document.addEventListener('keydown', onKeyDown);
      renderQuestion();
    },
  });

  function onKeyDown(e) {
    if (!playState) return;
    if (e.key === 'Enter' && playState.answered && !e.isComposing && !e.repeat) {
      e.preventDefault();
      nextQuestion();
    }
  }

  function renderQuestion() {
    const s = QuizFlow.session;
    const p = KA.Profiles.active();
    const kids = p.displayMode === 'kids';
    const el = playState.el;
    KA.UI.clear(el);
    playState.answered = false;
    if (KA.Quiz.isFinished(s)) return finishQuiz(true);

    const q = KA.Quiz.currentQuestion(s);
    const type = KA.Quiz.QUESTION_TYPES[q.type];
    const method = s.inputMethod;
    if (playState.usePad === null) playState.usePad = p.showKanaPad !== false;

    // 上部バー
    el.appendChild(
      h(
        'div',
        { class: 'play-top' },
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: () => KA.Router.go('home') }, '✕ やめる'),
        h('div', { class: 'play-progress-text', 'aria-live': 'polite' }, `${s.index + 1} / ${s.entries.length}`),
        h(
          'button',
          { class: 'btn btn-small btn-ghost input-switch', type: 'button', onclick: switchInputMethod, 'aria-label': '入力方式を変更' },
          '⌨ ' + KA.Profiles.INPUT_METHODS[method].short
        )
      )
    );
    el.appendChild(KA.UI.progressBar(s.index / s.entries.length, '進み具合'));
    el.appendChild(
      h(
        'div',
        { class: 'play-streak' + (s.streak >= 3 ? ' hot' : '') },
        s.streak > 0 ? `🔥 ${s.streak}${kids ? ' れんぞく せいかい！' : '連続正解中'}` : ' '
      )
    );

    playState.blankInputs = null;
    playState.pad = null;
    const card = renderPrompt(el, q, type, kids);

    const answerArea = h('div', { class: 'answer-area' });
    el.appendChild(answerArea);
    const feedback = h('div', { class: 'feedback-area', 'aria-live': 'assertive' });
    el.appendChild(feedback);
    playState.feedback = feedback;
    playState.answerArea = answerArea;
    playState.card = card;

    el.classList.toggle('with-pad', method === 'hiragana' && playState.usePad);
    if (method === 'choice') renderChoiceInput(answerArea, q);
    else if (q.type === 'sentence') renderBlankAnswerArea(answerArea, method, kids);
    else renderTextInput(answerArea, method, kids);

    answerArea.appendChild(
      h('button', { class: 'btn btn-link dont-know', type: 'button', onclick: () => submitAnswer('', true) }, kids ? 'わからない' : 'わからない（答えを見る）')
    );
  }

  /**
   * 問題文の表示（問題タイプごと）
   * @returns {HTMLElement} 正誤で枠の色を変えるカード
   */
  function renderPrompt(el, q, type, kids) {
    const promptText = kids ? type.prompt.kids : type.prompt.standard;
    if (q.type === 'sentence') return renderSentencePrompt(el, q, promptText);
    if (q.type === 'life') {
      // 生活漢字: 場面ラベル + 看板風の語（将来 display/image で看板・値札風などに変えられる）
      const cat = RD.category(q.entry.category);
      const card = h(
        'div',
        { class: 'life-card' + (q.entry.display ? ' display-' + q.entry.display : ''), lang: 'ja' },
        h('span', { class: 'scene-label' }, h('span', { 'aria-hidden': 'true' }, cat.icon), ' ' + cat.label),
        q.entry.image ? h('img', { class: 'life-image', src: q.entry.image, alt: '' }) : null,
        h('span', { class: 'life-word' + (q.word.length >= 5 ? ' long' : '') }, q.word)
      );
      el.appendChild(card);
      el.appendChild(h('p', { class: 'play-prompt' }, promptText));
      return card;
    }
    el.appendChild(h('p', { class: 'play-prompt' }, promptText));
    const card = h('div', { class: 'kanji-card', lang: 'ja' }, h('span', { class: 'kanji-big' }, q.kanji));
    el.appendChild(card);
    return card;
  }

  /* ---------------- 文の中の読み: 漢字（　）送り仮名 の解答欄 ---------------- */

  /**
   * 文を「前の文 + 漢字（解答欄）送り仮名 … + 後ろの文」で表示する
   * 入力式では解答欄が入力欄になり、4択では空の（　）を表示する
   */
  function renderSentencePrompt(el, q, promptText) {
    const s = QuizFlow.session;
    const method = s.inputMethod;
    const usePad = method === 'hiragana' && playState.usePad;
    const [before, , after] = RD.splitSentence(q.entry);
    el.appendChild(h('p', { class: 'play-prompt' }, promptText));
    const inputs = [];
    let blankIndex = 0;
    const word = h('span', { class: 'sentence-word' });
    let lastBlank = null;
    q.entry.segments.forEach((seg) => {
      if (!seg.reading) {
        // 送り仮名は直前の「漢字（欄）」とひとかたまりにして、途中で改行されないようにする
        const okuri = h('span', { class: 'seg-okuri' }, seg.text);
        if (lastBlank) lastBlank.appendChild(okuri);
        else word.appendChild(okuri);
        return;
      }
      const i = blankIndex++;
      let box;
      if (method === 'choice') {
        box = h('span', { class: 'blank-box', 'aria-label': `${seg.text}の読み` }, '\u3000');
      } else {
        box = h('input', {
          type: 'text',
          class: 'blank-input',
          lang: 'ja',
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          spellcheck: 'false',
          enterkeyhint: i < q.blanks.length - 1 ? 'next' : 'done',
          'aria-label': `「${seg.text}」の読み（${i + 1}つめ）`,
          readonly: usePad ? true : null,
          inputmode: usePad ? 'none' : 'text',
          dataset: { i: String(i) },
        });
        inputs.push(box);
      }
      const group = h(
        'span',
        { class: 'seg-group' },
        h(
          'span',
          { class: 'seg-blank' },
          h('span', { class: 'seg-kanji' }, seg.text),
          h('span', { class: 'blank-paren', 'aria-hidden': 'true' }, '（'),
          box,
          h('span', { class: 'blank-paren', 'aria-hidden': 'true' }, '）')
        )
      );
      word.appendChild(group);
      lastBlank = group;
    });
    const card = h('div', { class: 'sentence-card sentence-fill', lang: 'ja' }, h('p', { class: 'sentence-text' }, before, word, after));
    el.appendChild(card);
    if (method === 'choice' && q.choiceKind === 'full') {
      // 解答欄が複数ある問題の4択は、語全体の読みを選ぶ
      const kids = KA.Profiles.active().displayMode === 'kids';
      el.appendChild(h('p', { class: 'blank-hint' }, kids ? `「${q.word}」の よみを えらぼう` : `「${q.word}」全体の読みを選びましょう`));
    }
    playState.blankInputs = inputs;
    playState.activeBlank = 0;
    return card;
  }

  /** 解答欄の幅を入力に合わせる */
  function fitBlank(input) {
    const len = Math.max(2, (input.value || '').length);
    input.style.width = len + 1.2 + 'em';
  }

  /** 入力する解答欄を選ぶ（選択中は太い枠＋背景色＋下の▲で表示） */
  function selectBlank(i) {
    const inputs = playState.blankInputs || [];
    if (!inputs[i]) return;
    playState.activeBlank = i;
    inputs.forEach((inp, j) => {
      inp.classList.toggle('active', j === i);
      inp.parentNode.classList.toggle('active', j === i);
    });
    if (playState.pad) playState.pad.setValue(inputs[i].value);
    updateBlankPreview();
  }

  function updateBlankPreview() {
    const inp = (playState.blankInputs || [])[playState.activeBlank];
    if (!playState.preview || !inp) return;
    playState.preview.textContent = KA.Romaji.hasLatin(inp.value) ? '→ ' + KA.Romaji.toHiragana(inp.value, false) : '\u00a0';
  }

  function blankValues() {
    return (playState.blankInputs || []).map((inp) => inp.value);
  }

  function submitBlanks() {
    if (!playState || playState.answered) return;
    const kids = KA.Profiles.active().displayMode === 'kids';
    const values = blankValues();
    const empty = values.findIndex((v) => !String(v).trim());
    if (empty >= 0) {
      KA.UI.toast(
        values.length > 1 ? (kids ? 'まだ こたえて いない ところが あるよ' : 'まだ答えていないところがあります') : kids ? 'よみを いれてね' : '読みを入力してください',
        'info'
      );
      selectBlank(empty);
      if (!playState.pad) playState.blankInputs[empty].focus();
      return;
    }
    submitAnswer(values);
  }

  /** 文の中の読み（入力式）の回答エリア */
  function renderBlankAnswerArea(area, method, kids) {
    const usePad = method === 'hiragana' && playState.usePad;
    const inputs = playState.blankInputs;
    const preview = h('div', { class: 'romaji-preview', 'aria-live': 'polite' });
    playState.preview = preview;
    playState.pad = null;
    if (inputs.length > 1) {
      area.appendChild(h('p', { class: 'blank-hint' }, kids ? 'しかくを タップして えらんでから いれてね' : '（　）をタップして、それぞれの読みを入れましょう'));
    }
    area.appendChild(preview);
    inputs.forEach((inp, i) => {
      fitBlank(inp);
      inp.addEventListener('focus', () => selectBlank(i));
      inp.addEventListener('click', () => selectBlank(i));
      inp.addEventListener('input', () => {
        fitBlank(inp);
        updateBlankPreview();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          e.stopPropagation(); // 同じ Enter で「次へ」まで進まないように
          if (playState.answered) return;
          const nextEmpty = inputs.findIndex((x, j) => j > i && !x.value.trim());
          if (nextEmpty >= 0) inputs[nextEmpty].focus();
          else submitBlanks();
        }
      });
    });
    if (usePad) {
      const pad = KA.KanaPad.create({
        onInput(v) {
          const inp = inputs[playState.activeBlank];
          if (!inp) return;
          inp.value = v;
          fitBlank(inp);
        },
        onSubmit: submitBlanks,
      });
      playState.pad = pad;
      area.appendChild(pad.el);
    } else {
      area.appendChild(h('div', { class: 'answer-row center' }, h('button', { class: 'btn btn-primary answer-submit', type: 'button', onclick: submitBlanks }, kids ? 'こたえる' : '答える')));
    }
    if (method === 'hiragana') {
      area.appendChild(
        h(
          'button',
          {
            class: 'btn btn-link small',
            type: 'button',
            onclick: () => {
              playState.usePad = !playState.usePad;
              renderQuestion();
            },
          },
          usePad ? '📱 スマホ・PCのキーボードで入力する' : '🔤 ひらがなパネルで入力する'
        )
      );
    }
    selectBlank(0);
    if (!usePad) setTimeout(() => inputs[0] && inputs[0].focus(), 50);
  }

  /** 漢字（読み）送り仮名 の形で表示する。marks=true で欄ごとの ○× を付ける */
  function segmentLine(item, values, marks) {
    let i = 0;
    return h(
      'span',
      { class: 'seg-line' },
      item.segments.map((seg) => {
        if (!seg.reading) return h('span', null, seg.text);
        const v = values[i++];
        return h(
          'span',
          { class: 'seg-answer' + (marks && v ? (v.correct ? ' ok' : ' ng') : '') },
          seg.text,
          '（',
          h('span', { class: 'seg-answer-text' }, v ? v.text || '\u3000' : '\u3000'),
          marks && v ? h('span', { class: 'seg-mark', 'aria-label': v.correct ? '正解' : '不正解' }, v.correct ? '○' : '×') : null,
          '）'
        );
      })
    );
  }

  /** 文の中の読みの答え合わせ表示 */
  function sentenceExplanation(q, check, kids, giveUp) {
    const item = q.entry;
    const correctVals = q.blanks.map((b) => ({ text: b.readings[0], correct: true }));
    const rows = [];
    if (check.correct) {
      rows.push(h('div', { class: 'word-answer seg-result' }, segmentLine(item, check.blanks && !check.whole ? check.blanks.map((b) => ({ text: b.answer, correct: true })) : correctVals, false)));
    } else {
      if (!giveUp && check.blanks && !check.whole) {
        rows.push(h('div', { class: 'seg-row' }, h('span', { class: 'seg-row-label' }, kids ? 'きみの こたえ' : 'あなたの答え'), segmentLine(item, check.blanks.map((b) => ({ text: b.answer, correct: b.correct })), true)));
      }
      rows.push(h('div', { class: 'seg-row' }, h('span', { class: 'seg-row-label' }, kids ? 'ただしい こたえ' : '正しい答え'), segmentLine(item, correctVals, false)));
      // まちがえた欄の正しい読み
      if (check.blanks && !check.whole && q.blanks.length > 1) {
        const wrong = q.blanks.filter((b, i) => !check.blanks[i].correct);
        if (wrong.length) rows.push(h('div', { class: 'muted small' }, wrong.map((b) => `${b.text} → ${b.readings.join('・')}`).join('　')));
      }
    }
    const alt = q.blanks.filter((b) => b.readings.length > 1);
    if (alt.length) rows.push(h('div', { class: 'muted small' }, (kids ? 'ほかの よみ：' : 'ほかの読み方：') + alt.map((b) => `${b.text}（${b.readings.slice(1).join('・')}）`).join('、')));
    rows.push(h('div', { class: 'word-sentence' }, h('ruby', null, item.word, h('rt', null, item.reading)), ' ― ' + item.sentence));
    return h('div', { class: 'word-explain' }, rows);
  }

  /** 答え合わせで表示する解説（文の中・生活漢字） */
  function wordExplanation(q, kids) {
    const item = q.entry;
    const cat = item.category ? RD.category(item.category) : null;
    return h(
      'div',
      { class: 'word-explain' },
      h('div', { class: 'word-answer' }, h('ruby', null, item.word, h('rt', null, item.reading))),
      item.readings.length > 1 ? h('div', { class: 'muted small' }, (kids ? 'ほかの よみ：' : 'ほかの読み方：') + item.readings.slice(1).join('・')) : null,
      q.type === 'life' && item.sentence ? h('div', { class: 'word-sentence' }, '例：' + item.sentence) : null,
      item.meaning ? h('div', { class: 'word-meaning' }, (kids ? 'いみ：' : '意味：') + item.meaning) : null,
      cat && !kids ? h('div', { class: 'muted small' }, cat.icon + ' ' + cat.label) : null
    );
  }

  function renderChoiceInput(area, q) {
    const grid = h('div', { class: 'choice-grid' });
    q.choices.forEach((c) => {
      grid.appendChild(
        h(
          'button',
          {
            class: 'choice-button',
            type: 'button',
            dataset: { value: c },
            onclick: () => submitAnswer(c),
          },
          c
        )
      );
    });
    area.appendChild(grid);
  }

  function renderTextInput(area, method, kids) {
    const usePad = method === 'hiragana' && playState.usePad;
    const preview = h('div', { class: 'romaji-preview', 'aria-live': 'polite' });
    const input = h('input', {
      type: 'text',
      class: 'answer-input',
      lang: 'ja',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'done',
      'aria-label': 'よみを入力',
      placeholder: method === 'romaji' ? 'よみを入力（例: gakkou / がっこう）' : kids ? 'ここに よみ' : 'よみをひらがなで',
      readonly: usePad ? true : null,
      inputmode: usePad ? 'none' : 'text',
    });
    const updatePreview = () => {
      const v = input.value;
      preview.textContent = KA.Romaji.hasLatin(v) ? '→ ' + KA.Romaji.toHiragana(v, false) : ' ';
    };
    input.addEventListener('input', updatePreview);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        // 同じ Enter で「次へ」まで進まないように止める
        e.stopPropagation();
        if (!playState.answered) submitAnswer(input.value);
      }
    });
    const submitBtn = h('button', { class: 'btn btn-primary answer-submit', type: 'button', onclick: () => submitAnswer(input.value) }, kids ? 'こたえる' : '答える');
    const row = h('div', { class: 'answer-row' }, input, usePad ? null : submitBtn);
    area.appendChild(row);
    area.appendChild(preview);
    playState.input = input;

    if (usePad) {
      const pad = KA.KanaPad.create({
        onInput(v) {
          input.value = v;
        },
        onSubmit() {
          if (!playState.answered) submitAnswer(input.value);
        },
      });
      playState.pad = pad;
      area.appendChild(pad.el);
    }
    if (method === 'hiragana') {
      area.appendChild(
        h(
          'button',
          {
            class: 'btn btn-link small',
            type: 'button',
            onclick: () => {
              playState.usePad = !playState.usePad;
              renderQuestion();
            },
          },
          usePad ? '📱 スマホ・PCのキーボードで入力する' : '🔤 ひらがなパネルで入力する'
        )
      );
    }
    if (!usePad) setTimeout(() => input.focus(), 50);
  }

  /** 入力方式の一時的な切り替え（プロフィールの設定はそのまま） */
  function switchInputMethod() {
    const s = QuizFlow.session;
    if (!s || playState.answered) return;
    const order = ['hiragana', 'romaji', 'choice'];
    const content = h(
      'div',
      { class: 'input-switch-modal' },
      h('h2', null, '入力方式を変更'),
      h('p', { class: 'muted small' }, 'この問題の間だけ変わります（プロフィールの設定はそのままです）。'),
      h(
        'div',
        { class: 'choice-cards' },
        order.map((m) =>
          h(
            'button',
            {
              class: 'choice-card' + (s.inputMethod === m ? ' selected' : ''),
              type: 'button',
              onclick: () => {
                s.inputMethod = m;
                if (m === 'hiragana') playState.usePad = true;
                modal.close();
                renderQuestion();
              },
            },
            h('span', { class: 'choice-check', 'aria-hidden': 'true' }, s.inputMethod === m ? '●' : '○'),
            h('span', { class: 'choice-title' }, KA.Profiles.INPUT_METHODS[m].label),
            h('span', { class: 'choice-desc' }, KA.Profiles.INPUT_METHODS[m].desc)
          )
        )
      )
    );
    const modal = KA.UI.openModal(content, { className: 'modal-small', label: '入力方式を変更' });
  }

  function submitAnswer(answer, giveUp) {
    if (!playState || playState.answered) return;
    const s = QuizFlow.session;
    const p = KA.Profiles.active();
    const kids = p.displayMode === 'kids';
    const q = KA.Quiz.currentQuestion(s);
    if (!giveUp && !Array.isArray(answer) && !String(answer || '').trim()) {
      KA.UI.toast(kids ? 'よみを いれてね' : '読みを入力してください', 'info');
      return;
    }
    playState.answered = true;
    const check = giveUp ? { correct: false, matched: null, normalized: '' } : KA.Quiz.check(s, answer);
    const info = KA.Learning.answer(p, s, {
      correct: check.correct,
      matched: check.matched,
      inputMethod: s.inputMethod,
      answer: check.normalized,
      blanks: check.blanks,
      whole: check.whole,
    });
    KA.Sound.play(check.correct ? 'correct' : 'wrong');

    // 入力欄を止める
    playState.answerArea.querySelectorAll('button, input').forEach((b) => {
      b.disabled = true;
    });
    if (q.choices) {
      playState.answerArea.querySelectorAll('.choice-button').forEach((b) => {
        const v = b.dataset.value;
        const isAccepted = q.accepted.some((r) => r.reading === v);
        if (isAccepted) b.classList.add('is-correct');
        else if (v === answer) b.classList.add('is-wrong');
      });
    }
    playState.card.classList.add(check.correct ? 'is-correct' : 'is-wrong');
    // 文の中の読み: 解答欄ごとに ○× を付ける（色だけでなく記号でも）
    if (q.type === 'sentence' && playState.blankInputs && check.blanks && !check.whole) {
      playState.blankInputs.forEach((inp, i) => {
        const b = check.blanks[i];
        if (!b) return;
        inp.parentNode.classList.remove('active');
        inp.parentNode.classList.add(b.correct ? 'blank-ok' : 'blank-ng');
        inp.parentNode.appendChild(h('span', { class: 'blank-mark', 'aria-label': b.correct ? '正解' : '不正解' }, b.correct ? '○' : '×'));
      });
    }
    if (q.type === 'sentence' && s.inputMethod === 'choice') {
      // 4択: （　）に正しい読みを表示
      playState.card.querySelectorAll('.blank-box').forEach((box, i) => {
        box.textContent = q.blanks[i].readings[0];
        box.classList.add('filled');
      });
    }

    const entry = q.entry;
    const fb = playState.feedback;
    KA.UI.clear(fb);
    const levelUp = info.afterLevel > info.beforeLevel;
    fb.appendChild(
      h(
        'div',
        { class: 'feedback ' + (check.correct ? 'feedback-correct' : 'feedback-wrong') },
        h(
          'div',
          { class: 'feedback-head' },
          h('span', { class: 'feedback-mark', 'aria-hidden': 'true' }, check.correct ? '○' : '×'),
          h(
            'span',
            { class: 'feedback-text' },
            check.correct ? (kids ? 'せいかい！' : '正解！') : giveUp ? (kids ? 'こたえは これ' : '答え') : kids ? 'ざんねん…' : '不正解'
          ),
          check.matched && q.ptype === 'single'
            ? h('span', { class: 'feedback-matched' }, `「${check.matched.reading}」` + (kids ? '' : check.matched.type === 'on' ? '（音読み）' : '（訓読み）'))
            : null
        ),
        !check.correct && !giveUp && check.normalized && !(q.type === 'sentence' && check.blanks && !check.whole)
          ? h('div', { class: 'feedback-your' }, (kids ? 'きみの こたえ：' : 'あなたの答え：') + check.normalized)
          : null,
        q.ptype === 'single' ? readingsSummary(entry, kids) : q.type === 'sentence' ? sentenceExplanation(q, check, kids, giveUp) : wordExplanation(q, kids),
        q.ptype === 'single' && entry.compounds.length
          ? h(
              'div',
              { class: 'feedback-compounds' },
              entry.compounds.slice(0, kids ? 2 : 3).map((c) => h('span', { class: 'compound-chip' }, c.word, h('small', null, c.reading)))
            )
          : null,
        info.overcame ? h('div', { class: 'feedback-note' }, '💪 苦手を克服！') : levelUp && info.afterLevel >= 3 ? h('div', { class: 'feedback-note' }, '⬆ 習熟度アップ：' + KA.Proficiency.levelInfo(info.afterLevel).label) : null,
        h('button', { class: 'btn btn-primary btn-next', type: 'button', onclick: nextQuestion, autofocus: true }, s.index >= s.entries.length ? (kids ? 'けっかを みる' : '結果を見る') : kids ? 'つぎへ ›' : '次へ ›')
      )
    );
    const nextBtn = fb.querySelector('.btn-next');
    setTimeout(() => nextBtn && nextBtn.focus(), 30);
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // キッズ表示で正解のときは自動で次へ
    if (check.correct && kids) {
      playState.timer = setTimeout(nextQuestion, 1700);
    }
  }

  function nextQuestion() {
    if (!playState || !playState.answered) return;
    if (playState.timer) clearTimeout(playState.timer);
    playState.timer = null;
    renderQuestion();
  }

  function finishQuiz(completed, leaving) {
    const s = QuizFlow.session;
    const p = KA.Profiles.active();
    if (!s || s.finishedAt) return;
    const result = KA.Learning.finish(p, s, completed);
    QuizFlow.lastResult = Object.assign(result, { session: s });
    if (leaving) {
      // 途中でやめた場合も、獲得した称号は演出する
      KA.UI.celebrateAll(result.newAchievements, result.newMedals);
      return;
    }
    KA.Sound.play('finish');
    KA.Router.replace('result');
  }

  /* ============================================================
   * 結果画面
   * ============================================================ */
  KA.Screens.register('result', {
    title: '結果',
    render(el) {
      const r = QuizFlow.lastResult;
      if (!r) return KA.Router.replace('home');
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const s = r.session;
      const rate = U.percent(r.correct, r.total);
      const stars = rate === 100 ? 3 : rate >= 80 ? 2 : rate >= 50 ? 1 : 0;
      const message =
        rate === 100 ? (kids ? 'まんてん！ すごい！' : '満点！ すばらしい！') : rate >= 80 ? (kids ? 'よくできました！' : 'よくできました！') : rate >= 50 ? (kids ? 'がんばったね！' : 'あと少し！') : kids ? 'つぎは もっと できるよ！' : '復習してもう一度挑戦しよう';
      const label = KA.History.sessionLabel(r.record || { mode: s.mode, levelId: s.levelId, problemType: s.problemType }, kids);

      el.appendChild(
        h(
          'section',
          { class: 'card result-hero' + (r.perfect ? ' perfect' : '') },
          h('div', { class: 'result-mode' }, label.mode === label.title ? label.mode : `${label.mode}・${label.title}`),
          h('div', { class: 'result-stars', 'aria-label': `星${stars}つ` }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'star on' : 'star' }, '★'))),
          h('div', { class: 'result-score' }, h('span', { class: 'result-correct' }, r.correct), h('span', { class: 'result-total' }, ` / ${r.total}`), kids ? ' もん せいかい' : '問正解'),
          kids ? null : h('div', { class: 'result-rate' }, `正答率 ${rate}%・最大連続 ${s.maxStreak}問・${Math.max(1, Math.round((s.finishedAt - s.startedAt) / 1000))}秒`),
          h('div', { class: 'result-message' }, message)
        )
      );

      if (r.newAchievements.length || r.newMedals.length) {
        el.appendChild(
          h(
            'section',
            { class: 'card new-awards' },
            h('h2', { class: 'card-title' }, kids ? 'ゲットしたもの' : '今回獲得した称号・メダル'),
            h(
              'div',
              { class: 'award-list' },
              r.newMedals.map((m) => h('div', { class: 'award-item medal' }, h('span', { class: 'award-icon' }, m.icon), m.name + 'メダル')),
              r.newAchievements.map((a) => h('div', { class: 'award-item' }, h('span', { class: 'award-icon' }, a.icon), a.name))
            )
          )
        );
        if (!r.celebrated) {
          r.celebrated = true;
          setTimeout(() => KA.UI.celebrateAll(r.newAchievements, r.newMedals), 400);
        }
      }

      const wrong = s.results.filter((x) => !x.correct).map((x) => x.kanji);
      // まちがえた漢字 → すぐにプリントへ（学習結果 → 紙で練習）
      const wrongKanji = KA.PrintEngine ? KA.PrintEngine.kanjiFromResults(s.results) : [];
      if (wrongKanji.length && KA.PrintFlow) {
        el.appendChild(
          h(
            'button',
            { class: 'today-button review print-from-result', type: 'button', onclick: () => KA.PrintFlow.fromKanji(wrongKanji) },
            h('span', { class: 'today-icon', 'aria-hidden': 'true' }, '🖨️'),
            h(
              'span',
              { class: 'today-text' },
              h('span', { class: 'today-title' }, kids ? 'まちがえた かんじを ぷりんと' : 'まちがえた漢字をプリント'),
              h('span', { class: 'today-sub' }, wrongKanji.slice(0, 10).join('・') + (wrongKanji.length > 10 ? ' …' : '') + (kids ? ` を かみで れんしゅう` : `（${wrongKanji.length}字）を紙で練習`))
            ),
            h('span', { class: 'today-go', 'aria-hidden': 'true' }, 'つくる ›')
          )
        );
      }
      el.appendChild(
        h(
          'div',
          { class: 'btn-row wrap' },
          wrong.length ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => QuizFlow.startFixed(U.unique(wrong), 'retry') }, kids ? 'まちがえた もんだいを もういちど' : '間違えた問題をもう一度') : null,
          h('button', { class: 'btn ' + (wrong.length ? 'btn-secondary' : 'btn-primary'), type: 'button', onclick: () => QuizFlow.retry(s.retryOpts) }, kids ? 'もういちど' : 'もう一度挑戦'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.replace('home') }, 'ホームへ')
        )
      );

      el.appendChild(h('h2', { class: 'section-title' }, kids ? 'こたえあわせ' : '答え合わせ'));
      el.appendChild(
        h(
          'div',
          { class: 'result-list' },
          s.results.map((x) =>
            h(
              'button',
              {
                class: 'result-item ' + (x.correct ? 'ok' : 'ng') + (x.ptype && x.ptype !== 'single' ? ' is-word' : ''),
                type: 'button',
                onclick: () => (x.ptype && x.ptype !== 'single' ? KA.WordDetail.open(x.kanji) : KA.KanjiDetail.open(x.kanji)),
              },
              h('span', { class: 'result-mark', 'aria-label': x.correct ? '正解' : '不正解' }, x.correct ? '○' : '×'),
              h('span', { class: 'result-kanji' }, x.label || x.kanji),
              h('span', { class: 'result-reading' }, x.correct ? x.matched || '' : x.answer ? x.answer : '—'),
              kids ? null : KA.UI.levelBadge(x.levelAfter, false)
            )
          )
        )
      );
    },
  });
})(window.KanjiApp);
