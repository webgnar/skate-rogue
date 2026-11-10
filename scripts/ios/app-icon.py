"""Skate Escape's iOS app icon: the skater from zack's capsule art on a comic burst.

    python3 scripts/ios/app-icon.py               # the chosen option -> the iOS AppIcon (1024 px, no alpha)
    python3 scripts/ios/app-icon.py --all <dir>   # every color option, to compare

The skater is art/app-icon/skater-cutout.png, cut from art/store-covers/capsule-original.png
(crop x 480-1520, BiRefNet mask via rembg, background bits between his legs taken out by hand).
Needs Pillow and numpy.
"""
import sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SK = 'art/app-icon/skater-cutout.png'
CHOSEN = 'C-toxic-slime'
ICON = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
N = 1024
SS = 2  # supersample for the drawn shapes

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def radial(c_in, c_out, center=(0.5, 0.45), r=0.75):
    y, x = np.mgrid[0:N, 0:N] / N
    d = np.clip(np.hypot(x - center[0], y - center[1]) / r, 0, 1)[..., None]
    d = d ** 1.2
    a, b = np.array(hexc(c_in), float), np.array(hexc(c_out), float)
    return Image.fromarray((a * (1 - d) + b * d).astype('uint8'), 'RGB')

def rays(color, count=18, center=(0.5, 0.45), alpha=110, offset=0.0):
    im = Image.new('RGBA', (N * SS, N * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = center[0] * N * SS, center[1] * N * SS
    R = N * SS * 1.6
    for i in range(count):
        a0 = (i / count + offset) * 2 * math.pi
        a1 = a0 + math.pi / count * 0.9
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))],
                  fill=hexc(color) + (alpha,))
    return im.resize((N, N), Image.LANCZOS)

def halftone(color, spacing=22, center=(0.5, 0.45), alpha=120, inner=0.35):
    """comic dots, growing toward the edges"""
    im = Image.new('RGBA', (N * SS, N * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = spacing * SS
    for j in range(-1, N * SS // s + 2):
        for i in range(-1, N * SS // s + 2):
            x = i * s + (s / 2 if j % 2 else 0); y = j * s
            r = math.hypot(x / (N * SS) - center[0], y / (N * SS) - center[1])
            k = max(0.0, (r - inner) / (0.75 - inner))
            rad = min(1.0, k) * s * 0.42
            if rad > 0.6:
                d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=hexc(color) + (alpha,))
    return im.resize((N, N), Image.LANCZOS)

def speed_lines(color, alpha=200, seed=3):
    """a few streaks behind him, down-left, the way he's moving in the capsule"""
    rng = np.random.default_rng(seed)
    im = Image.new('RGBA', (N * SS, N * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ang = math.radians(-28)
    for _ in range(9):
        x0 = rng.uniform(-0.1, 0.55) * N * SS; y0 = rng.uniform(0.45, 1.05) * N * SS
        L = rng.uniform(0.25, 0.5) * N * SS; w = rng.uniform(6, 16) * SS
        x1, y1 = x0 + L * math.cos(ang), y0 + L * math.sin(ang)
        nx, ny = -math.sin(ang), math.cos(ang)
        d.polygon([(x0, y0), (x1 + nx * w, y1 + ny * w), (x1 - nx * w * 0.2, y1 - ny * w * 0.2)], fill=hexc(color) + (alpha,))
    return im.resize((N, N), Image.LANCZOS)

def vignette(strength=0.55):
    y, x = np.mgrid[0:N, 0:N] / N
    d = np.clip((np.hypot(x - 0.5, y - 0.5) - 0.35) / 0.4, 0, 1)
    a = (d ** 1.5 * 255 * strength).astype('uint8')
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); im.putalpha(Image.fromarray(a)); return im

# the skater, placed: scaled so his body fills the icon, his reaching hand runs off the right edge
sk = Image.open(SK).convert('RGBA')
sk = sk.crop((40, 0, 940, 890))
scale = 1.13
sk = sk.resize((int(sk.width * scale), int(sk.height * scale)), Image.LANCZOS)
POS = (-40, 18)

def skater_layer(shadow_color, glow=None):
    L = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    a = sk.getchannel('A')
    if glow:
        g = Image.new('RGBA', sk.size, hexc(glow) + (0,)); g.putalpha(a.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(22)))
        L.alpha_composite(g, (POS[0], POS[1]))
    # a hard comic drop shadow, down-right
    sh = Image.new('RGBA', sk.size, hexc(shadow_color) + (0,)); sh.putalpha(a.point(lambda v: int(v * 0.85)))
    L.alpha_composite(sh, (POS[0] + 16, POS[1] + 20))
    L.alpha_composite(sk, POS)
    return L

OPTIONS = {
    # name: (inner, outer, ray, ray alpha, dots, lines, shadow, glow)
    'A-sunset-blaze': ('#fff06a', '#d8001c', '#ff7a00', 120, '#7a0018', '#fff3a0', '#5a0020', None),
    'B-electric-cyan': ('#3ef8ff', '#1238d8', '#ff2fb4', 95, '#0a1a7a', '#ffffff', '#0a1050', None),
    'C-toxic-slime': ('#c6ff2e', '#0e3d12', '#7dff1a', 90, '#000000', '#eaff80', '#000000', '#c6ff2e'),
    'D-synthwave': ('#ff2fb4', '#12002a', '#00e5ff', 75, '#00e5ff', '#00e5ff', '#000000', '#00e5ff'),
    'E-magenta-gold': ('#ffe23a', '#c4007a', '#ff2fb4', 120, '#5a0040', '#ffffff', '#3a0030', None),
}

def render(name):
    cin, cout, ray, ra, dots, lines, shadow, glow = OPTIONS[name]
    im = radial(cin, cout).convert('RGBA')
    im.alpha_composite(rays(ray, alpha=ra))
    im.alpha_composite(halftone(dots, alpha=110))
    im.alpha_composite(vignette(0.35))
    im.alpha_composite(speed_lines(lines))
    im.alpha_composite(skater_layer(shadow, glow))
    return im.convert('RGB')  # RGB: App Store Connect rejects an icon with an alpha channel

if len(sys.argv) > 2 and sys.argv[1] == '--all':
    for name in OPTIONS:
        render(name).save(f'{sys.argv[2]}/{name}.png'); print(name)
else:
    render(CHOSEN).save(ICON); print(CHOSEN, '->', ICON)
