# Proposal

## Why

zack (Oct 25, 2026) sent a UI mockup for the skate shop: a graffiti SKATE SHOP title, YOUR BOARD and YOUR GEAR
panels with yellow tape labels, colour-coded cards with illustrated art and price tags standing on a workbench, and a
hint strip painted along the bench. He also said any art in webgnar/QFSHIVE and webgnar/excaliburSkate is fair game.

## What Changes

- **Card art from the game's own models.** `art/cards` renders the board (cruising, popped, mid-flip, on a rail), the
  deck, one truck, one wheel, the sedan, the coin and the Stoken gem with the game's toon shading and ink, to
  `public/sprites/cards/*.png` (about 110 KB in all). The sneaker is an inline SVG (there is no model of Lou's shoes on
  their own). The other repos' art is pixel art at a different scale, so none of it is used here.
- **Every card has a picture**: the model on a burst of the card's colour, plus a glyph for what it does (an arrow
  for a pop, a clock for Delay or Slow-mo, ×2, 5+, a coin with a ? for Coin Flip...). See `src/ui/shop-art.ts`.
- **Colours by type**, as in the mockup: trigger purple, effect blue, modifier yellow, board green, gear orange; the
  price sits centred on a black brush strip.
- **The room:** a shop wall, a wooden workbench under the hand, a deck hung on the wall, the graffiti title with a
  spray behind it, cash on a black strip, tape labels on the panels, `+` in empty slots, model pictures on the gear
  tiles.
- **Fit:** on narrow phones (iPhone SE) the gear tiles drop their names and the slot arrows go, so five slots and
  four parts still fit across.
- Rules, prices and the drag (ui2-card-shop) are unchanged.

## Capabilities

### Modified Capabilities

- `shop`: the look.

## Impact

`art/cards/*` (new tool), `public/sprites/cards/*.png`, `src/ui/shop-art.ts` (new), `src/main.ts` (card markup),
`index.html` (bench and wall), `src/style.css` (shop section).
