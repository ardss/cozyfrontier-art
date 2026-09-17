/* =====================================================================
 * 掉落物、搬运、入库、浮动小字
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, RES_INFO } from './config.js';
import { scene, cam, dom, mainEl } from './scene.js';
import { G } from './world.js';

/* ---- 掉落物与搬运 ---- */
const dropGeo = new THREE.IcosahedronGeometry(.14, 0);
export function spawnDrop(res, amt, pos) {
  const mesh = new THREE.Mesh(dropGeo, new THREE.MeshLambertMaterial({ color: RES_INFO[res].color }));
  mesh.position.set(pos.x + (Math.random() - .5) * .8, .5, pos.z + (Math.random() - .5) * .8);
  mesh.castShadow = true;
  scene.add(mesh);
  G.drops.push({ mesh, res, amt, x: mesh.position.x, z: mesh.position.z, baseY: .14, t: Math.random() * 6 });
}
export function stepDrops(dt, t) {
  for (const d of G.drops) {
    d.t += dt;
    d.mesh.position.y = d.baseY + Math.abs(Math.sin(d.t * 3)) * .06;   // 落地小弹跳感
    d.mesh.rotation.y += dt * 2;
  }
}
export const carryTotal = v => Object.values(v.carry).reduce((s, n) => s + n, 0);
export function startDeliver(v) {
  const depot = findDepot(v);
  v.task = depot ? { kind: 'deliver', target: depot } : { kind: 'deliver', target: { x: GRID / 2 + 1.5, z: GRID / 2 + 1.5 } };
}
export function findDepot(v) {
  // 村中心收一切；否则按携带最多的资源找对应生产建筑
  const core = G.placed.find(p => p.def.role === 'core');
  if (core) return core;
  let heaviest = null, best = -1;
  for (const [res, n] of Object.entries(v.carry)) if (n > best) { best = n; heaviest = res; }
  if (!heaviest) return null;
  const role = RES_INFO[heaviest].depotRole;
  return G.placed.find(p => p.def.role === role) || G.placed.find(p => p.def.role === 'wood' || p.def.role === 'food') || null;
}
export function deliverCarry(v) {
  let got = [];
  for (const [res, n] of Object.entries(v.carry)) {
    if (!n) continue;
    const cap = res === 'food' ? G.foodCap : 9999;
    G.res[res] = Math.min(cap, G.res[res] + n);
    got.push('+' + n + RES_INFO[res].icon);
  }
  if (got.length) floatText(got.join(' '), v.obj.position);
  v.carry = {};
  v.resume = null;
}

/* ---- 浮动小字 ---- */
export function floatText(text, worldPos) {
  const p = worldPos.clone(); p.y = 1.1; p.project(cam);
  const r = dom.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = (r.left + (p.x + 1) / 2 * r.width) + 'px';
  el.style.top = (r.top + (1 - p.y) / 2 * r.height) + 'px';
  mainEl.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
