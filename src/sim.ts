/* =====================================================================
 * 10. 模拟 —— 村民行为步进、经济、日程、夜晚结算
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, RES_INFO, CARRY_CAP, RECIPES, isWinterDay, seasonOf, SEASON_DAYS, YEAR_DAYS, MILESTONES, EVENTS, isMarketDay, TRAITS, FESTIVALS, traitOf } from './config';
import { ICONS } from './icons';
const carryCap = v => CARRY_CAP + (traitOf(v).carryBonus || 0);
import { scene } from './scene';
import { G, houseCapacity } from './world';
import { cellFree, findPath, losFree } from './pathfinding';
import { chopDone, regrow } from './nature';
import { spawnVillagers, animWalk, animWork, animIdle } from './villagers';
import { spawnDrop, carryTotal, startDeliver, findDepot, deliverCarry, floatText, chopFX } from './drops';
import { updateSiteVisuals, finishSite } from './buildings';
import { FARM_WORK, harvestDone } from './farm';
import { eggCollected, huntDone } from './pasture';
import { depositEfficiency, productionBoost } from './storage';
import { tryEquip, toolMul, maybeBreakTool, needsTool, ensureToolStock, updateBasket } from './tools';
import { Repute, gainExp, skillMul } from './repute';
import { ctx } from './context';

/* =====================================================================
 * S23 疾病系统：冻伤 →（次日）→ 生病 →（3 天自愈 / 诊所治愈）
 *   冻伤：冬季燃料不足的夜里随机 1-2 名村民冻伤，效率 ×0.75
 *   生病：效率 ×0.5；人数 ≥2 触发流行病（全体效率再 ×0.9，每晚快乐 -1）
 * ===================================================================*/
export const SICK_MUL = 0.5, FROST_MUL = 0.75, EPIDEMIC_MUL = 0.9, SICK_DAYS = 3;
/* 疾病效率系数：生病优先于冻伤；流行病再乘全体衰减（温和惩罚） */
function illnessMul(v) {
  return (v.sick ? SICK_MUL : v.frostbite ? FROST_MUL : 1) * (G.sickCount >= 2 ? EPIDEMIC_MUL : 1);
}
/* 头顶绿色小状态点（动态加/删节点，不动 villagers.js） */
const dotGeo = new THREE.SphereGeometry(.09, 8, 6);
const dotMat = new THREE.MeshBasicMaterial({ color: 0x66d06a });
function updateSickDots() {
  for (const v of G.villagers) {
    if (v.sick && !v._sickDot) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.y = 1.55;                 // 村民模型头顶（wrap 局部坐标，随整体缩放）
      v.obj.add(dot);
      v._sickDot = dot;
    } else if (!v.sick && v._sickDot) {
      v.obj.remove(v._sickDot); v._sickDot = null;
    }
  }
}
/* 夜间疾病结算：冻伤转病 → 诊所治病 → 自愈倒计时 → 流行病判定 */
function stepDisease() {
  for (const v of G.villagers) {
    if (v.frostbite) { v.frostbite = false; v.sick = true; v.sickT = SICK_DAYS; ctx.toast(`🤒 ${v.name} 的冻伤恶化成了病，需要休息或就医`); }
  }
  // 诊所升级：有村民在岗（被指派到诊所做工）时，每天治愈 1 名病人
  const clinicStaffed = G.placed.some(p => p.def.id === 'clinic') &&
    G.villagers.some(v => v.task && v.task.kind === 'work' && v.task.target && v.task.target.def && v.task.target.def.id === 'clinic');
  if (clinicStaffed) {
    const patient = G.villagers.find(v => v.sick);
    if (patient) { patient.sick = false; patient.sickT = 0; ctx.toast(`💊 诊所治好了 ${patient.name} 的病`); }
  }
  for (const v of G.villagers) {
    if (!v.sick) continue;
    if (--v.sickT <= 0) { v.sick = false; ctx.toast(`😊 ${v.name} 痊愈了`); }
  }
  G.sickCount = G.villagers.filter(v => v.sick).length;
  if (G.sickCount >= 2) {
    G.happy -= 1;
    ctx.toast(`🤢 流行病！${G.sickCount} 名村民病倒了（全体效率 ×0.9，快乐 -1，诊所可治病）`);
  }
  updateSickDots();
}
/* ---- S14 堆肥箱：肥料状态下的堆肥箱给 10 格内农田 +15% 产出（farm.js 收割处读取） ---- */
const COMPOST_RANGE = 10, COMPOST_BOOST = 1.15;
G.farmYieldMul = entry => {
  for (const p of G.placed) {
    if (p.def.id !== 'compost' || !p.fert) continue;
    if (Math.hypot(p.x - entry.x, p.z - entry.z) <= COMPOST_RANGE) return COMPOST_BOOST;
  }
  return 1;
};
/* 每 2 天：每个堆肥箱消耗 3 食保持肥料状态；无粮则失效（温和，不倒扣） */
function stepCompost() {
  if (G.day % 2 !== 0) return;
  for (const p of G.placed) {
    if (p.def.id !== 'compost') continue;
    if (G.res.food >= 3) { G.res.food -= 3; if (!p.fert) ctx.toast('🍃 堆肥箱开始沤肥：10 格内农田产出 +15%'); p.fert = true; }
    else p.fert = false;
  }
}

