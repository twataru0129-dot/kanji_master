/*
 * 画面共通の部品
 * ------------------------------------------------------------
 * ・h(): 要素を作る小さなヘルパー（innerHTML を使わず XSS を防ぐ）
 * ・モーダル / 確認ダイアログ / トースト
 * ・称号・メダル獲得の演出（キラキラ + 大きな表示。タップですぐ閉じられる）
 * ・ヘッダー（プロフィール・バージョン表示）
 */
(function (KA) {
  'use strict';

  const U = KA.Utils;

  /**
   * 要素を作る
   * h('button', { class: 'btn', onclick: fn }, 'テキスト', childEl)
   */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        const v = attrs[key];
        if (v === null || v === undefined || v === false) return;
        if (key === 'class') el.className = v;
        else if (key === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2), v);
        else if (key === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(key, '');
        else el.setAttribute(key, v);
      });
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    children.forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) appendChildren(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    });
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  /* ============================================================
   * モーダル
   * ============================================================ */
  const modalStack = [];

  function openModal(content, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const previousFocus = document.activeElement;
    const closeBtn = h('button', { class: 'modal-close', type: 'button', 'aria-label': '閉じる' }, '×');
    const panel = h(
      'div',
      { class: 'modal-panel ' + (opts.className || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || '' },
      opts.hideClose ? null : closeBtn,
      content
    );
    const overlay = h('div', { class: 'modal-overlay' }, panel);
    const modal = {
      el: overlay,
      close() {
        if (!overlay.parentNode) return;
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 150);
        const i = modalStack.indexOf(modal);
        if (i >= 0) modalStack.splice(i, 1);
        document.body.classList.toggle('modal-open', modalStack.length > 0);
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (opts.onClose) opts.onClose();
      },
    };
    closeBtn.addEventListener('click', () => modal.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !opts.persistent) modal.close();
    });
    root.appendChild(overlay);
    modalStack.push(modal);
    document.body.classList.add('modal-open');
    setTimeout(() => {
      const focusable = panel.querySelector('[autofocus], .btn-primary, button:not(.modal-close)') || closeBtn;
      if (focusable) focusable.focus();
    }, 30);
    return modal;
  }

  function closeTopModal() {
    const m = modalStack[modalStack.length - 1];
    if (m) m.close();
    return !!m;
  }

  /**
   * 確認ダイアログ（誤操作防止）
   * @returns {Promise<boolean>}
   */
  function confirmDialog(opts) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        modal.close();
        resolve(v);
      };
      const content = h(
        'div',
        { class: 'confirm' },
        h('div', { class: 'confirm-icon', 'aria-hidden': 'true' }, opts.icon || '⚠️'),
        h('h2', { class: 'confirm-title' }, opts.title || '本当によろしいですか？'),
        opts.message ? h('p', { class: 'confirm-message' }, opts.message) : null,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => finish(false) }, opts.cancelLabel || 'やめる'),
          h('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: () => finish(true) }, opts.okLabel || 'OK')
        )
      );
      const modal = openModal(content, { className: 'modal-small', onClose: () => finish(false), label: opts.title });
    });
  }

  /* ============================================================
   * トースト
   * ============================================================ */
  function toast(message, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = h('div', { class: 'toast toast-' + (type || 'info'), role: 'status' }, message);
    root.appendChild(el);
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  /* ============================================================
   * 獲得演出
   * ============================================================ */
  const celebrationQueue = [];
  let celebrating = false;

  function sparkles(container, count) {
    const colors = ['#ffd54f', '#ff8fb1', '#7cc4ff', '#9be15d', '#ffffff', '#c39bff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 160;
      const s = h('span', { class: 'sparkle', 'aria-hidden': 'true' }, Math.random() < 0.5 ? '✦' : '★');
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      s.style.setProperty('--delay', Math.random() * 0.25 + 's');
      s.style.color = colors[i % colors.length];
      s.style.fontSize = 12 + Math.random() * 18 + 'px';
      container.appendChild(s);
    }
  }

  function showNextCelebration() {
    const item = celebrationQueue.shift();
    if (!item) {
      celebrating = false;
      return;
    }
    celebrating = true;
    const root = document.getElementById('celebration-root');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // item.card があればそれを使う（サクラモードの満開・超レア実績などの特別演出）
    const card =
      item.card ||
      h(
        'div',
        { class: 'celebration-card ' + (item.kind === 'medal' ? 'is-medal' : '') + (item.hidden ? ' is-hidden-title' : '') + (item.rarity ? ' rarity-' + item.rarity : '') },
        h('div', { class: 'celebration-label' }, item.label),
        h('div', { class: 'celebration-icon', 'aria-hidden': 'true' }, item.icon),
        h('div', { class: 'celebration-name' }, item.name),
        item.desc ? h('div', { class: 'celebration-desc' }, item.desc) : null,
        h('div', { class: 'celebration-hint' }, 'タップでとじる')
      );
    const overlay = h('div', { class: 'celebration' + (item.overlayClass ? ' ' + item.overlayClass : ''), role: 'alert', 'aria-live': 'assertive' }, card);
    if (!reduce) sparkles(overlay, item.sparkles || 26);
    if (!reduce && item.petals && KA.SakuraUI) KA.SakuraUI.petals(overlay, item.petals, { fall: true });
    root.appendChild(overlay);
    KA.Sound.play(item.kind === 'medal' ? 'medal' : 'achievement');
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      overlay.classList.add('hide');
      setTimeout(() => {
        overlay.remove();
        showNextCelebration();
      }, 220);
    };
    overlay.addEventListener('click', close);
    // 操作のじゃまにならないよう自動で閉じる（特別演出は少し長め）
    setTimeout(close, item.duration || 2600);
  }

  function celebrate(item) {
    celebrationQueue.push(item);
    if (!celebrating) showNextCelebration();
  }

  function celebrateAll(achievements, medals) {
    (achievements || []).forEach((def) => {
      // 超レア・最高レア（サクラモードの最上位実績など）は校章を使った豪華な演出
      if ((def.rarity === 'super' || def.rarity === 'legend') && KA.SakuraUI) {
        celebrate(KA.SakuraUI.achievementCelebration(def));
        return;
      }
      const title = KA.Achievements.titleOf(def);
      celebrate({
        kind: 'achievement',
        hidden: !!def.hidden,
        rarity: def.rarity || null,
        label: def.hidden ? '🎉 隠し称号を獲得！' : def.rarity === 'rare' ? '✦ レア称号を獲得！' : '🎉 称号を獲得！',
        icon: def.icon,
        name: `『${def.name}』`,
        desc: def.desc + (title !== def.name ? `（称号「${title}」）` : ''),
      });
    });
    (medals || []).forEach((tier) => {
      celebrate({
        kind: 'medal',
        label: '🏅 メダルを獲得！',
        icon: tier.icon,
        name: `${tier.name}メダル`,
        desc: '',
      });
    });
  }

  /* ============================================================
   * 表示用の小さな部品
   * ============================================================ */

  /** 習熟度バッジ（色 + 記号 + 文字） */
  function levelBadge(level, kids) {
    const info = KA.Proficiency.levelInfo(level);
    return h(
      'span',
      { class: 'lv-badge ' + info.className, title: info.label },
      h('span', { class: 'lv-stars', 'aria-hidden': 'true' }, info.stars),
      h('span', { class: 'lv-text' }, kids ? info.kidsLabel : info.label)
    );
  }

  function titleName(profile) {
    const def = profile && profile.equippedTitle ? KA.Achievements.get(profile.equippedTitle) : null;
    return def ? KA.Achievements.titleOf(def) : null;
  }

  /** ○○% の横棒 */
  function progressBar(ratio, label) {
    const pct = Math.round(U.clamp(ratio, 0, 1) * 100);
    return h(
      'div',
      { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': label || '' },
      h('div', { class: 'progress-fill', style: { width: pct + '%' } })
    );
  }

  /* ============================================================
   * ヘッダー
   * ============================================================ */
  function renderHeader() {
    const header = document.getElementById('app-header');
    clear(header);
    const p = KA.Profiles.active();
    const left = h(
      'button',
      {
        class: 'brand',
        type: 'button',
        'aria-label': 'ホームへ',
        onclick: () => KA.Router.go(p ? 'home' : 'profiles'),
      },
      h('img', { src: 'assets/icons/kanji-icon-192.png', alt: '', class: 'brand-icon', width: '32', height: '32' }),
      h('span', { class: 'brand-name' }, KA.APP_NAME)
    );
    const right = h('div', { class: 'header-right' });
    if (p) {
      right.appendChild(
        h(
          'button',
          { class: 'profile-chip', type: 'button', onclick: () => KA.Router.go('profiles'), 'aria-label': 'プロフィールを切り替える' },
          h('span', { class: 'profile-chip-icon', 'aria-hidden': 'true' }, p.icon),
          h('span', { class: 'profile-chip-name' }, p.name)
        )
      );
    }
    header.appendChild(left);
    header.appendChild(right);
  }

  /** 右上のバージョン表示（常時） */
  function renderVersionBadge() {
    const el = document.getElementById('version-badge');
    el.textContent = 'v' + KA.APP_VERSION;
    el.setAttribute('aria-label', `バージョン ${KA.APP_VERSION}（タップで更新内容）`);
    el.onclick = showVersionModal;
  }

  function showVersionModal() {
    const latest = KA.CHANGELOG[0];
    const content = h(
      'div',
      { class: 'version-modal' },
      h('img', { src: 'assets/icons/kanji-icon-192.png', alt: '', class: 'version-icon', width: '64', height: '64' }),
      h('h2', null, KA.APP_NAME),
      h('div', { class: 'version-number' }, 'v' + KA.APP_VERSION),
      h('div', { class: 'version-date' }, '更新日：' + U.formatDateKey(latest.date)),
      h('h3', null, '今回の主な変更'),
      h('ul', { class: 'change-list' }, latest.changes.map((c) => h('li', null, c))),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { modal.close(); KA.Router.go('about'); } }, '更新履歴・情報源'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => modal.close() }, 'とじる')
      )
    );
    const modal = openModal(content, { className: 'modal-small', label: 'バージョン情報' });
  }

  /** 表示モード（キッズ / 標準）を body に反映 */
  function applyDisplayMode() {
    const p = KA.Profiles.active();
    const kids = p ? p.displayMode === 'kids' : true;
    document.body.classList.toggle('mode-kids', kids);
    document.body.classList.toggle('mode-standard', !kids);
  }

  /** 画面上部の「もどる」+ 見出し */
  function screenHeader(title, opts) {
    opts = opts || {};
    return h(
      'div',
      { class: 'screen-header' },
      opts.noBack
        ? null
        : h('button', { class: 'back-btn', type: 'button', 'aria-label': 'もどる', onclick: opts.onBack || (() => KA.Router.go(opts.backTo || 'home')) }, '‹ もどる'),
      h('h1', { class: 'screen-title' }, title),
      opts.right || null
    );
  }

  /** 学年タブ */
  function levelTabs(current, onSelect, opts) {
    opts = opts || {};
    const wrap = h('div', { class: 'level-tabs', role: 'tablist' });
    KA.KanjiDB.LEVELS.forEach((lv) => {
      const available = KA.KanjiDB.isAvailable(lv.id);
      if (!available && !opts.showUnavailable) return;
      wrap.appendChild(
        h(
          'button',
          {
            class: 'level-tab' + (lv.id === current ? ' active' : '') + (available ? '' : ' disabled'),
            type: 'button',
            role: 'tab',
            'aria-selected': lv.id === current ? 'true' : 'false',
            disabled: !available,
            style: { '--lv-color': lv.color },
            onclick: () => onSelect(lv.id),
          },
          lv.short,
          available ? null : h('small', null, '準備中')
        )
      );
    });
    // タブが横にあふれるとき（中学の学年など）、選んでいるタブが見えるようにする
    requestAnimationFrame(() => {
      const active = wrap.querySelector('.level-tab.active');
      if (!active || !wrap.isConnected || wrap.scrollWidth <= wrap.clientWidth) return;
      const left = active.offsetLeft - wrap.offsetLeft;
      if (left < wrap.scrollLeft || left + active.offsetWidth > wrap.scrollLeft + wrap.clientWidth) {
        wrap.scrollLeft = Math.max(0, left - (wrap.clientWidth - active.offsetWidth) / 2);
      }
    });
    return wrap;
  }

  KA.UI = {
    h,
    clear,
    openModal,
    closeTopModal,
    confirm: confirmDialog,
    toast,
    celebrate,
    celebrateAll,
    levelBadge,
    titleName,
    progressBar,
    renderHeader,
    renderVersionBadge,
    showVersionModal,
    applyDisplayMode,
    screenHeader,
    levelTabs,
  };
})(window.KanjiApp);
