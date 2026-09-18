/* =====================================================================
 * 17. 畜牧·渔业·狩猎 —— 鸡舍 / 渔档 / 猎屋（S17+S16+S15）
 *     范式与 farm.js 完全同构：registerPasture / stepPasture / 自动派工 / 面板钩子
 *     动物（鸡/鹿）为程序化模型，纯视觉+逻辑点位，不进 occ 占格系统
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, seasonOf, DAY_SECONDS } from './config';
import { scene } from './scene';
import { G } from './world';
import { protos } from './assets';
import { spawnDrop, floatText } from './drops';
import { ctx } from './context';
import { registerJobs, nearestIdle } from './jobs';

export const EGG_FOOD = 3;                  // 捡蛋产出
export const HUNT_FOOD = 5, HUNT_STONE = 1; // 狩猎产出（骨器简化为石头）
export const HUNT_WORK = 3;                 // 狩猎工时（秒）
const DEER_RESPAWN = 3;                     // 鹿被捕后 3 天刷新

/* ---- 程序化原型：鸡舍（小木棚+斜顶） ---- */
function buildCoopProto() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a6a3c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x6e4626 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, .55, .9), wood);
  body.position.y = .28; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(.95, .4, 4), dark);
  roof.position.y = .75; roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .8);
  roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.24, .3, .05), dark);
  door.position.set(0, .16, .46); g.add(door);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(.24, .04, .4), wood);
  ramp.position.set(0, .02, .65); ramp.rotation.x = -.28; g.add(ramp);
  return g;
}
/* ---- 程序化原型：渔档（木平台+支架+钓竿+木桶） ---- */
function buildFishProto() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5e4a30 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, .08, 1.1), wood);
  deck.position.y = .3; deck.castShadow = true; g.add(deck);
  for (const [px, pz] of [[-.65, -.4], [.65, -.4], [-.65, .4], [.65, .4]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.1, .3, .1), dark);
    leg.position.set(px, .15, pz); g.add(leg);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .9, 6), dark);
  post.position.set(-.55, .75, -.3); post.castShadow = true; g.add(post);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.1, 5), dark);
  rod.position.set(-.15, 1.1, .1); rod.rotation.z = -.7; rod.castShadow = true; g.add(rod);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .32, 8), wood);
  barrel.position.set(.5, .5, .25); barrel.castShadow = true; g.add(barrel);
  return g;
}
/* ---- 程序化原型：猎屋（原木小屋+鹿角架） ---- */
function buildHuntProto() {
  const g = new THREE.Group();
  const log = new THREE.MeshLambertMaterial({ color: 0x7c5433 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x553a22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, .6, .9), log);
  body.position.y = .3; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(.9, .38, 4), dark);
  roof.position.y = .79; roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .8);
  roof.castShadow = true; g.add(roof);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .06), dark);
  rack.position.set(.65, .25, .5); g.add(rack);
  const antler = new THREE.Mesh(new THREE.BoxGeometry(.3, .06, .06), dark);
  antler.position.set(.65, .5, .5); antler.rotation.z = .3; g.add(antler);
  return g;
}
protos.coop = buildCoopProto();     // 无 GLB 资产，全部程序化（404 一次，忽略即可）
protos.fish = buildFishProto();
protos.hunt = buildHuntProto();

/* ---- 程序化动物：鸡（白身+红冠），鹿（棕身+细腿+角） ---- */
const BODY_W = new THREE.MeshLambertMaterial({ color: 0xf2ede4 });
const COMB_R = new THREE.MeshLambertMaterial({ color: 0xc23c2e });
const DEER_B = new THREE.MeshLambertMaterial({ color: 0x8a5f38 });
function buildChicken() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.2, .16, .26), BODY_W);
  body.position.y = .13; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), BODY_W);
  head.position.set(0, .26, .14); g.add(head);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, .08), COMB_R);
  comb.position.set(0, .34, .13); g.add(comb);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.06, .1, .06), BODY_W);
  tail.position.set(0, .2, -.15); tail.rotation.x = -.5; g.add(tail);
  g.userData = { tx: 0, tz: 0, wait: Math.random() * 3, phase: Math.random() * 6 };
  return g;
}
function buildDeer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.36, .34, .7), DEER_B);
  body.position.y = .52; body.castShadow = true; g.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(.14, .34, .14), DEER_B);
  neck.position.set(0, .8, .3); neck.rotation.x = .3; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, .3), DEER_B);
  head.position.set(0, 1.0, .42); g.add(head);
  const legMat = DEER_B;
  for (const [px, pz] of [[-.13, .24], [.13, .24], [-.13, -.24], [.13, -.24]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, .38, .07), legMat);
    leg.position.set(px, .19, pz); leg.castShadow = true; g.add(leg);
  }
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(.04, .18, .04), new THREE.MeshLambertMaterial({ color: 0xcbb28a }));
    horn.position.set(s * .07, 1.14, .38); horn.rotation.z = s * .4; g.add(horn);
  }
  g.userData = { tx: 0, tz: 0, wait: Math.random() * 4, phase: Math.random() * 6, def: { work: HUNT_WORK } };
  return g;
}

