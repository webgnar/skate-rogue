# Finds the beats of each soundtrack mp3 in public/music and writes them next to it as <name>.beats.json (seconds
# into the track), for the gnar glow to swap its shards on the beat (src/audio/sound.ts beatIndex).
#
#   pip install librosa && python3 scripts/music/beats.py
#
# Run it again after adding a track. A track without a beats file still works: the glow swaps on a steady pulse.
import glob
import json
import os
import subprocess

import librosa
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MUSIC = os.path.join(HERE, '..', '..', 'public', 'music')
RATE = 22050

for mp3 in sorted(glob.glob(os.path.join(MUSIC, '*.mp3'))):
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    y = np.frombuffer(pcm, dtype=np.float32)
    tempo, beats = librosa.beat.beat_track(y=y, sr=RATE, units='time')
    out = mp3[:-4] + '.beats.json'
    with open(out, 'w') as f:
        json.dump({'bpm': round(float(np.atleast_1d(tempo)[0]), 1), 'beats': [round(float(b), 3) for b in beats]}, f)
    print(os.path.basename(out), len(beats), 'beats at', round(float(np.atleast_1d(tempo)[0]), 1), 'bpm')
