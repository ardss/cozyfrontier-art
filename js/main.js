/* =====================================================================
 * 12. 启动与主循环（模块装配入口：注入跨模块引用 → 等资产 → 开局 → loop）
 * ===================================================================*/
import * as THREE from 'three';
import { DAY_SECONDS, GRID } from './config.js';
import { mainEl, renderer, scene, cam, camCtl } from './scene.js';
import { G } from './world.js';
import { cellFree } from './pathfinding.js';
import { scatterNature } from './nature.js';
import { spawnVillagers } from './villagers.js';
import { stepDrops, stepFX } from './drops.js';
import { stepDropAnims, stepSites } from './buildings.js';
import { stepFarm, initFarm } from './farm.js';
import { stepVillager, productionPerDay, nightSettlement, stepProduction } from './sim.js';
import { stepCameraKeys, Input, startPlacing } from './input.js';
import { UI, toast } from './ui.js';
import { Stats } from './stats.js';
import { ctx } from './context.js';
import { onAssetsLoaded, assetsReady } from './assets.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { gameState, setupControls } from './controls.js';
import { stepWeather } from './weather.js';
import { Sfx } from './audio.js';

// —— 主模块注入：ui/input/buildings/sim 通过 ctx 反向调用，避免循环依赖 ——
ctx.UI = UI;
ctx.Input = Input;
ctx.toast = toast;
ctx.startPlacing = startPlacing;
initFarm();                                         // 农田系统：信息面板钩子（S7）
setupControls();
document.getElementById('btn-tech').onclick = () => UI.toggleTech();
document.getElementById('hudres').addEventListener('click', e => {
  if (e.target.closest('#popchip')) UI.togglePeople();
  if (e.target.closest('#statchip')) Stats.toggle();
});
(function menuCam() {                                  // 菜单机位：环绕 + 俯瞰（开始后 body.playing 接管）
  if (!document.body.classList.contains('playing')) {
    menuCam.t = (menuCam.t || 0) + 0.0006;
    camCtl.theta = Math.PI * 0.15 + Math.sin(menuCam.t) * 0.9;
    camCtl.phi = Math.PI * 0.27;
    camCtl.r = 20;
    camCtl.target.set(GRID / 2, 0, GRID / 2);
    camCtl.apply();
  }
  requestAnimationFrame(menuCam);
})();

let nightTick = () => { };           // 下方包装为"夜间结算 + 自动存档"（不改 sim.js）
(function () {
  const raw = nightSettlement;
  nightTick = (...a) => { raw(...a); Sfx.night(); if (!G.over) saveGame(); };
})();
function startGame() {
  UI.initSidebar();
  scatterNature();

  spawnVillagers(3);
  UI.startThumbs();
  UI.refresh();
  if (hasSave()) document.getElementById('btn-continue').hidden = false;
  toast('🍂 开局：先在侧栏点【村中心】放到地上，村民会自动去建造。然后框选村民 → 框选树/浆果 = 自动采集');
}
onAssetsLoaded(startGame);
if (assetsReady()) startGame();

// —— 主菜单：镜头绕村庄慢速环绕，点击开始后回到游戏机位；继续游戏则读档重建 ——
const introEl = document.getElementById('intro');
function enterGame(continueSave) {
  introEl.style.display = 'none';
  document.body.classList.add('playing');
  camCtl.theta = Math.PI * 0.15; camCtl.phi = Math.PI * 0.34; camCtl.r = 26;
  camCtl.target.set(GRID / 2, 0, GRID / 2);
  camCtl.apply();
  if (continueSave) { if (assetsReady()) loadGame(); else onAssetsLoaded(loadGame); }
  ctx.toast && ctx.toast('🍂 先建【村中心】，村民会自动去建造。框选一片树，空闲村民会自己去砍！');
}
document.getElementById('btn-start').onclick = () => { Sfx.init(); enterGame(false); };
document.getElementById('btn-continue').onclick = () => { Sfx.init(); enterGame(true); };
const sfxBtn = document.getElementById('btn-sfx');
if (sfxBtn) {
  sfxBtn.onclick = () => sfxBtn.textContent = '声音:' + (Sfx.toggleMuted() ? '关' : '开');
  sfxBtn.textContent = '声音:' + (Sfx.muted ? '关' : '开');
}

function resize() {
  const w = mainEl.clientWidth, h = mainEl.clientHeight;
  renderer.setSize(w, h);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
camCtl.apply();
resize();

const clock = new THREE.Clock();
window.__G = G;                                     // 调试桥
window.__camCtl = camCtl;
(function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  const gdt = G.over ? 0 : gameState.paused ? 0 : dt * gameState.speed;   // 暂停/倍速只影响模拟（结束/暂停时冻结）
  if (!G.over) {
    G.time += gdt;
    const p = productionPerDay();
    G.res.wood += p.wood * gdt / DAY_SECONDS;
    G.res.food = Math.min(G.foodCap, G.res.food + p.food * gdt / DAY_SECONDS);
    if (G.time >= DAY_SECONDS) { G.time = 0; nightTick(); }
    if (gdt > 0) {                                    // 暂停：村民动作与工位停摆
      for (const v of G.villagers) stepVillager(v, gdt, t);
      stepProduction(gdt);
    }
    // 村民间软碰撞：重叠时互相推开，避免叠在一起
    for (let i = 0; i < G.villagers.length; i++) for (let j = i + 1; j < G.villagers.length; j++) {
      const a = G.villagers[i].obj.position, b = G.villagers[j].obj.position;
      const ddx = b.x - a.x, ddz = b.z - a.z, dd = Math.hypot(ddx, ddz);
      if (dd > 0 && dd < .45) {
        const push = (.45 - dd) / 2;
        const ax = a.x - ddx / dd * push, az = a.z - ddz / dd * push;
        const bx = b.x + ddx / dd * push, bz = b.z + ddz / dd * push;
        if (cellFree(Math.floor(ax), Math.floor(az))) { a.x = ax; a.z = az; }
        if (cellFree(Math.floor(bx), Math.floor(bz))) { b.x = bx; b.z = bz; }
      }
    }
    if (Math.floor(t * 2) !== G._uiT) { G._uiT = Math.floor(t * 2); UI.refresh(); }
    if (Math.floor(t) !== G._statT) { G._statT = Math.floor(t); Stats.render(); }   // 总览面板每秒刷新（未打开时内部直返）
  }
  stepCameraKeys();
  stepDropAnims(dt);
  stepDrops(dt, t);
  stepFX(dt);
  if (!G.over) stepSites(dt);
  if (!G.over) stepFarm(gdt);
  if (!G.over) stepWeather(gdt);
  renderer.render(scene, cam);
})();
