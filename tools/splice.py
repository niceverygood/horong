"""Splice the generated-art, audio and render sections into horong-demo/index.html."""
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
INDEX = os.path.join(ROOT, 'horong-demo', 'index.html')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


src = read(INDEX)
atlas = read(os.path.join(ROOT, 'horong-demo', 'assets', 'sprites.json')).strip()
import hashlib
with open(os.path.join(ROOT, 'horong-demo', 'assets', 'sprites.png'), 'rb') as f:
    ver = hashlib.sha1(f.read()).hexdigest()[:10]
# the page loads a content-named copy, so a cached old atlas can never meet new frame coordinates
import glob, shutil
ASSETS = os.path.join(ROOT, 'horong-demo', 'assets')
for old in glob.glob(os.path.join(ASSETS, 'sprites-*.png')):
    os.remove(old)
shutil.copyfile(os.path.join(ASSETS, 'sprites.png'), os.path.join(ASSETS, f'sprites-{ver}.png'))
print('atlas', f'sprites-{ver}.png')
audio_art = read(os.path.join(ROOT, 'tools', 'sec_audio_art.js')).replace('__ATLAS__', atlas).replace('__ATLAS_VER__', ver)
render = read(os.path.join(ROOT, 'tools', 'sec_render.js'))


def replace_between(text, start, end, new):
    a = text.index(start)
    b = text.index(end, a)
    return text[:a] + new + text[b:]


if '/* ---------- art (generated sprite atlas) ---------- */' in src:
    src = replace_between(src, '/* ---------- art (generated sprite atlas) ---------- */', '/* ---------- state ---------- */', audio_art)
else:
    src = replace_between(src, '/* ---------- audio ---------- */', '/* ---------- state ---------- */', audio_art)
src = replace_between(src, '/* ---------- render ---------- */', '/* ---------- menus ---------- */', render)

with open(INDEX, 'w', encoding='utf-8') as f:
    f.write(src)
print('spliced', len(src))
