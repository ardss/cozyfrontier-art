/* =====================================================================
 * 2. 资产 —— 统一的 GLB 加载与原型规范化
 * ===================================================================*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DEFS, NATURE_DEFS } from './config';

const enc = p => p.split('/').map(encodeURIComponent).join('/');
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./js/vendor/draco/');   // 本地解码器，零 CDN 依赖
loader.setDRACOLoader(dracoLoader);

export const protos: any = {};   // id -> 归一化的 Group（原点=脚印中心，脚底贴地）
let pendingLoads = 0, onAllLoaded = null;

export function assetsReady() { return pendingLoads === 0; }
export function onAssetsLoaded(cb) { onAllLoaded = cb; }

function loadProto(id, glb, fit) {
  if (!glb) return;                                   // 程序化模型建筑（鸡舍/渔档/猎屋等）无 GLB，跳过
  pendingLoads++;
  const done = () => { if (--pendingLoads === 0 && onAllLoaded) onAllLoaded(); };
  loader.load(enc(glb) + '?v=5', g => {
    const root = g.scene;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        m.side = THREE.DoubleSide;
        // glTF 未写 metal/rough 时默认 metalness=1，无环境贴图会发灰发暗 → 强制非金属
        if (m.metalness !== undefined) { m.metalness = 0; m.roughness = 1; }
      });
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(fit(size));
    const box2 = new THREE.Box3().setFromObject(root);
    const c = box2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box2.min.y, -c.z);
    const wrap = new THREE.Group();
    wrap.add(root);
    protos[id] = wrap;
    done();
  }, undefined, err => { console.error('load fail', glb, err); done(); });
}
// 建筑适配 w×d 脚印；自然物/散布物/村民适配目标尺寸
// 建筑适配：目标高度优先（门要比人大），脚印允许 0.9 格出格容差
DEFS.forEach(d => loadProto(d.id, d.glb, s => {
  const sH = d.h / s.y;
  const sF = Math.min(d.w / s.x, d.d / s.z);
  return Math.min(Math.max(sH, sF * 1.15), (d.w + 0.9) / s.x, (d.d + 0.9) / s.z);
}));
Object.entries(NATURE_DEFS).forEach(([id, nd]) => loadProto('nat_' + id, nd.glb, s => nd.h / s.y));

/* ---- 村民：运行时人形骨骼绑定 ----
 * 静态网格 → 按顶点最近骨段分配蒙皮权重 → SkinnedMesh，走路/砍伐直接驱动骨头 */
export const CHAR_FILES = ['prop-villager_m.glb', 'prop-villager_f.glb', 'prop-villager_old.glb'];
// 从顶点分布实测身体关键点（bbox 含离群点不可直接用）
function bodySegments(geo) {
  const pos = geo.getAttribute('position');
  const xs = [], ys = [], zs = [];
  const step = Math.max(1, Math.floor(pos.count / 800));
  for (let i = 0; i < pos.count; i += step) {
    xs.push(pos.getX(i)); ys.push(pos.getY(i)); zs.push(pos.getZ(i));
  }
  const pct = (arr, p) => { const a = [...arr].sort((m, n) => m - n); return a[Math.floor(a.length * p)]; };
  const med = arr => pct(arr, .5);
  const yLo = pct(ys, .02), yHi = pct(ys, .98), H = yHi - yLo;
  const cx = med(xs), cz = med(zs);
  const band = (y0, y1) => xs.filter((x, i) => ys[i] >= y0 && ys[i] <= y1).map(x => Math.abs(x - cx));
  const shoulderY = yLo + .74 * H, hipY = yLo + .5 * H;
  const armX = Math.max(...band(shoulderY - .06 * H, shoulderY)) || .1 * H;   // 肩带最宽处 = 手臂外沿
  const legX = Math.max(...band(yLo + .12 * H, hipY)) || .08 * H;             // 髋部以下最宽 = 腿间距
  const V = (x, y) => [x, y, cz];
  return [
    { name: 'legL', a: V(cx + legX * .6, hipY), b: V(cx + legX * .8, yLo) },
    { name: 'legR', a: V(cx - legX * .6, hipY), b: V(cx - legX * .8, yLo) },
    { name: 'spine', a: V(cx, hipY), b: V(cx, shoulderY) },
    { name: 'head', a: V(cx, shoulderY), b: V(cx, yHi + .02 * H) },
    { name: 'armL', a: V(cx + armX * .55, shoulderY), b: V(cx + armX * .95, shoulderY - .3 * H) },
    { name: 'armR', a: V(cx - armX * .55, shoulderY), b: V(cx - armX * .95, shoulderY - .3 * H) },
  ];
}
function pointSegDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p.x - a[0], p.y - a[1], p.z - a[2]];
  const ab2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / ab2));
  const dx = ap[0] - ab[0] * t, dy = ap[1] - ab[1] * t, dz = ap[2] - ab[2] * t;
  return dx * dx + dy * dy + dz * dz;
}
CHAR_FILES.forEach((f, i) => {
  pendingLoads++;
  loader.load(enc('ai3d-mirror/' + f) + '?v=5', g => {
    const root = g.scene;
    const segs = bodySegments(root.children[0]?.geometry || g.scene.getObjectByProperty('isMesh', true).geometry);
    const geoList = [];
    root.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry.clone();
      const pos = geo.getAttribute('position');
      const idx = new Uint16Array(pos.count * 4);
      const wgt = new Float32Array(pos.count * 4);
      for (let vi = 0; vi < pos.count; vi++) {
        const p = { x: pos.getX(vi), y: pos.getY(vi), z: pos.getZ(vi) };
        const ds = segs.map(s => pointSegDist(p, s.a, s.b));
        let b0 = 0, b1 = 1;
        if (ds[1] < ds[0]) { b0 = 1; b1 = 0; }
        for (let s = 2; s < ds.length; s++) {
          if (ds[s] < ds[b0]) { b1 = b0; b0 = s; }
          else if (ds[s] < ds[b1]) b1 = s;
        }
        // 距离反比双骨混合，避免接缝撕裂
        const w0 = ds[b1] / (ds[b0] + ds[b1] + 1e-6);
        idx[vi * 4] = b0; wgt[vi * 4] = w0;
        idx[vi * 4 + 1] = b1; wgt[vi * 4 + 1] = 1 - w0;
      }
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
      geoList.push({ geo, material: o.material });
    });
    protos['char' + i] = { skin: { geoList, segs }, charFile: f };
    if (--pendingLoads === 0 && onAllLoaded) onAllLoaded();
  }, undefined, err => { console.error('load fail', f, err); if (--pendingLoads === 0 && onAllLoaded) onAllLoaded(); });
});
