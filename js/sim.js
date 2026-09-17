/* =====================================================================
 * 10. 模拟 —— 村民行为步进、经济、日程、夜晚结算
 * ===================================================================*/
import { GRID, RES_INFO, CARRY_CAP, WINTER_DAY, END_DAY, RECIPES } from './config.js';
import { scene } from './scene.js';
import { G, houseCapacity } from './world.js';
import { cellFree, findPath, losFree } from './pathfinding.js';
import { chopDone, regrow } from './nature.js';
import { spawnVillagers, animWalk, animWork, animIdle } from './villagers.js';
import { spawnDrop, carryTotal, startDeliver, findDepot, deliverCarry, floatText } from './drops.js';
import { updateSiteVisuals, finishSite } from './buildings.js';
import { ctx } from './context.js';

export function stepVillager(v, dt, t) {
  const speed = 1.5;
  // 路过掉落物顺手拾取
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    if (carryTotal(v) < CARRY_CAP && Math.hypot(d.x - v.obj.position.x, d.z - v.obj.position.z) < .8) {
      v.carry[d.res] = (v.carry[d.res] || 0) + d.amt;
      scene.remove(d.mesh);
      G.drops.splice(i, 1);
      floatText('+' + d.amt + ' ' + RES_INFO[d.res].icon, v.obj.position);
    }
  }
  // 携满（任意任务中）→ 立即送货
  if (v.task && v.task.kind !== 'deliver' && carryTotal(v) >= CARRY_CAP) {
    if (v.task.kind === 'chop' && v.task.target.alive) v.resume = { kind: 'chop', target: v.task.target };
    startDeliver(v);
  }
  // 闲置且附近有掉落物 → 主动去捡
  if (!v.task && carryTotal(v) < CARRY_CAP) {
    let near = null, nd = 8;
    for (const d of G.drops) {
      const dist = Math.hypot(d.x - v.obj.position.x, d.z - v.obj.position.z);
      if (dist < nd) { nd = dist; near = d; }
    }
    if (near) v.task = { kind: 'fetch', target: near };
    else if (carryTotal(v) > 0) startDeliver(v);      // 没更多掉落物了，把货送了
  }
  // 砍伐目标耗尽且身上有货 → 送去入库（完事回来继续砍）
  if (v.task && v.task.kind === 'chop' && carryTotal(v) > 0 && (carryTotal(v) >= CARRY_CAP || !v.task.target.alive)) {
    const depot = findDepot(v);
    v.resume = v.task.target.alive ? { kind: 'chop', target: v.task.target } : null;
    v.task = depot ? { kind: 'deliver', target: depot } : { kind: 'deliver', target: { x: GRID / 2 + 1.5, z: GRID / 2 + 1.5 } };
  }
  let dest = null, arriveR = .6;
  if (v.task) {
    if (v.task.kind === 'move') { dest = v.task.target; arriveR = .25; }
    else if (v.task.kind === 'chop') {
      if (!v.task.target.alive) { v.task = null; }
      else { dest = v.task.target.inst.position; arriveR = 1.05 + (v.slot || 0); }   // 站位错开，多人可同时砍
    } else if (v.task.kind === 'work') {
      if (!G.placed.includes(v.task.target)) { v.task = null; }
      else { dest = v.task.target.inst.position; arriveR = 1.3; }
    } else if (v.task.kind === 'build') {
      if (!G.sites.includes(v.task.target)) { v.task = null; }
      else { dest = v.task.target.inst.position; arriveR = 1.5; }
    } else if (v.task.kind === 'deliver') {
      dest = v.task.target.inst ? v.task.target.inst.position : v.task.target;
      arriveR = v.task.target.inst ? 1.6 : .4;
    } else if (v.task.kind === 'fetch') {
      if (!G.drops.includes(v.task.target)) { v.task = null; }
      else { dest = v.task.target.mesh.position; arriveR = .5; }
    }
  }
  if (!dest) { animIdle(v, t); return; }
  const dx = dest.x - v.obj.position.x, dz = dest.z - v.obj.position.z;
  let dist = Math.hypot(dx, dz);
  let arrived = dist <= arriveR;
  if (!arrived) {
    // 目标变化 → 重算路径；直线有视野则直走，否则沿 A* 路点走
    const tk = v.task.kind + ':' + Math.round(dest.x * 2) + ':' + Math.round(dest.z * 2);
    if (v._pathKey !== tk) { v.path = findPath(v.obj.position.x, v.obj.position.z, dest.x, dest.z); v._pi = 0; v._pathKey = tk; }
    let tx = dest.x, tz = dest.z;
    if (v.path) {
      if (losFree(v.obj.position.x, v.obj.position.z, dest.x, dest.z)) v.path = null;
      else {
        let wp = v.path[v._pi];
        while (wp && Math.hypot(wp.x - v.obj.position.x, wp.z - v.obj.position.z) < .3) { v._pi++; wp = v.path[v._pi]; }
        if (wp) { tx = wp.x; tz = wp.z; }
        else v.path = null;
      }
    }
    const ddx = tx - v.obj.position.x, ddz = tz - v.obj.position.z;
    const dd = Math.hypot(ddx, ddz) || 1;
    const nx = v.obj.position.x + ddx / dd * speed * dt;
    const nz = v.obj.position.z + ddz / dd * speed * dt;
    if (cellFree(Math.floor(nx), Math.floor(nz)) || !cellFree(Math.floor(v.obj.position.x), Math.floor(v.obj.position.z))) {
      v.obj.position.x = nx; v.obj.position.z = nz;
    } else {
      // 撞上障碍：终点就在旁边（围着目标干活）则视为到位，否则下一帧重寻路
      if (dist < arriveR + .8) arrived = true;
      v._pathKey = null;
    }
    v.obj.rotation.y = Math.atan2(ddx, ddz);
  }
  if (!arrived) { animWalk(v, t); return; }
  v._pathKey = null;
  if (v.task.kind === 'move' || v.task.kind === 'fetch') { v.task = null; return; }
  if (v.task.kind === 'build') {
    const site = v.task.target;
    v.task.workT += dt;
    site.progress += dt;
    animWork(v, t);
    updateSiteVisuals(site);
    if (site.progress >= site.need) { finishSite(site); v.task = null; }
    return;
  }
  if (v.task.kind === 'deliver') {
    deliverCarry(v);
    v.task = v.resume && v.resume.target.alive ? { kind: 'chop', target: v.resume.target, workT: 0 } : null;
    v.resume = null;
    return;
  }
  v.task.workT += dt;
  animWork(v, t);
  if (v.task.workT >= v.task.target.def.work) {
    v.task.workT = 0;
    if (v.task.kind === 'chop') {
      const node = v.task.target;
      // 冬季野外食物大减（浆果/蘑菇凋零），木石照常——冬天砍柴更重要
      const amt = (node.def.yield === 'food' && G.day >= WINTER_DAY) ? Math.max(1, node.def.amt - 1) : node.def.amt;
      spawnDrop(node.def.yield, amt, node.inst.position);
      chopDone(node);
    }
    // 'work'：建筑产出走天结算，出勤即可
  }
}

