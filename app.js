/*
 * 漢字マスター 起動処理
 * ------------------------------------------------------------
 * 各機能は js/ と js/screens/ に分かれています。ここでは
 *   1. 保存データの読み込み（破損・移行の処理を含む）
 *   2. ヘッダー・バージョン表示
 *   3. 画面の表示開始
 *   4. PWA（Service Worker）の登録
 * だけを行います。
 */
(function (KA) {
  'use strict';

  function start() {
    KA.Store.load();

    KA.UI.renderVersionBadge();
    KA.Router.start();

    KA.Store.warnings.forEach((w) => KA.UI.toast(w, 'error'));

    // Esc でモーダルを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') KA.UI.closeTopModal();
    });

    // 別のタブでデータが変わったら読み込み直す
    window.addEventListener('storage', (e) => {
      if (e.key === KA.Store.STORAGE_KEY && KA.Router.current !== 'play') {
        KA.Store.load();
        KA.Router.render();
      }
    });

    registerServiceWorker();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[SW] register failed', e));
    });
  }

  // 予期しないエラーでも画面が真っ白にならないように記録だけ残す
  window.addEventListener('error', (e) => console.error('[App] error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.error('[App] unhandled:', e.reason));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.KanjiApp);