export function stepVillager(v, dt, t) {
  const speed = 1.5;
  ensureToolStock();                                   // S9 开局/旧档补发 2 件工具
  updateBasket(v, carryTotal);                         // S36 背篓显隐与大小
  // 路过掉落物顺手拾取
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    if (carryTotal(v) < carryCap(v) && Math.hypot(d.x - v.obj.position.x, d.z - v.obj.position.z) < .8) {
      v.carry[d.res] = (v.carry[d.res] || 0) + d.amt;
      scene.remove(d.mesh);
      G.drops.splice(i, 1);
      floatText('+' + d.amt + ' ' + (ICONS[d.res] || ''), v.obj.position);
    }
  }
  // 携满（任意任务中）→ 立即送货
  if (v.task && v.task.kind !== 'deliver' && carryTotal(v) >= carryCap(v)) {
    if (v.task.kind === 'chop' && v.task.target.alive) v.resume = { kind: 'chop', target: v.task.target };
    startDeliver(v);
  }
  // 闲置且附近有掉落物 → 主动去捡
  if (!v.task && carryTotal(v) < carryCap(v)) {
    let near = null, nd = 8;
    for (const d of G.drops) {
      const dist = Math.hypot(d.x - v.obj.position.x, d.z - v.obj.position.z);
      if (dist < nd) { nd = dist; near = d; }
    }
    if (near) v.task = { kind: 'fetch', target: near };
    else if (carryTotal(v) > 0) startDeliver(v);      // 没更多掉落物了，把货送了
  }
  // 砍伐目标耗尽且身上有货 → 送去入库（完事回来继续砍）
  if (v.task && v.task.kind === 'chop' && carryTotal(v) > 0 && (carryTotal(v) >= carryCap(v) || !v.task.target.alive)) {
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
    } else if (v.task.kind === 'harvest') {
      if (!G.placed.includes(v.task.target) || v.task.target.farm.state === 'fallow') { v.task = null; }
      else { dest = v.task.target.inst.position; arriveR = 2.3; }
    } else if (v.task.kind === 'egg') {                 // S17 捡蛋：目标鸡舍
      if (!G.placed.includes(v.task.target)) { v.task = null; }
      else { dest = v.task.target.inst.position; arriveR = 1.4; }
    } else if (v.task.kind === 'hunt') {                // S15 狩猎：目标活鹿
      if (!v.task.target.parent) { v.task = null; }
      else { dest = v.task.target.position; arriveR = 1.2; }
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
    v.task.workT += dt * (traitOf(v).workMul || 1) * skillMul(v, 'work') * illnessMul(v);
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
  const sKey = v.task.kind === 'chop' ? 'chop' : v.task.kind === 'harvest' ? 'harvest' : 'work';
  tryEquip(v);                                         // S9 采集/收割/狩猎到岗自动装备工具
  v.task.workT += dt * (traitOf(v).workMul || 1) * skillMul(v, sKey) * illnessMul(v) * (needsTool(v.task.kind) ? toolMul(v) : 1);
  animWork(v, t);
  if (v.task.workT >= (v.task.target.def.work || FARM_WORK)) {
    v.task.workT = 0;
    const doneKind = v.task.kind;                      // S9：完成后判定工具损耗
    if (sKey !== 'work') gainExp(v, sKey);   // S35 采集/收割完成 → 经验 +1（做工按天结算）
    if (v.task.kind === 'chop') {
      const node = v.task.target;
      // 冬季野外食物大减（浆果/蘑菇凋零），木石照常——冬天砍柴更重要
      const amt = (node.def.yield === 'food' && isWinterDay(G.day)) ? Math.max(1, node.def.amt - 1) : node.def.amt;
      // S22 远途损耗：远离仓库/村中心的采集点，food 类落地产量按效率折算（期望值四舍五入）
      const q = amt * depositEfficiency(node.inst.position.x, node.inst.position.z, node.def.yield);
      spawnDrop(node.def.yield, Math.random() < q % 1 ? Math.ceil(q) : Math.floor(q), node.inst.position);
      chopFX(node.inst, node.def.yield);              // 木屑/碎石 + 目标晃动
      chopDone(node);
    } else if (v.task.kind === 'harvest') {
      harvestDone(v); v.task = null;
    } else if (v.task.kind === 'egg') {                 // S17 捡蛋完成
      eggCollected(v); v.task = null;
    } else if (v.task.kind === 'hunt') {                // S15 狩猎完成：+食+石，鹿消失
      huntDone(v); v.task = null;
    }
    if (needsTool(doneKind)) maybeBreakTool(v);   // S9 完成 20% 概率工具损坏
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
  const winter = isWinterDay(G.day);
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
  const winter = isWinterDay(G.day);
  for (const p of G.placed) {
    const rc = RECIPES[p.def.id];
    if (!rc) continue;
    const n = G.villagers.filter(v => v.task && v.task.kind === 'work' && v.task.target === p).length;
    if (!n) { p.prodT = 0; continue; }
    // 冬季作坊效率减半（室内活，不至于像露天那样 ×0.3）
    p.prodT = (p.prodT || 0) + dt * Math.min(n, 2) * (winter ? 0.5 : 1);
    while (p.prodT >= rc.time) {
      if (!Object.entries(rc.in).every(([r, v]) => G.res[r] >= v)) { p.prodT = rc.time; break; }   // 缺原料：保持满格待料
      Object.entries(rc.in).forEach(([r, v]: [string, number]) => G.res[r] -= v);
      // S22：仓库 8 格内生产 +10%；food 类成品（面包）还需过入库效率
      Object.entries(rc.out).forEach(([r, v]: [string, number]) => {
        const q = v * productionBoost(p.inst.position.x, p.inst.position.z) * depositEfficiency(p.inst.position.x, p.inst.position.z, r);
        G.res[r] = (G.res[r] || 0) + (Math.random() < q % 1 ? Math.ceil(q) : Math.floor(q));
      });
      p.prodT -= rc.time;
      const [res, amt] = Object.entries(rc.out)[0];
      floatText('+' + amt + ' ' + (ICONS[res] || ''), p.inst.position);
    }
  }
}
/* ---- 设施加成汇总（喷泉/澡堂/学堂/灯塔/晾晒场等 role:'happy'） ---- */
function decorBonus() {
  return G.placed.filter(p => p.def.role === 'happy').reduce((s, p) => s + (p.def.add || 0), 0);
}
export function nightSettlement() {
  const winter = isWinterDay(G.day);
  stepCompost();                                       // S14 堆肥箱：每 2 天 3 食换肥料状态
  const pop = G.villagers.length;
  const glutton = G.villagers.filter(x => traitOf(x).extraFood).length;
  let need = pop * (winter ? 2 : 1) + glutton;       // 冬季饭量加倍；口馋村民多吃一份
  const eatBread = Math.min(G.res.bread || 0, need);   // 面包优先上桌，省下生食
  G.res.bread -= eatBread; need -= eatBread;
  let fed = true;                                      // S39 声望：全村温饱判定
  if (G.res.food >= need) G.res.food -= need;
  else {
    fed = false;
    G.res.food = 0; G.happy -= 15;
    // 诊所：一半概率把要走的村民劝住
    if (G.placed.some(p => p.def.id === 'clinic') && Math.random() < 0.5) {
      G.happy += 5;
      ctx.toast('🏥 诊所熬过难关，村民留了下来');
    } else {
      const leaver = G.villagers.pop();
      if (leaver) { scene.remove(leaver.obj); G.selected.delete(leaver); ctx.toast(`😢 ${leaver.name} 饿坏了，离开了村庄`); }
    }
  }
  if (winter) {
    // 冬季燃料：每人烧 1 木/天，篝火旁过冬省一半
    const fire = G.placed.some(p => p.def.id === 'campfire');
    const fuelNeed = Math.ceil(G.villagers.length * (fire ? 0.5 : 1));
    if (G.res.wood >= fuelNeed) G.res.wood -= fuelNeed;
    else {
      fed = false;
      G.res.wood = 0; G.happy -= G.placed.some(p => p.def.id === 'bathhouse') ? 6 : 12;   // 澡堂：暖身更抗冻
      ctx.toast(`🥶 燃料不足，村民受冻${G.placed.some(p => p.def.id === 'bathhouse') ? '（澡堂帮大家缓了缓）' : '（快乐 -12，建篝火可省一半木柴）'}`);
      // S23 冻伤：燃料短缺的寒夜，随机 1-2 名健康村民冻伤（次日转生病）
      const healthy = G.villagers.filter(v => !v.frostbite && !v.sick);
      const n = Math.min(healthy.length, 1 + Math.floor(Math.random() * 2));
      for (let i = 0; i < n; i++) healthy.splice(Math.floor(Math.random() * healthy.length), 1)[0].frostbite = true;
    }
    G.happy -= 6;
  } else G.happy = Math.min(100, G.happy + 4 + Math.round(decorBonus() * 0.2));   // 装饰设施：每天小幅回情绪
  stepDisease();                                       // S23 冻伤转病 / 诊所治病 / 自愈 / 流行病
  const roll = Math.random();
  const guarded = G.placed.some(p => p.def.role === 'tower' || p.def.id === 'watchpost');
  if (roll < 0.22 && G.day >= 3) {
    if (!guarded) {
      const loss = Math.min(G.res.food, 4 + Math.floor(Math.random() * 4));
      G.res.food -= loss;
      ctx.toast(`🐺 狼群偷粮！损失 ${loss} 食（建瞭望塔可防）`);
    } else ctx.toast('🐺 狼群被哨塔吓退了');
  } else if (roll < (0.5 - 0.1 * Repute.immigrantMul()) && houseCapacity() > G.villagers.length && G.res.food >= G.villagers.length) {   // S39 声望≥40：移民间隔 ×0.7
    spawnVillagers(1);
    ctx.toast(`🎉 旅行者加入村庄（现 ${G.villagers.length} 人）`);
  } else if (roll < 0.5) { G.res.wood += 3; ctx.toast('🌊 河水送来浮木 +3 木'); }
  // 鸽房：每晚落 2 蛋换粮（冬天 1），受粮仓上限约束
  const dove = G.placed.filter(p => p.def.id === 'dovecote').length;
  if (dove) G.res.food = Math.min(G.foodCap, G.res.food + (winter ? 1 : 2) * dove);
  // S35：在岗做工每天经验 +1；学堂（学校）在岗时每 2 天随机 1 名村民经验 +5
  for (const v of G.villagers) if (v.task && v.task.kind === 'work') gainExp(v, 'work');
  if (G.placed.some(p => p.def.id === 'school') && G.day % 2 === 0 && G.villagers.length) {
    const sv = G.villagers[Math.floor(Math.random() * G.villagers.length)];
    const keys = Object.keys(sv.skills || {});
    gainExp(sv, keys.length ? keys[Math.floor(Math.random() * keys.length)] : 'work', 5);
  }
  G._nightFed = fed;   // S39：供 main.js 里 Repute.nightly 夜间声望结算
  G.happy = Math.max(0, G.happy);
  G.day++;
  regrow();
  const din = ((G.day - 1) % YEAR_DAYS) + 1;
  if (din === 1 && G.day > 1) { G.year++; ctx.toast('🌸 新的一年开始了——第 ' + G.year + ' 年'); }
  if (seasonOf(G.day) === '冬' && seasonOf(G.day - 1) !== '冬') ctx.toast('❄ 冬天来了！露天产出大减，温室/囤粮是关键');
  else if (din === SEASON_DAYS * 3) {
    // 入冬前一天：官网口径的过冬判定（柴≥8/人 且 粮≥5/人）
    const p = G.villagers.length;
    const ok = G.res.wood >= p * 8 && G.res.food >= p * 5;
    ctx.toast(ok
      ? `❄ 明日入冬：储备达标（柴 ${Math.floor(G.res.wood)}/需${p * 8}，粮 ${Math.floor(G.res.food)}/需${p * 5}），稳了`
      : `⚠ 明日入冬：储备不足！建议 柴≥${p * 8} 粮≥${p * 5}（现 柴 ${Math.floor(G.res.wood)}，粮 ${Math.floor(G.res.food)}）`);
  }
  const din2 = ((G.day - 1) % YEAR_DAYS) + 1;
  if (din2 % SEASON_DAYS === 1) {
    const bonus = G.placed.some(p => p.def.id === 'campfire') ? 14 : 10;
    G.happy = Math.min(100, G.happy + bonus);
    ctx.toast(`🎉 ${FESTIVALS[seasonOf(G.day)]}！全村欢聚一堂（快乐 +${bonus}` + (bonus > 10 ? '，篝火添了彩' : '') + '）');
    Repute.add(3, '举办节日');   // S39 节日声望
  }
  const sunny = G.villagers.filter(x => traitOf(x).sunny).length;
  if (sunny) G.happy = Math.min(100, G.happy + sunny);
  if (isMarketDay(G.day)) ctx.toast('🧳 行商到访！今天去市集可以买卖货物');
  if (Math.random() < 0.3 && ctx.UI && ctx.UI.showEvent) ctx.UI.showEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
  checkMilestones();
  if (!G.over && G.villagers.length < 3) { endGame(false); return; }
  ctx.UI && ctx.UI.refresh();
}
function endGame(win) {
  G.over = true;
  document.getElementById('end').style.display = 'flex';
  if (win) {
    document.getElementById('end-title').textContent = '🏆 繁荣的暖境边陲';
    document.getElementById('end-desc').textContent = `全部里程碑达成！第 ${G.year} 年，人口 ${G.villagers.length}，快乐 ${Math.round(G.happy)}。这座村庄成了边陲的传奇。`;
  } else {
    document.getElementById('end-title').textContent = '🥀 村庄衰落了';
    document.getElementById('end-desc').textContent = `第 ${G.year} 年，村民越来越少，大家收拾行囊离开了边陲。囤粮、燃料与快乐，缺一不可。`;
  }
}
/* ---- 里程碑检查：达成 +8 快乐，全达成繁荣终局 ---- */
function checkMilestones() {
  for (const m of MILESTONES) {
    if (G.milestones.has(m.id)) continue;
    let ok = false;
    if (m.type === 'place') ok = G.placed.some(p => p.def.id === m.id2);
    else if (m.type === 'res') ok = (G.res[m.key] || 0) >= m.n;
    else if (m.type === 'tech') ok = G.tech.size >= m.n;
    else if (m.type === 'pop') ok = G.villagers.length >= m.n;
    else if (m.type === 'year') ok = (G.year || 1) >= m.n;
    if (ok) { G.milestones.add(m.id); G.happy = Math.min(100, G.happy + 8); Repute.add(8, '达成里程碑【' + m.name + '】'); ctx.toast('🏆 里程碑达成【' + m.name + '】：' + m.desc + '（快乐 +8）'); }
  }
  if (G.milestones.size >= MILESTONES.length) endGame(true);
}
