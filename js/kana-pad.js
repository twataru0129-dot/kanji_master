/*
 * ひらがな入力パネル
 * ------------------------------------------------------------
 * ローマ字入力が難しい子ども向けの、大きなひらがなキーボード。
 * マウス・タッチの両方で使えます。
 *
 * 使い方:
 *   const pad = KanaPad.create({ onInput(text), onSubmit() });
 *   container.appendChild(pad.el);
 *   pad.setValue('');
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;

  // 行（あ段〜お段）× 列（あ行〜わ行）
  const COLUMNS = [
    ['あ', 'い', 'う', 'え', 'お'],
    ['か', 'き', 'く', 'け', 'こ'],
    ['さ', 'し', 'す', 'せ', 'そ'],
    ['た', 'ち', 'つ', 'て', 'と'],
    ['な', 'に', 'ぬ', 'ね', 'の'],
    ['は', 'ひ', 'ふ', 'へ', 'ほ'],
    ['ま', 'み', 'む', 'め', 'も'],
    ['や', '', 'ゆ', '', 'よ'],
    ['ら', 'り', 'る', 'れ', 'ろ'],
    ['わ', '', 'を', '', 'ん'],
  ];

  const DAKUTEN = {
    か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
    た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
    う: 'ゔ',
  };
  const HANDAKUTEN = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
  const SMALL = { あ: 'ぁ', い: 'ぃ', う: 'ぅ', え: 'ぇ', お: 'ぉ', つ: 'っ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ', わ: 'ゎ' };

  function invert(map) {
    const out = {};
    Object.keys(map).forEach((k) => {
      out[map[k]] = k;
    });
    return out;
  }
  const UN_DAKUTEN = invert(DAKUTEN);
  const UN_HANDAKUTEN = invert(HANDAKUTEN);
  const UN_SMALL = invert(SMALL);

  /** 最後の文字を ゛→ ゜→ もとに戻す、の順に切り替える */
  function cycleDakuten(ch) {
    if (DAKUTEN[ch]) return DAKUTEN[ch];
    if (UN_DAKUTEN[ch]) {
      const base = UN_DAKUTEN[ch];
      return HANDAKUTEN[base] || base;
    }
    if (UN_HANDAKUTEN[ch]) return UN_HANDAKUTEN[ch];
    return ch;
  }

  function toggleSmall(ch) {
    if (SMALL[ch]) return SMALL[ch];
    if (UN_SMALL[ch]) return UN_SMALL[ch];
    return ch;
  }

  const KanaPad = {
    create(opts) {
      let value = '';
      const emit = () => opts.onInput && opts.onInput(value);
      const press = (fn) => (e) => {
        e.preventDefault();
        fn();
        KA.Sound.play('tap');
      };

      const grid = h('div', { class: 'kana-grid', role: 'group', 'aria-label': 'ひらがな' });
      // 列（あ行〜わ行）を左から順に並べ、各列の中を上から あいうえお
      for (let row = 0; row < 5; row++) {
        COLUMNS.forEach((col) => {
          const ch = col[row];
          if (!ch) {
            grid.appendChild(h('span', { class: 'kana-key kana-empty', 'aria-hidden': 'true' }));
            return;
          }
          grid.appendChild(
            h(
              'button',
              {
                class: 'kana-key',
                type: 'button',
                onclick: press(() => {
                  value += ch;
                  emit();
                }),
              },
              ch
            )
          );
        });
      }

      const modify = (fn) =>
        press(() => {
          if (!value) return;
          value = value.slice(0, -1) + fn(value.slice(-1));
          emit();
        });

      const tools = h(
        'div',
        { class: 'kana-tools' },
        h('button', { class: 'kana-key kana-tool', type: 'button', 'aria-label': 'だくてん・はんだくてん', onclick: modify(cycleDakuten) }, '゛゜'),
        h('button', { class: 'kana-key kana-tool', type: 'button', 'aria-label': 'ちいさい もじ', onclick: modify(toggleSmall) }, '小'),
        h('button', { class: 'kana-key kana-tool', type: 'button', 'aria-label': 'のばす', onclick: press(() => { value += 'ー'; emit(); }) }, 'ー'),
        h('button', { class: 'kana-key kana-tool kana-del', type: 'button', 'aria-label': '1もじ けす', onclick: press(() => { value = value.slice(0, -1); emit(); }) }, '⌫ けす'),
        h('button', { class: 'kana-key kana-tool kana-submit', type: 'button', onclick: (e) => { e.preventDefault(); if (opts.onSubmit) opts.onSubmit(); } }, 'こたえる')
      );

      const el = h('div', { class: 'kana-pad' }, grid, tools);
      return {
        el,
        setValue(v) {
          value = v || '';
        },
        getValue() {
          return value;
        },
        setDisabled(disabled) {
          el.querySelectorAll('button').forEach((b) => {
            b.disabled = !!disabled;
          });
        },
      };
    },
  };

  KA.KanaPad = KanaPad;
})(window.KanjiApp);
