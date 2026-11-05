"""Keep the UV blank space black (zack): every texel outside the islands, past a 2 px bleed so
Closest sampling never reads black at an island edge, is set to 0,0,0.

usage: python uv_blackout.py -- file.blend object texture_in.png texture_out.png
"""
import bpy, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
me = bpy.data.objects[a[1]].data; uvl = me.uv_layers.active.data
im = np.array(Image.open(a[2]).convert('RGB')); S = im.shape[0]
m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
for p in me.polygons:
    d.polygon([(uvl[l].uv[0] * S, (1 - uvl[l].uv[1]) * S) for l in p.loop_indices], fill=255)
mask = np.array(m.filter(ImageFilter.MaxFilter(5))) > 0
im[~mask] = 0
Image.fromarray(im).save(a[3])
