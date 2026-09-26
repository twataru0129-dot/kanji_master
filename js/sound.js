/*
 * 効果音
 * ------------------------------------------------------------
 * いまは Web Audio API で簡単な音を合成しています。
 * 音声ファイルを使いたくなったら SOUND_FILES にパスを書くと、そちらが優先されます。
 *   例) correct: 'assets/sounds/correct.mp3'
 */
(function (KA) {
  'use strict';

  const SOUND_FILES = {
    // correct: 'assets/sounds/correct.mp3',
  };

  /** 合成音の定義: [周波数Hz, 長さ秒, 開始秒] の並び */
  const SYNTH = {
    correct: { wave: 'sine', notes: [[880, 0.12, 0], [1318.5, 0.2, 0.1]] },
    wrong: { wave: 'triangle', notes: [[311, 0.18, 0], [233, 0.25, 0.14]] },
    tap: { wave: 'sine', notes: [[660, 0.05, 0]] },
    achievement: { wave: 'triangle', notes: [[784, 0.12, 0], [988, 0.12, 0.1], [1175, 0.12, 0.2], [1568, 0.35, 0.3]] },
    medal: { wave: 'sine', notes: [[523, 0.15, 0], [659, 0.15, 0.12], [784, 0.15, 0.24], [1047, 0.45, 0.36]] },
    finish: { wave: 'sine', notes: [[659, 0.12, 0], [784, 0.12, 0.12], [1047, 0.3, 0.24]] },
  };

  let ctx = null;
  const audioCache = {};

  function audioContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const Sound = {
    enabled() {
      return !!(KA.Store.data && KA.Store.settings.sound);
    },

    play(name) {
      if (!Sound.enabled()) return;
      try {
        if (SOUND_FILES[name]) {
          const a = audioCache[name] || (audioCache[name] = new Audio(SOUND_FILES[name]));
          a.currentTime = 0;
          a.play().catch(() => {});
          return;
        }
        const def = SYNTH[name];
        const ac = audioContext();
        if (!def || !ac) return;
        const t0 = ac.currentTime + 0.01;
        def.notes.forEach(([freq, dur, start]) => {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = def.wave;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t0 + start);
          gain.gain.exponentialRampToValueAtTime(0.18, t0 + start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
          osc.connect(gain).connect(ac.destination);
          osc.start(t0 + start);
          osc.stop(t0 + start + dur + 0.05);
        });
      } catch (e) {
        /* 音が出なくても学習には影響させない */
      }
    },
  };

  KA.Sound = Sound;
})(window.KanjiApp);
