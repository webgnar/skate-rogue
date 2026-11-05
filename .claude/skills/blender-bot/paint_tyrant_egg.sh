#!/bin/bash
# Passes 2, 2.5 and 3 on the built Tyrant Egg (PAINTING.md), after build_tyrant_egg.py.
# usage: bash paint_tyrant_egg.sh <out dir> <pattern.json>
#   pattern.json: Honeycomb, Crafting Conundrums p.177 (PDF page 200), read with
#   bead_read_page.py; the book's pages are zack's copy and are not committed.
set -e
O=$1; PAT=$2; T=$(dirname "$0"); PY=${PY:-/opt/bpyenv/bin/python}; B=$O/tyrant_egg.blend
cp $O/tyrant_egg.png $O/pass1.png
# Honeycomb's walls (0) and two of its cells go to the shell's own yellow, so on
# the egg they are only a soft fleck; the other two cells are teal and rust.
$PY $T/bead_project.py -- $B Cube $O/pass1.png $O/beads_all.png 0.28 ffd23f,12b5a5,ffd23f,5a2a12,ffd23f $PAT
# the beads go on the egg only: the nest is earth and keeps pass 1 under its sketch
$PY - $O/pass1.png $O/beads_all.png $O/tyrant_egg_nestmask.png $O/beads.png <<'PYEOF'
import sys, numpy as np
from PIL import Image
from scipy import ndimage
p1, beads, mask, out = sys.argv[1:5]
a = np.array(Image.open(p1).convert('RGB')); b = np.array(Image.open(beads).convert('RGB'))
m = ndimage.binary_dilation(np.array(Image.open(mask)) > 127, iterations=3)   # with the 4 px bleed round its islands
b[m] = a[m]; Image.fromarray(b).save(out)
PYEOF
# pass 2.5: the embryo's pink bones filled again over the beads, with a violet
# border, at 60%, so the skeleton reads through the honeycomb
$PY $T/skeleton_frame.py -- $B Cube $O/pass1.png $O/beads.png $O/framed.png ff2e88 ff2e88 1e0f45 0.22 0.6
$PY $T/sketch_marks.py -- $B Cube $O/framed.png $O/sketched.png
$PY $T/uv_blackout.py -- $B Cube $O/sketched.png $O/tyrant_egg.png
