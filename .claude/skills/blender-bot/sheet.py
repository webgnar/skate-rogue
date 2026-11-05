import sys
from PIL import Image, ImageDraw
names=sys.argv[2].split(','); out=sys.argv[1]; views=["front","three_q","side","top"]; S=256
sh=Image.new("RGB",(S*4,S*len(names)),(30,30,30)); d=ImageDraw.Draw(sh)
for r,n in enumerate(names):
  for c,v in enumerate(views):
    sh.paste(Image.open(f"renders/{n}_{v}.png").convert("RGB").resize((S,S)),(c*S,r*S))
  d.text((6,r*S+6),n,fill=(255,255,255))
sh.save(out)
