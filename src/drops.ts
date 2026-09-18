/* =====================================================================
 * 掉落物、搬运、入库、浮动小字
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, RES_INFO } from './config';
import { ICONS } from './icons';
import { scene, cam, dom, mainEl } from './scene';
import { G } from './world';
import { Sfx } from './audio';

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
export const carryTotal = (v): number => Object.values(v.carry as Record<string, number>).reduce((s, n) => s + n, 0);
export function startDeliver(v) {
  const depot = findDepot(v);
  v.task = depot ? { kind: 'deliver', target: depot } : { kind: 'deliver', target: { x: GRID / 2 + 1.5, z: GRID / 2 + 1.5 } };
}
export function findDepot(v) {
  // 村中心收一切；否则按携带最多的资源找对应生产建筑
  const core = G.placed.find(p => p.def.role === 'core');
  if (core) return core;
  let heaviest = null, best = -1;
  for (const [res, n] of Object.entries(v.carry as Record<string, number>)) if (n > best) { best = n; heaviest = res; }
  if (!heaviest) return null;
  const role = RES_INFO[heaviest].depotRole;
  return G.placed.find(p => p.def.role === role) || G.placed.find(p => p.def.role === 'wood' || p.def.role === 'food') || null;
}
export function deliverCarry(v) {
  let got: any[] = [];
  for (const [res, n] of Object.entries(v.carry)) {
    if (!n) continue;
    const cap = res === 'food' ? G.foodCap : 9999;
    G.res[res] = Math.min(cap, G.res[res] + n);
    got.push('+' + n + ' ' + (ICONS[res] || ''));
  }
  if (got.length) floatText(got.join(' '), v.obj.position);
  v.carry = {};
  v.resume = null;
}

/* ---- 采集特效：木屑/碎石粒子 + 目标晃动 ---- */
const fxGeo = new THREE.BoxGeometry(.07, .07, .07);
const fxMats = {};
function fxMat(color) {
  return fxMats[color] || (fxMats[color] = new THREE.MeshBasicMaterial({ color }));
}
const fxs = [];                     // { mesh, vel, life }
const shakes = [];                  // { inst, t }
export function chopFX(inst, res) {
  const color = RES_INFO[res] ? RES_INFO[res].color : 0x8a5a34;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(fxGeo, fxMat(color));
    m.position.set(inst.position.x, .6 + Math.random() * .5, inst.position.z);
    scene.add(m);
    fxs.push({ mesh: m, vel: new THREE.Vector3((Math.random() - .5) * 2.2, 1.6 + Math.random() * 1.4, (Math.random() - .5) * 2.2), life: .65 });
  }
  shakes.push({ inst, t: .35 });
  Sfx.chop();
}
export function stepFX(dt) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i];
    f.life -= dt;
    f.vel.y -= 6 * dt;
    f.mesh.position.addScaledVector(f.vel, dt);
    f.mesh.rotation.x += dt * 9; f.mesh.rotation.y += dt * 7;
    if (f.life <= 0) { scene.remove(f.mesh); fxs.splice(i, 1); }
  }
  for (let i = shakes.length - 1; i >= 0; i--) {
    const s = shakes[i];
    s.t -= dt;
    s.inst.rotation.z = Math.sin(s.t * 55) * .06 * s.t / .35;
    if (s.t <= 0) { s.inst.rotation.z = 0; shakes.splice(i, 1); }
  }
}

/* ---- 浮动小字 ---- */
export function floatText(text, worldPos) {
  const p = worldPos.clone(); p.y = 1.1; p.project(cam);
  const r = dom.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float';
  el.innerHTML = text;
  el.style.left = (r.left + (p.x + 1) / 2 * r.width) + 'px';
  el.style.top = (r.top + (1 - p.y) / 2 * r.height) + 'px';
  mainEl.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
