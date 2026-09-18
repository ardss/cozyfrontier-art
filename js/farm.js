/* =====================================================================
 * 13. 农田 —— 开垦→播种→生长→收获循环（S7）
 *     状态机：grow(stage 0..2) → ready → (收割) → grow
 *             winter: → dead → (来年春自动) → grow；玩家可切 fallow
 *     视觉：3×3 耕地块 + 每格一簇作物（锥体×3），阶段=颜色/高度渐变
 * ===================================================================*/
import * as THREE from 'three';
import { seasonOf, YEAR_DAYS, SEASON_DAYS } from './config.js';
import { scene } from './scene.js';
import { G } from './world.js';
import { protos } from './assetsv2.js';
import { command } from './villagers.js';
import { spawnDrop, floatText } from './drops.js';
import { ctx } from './context.js';

export const FARM_WORK = 3;                 // 收割工作时长（秒）
const HARVEST_FOOD = 6;                     // 每块田收获粮食
const STAGE_SECS = [30, 35, 35];            // 阶段 0→1→2→成熟，共 100s ≈ 2 天
const STAGE_H = [0.10, 0.22, 0.34, 0.46];   // 各阶段作物高度
const STAGE_COLORS = [0x8fbf6a, 0x9cc254, 0xc2b04a, 0xe3b84c];   // 苗绿→金黄
const DEAD_COLOR = 0x9a8f80, SOIL_A = 0x6b4a2e, SOIL_B = 0x7a5636;

/* ---- 农田原型：3×3 深耕土垄（程序化低多边形，无需 GLB） ---- */
const soilGeo = new THREE.BoxGeometry(.96, .06, .96);
const soilMatA = new THREE.MeshLambertMaterial({ color: SOIL_A });
const soilMatB = new THREE.MeshLambertMaterial({ color: SOIL_B });
function buildFarmProto() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const m = new THREE.Mesh(soilGeo, (i + j) % 2 ? soilMatA : soilMatB);
    m.position.set(i - 1, .03, j - 1);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}
protos.farm = buildFarmProto();     // 资产管线里 wc-farm-paint.glb 不存在（404 一次，忽略即可）

/* ---- 作物簇：每格 3 株锥体 + 成熟期的穗 ---- */
const stalkGeo = new THREE.ConeGeometry(.055, 1, 5);
const earGeo = new THREE.BoxGeometry(.05, .12, .05);
function buildCropCluster() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: STAGE_COLORS[0] });
  const stalks = [];
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(stalkGeo, mat);
    s.position.set((k - 1) * .18 + (Math.random() - .5) * .08, 0, (Math.random() - .5) * .2);
    s.castShadow = true;
    grp.add(s); stalks.push(s);
  }
  const ear = new THREE.Mesh(earGeo, mat);
  ear.position.set(0, .5, 0); ear.visible = false;
  grp.add(ear);
  grp.userData = { mat, stalks, ear, phase: Math.random() * Math.PI * 2 };
  return grp;
}
function updateCrops(entry) {
  const f = entry.farm;
  if (!entry.crops) return;
  const dead = f.state === 'dead', ready = f.state === 'ready';
  const si = ready ? 3 : Math.min(f.stage, 2);
  const col = new THREE.Color(dead ? DEAD_COLOR : STAGE_COLORS[si]);
  const h = dead ? STAGE_H[1] * .7 : STAGE_H[si];
  for (const c of entry.crops.children) {
    const u = c.userData;
    u.mat.color.copy(col);
    for (const s of u.stalks) {
      s.scale.set(1, h, 1);
      s.position.y = h / 2;
      s.visible = !f.state || f.state !== 'fallow';
    }
    u.ear.visible = ready;
    u.ear.position.y = h + .06;
    c.visible = f.state === 'grow' || f.state === 'ready' || f.state === 'dead';
  }
}

/* ---- 放置钩子：buildings.js placeInstance 里对 role:'farm' 调用 ---- */
export function registerFarm(entry) {
  entry.farm = { state: 'fallow', stage: 0, t: 0, killed: false };
  const crops = new THREE.Group();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const c = buildCropCluster();
    c.position.set(i - 1, .06, j - 1);
    crops.add(c);
  }
  entry.inst.add(crops);
  entry.crops = crops;
  sow(entry, true);                     // 建好即播
}
function sow(entry, silent) {
  const f = entry.farm;
  if (f.state === 'grow' || f.state === 'ready') return;
  if (isWinterNow()) { if (!silent) ctx.toast('❄ 冬天种不下——等开春再播吧'); return; }
  f.state = 'grow'; f.stage = 0; f.t = 0; f.killed = false;
  updateCrops(entry);
  if (!silent) ctx.toast('🌱 播下谷物——春夏秋生长，成熟后村民自动收割');
}
function isWinterNow() { return seasonOf(G.day) === '冬'; }

