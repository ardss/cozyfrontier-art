/* =====================================================================
 * 4. 世界状态
 * ===================================================================*/
import * as THREE from 'three';
import { GRID } from './config.js';

export const G = {
  res: { wood: 10, food: 10, stone: 2, plank: 0, bread: 0, know: 0, silver: 5 }, foodCap: 30, happy: 70,
  day: 1, time: 0, over: false,
  placed: [], occ: new Map(), villagers: [], nature: [], drops: [], sites: [],
  selected: new Set(), tech: new Set(),     // tech: 已研究的科技 id
  year: 1, milestones: new Set(),           // R6 多年进程与里程碑
};
export const key = (x, z) => x + ',' + z;
export function footprint(b, rot) { return (rot % 2) ? [b.d, b.w] : [b.w, b.d]; }
export function cellsOf(b, x, z, rot) {
  const [w, d] = footprint(b, rot), out = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push(key(x + i, z + j));
  return out;
}
export function canPlace(b, x, z, rot, ignore) {
  const [w, d] = footprint(b, rot);
  if (x < 0 || z < 0 || x + w > GRID || z + d > GRID) return false;
  return cellsOf(b, x, z, rot).every(k => !G.occ.has(k) || G.occ.get(k) === ignore);
}
export function clampCell(b, x, z, rot) {
  const [w, d] = footprint(b, rot);
  return { x: THREE.MathUtils.clamp(x, 0, GRID - w), z: THREE.MathUtils.clamp(z, 0, GRID - d) };
}
export const canAfford = def => Object.entries(def.cost).every(([r, v]) => G.res[r] >= v);
export const pay = def => Object.entries(def.cost).forEach(([r, v]) => G.res[r] -= v);

/* ---- 由世界状态直接推导的查询（供 UI / 模拟共用） ---- */
export const coreBuilt = () => G.placed.some(p => p.def.role === 'core');
export const unlocked = def => def.role === 'core' || (!def.tech || G.tech.has(def.tech)) && coreBuilt();
export function houseCapacity() {
  return G.placed.filter(p => p.def.role === 'house' || p.def.role === 'core').reduce((s, p) => s + p.def.cap, 0);
}
