/* =====================================================================
 * 3. 场景 —— 渲染器、灯光、地面、相机 rig、拾取
 * ===================================================================*/
import * as THREE from 'three';
import { GRID } from './config.js';

export const mainEl = document.getElementById('main');
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMappingExposure = 1.3;
mainEl.appendChild(renderer.domElement);
export const dom = renderer.domElement;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a96b);
scene.fog = new THREE.Fog(0x87a96b, 40, 95);

export const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
export const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 60 });
scene.add(sun, new THREE.HemisphereLight(0xfff4e2, 0x6b8a4f, 1.05), new THREE.AmbientLight(0xffffff, 0.55));

const enc = p => p.split('/').map(encodeURIComponent).join('/');

// 地面：水彩草地纹理平铺（纹理加载前用纯色兜底）
const groundMat = new THREE.MeshLambertMaterial({ color: 0x8fae6a });
new THREE.TextureLoader().load(enc('ai3d-mirror/ground-grass.png') + '?v=1', tex => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID / 6.5, GRID / 6.5);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  groundMat.map = tex;
  groundMat.color.set(0xe4ecd2);
  groundMat.needsUpdate = true;
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(GRID / 2, 0, GRID / 2);
ground.receiveShadow = true;
scene.add(ground);

// 建造网格：平时隐藏，进入建造/搬移模式才显示
export const buildGrid = new THREE.GridHelper(GRID, GRID, 0x5d7a45, 0x74925a);
buildGrid.position.set(GRID / 2, 0.02, GRID / 2);
buildGrid.visible = false;
scene.add(buildGrid);

export const camCtl = {
  target: new THREE.Vector3(GRID / 2, 0, GRID / 2),
  theta: Math.PI * 0.15, phi: Math.PI * 0.34, r: 26,
  apply() {
    cam.position.set(
      this.target.x + this.r * Math.sin(this.phi) * Math.cos(this.theta),
      this.r * Math.cos(this.phi),
      this.target.z + this.r * Math.sin(this.phi) * Math.sin(this.theta));
    cam.lookAt(this.target);
  },
  pan(dx, dz) {
    this.target.x = THREE.MathUtils.clamp(this.target.x + dx, -GRID * .3, GRID * 1.3);
    this.target.z = THREE.MathUtils.clamp(this.target.z + dz, -GRID * .3, GRID * 1.3);
    this.apply();
  },
  fwd()   { return new THREE.Vector3(-Math.cos(this.theta), 0, -Math.sin(this.theta)); },
  right() { return new THREE.Vector3( Math.sin(this.theta), 0, -Math.cos(this.theta)); },
};

/* =====================================================================
 * 8. 拾取
 * ===================================================================*/
export const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
export const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function setRay(e) {
  const r = dom.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, cam);
}
export function toGround(e) {
  setRay(e);
  const pt = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, pt) ? pt : null;
}
export function pickAt(e, list, filterAlive) {
  setRay(e);
  const hits = raycaster.intersectObjects(list.map(p => p.inst || p.obj), true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      const found = list.find(p => (p.inst || p.obj) === o);
      if (found && (!filterAlive || found.alive !== false)) return found;
      o = o.parent;
    }
  }
  return null;
}
