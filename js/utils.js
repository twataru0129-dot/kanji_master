/*
 * 共通ユーティリティ
 * 日付・配列・かな変換・HTMLエスケープなど、どの機能からも使う小さな関数群。
 */
(function (KA) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;

  const Utils = {
    DAY_MS,

    /** ローカル日付の 'YYYY-MM-DD' */
    dateKey(date) {
      const d = date instanceof Date ? date : new Date(date == null ? Date.now() : date);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${m}-${day}`;
    },

    /** 'YYYY-MM-DD' 同士の日数差（b - a） */
    daysBetweenKeys(a, b) {
      const pa = a.split('-').map(Number);
      const pb = b.split('-').map(Number);
      const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
      const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
      return Math.round((db - da) / DAY_MS);
    },

    /** タイムスタンプから今までの経過日数（小数） */
    daysSince(ts, now) {
      if (!ts) return Infinity;
      return ((now || Date.now()) - ts) / DAY_MS;
    },

    /** 前日の 'YYYY-MM-DD' */
    prevDateKey(key) {
      const p = key.split('-').map(Number);
      return Utils.dateKey(new Date(p[0], p[1] - 1, p[2] - 1));
    },

    /** 9/26 のような短い日付 */
    formatShortDate(ts) {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },

    /** 2026/9/26 12:34 */
    formatDateTime(ts) {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
    },

    /** 2026/9/26 */
    formatDate(ts) {
      const d = new Date(ts);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },

    /** '2026-09-26' → '2026/9/26' */
    formatDateKey(key) {
      const p = String(key).split('-').map(Number);
      return p.length === 3 ? `${p[0]}/${p[1]}/${p[2]}` : String(key);
    },

    shuffle(array) {
      const a = array.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    sample(array, n) {
      return Utils.shuffle(array).slice(0, n);
    },

    unique(array) {
      return Array.from(new Set(array));
    },

    clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    },

    percent(part, total) {
      return total > 0 ? Math.round((part / total) * 100) : 0;
    },

    uid(prefix) {
      return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    isPlainObject(v) {
      return v !== null && typeof v === 'object' && !Array.isArray(v);
    },

    escapeHtml(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** カタカナ → ひらがな */
    kataToHira(str) {
      return String(str).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    },

    /** ひらがな → カタカナ */
    hiraToKata(str) {
      return String(str).replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    },

    /** 回答の正規化: 空白除去・全角英字→半角・カタカナ→ひらがな・小文字化 */
    normalizeAnswer(str) {
      let s = String(str == null ? '' : str);
      // 全角英数・半角カナなどの表記ゆれをそろえる（NFKC）
      if (s.normalize) s = s.normalize('NFKC');
      s = s.trim();
      s = s.replace(/[\s　]+/g, '');
      s = s.replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
      s = s.toLowerCase();
      return Utils.kataToHira(s);
    },

    /** 連続呼び出しを間引く */
    debounce(fn, wait) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },
  };

  KA.Utils = Utils;
})(window.KanjiApp);
