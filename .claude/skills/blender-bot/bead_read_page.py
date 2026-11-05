"""Read a bead crochet pattern page of Crafting Conundrums into pattern JSON.

usage: python3 bead_read_page.py BOOK.pdf PDF_PAGE out.json
  The book's printed page p is PDF page p + 23 (Escher Lizards: printed 201, PDF 224).

Takes the title, N-around and the numerical pattern from the page's text, and each number's
colour from the page itself: the page is rendered and every number's box is sampled, so the
colours come out exactly as printed (reading them by eye got them wrong). Shorthand like
[1 2 x 4] is expanded. Writes {"title", "around", "runs": [[count, colour_id], ...],
"colours": {colour_id: "rrggbb"}} for bead_plane.py.
Needs poppler-utils (pdftotext, pdftoppm) and Pillow.
"""
import json, re, subprocess, sys, tempfile, os, html
from PIL import Image
import numpy as np

pdf, page, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
DPI = 200
txt = subprocess.run(['pdftotext', '-layout', '-f', str(page), '-l', str(page), pdf, '-'],
                     capture_output=True, text=True).stdout
lines = [l for l in txt.splitlines() if l.strip()]
title = lines[0].strip()
m = re.search(r'(\d+)-around', txt)
around = int(m.group(1)) if m else None

bb = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), pdf, '-'],
                    capture_output=True, text=True).stdout
words = [(float(a), float(b), float(c), float(d), html.unescape(w)) for a, b, c, d, w in
         re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<', bb)]
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', str(DPI), '-png', pdf,
                    os.path.join(tmp, 'p')], check=True)
    img = Image.open(os.path.join(tmp, sorted(os.listdir(tmp))[0])).convert('RGB')
k = DPI / 72.0

def colour_of(w):
    x0, y0, x1, y1 = (int(v * k) for v in w[:4])
    a = np.asarray(img.crop((x0, y0, x1, y1))).reshape(-1, 3).astype(int)
    a = a[765 - a.sum(1) > 45]                  # ink, not paper (a pale bead prints pale)
    if not len(a):
        return None
    r, g, b = a[np.argsort(a.sum(1))[len(a) // 2]]
    return '%02x%02x%02x' % (r, g, b)

# the numerical pattern: rows of words that are all numbers or shorthand tokens
rows = {}
for w in words:
    if re.fullmatch(r'\[?\d+\]?|[x×]|\[\d+', w[4]):
        rows.setdefault(round(w[1]), []).append(w)
tokens = []
for y in sorted(rows):
    row = sorted(rows[y], key=lambda w: w[0])
    if sum(bool(re.search(r'\d', w[4])) for w in row) >= 4:
        tokens += row
runs, i = [], 0
while i < len(tokens):
    t = tokens[i][4]
    if t.startswith('['):                      # [a b c x n] : the group n times
        grp = []
        tokens[i] = tokens[i][:4] + (t[1:],)
        while tokens[i][4] not in ('x', '×'):
            grp.append((int(tokens[i][4].strip('[]')), colour_of(tokens[i]))); i += 1
        n = int(tokens[i + 1][4].strip(']')); i += 2
        runs += grp * n
    else:
        runs.append((int(t.strip('[]')), colour_of(tokens[i]))); i += 1

# cluster near colours into ids
ids, colours = [], {}
for _, c in runs:
    rgb = tuple(int(c[j:j + 2], 16) for j in (0, 2, 4))
    hit = next((cid for cid, h in colours.items()
                if sum(abs(a - b) for a, b in zip(rgb, h)) < 90), None)
    if hit is None:
        hit = str(len(colours)); colours[hit] = rgb
    ids.append(hit)
pat = {'title': title, 'around': around, 'page': page,
       'runs': [[n, cid] for (n, _), cid in zip(runs, ids)],
       'colours': {cid: '%02x%02x%02x' % h for cid, h in colours.items()},
       'beads': sum(n for n, _ in runs)}
json.dump(pat, open(out, 'w'), indent=1)
print(title, around, 'around,', pat['beads'], 'beads,', len(colours), 'colours')
