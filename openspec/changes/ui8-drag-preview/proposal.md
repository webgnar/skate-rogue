# ui8-drag-preview

## Why
The board wires (ui7) show what the board fires now, but not what a card would do before you drop it. zack said yes
to showing it while dragging.

## What changes
- While a shop card or a board slot is held over a slot, the wires, dead marks and the board-in-words under YOUR BOARD
  show the board the drop would make (a card replaces the slot, a slot swaps). The wires pulse and the words read
  "IF YOU DROP IT:". Moving off the slot or letting go puts the real board back.
- `dropBoard()` in src/board/shop.ts computes that board; it is pure and tested.
