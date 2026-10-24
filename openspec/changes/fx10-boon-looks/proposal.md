# Proposal

## Why

Boons and board mods change how Lou skates, but nothing on screen said a boon was working, so a player could not
tell what they had bought.

## What Changes

A look for each of the 12 boons and 7 board mod effects (Spark Trail already sprays sparks), all through the
one particle pool (`src/render/boon-fx.ts`). POP boons use the POP yellow and GRIND boons the GRIND orange, matching
their cards.

| Boon or mod | Look |
| --- | --- |
| Big Pop | yellow ring kicked out flat under the board on every ollie |
| Late Flip | yellow streaks shoot down from the board on each flip |
| Triple Threat | three stacked rings on the extra jump |
| Floaty Flip | pale feathers drift off the board while gravity is halved |
| Pressure Flip | an updraft under the board while it floats |
| Spare Change | a gold pip rises on each grind (the quarter jump banked) |
| Rail Magnet | violet pixels pulled in to where the board catches |
| Grease | dark glossy drips off the trucks while grinding |
| Rail Launch | an orange plume off a rail ollie, bigger the faster you grind |
| Exit Wax | a wax-white streak off the wheels while rail speed lasts |
| Feeble Frenzy | pink-orange sparks that build the longer you stay on one rail |
| Ghost Rail | the ghost rail itself (already drawn) |
| Double Pop | a white and yellow ring |
| Speed Kick | cyan streaks blasting backwards |
| Jump Refill | a fan of yellow pips rising |
| Cash Burst | green confetti |
| Slow-mo | a pale blue ring slowly opening |
| Gravity Flip | violet pixels falling upward |
| Shockwave | a dust ring racing out along the ground, with the comic burst |

## Impact

Visual only. Particle counts are small, and the low tier cuts them.
