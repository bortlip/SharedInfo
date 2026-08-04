import { SPACING } from "./constants.js";
import { makeQueue } from "./methods.js";

const RESTROOM_TRAVEL_STATES=new Set(["walking-to-restroom","restroom","walking-from-restroom"]);

export class BoardingSim{
  constructor(manifest,method,cfg){
    this.method=method;
    this.cfg=cfg;
    this.queue=makeQueue(manifest,method,cfg.priorityPolicy,cfg.sequenceCompliance);
    this.assignedSeats=new Set(this.queue.map(p=>p.seatKey));
    this.active=[];
    this.pending=0;
    this.time=0;
    this.completed=0;
    this.occupancy=new Map();
    this.binLoad=new Map();
    this.stowedBags=[];
    this.seatConflicts=0;
    this.conflictSeconds=0;
    this.blockedSeconds=0;
    this.movementDelay=0;
    this.done=false;
    this.doorDelayStarted=false;
  }
  setCharacterMoment(p,status,eventState,bubble=null,duration=0){
    if(!p.characterId) return;
    p.characterStatus=status;
    p.eventState=eventState;
    if(bubble){
      p.bubbleText=bubble;
      p.bubbleUntil=this.time+duration;
    }
  }
  nearestToDoor(){
    let nearest=Infinity;
    for(const p of this.active) if(p.state!=="seated") nearest=Math.min(nearest,p.pos);
    return nearest;
  }
  computeStow(p){
    const key=`${p.row}${p.side}`;
    const load=this.binLoad.get(key)||0;
    if(p.hasBag) this.binLoad.set(key,load+1);
    const congestion=p.hasBag?Math.max(0,load-2)*1.45:0;
    return p.bagBase+congestion;
  }
  computeSeat(p){
    let blockers=0;
    let penalty=0;
    for(const [seatKey,occ] of this.occupancy){
      if(occ.row===p.row && occ.side===p.side && occ.depth<p.depth){
        blockers++;
        penalty += occ.unitId===p.unitId ? 2.2 : 5.4;
      }
    }
    if(blockers){
      this.seatConflicts+=blockers;
      this.conflictSeconds+=penalty;
    }
    return p.seatBase+penalty;
  }
  beginStowing(p){
    p.state="stowing";
    p.stowDuration=this.computeStow(p);
    p.remaining=p.stowDuration;
    if(p.characterId){
      if(!p.heavyBagDelayCounted){
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+(p.heavyBagExtra||0);
        p.heavyBagDelayCounted=true;
      }
      this.setCharacterMoment(
        p,
        "wrestling with the carry-on",
        "struggling with a very heavy bag",
        "This bag was lighter at home.",
        Math.min(7,p.stowDuration)
      );
    }
  }
  beginSeating(p){
    p.state="seating";
    p.seatingDuration=this.computeSeat(p);
    p.remaining=p.seatingDuration;
    this.setCharacterMoment(p,"almost there",`entering row ${p.row} toward ${p.seatKey}`);
  }
  release(dt){
    if(this.pending>=this.queue.length) return;
    if(this.nearestToDoor()<SPACING) return;
    const p=this.queue[this.pending];
    if(!p.delayRemainingInitialized){
      p.delayRemaining=p.entryDelay;
      p.delayRemainingInitialized=true;
    }
    if(p.delayRemaining>0){
      p.delayRemaining=Math.max(0,p.delayRemaining-dt);
      return;
    }
    p.state="walking";
    p.pos=0;
    p.remaining=0;
    p.eventDelaySeconds=p.eventDelaySeconds||0;
    this.active.push(p);
    this.pending++;
    this.setCharacterMoment(p,"finally aboard","heading down the aisle","Made it!",3.5);
  }
  beginRestroomTrip(p){
    p.state="walking-to-restroom";
    p.restroomTripElapsed=0;
    p.restroomBaselineRemaining=Math.max(0,(p.row-p.pos)/Math.max(.001,p.walkSpeed));
    p.restroomPassedIds={outbound:new Set(),return:new Set()};
    p.squeezePasses=0;
    this.setCharacterMoment(
      p,
      "doubling back",
      "walking toward the front lavatory",
      "Nope. Restroom first.",
      4.2
    );
  }
  registerSqueeze(p,other,phase){
    const passed=p.restroomPassedIds?.[phase];
    if(!passed || passed.has(other.id)) return;
    passed.add(other.id);
    p.squeezePasses=(p.squeezePasses||0)+1;
    p.squeezeDelayRemaining=Math.max(p.squeezeDelayRemaining||0,p.squeezeSelfDuration||.9);
    const otherDelay=p.squeezeOtherDuration||1.8;
    if(other.state==="walking"){
      other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,otherDelay);
    }else if(other.state==="stowing" || other.state==="seating"){
      other.remaining=(other.remaining||0)+otherDelay;
      other.disruptionDelaySeconds=(other.disruptionDelaySeconds||0)+otherDelay;
    }
    other.disruptedByCharacter=p.displayName||"a disruptive passenger";
    other.disruptionCount=(other.disruptionCount||0)+1;
    if(p.squeezePasses===1 || p.squeezePasses%4===0){
      this.setCharacterMoment(
        p,
        "squeezing past passengers",
        `${phase==="outbound"?"backtracking":"returning"} through the aisle · ${p.squeezePasses} crossings`,
        p.squeezePasses===1?"Excuse me—sorry—coming through.":"Sorry. Again.",
        2.8
      );
    }
  }
  stepRestroomTravel(p,dt){
    p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
    const outbound=p.state==="walking-to-restroom";
    const target=outbound?(p.restroomTarget??.15):p.row;
    const direction=outbound?-1:1;
    const phase=outbound?"outbound":"return";
    const slowed=(p.squeezeDelayRemaining||0)>0;
    if(slowed) p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
    const speed=(p.restroomWalkSpeed||.68)*(slowed ? .42 : 1);
    const oldPos=p.pos;
    const distance=Math.abs(target-oldPos);
    const move=Math.min(distance,speed*dt);
    p.pos=oldPos+direction*move;

    const low=Math.min(oldPos,p.pos)-.015;
    const high=Math.max(oldPos,p.pos)+.015;
    for(const other of this.active){
      if(other===p || other.state==="seated" || RESTROOM_TRAVEL_STATES.has(other.state)) continue;
      if(other.pos+1e-7>=low && other.pos-1e-7<=high) this.registerSqueeze(p,other,phase);
    }

    if(Math.abs(p.pos-target)>.001) return;
    p.pos=target;
    if(outbound){
      p.state="restroom";
      p.remaining=p.restroomDuration;
      this.setCharacterMoment(p,"in the lavatory","using the front lavatory","Finally.",2.4);
      return;
    }

    p.restroomTripComplete=true;
    p.restroomExtraDelay=Math.max(0,(p.restroomTripElapsed||0)-(p.restroomBaselineRemaining||0));
    p.eventDelaySeconds=(p.heavyBagDelayCounted?p.heavyBagExtra||0:0)+p.restroomExtraDelay;
    this.setCharacterMoment(
      p,
      "back at her row",
      `restroom trip complete · squeezed past ${p.squeezePasses||0} passengers`,
      "Much better.",
      3
    );
    this.beginStowing(p);
  }
  step(dt){
    if(this.done) return;
    this.time+=dt;

    let anyBlocking=false;
    for(const p of this.active){
      if(p.state==="restroom"){
        anyBlocking=true;
        p.remaining-=dt;
        p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
        if(p.remaining<=0){
          p.state="walking-from-restroom";
          p.remaining=0;
          this.setCharacterMoment(p,"heading back","returning from the front lavatory","Coming back through.",3.2);
        }
      }else if(p.state==="stowing"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){
            p.bagStowed=true;
            this.stowedBags.push({
              passengerId:p.id,
              row:p.row,
              side:p.side,
              groupType:p.groupType,
              color:p.partyColor||p.characterColor||null
            });
          }
          this.beginSeating(p);
        }
      }else if(p.state==="seating"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          p.state="seated";
          this.occupancy.set(p.seatKey,p);
          this.completed++;
          this.setCharacterMoment(p,"settled, for now","seated");
        }
      }
    }

    for(const p of this.active){
      if(p.state==="walking-to-restroom" || p.state==="walking-from-restroom"){
        anyBlocking=true;
        this.stepRestroomTravel(p,dt);
      }
    }

    if(anyBlocking) this.blockedSeconds+=dt;
    if(this.active.some(p=>p.state==="seated")){
      this.active=this.active.filter(p=>p.state!=="seated");
    }

    let leadPos=Infinity;
    for(const p of this.active){
      if(p.state==="walking"){
        let allowed=p.row;
        if(leadPos<Infinity) allowed=Math.min(allowed,leadPos-SPACING);
        const available=Math.max(0,allowed-p.pos);
        const squeezed=(p.squeezeDelayRemaining||0)>0;
        if(squeezed){
          p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
          p.disruptionDelaySeconds=(p.disruptionDelaySeconds||0)+dt;
        }
        const freeMove=p.walkSpeed*(squeezed ? .28 : 1)*dt;
        const move=Math.min(available,freeMove);
        p.pos+=move;
        if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;

        if(
          p.characterId==="barbara"
          && !p.restroomTripStarted
          && p.row>p.restroomTurnRow+.001
          && p.pos+1e-7>=p.restroomTurnRow
        ){
          p.pos=p.restroomTurnRow;
          p.restroomTripStarted=true;
          this.beginRestroomTrip(p);
        }else if(p.row-p.pos<=.001){
          p.pos=p.row;
          this.beginStowing(p);
        }
      }
      if(!RESTROOM_TRAVEL_STATES.has(p.state)) leadPos=p.pos;
    }

    this.release(dt);
    if(this.completed===this.queue.length){
      this.done=true;
    }
    if(this.time>7200){
      this.done=true;
      console.warn("Simulation safety stop",this.method);
    }
  }
  runToEnd(dt=.2){
    while(!this.done) this.step(dt);
    return this.time;
  }
}
