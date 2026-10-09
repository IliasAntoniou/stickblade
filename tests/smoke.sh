#!/bin/bash
# Runs tests/smoke.js in headless Chrome. Needs the local server: python serve.py
OUT="${TEMP:-/tmp}/stickblade-smoke"
rm -rf "$OUT/profile"    # a fresh browser profile every run, so no stale cached files
mkdir -p "$OUT"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --user-data-dir="$OUT/profile" \
  --use-angle=swiftshader --enable-unsafe-swiftshader --enable-logging=stderr --v=0 --virtual-time-budget=8000 \
  --dump-dom "http://127.0.0.1:8000/index.html?debug=smoke" > "$OUT/dom.html" 2> "$OUT/chrome.log"
grep "CONSOLE" "$OUT/chrome.log" | grep -v "GL Driver Message" | cut -c1-500
python -c "
import re, sys, html
s = open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'<pre id=\"smoke\"[^>]*>(.*?)</pre>', s, re.S)
print(html.unescape(m.group(1)) if m else 'NO SMOKE RESULT (the page failed to load; see console lines above)')
sys.exit(0 if m and m.group(1).startswith('SMOKE PASS') else 1)
" "$OUT/dom.html"