/* ---- 游走 AI：在 home（Vector3）附近半径 R 内随机选点慢走，走走停停 ---- */
function roamAnimal(a, dt, home, R, speed) {
  const u = a.userData;
  if (u.wait > 0) { u.wait -= dt; return; }
  const dx = u.tx - a.position.x, dz = u.tz - a.position.z;
  const d = Math.hypot(dx, dz);
  if (d < .08) {                                   // 到点：歇一会，选新目标
    u.wait = 1 + Math.random() * 3;
    const ang = Math.random() * Math.PI * 2, r = .3 + Math.random() * R;
    u.tx = home.x + Math.cos(ang) * r; u.tz = home.z + Math.sin(ang) * r;
    return;
  }
  a.position.x += dx / d * speed * dt; a.position.z += dz / d * speed * dt;
  a.rotation.y = Math.atan2(dx, dz);
  a.rotation.z = Math.sin(G.time * 10 + u.phase) * .05;   // 走路小颠簸
}

/* ---- 动物总登记表：猎屋/鸡舍被拆除时回收动物（removeEntry 不感知动物） ---- */
const allAnimals = [];                          // { mesh, home }
function addAnimal(mesh, home) { scene.add(mesh); allAnimals.push({ mesh, home }); }
function cullRemoved() {
  for (let i = allAnimals.length - 1; i >= 0; i--) {
    const a = allAnimals[i];
    if (!G.placed.includes(a.home)) { scene.remove(a.mesh); allAnimals.splice(i, 1); }
  }
}

/* ---- 放置钩子：buildings.js placeInstance 末尾对 role:'pasture' 或渔档调用 ---- */
export function registerPasture(entry) {
  const id = entry.def.id;
  if (id === 'coop') {
    entry.pasture = { eggReady: false, lastDay: G.day, birds: [] };
    for (let i = 0; i < 3; i++) {                  // 内置 3 只鸡
      const c = buildChicken();
      const ang = Math.random() * Math.PI * 2;
      c.position.set(entry.inst.position.x + Math.cos(ang) * .8, 0, entry.inst.position.z + Math.sin(ang) * .8);
      addAnimal(c, entry);
      entry.pasture.birds.push(c);
    }
  } else if (id === 'fish') {
    // 临水校验：世界无水域数据 → 放宽为地图边缘（3 格内）视为水边，仅提示不阻断
    const w = entry.def.w, nearEdge = entry.x <= 3 || entry.z <= 3 || entry.x + w >= GRID - 3 || entry.z + entry.def.d >= GRID - 3;
    if (!nearEdge) ctx.toast('⚠ 渔档没建在水边——建议放到地图边缘（不阻断作业）');
    else ctx.toast('🎣 渔档临水而建，派村民来钓鱼吧');
  } else if (id === 'hunt') {
    entry.pasture = { deer: [], respawnDay: 0 };
    spawnDeer(entry, 1 + (Math.random() < .5 ? 1 : 0));    // 村缘 1-2 只鹿
  }
}
function spawnDeer(entry, n) {
  for (let i = 0; i < n; i++) {
    const d = buildDeer();
    const ang = Math.random() * Math.PI * 2;
    d.position.set(entry.inst.position.x + Math.cos(ang) * (2 + Math.random() * 1.5), 0,
                   entry.inst.position.z + Math.sin(ang) * (2 + Math.random() * 1.5));
    d.userData.home = entry;
    addAnimal(d, entry);
    entry.pasture.deer.push(d);
  }
}

/* ---- 捡蛋完成（sim.js 调用） ---- */
export function eggCollected(v) {
  const e = v.task.target, p = e.pasture;
  if (!p || !p.eggReady) return;
  p.eggReady = false;
  spawnDrop('food', EGG_FOOD, e.inst.position);
  floatText('🥚 +' + EGG_FOOD + ' 食', e.inst.position);
}
/* ---- 狩猎完成（sim.js 调用）：鹿消失，3 天后刷新 ---- */
export function huntDone(v) {
  const deer = v.task.target, entry = deer.userData.home;
  if (!deer.userData.aliveKill) {
    deer.userData.aliveKill = true;
    spawnDrop('food', HUNT_FOOD, deer.position);
    spawnDrop('stone', HUNT_STONE, deer.position);
    floatText('🏹 +' + HUNT_FOOD + ' 食 +' + HUNT_STONE + ' 石', deer.position);
    scene.remove(deer);
    const ai = allAnimals.findIndex(a => a.mesh === deer);
    if (ai >= 0) allAnimals.splice(ai, 1);
    if (entry && entry.pasture) {
      entry.pasture.deer = entry.pasture.deer.filter(x => x !== deer);
      entry.pasture.respawnDay = G.day + DEER_RESPAWN;
    }
  }
}

