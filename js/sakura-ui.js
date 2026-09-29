/*
 * サクラモードの画面部品
 * ------------------------------------------------------------
 * ・校章バッジ（同じ校章画像に、CSS で 銀 / 金 / 桜色発光 / 虹色 の枠・光・リングを重ねる。画像そのものは変えない）
 * ・桜の成長ゲージ
 * ・花びらの演出（正解時は小さく少しだけ。prefers-reduced-motion では出さない）
 * ・満開・最上位実績の特別演出
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const EMBLEM = 'assets/sakura/sakura-emblem.png';
  const EMBLEM_SMALL = 'assets/sakura/sakura-emblem-192.png';

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const SakuraUI = {
    EMBLEM,
    EMBLEM_SMALL,

    /**
     * 校章バッジ
     * @param {string} badgeId normal / silver / gold / sakura / rainbow
     * @param {object} opts { size: 'sm' | 'md' | 'lg' | 'xl', label: true で段階名も表示 }
     */
    emblem(badgeId, opts) {
      opts = opts || {};
      const badge = KA.Sakura.BADGES.find((b) => b.id === badgeId) || KA.Sakura.BADGES[0];
      const size = opts.size || 'md';
      const big = size === 'lg' || size === 'xl';
      return h(
        'div',
        { class: `sk-emblem sk-badge-${badge.id} sk-size-${size}` },
        h(
          'div',
          { class: 'sk-emblem-frame' },
          h('span', { class: 'sk-emblem-ring', 'aria-hidden': 'true' }),
          h('img', { class: 'sk-emblem-img', src: big ? EMBLEM : EMBLEM_SMALL, alt: opts.alt != null ? opts.alt : `校章（${badge.label}）`, width: big ? '512' : '192', height: big ? '512' : '192', decoding: 'async' })
        ),
        opts.label ? h('span', { class: 'sk-badge-label' }, h('span', { 'aria-hidden': 'true' }, badge.icon + ' '), badge.label) : null
      );
    },

    /** 桜の成長ゲージ（段階名・語数・％を必ず文字でも表示） */
    gauge(st, kids) {
      const stages = KA.Sakura.STAGES;
      const idx = stages.indexOf(st.stage);
      const pct = st.total ? Math.min(100, (st.correct / st.total) * 100) : 0;
      return h(
        'section',
        { class: 'card sk-gauge', 'aria-label': kids ? 'さくらの せいちょう' : '桜の成長ゲージ' },
        h(
          'div',
          { class: 'sk-gauge-head' },
          h('span', { class: 'sk-gauge-stage' }, h('span', { 'aria-hidden': 'true' }, st.stage.icon + ' '), st.stage.label),
          h('span', { class: 'sk-gauge-count' }, `${st.correct} / ${st.total}語`, h('small', null, ` ${st.rate}%`))
        ),
        h(
          'div',
          {
            class: 'sk-gauge-bar',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': String(st.total),
            'aria-valuenow': String(st.correct),
            'aria-valuetext': `${st.stage.label}　${st.correct} / ${st.total}語（${st.rate}%）`,
          },
          h('div', { class: 'sk-gauge-fill', style: { width: pct + '%' } }),
          stages.slice(1, -1).map((s) => h('span', { class: 'sk-gauge-mark' + (stages.indexOf(s) <= idx ? ' reached' : ''), style: { left: s.ratio * 100 + '%' }, 'aria-hidden': 'true' }))
        ),
        h(
          'ol',
          { class: 'sk-stage-list', 'aria-hidden': 'true' },
          stages.map((s, i) => h('li', { class: i < idx ? 'done' : i === idx ? 'current' : '' }, s.label))
        ),
        h(
          'p',
          { class: 'sk-gauge-note small' },
          st.nextStage
            ? kids
              ? `あと ${st.nextNeed - st.correct}ご せいかいで「${st.nextStage.label}」`
              : `あと${st.nextNeed - st.correct}語正解で「${st.nextStage.label}」（ちがう語を正解すると増えます）`
            : kids
              ? 'まんかい！ ぜんぶの ことばを せいかいしたよ'
              : `満開！ ${st.total}語すべてを一度以上正解しました`
        )
      );
    },

    /** 校章バッジの進化の説明カード */
    badgeCard(st, kids) {
      const next = st.nextBadge;
      return h(
        'section',
        { class: 'card sk-badge-card' },
        SakuraUI.emblem(st.badge.id, { size: 'sm', alt: '' }),
        h(
          'div',
          { class: 'sk-badge-info' },
          h('div', { class: 'sk-badge-title' }, kids ? 'こうしょうバッジ' : '校章バッジ', '：', h('strong', null, st.badge.icon + ' ' + st.badge.label)),
          h('div', { class: 'small' }, kids ? `マスターした ことば ${st.mastered}ご` : `マスターした語 ${st.mastered} / ${st.total}語（${st.masterRate}%）`),
          h(
            'div',
            { class: 'muted small' },
            next
              ? kids
                ? `あと ${st.nextBadgeNeed - st.mastered}ご マスターで ${next.label}`
                : `あと${st.nextBadgeNeed - st.mastered}語マスターで「${next.label}」に進化`
              : kids
                ? 'さいこうの こうしょうだよ！'
                : '最高段階の校章です'
          )
        )
      );
    },

    /**
     * 花びら
     * @param {HTMLElement} container
     * @param {number} count
     * @param {object} opts { fall: true で画面全体に降らせる（演出用） }
     */
    petals(container, count, opts) {
      if (!container || reduceMotion()) return;
      opts = opts || {};
      for (let i = 0; i < count; i++) {
        const p = h('span', { class: 'sk-petal' + (opts.fall ? ' fall' : ' burst'), 'aria-hidden': 'true' });
        if (opts.fall) {
          p.style.left = Math.random() * 100 + '%';
          p.style.setProperty('--drift', (Math.random() * 120 - 60).toFixed(0) + 'px');
          p.style.setProperty('--dur', (3 + Math.random() * 3).toFixed(2) + 's');
          p.style.setProperty('--delay', (Math.random() * 2).toFixed(2) + 's');
        } else {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
          const dist = 50 + Math.random() * 60;
          p.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
          p.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(0) + 'px');
          p.style.setProperty('--delay', (Math.random() * 0.15).toFixed(2) + 's');
        }
        p.style.setProperty('--rot', Math.floor(Math.random() * 360) + 'deg');
        p.style.setProperty('--size', (10 + Math.random() * 8).toFixed(0) + 'px');
        container.appendChild(p);
        setTimeout(() => p.remove(), opts.fall ? 8500 : 1400);
      }
    },

    /** 正解したとき: カードから小さな花びらが少しだけ舞う（問題の進行は止めない） */
    correctBurst(card) {
      SakuraUI.petals(card, 7, {});
    },

    /** 満開の特別演出 */
    celebrateBloom(profile) {
      const st = KA.Sakura.status(profile);
      const card = h(
        'div',
        { class: 'celebration-card sk-special sk-bloom-card' },
        h('div', { class: 'celebration-label' }, '🌸 サクラモード'),
        SakuraUI.emblem(st.badge.id, { size: 'lg', alt: '校章' }),
        h('div', { class: 'sk-bloom-text' }, '満開！'),
        h('div', { class: 'celebration-desc' }, `${st.total}語すべてを正解して、桜が満開になりました`),
        h('div', { class: 'sk-trophy', 'aria-hidden': 'true' }, '🏆'),
        h('div', { class: 'celebration-hint' }, 'タップでとじる')
      );
      KA.UI.celebrate({ kind: 'bloom', card, overlayClass: 'sk-overlay', duration: 6500, petals: 40, sparkles: 30 });
    },

    /** 超レア・最高レア実績の演出（校章＋リング＋花びら） */
    achievementCelebration(def) {
      const legend = def.rarity === 'legend';
      const r = KA.Achievements.RARITY[def.rarity] || { label: '', icon: '' };
      const title = KA.Achievements.titleOf(def);
      const card = h(
        'div',
        { class: 'celebration-card sk-special rarity-' + def.rarity },
        h('div', { class: 'celebration-label' }, `${r.icon} ${r.label}称号を獲得！`),
        SakuraUI.emblem(legend ? 'rainbow' : 'gold', { size: 'lg', alt: '校章' }),
        h('div', { class: 'celebration-name' }, `『${def.name}』`),
        title !== def.name ? h('div', { class: 'sk-title-alias' }, `称号「${title}」`) : null,
        h('div', { class: 'celebration-desc' }, def.desc),
        h('div', { class: 'celebration-hint' }, 'タップでとじる')
      );
      return { kind: 'achievement', card, overlayClass: 'sk-overlay' + (legend ? ' legend' : ''), duration: legend ? 7000 : 5500, petals: legend ? 50 : 30, sparkles: legend ? 40 : 30 };
    },

    /**
     * 生活漢字の「場面をえらぼう」画面に出す、サクラモードの特別カード
     * 校章は現在のバッジ段階で表示し、進み具合は「五分咲き 51%」程度の短い表示にする
     */
    modeCard(profile, kids) {
      const st = KA.Sakura.status(profile);
      return h(
        'button',
        {
          class: 'sk-mode-card',
          type: 'button',
          'aria-label': `サクラモード。学校生活・通学・実習・行事・国語などに挑戦。${st.stage.label} ${st.rate}%、${st.badge.label}`,
          onclick: () => KA.Router.go('sakura'),
        },
        SakuraUI.emblem(st.badge.id, { size: 'md', alt: '' }),
        h(
          'span',
          { class: 'sk-mode-text' },
          h('span', { class: 'sk-mode-title' }, '🌸 サクラモード'),
          h('span', { class: 'sk-mode-desc' }, kids ? 'がっこうの ことばに ちょうせん！' : '学校生活・通学・実習・行事・国語などに挑戦！'),
          h(
            'span',
            { class: 'sk-mode-meta' },
            h('span', { class: 'sk-mode-stage' }, KA.Sakura.shortLabel(st)),
            h('span', { class: 'sk-mode-badge' }, st.badge.icon + ' ' + st.badge.short)
          )
        ),
        h('span', { class: 'sk-mode-go', 'aria-hidden': 'true' }, '›')
      );
    },
  };

  KA.SakuraUI = SakuraUI;
})(window.KanjiApp);
