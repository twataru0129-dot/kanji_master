/*
 * 画面: 称号・メダル（図鑑形式）
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;
  const A = KA.Achievements;

  function achievementCard(p, def, ctx, kids) {
    const got = p.achievements[def.id];
    const equipped = p.equippedTitle === def.id;
    if (got) {
      return h(
        'div',
        { class: 'title-card got' + (equipped ? ' equipped' : '') + (def.hidden ? ' hidden-title' : '') },
        h('div', { class: 'title-icon', 'aria-hidden': 'true' }, def.icon),
        h('div', { class: 'title-name' }, def.name),
        h('div', { class: 'title-desc' }, def.desc),
        h('div', { class: 'title-date' }, '取得日 ' + U.formatDate(got.at)),
        h(
          'button',
          {
            class: 'btn btn-small ' + (equipped ? 'btn-secondary' : 'btn-primary'),
            type: 'button',
            onclick: () => {
              KA.Profiles.equipTitle(p.id, equipped ? null : def.id);
              KA.UI.toast(equipped ? '称号をはずしました' : `称号「${def.name}」を装備しました`, 'success');
              KA.Learning.checkEvents(p);
              KA.Router.render();
            },
          },
          equipped ? '装備中（はずす）' : kids ? 'そうびする' : '装備する'
        )
      );
    }
    if (def.future) {
      return h('div', { class: 'title-card future' }, h('div', { class: 'title-icon', 'aria-hidden': 'true' }, def.icon), h('div', { class: 'title-name' }, def.name), h('div', { class: 'title-desc' }, def.desc));
    }
    if (def.hidden) {
      return h('div', { class: 'title-card locked' }, h('div', { class: 'title-icon silhouette', 'aria-hidden': 'true' }, '？'), h('div', { class: 'title-name' }, '？？？'), h('div', { class: 'title-desc' }, '隠し称号'));
    }
    const prog = A.progress(p, def, ctx);
    return h(
      'div',
      { class: 'title-card locked' },
      h('div', { class: 'title-icon silhouette', 'aria-hidden': 'true' }, def.icon),
      h('div', { class: 'title-name' }, '？？？'),
      h('div', { class: 'title-desc' }, def.desc),
      prog && prog[1] > 1
        ? h('div', { class: 'title-progress' }, KA.UI.progressBar(prog[0] / prog[1], def.desc), h('span', { class: 'small' }, `あと${Math.max(0, prog[1] - prog[0])}${def.unit || ''}で解除`))
        : null
    );
  }

  KA.Screens.register('titles', {
    title: '称号・メダル',
    render(el, params) {
      const p = KA.Profiles.active();
      const kids = p.displayMode === 'kids';
      let tab = params.tab === 'medals' ? 'medals' : 'titles';
      let cat = 'all';
      el.appendChild(KA.UI.screenHeader(kids ? 'しょうごう・メダル' : '称号・メダル'));

      const equipped = KA.UI.titleName(p);
      const medal = KA.Medals.current(p);
      el.appendChild(
        h(
          'section',
          { class: 'card equip-card' },
          h('div', { class: 'hero-avatar small', 'aria-hidden': 'true' }, p.icon),
          h(
            'div',
            null,
            h('div', { class: 'hero-name' }, p.name),
            h('div', { class: 'hero-title' }, equipped ? '称号「' + equipped + '」' : '称号：なし（下の一覧から装備できます）'),
            h('div', { class: 'muted small' }, `${Object.keys(p.achievements).length} / ${A.totalCount()} 個 獲得` + (medal ? `・${medal.icon}${medal.name}` : ''))
          )
        )
      );

      const tabs = h('div', { class: 'seg-tabs', role: 'tablist' });
      const body = h('div');
      el.appendChild(tabs);
      el.appendChild(body);

      const render = () => {
        KA.UI.clear(tabs);
        [
          ['titles', kids ? 'しょうごう' : '称号'],
          ['medals', 'メダル'],
        ].forEach(([id, label]) => {
          tabs.appendChild(
            h('button', { class: 'seg-tab' + (tab === id ? ' active' : ''), type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => { tab = id; render(); } }, label)
          );
        });
        KA.UI.clear(body);
        if (tab === 'medals') return renderMedals(body, p);

        const cats = h('div', { class: 'chip-filter' });
        [{ id: 'all', label: 'すべて' }, { id: 'got', label: '取得済み' }].concat(A.CATEGORIES).forEach((c) => {
          cats.appendChild(h('button', { class: 'filter-chip' + (cat === c.id ? ' active' : ''), type: 'button', onclick: () => { cat = c.id; render(); } }, c.label));
        });
        body.appendChild(cats);
        const ctx = A.buildContext(p);
        const grid = h('div', { class: 'title-grid' });
        A.DEFS.filter((d) => (cat === 'all' ? true : cat === 'got' ? !!p.achievements[d.id] : d.cat === cat)).forEach((def) => grid.appendChild(achievementCard(p, def, ctx, kids)));
        if (!grid.childNodes.length) grid.appendChild(h('p', { class: 'muted' }, 'まだありません'));
        body.appendChild(grid);
      };
      render();
    },
  });

  function renderMedals(body, p) {
    const v = KA.Medals.values(p);
    const next = KA.Medals.next(p);
    if (next) {
      body.appendChild(
        h(
          'div',
          { class: 'card' },
          h('h2', { class: 'card-title' }, `次のメダル：${next.tier.icon} ${next.tier.name}`),
          KA.UI.progressBar(next.ratio, '次のメダルまで'),
          h('p', { class: 'small' }, `正解 ${v.correct} / ${next.tier.correct}問` + (next.tier.mastered ? `・マスター ${v.mastered} / ${next.tier.mastered}字` : ''))
        )
      );
    }
    body.appendChild(
      h(
        'div',
        { class: 'medal-list' },
        KA.Medals.TIERS.map((t, i) => {
          const got = p.medals[t.id];
          return h(
            'div',
            { class: 'medal-card ' + (got ? 'got' : 'locked') + ' medal-' + t.id },
            h('div', { class: 'medal-icon', 'aria-hidden': 'true' }, got ? t.icon : '？'),
            h(
              'div',
              { class: 'medal-info' },
              h('div', { class: 'medal-name' }, `${i + 1}. ${t.name}メダル`),
              h('div', { class: 'medal-cond small' }, `条件：正解${t.correct}問` + (t.mastered ? `＋マスター${t.mastered}字` : '')),
              got ? h('div', { class: 'medal-date small' }, '獲得日 ' + U.formatDate(got.at)) : null
            ),
            i < KA.Medals.TIERS.length - 1 ? h('div', { class: 'medal-arrow', 'aria-hidden': 'true' }, '↓') : null
          );
        })
      )
    );
  }
})(window.KanjiApp);
