# UV and paint

zack's painting process, worked out with zack on 2026-11-04 and tested on a
copy of the Tyrant. Every stroke is painted on the model in the viewport
(here: projected onto the model), never drawn on the flat UV image.

**Colours:** the palette zack gives for the model. When he gives none, the bot
chooses its own, and does not stop to ask:

- **Colourful, in the feel of zack's palettes**: about five colours, a
  saturated body colour, a deep dark for the skeleton marks, and one or two
  bright accents that stand off both (the Tyrant's orange body, navy marks
  and yellow is that feel).
- **Never the same colours as one of zack's palettes.** Pick new hues
  for every colour. Taking his set with one colour swapped is still his set
  (zack, 2026-11-04: "dont have it use the same colors of that exact
  pallete").
- Name the palette with its hex values in the delivery, so zack can swap it.

The order is fixed: UV, then pass 1, then pass 2, then pass 2.5, then pass 3. A model is
painted from scratch in that order.

## UV

1. Smart UV Project at **80 degrees** (zack uses Smart UV).
2. Average Island Scale.
3. Pack Islands: any rotation, concave shape method, 0.004 margin
   (`pack_islands(rotate=True, rotate_method='ANY', scale=True,
   margin_method='FRACTION', margin=0.004, shape_method='CONCAVE')`).
4. **The blank space stays black**, not filled with colour: `uv_blackout.py`,
   which keeps a 2 px bleed round each island so Closest sampling never reads
   black at an edge.

On the Tyrant this took the texture used from 34% to 50%, 1.6x the texels per
area. Seams by body part are wanted later, but each tube (a leg, the tail) needs
a cut down its length as well as its border, or the unwrap fails.

**Texture size:** bosses paint at **1024** (`Painter(..., size=1024)`;
smaller enemies 512). Bead size is set against the
texture: the texture goes up to keep beads round, the beads never grow to fit a
small texture. Below about 3 texels a bead lands as a square.

## Pass 1: the sprayed base

- Fill each part with one colour from the model's scheme.
- Spray depth in the way a 2D drawing fakes it: white to lighten and black to
  darken, both at low opacity, built up to about half strength.
- The light follows **each part's own shape**: a leg, a jaw, a belly plate is
  lit as its own form, not from one sun over the whole body.
- The skeleton marks (ribs, skull windows, vertebrae, tail chevrons, hip
  plates, limb bones, balanced front, side and back) are part of this pass,
  so the beads go over them. `Painter` in `bb_lib.py` draws them. The beads
  always go on top of them and never replace them (zack, 2026-11-04).

## Pass 2: the bead pattern

A bead crochet pattern is generated, not drawn. Read it the way *Crafting
Conundrums* (Baker and Goldstine) says, "Anatomy of a Pattern Page":

1. **N-around** is the number of beads in one ring.
2. **The numerical pattern** is one string: the count of beads of each colour,
   left to right, top to bottom. Line breaks mean nothing. `[1 1 x 4]` is
   eight 1s.
3. **Lay it flat:** bead `ring*N + k` sits at `x = k - ring/2`, rings going
   UP. The string runs straight on across the page; it never wraps back to the
   start of its ring. Going N beads right lands half a bead left and one ring
   up (the book's hockey stick).
4. **Neighbours** of bead i: i-1 and i+1, i+N up-left, i+N+1 up-right, i-N
   down-right, i-N-1 down-left.
5. **Pull a shape out by plane position, never by string index**: one bead of
   the string appears at many places on the plane.

Three ways this went wrong, each caught by zack: rows drawn downward (mirrored
tiles), shapes pulled out by string index (stray eye beads), and wrapping each
ring every N (broken pattern). `bead_plane.py` holds the rules and Escher
Lizards (9-around, 135 beads, checked bead for bead).

**Finding a pattern for this animal.** The book is *Crafting Conundrums*
(Baker and Goldstine), `/mnt/project-files/93a6e9b22381500afbb3e337b22062fd.pdf`
(zack's copy; never commit its pages or patterns to the repo). Its printed page
p is PDF page p + 23.

1. `python3 bead_catalog.py BOOK.pdf` lists all 98 pattern pages: PDF page,
   title, N-around, tags. Add words to filter (`... snake scale lizard`).
2. Pick by the animal: a creature motif or its skin first (Escher Lizards for
   a reptile, Knotted Snakes for a snake or worm), then a shape that echoes
   the body (zigzags and sawtooths for spiny, swirls for soft or coiled,
   hexagons and herringbone for armoured or scaled). A page marked "(no
   numbers)" has no numerical pattern and cannot be read. Prefer three or four
   colours: one more than zack's scheme gives muddies the tiles.
3. `python3 bead_read_page.py BOOK.pdf PAGE pattern.json` reads it: N-around,
   the numerical pattern with `[a b x n]` shorthand expanded, and each number's
   colour sampled off the rendered page (by eye they were misread).
4. `python3 bead_plane.py pattern.json plane.png` draws the flat plane. Look
   at it beside the page's bead plane picture before painting: they must
   match.
5. Map the pattern's colour ids to zack's palette and paint. In the delivery,
   name the page, why it suits the animal, and the colour mapping, so zack can
   swap it.

Checked on Escher Lizards (identical to the hand-entered pattern), Ultimate
Swirl and Sophie's Original Seven-Color Torus (672 beads, 7 colours, as the
book says).

**Putting it on the model** (`bead_project.py`):

- Orthographic, the flat plane laid over the model from **front, back, left
  and right**. No top or bottom (zack).
- **A flyer or a flat creature also takes a top view** (`--top`; zack,
  2026-11-04). The game camera looks down, and with four side views the
  Skimmer's wing tops and the Manta's back came out with no beads at all. The
  bottom is still never sprayed, and a walker keeps the four views.
- Every bead is a hard round **50%** dab, about **3 texels** across (Tyrant,
  42 units long: 0.35 units apart on 1024).
- **Set the pitch from the model, never reuse 0.35, and never from the
  texture.** Pitch = the model's longest side / 120 at ANY texture size
  (`PITCH` = `auto`). A bead is then the same share of the model on every
  creature. The texture only decides whether that bead lands round:
  `bead_project.py` prints the texels a bead gets, and under 3 it warns. Then
  paint at the next size up (512 to 1024); never raise the pitch to fit a
  small texture. An earlier version of this rule said length / 60 on 512,
  which doubled the beads on the Tyrant Raptor until they covered the moss
  colour of its back.
- **At boss scale a tile reads as patches of colour with flecks**, not as a
  picture of the motif. That is the look zack approved on the Tyrant ("thats
  sick"); it is not a fault to fix by making beads bigger. Big beads on a big
  model turn back into squares. If a model needs the motif itself to read,
  that is a pattern choice (a page with larger, bolder tiles), which zack
  makes.
- A depth test keeps each view off faces hidden from it.
- Where two views reach a face their patterns **overlap and mix**. That is
  wanted: no seam matching.
- The pattern's colours map to zack's palette per model
  (`bead_project.py ... PITCH c0,c1,c2,... pattern.json`). Navy tiles vanish
  over navy bones, so pick tile colours that stand off pass 1.

## Pass 2.5: the scheme over the skeleton

Provisional (zack, 2026-11-04; being tried on the one-shot Tyrant, so the
look may still change).

- After the beads, paint the model's **scheme colours at 60%** around the
  **borders** of the pass 1 skeleton marks and **inside** them.
- This brings the skeleton back up through the bead pattern, so the bones
  read again. The beads stay under it and are never erased.
- Use the same mask as the skeleton marks, from `Painter`, so the border
  follows each mark's own shape.

## Pass 3: the sketch marks

- **20% opacity** for the light marks, heavier for the darks, over everything.
- **Stain the crevices dark, highlight the spikes, the eyes and the body's
  shape light** (zack). White and black at low opacity.
- Sketchy lines: never one dragged stroke. A short stroke, stop, the next one
  starting on the end of the last, random lengths, several brush sizes.
- The marks follow the form and sit in its crevices.

`sketch_marks.py`: a dark mark on every edge that sits in a crevice, found by
ambient occlusion at its two vertices (96 rays, 6 units), plus any edge that
folds in; a light mark on a hard edge over 28 degrees that folds out and is
open to the sky. **Every accent catches the light** (zack): each loose part
but the body (teeth, eyes, spikes, claws) gets light marks on all its edges with
the smaller brushes, whatever its occlusion, so teeth deep in the mouth still
read. **The darks go on heavier than the lights**: 35% black against
20% white by default (zack: "the black needs to be higher opacity"). The first
version used the fold alone and the darks did not read: a low-poly model has
few edges that fold in (79 of 940 on the Tyrant), and the crevices where parts
meet are mostly smooth. zack is painting an example on
`/mnt/project-files/blender-bot/tyrant_paint_example.blend` to tune against.

**Glowing parts skip pass 3.** A light mark on every accent washes a glowing
eye or a glowing shell out to a pale patch (the Lobber). Name the glow colours
with `--glow=hex,hex`: any accent part whose texels are mostly one of them gets
no marks at all, light or dark, and no stroke from a neighbour spills onto it.
Read the colours off the pass 1 texture with `--glow-ref=base.png`, since the
beads have gone over it by then. Every other accent still catches the light.

**Emission is optional.** `--glow-map=glow.png` writes an emission map: the
glowing parts in their own colour, everything else black. Plug it into the
material's Emission Color only when the model is meant to glow in the game;
by default zack's models carry no emission map (`STYLE_GUIDE.md`).

## Running the passes on a saved model

```bash
B="blender files/bot/<name>.blend"; T=tools/blender_bot
python3 $T/bead_catalog.py BOOK.pdf <words>      # pick a page
python3 $T/bead_read_page.py BOOK.pdf <page> pattern.json
python $T/bead_project.py -- "$B" <object> base.png beads.png auto c0,c1,c2,c3 pattern.json [--top]
python $T/sketch_marks.py -- "$B" <object> beads.png sketched.png [--glow=hex --glow-ref=base.png --glow-map=glow.png]
python $T/uv_blackout.py  -- "$B" <object> sketched.png final.png
```

Slop check and the joint fix run after the paint too, so the paint never
changes geometry.
