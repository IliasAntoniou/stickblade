"""Documentation checks. Run from the game folder: python tests/check_docs.py [git ref]

1. Every file under js/ starts with a header comment naming itself.
2. Every file path and function() that docs/CODE_MAP.md mentions exists.
   Every skill and sword style in the game is listed in docs/ABILITIES.md.
3. With a git ref (for example main): the code under js/ is identical to that ref once comments and blank
   lines are removed. Use this to prove a comments-only change touched no code.
"""
import glob
import os
import re
import subprocess
import sys

problems = []
files = sorted(p.replace(os.sep, '/') for p in glob.glob('js/**/*.js', recursive=True))
source = {p: open(p, encoding='utf-8').read() for p in files}

for p, text in source.items():
    if not text.startswith('// ' + p[len('js/'):] + ':'):
        problems.append(p + ': no header comment on the first line')

doc = open('docs/CODE_MAP.md', encoding='utf-8').read()
all_code = '\n'.join(source.values())
for token in sorted(set(re.findall(r'`([^`\n]+)`', doc))):
    if re.fullmatch(r'[\w./-]+\.(js|html|py|sh|bat|md)', token):
        hits = [token] + glob.glob('js/' + token) + glob.glob('js/classes/' + token)
        if not any(os.path.exists(h) for h in hits):
            problems.append('CODE_MAP.md mentions a missing file: ' + token)
    elif re.fullmatch(r'[\w$]+\(\)', token):
        name = re.escape(token[:-2])
        if not re.search(r'(function\s+%s\s*\(|^\s*%s\s*\([^)]*\)\s*\{|(const|let)\s+%s\s*=)' % (name, name, name), all_code, re.M):
            problems.append('CODE_MAP.md mentions a missing function: ' + token)


# every skill (n: 'Name' in a class file) and every sword style (name: 'Name' in styles.js) must be in ABILITIES.md
abilities = open('docs/ABILITIES.md', encoding='utf-8').read()
for p, text in source.items():
    if p.startswith('js/classes/'):
        for name in re.findall(r"\bn: '([^']+)'", text):
            if name not in abilities:
                problems.append('ABILITIES.md is missing the skill: %s (%s)' % (name, p))
for name in re.findall(r"\bname: '([^']+)'", source['js/styles.js']):
    if name not in abilities:
        problems.append('ABILITIES.md is missing the sword style: ' + name)


def code_only(text):
    return [ln.rstrip() for ln in text.replace('\r\n', '\n').split('\n') if ln.strip() and not ln.strip().startswith('//')]


if len(sys.argv) > 1:
    ref = sys.argv[1]
    for p, text in source.items():
        old = subprocess.run(['git', 'show', ref + ':' + p], capture_output=True)
        if old.returncode != 0:
            problems.append(p + ': not in ' + ref)
        elif code_only(old.stdout.decode('utf-8')) != code_only(text):
            problems.append(p + ': code differs from ' + ref)

print('\n'.join(problems) if problems else 'DOCS OK (%d files%s)' % (len(files), ', code identical to ' + sys.argv[1] if len(sys.argv) > 1 else ''))
sys.exit(1 if problems else 0)
