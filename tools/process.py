"""Turn generated concept sprites into game-ready assets for 호롱 체험판.

Inputs : raw/img/*.png (Meshy gpt-image-2 output), concept-art/horong-keyart.png
Outputs: horong-demo/assets/sprites.png + sprites.json, ground.jpg, keyart.jpg
Sprites are exported at 2x world size (drawn at half size for crisp HiDPI output).
"""
import json
import os
from PIL import Image, ImageFilter, ImageChops, ImageEnhance, ImageMath

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, 'raw', 'img')
OUT = os.path.join(ROOT, 'horong-demo', 'assets')
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGBA')


def clean(im, lo=30):
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < lo else v)
    return Image.merge('RGBA', (r, g, b, a))


def bbox(im, thr=40):
    return im.split()[3].point(lambda v: 255 if v > thr else 0).getbbox()


def cell(im, cols, rows, c, r):
    w, h = im.width / cols, im.height / rows
    return im.crop((int(c * w), int(r * h), int((c + 1) * w), int((r + 1) * h)))


def trim(im):
    bb = bbox(im)
    return im.crop(bb) if bb else im


def resize(im, w=None, h=None, box=None):
    if box:
        s = min(box / im.width, box / im.height)
    elif h is not None:
        s = h / im.height
    else:
        s = w / im.width
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    out = im.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    r, g, b, a = out.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1, percent=70, threshold=2))
    a = a.point(lambda v: 0 if v < 24 else (255 if v > 232 else v))
    return Image.merge('RGBA', (*rgb.split(), a))


def emissive(im, lum=200, sat=True, whole=False):
    """Glowing parts (eyes, flames) that stay visible in the dark, with a soft halo."""
    if whole:
        core = im.copy()
    else:
        src = im.load()
        core = Image.new('RGBA', im.size, (0, 0, 0, 0))
        dst = core.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = src[x, y]
                if a < 140:
                    continue
                l = 0.299 * r + 0.587 * g + 0.114 * b
                mx, mn = max(r, g, b), min(r, g, b)
                if l > lum or (sat and mx > 205 and mx - mn > 110):
                    dst[x, y] = (r, g, b, 255)
    halo = core.filter(ImageFilter.GaussianBlur(3))
    ha = halo.split()[3].point(lambda v: min(255, int(v * 1.8)))
    halo.putalpha(ha)
    return Image.alpha_composite(halo, core)


def lum_key(im):
    """Black-background effect frame -> alpha from brightness (for additive drawing)."""
    im = im.convert('RGB')
    src = im.load()
    out = Image.new('RGBA', im.size)
    dst = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = src[x, y]
            a = max(r, g, b)
            if a < 28:
                dst[x, y] = (0, 0, 0, 0)
            else:
                dst[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a)
    return out


def lum_key_fast(im, lo=28):
    """Same as lum_key, with channel ops instead of a per-pixel loop."""
    r, g, b = im.convert('RGB').split()
    a = ImageChops.lighter(r, ImageChops.lighter(g, b)).point(lambda v: 0 if v < lo else v)
    un = lambda c: ImageMath.lambda_eval(lambda e: e['convert'](e['min'](e['c'] * 255 / (e['a'] + (e['a'] == 0)), 255), 'L'), c=c, a=a)
    return Image.merge('RGBA', (un(r), un(g), un(b), a))


def body_x(im):
    """Horizontal centre of the feet/skirt band (bottom 30%), in world units from the image centre."""
    band = im.split()[3].crop((0, int(im.height * 0.7), im.width, im.height)).point(lambda v: 255 if v > 160 else 0)
    px, w, h = band.load(), band.width, band.height
    xs = [x for y in range(h) for x in range(w) if px[x, y]]
    return round((sum(xs) / len(xs) - im.width / 2) / 2, 1)


