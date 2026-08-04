#!/usr/bin/env python3
from pathlib import Path

path=Path('.github/scripts/apply_barbara_restroom_trip.py')
text=path.read_text(encoding='utf-8')
text=text.replace('slowed?.42:1','slowed ? .42 : 1')
text=text.replace('squeezed?.28:1','squeezed ? .28 : 1')
text=text.replace(
'''    other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,p.squeezeOtherDuration||1.8);\n    other.disruptedByCharacter=p.displayName||"a disruptive passenger";\n    other.disruptionCount=(other.disruptionCount||0)+1;''',
'''    const otherDelay=p.squeezeOtherDuration||1.8;\n    if(other.state==="walking"){\n      other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,otherDelay);\n    }else if(other.state==="stowing" || other.state==="seating"){\n      other.remaining=(other.remaining||0)+otherDelay;\n      other.disruptionDelaySeconds=(other.disruptionDelaySeconds||0)+otherDelay;\n    }\n    other.disruptedByCharacter=p.displayName||"a disruptive passenger";\n    other.disruptionCount=(other.disruptionCount||0)+1;'''
)
path.write_text(text,encoding='utf-8')
