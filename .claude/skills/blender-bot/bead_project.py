"""Pass 2: the bead pattern, painted flat in orthographic from front, back, left and right.

usage: python bead_project.py -- file.blend object texture_in.png texture_out.png PITCH COLOURS [pattern.json] [--top]
  PITCH    world units between beads, or "auto": the model's longest side / 120, whatever the
           texture size (Tyrant, 42 long: 0.35). The run prints the texels a bead gets and
           warns under 3: then the texture goes up, the beads never grow (zack)
  COLOURS  hex colours from zack's palette for the pattern's colour ids 0,1,2,..., comma separated
  pattern  from bead_read_page.py; Escher Lizards when left out

Each view lays the flat bead plane (bead_plane.py) over the model in screen space and dabs
every bead it sees at 50%, hard edged, one dab per texel per view. A depth test keeps a view
off faces hidden from it. Views overlap where a face reaches two of them, and the two patterns
mix: wanted (zack), so there is no seam matching. Top and bottom are not sprayed (zack).
--top adds a view from straight above, for a flyer whose wings are seen top-down in the game
(zack, 2026-11-04: flyers and flat creatures). The bottom is never sprayed.
"""
import bpy, sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bead_plane as bp
from bb_texels import texel_samples

a = sys.argv[sys.argv.index('--') + 1:]
TOP = '--top' in a
a = [x for x in a if x != '--top']
BLEND, OBJ, SRC, OUT = a[0], a[1], a[2], a[3]
hexc = lambda h: np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
if len(a) > 6:
    bp.load(a[6])
PAL = {str(i): hexc(h.strip('#')) for i, h in enumerate(a[5].split(','))}
RADIUS = 0.42          # of the pitch: a small gap between beads
OPACITY = 0.5
UP = np.array([0, 0, 1.0])
VIEWS = [np.array(v) for v in ([1.0, 0, 0], [-1.0, 0, 0], [0, -1.0, 0], [0, 1.0, 0])]
if TOP:
    VIEWS.append(np.array([0, 0, 1.0]))

bpy.ops.wm.open_mainfile(filepath=BLEND)
ob = bpy.data.objects[OBJ]
PITCH = max(ob.dimensions) / 120 if a[4] == 'auto' else float(a[4])
tex = np.array(Image.open(SRC).convert('RGB')).astype(float) / 255
S = tex.shape[0]
P, R, C, PF, FN = texel_samples(ob, S)
area = sum(p.area for p in ob.data.polygons) * float(np.prod(ob.matrix_world.to_scale())) ** (2 / 3)
texel = (area / len(P)) ** 0.5                     # world size of one texel on this unwrap
across = 2 * RADIUS * PITCH / texel
print('pitch %.3f  longest side %.1f  a bead is %.1f texels across' % (PITCH, max(ob.dimensions), across))
if across < 3:
    print('WARNING beads under 3 texels land as squares: paint at %d, do not raise the pitch' % (S * 2))
N = FN[PF]
out = tex.copy()
for view in VIEWS:
    up = UP if abs(view[2]) < 0.5 else np.array([0, 1.0, 0])   # from above, screen up is +Y
    right = np.cross(-view, up)
    su, sv, d = P @ right, P @ up, P @ view
    cell = PITCH * 0.35
    key = np.floor(su / cell).astype(int) * 100003 + np.floor(sv / cell).astype(int)
    order = np.argsort(key)
    _, first = np.unique(key[order], return_index=True)
    near = np.maximum.reduceat(d[order], first)
    nearest = dict(zip(key[order][first], near))
    front = np.array([nearest[k] for k in key])
    seen = (N @ view > 0.05) & (d >= front - PITCH * 0.6)
    u, v = su / PITCH, sv / (PITCH * 0.866)
    best_d = np.full(len(P), 1e9); best_c = np.empty(len(P), dtype=object)
    for dr in (0, 1):
        ring = np.floor(v).astype(int) + dr
        k = np.round(u + 0.5 * ring).astype(int)
        dd = (u - (k - 0.5 * ring)) ** 2 + ((v - ring) * 0.866) ** 2
        better = dd < best_d
        best_d[better] = dd[better]
        for i in np.where(better)[0]:
            best_c[i] = bp.colour_at(int(ring[i]), int(k[i]))
    hit = seen & (best_d <= RADIUS ** 2)
    col = np.array([PAL[c] for c in best_c[hit]])
    out[R[hit], C[hit]] = out[R[hit], C[hit]] * (1 - OPACITY) + col * OPACITY
    print('view', view, 'beads on', hit.sum(), 'texels')
Image.fromarray((out * 255).round().astype(np.uint8)).save(OUT)
