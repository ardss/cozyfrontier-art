/* =====================================================================
 * 5. 自然资源与地表装饰
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, NATURE_DEFS, NATURE_COUNTS } from './config.js';
import { scene } from './scene.js';
import { G, key } from './world.js';
import { protos } from './assetsv2.js';

/* ---- 资源目标高亮：被派工的资源脚下亮起金环 ---- */
const ringGeo = new THREE.RingGeometry(.4, .5, 28).rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .9, depthWrite: false });
export function highlightNode(node, on = true) {
  if (on && !node.ring) {
    node.ring = new THREE.Mesh(ringGeo, ringMat);
    node.ring.position.set(node.x + .5, .05, node.z + .5);
    scene.add(node.ring);
  } else if (!on && node.ring) {
    scene.remove(node.ring);
    node.ring = null;
  }
}

export function scatterNature() {
  const center = GRID / 2;
  let tries = 0;
  for (const [type, n] of Object.entries(NATURE_COUNTS)) {
    let placedN = 0;
    while (placedN < n && tries++ < 2000) {
      const x = 1 + Math.floor(Math.random() * (GRID - 2));
      const z = 1 + Math.floor(Math.random() * (GRID - 2));
      const k = key(x, z);
      const free = NATURE_DEFS[type].free;
      if (!free && G.occ.has(k)) continue;           // 占格类不重叠；贴地类可共存
      const dc = Math.hypot(x - center, z - center);
      if (dc < 3.5 && !free) continue;               // 中心留空地给村庄
      if (type !== 'bush' && !free && dc > 4 && dc < 5.2 && Math.random() < .7) continue;
      const nd = NATURE_DEFS[type];
      const inst = protos['nat_' + type].clone();
      inst.position.set(x + .5 + (Math.random() - .5) * .25, 0, z + .5 + (Math.random() - .5) * .25);
      inst.rotation.y = Math.random() * Math.PI * 2;
      inst.scale.setScalar(.85 + Math.random() * .3);
      scene.add(inst);
      const node = { type, def: nd, inst, x, z, hp: nd.hp, alive: true, respawnDay: 0 };
      G.nature.push(node);
      if (!free) G.occ.set(k, node);
      placedN++;
    }
  }
}
/* ---- 装饰树（S37 造景）：deco 标记 → 采集/派工/再生逻辑全部排除 ---- */
export function plantDecoTree(x, z) {
  const k = key(x, z);
  if (G.occ.has(k)) return null;
  const inst = protos['nat_tree'].clone();
  inst.position.set(x + .5, 0, z + .5);
  inst.rotation.y = Math.random() * Math.PI * 2;
  inst.scale.setScalar(.55 + Math.random() * .15);
  scene.add(inst);
  const node = { type: 'tree', def: { name: '装饰树', deco: true, yield: 'wood', amt: 0, hp: 1 }, inst, x, z, hp: Infinity, alive: true, deco: true, respawnDay: 0 };
  G.nature.push(node);
  G.occ.set(k, node);
  return node;
}

export function chopDone(node) {
  node.hp--;
  if (node.hp <= 0) {
    node.alive = false;
    highlightNode(node, false);
    scene.remove(node.inst);
    if (G.occ.get(key(node.x, node.z)) === node) G.occ.delete(key(node.x, node.z));
    node.respawnDay = G.day + (node.def.regrow || 9999);
    if (!node.def.regrow) G.nature = G.nature.filter(n => n !== node);
  }
}
export function regrow() {
  for (const n of G.nature) {
    if (!n.alive && G.day >= n.respawnDay && !G.occ.has(key(n.x, n.z))) {
      n.alive = true; n.hp = n.def.hp; scene.add(n.inst);
      G.occ.set(key(n.x, n.z), n);
    }
  }
}
