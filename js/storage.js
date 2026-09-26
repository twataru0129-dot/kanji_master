/*
 * データ保存（Storage）
 * ------------------------------------------------------------
 * すべての学習データは localStorage の 1 つのキー「kanjiAppData」にまとめて保存します。
 *
 *   kanjiAppData = {
 *     dataVersion: 1,          // 保存形式のバージョン（アプリのバージョンとは別）
 *     appVersion: '1.0.0',     // 最後に保存したアプリのバージョン
 *     createdAt, updatedAt,
 *     settings: { activeProfileId, sound, ... },
 *     profileOrder: [id, ...],
 *     profiles: { [id]: profile }   // 学習記録・習熟度・称号はプロフィールごと
 *   }
 *
 * 将来 Firebase などに移行する場合は「adapter」を差し替えるだけで済むように、
 * 実際の読み書きは adapter 経由で行います。
 *
 * 保存形式を変えるときは:
 *   1. CURRENT_DATA_VERSION を 1 つ上げる
 *   2. MIGRATIONS に「旧バージョン → 新バージョン」の変換関数を追加する
 * 既存ユーザーのデータは読み込み時に自動で変換されます。
 */
(function (KA) {
  'use strict';

  const STORAGE_KEY = 'kanjiAppData';
  const PREV_BACKUP_KEY = 'kanjiAppData_beforeImport';
  const CORRUPT_PREFIX = 'kanjiAppData_corrupt_';
  const CURRENT_DATA_VERSION = 1;
  const EXPORT_FORMAT = 'kanji-master-backup';

  /** localStorage を使う保存先 */
  const LocalStorageAdapter = {
    name: 'localStorage',
    available() {
      try {
        const k = '__kanjiApp_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    },
    read(key) {
      return window.localStorage.getItem(key);
    },
    write(key, value) {
      window.localStorage.setItem(key, value);
    },
    remove(key) {
      window.localStorage.removeItem(key);
    },
  };

  /** localStorage が使えない環境（プライベートモード等）用のメモリ保存 */
  const MemoryAdapter = {
    name: 'memory',
    _data: {},
    available() {
      return true;
    },
    read(key) {
      return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
    },
    write(key, value) {
      this._data[key] = value;
    },
    remove(key) {
      delete this._data[key];
    },
  };

  /**
   * 保存形式のマイグレーション
   * キー: 変換前の dataVersion / 値: data を受け取り新形式に書き換える関数
   * 例) 2: (data) => { ...; data.dataVersion = 3; }
   */
  const MIGRATIONS = {
    0: (data) => {
      // dataVersion が無い（ごく初期・破損気味）データを v1 の形に整える
      data.settings = data.settings || {};
      data.profiles = data.profiles || {};
      data.profileOrder = data.profileOrder || Object.keys(data.profiles);
      data.dataVersion = 1;
    },
  };

  function createEmptyData() {
    const now = Date.now();
    return {
      dataVersion: CURRENT_DATA_VERSION,
      appVersion: KA.APP_VERSION,
      createdAt: now,
      updatedAt: now,
      settings: {
        activeProfileId: null,
        sound: true,
      },
      profileOrder: [],
      profiles: {},
    };
  }

  function migrate(data) {
    let guard = 0;
    if (typeof data.dataVersion !== 'number') data.dataVersion = 0;
    while (data.dataVersion < CURRENT_DATA_VERSION && guard < 100) {
      const fn = MIGRATIONS[data.dataVersion];
      if (!fn) throw new Error('No migration from dataVersion ' + data.dataVersion);
      fn(data);
      guard++;
    }
    return data;
  }

  /** 構造が壊れていないか確認し、足りない部分を補う */
  function sanitize(data) {
    const U = KA.Utils;
    if (!U.isPlainObject(data)) throw new Error('data is not an object');
    const base = createEmptyData();
    data.settings = Object.assign(base.settings, U.isPlainObject(data.settings) ? data.settings : {});
    if (!U.isPlainObject(data.profiles)) data.profiles = {};
    if (!Array.isArray(data.profileOrder)) data.profileOrder = [];
    // profileOrder と profiles の食い違いを直す
    data.profileOrder = data.profileOrder.filter((id) => data.profiles[id]);
    Object.keys(data.profiles).forEach((id) => {
      if (!U.isPlainObject(data.profiles[id])) {
        delete data.profiles[id];
      } else if (!data.profileOrder.includes(id)) {
        data.profileOrder.push(id);
      }
    });
    if (data.settings.activeProfileId && !data.profiles[data.settings.activeProfileId]) {
      data.settings.activeProfileId = null;
    }
    data.createdAt = data.createdAt || Date.now();
    Store.normalizers.forEach((fn) => fn(data));
    return data;
  }

  const Store = {
    STORAGE_KEY,
    CURRENT_DATA_VERSION,
    adapter: LocalStorageAdapter,
    data: null,
    normalizers: [],
    /** 起動時に見つかった問題（破損など）。UI で通知する */
    warnings: [],
    lastSaveError: null,

    /** データの補正処理を登録（プロフィールの欠損項目の補完など） */
    registerNormalizer(fn) {
      this.normalizers.push(fn);
    },

    load() {
      if (!this.adapter.available()) {
        this.adapter = MemoryAdapter;
        this.warnings.push('この環境ではデータを保存できません（プライベートブラウズなど）。アプリを閉じると記録は消えます。');
      }
      let raw = null;
      try {
        raw = this.adapter.read(STORAGE_KEY);
      } catch (e) {
        raw = null;
      }
      if (!raw) {
        this.data = sanitize(createEmptyData());
        return this.data;
      }
      try {
        const parsed = JSON.parse(raw);
        this.data = sanitize(migrate(parsed));
        if (parsed.dataVersion !== CURRENT_DATA_VERSION) this.save();
      } catch (e) {
        // 破損したデータは消さずに別キーへ退避してから新しく始める
        console.error('[Store] saved data is broken:', e);
        try {
          this.adapter.write(CORRUPT_PREFIX + Date.now(), raw);
        } catch (e2) {
          /* 容量不足などで退避できなくても続行 */
        }
        this.warnings.push('保存データが読み込めなかったため、新しいデータで開始しました（元のデータは端末内に退避済みです）。');
        this.data = sanitize(createEmptyData());
        this.save();
      }
      return this.data;
    },

    save() {
      if (!this.data) return false;
      this.data.updatedAt = Date.now();
      this.data.appVersion = KA.APP_VERSION;
      try {
        this.adapter.write(STORAGE_KEY, JSON.stringify(this.data));
        this.lastSaveError = null;
        return true;
      } catch (e) {
        console.error('[Store] save failed:', e);
        this.lastSaveError = e;
        if (KA.UI && KA.UI.toast) {
          KA.UI.toast('データを保存できませんでした。端末の空き容量を確認してください。', 'error');
        }
        return false;
      }
    },

    get settings() {
      return this.data.settings;
    },

    /* ---------------- バックアップ ---------------- */

    /** 書き出し用の JSON 文字列 */
    exportJSON(profileId) {
      const payload = KA.Utils.deepClone(this.data);
      if (profileId) {
        // 1 人分だけ書き出す
        payload.profiles = { [profileId]: payload.profiles[profileId] };
        payload.profileOrder = [profileId];
        payload.settings.activeProfileId = profileId;
      }
      return JSON.stringify(
        {
          format: EXPORT_FORMAT,
          app: KA.APP_NAME,
          appVersion: KA.APP_VERSION,
          dataVersion: CURRENT_DATA_VERSION,
          exportedAt: new Date().toISOString(),
          data: payload,
        },
        null,
        1
      );
    },

    /**
     * バックアップ JSON を解析・検証する（まだ反映しない）
     * @returns {{data: object, profileCount: number, exportedAt: string}}
     */
    parseBackup(text) {
      let obj;
      try {
        obj = JSON.parse(text);
      } catch (e) {
        throw new Error('ファイルの形式が正しくありません（JSONではありません）。');
      }
      const data = obj && obj.format === EXPORT_FORMAT ? obj.data : obj;
      if (!KA.Utils.isPlainObject(data) || !KA.Utils.isPlainObject(data.profiles)) {
        throw new Error('このアプリのバックアップファイルではないようです。');
      }
      if (typeof data.dataVersion === 'number' && data.dataVersion > CURRENT_DATA_VERSION) {
        throw new Error('新しいバージョンのアプリで作られたファイルです。アプリを更新してから読み込んでください。');
      }
      const migrated = sanitize(migrate(KA.Utils.deepClone(data)));
      return {
        data: migrated,
        profileCount: migrated.profileOrder.length,
        exportedAt: obj.exportedAt || null,
      };
    },

    /**
     * バックアップを反映
     * mode: 'replace' = すべて置き換え / 'merge' = プロフィールを追加（同じIDは上書き）
     */
    applyBackup(parsed, mode) {
      // 読み込み前の状態を 1 つだけ保険として残す
      try {
        this.adapter.write(PREV_BACKUP_KEY, JSON.stringify(this.data));
      } catch (e) {
        /* 容量不足時は保険なしで続行 */
      }
      if (mode === 'merge') {
        parsed.data.profileOrder.forEach((id) => {
          this.data.profiles[id] = parsed.data.profiles[id];
          if (!this.data.profileOrder.includes(id)) this.data.profileOrder.push(id);
        });
        if (!this.data.settings.activeProfileId) {
          this.data.settings.activeProfileId = parsed.data.profileOrder[0] || null;
        }
      } else {
        this.data = parsed.data;
      }
      this.data = sanitize(this.data);
      return this.save();
    },

    /** すべてのデータを消去 */
    resetAll() {
      this.data = sanitize(createEmptyData());
      return this.save();
    },
  };

  KA.Store = Store;
})(window.KanjiApp);
