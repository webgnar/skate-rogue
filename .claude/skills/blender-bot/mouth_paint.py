"""Paint the inside of the mouth (zack, 2026-11-04: "the one thing that really fell
short to me is the mouth. it should be textured"). Runs after the beads and the
skeleton frame, before the sketch marks, so the sketch darks stain it too.

Finds the mouth from the mesh's own layers: the roof is skull skin (part 0) facing
down over the jaw, the floor is jaw skin (part 1) facing up. Then, hard edged, in
the model's scheme:
  roof   GUM, with a ridge across it every RIDGE units (the palate's bones), and
         the throat at the back fading to THROAT
  floor  GUM along both edges under the teeth, a TONGUE down the middle with a
         groove of GUM along its centre, THROAT at the back

Then the bead pattern goes over the whole mouth at 50%, laid flat from above
(the floor) and from below (the roof), since the four side views of
bead_project.py never reach it (zack, 2026-11-04: bead and sketch texture inside
the mouth too). The sketch marks run after this and stain it like the body.

usage: python mouth_paint.py -- file.blend object in.png out.png GUM TONGUE RIDGE_COL THROAT [ridge] [bead colours] [pattern.json] [pitch]
  Tyrant: ff000e ff960d 4c240c 0c1c4e 0.6 ff960d,4c240c,ff000e,ffdf0b pattern.json 0.35
"""
import bpy, sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_texels import texel_samples
import bead_plane as bp

a = sys.argv[sys.argv.index('--') + 1:]
BLEND, OBJ, SRC, OUT = a[:4]
hexc = lambda h: np.array([int(h.strip('#')[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
GUM, TONGUE, RIDGE_C, THROAT = (hexc(x) for x in a[4:8])
RIDGE = float(a[8]) if len(a) > 8 else 0.6

bpy.ops.wm.open_mainfile(filepath=BLEND)
ob = bpy.data.objects[OBJ]; me = ob.data
img = np.array(Image.open(SRC).convert('RGB')).astype(np.float32)
S = img.shape[0]
P, rows, cols, PF, FN = texel_samples(ob, S)
acc = me.attributes["acc"].data; part = me.attributes["part"].data
F_acc = np.array([max(acc[v].value for v in p.vertices) for p in me.polygons])
F_part = np.array([max(part[v].value for v in p.vertices) for p in me.polygons])
V = np.array([v.co[:] for v in me.vertices])
jaw_v = np.array([part[i].value == 1 and acc[i].value == 0 for i in range(len(V))])
J = V[jaw_v]
y0, y1 = J[:, 1].min(), J[:, 1].max()          # the mouth runs the jaw's length
x_half = np.abs(J[:, 0]).max()
jaw_top = J[:, 2].max()
nz = FN[PF, 2]
skin = F_acc[PF] == 0
inx = (P[:, 1] >= y0) & (P[:, 1] <= y1)
floor = skin & (F_part[PF] == 1) & (nz > 0.35)
roof = skin & (F_part[PF] == 0) & (nz < -0.35) & inx & (P[:, 2] > jaw_top - 1.0) & (P[:, 2] < jaw_top + 2.0)
back = y1 - (y1 - y0) * 0.22                     # the throat: the last fifth of the mouth
def put(m, c):
    img[rows[m], cols[m]] = c
put(roof, GUM)
ridges = roof & (np.mod(P[:, 1] - y0, RIDGE) < RIDGE * 0.28) & (np.abs(P[:, 0]) < x_half * 0.7)
put(ridges, RIDGE_C)
xr = np.abs(P[:, 0]) / max(x_half, 1e-6)
put(floor, GUM)
tongue = floor & (xr < 0.55 * (1 - 0.6 * np.clip((y0 + 1.2 - P[:, 1]) / 1.2, 0, 1)))   # rounded at the tip
put(tongue, TONGUE)
put(tongue & (xr < 0.08), GUM)                   # the groove down its middle
put((roof | floor) & (P[:, 1] > back), THROAT)
if len(a) > 9:
    # the beads, flat in (x, y), the plane's rings running nose to throat
    if len(a) > 10: bp.load(a[10])
    PITCH = float(a[11]) if len(a) > 11 else 0.35
    PAL = {str(i): hexc(h) for i, h in enumerate(a[9].split(','))}
    m = roof | floor
    u, v = P[m, 0] / PITCH, P[m, 1] / (PITCH * 0.866)
    best_d = np.full(m.sum(), 1e9); best_c = np.empty(m.sum(), dtype=object)
    for dr in (0, 1):
        ring = np.floor(v).astype(int) + dr
        k = np.round(u + 0.5 * ring).astype(int)
        dd = (u - (k - 0.5 * ring)) ** 2 + ((v - ring) * 0.866) ** 2
        better = dd < best_d
        best_d[better] = dd[better]
        for i in np.where(better)[0]:
            best_c[i] = bp.colour_at(int(ring[i]), int(k[i]))
    hit = best_d <= 0.42 ** 2
    idx = np.where(m)[0][hit]
    col = np.array([PAL[c] for c in best_c[hit]])
    img[rows[idx], cols[idx]] = img[rows[idx], cols[idx]] * 0.5 + col * 0.5
    print("mouth beads on", len(idx), "texels")
# sketch marks in the mouth (the AO sketch finds few edges on its broad faces):
# short broken strokes of random length, dark 35% where the tongue meets the
# gums and along the gum line under the teeth, light 20% down the tongue's ridge
rng = np.random.default_rng(3)
def broken(m, along):
    """keep a mask only on random strokes 0.3 to 1.4 long along `along`, each
    restarting near the end of the last"""
    keep = np.zeros(len(P), bool)
    t, hi = along[m].min() if m.any() else 0, along[m].max() if m.any() else 0
    while t < hi:
        L = rng.uniform(0.3, 1.4)
        keep |= m & (along >= t) & (along < t + L)
        t += L + rng.uniform(-0.05, 0.2)
    return keep
tw = 0.55 * (1 - 0.6 * np.clip((y0 + 1.2 - P[:, 1]) / 1.2, 0, 1))
for m, c, op in ((floor & (np.abs(xr - tw) < 0.06), np.zeros(3), 0.35),
                 (floor & (xr > 0.88), np.zeros(3), 0.35),
                 (roof & (xr > 0.85), np.zeros(3), 0.35),
                 (tongue & (np.abs(xr - 0.22) < 0.04), np.full(3, 255.0), 0.2)):
    k = broken(m, P[:, 1])
    img[rows[k], cols[k]] = img[rows[k], cols[k]] * (1 - op) + c * op
print("mouth roof", int(roof.sum()), "ridges", int(ridges.sum()), "floor", int(floor.sum()), "tongue", int(tongue.sum()))
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT)
