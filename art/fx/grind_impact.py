# The grind-entry impact sheet (zack's reference, 2026-10-31): a 4-point star flash that grows inside a ring, then
# breaks into a dashed ring and streaks that fly out and fade. Ten 128 px frames in a row, drawn with signed
# distances at 4x and scaled down so the edges stay smooth. Each frame gets the game's dark ink rim and a white-hot
# core in the star, so it reads against a bright afternoon street as well as at night.
#   python3 art/fx/grind_impact.py  ->  public/sprites/fx/grind-impact.png
import math
import numpy as np
from PIL import Image, ImageFilter

N, PX, SS = 10, 128, 4
S = PX * SS
CYAN = (174, 244, 255)
CORE = (255, 255, 255)
INK = (16, 14, 40)
RIM = 9  # ink width at 4x (a little over 2 px in the sheet)

ys, xs = np.mgrid[0:S, 0:S]
X = (xs + 0.5) / S * 2 - 1  # -1..1, y up
Y = 1 - (ys + 0.5) / S * 2


def rot(a):
    c, s = math.cos(a), math.sin(a)
    return X * c + Y * s, -X * s + Y * c


def star(r, a, squash=1.0):
    # a concave 4-point star (an astroid), points along its own axes; `squash` stretches one axis into the long spike
    if r <= 0:
        return np.zeros_like(X, bool)
    u, v = rot(a)
    u = np.abs(u) / (r * squash)
    v = np.abs(v) / r
    return np.sqrt(u) + np.sqrt(v) < 1


def ring(r, w, dashes=0, gap=0.0, spin=0.0):
    d = np.abs(np.hypot(X, Y) - r) < w / 2
    if dashes:
        a = (np.arctan2(Y, X) + spin) / (2 * math.pi) * dashes
        d &= (a - np.floor(a)) > gap
    return d


def streak(cx, cy, a, length, w):
    # a thin lens: widest in the middle, sharp at both ends
    u, v = rot(a)
    cu, cv = cx * math.cos(a) + cy * math.sin(a), -cx * math.sin(a) + cy * math.cos(a)
    t = (u - cu) / (length / 2)
    return (np.abs(t) < 1) & (np.abs(v - cv) < w / 2 * (1 - t * t))


DIAG = math.radians(62)  # the long spikes' line, up and to the right like the sheet
frames = []
for k in range(N):
    t = k / (N - 1)
    m = np.zeros_like(X, bool)
    alpha = 1.0 if k < 7 else (1.0, 0.8, 0.5)[k - 7] if k < 10 else 0
    # the star: grows to frame 5, then shrinks to a glint and is gone
    grow = [0.06, 0.12, 0.24, 0.36, 0.5, 0.52, 0.42, 0.2, 0.07, 0.0][k]
    tilt = math.radians([0, 0, 0, 10, 20, 25, 30, 35, 40, 40][k])
    m |= star(grow, tilt, 1.0)
    core = star(grow * 0.45, tilt, 1.0)
    if 2 <= k <= 6:  # the long spikes through it, on the diagonal
        L = [0, 0, 0.5, 0.75, 0.95, 0.9, 0.85][k]
        m |= streak(0, 0, DIAG, L * 2, [0, 0, 0.045, 0.05, 0.055, 0.045, 0.04][k])
    # the ring: solid as it opens, then dashed, thinning, the gaps widening
    R = [0, 0.12, 0.22, 0.44, 0.6, 0.7, 0.72, 0.75, 0.78, 0.8][k]
    W = [0, 0.03, 0.025, 0.03, 0.03, 0.028, 0.025, 0.022, 0.018, 0.014][k]
    if k <= 4:
        m |= ring(R, W * 1.6)
    else:
        m |= ring(R, W * 1.6, 12, [0, 0, 0, 0, 0, 0.25, 0.35, 0.45, 0.55, 0.65][k], spin=0.1 * k)
    if k >= 6:  # streaks broken off the spikes, flying out past the ring
        for sgn in (1, -1):
            d = [0, 0, 0, 0, 0, 0, 0.75, 0.88, 0.95, 1.0][k]
            L = [0, 0, 0, 0, 0, 0, 0.28, 0.2, 0.12, 0.06][k]
            m |= streak(sgn * d * math.cos(DIAG), sgn * d * math.sin(DIAG), DIAG, L, 0.04)
            a2 = DIAG + math.pi / 2  # and two short ones across
            m |= streak(sgn * d * 0.85 * math.cos(a2), sgn * d * 0.85 * math.sin(a2), a2, L * 0.6, 0.032)
    # the ink rim: the shape grown by RIM, drawn first in dark ink
    rim = np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(RIM * 2 + 1))) > 0
    img = np.zeros((S, S, 4), np.uint8)
    img[rim, :3] = INK
    img[m, :3] = CYAN
    img[core, :3] = CORE
    img[..., 3] = (rim * 255 * alpha).astype(np.uint8)
    frames.append(Image.fromarray(img, 'RGBA').resize((PX, PX), Image.LANCZOS))

sheet = Image.new('RGBA', (PX * N, PX))
for k, f in enumerate(frames):
    sheet.paste(f, (k * PX, 0))
sheet.save('public/sprites/fx/grind-impact.png')
