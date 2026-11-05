"""Lay a bead crochet numerical pattern flat (Crafting Conundrums rules).

Bead number ring*N + k sits at x = k - ring/2, ring y going UP; the string runs on across the
page and never wraps within a ring. Neighbours of bead i: i-1, i+1, i+N (up-left), i+N+1
(up-right), i-N (down-right), i-N-1 (down-left). Pull shapes out by plane position, never by
string index. Escher Lizards checked bead for bead against the book by zack, 2026-11-04.

A pattern is the JSON bead_read_page.py writes; load() switches to one. Colours are ids
("0", "1", ...), mapped to zack's palette by whoever paints.
usage: python3 bead_plane.py [pattern.json] out.png   (draws the flat plane)
"""
import json, sys
from PIL import Image, ImageDraw

# default: Escher Lizards, 9-around (printed page 201)
N = 9
RUNS = "3 4 4 1 1 3 1 1 3 1 4 1 1 2 1 1 1 5 1 2 1 1 2".split()
COLS = "01230121201212010130101"          # line 1; lines 2 and 3 rotate 0->2->1->0
ROT = {"0": "2", "1": "0", "2": "1", "3": "3"}
seq, cols = [], COLS
for _ in range(3):
    for n, c in zip(RUNS, cols):
        seq += [c] * int(n)
    cols = "".join(ROT[c] for c in cols)
COLOURS = {"0": "7ad4f5", "1": "2e3192", "2": "bf1b2c", "3": "f8c91f"}   # as printed


def load(path: str) -> None:
    global N, seq, COLOURS
    p = json.load(open(path))
    N = p["around"]
    seq = [cid for n, cid in p["runs"] for _ in range(n)]
    COLOURS = p["colours"]


def colour_at(ring: int, k: int) -> str:
    return seq[(ring * N + k) % len(seq)]


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) > 1:
        load(args[0])
    rgb = {c: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for c, h in COLOURS.items()}
    D, H, ROWS, W = 14, 0.87, 48, 30
    im = Image.new("RGB", (W * D + 60, int(ROWS * D * H) + 40), "white")
    d = ImageDraw.Draw(im)
    for ring in range(ROWS):
        for k in range(-ROWS, W + ROWS):
            x = k - 0.5 * ring
            if 0 <= x < W:
                px, py = 20 + x * D, im.height - 20 - D - ring * D * H
                d.ellipse((px, py, px + D - 1, py + D - 1), fill=rgb[colour_at(ring, k)])
    im.save(args[-1] if args else "bead_plane.png")
