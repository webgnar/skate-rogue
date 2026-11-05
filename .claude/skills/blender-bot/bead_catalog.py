"""List every pattern page of Crafting Conundrums: PDF page, title, N-around, tags.

usage: python3 bead_catalog.py BOOK.pdf [search words...]
  With search words, prints only pages whose title or tags match one of them (any case).
The bead pass picks from this; bead_read_page.py then reads the chosen page.
"""
import re, subprocess, sys

pdf, words = sys.argv[1], [w.lower() for w in sys.argv[2:]]
n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True,
                                                    text=True).stdout).group(1))
for page in range(1, n + 1):
    t = subprocess.run(['pdftotext', '-layout', '-f', str(page), '-l', str(page), pdf, '-'],
                       capture_output=True, text=True).stdout
    if 'Notes:' not in t or 'Tags:' not in t:
        continue
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    title = lines[0]
    m = re.search(r'(\d+)-around', t)
    tags = re.search(r'Tags:\s*(.+?)(?:\n\s*\n|$)', t, re.S)
    tags = ' '.join(tags.group(1).split()) if tags else ''
    numeric = bool(re.search(r'^\s*(\[?\d+\]?\s+){4,}', t, re.M))
    row = f'{page:4d}  {title:42.42s}  {m.group(1) if m else "?":>3}-around  ' \
          f'{"" if numeric else "(no numbers) "}{tags}'
    if not words or any(w in (title + ' ' + tags).lower() for w in words):
        print(row)
