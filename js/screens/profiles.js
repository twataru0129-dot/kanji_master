/*
 * 画面: はじめての起動 / プロフィール選択 / プロフィール作成・編集
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const Profiles = KA.Profiles;

  /* ---------------- はじめての起動 ---------------- */
  KA.Screens.register('welcome', {
    title: 'ようこそ',
    requiresProfile: false,
    render(el) {
      if (Profiles.active()) return KA.Router.replace('home');
      el.appendChild(
        h(
          'div',
          { class: 'welcome' },
          h('img', { src: 'assets/icons/kanji-icon-512.png', alt: '漢字マスターのアイコン', class: 'welcome-icon', width: '160', height: '160' }),
          h('h1', { class: 'welcome-title' }, 'ようこそ！'),
          h('p', { class: 'welcome-lead' }, '漢字をあつめて、称号やメダルをゲットしよう。'),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => KA.Router.go('profile-new') }, '✏️ プロフィールを作ろう！'),
          Profiles.list().length
            ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.go('profiles') }, 'プロフィールをえらぶ')
            : null,
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => KA.Router.go('restore') }, 'バックアップから読み込む')
        )
      );
    },
  });

  /* ---------------- プロフィール選択 ---------------- */
  KA.Screens.register('profiles', {
    title: 'プロフィール',
    requiresProfile: false,
    render(el) {
      const list = Profiles.list();
      const active = Profiles.active();
      el.appendChild(KA.UI.screenHeader('だれが学習する？', { noBack: !active }));
      const grid = h('div', { class: 'profile-grid' });
      list.forEach((p) => {
        const title = KA.UI.titleName(p);
        const lv = KA.KanjiDB.getLevel(p.level);
        grid.appendChild(
          h(
            'button',
            {
              class: 'profile-card' + (active && active.id === p.id ? ' active' : ''),
              type: 'button',
              onclick: () => {
                Profiles.setActive(p.id);
                KA.Router.go('home');
              },
            },
            h('span', { class: 'profile-card-icon', 'aria-hidden': 'true' }, p.icon),
            h('span', { class: 'profile-card-name' }, p.name),
            title ? h('span', { class: 'profile-card-title' }, '「' + title + '」') : null,
            h('span', { class: 'profile-card-meta' }, (lv ? lv.label : '') + '・' + Profiles.DISPLAY_MODES[p.displayMode].label),
            active && active.id === p.id ? h('span', { class: 'profile-card-current' }, '使用中') : null
          )
        );
      });
      grid.appendChild(
        h(
          'button',
          { class: 'profile-card profile-card-add', type: 'button', onclick: () => KA.Router.go('profile-new') },
          h('span', { class: 'profile-card-icon', 'aria-hidden': 'true' }, '＋'),
          h('span', { class: 'profile-card-name' }, '新しいプロフィール')
        )
      );
      el.appendChild(grid);
      if (active) {
        el.appendChild(
          h(
            'div',
            { class: 'center-row' },
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.go('profile-edit') }, '⚙️ ' + active.name + ' の設定を変える')
          )
        );
      }
    },
  });

  /* ---------------- 作成・編集フォーム ---------------- */
  function profileForm(el, profile, isNew) {
    const values = {
      name: profile ? profile.name : '',
      icon: profile ? profile.icon : Profiles.ICONS[Math.floor(Math.random() * 12)],
      level: profile ? profile.level : 'e1',
      inputMethod: profile ? profile.inputMethod : 'hiragana',
      displayMode: profile ? profile.displayMode : 'kids',
      showKanaPad: profile ? profile.showKanaPad !== false : true,
    };

    el.appendChild(
      KA.UI.screenHeader(isNew ? 'プロフィールを作ろう！' : 'プロフィールの設定', {
        noBack: isNew && !Profiles.list().length,
        backTo: isNew ? 'profiles' : 'settings',
      })
    );

    const form = h('form', { class: 'profile-form card', novalidate: true });

    // なまえ
    const nameInput = h('input', {
      type: 'text',
      id: 'pf-name',
      class: 'text-input',
      maxlength: '20',
      autocomplete: 'off',
      placeholder: 'れい：たろう',
      value: values.name,
    });
    form.appendChild(h('div', { class: 'form-group' }, h('label', { for: 'pf-name', class: 'form-label' }, 'なまえ（表示名）'), nameInput));

    // アイコン
    const iconGrid = h('div', { class: 'icon-picker', role: 'radiogroup', 'aria-label': 'アイコン' });
    const renderIcons = () => {
      KA.UI.clear(iconGrid);
      Profiles.ICONS.forEach((ic) => {
        iconGrid.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'icon-option' + (values.icon === ic ? ' selected' : ''),
              role: 'radio',
              'aria-checked': values.icon === ic ? 'true' : 'false',
              'aria-label': 'アイコン ' + ic,
              onclick: () => {
                values.icon = ic;
                renderIcons();
              },
            },
            ic
          )
        );
      });
    };
    renderIcons();
    form.appendChild(h('div', { class: 'form-group' }, h('div', { class: 'form-label' }, 'アイコン'), iconGrid));

    // 学習レベル
    const levelWrap = h('div', { class: 'form-group' }, h('div', { class: 'form-label' }, 'いまの学習レベル'));
    const renderLevels = () => {
      const tabs = KA.UI.levelTabs(
        values.level,
        (id) => {
          values.level = id;
          levelWrap.replaceChild(renderLevels(), levelWrap.lastChild);
        },
        { showUnavailable: true }
      );
      return tabs;
    };
    levelWrap.appendChild(renderLevels());
    form.appendChild(levelWrap);

    // 選択カード（入力方式・表示モード）
    const choiceCards = (label, options, key, onChange) => {
      const group = h('div', { class: 'choice-cards', role: 'radiogroup', 'aria-label': label });
      const render = () => {
        KA.UI.clear(group);
        Object.keys(options).forEach((k) => {
          const selected = values[key] === k;
          group.appendChild(
            h(
              'button',
              {
                type: 'button',
                class: 'choice-card' + (selected ? ' selected' : ''),
                role: 'radio',
                'aria-checked': selected ? 'true' : 'false',
                onclick: () => {
                  values[key] = k;
                  render();
                  if (onChange) onChange();
                },
              },
              h('span', { class: 'choice-check', 'aria-hidden': 'true' }, selected ? '●' : '○'),
              h('span', { class: 'choice-title' }, options[k].label),
              h('span', { class: 'choice-desc' }, options[k].desc)
            )
          );
        });
      };
      render();
      return h('div', { class: 'form-group' }, h('div', { class: 'form-label' }, label), group);
    };

    const padToggle = h('label', { class: 'toggle-row' });
    const renderPadToggle = () => {
      KA.UI.clear(padToggle);
      padToggle.style.display = values.inputMethod === 'hiragana' ? '' : 'none';
      const cb = h('input', { type: 'checkbox', checked: values.showKanaPad });
      cb.addEventListener('change', () => {
        values.showKanaPad = cb.checked;
      });
      padToggle.appendChild(cb);
      padToggle.appendChild(h('span', null, 'アプリの大きなひらがなパネルを使う（オフにするとスマホのキーボード）'));
    };
    renderPadToggle();

    form.appendChild(choiceCards('こたえかた（入力方式）', Profiles.INPUT_METHODS, 'inputMethod', renderPadToggle));
    form.appendChild(padToggle);
    form.appendChild(choiceCards('画面の表示', Profiles.DISPLAY_MODES, 'displayMode'));

    const submit = h('button', { class: 'btn btn-primary btn-xl', type: 'submit' }, isNew ? 'この内容で はじめる！' : '保存する');
    form.appendChild(h('div', { class: 'btn-row' }, submit));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      values.name = nameInput.value.trim();
      if (!values.name) {
        KA.UI.toast('なまえを入れてください', 'error');
        nameInput.focus();
        return;
      }
      if (isNew) {
        const p = Profiles.create(values);
        KA.Learning.checkEvents(p);
        KA.UI.toast(`${p.name} さんのプロフィールを作りました`, 'success');
        KA.Router.go('home');
      } else {
        Profiles.update(profile.id, values);
        KA.UI.toast('保存しました', 'success');
        KA.Router.go('settings');
      }
    });

    el.appendChild(form);
    if (isNew) setTimeout(() => nameInput.focus(), 50);
  }

  KA.Screens.register('profile-new', {
    title: 'プロフィール作成',
    requiresProfile: false,
    render(el) {
      profileForm(el, null, true);
    },
  });

  KA.Screens.register('profile-edit', {
    title: 'プロフィール編集',
    render(el) {
      profileForm(el, Profiles.active(), false);
    },
  });
})(window.KanjiApp);
