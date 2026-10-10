#!/bin/bash
# Prints how much one frame costs to draw (draw calls and triangles) in the arena and in the training hall.
# Needs the local server: python serve.py. Use it before and after a graphics change to compare.
OUT="${TEMP:-/tmp}/stickblade-smoke"
for page in "debug" "debug=hall:blade-r3"; do
  rm -rf "$OUT/profile"; mkdir -p "$OUT"
  "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --user-data-dir="$OUT/profile" \
    --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=4000 --window-size=1280,800 \
    --dump-dom "http://127.0.0.1:8000/index.html?$page" 2>/dev/null \
    | python -c "
import re, sys
s = sys.stdin.read()
m = re.search(r'Draws <span>(\d+)</span>.*?Tris <span>(\d+)</span>', s)
print('%-22s draws %s  triangles %s' % (sys.argv[1], m.group(1), m.group(2)) if m else sys.argv[1] + ': no numbers found')
" "$page"
done
