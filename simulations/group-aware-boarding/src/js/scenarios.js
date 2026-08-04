export const SCENARIO_SCHEMA_VERSION = 1;

export const DEFAULT_SCENARIO_SETTINGS = {
  loadFactor:100,
  familyShare:30,
  partyWeights:[22,36,28,14],
  assistedParties:3,
  bagRate:70,
  sequenceCompliance:100,
  priorityPolicy:"assist",
  speed:16,
  seed:12345,
  trials:40
};

export const SCENARIO_PRESETS = [
  {
    id:"smooth-business",
    name:"Smooth Business Route",
    emoji:"💼",
    description:"Experienced travelers, lots of carry-ons, and almost everyone follows the plan.",
    settings:{loadFactor:85,familyShare:5,partyWeights:[60,25,10,5],assistedParties:1,bagRate:80,sequenceCompliance:95,priorityPolicy:"assist",speed:16,seed:81317,trials:40}
  },
  {
    id:"family-vacation",
    name:"Family Vacation",
    emoji:"🏖️",
    description:"A full flight with plenty of families, children, bags, and respectable queue manners.",
    settings:{...DEFAULT_SCENARIO_SETTINGS}
  },
  {
    id:"holiday-crush",
    name:"Holiday Crush",
    emoji:"🎄",
    description:"The cabin is full, the bags are plentiful, and every third person appears to know someone ahead of them.",
    settings:{loadFactor:100,familyShare:45,partyWeights:[10,28,38,24],assistedParties:4,bagRate:85,sequenceCompliance:75,priorityPolicy:"allgroups",speed:16,seed:122425,trials:40}
  },
  {
    id:"light-hop",
    name:"Lightly Loaded Hop",
    emoji:"🪽",
    description:"Half the seats are empty, the aisle can breathe, and nobody needs to make this complicated.",
    settings:{loadFactor:55,familyShare:15,partyWeights:[40,35,18,7],assistedParties:1,bagRate:45,sequenceCompliance:95,priorityPolicy:"none",speed:16,seed:5517,trials:40}
  },
  {
    id:"perfect-lab",
    name:"Perfect Laboratory Conditions",
    emoji:"🧪",
    description:"A controlled baseline: perfect compliance and no dramatic improvisation from the passengers.",
    settings:{loadFactor:100,familyShare:30,partyWeights:[22,36,28,14],assistedParties:3,bagRate:70,sequenceCompliance:100,priorityPolicy:"assist",speed:16,seed:24680,trials:40}
  },
  {
    id:"assisted-heavy",
    name:"Assisted-Heavy Flight",
    emoji:"🫶",
    description:"More travelers need extra time and companions, so priority policy matters much more.",
    settings:{loadFactor:90,familyShare:20,partyWeights:[38,34,20,8],assistedParties:10,bagRate:60,sequenceCompliance:95,priorityPolicy:"assist",speed:16,seed:77001,trials:40}
  },
  {
    id:"maximum-carryons",
    name:"Maximum Carry-ons",
    emoji:"🧳",
    description:"Everyone brought a bag. The overhead bins have entered the chat.",
    settings:{loadFactor:100,familyShare:25,partyWeights:[25,35,25,15],assistedParties:3,bagRate:100,sequenceCompliance:90,priorityPolicy:"assist",speed:16,seed:99991,trials:40}
  },
  {
    id:"low-compliance-chaos",
    name:"Low-Compliance Chaos",
    emoji:"🌪️",
    description:"The boarding order is more of a gentle suggestion than an enforceable policy.",
    settings:{loadFactor:100,familyShare:35,partyWeights:[15,30,35,20],assistedParties:5,bagRate:85,sequenceCompliance:35,priorityPolicy:"none",speed:16,seed:40404,trials:40}
  },
  {
    id:"barbara",
    name:"Barbara Mode",
    emoji:"🍷",
    description:"She is late. Her bag is heavy. She has made several decisions.",
    disabled:true
  }
];

const PRIORITY_POLICIES = new Set(["assist","allgroups","none"]);
const SPEEDS = new Set([4,16,64,256]);

