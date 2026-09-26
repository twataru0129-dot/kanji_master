/*
 * 画面の切り替え（ハッシュルーター）
 * ------------------------------------------------------------
 * URL の #/home などで画面を切り替えます。ブラウザの「戻る」も使えます。
 * GitHub Pages でもサーバー設定なしで動きます。
 *
 * 画面を追加するときは js/screens/ にファイルを作り、
 *   KanjiApp.Screens.register('name', { title, render(container, params), canLeave?, onLeave? })
 * を呼んで index.html に <script> を追加します。
 */
(function (KA) {
  'use strict';

  const screens = {};
  let current = null; // { name, def }
  let params = {};
  let suppressNext = false;

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [name, query] = raw.split('?');
    const p = {};
    if (query) {
      query.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) p[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { name: name || '', params: p };
  }

  function buildHash(name, p) {
    const q = Object.keys(p || {})
      .filter((k) => p[k] !== undefined && p[k] !== null && typeof p[k] !== 'object')
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k]))
      .join('&');
    return '#/' + name + (q ? '?' + q : '');
  }

  const Router = {
    register(name, def) {
      screens[name] = def;
    },

    get current() {
      return current ? current.name : null;
    },

    get params() {
      return params;
    },

    /**
     * 画面へ移動
     * @param {string} name
     * @param {object} p      URL に載せるパラメータ（文字列・数値のみ）
     * @param {object} state  URL に載せない一時データ（クイズの設定など）
     */
    go(name, p, state) {
      Router.pendingState = state || null;
      const hash = buildHash(name, p);
      if (location.hash === hash) {
        Router.render();
      } else {
        location.hash = hash;
      }
    },

    /** 履歴を残さずに移動（クイズ結果 → ホーム など） */
    replace(name, p, state) {
      Router.pendingState = state || null;
      history.replaceState(null, '', buildHash(name, p));
      Router.render();
    },

    async handleHashChange() {
      if (suppressNext) {
        suppressNext = false;
        return;
      }
      // 画面側で「離れてよいか」を確認できる（クイズ中など）
      if (current && current.def.canLeave) {
        const target = parseHash();
        if (target.name !== current.name) {
          const ok = await current.def.canLeave();
          if (!ok) {
            suppressNext = true;
            history.pushState(null, '', buildHash(current.name, params));
            suppressNext = false;
            return;
          }
        }
      }
      Router.render();
    },

    render() {
      const { name, params: p } = parseHash();
      const profile = KA.Profiles.active();
      let target = name;
      if (!screens[target]) target = profile ? 'home' : 'welcome';
      if (screens[target].requiresProfile !== false && !profile) target = KA.Profiles.list().length ? 'profiles' : 'welcome';

      if (current && current.def.onLeave) {
        try {
          current.def.onLeave();
        } catch (e) {
          console.error(e);
        }
      }
      params = p;
      const def = screens[target];
      current = { name: target, def };
      const state = Router.pendingState;
      Router.pendingState = null;

      KA.UI.closeTopModal();
      KA.UI.applyDisplayMode();
      KA.UI.renderHeader();
      const container = document.getElementById('app');
      KA.UI.clear(container);
      container.className = 'screen screen-' + target;
      document.title = (def.title ? def.title + ' | ' : '') + KA.APP_NAME;
      try {
        def.render(container, p, state);
      } catch (e) {
        console.error('[Router] render failed:', target, e);
        container.appendChild(
          KA.UI.h(
            'div',
            { class: 'card error-card' },
            KA.UI.h('h2', null, '画面を表示できませんでした'),
            KA.UI.h('p', null, 'もう一度ためすか、ホームにもどってください。'),
            KA.UI.h('button', { class: 'btn btn-primary', type: 'button', onclick: () => Router.go('home') }, 'ホームへ')
          )
        );
      }
      window.scrollTo(0, 0);
    },

    start() {
      window.addEventListener('hashchange', () => Router.handleHashChange());
      Router.render();
    },
  };

  KA.Router = Router;
  KA.Screens = { register: Router.register };
})(window.KanjiApp);
