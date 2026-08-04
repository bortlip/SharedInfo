#!/usr/bin/env python3
from pathlib import Path

path=Path('.github/scripts/apply_barbara_phase_one.py')
text=path.read_text(encoding='utf-8')
text=text.replace('from pathlib import Path\nimport textwrap\n','from pathlib import Path\nimport textwrap\nimport re\n',1)
old='''def replace_once(path,old,new):
    text=read(path)
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path,text.replace(old,new,1))
'''
new='''def replace_once(path,old,new):
    text=read(path)
    count=text.count(old)
    if count==1:
        write(path,text.replace(old,new,1))
        return
    if count>1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    lines=old.splitlines()
    pattern='\\n'.join(
        r'[ \\t]*' if not line.strip() else r'[ \\t]*'+re.escape(line.strip())
        for line in lines
    )
    matches=list(re.finditer(pattern,text,re.MULTILINE))
    if len(matches)!=1:
        raise RuntimeError(f'{path}: indentation-tolerant match found {len(matches)} occurrences: {old[:80]!r}')
    match=matches[0]
    write(path,text[:match.start()]+new+text[match.end():])
'''
if old not in text:
    raise RuntimeError('replace_once implementation changed unexpectedly')
path.write_text(text.replace(old,new,1),encoding='utf-8')