/* ---- 每帧：动物游走 / 产蛋计时 / 自动派工（捡蛋+狩猎）/ 鹿刷新 ---- */
G._pasT = 0;
export function stepPasture(dt) {
  const winter = seasonOf(G.day) === '冬';
  cullRemoved();
  const coops = G.placed.filter(p => p.def.id === 'coop');
  const hunts = G.placed.filter(p => p.def.id === 'hunt');
  // 动物游走（含已拆除建筑的清理）
  for (const e of coops) for (const c of e.pasture.birds) roamAnimal(c, dt, e.inst.position, .9, .35);
  for (const e of hunts) {
    for (let i = e.pasture.deer.length - 1; i >= 0; i--) {
      const d = e.pasture.deer[i];
      roamAnimal(d, dt, e.inst.position, 2.5, .8);
    }
    if (e.pasture.respawnDay && G.day >= e.pasture.respawnDay) {   // 3 天后刷新新鹿
      e.pasture.respawnDay = 0;
      spawnDeer(e, 1);
      floatText('🦌 野鹿回来了', e.inst.position);
    }
  }
  // 产蛋：每天白天一次，冬季停产
  if (!winter && G.time > DAY_SECONDS * .25) {
    for (const e of coops) {
      if (e.pasture.lastDay === G.day || e.pasture.eggReady) continue;
      e.pasture.lastDay = G.day; e.pasture.eggReady = true;
      floatText('🥚 母鸡下蛋了', e.inst.position);
    }
  }
}

/* ---- 产蛋/狩猎 JobSource：jobs.js 每 1.5s 轮询（原 stepPasture 内部计时器逻辑平移） ---- */
registerJobs({
  id: 'pasture-egg-hunt',
  scan() {
    for (const e of G.placed) {
      if (e.def.id === 'coop') {
        if (!e.pasture.eggReady) continue;
        if (G.villagers.some(v => v.task && v.task.kind === 'egg' && v.task.target === e)) continue;
        if (nearestIdle(e)) return { kind: 'egg', target: e };
      } else if (e.def.id === 'hunt') {
        const deer = e.pasture.deer[0];
        if (!deer) continue;
        if (G.villagers.some(v => v.task && v.task.kind === 'hunt' && v.task.target === deer)) continue;
        if (nearestIdle(e)) return { kind: 'hunt', target: deer, at: e };
      }
    }
    return null;
  },
});

/* ---- S25 存档补全：恢复畜牧状态（蛋/鹿计时、鹿数量），save.js 调用 ---- */
export function pastureRestore(list) {
  (list || []).forEach((s, i) => {
    const p = G.placed.filter(q => q.pasture)[i];
    if (!p || p.def.id !== s.id) return;
    if (p.pasture.birds) { p.pasture.eggReady = !!s.e; p.pasture.lastDay = s.ld || G.day; }
    if (p.pasture.deer) { p.pasture.respawnDay = s.rd || 0; const ex = (s.dn || 1) - p.pasture.deer.length; if (ex > 0) spawnDeer(p, ex); while (p.pasture.deer.length > (s.dn || 1)) { const d = p.pasture.deer.pop(); scene.remove(d); const ai = allAnimals.findIndex(a => a.mesh === d); if (ai >= 0) allAnimals.splice(ai, 1); } }
  });
}

/* ---- 点击面板：仿 initFarm 装饰器注入状态文案 ---- */
export function initPasture() {
  if (!ctx.UI || ctx.UI.__pastureHooked) return;
  const orig = ctx.UI.showBuildingInfo.bind(ctx.UI);
  ctx.UI.showBuildingInfo = entry => {
    orig(entry);
    if (!entry.pasture) return;
    const el = document.getElementById('info');
    const del = document.getElementById('btn-del');
    if (!el || !del) return;
    const row = document.createElement('div');
    if (entry.def.id === 'coop') {
      const p = entry.pasture;
      const winter = seasonOf(G.day) === '冬';
      row.innerHTML = `🐔 鸡况：${winter ? '❄ 冬季停产（开春恢复）' : p.eggReady ? '🥚 有蛋待捡——村民会自动来收' : '母鸡觅食中（每天白天产蛋 +3 食）'}`;
    } else if (entry.def.id === 'hunt') {
      row.innerHTML = `🦌 猎况：野外有 ${entry.pasture.deer.length} 只鹿。空闲村民会自动狩猎（+${HUNT_FOOD} 食 +${HUNT_STONE} 石），被捕的鹿 ${DEER_RESPAWN} 天后刷新`;
    }
    if (row.innerHTML) { el.insertBefore(row, del); }
  };
  ctx.UI.__pastureHooked = true;
}
