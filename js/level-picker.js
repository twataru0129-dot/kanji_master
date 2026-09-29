/*
 * 学習レベルのかんたん切り替え（ホーム画面のプロフィールカードから開く）
 * ------------------------------------------------------------
 * ・選べるレベルは KanjiDB.LEVELS から自動で作る（データがあるレベルだけ）。
 *   高校などのデータを registerLevel で追加すると、ここにも自動で並ぶ。
 * ・選んだレベルは、プロフィールの level（設定画面の「いまの学習レベル」と同じ値）を
 *   そのまま更新する。別の設定は持たない。学習記録・習熟度は変更しない。
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;

  const LevelPicker = {
    /** 選べるレベルを、グループ（小学校・中学校…）ごとにまとめる */
    groups() {
      const DB = KA.KanjiDB;
      const groups = [];
      DB.LEVELS.forEach((lv) => {
        if (!DB.isAvailable(lv.id)) return;
        let g = groups.find((x) => x.id === lv.group);
        if (!g) {
          g = { id: lv.group, levels: [] };
          groups.push(g);
        }
        g.levels.push(lv);
      });
      return groups;
    },

    /**
     * 学習レベルを変更する（プロフィールの level を更新）
     * @returns {boolean} 変更したかどうか
     */
    change(profile, levelId) {
      if (!profile || !KA.KanjiDB.isAvailable(levelId) || profile.level === levelId) return false;
      KA.Profiles.update(profile.id, { level: levelId });
      return true;
    },

    /** 選択用のモーダルを開く。変更したら onChanged(levelId) を呼ぶ */
    open(profile, onChanged) {
      const kids = profile.displayMode === 'kids';
      const now = Date.now();
      let modal = null;
      const GROUP_NAMES = { elementary: '小学校', junior: '中学校', high: '高校', rare: 'チャレンジ' };

      const select = (lv) => {
        const changed = LevelPicker.change(profile, lv.id);
        modal.close();
        if (!changed) return;
        KA.UI.toast(kids ? `${lv.label}に かわったよ！` : `学習レベルを${lv.label}に変更しました`, 'success');
        if (onChanged) onChanged(lv.id);
      };

      const body = h(
        'div',
        { class: 'level-picker' + (kids ? ' kids' : '') },
        h('h2', { class: 'level-picker-title' }, kids ? 'べんきょうする がくねん' : '学習レベルをえらぶ'),
        kids ? null : h('p', { class: 'muted small level-picker-note' }, '学習記録や習熟度は、学年を変えてもそのまま残ります。')
      );

      LevelPicker.groups().forEach((g) => {
        const list = h('div', { class: 'level-picker-list', role: 'group', 'aria-label': GROUP_NAMES[g.id] || g.id });
        g.levels.forEach((lv) => {
          const current = lv.id === profile.level;
          const rate = KA.Proficiency.levelSummary(profile, lv.id, now).rate;
          const name = kids ? lv.short : lv.label;
          list.appendChild(
            h(
              'button',
              {
                class: 'level-option' + (current ? ' current' : ''),
                type: 'button',
                style: { '--lv-color': lv.color },
                'aria-pressed': current ? 'true' : 'false',
                'aria-label': `${lv.label}${lv.official ? '' : '（目安）'}　習熟度 ${rate}%` + (current ? '　いま えらんでいます' : ''),
                onclick: () => select(lv),
              },
              h('span', { class: 'level-option-check', 'aria-hidden': 'true' }, current ? '✓' : ''),
              h('span', { class: 'level-option-name' }, name),
              kids
                ? null
                : h(
                    'span',
                    { class: 'level-option-rate', 'aria-hidden': 'true' },
                    h('span', { class: 'level-option-bar' }, h('span', { style: { width: rate + '%' } })),
                    rate + '%'
                  )
            )
          );
        });
        body.appendChild(
          h('section', { class: 'level-picker-group' }, h('h3', { class: 'level-picker-group-title' }, GROUP_NAMES[g.id] || g.id), list)
        );
      });

      modal = KA.UI.openModal(body, { className: 'modal-small level-picker-modal', label: kids ? 'がくねんを えらぶ' : '学習レベルをえらぶ' });
      // いま選んでいるレベルにフォーカス
      setTimeout(() => {
        const cur = body.querySelector('.level-option.current');
        if (cur) cur.focus();
      }, 40);
      return modal;
    },
  };

  KA.LevelPicker = LevelPicker;
})(window.KanjiApp);