/* ---- 收割完成（sim.js 村民工作时长达标后调用） ---- */
export function harvestDone(v) {
  const e = v.task.target, f = e.farm;
  if (!f || f.state !== 'ready') return;
  f.state = 'grow'; f.stage = 0; f.t = 0;
  updateCrops(e);
  spawnDrop('food', HARVEST_FOOD, e.inst.position);
  floatText('🌾 +' + HARVEST_FOOD + ' 食', e.inst.position);
}

/* ---- 每帧：生长推进 / 冬冻春播 / 自动派工收割 ---- */
G._farmT = 0;
export function stepFarm(dt) {
  const winter = isWinterNow();
  const din = ((G.day - 1) % YEAR_DAYS) + 1;
  const farms = G.placed.filter(p => p.def.role === 'farm');
  // 季节切换：入冬冻死（只冻有作物的），开春自动补种被冻死的
  if (din === SEASON_DAYS * 3 + 1 && !G._farmWinterDone) {         // 入冬第一天
    G._farmWinterDone = true;
    let n = 0;
    for (const e of farms) if (e.farm.state === 'grow' || e.farm.state === 'ready') {
      e.farm.state = 'dead'; e.farm.killed = true; e.farm.t = 0; updateCrops(e); n++;
    }
    if (n) ctx.toast('❄ 寒流冻坏了 ' + n + ' 块农田的作物（开春自动再播）');
  }
  if (din === 1 && !winter && G._farmWinterDone) {                 // 春季第一天
    G._farmWinterDone = false;
    let n = 0;
    for (const e of farms) if (e.farm.killed) { e.farm.killed = false; sow(e, true); n++; }
    if (n) ctx.toast('🌸 春回大地，' + n + ' 块农田自动重新播种');
  }
  // 生长推进（冬季不生长）
  if (!winter) for (const e of farms) {
    const f = e.farm;
    if (f.state !== 'grow') continue;
    f.t += dt;
    const need = STAGE_SECS[f.stage];
    if (f.t >= need) {
      f.t = 0; f.stage++;
      if (f.stage >= 3) { f.state = 'ready'; }
      updateCrops(e);
      if (f.state === 'ready') floatText('🌾 成熟了', e.inst.position);
    }
  }
  // 作物随风微摆（便宜的氛围感）
  for (const e of farms) if (e.crops && e.farm.state !== 'fallow') {
    const t = G.time;
    for (const c of e.crops.children) c.rotation.z = Math.sin(t * 1.6 + c.userData.phase) * .06;
  }
  // 自动派最近的空闲村民去收割（与工地派工同构）
  G._farmT += dt;
  if (G._farmT > 1.5) {
    G._farmT = 0;
    for (const e of farms) {
      if (e.farm.state !== 'ready') continue;
      const pickers = G.villagers.filter(v => v.task && v.task.kind === 'harvest' && v.task.target === e).length;
      if (pickers >= 1) continue;
      let near = null, nd = 1e9;
      for (const v of G.villagers) {
        if (v.task) continue;
        const d = v.obj.position.distanceTo(e.inst.position);
        if (d < nd) { nd = d; near = v; }
      }
      if (near) command(near, 'harvest', e);
    }
  }
}

/* ---- 点击农田：在现有信息面板底部追加状态与播种/休耕按钮 ---- */
const STATE_TXT = {
  grow: f => `🌱 生长中（阶段 ${f.stage + 1}/3，${Math.floor(f.t)}s）`,
  ready: () => '🌾 成熟——等待村民收割',
  dead: () => '❄ 作物冻死了（开春自动再播）',
  fallow: () => '🌙 休耕中（点击下方按钮播种）',
};
export function initFarm() {
  if (!ctx.UI || ctx.UI.__farmHooked) return;
  const orig = ctx.UI.showBuildingInfo.bind(ctx.UI);
  ctx.UI.showBuildingInfo = entry => {
    orig(entry);
    if (entry.def.role !== 'farm' || !entry.farm) return;
    const el = document.getElementById('info');
    const del = document.getElementById('btn-del');
    if (!el || !del) return;
    const row = document.createElement('div');
    const f = entry.farm;
    row.innerHTML = `🌾 田况：${STATE_TXT[f.state](f)}<br><button id="btn-farm">${f.state === 'fallow' ? '🌱 播种谷物' : '🌙 转为休耕'}</button>`;
    el.insertBefore(row, del);
    document.getElementById('btn-farm').onclick = () => {
      if (f.state === 'fallow') sow(entry, false);
      else { f.state = 'fallow'; f.killed = false; updateCrops(entry); ctx.toast('🌙 农田休耕了'); }
      ctx.UI.showBuildingInfo(entry);
    };
  };
  ctx.UI.__farmHooked = true;
}
