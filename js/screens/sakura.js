/*
 * 画面: サクラモード（開始画面）
 *   #/sakura   校章・桜の成長ゲージ・校章バッジ → 問題数を選んでスタート
 * ジャンル（内部タグ）や難易度は選ばせない。「問題数 → スタート」だけのシンプルな流れ。
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;

  KA.Screens.register('sakura', {
    title: 'サクラモード',
    render(el) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      const st = KA.Sakura.status(p);
      const SUI = KA.SakuraUI;
      el.classList.add('sk-screen');

      el.appendChild(KA.UI.screenHeader('🌸 サクラモード', { onBack: () => KA.Router.go('quiz-words', { type: 'life' }) }));

      el.appendChild(
        h(
          'section',
          { class: 'sk-hero' },
          SUI.emblem(st.badge.id, { size: 'xl', label: true, alt: `校章（${st.badge.label}）` }),
          h('h2', { class: 'sk-hero-title' }, '🌸 サクラモード'),
          h(
            'p',
            { class: 'sk-hero-desc' },
            kids ? 'がっこうの せいかつ・つうがく・じっしゅう・ぎょうじ・こくご など、がっこうに かんけいする いろいろな かんじに ちょうせんしよう！' : '学校生活・通学・実習・行事・国語など、学校に関係するいろいろな漢字に挑戦しよう！'
          )
        )
      );

      el.appendChild(SUI.gauge(st, kids));
      el.appendChild(SUI.badgeCard(st, kids));

      el.appendChild(h('h2', { class: 'section-title' }, kids ? 'なんもん やる？' : '問題数を選んでください'));
      const subs = { 10: kids ? 'かんたん' : '約3分', 20: kids ? 'ふつう' : '約6分', 30: kids ? 'がんばる' : '約9分' };
      const sizes = [10, 20, 30].filter((n) => n < st.total).map((n) => ({ size: n, label: `${n}問`, sub: subs[n] }));
      sizes.push({ size: 'all', label: `全${st.total}問`, sub: kids ? 'ぜんぶ' : 'すべて出題' });
      el.appendChild(
        h(
          'div',
          { class: 'size-grid sk-size-grid' },
          sizes.map((o) =>
            h(
              'button',
              { class: 'size-button' + (o.size === 'all' ? ' size-all' : ''), type: 'button', onclick: () => KA.QuizFlow.startSakura(o.size) },
              h('span', { class: 'size-label' }, o.label),
              h('span', { class: 'size-sub' }, o.sub)
            )
          )
        )
      );
      if (!kids) el.appendChild(h('p', { class: 'muted small center-text' }, 'いろいろな場面のことばが、まざって出題されます。まだ正解していない語や、苦手な語が少し多めに出ます。'));

      el.appendChild(
        h(
          'div',
          { class: 'btn-row sk-links' },
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.go('titles', { cat: 'sakura' }) }, kids ? '🏆 サクラの しょうごう' : '🏆 サクラモードの称号'),
          p.counters.sakura && p.counters.sakura.bloomAt
            ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => SUI.celebrateBloom(p) }, kids ? '🌸 まんかいを もういちど' : '🌸 満開の演出をもう一度')
            : null
        )
      );
    },
  });
})(window.KanjiApp);
