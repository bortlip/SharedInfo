import { METHODS } from "./constants.js";
import { clamp } from "./random.js";

export function simultaneousBlockers(sim){
  return sim.active.filter(passenger=>passenger.state==="stowing" || passenger.state==="seating").length;
}

export function aisleProgress(sim){
  return sim.active.reduce((sum,passenger)=>{
    if(passenger.state==="walking"){
      return sum+clamp(passenger.pos/Math.max(1,passenger.row),0,1);
    }
    if(passenger.state==="stowing") return sum+.8;
    if(passenger.state==="seating") return sum+.92;
    return sum;
  },0);
}

export function rankRace(methods,sims){
  return methods.map(method=>{
    const sim=sims[method];
    const total=sim?.queue.length||0;
    return {
      method,
      done:!!sim?.done,
      time:sim?.time||0,
      completed:sim?.completed||0,
      entered:sim?.pending||0,
      aisleProgress:sim?aisleProgress(sim):0,
      total
    };
  }).sort((a,b)=>{
    if(a.done!==b.done) return a.done?-1:1;
    if(a.done && b.done){
      return a.time-b.time || METHODS.indexOf(a.method)-METHODS.indexOf(b.method);
    }
    return b.completed-a.completed
      || b.entered-a.entered
      || b.aisleProgress-a.aisleProgress
      || METHODS.indexOf(a.method)-METHODS.indexOf(b.method);
  }).map((row,index)=>({
    ...row,
    rank:index+1,
    percent:row.total?100*row.completed/row.total:0
  }));
}
