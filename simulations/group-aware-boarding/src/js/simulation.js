import { SPACING } from "./constants.js";
import { makeQueue } from "./methods.js";

const RESTROOM_TRAVEL_STATES=new Set(["walking-to-restroom","restroom","walking-from-restroom"]);
const CREW_BLOCKING_STATES=new Set(["failed-lift","awaiting-crew","crew-assist"]);

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
    const definition=manifest.crewDefinition||{
      id:"crew-1",displayName:"Maya",role:"cabin crew",homePos:.12,speed:1.15,
      squeezeSelfDuration:.7,squeezeOtherDuration:.9,color:"#56e0b5"
    };
    this.crew={
      ...definition,
      pos:definition.homePos,
      state:"idle",
      status:"watching the cabin",
      eventState:"available near the front door",
      targetPassengerId:null,
      remaining:0,
      bubbleText:null,
      bubbleUntil:0,
      passedIds:new Set(),
      assistsCompleted:0,
      travelDistance:0,
      squeezePasses:0,
      squeezeDelayRemaining:0
    };
    this.crewRequests=[];
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
  setCrewMoment(status,eventState,bubble=null,duration=0){
    this.crew.status=status;
    this.crew.eventState=eventState;
    if(bubble){
      this.crew.bubbleText=bubble;
      this.crew.bubbleUntil=this.time+duration;
    }
  }
  passengerById(id){
    return this.queue.find(p=>p.id===id)||null;
  }
  nearestToDoor(){
    let nearest=Infinity;
    for(const p of this.active) if(p.state!=="seated") nearest=Math.min(nearest,p.pos);
    if(this.crew.state!=="idle") nearest=Math.min(nearest,this.crew.pos);
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
    for(const [,occ] of this.occupancy){
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
  countHeavyBagDelay(p){
    if(p.heavyBagDelayCounted) return;
    p.eventDelaySeconds=(p.eventDelaySeconds||0)+(p.heavyBagExtra||0);
    p.heavyBagDelayCounted=true;
  }
  beginStowing(p){
    if(p.requiresCrewHelp && !p.crewAssistanceComplete){
      this.countHeavyBagDelay(p);
      if(!p.crewAttemptStarted){
        p.crewAttemptStarted=true;
        p.crewAttemptStartTime=this.time;
        p.state="failed-lift";
        p.remaining=p.crewFailDuration||2;
        this.setCharacterMoment(
          p,
          "trying to lift the carry-on",
          "the first overhead-bin attempt is not going well",
          "I can get this... I think.",
          Math.min(3,p.remaining)
        );
      }
      return;
    }
    p.state="stowing";
    p.stowDuration=this.computeStow(p);
    p.remaining=p.stowDuration;
    if(p.characterId){
      this.countHeavyBagDelay(p);
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
    this.setCharacterMoment(p,"finally aboard","heading down the aisle",p.characterId==="barbara"?"Made it!":null,3.5);
  }
  beginRestroomTrip(p){
    p.state="walking-to-restroom";
    p.restroomTripElapsed=0;
    p.restroomBaselineRemaining=Math.max(0,(p.row-p.pos)/Math.max(.001,p.walkSpeed));
    p.restroomPassedIds={outbound:new Set(),return:new Set()};
    p.squeezePasses=0;
    this.setCharacterMoment(p,"doubling back","walking toward the front lavatory","Nope. Restroom first.",4.2);
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
    }else if(other.state==="stowing" || other.state==="seating" || CREW_BLOCKING_STATES.has(other.state)){
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
    p.eventDelaySeconds=(p.eventDelaySeconds||0)+p.restroomExtraDelay;
    this.setCharacterMoment(
      p,
      "back at her row",
      `restroom trip complete · squeezed past ${p.squeezePasses||0} passengers`,
      "Much better.",
      3
    );
    this.beginStowing(p);
  }
  maybeBeginIncident(p){
    if(!p.incidentStops || p.state!=="walking") return false;
    const index=p.incidentStopIndex||0;
    const stop=p.incidentStops[index];
    if(!stop || p.pos+1e-7<stop.row) return false;
    p.pos=stop.row;
    p.state="incident-pause";
    p.remaining=stop.duration;
    p.incidentStopIndex=index;
    this.setCharacterMoment(
      p,
      p.incidentType==="tipsy"?"getting her bearings":"finishing a story",
      `${p.incidentType} aisle pause ${index+1} of ${p.incidentStops.length}`,
      stop.line,
      stop.duration
    );
    return true;
  }
  maybeShowAmbientLine(p){
    if(!p.ambientLine || p.ambientSpoken || p.state!=="walking") return;
    if(p.pos+1e-7<p.ambientTriggerRow) return;
    p.ambientSpoken=true;
    p.bubbleText=p.ambientLine;
    p.bubbleUntil=this.time+(p.ambientBubbleDuration||2.5);
  }
  queueCrewHelp(p){
    if(p.crewRequestQueued || p.crewAssistanceComplete) return;
    p.crewRequestQueued=true;
    p.crewRequestTime=this.time;
    p.state="awaiting-crew";
    p.remaining=0;
    this.crewRequests.push(p.id);
    this.setCharacterMoment(
      p,
      "waiting for cabin crew",
      "carry-on lift failed; help requested",
      p.crewRequestLine||"Could I get some help with this?",
      4.2
    );
  }
  beginNextCrewRequest(){
    while(this.crewRequests.length){
      const passenger=this.passengerById(this.crewRequests.shift());
      if(!passenger || passenger.crewAssistanceComplete || passenger.state!=="awaiting-crew") continue;
      this.crew.state="walking-to-passenger";
      this.crew.targetPassengerId=passenger.id;
      this.crew.passedIds=new Set();
      this.setCrewMoment("responding to a passenger",`walking to row ${passenger.row}`,"On my way.",2.4);
      passenger.crewResponseStarted=this.time;
      return;
    }
    this.crew.state="idle";
    this.crew.targetPassengerId=null;
    this.crew.pos=this.crew.homePos;
    this.setCrewMoment("watching the cabin","available near the front door");
  }
  registerCrewSqueeze(other){
    if(!other || other.state==="seated" || this.crew.passedIds.has(other.id)) return;
    this.crew.passedIds.add(other.id);
    this.crew.squeezePasses++;
    this.crew.squeezeDelayRemaining=Math.max(this.crew.squeezeDelayRemaining||0,this.crew.squeezeSelfDuration||.7);
    const delay=this.crew.squeezeOtherDuration||.9;
    if(other.state==="walking"){
      other.crewYieldRemaining=Math.max(other.crewYieldRemaining||0,delay);
    }else if(other.state==="stowing" || other.state==="seating" || CREW_BLOCKING_STATES.has(other.state)){
      other.remaining=(other.remaining||0)+delay;
      other.crewYieldSeconds=(other.crewYieldSeconds||0)+delay;
    }
    other.crewYieldedTo=this.crew.displayName;
    other.crewYieldCount=(other.crewYieldCount||0)+1;
  }
  startCrewAssistance(passenger){
    this.crew.state="assisting";
    this.crew.pos=passenger.row;
    this.crew.remaining=passenger.crewAssistDuration||6;
    passenger.state="crew-assist";
    passenger.remaining=this.crew.remaining;
    passenger.crewAssistTotal=this.crew.remaining;
    passenger.crewAssistanceStarted=this.time;
    this.setCrewMoment("helping with a carry-on",`lifting a bag at row ${passenger.row}`,"I've got it.",3);
    this.setCharacterMoment(
      passenger,
      "getting cabin-crew help",
      `${this.crew.displayName} is lifting the carry-on`,
      passenger.crewAssistLine||"Thank you!",
      3.2
    );
  }
  finishCrewAssistance(passenger){
    passenger.crewAssistanceComplete=true;
    passenger.crewAssistanceFinished=this.time;
    passenger.crewEventDelay=Math.max(0,this.time-(passenger.crewAttemptStartTime||this.time));
    if(passenger.hasBag && !passenger.bagStowed){
      passenger.bagStowed=true;
      const key=`${passenger.row}${passenger.side}`;
      const load=this.binLoad.get(key)||0;
      this.binLoad.set(key,load+1);
      this.stowedBags.push({
        passengerId:passenger.id,
        row:passenger.row,
        side:passenger.side,
        groupType:passenger.groupType,
        color:passenger.partyColor||passenger.characterColor||null
      });
    }
    this.crew.assistsCompleted++;
    this.setCharacterMoment(
      passenger,
      "bag safely overhead",
      `assisted by ${this.crew.displayName} after ${(passenger.crewEventDelay||0).toFixed(1)}s`,
      "Thank you!",
      2.8
    );
    this.beginSeating(passenger);
    this.crew.state="returning-front";
    this.crew.targetPassengerId=null;
    this.crew.passedIds=new Set();
    this.setCrewMoment("returning to the front","walking back toward the door","All set.",2.4);
  }
  stepCrewTravel(dt,target,arrive){
    const oldPos=this.crew.pos;
    const direction=target>=oldPos?1:-1;
    const slowed=(this.crew.squeezeDelayRemaining||0)>0;
    if(slowed) this.crew.squeezeDelayRemaining=Math.max(0,this.crew.squeezeDelayRemaining-dt);
    const speed=this.crew.speed*(slowed ? .52 : 1);
    const move=Math.min(Math.abs(target-oldPos),speed*dt);
    this.crew.pos=oldPos+direction*move;
    this.crew.travelDistance+=move;

    const low=Math.min(oldPos,this.crew.pos)-.015;
    const high=Math.max(oldPos,this.crew.pos)+.015;
    for(const other of this.active){
      if(other.id===this.crew.targetPassengerId || other.state==="seated" || RESTROOM_TRAVEL_STATES.has(other.state)) continue;
      if(other.pos+1e-7>=low && other.pos-1e-7<=high) this.registerCrewSqueeze(other);
    }
    if(Math.abs(this.crew.pos-target)<=.001){
      this.crew.pos=target;
      arrive();
    }
  }
  stepCrew(dt){
    if(this.crew.state==="idle"){
      if(this.crewRequests.length) this.beginNextCrewRequest();
      return;
    }
    if(this.crew.state==="walking-to-passenger"){
      const passenger=this.passengerById(this.crew.targetPassengerId);
      if(!passenger || passenger.state!=="awaiting-crew"){
        this.crew.state="returning-front";
        this.crew.targetPassengerId=null;
        this.crew.passedIds=new Set();
        return;
      }
      this.stepCrewTravel(dt,passenger.row,()=>this.startCrewAssistance(passenger));
      return;
    }
    if(this.crew.state==="assisting"){
      const passenger=this.passengerById(this.crew.targetPassengerId);
      if(!passenger){
        this.crew.state="returning-front";
        this.crew.targetPassengerId=null;
        return;
      }
      this.crew.remaining=Math.max(0,this.crew.remaining-dt);
      passenger.remaining=this.crew.remaining;
      passenger.eventDelaySeconds=(passenger.eventDelaySeconds||0)+dt;
      if(this.crew.remaining<=0) this.finishCrewAssistance(passenger);
      return;
    }
    if(this.crew.state==="returning-front"){
      this.stepCrewTravel(dt,this.crew.homePos,()=>this.beginNextCrewRequest());
    }
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
      }else if(p.state==="incident-pause"){
        anyBlocking=true;
        p.remaining-=dt;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
        if(p.remaining<=0){
          p.incidentStopIndex=(p.incidentStopIndex||0)+1;
          p.state="walking";
          p.remaining=0;
          this.setCharacterMoment(p,"moving again",`${p.incidentType} pause complete`);
        }
      }else if(p.state==="failed-lift"){
        anyBlocking=true;
        p.remaining-=dt;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
        if(p.remaining<=0) this.queueCrewHelp(p);
      }else if(p.state==="awaiting-crew"){
        anyBlocking=true;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
      }else if(p.state==="crew-assist"){
        anyBlocking=true;
      }else if(p.state==="stowing"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){
            p.bagStowed=true;
            this.stowedBags.push({
              passengerId:p.id,row:p.row,side:p.side,groupType:p.groupType,
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

    this.stepCrew(dt);
    if(this.crew.state==="assisting") anyBlocking=true;

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
        const yielding=(p.crewYieldRemaining||0)>0;
        if(squeezed){
          p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
          p.disruptionDelaySeconds=(p.disruptionDelaySeconds||0)+dt;
        }
        if(yielding){
          p.crewYieldRemaining=Math.max(0,p.crewYieldRemaining-dt);
          p.crewYieldSeconds=(p.crewYieldSeconds||0)+dt;
        }
        const factor=squeezed ? .28 : yielding ? .38 : 1;
        const freeMove=p.walkSpeed*factor*dt;
        const move=Math.min(available,freeMove);
        p.pos+=move;
        if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;
        this.maybeShowAmbientLine(p);

        if(
          p.characterId==="barbara"
          && !p.restroomTripStarted
          && p.row>p.restroomTurnRow+.001
          && p.pos+1e-7>=p.restroomTurnRow
        ){
          p.pos=p.restroomTurnRow;
          p.restroomTripStarted=true;
          this.beginRestroomTrip(p);
        }else if(this.maybeBeginIncident(p)){
          // Incident state set above.
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
