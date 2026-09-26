#!/usr/bin/env python3
"""
アプリアイコンを各サイズで生成するスクリプト（要 Pillow: pip install Pillow）

使い方:
  1. 用意した「漢字」アイコン画像（正方形・1024px 以上推奨）を
     assets/icons/kanji-icon-source.png として保存
  2. python3 tools/make_icons.py

  元画像が無い場合は、青・白・桜色・墨文字の仮アイコンを描いて生成します。

生成するファイル（他アプリと競合しないよう kanji- で始まる名前）:
  kanji-icon-192.png / kanji-icon-512.png     … PWA 用
  kanji-icon-maskable-512.png                  … Android の丸型マスク用（余白付き）
  kanji-apple-touch-icon.png (180x180)         … iPhone / iPad ホーム画面用
  kanji-favicon-32.png                         … ブラウザのタブ用
"""
import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'assets', 'icons')
SOURCE = os.path.join(ICON_DIR, 'kanji-icon-source.png')
FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
    '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
    '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc',
    'C:/Windows/Fonts/meiryob.ttc',
]


def draw_placeholder(size=1024):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    # 青のグラデーション背景
    top, bottom = (72, 150, 235), (30, 95, 180)
    for y in range(size):
        t = y / size
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    # 桜の花びら
    rnd = random.Random(7)
    petals = Image.new('RGBA', (size, size))
    pd = ImageDraw.Draw(petals)
    for _ in range(22):
        x, y = rnd.randint(0, size), rnd.randint(0, size)
        r = rnd.randint(size // 60, size // 28)
        pd.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=(250, 190, 215, 200))
    img = Image.alpha_composite(img, petals.filter(ImageFilter.GaussianBlur(1)))
    d = ImageDraw.Draw(img)
    # 白い紙
    m = int(size * 0.13)
    d.rounded_rectangle([m, m, size - m, size - m], radius=int(size * 0.08), fill=(255, 255, 255, 255))
    # 桜色のアクセント
    d.rounded_rectangle([m, size - m - int(size * 0.06), size - m, size - m], radius=int(size * 0.03), fill=(242, 141, 178, 255))
    # 墨文字「漢字」
    font_path = next((f for f in FONT_CANDIDATES if os.path.exists(f)), None)
    font = ImageFont.truetype(font_path, int(size * 0.3)) if font_path else ImageFont.load_default()
    text = '漢字'
    bbox = d.textbbox((0, 0), text, font=font, stroke_width=int(size * 0.008))
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.02), text, font=font,
           fill=(31, 36, 48, 255), stroke_width=int(size * 0.008), stroke_fill=(31, 36, 48, 255))
    return img


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    if os.path.exists(SOURCE):
        base = Image.open(SOURCE).convert('RGBA')
        w, h = base.size
        s = min(w, h)
        base = base.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((1024, 1024), Image.LANCZOS)
        print('元画像から生成:', SOURCE)
    else:
        base = draw_placeholder()
        print('元画像が無いため仮アイコンを生成しました')

    def save(size, name, img=None):
        (img or base).resize((size, size), Image.LANCZOS).save(os.path.join(ICON_DIR, name))
        print('  ', name)

    save(512, 'kanji-icon-512.png')
    save(192, 'kanji-icon-192.png')
    save(32, 'kanji-favicon-32.png')
    # iPhone は透過部分が黒くなるため白背景に合成
    apple = Image.new('RGBA', base.size, (255, 255, 255, 255))
    apple.alpha_composite(base)
    save(180, 'kanji-apple-touch-icon.png', apple.convert('RGB'))
    # maskable: 周囲に 10% の余白（安全領域）
    mask = Image.new('RGBA', (1024, 1024), (47, 127, 216, 255))
    inner = base.resize((820, 820), Image.LANCZOS)
    mask.alpha_composite(inner, (102, 102))
    save(512, 'kanji-icon-maskable-512.png', mask)


if __name__ == '__main__':
    main()
