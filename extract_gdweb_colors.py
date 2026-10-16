"""Extract traceable reference colors from authentic logos and favicons only.

These are image-derived reference palettes, not claims about an official brand
manual. Photos, OG images, banners and page screenshots are intentionally excluded.
"""
import colorsys
import io
import json
import re
from collections import Counter
from pathlib import Path

from PIL import Image, ImageColor, ImageCms
from serve_references import ROOT, read_json, write_json


def rgb(value):
    try:
        return ImageColor.getrgb(value)[:3]
    except (ValueError, TypeError):
        return None


def chromatic(color):
    _, saturation, value = colorsys.rgb_to_hsv(*(c / 255 for c in color))
    return saturation >= .20 and value >= .18


def extract(asset):
    path = ROOT / asset['path']
    if not path.exists():
        return Counter(), Counter()
    if asset.get('format', '').upper() == 'SVG':
        data = path.read_text(encoding='utf-8', errors='replace')
        # Only explicit color values, not all hex-like IDs embedded in the SVG.
        values = re.findall(r'(?:fill|stroke|stop-color)[\s:=]+[\"\']?\s*(#[0-9a-fA-F]{3,8}\b|rgb\([^)]*\)|[a-zA-Z]+)', data)
        colors = Counter(c for v in values if (c := rgb(v)) is not None)
        # SVG occurrence counts do not measure area. Retain only unambiguous
        # single-color marks; complex SVGs stay unconfirmed instead of guessing.
        colored = {c for c in colors if chromatic(c)}
        if len(colored) > 1:
            return Counter(), Counter()
    else:
        try:
            with Image.open(path) as original:
                if original.info.get('icc_profile'):
                    image = ImageCms.profileToProfile(original.convert('RGBA'), ImageCms.ImageCmsProfile(io.BytesIO(original.info['icc_profile'])),
                                                      ImageCms.createProfile('sRGB'), outputMode='RGBA')
                else:
                    image = original.convert('RGBA')
                image.thumbnail((160, 160), Image.Resampling.LANCZOS)
                pixels = image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()
                visible = [p[:3] for p in pixels if p[3] >= 220]
                if not visible:
                    return Counter(), Counter()
                # Quantization is analysis only; saved image bytes are untouched.
                strip = Image.new('RGB', (len(visible), 1))
                strip.putdata(visible)
                quantized = strip.quantize(colors=16, method=Image.Quantize.MEDIANCUT).convert('RGB')
                colors = Counter(quantized.get_flattened_data() if hasattr(quantized, 'get_flattened_data') else quantized.getdata())
                cutoff = max(2, sum(colors.values()) * .012)
                colors = Counter({c: n for c, n in colors.items() if n >= cutoff})
        except (OSError, ValueError, ImageCms.PyCMSError):
            return Counter(), Counter()
    return Counter({c: n for c, n in colors.items() if chromatic(c)}), Counter({c: n for c, n in colors.items() if not chromatic(c)})


def hex_color(color):
    return '#%02x%02x%02x' % color


def similar(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) < 28 ** 2


def main():
    rows = read_json(ROOT / 'gdweb-static.json')
    results = {}
    for row in rows:
        assets = [a for a in row['assets'] if a.get('type') in ('logo', 'favicon', 'appicon')
                  and not a.get('path', '').startswith(('http', '/api/'))
                  and a.get('source_type') != 'element-capture']
        assets.sort(key=lambda a: (a['type'] != 'logo', a.get('format') != 'SVG', -a.get('width', 0)))
        for asset in assets:
            colored, neutral = extract(asset)
            if not colored and not neutral:
                continue
            # Prefer a colored authentic mark; monochrome remains valid if this
            # is the only available mark for the site.
            if not colored and any(extract(other)[0] for other in assets[:5] if other is not asset):
                continue
            total = sum(colored.values()) + sum(neutral.values())
            unique = []
            for color, count in colored.most_common():
                if not any(similar(color, existing[0]) for existing in unique):
                    unique.append((color, count))
            source_name = '로고 원본에서 추출' if asset['type'] == 'logo' else '파비콘 원본에서 추출'
            def item(pair):
                return {'hex': hex_color(pair[0]), 'score': round(pair[1] / total * 100, 2), 'sources': [source_name]}
            primary = item(unique[0]) if unique else item(neutral.most_common(1)[0])
            results[row['slug']] = {'primary': primary, 'secondary': item(unique[1]) if len(unique) > 1 else None,
                                    'accents': [item(p) for p in unique[2:5]],
                                    'neutrals': [hex_color(c) for c, _ in neutral.most_common(5)],
                                    'monochrome': not bool(unique), 'evidence_type': 'image-derived-reference',
                                    'source_assets': [asset['path']],
                                    'source_urls': [asset.get('source_url') or row.get('page_url')],
                                    'checked_at': asset.get('captured_at', '')}
            break
    write_json(ROOT / 'gdweb-brand-colors.json', results)
    print(json.dumps({'palettes': len(results), 'chromatic': sum(not p['monochrome'] for p in results.values()),
                      'monochrome': sum(p['monochrome'] for p in results.values())}))


if __name__ == '__main__':
    main()
