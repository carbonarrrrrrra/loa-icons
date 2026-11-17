"""Reproduce the five element icons from the verified JP talent atlas."""
import hashlib
from pathlib import Path
import urllib.request
import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = '2022.3.21f1'
BUNDLE = '06938ff484473ca3'
MD5 = '9934c2a72925e6f54503375480c33e9d'
URL = 'https://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/06/' + BUNDLE


def main():
    with urllib.request.urlopen(URL, timeout=60) as response:
        data = response.read()
    if len(data) != 145772 or hashlib.md5(data).hexdigest() != MD5:
        raise ValueError('Element atlas checksum mismatch')
    asset = UnityPy.load(data)
    textures = [obj.read() for obj in asset.objects if obj.type.name == 'Texture2D']
    texture = next(obj.image for obj in textures if obj.m_Name == 'AtlasUnitCommonTalent')
    sprites = []
    for obj in asset.objects:
        if obj.type.name == 'MonoBehaviour':
            sprites.extend(obj.read_typetree().get('mSprites', []))
    destination = Path(__file__).resolve().parents[1] / 'site' / 'elements'
    destination.mkdir(exist_ok=True)
    for element in range(1, 6):
        sprite = next(s for s in sprites if s['name'] == f'icon_talent_{element:03}')
        x, y, width, height = (sprite[key] for key in ('x', 'y', 'width', 'height'))
        texture.crop((x, y, x + width, y + height)).save(destination / f'{element}.webp', 'WEBP', lossless=True)
    print('Extracted five verified element sprites')


if __name__ == '__main__':
    main()
