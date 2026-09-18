/* =====================================================================
 * 7. 建筑 —— 地垫、落下动画、放置/移除、工地、幽灵预览
 * ===================================================================*/
import * as THREE from 'three';
import { CELL_SINK } from './config.js';
import { scene, cam } from './scene.js';
import { G, footprint, cellsOf, canPlace, canAfford } from './world.js';
import { protos } from './assetsv2.js';
import { command } from './villagers.js';
import { ctx } from './context.js';
import { registerFarm } from './farm.js';
import { registerPasture } from './pasture.js';

const padMat = new THREE.MeshLambertMaterial({ color: 0x9db972 });
const padGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function makePad(b, rot) {
  const [w, d] = footprint(b, rot);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.scale.set(w * .99, 1, d * .99);
  pad.position.set(w / 2, .006, d / 2);
  pad.receiveShadow = true;
  const g = new THREE.Group();
  g.add(pad);
  return g;
}
const dropAnims = [];
function startDropAnim(inst) { inst.userData.anim = { t: 0, fromY: 1.1 }; dropAnims.push(inst); }
export function stepDropAnims(dt) {
  for (let i = dropAnims.length - 1; i >= 0; i--) {
    const inst = dropAnims[i], a = inst.userData.anim;
    a.t = Math.min(1, a.t + dt * 5);
    inst.position.y = (inst.userData.baseY || 0) + a.fromY * Math.pow(1 - a.t, 3);
    if (a.t >= 1) { inst.position.y = inst.userData.baseY || 0; dropAnims.splice(i, 1); }
  }
}
export function placeInstance(def, x, z, rot, animate) {
  const pad = makePad(def, rot);
  pad.position.set(x, 0, z);
  scene.add(pad);
  const inst = protos[def.id].clone();
  const [w, d] = footprint(def, rot);
  inst.position.set(x + w / 2, CELL_SINK, z + d / 2);
  inst.rotation.y = rot * Math.PI / 2;
  inst.userData.baseY = CELL_SINK;
  scene.add(inst);
  const entry = { def, inst, pad, x, z, rot };
  cellsOf(def, x, z, rot).forEach(k => G.occ.set(k, entry));
  G.placed.push(entry);
  if (animate) startDropAnim(inst);
  if (def.role === 'happy') G.happy += def.add;
  if (def.role === 'farm') registerFarm(entry);
  if (def.role === 'granary') G.foodCap += 25;
  if (def.id === 'warehouse') G.foodCap += 50;
  if (def.role === 'pasture' || def.id === 'fish') registerPasture(entry);   // 鸡舍/渔档/猎屋（S15-17）
  return entry;
}
export function removeEntry(entry) {
  cellsOf(entry.def, entry.x, entry.z, entry.rot).forEach(k => { if (G.occ.get(k) === entry) G.occ.delete(k); });
  scene.remove(entry.inst, entry.pad);
  G.placed = G.placed.filter(p => p !== entry);
  G.villagers.forEach(v => { if (v.task && v.task.target === entry) v.task = null; });
  if (entry.def.role === 'happy') G.happy -= entry.def.add;
  if (entry.def.role === 'granary') G.foodCap -= 25;
  if (entry.def.id === 'warehouse') G.foodCap -= 50;
  ctx.UI && ctx.UI.refresh();
}