def register(frames, frac=0.55, rx=40, ry=4):
    """Align every walk frame to frame 0 on the head+torso silhouette, so the body holds still and only the
    legs, hem and hair swing. The generator drifts the figure a few pixels per frame, which plays back as a
    slide-then-snap stutter each cycle."""
    def torso(im):
        a = im.split()[3].point(lambda v: 255 if v > 128 else 0)
        bb = a.getbbox(); cut = bb[1] + int((bb[3] - bb[1]) * frac)
        m = Image.new('L', im.size, 0); m.paste(a.crop((0, bb[1], im.width, cut)), (0, bb[1])); return m
    W, H = frames[0].width + 2 * rx, frames[0].height + 2 * ry
    def placed(m, dx, dy):
        c = Image.new('L', (W, H), 0); c.paste(m, (rx + dx, ry + dy)); return c
    ref = placed(torso(frames[0]), 0, 0)
    out = [frames[0]]; shifts = [(0, 0)]
    for f in frames[1:]:
        m, best = torso(f), (-1, 0, 0)
        for dy in range(-ry, ry + 1):
            for dx in range(-rx, rx + 1):
                score = ImageChops.multiply(ref, placed(m, dx, dy)).histogram()[255]
                if score > best[0]:
                    best = (score, dx, dy)
        shifts.append(best[1:])
    canv = []
    for f, (dx, dy) in zip(frames, shifts):
        c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(f, (rx + dx, ry + dy)); canv.append(c)
    return union_crop(canv, 8), shifts


def torso_x(im):
    """Horizontal centre of the torso band (25-65% of the figure height), world units from the image centre."""
    a = im.split()[3].point(lambda v: 255 if v > 160 else 0); bb = a.getbbox()
    band = a.crop((0, bb[1] + int((bb[3] - bb[1]) * 0.25), im.width, bb[1] + int((bb[3] - bb[1]) * 0.65)))
    px, w, h = band.load(), band.width, band.height
    xs = [x for y in range(h) for x in range(w) if px[x, y]]
    return round((sum(xs) / len(xs) - im.width / 2) / 2, 1)


def union_crop(cells, thr=30):
    union = None
    for c in cells:
        bb = bbox(c, thr)
        if not bb:
            continue
        union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    return [c.crop(union) for c in cells]


