/*
 * 画面: このアプリについて（更新履歴・情報源・ライセンス）
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;

  KA.Screens.register('about', {
    title: 'このアプリについて',
    requiresProfile: false,
    render(el) {
      el.appendChild(KA.UI.screenHeader('このアプリについて', { backTo: KA.Profiles.active() ? 'settings' : 'welcome' }));

      el.appendChild(
        h(
          'section',
          { class: 'card about-head' },
          h('img', { src: 'assets/icons/kanji-icon-192.png', alt: '', width: '72', height: '72', class: 'version-icon' }),
          h('div', null, h('h2', null, KA.APP_NAME), h('div', null, `v${KA.APP_VERSION}・更新日 ${U.formatDateKey(KA.APP_UPDATED)}`), h('div', { class: 'muted small' }, `収録漢字 ${KA.KanjiDB.count()}字・称号 ${KA.Achievements.totalCount()}個`))
        )
      );

      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, '更新履歴'),
          KA.CHANGELOG.map((v) =>
            h('div', { class: 'changelog-entry' }, h('h3', null, `v${v.version}`, h('span', { class: 'muted small' }, `（${U.formatDateKey(v.date)}）`)), h('ul', { class: 'change-list' }, v.changes.map((c) => h('li', null, c))))
          )
        )
      );

      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, '情報源・ライセンス'),
          h(
            'ul',
            { class: 'source-list' },
            (KA.SOURCES || []).map((s) =>
              h(
                'li',
                { class: 'source-item' },
                h('div', { class: 'source-name' }, s.name, s.used ? null : h('span', { class: 'chip small' }, '将来利用')),
                h('div', { class: 'small' }, s.usage),
                h('div', { class: 'small muted' }, 'ライセンス：' + s.license),
                s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener', class: 'small' }, s.url) : null
              )
            )
          ),
          h('ul', { class: 'note-list small' }, (KA.SOURCE_NOTES || []).map((n) => h('li', null, n)))
        )
      );

      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'データの保存について'),
          h('p', { class: 'small' }, '学習データはお使いの端末のブラウザ内（localStorage）にだけ保存され、外部には送信されません。別の端末で使うときは、設定の「学習データを書き出す／読み込む」を使ってください。')
        )
      );
    },
  });
})(window.KanjiApp);
