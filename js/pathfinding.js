/* =====================================================================
 * 寻路 —— A* 网格寻路：占用格(建筑/工地/树木岩石)不可通行，8方向、禁斜穿角落
 * ===================================================================*/
import { GRID } from './config.js';
import { G, key } from './world.js';

export function cellFree(x, z) {
  if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
  return !G.occ.has(key(x, z));
}
export function nearestFree(cx, cz) {
  if (cellFree(cx, cz)) return { x: cx, z: cz };
  for (let r = 1; r <= 3; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (cellFree(cx + dx, cz + dz)) return { x: cx + dx, z: cz + dz };
      }
  return null;
}
export function losFree(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / .3) || 1;
  for (let i = 1; i <= steps; i++) {
    const x = Math.floor(ax + (bx - ax) * i / steps), z = Math.floor(az + (bz - az) * i / steps);
    if (!cellFree(x, z)) return false;
  }
  return true;
}
export function findPath(sx, sz, tx, tz) {
  const goal = nearestFree(Math.floor(tx), Math.floor(tz));
  if (!goal) return null;
  const start = { x: Math.floor(sx), z: Math.floor(sz) };
  if (start.x === goal.x && start.z === goal.z) return [{ x: goal.x + .5, z: goal.z + .5 }];
  const K = (x, z) => x * 100 + z;
  const open = new Map([[K(start.x, start.z), { x: start.x, z: start.z, g: 0, f: 0, parent: null }]]);
  const closed = new Set();
  let best = null, guard = 0;
  while (open.size && guard++ < 4000) {
    let cur = null;
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n;
    open.delete(K(cur.x, cur.z)); closed.add(K(cur.x, cur.z));
    if (cur.x === goal.x && cur.z === goal.z) { best = cur; break; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!cellFree(nx, nz)) continue;
      if (dx && dz && (!cellFree(cur.x + dx, cur.z) || !cellFree(cur.x, cur.z + dz))) continue;
      const nk = K(nx, nz);
      if (closed.has(nk)) continue;
      const g = cur.g + ((dx && dz) ? 1.414 : 1);
      const ex = open.get(nk);
      if (!ex || g < ex.g) open.set(nk, { x: nx, z: nz, g, f: g + Math.hypot(nx - goal.x, nz - goal.z), parent: cur });
    }
  }
  if (!best) return null;
  const pts = [];
  for (let n = best; n; n = n.parent) pts.unshift({ x: n.x + .5, z: n.z + .5 });
  return pts;
}