def fx_sheet(name, cols, rows, box, alpha=False):
    """Flipbook sheet -> registered frames (shared crop keeps the animation from drifting)."""
    im = Image.open(os.path.join(RAW, name + '.png'))
    im = im.convert('RGBA') if alpha else im.convert('RGB')
    cells = [cell(im, cols, rows, i % cols, i // cols) for i in range(cols * rows)]
    cells = [clean(c, 40) if alpha else lum_key_fast(c) for c in cells]
    return [resize(c, box=box) for c in union_crop(cells)]


def row_frames(im, n, row=0, rows=1, h=None, w=None):
    cells = [clean(cell(im, n, rows, i, row)) for i in range(n)]
    union = None
    for c in cells:
        bb = bbox(c)
        union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    return [resize(c.crop(union), h=h, w=w) for c in cells]


def bright_point(im, test):
    px = im.load()
    xs, ys = [], []
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 200 and test(r, g, b):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    # relative to bottom-center anchor, in WORLD units (sprites are 2x)
    return [round((cx - im.width / 2) / 2, 1), round((cy - im.height) / 2, 1)]


def rig_params(frames):
    """Cut-out walk rig: pick the drawing whose feet are closest together, find the skirt hem (the lowest
    row still at least half the widest row) and the column between the two feet below it. The runtime keeps
    that one drawing and animates the feet, skirt and body itself, so nothing flickers between drawings."""
    best = None
    for i, f in enumerate(frames):
        a = f.split()[3].load()
        W, H = f.size
        widths = [sum(1 for x in range(W) if a[x, y] > 100) for y in range(H)]
        mx = max(widths)
        hem = next(y for y in range(H - 1, -1, -1) if widths[y] >= 0.5 * mx)
        cols = [sum(1 for y in range(hem + 1, H) if a[x, y] > 100) for x in range(W)]
        xs = [x for x in range(W) if cols[x] > 0]
        if not xs:
            continue
        x0, x1 = xs[0], xs[-1]
        lo, hi = x0 + (x1 - x0) * 0.2, x1 - (x1 - x0) * 0.2
        mid = (x0 + x1) / 2
        split = min((x for x in range(W) if lo <= x <= hi), key=lambda x: (cols[x], abs(x - mid)), default=int(mid))
        cand = (x1 - x0, i, hem, split, W, H, x0, x1)
        if best is None or cand < best:
            best = cand
    spread, i, hem, split, W, H, x0, x1 = best
    return {'base': i, 'hem': hem, 'split': split, 'w': W, 'h': H, 'fx': [x0, x1]}


def split_feet(f, rp, who, front=False):
    """Lift the feet out of the rig's base drawing by material: 연이 wears saturated brown sandals under a pale
    cream skirt, 단비 white socks under a strong red one. Seeds below the hem grow upward through foot-coloured
    pixels (a back foot tucked under a slanted hem), then take one ring of dark outline. Both feet leave the body;
    the largest becomes the one foot sprite the runtime draws twice."""
    import colorsys
    W, H = f.size
    px = f.load()
    hem = rp['hem']

    def hsv(c):
        return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)

    def is_foot(c):
        if c[3] < 40:
            return False
        h, s_, v = hsv(c)
        if who == 'yeoni':
            return s_ > 0.32 and 0.02 < h < 0.16 and v > 0.12
        return s_ < 0.26 and v > 0.18   # white socks and their grey outline; the skirt is saturated red
    top = max(0, hem - 18)
    stack = [(x, y) for y in range(hem - 7, H) for x in range(W) if is_foot(px[x, y])]
    mask = set(stack)
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and top <= ny < H and (nx, ny) not in mask and is_foot(px[nx, ny]):
                mask.add((nx, ny))
                stack.append((nx, ny))
    ring = set()
    for (x, y) in mask:   # the dark outline around the foot
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y + 1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in mask:
                c = px[nx, ny]
                h, s_, v = hsv(c)
                if c[3] >= 40 and v < 0.42 and (who == 'yeoni' or s_ < 0.5):
                    ring.add((nx, ny))
    mask |= ring
    comps, seen = [], set()
    for p0 in sorted(mask):
        if p0 in seen:
            continue
        comp, st = [], [p0]
        seen.add(p0)
        while st:
            x, y = st.pop()
            comp.append((x, y))
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                if q in mask and q not in seen:
                    seen.add(q)
                    st.append(q)
        comps.append(comp)
    comps = [c for c in comps if len(c) >= 8]
    comps.sort(key=len, reverse=True)
    print('feet', who, rp['base'], 'mask', len(mask), 'comps', [len(c) for c in comps][:4])
    body = f.copy()
    bp = body.load()
    for c in comps:
        for (x, y) in c:
            bp[x, y] = (0, 0, 0, 0)
    # loose islands left under the skirt (toe tips, sock outline) go too
    seen2 = set()
    for y0 in range(top, H):
        for x0 in range(W):
            if (x0, y0) in seen2 or bp[x0, y0][3] < 20:
                continue
            isl, st = [], [(x0, y0)]
            seen2.add((x0, y0))
            while st:
                x, y = st.pop()
                isl.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                    if 0 <= nx < W and top <= ny < H and (nx, ny) not in seen2 and bp[nx, ny][3] >= 20:
                        seen2.add((nx, ny))
                        st.append((nx, ny))
            if len(isl) < 40 and min(y for _, y in isl) > hem - 12:
                for (x, y) in isl:
                    bp[x, y] = (0, 0, 0, 0)
    main = comps[0]
    allx = [x for c in comps[:2] for x, _ in c]
    xs = [x for x, _ in main]
    if front and max(xs) - min(xs) > 12:   # front/back: both feet touch; keep the bigger one, the runtime mirrors it
        lo, hi = min(xs), max(xs)
        cnt = {x: 0 for x in range(lo, hi + 1)}
        for x, _ in main:
            cnt[x] += 1
        mid = min(range(lo + (hi - lo) // 4, hi - (hi - lo) // 4 + 1), key=lambda x: (cnt[x], abs(x - (lo + hi) / 2)))
        a_, b_ = [p for p in main if p[0] < mid], [p for p in main if p[0] >= mid]
        main = a_ if len(a_) >= len(b_) else b_
        xs = [x for x, _ in main]
    ys = [y for _, y in main]
    bb = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    foot = Image.new('RGBA', (bb[2] - bb[0], bb[3] - bb[1]), (0, 0, 0, 0))
    fpx = foot.load()
    for (x, y) in main:
        fpx[x - bb[0], y - bb[1]] = px[x, y]
    cx = [sum(x for x, _ in c) / len(c) for c in comps[:2]]
    sep = abs(cx[0] - cx[1]) if len(cx) > 1 else 0
    return body, foot, {'fo': [bb[0], bb[1]], 'fc': round(sum(allx) / len(allx), 1), 'sep': round(sep, 1), 'gy': max(ys) + 1, 'fw': bb[2] - bb[0], 'n': len(comps)}


S = {}      # name -> image (2x world size)
META = {}

# --- players: 4-frame walk cycles -------------------------------------------
for who in ('yeoni', 'danbi'):
    frames = row_frames(load(who), 4, h=108)
    for i, f in enumerate(frames):
        S[f'{who}{i}'] = f
    if who == 'yeoni':
        META['lantern'] = bright_point(frames[0], lambda r, g, b: r > 235 and g > 170 and b < 150)
    else:
        META['bells'] = bright_point(frames[0], lambda r, g, b: r > 200 and g > 150 and b < 90)

# --- players: 8-direction walk. E is the original sheet; SW/W/NW are mirrored at runtime.
# Each view is height-normalised (the generator draws front views a little larger) and gets
# a body anchor so swapping views never makes the body hop sideways.
META['ax'], META['lamp'], META['lampF'] = {}, {}, {}
lamp_test = {'yeoni': lambda r, g, b: r > 235 and g > 170 and b < 150, 'danbi': lambda r, g, b: r > 200 and g > 150 and b < 90}
for who in ('yeoni', 'danbi'):
    for d in ('', '_se', '_s', '_ne', '_n'):
        im = load(who + d)
        if who == 'danbi' and d == '_s':
            im = im.transpose(Image.FLIP_LEFT_RIGHT)   # bells on the image's right, like the other east-side views
        frames, shifts = register(row_frames(im, 4, h=108))
        print('register', who + d, shifts)
        for i, f in enumerate(frames):
            S[f'{who}{d}{i}'] = f
        f0 = S[f'{who}{d}0']
        META['ax'][who + d] = torso_x(f0)
        META['lamp'][who + d] = bright_point(f0, lamp_test[who])
        META['lampF'][who + d] = [bright_point(S[f'{who}{d}{i}'], lamp_test[who]) for i in range(4)]   # the lantern swings between drawings
        rp = rig_params(frames)
        body, foot, info = split_feet(frames[rp['base']], rp, who, d in ('_s', '_n'))
        S[f'{who}{d}_body'] = body
        S[f'{who}{d}_foot'] = foot
        rp.update(info)
        META.setdefault('rig', {})[who + d] = rp



# --- VFX flipbooks (black background -> luminance alpha, drawn additively) -----------
for name, cols, rows, box in (('fx_hit', 4, 2, 192), ('fx_fire', 4, 2, 224), ('fx_slash', 4, 2, 224),
                              ('fx_slam', 4, 2, 288), ('fx_soul', 4, 2, 224), ('fx_pillar', 8, 1, 384)):
    for i, f in enumerate(fx_sheet(name, cols, rows, box)):
        S[f'{name}{i}'] = f
for name, box in (('fx_claw', 256), ('fx_geyser', 256)):   # boss attack flipbooks
    for i, f in enumerate(fx_sheet(name, 4, 2, box)):
        S[f'{name}{i}'] = f
for i, f in enumerate(fx_sheet('fx_beam', 1, 4, 512)):     # 이무기 water jet: 4 turbulence frames, stretched along the beam
    S[f'fx_beam{i}'] = f
for i, f in enumerate(fx_sheet('fx_ink', 4, 2, 200, alpha=True)):
    S[f'fx_ink{i}'] = f
for name, box in (('fx_circle', 448), ('fx_ring', 512)):
    S[name] = resize(trim(lum_key_fast(Image.open(os.path.join(RAW, name + '.png')))), box=box)

# --- regular enemies ---------------------------------------------------------
sheet = load('enemies')
spec = [('japgwi', 0, 0, 74, 205), ('egg', 1, 0, 76, None), ('water', 2, 0, 84, 175),
        ('dokkaebi', 0, 1, 80, 205), ('saja', 1, 1, 90, 215), ('wisp', 2, 1, 58, 'whole')]
for name, c, r, h, lum in spec:
    img = resize(trim(clean(cell(sheet, 3, 2, c, r))), h=h)
    S[name] = img
    if lum == 'whole':
        S[name + '_e'] = emissive(img, whole=True)
    elif lum:
        S[name + '_e'] = emissive(img, lum=lum)

# --- bosses -----------------------------------------------------------------
img = resize(trim(clean(load('gseun'))), h=230)
S['gseun'] = img
S['gseun_e'] = emissive(img, lum=150)
img = resize(trim(clean(load('gumiho'))), w=290)
S['gumiho'] = img
S['gumiho_e'] = emissive(img, lum=248)
imu = load('imugi')
img = resize(trim(clean(cell(imu, 2, 1, 0, 0))), w=150)
S['imugi'] = img
S['imugi_e'] = emissive(img, lum=245)
S['seg'] = resize(trim(clean(cell(imu, 2, 1, 1, 0))), w=94)

# boss action poses (Meshy gpt-image-2, image-to-image from the sprites above). One scale per sheet, set so
# the reference pose matches the base sprite, keeps the poses' relative size (a lunge is longer than a stand).
def pose_sheet(name, cols, rows, ref_cell, key, size, out):
    im = load(name)
    cells = [trim(clean(cell(im, cols, rows, i % cols, i // cols))) for i in range(cols * rows)]
    ref = cells[ref_cell]; k = size / (ref.height if key == 'h' else ref.width)
    for i, c in enumerate(cells):
        if out[i]:
            S[out[i]] = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
pose_sheet('gseun_p', 2, 2, 0, 'h', 230, [None, 'gseun_p1', 'gseun_p2', 'gseun_p3'])          # raise arms, slam, lunge
pose_sheet('gumiho_p', 2, 2, 1, 'w', 280, ['gumiho_p0', 'gumiho_p1', 'gumiho_p2', 'gumiho_p3'])  # gallop, crouch, pounce, cast
pose_sheet('imugi_p', 2, 2, 3, 'w', 150, ['imugi_p0', 'imugi_p1', 'imugi_p2', 'imugi_p3'])        # hiss, roar, charge, bite

# --- items --------------------------------------------------------------------
items = load('items')
spec = [('gem1', 'h', 28), ('gem2', 'h', 34), ('gem3', 'h', 42), ('oil', 'h', 28), ('coin', 'w', 30),
        ('rice', 'w', 32), ('chest', 'w', 64), ('jar', 'h', 66), ('talisman', 'h', 38)]
for i, (name, k, v) in enumerate(spec):
    img = trim(clean(cell(items, 3, 3, i % 3, i // 3)))
    S[name] = resize(img, h=v) if k == 'h' else resize(img, w=v)

items2 = load('items2')   # 지남철 (magnet) + 산삼 (big heal), same Meshy gpt-image-2 style pass
S['magnet'] = resize(trim(clean(cell(items2, 2, 2, 1, 0))), w=50)
S['ginseng'] = resize(trim(clean(cell(items2, 2, 2, 0, 1))), h=54)

# --- props --------------------------------------------------------------------
props = load('props')
spec = [('stall', 'w', 250), ('jars', 'w', 200), ('post', 'h', 150), ('cart', 'w', 150), ('tree', 'h', 180), ('jangseung', 'h', 140)]
for i, (name, k, v) in enumerate(spec):
    img = trim(clean(cell(props, 3, 2, i % 3, i // 3)))
    S[name] = resize(img, h=v) if k == 'h' else resize(img, w=v)
# map points of interest (Meshy gpt-image-2, styled on the props sheet): 4 x 2
props2 = load('props2')
spec2 = [('shrine', 'h', 200), ('well', 'h', 140), ('bonfire', 'w', 120), ('cairn', 'h', 130),
         ('mat', 'w', 150), ('peddler', 'h', 140), ('skylantern', 'h', 64), ('sotdae', 'h', 170)]
for i, (name, k, v) in enumerate(spec2):
    img = trim(clean(cell(props2, 4, 2, i % 4, i // 4)))
    S[name] = resize(img, h=v) if k == 'h' else resize(img, w=v)
META['jarsLamp'] = bright_point(S['jars'], lambda r, g, b: r > 220 and g > 150 and b < 120)
META['postLamp'] = bright_point(S['post'], lambda r, g, b: r > 200 and g > 140 and b < 120)

# --- icons ----------------------------------------------------------------------
icons = load('icons')
names = ['i_hollong', 'i_bell', 'i_club', 'i_yukmo', 'i_ink', 'i_talisman',
         'i_oiljar', 'i_shoes', 'i_gat', 'i_redink', 'i_mirror', 'i_rice']
for i, name in enumerate(names):
    img = resize(trim(clean(cell(icons, 6, 2, i % 6, i // 6))), box=60)
    canvas = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((64 - img.width) // 2, (64 - img.height) // 2))
    S[name] = canvas

# --- effects (black background -> luminance alpha) -----------------------------
vfx = Image.open(os.path.join(RAW, 'vfx.png')).convert('RGB')
for row, base in ((0, 'fire'), (1, 'fox')):
    cells = [lum_key(cell(vfx, 4, 2, i, row)) for i in range(4)]
    union = None
    for c in cells:
        bb = bbox(c, 30)
        union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    for i, c in enumerate(cells):
        S[f'{base}{i}'] = resize(c.crop(union), h=60)

# --- crop glow layers to their lit pixels (less fill-rate per dark enemy) ---------
META['emisOff'] = {}
for name in [n for n in S if n.endswith('_e')]:
    bb = S[name].split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        S[name] = S[name].crop(bb)
        META['emisOff'][name[:-2]] = [bb[0], bb[1]]

# --- pack atlas (shelf packer) ----------------------------------------------------
PAD = 2
order = sorted(S.items(), key=lambda kv: -kv[1].height)
AW = 2048
x = y = shelf = 0
rects = {}
for name, img in order:
    if x + img.width + PAD > AW:
        x, y, shelf = 0, y + shelf + PAD, 0
    rects[name] = [x, y, img.width, img.height]
    x += img.width + PAD
    shelf = max(shelf, img.height)
AH = y + shelf
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for name, img in S.items():
    rx, ry, _, _ = rects[name]
    atlas.paste(img, (rx, ry))
atlas.save(os.path.join(OUT, 'sprites.png'), optimize=True)
with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
    json.dump({'frames': rects, 'meta': META}, f, separators=(',', ':'))

# --- seamless ground tile --------------------------------------------------------
g = Image.open(os.path.join(RAW, 'ground.png')).convert('RGB')
W, H = g.size
rolled = ImageChops.offset(g, W // 2, H // 2)
small = Image.new('L', (64, 64))
sp = small.load()
for yy in range(64):
    for xx in range(64):
        d = min(xx, 63 - xx, yy, 63 - yy) / 63
        sp[xx, yy] = int(max(0.0, min(1.0, (d - 0.06) / 0.16)) * 255)
mask = small.resize((W, H), Image.BILINEAR)
tile = Image.composite(g, rolled, mask)
tile = ImageEnhance.Brightness(tile).enhance(0.72)
tile = ImageEnhance.Color(tile).enhance(0.85)
tile.save(os.path.join(OUT, 'ground.jpg'), quality=86)

# --- title key art ---------------------------------------------------------------
key = Image.open(os.path.join(ROOT, 'concept-art', 'horong-keyart.png')).convert('RGB')
key.resize((1600, 900), Image.LANCZOS).save(os.path.join(OUT, 'keyart.jpg'), quality=80)

print('atlas', AW, 'x', AH, 'sprites', len(S))
print('meta', META)
for n in ('yeoni0', 'yeoni_s0', 'danbi_n0', 'fx_hit0', 'fx_slam0', 'fx_pillar0', 'fx_circle', 'fx_ink0'):
    print(n, rects[n][2:])
