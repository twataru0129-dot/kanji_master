/*
 * 画面: 設定 / バックアップ・復元
 */
(function (KA) {
  'use strict';

  const { h } = KA.UI;
  const U = KA.Utils;

  /* ---------------- バックアップ（書き出し） ---------------- */
  function downloadBackup(profileId) {
    const json = KA.Store.exportJSON(profileId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const p = profileId ? KA.Profiles.get(profileId) : null;
    const stamp = U.dateKey().replace(/-/g, '');
    const a = h('a', { href: url, download: `kanji-master-backup-${p ? p.name + '-' : ''}${stamp}.json` });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
    const active = KA.Profiles.active();
    if (active) {
      active.counters.flags.backup = true;
      KA.Learning.checkEvents(active);
    }
    KA.UI.toast('学習データを書き出しました', 'success');
  }

  /* ---------------- 復元（読み込み） ---------------- */
  function restoreSection() {
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'restore-file' });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let parsed;
        try {
          parsed = KA.Store.parseBackup(String(reader.result));
        } catch (e) {
          KA.UI.toast(e.message, 'error');
          fileInput.value = '';
          return;
        }
        const names = parsed.data.profileOrder.map((id) => parsed.data.profiles[id].name).join('、');
        const hasCurrent = KA.Profiles.list().length > 0;
        let mode = 'replace';
        if (hasCurrent) {
          const merge = await KA.UI.confirm({
            icon: '📥',
            title: '読み込み方法をえらんでください',
            message: `ファイルのプロフィール：${names}（${parsed.profileCount}人）\n「追加する」＝今のデータを残して追加（同じプロフィールは上書き）\n「置きかえる」＝今のデータをすべて置きかえ`,
            okLabel: '追加する',
            cancelLabel: '置きかえる…',
          });
          mode = merge ? 'merge' : 'replace';
          if (mode === 'replace') {
            const ok = await KA.UI.confirm({
              title: '本当に置きかえますか？',
              message: '今この端末にある学習データはすべて、ファイルの内容に置きかわります。',
              okLabel: '置きかえる',
              danger: true,
            });
            if (!ok) {
              fileInput.value = '';
              return;
            }
          }
        }
        if (KA.Store.applyBackup(parsed, mode)) {
          KA.UI.toast('学習データを読み込みました', 'success');
          KA.Router.go(KA.Profiles.active() ? 'home' : 'profiles');
        }
        fileInput.value = '';
      };
      reader.onerror = () => KA.UI.toast('ファイルを読み込めませんでした', 'error');
      reader.readAsText(file);
    });
    return h(
      'div',
      { class: 'form-group' },
      fileInput,
      h('label', { for: 'restore-file', class: 'btn btn-secondary file-label', role: 'button', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, '📥 学習データを読み込む'),
      h('p', { class: 'muted small' }, 'バックアップファイル（.json）を選ぶと、プロフィール・学習記録・習熟度・称号を復元できます。')
    );
  }

  KA.Screens.register('restore', {
    title: 'データの読み込み',
    requiresProfile: false,
    render(el) {
      el.appendChild(KA.UI.screenHeader('学習データを読み込む', { backTo: KA.Profiles.active() ? 'settings' : 'welcome' }));
      el.appendChild(h('section', { class: 'card' }, restoreSection()));
    },
  });

  /* ---------------- 設定 ---------------- */
  KA.Screens.register('settings', {
    title: '設定',
    render(el) {
      const p = KA.Profiles.active();
      const settings = KA.Store.settings;
      el.appendChild(KA.UI.screenHeader('設定'));

      // プロフィール
      const lv = KA.KanjiDB.getLevel(p.level);
      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'プロフィール'),
          h(
            'div',
            { class: 'settings-profile' },
            h('span', { class: 'hero-avatar small', 'aria-hidden': 'true' }, p.icon),
            h(
              'div',
              null,
              h('div', { class: 'hero-name' }, p.name),
              h('div', { class: 'muted small' }, `${lv ? lv.label : ''}・${KA.Profiles.INPUT_METHODS[p.inputMethod].label}・${KA.Profiles.DISPLAY_MODES[p.displayMode].label}`)
            )
          ),
          h(
            'div',
            { class: 'btn-row wrap' },
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => KA.Router.go('profile-edit') }, '✏️ プロフィールを編集'),
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.go('profiles') }, '👥 プロフィールを切りかえ・追加')
          )
        )
      );

      // 効果音
      const soundCb = h('input', { type: 'checkbox', checked: !!settings.sound });
      soundCb.addEventListener('change', () => {
        settings.sound = soundCb.checked;
        KA.Store.save();
        if (soundCb.checked) KA.Sound.play('correct');
      });
      el.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'アプリ'), h('label', { class: 'toggle-row' }, soundCb, h('span', null, '効果音を鳴らす'))));

      // バックアップ
      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'バックアップ'),
          h('p', { class: 'small' }, '学習データはこの端末のブラウザの中に保存されています。別の端末とは自動で同期されません。機種変更やブラウザのデータ削除にそなえて、ときどき書き出しておきましょう。'),
          h(
            'div',
            { class: 'btn-row wrap' },
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => downloadBackup(null) }, '📤 学習データを書き出す（全員分）'),
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => downloadBackup(p.id) }, `📤 ${p.name} の分だけ書き出す`)
          ),
          restoreSection()
        )
      );

      // データ消去
      el.appendChild(
        h(
          'section',
          { class: 'card danger-zone' },
          h('h2', { class: 'card-title' }, 'データの消去'),
          h(
            'div',
            { class: 'btn-row wrap' },
            h(
              'button',
              {
                class: 'btn btn-danger-outline',
                type: 'button',
                onclick: async () => {
                  const ok = await KA.UI.confirm({
                    title: '本当に学習データを初期化しますか？',
                    message: `${p.name} の学習記録・習熟度・称号・メダルがすべて消えます（名前や設定は残ります）。元に戻せません。`,
                    okLabel: '初期化する',
                    danger: true,
                  });
                  if (!ok) return;
                  KA.Profiles.resetLearning(p.id);
                  KA.Learning.checkEvents(p);
                  KA.UI.toast('学習データを初期化しました', 'success');
                  KA.Router.go('home');
                },
              },
              '学習データを初期化'
            ),
            h(
              'button',
              {
                class: 'btn btn-danger',
                type: 'button',
                onclick: async () => {
                  const ok = await KA.UI.confirm({
                    title: '本当に削除しますか？',
                    message: `プロフィール「${p.name}」とその学習データをすべて削除します。元に戻せません。`,
                    okLabel: '削除する',
                    danger: true,
                  });
                  if (!ok) return;
                  KA.Profiles.remove(p.id);
                  KA.UI.toast('プロフィールを削除しました', 'success');
                  KA.Router.go(KA.Profiles.active() ? 'profiles' : 'welcome');
                },
              },
              'このプロフィールを削除'
            )
          )
        )
      );

      // アプリ情報
      el.appendChild(
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'このアプリについて'),
          h('p', { class: 'small' }, `${KA.APP_NAME} v${KA.APP_VERSION}（更新日 ${U.formatDateKey(KA.APP_UPDATED)}）`),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => KA.Router.go('about') }, '📜 更新履歴・情報源・ライセンス')
        )
      );
    },
  });

  // プリントメーカーは js/screens/print.js（v1.4.0〜）

  KA.Backup = { download: downloadBackup };
})(window.KanjiApp);
