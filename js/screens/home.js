/*
 * 画面: ホーム
 * 「今日の10問」をいちばん目立つ場所に置き、各機能へのメニューを並べる。
 * キッズ表示はアイコン中心、標準表示は学習情報も表示する。
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;

  const MENU = [
    { id: 'quiz', icon: '📝', label: '問題', kids: 'もんだい', desc: '一文字・文の中・生活漢字' },
    { id: 'weak', icon: '💪', label: '苦手漢字', kids: 'にがて', desc: '苦手な漢字をおまかせで復習' },
    { id: 'zukan', icon: '📖', label: '漢字図鑑', kids: 'ずかん', desc: '読み・部首・熟語をしらべる' },
    { id: 'mastery', icon: '🗺️', label: '習熟度', kids: 'マップ', desc: '学年ごとの習熟度マップ' },
    { id: 'records', icon: '📊', label: '学習記録', kids: 'きろく', desc: '成績・過去30回の記録' },
    { id: 'titles', icon: '🏆', label: '称号・メダル', kids: 'しょうごう', desc: '集めた称号とメダル' },
    { id: 'print', icon: '🖨️', label: 'プリント', kids: 'ぷりんと', desc: '苦手な漢字の練習プリントを作る' },
    { id: 'settings', icon: '⚙️', label: '設定', kids: 'せってい', desc: 'プロフィール・バックアップ' },
  ];

  KA.Screens.register('home', {
    title: 'ホーム',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const now = Date.now();
      const title = KA.UI.titleName(p);
      const medal = KA.Medals.current(p);
      const level = KA.KanjiDB.getLevel(p.level);
      const levelSummary = KA.Proficiency.levelSummary(p, p.level, now);
      const today = p.daily[U.dateKey(now)] || { q: 0, c: 0, sessions: 0 };
      const dayStreak = KA.History.currentDayStreak(p, now);

      // あいさつ・プロフィール
      el.appendChild(
        h(
          'section',
          { class: 'card hero-profile' },
          h('div', { class: 'hero-avatar', 'aria-hidden': 'true' }, p.icon),
          h(
            'div',
            { class: 'hero-info' },
            // 名前 → プロフィール切り替え ／ 学習レベル → 学年切り替え（役割を分ける）
            h(
              'button',
              { class: 'hero-name', type: 'button', 'aria-label': `${p.name}。タップしてプロフィールを切り替える`, onclick: () => KA.Router.go('profiles') },
              p.name,
              kids ? ' さん' : ''
            ),
            title ? h('div', { class: 'hero-title' }, '称号「' + title + '」') : h('div', { class: 'hero-title muted' }, kids ? 'しょうごうを あつめよう！' : '称号を集めて装備しよう'),
            h(
              'div',
              { class: 'hero-meta' },
              h(
                'button',
                {
                  class: 'chip level-switch',
                  type: 'button',
                  style: level ? { '--lv-color': level.color } : null,
                  'aria-haspopup': 'dialog',
                  'aria-label': `現在の学習レベル ${level ? level.label : ''}。タップして変更`,
                  onclick: () =>
                    KA.LevelPicker.open(p, () => {
                      KA.Router.render();
                      const btn = document.querySelector('.level-switch');
                      if (btn) btn.focus();
                    }),
                },
                h('span', { 'aria-hidden': 'true' }, '📘'),
                level ? (kids ? level.short : level.label) : '',
                h('span', { class: 'level-switch-caret', 'aria-hidden': 'true' }, '▼')
              ),
              h('span', { class: 'chip' }, (kids ? 'しゅうじゅくど ' : '習熟度 ') + levelSummary.rate + '%'),
              medal ? h('span', { class: 'chip chip-medal' }, medal.icon + ' ' + medal.name) : null,
              dayStreak > 0 ? h('span', { class: 'chip chip-fire' }, '🔥 ' + dayStreak + (kids ? 'にち れんぞく' : '日連続')) : null
            )
          )
        )
      );

      // 今日の10問（いちばん目立つボタン）
      const doneToday = (today.sessions || 0) > 0;
      el.appendChild(
        h(
          'button',
          {
            class: 'today-button',
            type: 'button',
            onclick: () => KA.QuizFlow.startToday(),
          },
          h('span', { class: 'today-icon', 'aria-hidden': 'true' }, '☀️'),
          h(
            'span',
            { class: 'today-text' },
            h('span', { class: 'today-title' }, '今日の10問'),
            h(
              'span',
              { class: 'today-sub' },
              kids ? 'きょうの おすすめ もんだいに ちょうせん！' : '一文字・文の中・生活漢字から、間違えた問題や苦手な問題をまぜて出題'
            )
          ),
          h('span', { class: 'today-go', 'aria-hidden': 'true' }, doneToday ? 'もう1回 ›' : 'スタート ›')
        )
      );

      // 標準表示: 学習情報
      if (!kids) {
        const acc = U.percent(p.stats.totalCorrect, p.stats.totalQuestions);
        const weakCount = KA.Proficiency.weakList(p, now).length;
        const next = KA.Medals.next(p);
        el.appendChild(
          h(
            'section',
            { class: 'stat-row' },
            statTile('今日の問題', today.q + '問', today.q ? `正解 ${today.c}` : 'まだ解いていません'),
            statTile('全体の正答率', acc + '%', `${p.stats.totalCorrect} / ${p.stats.totalQuestions}問`),
            statTile('連続正解', p.stats.currentStreak + '問', `最高 ${p.stats.bestStreak}問`),
            statTile('苦手漢字', weakCount + '字', weakCount ? '復習しましょう' : 'ありません')
          )
        );
        el.appendChild(
          h(
            'section',
            { class: 'card level-progress-card' },
            h('div', { class: 'card-title-row' }, h('h2', { class: 'card-title' }, (level ? level.label : '') + 'の習熟度'), h('span', { class: 'big-number' }, levelSummary.rate + '%')),
            KA.UI.progressBar(levelSummary.rate / 100, '習熟度'),
            h(
              'div',
              { class: 'level-count-row' },
              KA.Proficiency.LEVELS.slice()
                .reverse()
                .map((lv) => h('span', { class: 'lv-count ' + lv.className }, h('span', { 'aria-hidden': 'true' }, lv.symbol), ` ${lv.label} ${levelSummary.counts[lv.value]}`))
            ),
            next
              ? h(
                  'p',
                  { class: 'muted small' },
                  `次のメダル ${next.tier.icon}${next.tier.name}まで：正解あと${next.needCorrect}問` + (next.tier.mastered ? `・マスターあと${next.needMastered}字` : '')
                )
              : h('p', { class: 'muted small' }, 'すべてのメダルを獲得しました！')
          )
        );
      }

      // メニュー
      const grid = h('nav', { class: 'menu-grid', 'aria-label': 'メニュー' });
      MENU.forEach((m) => {
        grid.appendChild(
          h(
            'button',
            {
              class: 'menu-tile' + (m.soon ? ' soon' : ''),
              type: 'button',
              onclick: () => KA.Router.go(m.id),
            },
            h('span', { class: 'menu-icon', 'aria-hidden': 'true' }, m.icon),
            h('span', { class: 'menu-label' }, kids ? m.kids : m.label),
            kids ? null : h('span', { class: 'menu-desc' }, m.desc),
            m.soon ? h('span', { class: 'soon-badge' }, '準備中') : null
          )
        );
      });
      el.appendChild(grid);

      // キッズ表示: 称号・メダルを目立たせる
      if (kids) {
        const count = Object.keys(p.achievements).length;
        el.appendChild(
          h(
            'button',
            { class: 'card kids-collection', type: 'button', onclick: () => KA.Router.go('titles') },
            h('span', { class: 'kids-collection-icon', 'aria-hidden': 'true' }, medal ? medal.icon : '🏆'),
            h('span', { class: 'kids-collection-text' }, `しょうごう ${count}こ ゲット！`),
            h('span', { class: 'kids-collection-go', 'aria-hidden': 'true' }, '›')
          )
        );
      }
    },
  });

  function statTile(label, value, sub) {
    return h('div', { class: 'stat-tile' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-sub' }, sub));
  }

  KA.UI.statTile = statTile;
})(window.KanjiApp);