/* ---- 经济与夜晚结算 ---- */
function houseHappiness() {
  const houses = G.placed.filter(p => p.def.role === 'house');
  const good = houses.filter(p => G.placed.some(w => w.def.role === 'well' && Math.abs(w.x - p.x) <= 6 && Math.abs(w.z - p.z) <= 6))
                     .reduce((s, p) => s + p.def.cap, 0);
  const total = houses.reduce((s, p) => s + p.def.cap, 0);
  return total ? good / total : 1;
}
export function productionPerDay() {
  let wood = 0, food = 0;
  const eff = (0.6 + G.happy / 250) * (0.5 + 0.5 * houseHappiness());
  const winter = G.day >= WINTER_DAY;
  for (const p of G.placed) {
    if (p.def.out === undefined) continue;
    const n = G.villagers.filter(v => v.task && v.task.kind === 'work' && v.task.target === p).length;
    if (!n) continue;
    const rate = winter && p.def.id !== 'greenhouse' ? 0.3 : 1;
    if (p.def.role === 'wood') wood += p.def.out * Math.min(n, 2) * eff;
    else food += p.def.out * Math.min(n, 2) * eff * rate;
  }
  return { wood, food };
}
/* ---- 配方生产：在岗村民按配方消耗库存原料 → 成品入库 ---- */
export function stepProduction(dt) {
  const winter = G.day >= WINTER_DAY;
  for (const p of G.placed) {
    const rc = RECIPES[p.def.id];
    if (!rc) continue;
    const n = G.villagers.filter(v => v.task && v.task.kind === 'work' && v.task.target === p).length;
    if (!n) { p.prodT = 0; continue; }
    // 冬季作坊效率减半（室内活，不至于像露天那样 ×0.3）
    p.prodT = (p.prodT || 0) + dt * Math.min(n, 2) * (winter ? 0.5 : 1);
    while (p.prodT >= rc.time) {
      if (!Object.entries(rc.in).every(([r, v]) => G.res[r] >= v)) { p.prodT = rc.time; break; }   // 缺原料：保持满格待料
      Object.entries(rc.in).forEach(([r, v]) => G.res[r] -= v);
      Object.entries(rc.out).forEach(([r, v]) => G.res[r] = (G.res[r] || 0) + v);
      p.prodT -= rc.time;
      const [res, amt] = Object.entries(rc.out)[0];
      floatText('+' + amt + ' ' + RES_INFO[res].icon, p.inst.position);
    }
  }
}
export function nightSettlement() {
  const winter = G.day >= WINTER_DAY;
  const pop = G.villagers.length;
  let need = pop * (winter ? 2 : 1);                 // 冬季寒冷，饭量加倍
  const eatBread = Math.min(G.res.bread || 0, need);   // 面包优先上桌，省下生食
  G.res.bread -= eatBread; need -= eatBread;
  if (G.res.food >= need) G.res.food -= need;
  else {
    G.res.food = 0; G.happy -= 15;
    const leaver = G.villagers.pop();
    if (leaver) { scene.remove(leaver.obj); G.selected.delete(leaver); ctx.toast(`😢 ${leaver.name} 饿坏了，离开了村庄`); }
  }
  if (winter) {
    // 冬季燃料：每人烧 1 木/天，篝火旁过冬省一半
    const fire = G.placed.some(p => p.def.id === 'campfire');
    const fuelNeed = Math.ceil(G.villagers.length * (fire ? 0.5 : 1));
    if (G.res.wood >= fuelNeed) G.res.wood -= fuelNeed;
    else {
      G.res.wood = 0; G.happy -= 12;
      ctx.toast(`🥶 燃料不足，村民受冻（快乐 -12，建篝火可省一半木柴）`);
    }
    G.happy -= 6;
  } else G.happy = Math.min(100, G.happy + 4);
  const roll = Math.random();
  if (roll < 0.22 && G.day >= 3) {
    if (!G.placed.some(p => p.def.role === 'tower')) {
      const loss = Math.min(G.res.food, 4 + Math.floor(Math.random() * 4));
      G.res.food -= loss;
      ctx.toast(`🐺 狼群偷粮！损失 ${loss} 食（建瞭望塔可防）`);
    } else ctx.toast('🐺 狼群被瞭望塔吓退了');
  } else if (roll < 0.4 && houseCapacity() > G.villagers.length && G.res.food >= G.villagers.length) {
    spawnVillagers(1);
    ctx.toast(`🎉 旅行者加入村庄（现 ${G.villagers.length} 人）`);
  } else if (roll < 0.5) { G.res.wood += 3; ctx.toast('🌊 河水送来浮木 +3 木'); }
  G.happy = Math.max(0, G.happy);
  G.day++;
  regrow();
  if (G.day === WINTER_DAY) ctx.toast('❄ 冬天来了！露天产出大减，温室/囤粮是关键');
  else if (G.day + 1 === WINTER_DAY) {
    // 入冬前一天：官网口径的过冬判定（柴≥8/人 且 粮≥5/人）
    const p = G.villagers.length;
    const ok = G.res.wood >= p * 8 && G.res.food >= p * 5;
    ctx.toast(ok
      ? `❄ 明日入冬：储备达标（柴 ${Math.floor(G.res.wood)}/需${p * 8}，粮 ${Math.floor(G.res.food)}/需${p * 5}），稳了`
      : `⚠ 明日入冬：储备不足！建议 柴≥${p * 8} 粮≥${p * 5}（现 柴 ${Math.floor(G.res.wood)}，粮 ${Math.floor(G.res.food)}）`);
  }
  if (G.day >= END_DAY) { endGame(); return; }
  ctx.UI && ctx.UI.refresh();
}
function endGame() {
  G.over = true;
  const pop = G.villagers.length;
  document.getElementById('end').style.display = 'flex';
  if (pop >= 3) {
    document.getElementById('end-title').textContent = '🌸 春天来了——活过了冬天！';
    document.getElementById('end-desc').textContent = `最终人口 ${pop}，余粮 ${Math.floor(G.res.food)}，快乐 ${Math.round(G.happy)}。`;
  } else {
    document.getElementById('end-title').textContent = '❄ 村庄没能撑过冬天';
    document.getElementById('end-desc').textContent = `春天只剩 ${pop} 人（需 ≥3）。多囤粮、早建温室、盯紧快乐。`;
  }
}
