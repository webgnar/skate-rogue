"""Pass 2b: frame the skeleton marks again over the beads (zack, 2026-11-04: "use
the color scheme to build around the borders of and inside of the skeleton pass,
60% opacity after the bead pattern has been applied").

The skeleton marks are found in the pass 1 texture (every body texel painted the
mark colour; accents such as navy spikes are left out). Over the beaded texture,
at OPACITY, each mark gets
  - its inside filled with INSIDE, so the bone reads through the beads, and
  - a border round it, BORDER world units wide, in EDGE.
Distances are measured on the model (3D), so a border carries on across a UV seam.

usage: python skeleton_frame.py -- file.blend object pass1.png beads.png out.png MARK INSIDE EDGE [border] [opacity]
  MARK, INSIDE, EDGE  hex colours from the model's scheme (Tyrant: 0c1c4e 0c1c4e ffdf0b)
  border   world units (0.22)      opacity  0..1 (0.6)
"""
import bpy, sys, os
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_texels import texel_samples

a = sys.argv[sys.argv.index('--') + 1:]
BLEND, OBJ, P1, SRC, OUT = a[:5]
hexc = lambda h: np.array([int(h.strip('#')[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
MARK, INSIDE, EDGE = hexc(a[5]), hexc(a[6]), hexc(a[7])
BORDER = float(a[8]) if len(a) > 8 else 0.22
OPACITY = float(a[9]) if len(a) > 9 else 0.6

bpy.ops.wm.open_mainfile(filepath=BLEND)
ob = bpy.data.objects[OBJ]
p1 = np.array(Image.open(P1).convert('RGB')).astype(np.float32)
img = np.array(Image.open(SRC).convert('RGB')).astype(np.float32)
S = img.shape[0]
P, rows, cols, PF, FN = texel_samples(ob, S)
me = ob.data
acc = me.attributes["acc"].data
face_acc = np.array([max(acc[v].value for v in p.vertices) for p in me.polygons])
body = face_acc[PF] == 0
is_mark = body & (np.abs(p1[rows, cols] - MARK).max(1) < 12)
print("skeleton texels", int(is_mark.sum()), "of", int(body.sum()))
tree = cKDTree(P[is_mark])
d, _ = tree.query(P[body & ~is_mark], distance_upper_bound=BORDER)
edge = np.zeros_like(is_mark)
edge[np.where(body & ~is_mark)[0][np.isfinite(d)]] = True
for m, c in ((is_mark, INSIDE), (edge, EDGE)):
    r, k = rows[m], cols[m]
    img[r, k] = img[r, k] * (1 - OPACITY) + c * OPACITY
print("frame: inside", int(is_mark.sum()), "border", int(edge.sum()))
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT)
