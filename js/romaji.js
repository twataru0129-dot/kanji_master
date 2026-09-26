/*
 * ローマ字 → ひらがな 変換
 * 日本語入力（IME）をオフのまま「gakkou」と打っても「がっこう」として判定できるようにする。
 */
(function (KA) {
  'use strict';

  const TABLE = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
    wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', kye: 'きぇ', kyi: 'きぃ',
    sya: 'しゃ', syu: 'しゅ', syo: 'しょ', sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ',
    tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ',
    cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ', ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ',
    jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
    dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    tsa: 'つぁ', thi: 'てぃ', dhi: 'でぃ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
    xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtu: 'っ', xtsu: 'っ', xwa: 'ゎ',
    lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', ltu: 'っ', ltsu: 'っ', lwa: 'ゎ',
    nn: 'ん', "n'": 'ん', xn: 'ん',
    '-': 'ー',
  };

  const VOWELS = 'aiueo';

  const Romaji = {
    /** 英字が含まれているか */
    hasLatin(str) {
      return /[a-zA-Z]/.test(String(str));
    },

    /**
     * ローマ字をひらがなに変換
     * @param {string} input
     * @param {boolean} finalize true のとき末尾の n を ん にする
     */
    toHiragana(input, finalize) {
      const s = String(input).toLowerCase();
      let out = '';
      let i = 0;
      while (i < s.length) {
        const ch = s[i];
        if (!/[a-z'-]/.test(ch)) {
          out += ch;
          i++;
          continue;
        }
        // 促音: 同じ子音が続く（n 以外）
        if (ch === s[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(ch) && ch !== 'n') {
          out += 'っ';
          i++;
          continue;
        }
        // n の後に母音・y 以外が来たら ん
        if (ch === 'n') {
          const next = s[i + 1];
          if (next === undefined) {
            out += finalize ? 'ん' : 'n';
            i++;
            continue;
          }
          if (next !== 'n' && next !== "'" && next !== 'y' && !VOWELS.includes(next)) {
            out += 'ん';
            i++;
            continue;
          }
        }
        let matched = false;
        for (let len = 4; len >= 1; len--) {
          const part = s.substr(i, len);
          if (TABLE[part]) {
            out += TABLE[part];
            i += len;
            matched = true;
            break;
          }
        }
        if (!matched) {
          out += ch;
          i++;
        }
      }
      return out;
    },
  };

  KA.Romaji = Romaji;
})(window.KanjiApp);
