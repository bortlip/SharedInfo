export function formatTime(seconds){
  if(!Number.isFinite(seconds)) return "—";
  const s=Math.round(seconds);
  const m=Math.floor(s/60);
  return `${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

export function percentile(sorted,p){
  if(!sorted.length) return NaN;
  const pos=(sorted.length-1)*p;
  const lo=Math.floor(pos),hi=Math.ceil(pos);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}
export function stats(values){
  const s=values.slice().sort((a,b)=>a-b);
  return {
    mean:s.reduce((a,b)=>a+b,0)/s.length,
    median:percentile(s,.5),
    p10:percentile(s,.1),
    p90:percentile(s,.9)
  };
}

export function benchmarkSignature(cfg,trials,methods=[]){
  return JSON.stringify({
    loadFactor:cfg.loadFactor,
    familyShare:cfg.familyShare,
    partyWeights:cfg.partyWeights,
    assistedParties:cfg.assistedParties,
    bagRate:cfg.bagRate,
    sequenceCompliance:cfg.sequenceCompliance,
    priorityPolicy:cfg.priorityPolicy,
    seed:cfg.seed,
    trials,
    methods:[...methods]
  });
}

export function sameBenchmarkResults(left,right,methods){
  if(!left || !right) return false;
  return methods.every(method=>{
    const a=left[method];
    const b=right[method];
    return !!a && !!b
      && a.wins===b.wins
      && a.stats.mean===b.stats.mean
      && a.stats.median===b.stats.median
      && a.stats.p10===b.stats.p10
      && a.stats.p90===b.stats.p90;
  });
}
