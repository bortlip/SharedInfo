export const ROWS = 31;
export const COLS = ["A","B","C","D","E","F"];
export const TOTAL = ROWS * COLS.length;
export const METHODS = ["random","back","front","zones","wilma","steffen"];
export const META = {
  random:{label:"Random", shortLabel:"Random", chartColor:"#63d7ff", canvas:"randomCanvas"},
  back:{label:"Strict back to front", shortLabel:"Back → Front", chartColor:"#70e1a1", canvas:"backCanvas"},
  front:{label:"Strict front to back", shortLabel:"Front → Back", chartColor:"#ff9aaa", canvas:"frontCanvas"},
  zones:{label:"Airline zones", shortLabel:"Zones", chartColor:"#ffc96b", canvas:"zonesCanvas"},
  wilma:{label:"WilMA, group-safe", shortLabel:"WilMA", chartColor:"#d994ff", canvas:"wilmaCanvas"},
  steffen:{label:"Steffen, group-safe", shortLabel:"Steffen", chartColor:"#9fa8ff", canvas:"steffenCanvas"}
};
export const SPACING = 0.72;
export const FIXED_DT = 0.10;
export const palette = {
  single:"#68d7ff",
  family:"#f5b95f",
  assisted:"#d994ff",
  empty:"#1c3554",
  unassigned:"#101d2d",
  seated:"#5b88c8",
  aisle:"#0c1a2a",
  grid:"#29405f",
  text:"#9eb0c9",
  child:"#fff4d5"
};
export const FAMILY_HUES = [35,22,48,12,55,29,42,5,60,18,33,50];

export function familyColor(index,seated=false){
  const hue=FAMILY_HUES[index%FAMILY_HUES.length];
  const cycle=Math.floor(index/FAMILY_HUES.length)%2;
  const lightness=seated ? 32+cycle*7 : 61-cycle*9;
  return `hsl(${hue} 82% ${lightness}%)`;
}
