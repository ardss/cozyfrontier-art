/* =====================================================================
 * 6. 村民 —— 生成、指令、骨骼/整体动画
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, VNAMES, TRAITS } from './config.js';
import { scene } from './scene.js';
import { G } from './world.js';
import { protos, CHAR_FILES } from './assetsv2.js';

export function spawnVillagers(n) {
  for (let i = 0; i < n; i++) {
    const src = protos['char' + (G.villagers.length % CHAR_FILES.length)];
    const inner = new THREE.Group();
    let bones = null;
    if (src.skin) {
      // 每个村民一套独立骨架；关节位置 = 骨段起点（绝对坐标，相对父骨骼偏移）
      const { geoList, segs } = src.skin;
      const S = Object.fromEntries(segs.map(s => [s.name, s]));
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const mk = (name, pos, parent) => { const b = new THREE.Bone(); b.name = name; b.position.set(...pos); parent.add(b); return b; };
      const hips = new THREE.Bone(); hips.name = 'hips'; hips.position.set(...S.spine.a);
      const spine = mk('spine', [0, 0, 0], hips);                     // 脊柱关节与髋同点
      const head = mk('head', sub(S.head.a, S.spine.a), spine);
      const armL = mk('armL', sub(S.armL.a, S.spine.a), spine);
      const armR = mk('armR', sub(S.armR.a, S.spine.a), spine);
      const legL = mk('legL', sub(S.legL.a, S.spine.a), hips);
      const legR = mk('legR', sub(S.legR.a, S.spine.a), hips);
      bones = { hips, spine, head, armL, armR, legL, legR };
      inner.add(hips);
      hips.updateMatrixWorld(true);
      const skeleton = new THREE.Skeleton([hips, spine, head, armL, armR, legL, legR]);
      const order = ['hips', 'spine', 'head', 'armL', 'armR', 'legL', 'legR'];
      const segToBone = segs.map(s => order.indexOf(s.name));
      for (const srcItem of geoList) {
        const geo = srcItem.geo.clone();
        const si = geo.getAttribute('skinIndex');
        const remap = new Uint16Array(si.array.length);
        for (let vi = 0; vi < si.count; vi++)
          for (let k = 0; k < 4; k++) remap[vi * 4 + k] = segToBone[si.getComponent(vi, k)] >= 0 ? segToBone[si.getComponent(vi, k)] : 0;
        geo.setAttribute('skinIndex', new THREE.BufferAttribute(remap, 4));
        const sm = new THREE.SkinnedMesh(geo, srcItem.material);
        sm.castShadow = true;
        sm.frustumCulled = false;
        inner.add(sm);
        sm.bind(skeleton, new THREE.Matrix4());
      }
    } else {
      inner.add(src.clone());
    }
    const wrap = new THREE.Group();
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -box.min.y, -c.z);
    wrap.scale.setScalar(0.55 / size.y);     // 村民约半格高：房子该比人大
    wrap.add(inner);
    wrap.position.set(GRID / 2 + (Math.random() - .5) * 3, 0, GRID / 2 + (Math.random() - .5) * 3);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.28, .36, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x8fc0ff, transparent: true, opacity: .9, depthWrite: false }));
    ring.position.y = .02; ring.visible = false;
    wrap.add(ring);
    scene.add(wrap);
    G.villagers.push({ name: VNAMES[G.villagers.length % VNAMES.length], trait: TRAITS[Math.floor(Math.random() * TRAITS.length)], obj: wrap, bones, ring, task: null, resume: null, carry: {}, skills: {}, slot: (G.villagers.length % 4) * 0.3 });
  }
}
export function command(v, kind, target) { v.task = { kind, target, workT: 0 }; }

/* ---- 骨骼动画（有骨架用骨骼，无骨架退回整体摆动） ---- */
export function animWalk(v, t) {
  const s = Math.sin(t * 10);
  if (v.bones) {
    v.bones.legL.rotation.x = s * .55;
    v.bones.legR.rotation.x = -s * .55;
    v.bones.armL.rotation.x = -s * .45;
    v.bones.armR.rotation.x = s * .45;
    v.bones.spine.rotation.x = .08;
    v.obj.position.y = Math.abs(s) * .03;
  } else {
    v.obj.children[0].rotation.x = .06 + s * .06;
    v.obj.position.y = Math.abs(s) * .05;
  }
}
export function animWork(v, t) {
  const s = Math.sin(t * 12);
  if (v.bones) {
    v.bones.armR.rotation.x = -.7 - s * .5;          // 右臂抡起砍下
    v.bones.armL.rotation.x = -.15;
    v.bones.spine.rotation.x = .18 + s * .1;         // 前倾发力
    v.bones.legL.rotation.x = v.bones.legR.rotation.x = 0;
    v.obj.position.y = Math.abs(s) * .02;
  } else {
    v.obj.children[0].rotation.x = .12 + s * .12;
    v.obj.position.y = Math.abs(s) * .04;
  }
}
export function animIdle(v, t) {
  const s = Math.sin(t * 2);
  if (v.bones) {
    for (const b of ['legL', 'legR', 'armL', 'armR']) v.bones[b].rotation.x *= .9;
    v.bones.spine.rotation.x *= .9;
    v.bones.spine.rotation.z = s * .03;              // 呼吸般轻晃
  } else {
    v.obj.children[0].rotation.x *= .9;
    v.obj.position.y = 0;
  }
}
