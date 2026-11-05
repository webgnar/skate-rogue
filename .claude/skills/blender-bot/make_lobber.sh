#!/bin/bash
# The Lobber, end to end: build, the paint passes, checks, renders, the game's .glb.
# usage: bash make_lobber.sh <out dir> <bead book pdf>
set -e
O=$1; BOOK=$2; B=${B:-/opt/bpyenv/bin/python}; T=$(dirname "$0")
mkdir -p "$O"
# palette (provisional, ours): plum ink, hot orange, lime, teal body, deep teal
PAL=2b0b3f,ff7a1a,d6f03a,16b3a3,0b4f4a
[ -f "$O/honeycomb.json" ] || python3 $T/bead_read_page.py "$BOOK" 177 "$O/honeycomb.json"   # Honeycomb, 9-around
$B $T/build_lobber.py -- "$O" 2>&1 | grep "PROP\|MIRROR\|JOINTS left\|SOFTEN\|CONNECT\|TRIS\|SOLES\|SAVED\|SCAR"
cp "$O/lobber.png" "$O/pass1.png"
$B $T/bead_project.py -- "$O/lobber.blend" Cube "$O/pass1.png" "$O/pass2.png" 0.43 $PAL "$O/honeycomb.json" | grep view
$B $T/skeleton_frame.py -- "$O/lobber.blend" Cube "$O/pass1.png" "$O/pass2.png" "$O/pass2b.png" 2b0b3f 2b0b3f ff7a1a 0.14 0.6 | grep frame
$B $T/sketch_marks.py -- "$O/lobber.blend" Cube "$O/pass2b.png" "$O/pass3.png" | grep sketch
$B $T/uv_blackout.py -- "$O/lobber.blend" Cube "$O/pass3.png" "$O/final.png" > /dev/null
cp "$O/final.png" "$O/lobber.png"
$B $T/slop_check.py -- "$O/lobber.blend" "$O/slop" 480 2>&1 | grep "^SLOP"
$B $T/turnaround.py -- "$O/lobber.blend" "$O/sheet.png" 768 | grep SHEET
$B $T/closeup.py -- "$O/lobber.blend" "$O/head.png" -3 | grep CLOSE
$B $T/anim_gif.py -- "$O/lobber.blend" "$O/lobber" | grep GIF
$B $T/export_glb.py -- "$O/lobber.blend" "$O/lobber.glb" | grep GLB
