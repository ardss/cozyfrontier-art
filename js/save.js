/* =====================================================================
 * 13. 存档系统（S19）—— localStorage 序列化 G 的可存部分，读档重建场景
 * 只存可重建数据（id/坐标/数值），three.js 对象在 loadGame 时用与
 * 初始生成相同的管线（placeInstance / createSite / spawnVillagers）重建。
 * ===================================================================*/
import { G, key } from './world.js';
import { scene } from './scene.js';
import { NATURE_DEFS, DEFS, TRAITS } from './config.js';
import { protos, assetsReady, onAssetsLoaded } from './assetsv2.js';
import { spawnVillagers } from './villagers.js';
import { pastureRestore } from './pasture.js';
import { placeInstance, createSite, updateSiteVisuals } from './buildings.js';
import { ctx } from './context.js';

const SAVE_KEY = 'cf_save_v1';

export const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
export const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { } };

export function saveGame() {
  try {
    const data = {
      v: 1,
      res: { ...G.res }, foodCap: G.foodCap, happy: G.happy,
      day: G.day, time: G.time, year: G.year,
      tech: [...G.tech], milestones: [...G.milestones],
      repute: G.repute || 0,
      voyage: G.voyage || null,
      autoWork: G.autoWork !== false,                                   // S39 声望（S25 补全）
      storyLog: (G.storyLog || []).slice(0, 8),                // S25 村志
      letters: G.letters || [],                                // S25 信件
      pasture: G.placed.filter(p => p.pasture).map(p => ({     // S25 畜牧状态（蛋/鹿计时、鹿数）
        id: p.def.id, e: p.pasture.eggReady ? 1 : 0, ld: p.pasture.lastDay || 0,
        dn: p.pasture.deer ? p.pasture.deer.length : 0, rd: p.pasture.respawnDay || 0,
      })),
      villagers: G.villagers.map(v => ({
        name: v.name, trait: v.trait ? v.trait.id : null, slot: v.slot,
        skills: v.skills || {}, sick: v.sick ? 1 : 0,          // S35 技能 / 生病（S25 补全）
        x: v.obj.position.x, z: v.obj.position.z,
      })),
      placed: G.placed.map(p => ({ id: p.def.id, x: p.x, z: p.z, rot: p.rot })),
      sites: G.sites.map(s => ({ id: s.def.id, x: s.x, z: s.z, rot: s.rot, progress: s.progress, need: s.need })),
      // 自然物：连外观偏移一起存，读档后与存档时画面一致
      nature: G.nature.map(n => ({
        t: n.type, x: n.x, z: n.z, hp: n.hp, alive: n.alive, rd: n.respawnDay,
        px: n.inst.position.x, pz: n.inst.position.z, ry: n.inst.rotation.y, s: n.inst.scale.x,
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { ctx.toast && ctx.toast('存档失败：' + e.message); return false; }
}

/* ---- 清空当前世界实体（不重建），回到空白 G ---- */
function clearWorld() {
  for (const v of G.villagers) scene.remove(v.obj);
  for (const p of G.placed) scene.remove(p.inst, p.pad);
  for (const s of G.sites) scene.remove(s.inst, s.pad, s.barGrp);
  for (const n of G.nature) { if (n.ring) scene.remove(n.ring); if (n.alive) scene.remove(n.inst); }
  for (const d of G.drops) scene.remove(d.mesh);
  G.villagers = []; G.placed = []; G.sites = []; G.nature = []; G.drops = [];
  G.occ = new Map(); G.selected = new Set();
}

function rebuildNature(n) {
  const nd = NATURE_DEFS[n.t];
  if (!nd || !protos['nat_' + n.t]) return;
  const inst = protos['nat_' + n.t].clone();
  inst.position.set(n.px, 0, n.pz);
  inst.rotation.y = n.ry;
  inst.scale.setScalar(n.s);
  if (n.alive) scene.add(inst);                       // 已砍倒的不上台面，留给 regrow 逻辑复活
  const node = { type: n.t, def: nd, inst, x: n.x, z: n.z, hp: n.hp, alive: n.alive, respawnDay: n.rd || 0, ring: null };
  G.nature.push(node);
  if (!nd.free && n.alive) G.occ.set(key(n.x, n.z), node);
}

export function loadGame() {
  const apply = () => {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
    if (!data || data.v !== 1) return false;
    clearWorld();
    // 1) 标量状态（建筑会顺带加快乐/粮仓上限，最终值在放置后覆盖）
    G.res = { ...G.res, ...data.res };
    G.day = data.day; G.time = data.time; G.year = data.year || 1;
    G.tech = new Set(data.tech); G.milestones = new Set(data.milestones);
    // 2) 建筑与工地
    for (const p of data.placed) {
      const def = DEFS.find(d => d.id === p.id);
      if (def) placeInstance(def, p.x, p.z, p.rot, false);
    }
    for (const s of data.sites) {
      const def = DEFS.find(d => d.id === s.id);
      if (!def) continue;
      const site = createSite(def, s.x, s.z, s.rot);
      site.progress = s.progress; site.need = s.need;
      updateSiteVisuals(site);
    }
    G.happy = data.happy; G.foodCap = data.foodCap;   // 覆盖为存档最终值（已含建筑加成）
    // S25 存档补全：声望 / 村志 / 信件 / 畜牧状态（全部缺省兜底，旧存档不抛错）
    G.repute = (typeof data.repute === 'number') ? data.repute : (G.repute || 20);
    G.voyage = data.voyage || null;
    G.autoWork = data.autoWork !== false;
    G.storyLog = Array.isArray(data.storyLog) ? data.storyLog.slice(0, 8) : [];
    G.letters = Array.isArray(data.letters) ? data.letters : [];
    // 3) 自然资源
    for (const n of data.nature) rebuildNature(n);
    pastureRestore(data.pasture);                     // S25：恢复蛋/鹿状态（缺省安全）
    // 4) 村民：用原生成函数造骨架，再回填数据字段
    spawnVillagers(data.villagers.length);
    data.villagers.forEach((vd, i) => {
      const v = G.villagers[i];
      if (!v) return;
      v.name = vd.name;
      v.trait = TRAITS.find(t => t.id === vd.trait) || v.trait;
      v.slot = vd.slot;
      v.skills = vd.skills || {}; v.sick = !!vd.sick;   // S25 补全：技能/生病兜底
      v.task = null; v.resume = null; v.carry = {};
      v.obj.position.x = vd.x; v.obj.position.z = vd.z;
    });
    ctx.UI && ctx.UI.refresh();
    return true;
  };
  if (assetsReady()) return apply();
  onAssetsLoaded(() => apply());                      // 资产未就绪时延后重建
  return false;
}
