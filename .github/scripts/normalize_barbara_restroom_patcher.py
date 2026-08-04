#!/usr/bin/env python3
from pathlib import Path

path=Path('.github/scripts/apply_barbara_restroom_trip.py')
text=path.read_text(encoding='utf-8')
text=text.replace('slowed?.42:1','slowed ? .42 : 1')
text=text.replace('squeezed?.28:1','squeezed ? .28 : 1')
text=text.replace(
'''def replace_once(path,old,new):
    text=read(path)
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:100]!r}')
    write(path,text.replace(old,new,1))
''',
'''def replace_once(path,old,new):
    text=read(path)
    for indent in range(0,9):
        prefix=' '*indent
        candidate='\\n'.join(prefix+line if line else line for line in old.split('\\n'))
        count=text.count(candidate)
        if count==1:
            replacement='\\n'.join(prefix+line if line else line for line in new.split('\\n'))
            write(path,text.replace(candidate,replacement,1))
            return
        if count>1:
            raise RuntimeError(f'{path}: expected one occurrence, found {count}: {candidate[:100]!r}')
    raise RuntimeError(f'{path}: expected one occurrence with indentation 0-8: {old[:100]!r}')
'''
)
text=text.replace(
'''    other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,p.squeezeOtherDuration||1.8);\n    other.disruptedByCharacter=p.displayName||"a disruptive passenger";\n    other.disruptionCount=(other.disruptionCount||0)+1;''',
'''    const otherDelay=p.squeezeOtherDuration||1.8;\n    if(other.state==="walking"){\n      other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,otherDelay);\n    }else if(other.state==="stowing" || other.state==="seating"){\n      other.remaining=(other.remaining||0)+otherDelay;\n      other.disruptionDelaySeconds=(other.disruptionDelaySeconds||0)+otherDelay;\n    }\n    other.disruptedByCharacter=p.displayName||"a disruptive passenger";\n    other.disruptionCount=(other.disruptionCount||0)+1;'''
)
path.write_text(text,encoding='utf-8')