/* 建造工地：付费后先立工地，由村民花时间建成 */
const siteNeed = def => 5 + (def.cost.wood || 0) * 0.5;
const barBgGeo = new THREE.PlaneGeometry(1.1, 0.16);
const barFillGeo = new THREE.PlaneGeometry(1.06, 0.10).translate(0.53, 0, 0);   // 原点在左端，从左往右涨
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x2b2420, depthWrite: false });
export function createSite(def, x, z, rot) {
  const pad = makePad(def, rot);
  pad.position.set(x, 0, z);
  scene.add(pad);
  const inst = protos[def.id].clone();
  const [w, d] = footprint(def, rot);
  inst.position.set(x + w / 2, CELL_SINK, z + d / 2);
  inst.rotation.y = rot * Math.PI / 2;
  inst.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.3; return c; });
      if (o.material.length === 1) o.material = o.material[0];
    }
  });
  scene.add(inst);
  const topY = new THREE.Box3().setFromObject(inst).max.y + 0.35;
  const barGrp = new THREE.Group();                                // 面向镜头的进度条
  const barBg = new THREE.Mesh(barBgGeo, barBgMat);
  const barFill = new THREE.Mesh(barFillGeo, new THREE.MeshBasicMaterial({ color: 0xa8d8a0, depthWrite: false }));
  barFill.position.set(-0.53, 0, 0.001);
  barFill.scale.x = 0.001;
  barGrp.add(barBg, barFill);
  barGrp.position.set(x + w / 2, topY, z + d / 2);
  scene.add(barGrp);
  const site = { def, inst, pad, x, z, rot, progress: 0, need: siteNeed(def), builder: null, barGrp, barFill };
  cellsOf(def, x, z, rot).forEach(k => G.occ.set(k, site));
  G.sites.push(site);
  return site;
}
export function updateSiteVisuals(site) {
  const r = Math.min(1, site.progress / site.need);
  site.barFill.scale.x = Math.max(0.001, r);
  site.inst.traverse(o => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => m.opacity = 0.3 + 0.65 * r);
    }
  });
}
export function finishSite(site) {
  cellsOf(site.def, site.x, site.z, site.rot).forEach(k => { if (G.occ.get(k) === site) G.occ.delete(k); });
  scene.remove(site.inst, site.pad, site.barGrp);
  G.sites = G.sites.filter(s => s !== site);
  placeInstance(site.def, site.x, site.z, site.rot, true);
  ctx.toast && ctx.toast('🔨 ' + site.def.name + ' 建成');
  ctx.UI && ctx.UI.refresh();
}
export function stepSites(dt) {
  for (const site of G.sites) site.barGrp.quaternion.copy(cam.quaternion);   // 进度条始终面向镜头
  // 自动派最近的空闲村民去打工地
  G._siteT = (G._siteT || 0) + dt;
  if (G._siteT > 1.5) {
    G._siteT = 0;
    for (const site of G.sites) {
      const builders = G.villagers.filter(v => v.task && v.task.kind === 'build' && v.task.target === site).length;
      if (builders >= 2) continue;
      let near = null, nd = 1e9;
      for (const v of G.villagers) {
        if (v.task) continue;
        const d = v.obj.position.distanceTo(site.inst.position);
        if (d < nd) { nd = d; near = v; }
      }
      if (near) { site.builder = near; command(near, 'build', site); }
    }
  }
  for (const site of G.sites) {
    if (site.builder && (!site.builder.task || site.builder.task.target !== site)) site.builder = null;
  }
}

// 幽灵预览：半透明模型 + 脚印格
const ghostOK  = new THREE.MeshBasicMaterial({ color: 0xaaffaa, transparent: true, opacity: .5, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff6655, transparent: true, opacity: .5, depthWrite: false });
const fpUnitGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
const ghost = { model: null, fp: null };
export function showGhost(def) {
  hideGhost();
  if (!protos[def.id]) return;
  ghost.model = protos[def.id].clone();
  ghost.fp = new THREE.Group();
  scene.add(ghost.model, ghost.fp);
}
export function hideGhost() {
  if (ghost.model) scene.remove(ghost.model);
  if (ghost.fp) scene.remove(ghost.fp);
  ghost.model = ghost.fp = null;
}
export function updateGhost(def, cell, rot) {
  if (!ghost.model) return;
  const [w, d] = footprint(def, rot);
  const ok = canPlace(def, cell.x, cell.z, rot) && canAfford(def);
  const mat = ok ? ghostOK : ghostBad;
  ghost.model.traverse(o => { if (o.isMesh) o.material = mat; });
  ghost.model.position.set(cell.x + w / 2, CELL_SINK + .02, cell.z + d / 2);
  ghost.model.rotation.y = rot * Math.PI / 2;
  ghost.fp.clear();
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    const p = new THREE.Mesh(fpUnitGeo, mat);
    p.position.set(cell.x + i + .5, .03, cell.z + j + .5);
    ghost.fp.add(p);
  }
}
export { ghostOK, ghostBad, makePad };
