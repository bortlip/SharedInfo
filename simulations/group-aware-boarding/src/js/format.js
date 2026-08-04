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
