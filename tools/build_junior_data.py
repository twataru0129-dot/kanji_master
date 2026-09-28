#!/usr/bin/env python3
"""
中学校の漢字（data/kanji-junior1.js 〜 kanji-junior3.js）を生成するスクリプト。

・対象: 文化庁「常用漢字表」2,136字のうち、小学校の学年別漢字配当表 1,026字以外の 1,110字
・中1／中2／中3 の分け方は「このアプリ独自の学習レベル（目安）」です。公式の学年配当ではありません。
  難しさのスコア（小さいほどやさしい）で並べ、370字ずつに分けます。
    - 新聞などでの使用頻度の順位（よく使う漢字ほどやさしい）  … 重み 0.55
    - 日本語能力試験（JLPT）のレベル（N3 < N2 < N1 < 対象外）  … 重み 0.25
    - 画数（少ないほどやさしい）                                … 重み 0.10
    - 2010年に常用漢字に追加された字（曖・鬱 など）           … 重み 0.10
  使用頻度・JLPT レベルは davidluzgouveia/kanji-data（MIT License。KANJIDIC2 などに由来）を使います。

使い方:
  python3 tools/build_junior_data.py --kanji-data /path/to/kanji.json --vocab /path/to/kotobako-static.json
    --kanji-data : https://github.com/davidluzgouveia/kanji-data の kanji.json
    --vocab      : 熟語の選定に使う JMdict 由来の語彙 JSON（build_kanji_data.py と同じもの）
  小学校のデータ（data/kanji-grade*.js）は変更しません。
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_kanji_data as B  # noqa: E402  部首・読み・熟語の処理を共通で使う

LEVELS = [('j1', 1, '中1'), ('j2', 2, '中2'), ('j3', 3, '中3')]
JUNIOR_GRADE_BASE = 6  # 熟語の選定では 中1=7, 中2=8, 中3=9 として扱う

# 中学の漢字で新たに出てくる部首の名前
B.RADICAL_NAME.update({
    '彐': 'けいがしら', '鬯': 'においざけ', '牙': 'きば', '瓦': 'かわら', '甘': 'あまい', '韋': 'なめしがわ',
    '无': 'すでのつくり', '亀': 'かめ', '鼓': 'つづみ', '釆': 'のごめ', '斉': 'せい', '聿': 'ふでづくり',
    '卜': 'ぼく', '爻': 'めめ', '而': 'しこうして', '鬥': 'とうがまえ', '匸': 'かくしがまえ', '屮': 'てつ',
    '髟': 'かみがしら', '舛': 'まいあし', '豸': 'むじなへん', '麻': 'あさ', '矛': 'ほこ', '竜': 'りゅう',
    '隶': 'れいづくり', '鬼': 'おに', '黍': 'きび', '歯': 'は',
})
B.RADICAL_NORMALIZE.update({'龜': '亀', '齊': '斉', '龍': '竜', '\uFA3C': '屮'})

# 常用漢字表の部首は旧字体（康熙字典）の分類のため、新字体の形と合わないものを直す
JUNIOR_RADICAL_OVERRIDE = {'与': '一', '尽': '尸', '双': '又', '叙': '又', '寿': '寸', '弐': '弋'}
JUNIOR_RADICAL_FIXED = {'為': ('灬', 'れっか')}


def junior_radical(kanji, raw):
    """
    中学の漢字の部首名
    位置によって名前が変わる部首（水→さんずい 等）は、1字ずつの確認をしていないため
    「みず・さんずい」のように両方の名前を表示する（まちがった名前を出さないため）。
    """
    if kanji in JUNIOR_RADICAL_FIXED:
        return JUNIOR_RADICAL_FIXED[kanji]
    rad = JUNIOR_RADICAL_OVERRIDE.get(kanji, raw)
    rad = B.RADICAL_NORMALIZE.get(rad, rad)
    base = B.RADICAL_NAME.get(rad, '')
    if rad == '心':
        return rad, 'こころ・りっしんべん'
    if rad == '火':
        return rad, 'ひ・ひへん・れっか'
    if rad in B.RADICAL_VARIANT:
        variant, vname, _ = B.RADICAL_VARIANT[rad]
        if not base or base == vname:  # 辵→辶（しんにょう）など、形が1つに決まるもの
            return variant, vname
        return rad, f'{base}・{vname}'
    if rad in B.HEN and B.HEN[rad][0] != base:
        return rad, f'{base}・{B.HEN[rad][0]}'
    if rad in B.KANMURI:
        return rad, B.KANMURI[rad][0]
    return rad, base


def difficulty_score(kanji, cols, kd):
    info = kd.get(kanji, {})
    freq = info.get('freq') or 2600
    jlpt = info.get('jlpt_new')
    jlpt_v = {3: 0.0, 2: 0.3, 1: 0.7}.get(jlpt, 1.0)
    strokes = min(int(cols[3]), 25) / 25
    added_2010 = 1.0 if cols[5] == '2010' else 0.0
    return 0.55 * (freq / 2600) + 0.25 * jlpt_v + 0.10 * strokes + 0.10 * added_2010


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kanji-data', required=True)
    ap.add_argument('--vocab', required=True)
    args = ap.parse_args()

    grades = json.load(open(os.path.join(B.SRC, 'mext-grades-2020.json'), encoding='utf-8'))
    elem_grade = {k: int(g) for g, ks in grades.items() for k in ks}
    joyo = {}
    order = []
    for line in open(os.path.join(B.SRC, 'joyo-kanji.tsv'), encoding='utf-8'):
        cols = line.rstrip('\n').split('\t')
        if len(cols) >= 7:
            joyo[cols[1]] = cols
            order.append(cols[1])
    junior = [k for k in order if k not in elem_grade]
    assert len(junior) == 1110, len(junior)

    kd = json.load(open(args.kanji_data, encoding='utf-8'))
    ranked = sorted(junior, key=lambda k: (difficulty_score(k, joyo[k], kd), int(joyo[k][3]), int(joyo[k][0])))
    per = len(ranked) // 3
    split = {'j1': ranked[:per], 'j2': ranked[per:per * 2], 'j3': ranked[per * 2:]}

    # 熟語: 小学校の漢字＋中学の漢字（中1=7, 中2=8, 中3=9）の範囲で選ぶ
    grade_of = dict(elem_grade)
    for lid, n, _ in LEVELS:
        for k in split[lid]:
            grade_of[k] = JUNIOR_GRADE_BASE + n
    compounds = B.build_compounds(args.vocab, grade_of)

    # レベル内は 読み（五十音）順ではなく、やさしい順に並べる
    for lid, n, short in LEVELS:
        entries = []
        for k in split[lid]:
            cols = joyo[k]
            on, kun, special = B.parse_readings(cols[6])
            radical, radical_name = junior_radical(k, cols[2])
            entries.append({
                'kanji': k,
                'officialGrade': None,  # 中学は公式の学年配当なし
                'appLevel': short,
                'onyomi': on,
                'kunyomi': kun,
                'specialReadings': special,
                'meanings': [],
                'radical': radical,
                'radicalName': radical_name,
                'strokes': int(cols[3]),
                'compounds': compounds.get(k, []),
                'okurigana': B.okurigana_words(k, kun),
                'exampleSentences': [],
                'difficulty': JUNIOR_GRADE_BASE + n,
                'source': 'Joyo',
            })
        lines = [json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in entries]
        body = ',\n'.join('  ' + l for l in lines)
        js = (
            '/*\n'
            f' * 中学{n}年の漢字（{len(entries)}字）※このアプリ独自の学習レベル（目安）です。公式の学年配当ではありません。\n'
            ' * 対象: 文化庁「常用漢字表」のうち、小学校の学年別漢字配当表以外の 1,110字を 3 つに分けたもの\n'
            ' * 分け方: 使用頻度・JLPT レベル・画数・2010年追加字かどうか から難しさを計算（tools/build_junior_data.py）\n'
            ' * 音訓・画数: 文化庁「常用漢字表」／ 熟語: JMdict（© EDRDG, CC BY-SA 4.0）から自動選定\n'
            ' * このファイルは tools/build_junior_data.py で生成しています。\n'
            ' */\n'
            f"KanjiApp.KanjiDB.registerLevel('{lid}', [\n{body}\n]);\n"
        )
        path = os.path.join(B.OUT, f'kanji-junior{n}.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(js)
        no_comp = sum(1 for e in entries if not e['compounds'])
        no_rad = sum(1 for e in entries if not e['radicalName'])
        print(f'{lid}: {len(entries)} kanji / 熟語なし {no_comp} / 部首名なし {no_rad} / 先頭 {"".join(split[lid][:25])}')


if __name__ == '__main__':
    main()
