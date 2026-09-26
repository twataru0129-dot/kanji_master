#!/usr/bin/env python3
"""
小学校漢字データ（data/kanji-grade1.js 〜 kanji-grade6.js）を生成するスクリプト。

アプリ本体はビルド不要で動作します。このスクリプトは「データを作り直したいとき」だけ使います。

入力:
  tools/sources/mext-grades-2020.json
      文部科学省「小学校学習指導要領（平成29年告示）」別表「学年別漢字配当表」（2020年度施行）
      学年ごとの漢字リスト（計1,026字）
  tools/sources/joyo-kanji.tsv
      文化庁「常用漢字表」（平成22年内閣告示）の音訓・部首・画数
      （npm: joyo-kanji-counts / MIT を経由して取得）
  --vocab <path>  （任意）
      JMdict（EDRDG, CC BY-SA 4.0）由来の常用語リスト JSON。
      熟語（compounds）の自動選定に使用します。
      例: npm パッケージ kotobako-data の kotobako-static.json
      省略した場合は、既存 data/ ファイル内の熟語をそのまま引き継ぎます。

使い方:
  python3 tools/build_kanji_data.py --vocab /path/to/kotobako-static.json
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sources')
OUT = os.path.join(ROOT, 'data')

# ---------------------------------------------------------------------------
# 部首
# 常用漢字表データの部首は康熙字典の旧字体基準のため、
# 日本の学習用漢字辞典で一般的な分類に一部置き換える。
# ---------------------------------------------------------------------------
RADICAL_OVERRIDE = {
    '体': '人', '余': '人', '会': '人', '台': '口', '欠': '欠', '予': '亅', '点': '火',
    '党': '儿', '来': '木', '写': '冖', '万': '一', '号': '口', '処': '几', '医': '匚',
    '区': '匚', '単': '十', '弁': '廾', '争': '亅', '旧': '日', '声': '士', '売': '士',
    '変': '夂', '当': '⺌', '県': '目', '巣': '木', '塩': '土', '帰': '巾', '歯': '歯',
    '営': '口', '並': '一', '両': '一', '巻': '己', '秘': '禾', '収': '又',
}
# 旧字体・異体の部首字を新字体に
RADICAL_NORMALIZE = {'靑': '青', '黃': '黄', '黑': '黒', '麥': '麦', '齒': '歯', '戶': '戸'}

# 部首の基本名
RADICAL_NAME = {
    '一': 'いち', '丨': 'たてぼう', '丶': 'てん', '丿': 'の', '乙': 'おつ', '亅': 'はねぼう',
    '二': 'に', '亠': 'なべぶた', '人': 'ひと', '儿': 'ひとあし', '入': 'いる', '八': 'はち',
    '冂': 'けいがまえ', '冖': 'わかんむり', '冫': 'にすい', '几': 'つくえ', '凵': 'うけばこ',
    '刀': 'かたな', '力': 'ちから', '勹': 'つつみがまえ', '匕': 'ひ', '匚': 'はこがまえ',
    '十': 'じゅう', '卩': 'ふしづくり', '厂': 'がんだれ', '厶': 'む', '又': 'また',
    '口': 'くち', '囗': 'くにがまえ', '土': 'つち', '士': 'さむらい', '夂': 'ふゆがしら',
    '夊': 'すいにょう', '夕': 'ゆうべ', '大': 'だい', '女': 'おんな', '子': 'こ',
    '宀': 'うかんむり', '寸': 'すん', '小': 'しょう', '⺌': 'しょう', '尢': 'だいのまげあし',
    '尸': 'しかばね', '山': 'やま', '巛': 'かわ', '工': 'たくみ', '己': 'おのれ', '巾': 'はば',
    '干': 'いちじゅう', '幺': 'いとがしら', '广': 'まだれ', '廴': 'えんにょう', '廾': 'にじゅうあし',
    '弋': 'しきがまえ', '弓': 'ゆみ', '彡': 'さんづくり', '彳': 'ぎょうにんべん', '心': 'こころ',
    '戈': 'ほこづくり', '戸': 'と', '手': 'て', '支': 'しにょう', '攴': 'のぶん', '文': 'ぶん',
    '斗': 'とます', '斤': 'おのづくり', '方': 'ほう', '日': 'ひ', '曰': 'ひらび', '月': 'つき',
    '木': 'き', '欠': 'あくび', '止': 'とめる', '歹': 'がつへん', '殳': 'るまた', '毋': 'なかれ',
    '比': 'くらべる', '毛': 'け', '氏': 'うじ', '气': 'きがまえ', '水': 'みず', '火': 'ひ',
    '爪': 'つめ', '父': 'ちち', '片': 'かた', '牛': 'うし', '犬': 'いぬ', '玄': 'げん',
    '玉': 'たま', '生': 'うまれる', '用': 'もちいる', '田': 'た', '疋': 'ひき',
    '疒': 'やまいだれ', '癶': 'はつがしら', '白': 'しろ', '皮': 'けがわ', '皿': 'さら',
    '目': 'め', '矢': 'や', '石': 'いし', '示': 'しめす', '禾': 'のぎ', '穴': 'あな',
    '立': 'たつ', '竹': 'たけ', '米': 'こめ', '糸': 'いと', '缶': 'ほとぎ', '网': 'あみがしら',
    '羊': 'ひつじ', '羽': 'はね', '老': 'おいかんむり', '耒': 'すきへん', '耳': 'みみ',
    '肉': 'にく', '臣': 'しん', '自': 'みずから', '至': 'いたる', '臼': 'うす', '舌': 'した',
    '舟': 'ふね', '艮': 'こんづくり', '色': 'いろ', '艸': 'くさかんむり', '虍': 'とらがしら',
    '虫': 'むし', '血': 'ち', '行': 'ぎょうがまえ', '衣': 'ころも', '襾': 'にし', '見': 'みる',
    '角': 'つの', '言': 'げん', '谷': 'たに', '豆': 'まめ', '豕': 'いのこ', '貝': 'かい',
    '赤': 'あか', '走': 'そうにょう', '足': 'あし', '身': 'み', '車': 'くるま', '辛': 'からい',
    '辰': 'しんのたつ', '辵': 'しんにょう', '邑': 'おおざと', '酉': 'とりへん', '里': 'さと',
    '金': 'かね', '長': 'ながい', '門': 'もんがまえ', '阜': 'こざとへん', '隹': 'ふるとり',
    '雨': 'あめかんむり', '青': 'あお', '非': 'あらず', '面': 'めん', '革': 'つくりがわ',
    '音': 'おと', '頁': 'おおがい', '風': 'かぜ', '飛': 'とぶ', '食': 'しょく', '首': 'くび',
    '香': 'かおり', '馬': 'うま', '骨': 'ほね', '高': 'たかい', '鬼': 'おに', '魚': 'うお',
    '鳥': 'とり', '鹵': 'しお', '鹿': 'しか', '麦': 'むぎ', '黄': 'き', '黒': 'くろ',
    '鼻': 'はな', '歯': 'は',
}

# 位置によって形・名前が変わる部首: 部首 -> (変化形, 名前, 基本形のまま使う漢字)
RADICAL_VARIANT = {
    '人': ('亻', 'にんべん', {'人': 'ひと', '以': 'ひと', '今': 'ひとやね', '令': 'ひとやね',
                              '会': 'ひとやね', '倉': 'ひとやね', '余': 'ひとやね'}),
    '刀': ('刂', 'りっとう', {'刀': 'かたな', '分': 'かたな', '切': 'かたな', '初': 'かたな', '券': 'かたな'}),
    '心': ('忄', 'りっしんべん', None),  # 下記 HEART_LEFT のみ変化形
    '手': ('扌', 'てへん', {'手': 'て', '挙': 'て', '承': 'て', '才': 'て'}),
    '水': ('氵', 'さんずい', {'水': 'みず', '氷': 'みず', '永': 'みず', '求': 'みず', '泉': 'みず'}),
    '火': ('灬', 'れっか', None),  # FIRE_* で個別指定
    '犬': ('犭', 'けものへん', {'犬': 'いぬ', '状': 'いぬ'}),
    '玉': ('王', 'おうへん', {'玉': 'たま', '王': 'たま'}),
    '示': ('礻', 'しめすへん', {'示': 'しめす', '票': 'しめす', '禁': 'しめす', '祭': 'しめす'}),
    '肉': ('月', 'にくづき', {'肉': 'にく'}),
    '艸': ('艹', 'くさかんむり', {}),
    '衣': ('衤', 'ころもへん', {'衣': 'ころも', '表': 'ころも', '製': 'ころも', '裁': 'ころも',
                               '装': 'ころも', '裏': 'ころも'}),
    '辵': ('辶', 'しんにょう', {}),
    '邑': ('阝', 'おおざと', {}),
    '阜': ('阝', 'こざとへん', {'阜': 'おか'}),
    '攴': ('攵', 'のぶん', {}),
    '网': ('罒', 'あみがしら', {}),
    '老': ('耂', 'おいかんむり', {'老': 'おいかんむり'}),
    '食': ('飠', 'しょくへん', {'食': 'しょく', '養': 'しょく'}),
}
HEART_LEFT = set('快慣情性')
FIRE_LEFT = set('焼灯燃')          # ひへん
FIRE_BOTTOM = set('熊照然熱無点熟')  # れっか（灬）

# 偏（へん）になる漢字: 部首 -> (名前, 漢字の集合)
HEN = {
    '言': ('ごんべん', None), '金': ('かねへん', None), '糸': ('いとへん', None),
    '木': ('きへん', None), '日': ('ひへん', set('時晴明曜暗暑昭映暖晩')),
    '月': ('つきへん', set('服')), '口': ('くちへん', set('味唱吸呼')),
    '土': ('つちへん', set('地坂埼城均境場増塩報域')), '女': ('おんなへん', set('姉妹始媛好婦')),
    '子': ('こへん', set('孫')), '石': ('いしへん', set('研確破砂磁')), '田': ('たへん', set('畑')),
    '足': ('あしへん', set('路')), '車': ('くるまへん', set('軽転輪輸')), '貝': ('かいへん', set('財')),
    '目': ('めへん', set('眼')), '禾': ('のぎへん', None), '米': ('こめへん', set('精粉糖')),
    '山': ('やまへん', set('岐崎')), '弓': ('ゆみへん', set('引強弱張')), '方': ('かたへん', set('族旅旗')),
    '牛': ('うしへん', set('物特牧')), '馬': ('うまへん', set('駅験')), '舟': ('ふねへん', set('船航')),
    '耳': ('みみへん', set('職')), '角': ('つのへん', set('解')), '矢': ('やへん', set('知短')),
    '巾': ('はばへん', set('帳')), '歹': ('がつへん', None), '酉': ('とりへん', None),
    '魚': ('うおへん', set()), '鳥': ('とり', set()),
}
# 偏の名前を使わない（部首そのもの、または下・上などに位置する）漢字
HEN_EXCEPT = {
    '言': set('言警'), '金': set('金'), '糸': set('糸系素'),
    '木': set('木本末未束東楽業案果条栄染査巣来'), '禾': set(),
}
KANMURI = {'竹': ('たけかんむり', {'竹': 'たけ'}), '雨': ('あめかんむり', {'雨': 'あめ'}),
           '穴': ('あなかんむり', {'穴': 'あな'})}


def radical_info(kanji, raw_radical):
    rad = RADICAL_OVERRIDE.get(kanji, raw_radical)
    rad = RADICAL_NORMALIZE.get(rad, rad)
    base_name = RADICAL_NAME.get(rad, '')
    if rad == '心':
        return ('忄', 'りっしんべん') if kanji in HEART_LEFT else ('心', 'こころ')
    if rad == '火':
        if kanji in FIRE_LEFT:
            return '火', 'ひへん'
        if kanji in FIRE_BOTTOM:
            return '灬', 'れっか'
        return '火', 'ひ'
    if rad in RADICAL_VARIANT:
        variant, vname, keep = RADICAL_VARIANT[rad]
        if keep and kanji in keep:
            return rad, keep[kanji]
        return variant, vname
    if rad in KANMURI:
        name, keep = KANMURI[rad]
        return rad, keep.get(kanji, name)
    if rad in HEN:
        name, members = HEN[rad]
        if members is None:
            if kanji in HEN_EXCEPT.get(rad, set()):
                return rad, base_name
            return rad, name
        if kanji in members:
            return rad, name
    return rad, base_name


# ---------------------------------------------------------------------------
# 例文（小学1年）: 1年生で習う漢字以外はひらがな
# ---------------------------------------------------------------------------
EXAMPLES_G1 = {
    '一': 'りんごを一つたべる。', '右': '右の手をあげる。', '雨': '雨がふってきた。',
    '円': '百円をはらう。', '王': '王さまがわらう。', '音': 'たいこの音がする。',
    '下': 'つくえの下にかくれる。', '火': 'ろうそくの火をけす。', '花': '花がさいた。',
    '貝': 'うみで貝をひろう。', '学': '学校へいく。', '気': 'きょうは天気がいい。',
    '九': '九じにねる。', '休': '休みの日にあそぶ。', '玉': '玉入れをする。',
    '金': '金いろのほし。', '空': '空があおい。', '月': '月がでている。',
    '犬': '犬とさんぽする。', '見': 'ほしを見る。', '五': '五人であそぶ。',
    '口': '口をあける。', '校': '校ていではしる。', '左': '左をむく。',
    '三': '三かいだてのいえ。', '山': '山にのぼる。', '子': '子どもがあそぶ。',
    '四': '四つばのクローバー。', '糸': '糸をむすぶ。', '字': 'ていねいに字をかく。',
    '耳': '耳をすます。', '七': '七人のこびと。', '車': '車にのる。', '手': '手をあらう。',
    '十': '十までかぞえる。', '出': 'そとに出る。', '女': '女の子がわらう。',
    '小': '小さな花がさく。', '上': '上をむいてあるく。', '森': '森のなかをあるく。',
    '人': '人がたくさんいる。', '水': '水をのむ。', '正': '正しいこたえをえらぶ。',
    '生': '一年生になった。', '青': '青い空がひろがる。', '夕': '夕がたになった。',
    '石': '石をひろう。', '赤': '赤いりんご。', '千': '千円さつ。', '川': '川であそぶ。',
    '先': '先生のはなしをきく。', '早': 'あさ早くおきる。', '草': '草をとる。',
    '足': '足がはやい。', '村': '村のまつり。', '大': '大きな木がある。',
    '男': '男の子がはしる。', '竹': '竹がのびる。', '中': 'はこの中を見る。',
    '虫': '虫をつかまえる。', '町': '町をあるく。', '天': '天気がいい。',
    '田': '田んぼに水をはる。', '土': '土をほる。', '二': '二かいにあがる。',
    '日': '日がのぼる。', '入': 'おふろに入る。', '年': '年がかわる。',
    '白': '白いくもがうかぶ。', '八': '八じにおきる。', '百': 'テストで百てんをとった。',
    '文': '文をよむ。', '木': '木にのぼる。', '本': '本をよむ。', '名': '名まえをかく。',
    '目': '目をとじる。', '立': '立ってあいさつする。', '力': '力いっぱいひく。',
    '林': '林をさんぽする。', '六': '六さいになった。',
}

# ---------------------------------------------------------------------------
# 熟語: 自動選定の除外・読み補正
# ---------------------------------------------------------------------------
COMPOUND_EXCLUDE = set('読売 鳴門 上田 米人 白人 中京 一二 七七日 九重 耳目 歌合 帰休 白羽 羽目 五体 四百 三女 一石 米国 '
                       '国分寺 読本 買取 黒海 北海 遠山 青山 青雲 実兄 義姉 義妹 弟妹 中耳 牛歩 仲買 夏場 冬場 秋口 '
                       '一丸 新興 世子 何分 細目 細分 紙上'.split())
# 自動選定で足りない・不自然な場合に手動で指定する熟語（自動選定より優先して先頭に入る）
MANUAL_COMPOUNDS = {
    '貝': [('貝がら', 'かいがら'), ('ほら貝', 'ほらがい')], '森': [('青森', 'あおもり')], '六': [('六月', 'ろくがつ')],
    '茨': [('茨城', 'いばらき')], '媛': [('愛媛', 'えひめ')], '熊': [('熊本', 'くまもと')],
    '鹿': [('鹿児島', 'かごしま')], '栃': [('栃木', 'とちぎ')], '梨': [('山梨', 'やまなし')],
    '奈': [('神奈川', 'かながわ')], '阜': [('岐阜', 'ぎふ')], '届': [('届け出', 'とどけで')],
    '肺': [('肺活量', 'はいかつりょう')], '暮': [('夕暮れ', 'ゆうぐれ')], '泣': [('泣き声', 'なきごえ')],
    '姉': [('お姉さん', 'おねえさん')], '妹': [('姉妹', 'しまい')], '丸': [('日の丸', 'ひのまる')],
    '坂': [('坂道', 'さかみち'), ('下り坂', 'くだりざか')], '湖': [('湖水', 'こすい')],
}
COMPOUND_REMOVE = {'暮': {'野暮'}}
COMPOUND_READING_FIX = {'一月': 'いちがつ', '下手': 'へた', '火口': 'かこう', '五分': 'ごふん'}


def kata_to_hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


def build_compounds(vocab_path, grade_of):
    data = json.load(open(vocab_path, encoding='utf-8'))
    vocab = data['datasets']['vocab'] if 'datasets' in data else data
    kanji_re = re.compile(r'^[一-鿿]{2,3}$')
    jlpt_weight = {'N5': 6, 'N4': 5, 'N3': 4, 'N2': 3, 'N1': 2}
    words, seen = [], set()
    for entry in vocab:
        w = entry['word']
        if not kanji_re.match(w) or w in seen or w in COMPOUND_EXCLUDE:
            continue
        r = COMPOUND_READING_FIX.get(w, kata_to_hira(entry['reading']))
        if not re.match(r'^[ぁ-ゖー]+$', r):
            continue
        seen.add(w)
        words.append((w, r, jlpt_weight.get(entry.get('jlpt'), 1)))
    result = {}
    for k, g in grade_of.items():
        cands = []
        for w, r, weight in words:
            if k not in w or not all(c in grade_of for c in w):
                continue
            max_grade = max(grade_of[c] for c in w)
            score = weight * 10 - (len(w) - 2) * 8 - max(0, max_grade - g) * 6 + (3 if w[0] == k else 0)
            cands.append((score, w, r))
        cands.sort(key=lambda t: -t[0])
        picked, used = [], set()
        for _, w, r in cands:
            others = set(w) - {k}
            if others & used:
                continue
            if w in COMPOUND_REMOVE.get(k, set()):
                continue
            picked.append({'word': w, 'reading': r})
            used |= others
            if len(picked) >= 4:
                break
        result[k] = picked
    return result


def apply_manual_compounds(compounds):
    for k, items in MANUAL_COMPOUNDS.items():
        cur = [c for c in compounds.get(k, []) if c['word'] not in COMPOUND_REMOVE.get(k, set())]
        words = {c['word'] for c in cur}
        manual = [{'word': w, 'reading': r} for w, r in items if w not in words]
        compounds[k] = (manual + cur)[:4]
    return compounds


def load_existing_compounds():
    """既存の data/kanji-gradeN.js から熟語を読み込む（--vocab 省略時用）"""
    result = {}
    for g in range(1, 7):
        path = os.path.join(OUT, f'kanji-grade{g}.js')
        if not os.path.exists(path):
            continue
        for line in open(path, encoding='utf-8'):
            line = line.strip().rstrip(',')
            if line.startswith('{"kanji"'):
                obj = json.loads(line)
                result[obj['kanji']] = obj.get('compounds', [])
    return result


def parse_readings(pron):
    """常用漢字表の音訓表記を分解。（ ）付きは特別な読み（使用範囲が限られる読み）"""
    on, kun, special = [], [], []
    for r in pron.split('|'):
        r = r.strip()
        if not r:
            continue
        is_special = r.startswith('（') or r.startswith('(')
        r = r.strip('（）()')
        is_on = bool(re.match(r'^[ァ-ヶー]+$', r))
        if is_special:
            special.append(r)
        elif is_on:
            on.append(r)
        else:
            kun.append(r)
    return on, kun, special


def okurigana_words(kanji, kun):
    out = []
    for r in kun:
        if '-' in r:
            stem, tail = r.split('-', 1)
            word = kanji + tail
            if word not in out:
                out.append(word)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vocab', help='JMdict 由来の語彙 JSON（熟語の自動選定に使用）')
    args = ap.parse_args()

    grades = json.load(open(os.path.join(SRC, 'mext-grades-2020.json'), encoding='utf-8'))
    joyo = {}
    for line in open(os.path.join(SRC, 'joyo-kanji.tsv'), encoding='utf-8'):
        cols = line.rstrip('\n').split('\t')
        if len(cols) >= 7:
            joyo[cols[1]] = cols
    grade_of = {k: int(g) for g, ks in grades.items() for k in ks}
    expected = {1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191}
    for g, n in expected.items():
        assert len(grades[str(g)]) == n, f'grade {g}: {len(grades[str(g)])} != {n}'
    assert len(grade_of) == 1026

    if args.vocab:
        compounds = build_compounds(args.vocab, grade_of)
    else:
        compounds = load_existing_compounds()
        if not compounds:
            sys.exit('熟語データがありません。--vocab を指定してください。')

    compounds = apply_manual_compounds(compounds)

    for g in range(1, 7):
        entries = []
        for k in grades[str(g)]:
            cols = joyo[k]
            on, kun, special = parse_readings(cols[6])
            radical, radical_name = radical_info(k, cols[2])
            entry = {
                'kanji': k,
                'officialGrade': g,
                'appLevel': f'小{g}',
                'onyomi': on,
                'kunyomi': kun,
                'specialReadings': special,
                'meanings': [],
                'radical': radical,
                'radicalName': radical_name,
                'strokes': int(cols[3]),
                'compounds': compounds.get(k, []),
                'okurigana': okurigana_words(k, kun),
                'exampleSentences': [EXAMPLES_G1[k]] if g == 1 and k in EXAMPLES_G1 else [],
                'difficulty': g,
                'source': 'MEXT',
            }
            entries.append(entry)
        lines = [json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in entries]
        body = ',\n'.join('  ' + l for l in lines)
        js = (
            '/*\n'
            f' * 小学{g}年の漢字（{len(entries)}字）\n'
            ' * 学年区分: 文部科学省「学年別漢字配当表」（小学校学習指導要領 平成29年告示・2020年度施行）\n'
            ' * 音訓・画数: 文化庁「常用漢字表」（平成22年内閣告示）\n'
            ' * 熟語: JMdict（© EDRDG, CC BY-SA 4.0）の常用語から自動選定\n'
            ' * このファイルは tools/build_kanji_data.py で生成しています。\n'
            ' * 手で修正した場合は、スクリプト側にも反映してください。\n'
            ' */\n'
            f"KanjiApp.KanjiDB.registerLevel('e{g}', [\n{body}\n]);\n"
        )
        with open(os.path.join(OUT, f'kanji-grade{g}.js'), 'w', encoding='utf-8') as f:
            f.write(js)
        print(f'grade {g}: {len(entries)} kanji')


if __name__ == '__main__':
    main()