function bounded(value,min,max,fallback,integer=false){
  const n=Number(value);
  if(!Number.isFinite(n)) return fallback;
  const result=Math.min(max,Math.max(min,n));
  return integer?Math.floor(result):result;
}

function nonNegativeFinite(value,fallback){
  const n=Number(value);
  return Number.isFinite(n) && n>=0 ? n : fallback;
}

export function normalizeScenarioSettings(input={}){
  const fallback=DEFAULT_SCENARIO_SETTINGS;
  const weights=Array.isArray(input.partyWeights) && input.partyWeights.length===4
    ? input.partyWeights.map((value,index)=>nonNegativeFinite(value,fallback.partyWeights[index]))
    : [...fallback.partyWeights];
  const priority=PRIORITY_POLICIES.has(input.priorityPolicy)?input.priorityPolicy:fallback.priorityPolicy;
  const speedValue=Number(input.speed);
  return {
    loadFactor:bounded(input.loadFactor,50,100,fallback.loadFactor),
    familyShare:bounded(input.familyShare,0,70,fallback.familyShare),
    partyWeights:weights,
    assistedParties:bounded(input.assistedParties,0,12,fallback.assistedParties,true),
    bagRate:bounded(input.bagRate,0,100,fallback.bagRate),
    sequenceCompliance:bounded(input.sequenceCompliance,0,100,fallback.sequenceCompliance),
    priorityPolicy:priority,
    speed:SPEEDS.has(speedValue)?speedValue:fallback.speed,
    seed:bounded(input.seed,1,2147483646,fallback.seed,true),
    trials:bounded(input.trials,5,200,fallback.trials,true)
  };
}

export function settingsEqual(left,right){
  const a=normalizeScenarioSettings(left);
  const b=normalizeScenarioSettings(right);
  return a.loadFactor===b.loadFactor
    && a.familyShare===b.familyShare
    && a.partyWeights.every((value,index)=>value===b.partyWeights[index])
    && a.assistedParties===b.assistedParties
    && a.bagRate===b.bagRate
    && a.sequenceCompliance===b.sequenceCompliance
    && a.priorityPolicy===b.priorityPolicy
    && a.speed===b.speed
    && a.seed===b.seed
    && a.trials===b.trials;
}

export function matchingPreset(settings){
  return SCENARIO_PRESETS.find(preset=>!preset.disabled && settingsEqual(settings,preset.settings))||null;
}

export function parseScenarioSearch(search){
  const params=new URLSearchParams(search||"");
  if(!params.has("v")) return null;
  if(Number(params.get("v"))!==SCENARIO_SCHEMA_VERSION) return null;

  const defaults=DEFAULT_SCENARIO_SETTINGS;
  const get=(key,fallback)=>params.has(key)?params.get(key):fallback;
  const weights=params.has("pw")?params.get("pw").split(","):defaults.partyWeights;
  const partyWeights=weights.length===4?weights:defaults.partyWeights;
  return normalizeScenarioSettings({
    loadFactor:get("lf",defaults.loadFactor),
    familyShare:get("fs",defaults.familyShare),
    partyWeights,
    assistedParties:get("ap",defaults.assistedParties),
    bagRate:get("br",defaults.bagRate),
    sequenceCompliance:get("sc",defaults.sequenceCompliance),
    priorityPolicy:get("pp",defaults.priorityPolicy),
    speed:get("sp",defaults.speed),
    seed:get("sd",defaults.seed),
    trials:get("tr",defaults.trials)
  });
}

export function serializeScenarioSettings(settings,presetId="custom"){
  const value=normalizeScenarioSettings(settings);
  const params=new URLSearchParams();
  params.set("v",String(SCENARIO_SCHEMA_VERSION));
  params.set("pr",presetId||"custom");
  params.set("lf",String(value.loadFactor));
  params.set("fs",String(value.familyShare));
  params.set("pw",value.partyWeights.join(","));
  params.set("ap",String(value.assistedParties));
  params.set("br",String(value.bagRate));
  params.set("sc",String(value.sequenceCompliance));
  params.set("pp",value.priorityPolicy);
  params.set("sp",String(value.speed));
  params.set("sd",String(value.seed));
  params.set("tr",String(value.trials));
  return params.toString();
}
