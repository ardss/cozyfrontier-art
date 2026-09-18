/* =====================================================================
 * S9 工具耐久 + S36 村民背篓 —— 装备/损耗/头顶背篓可视化
 * （sim.js 独占接线：装备发生在 stepVillager，损耗在任务完成处）
 * ===================================================================*/
import * as THREE from 'three';
import { G } from './world';
import { ctx } from './context';

export const TOOL_MUL = 1.25;        // 装备工具：效率 ×1.25
export const BREAK_CHANCE = 0.2;     // 任务完成后 20% 概率损坏
const TOAST_COOLDOWN_DAYS = 2;       // 「斧头坏了」提示每 2 天最多 1 条

/* 开局/旧存档补发 2 件工具（save.js 不动，这里懒补齐） */
export function ensureToolStock() {
  if (G.res.tool == null) G.res.tool = 2;
}

/* 需要工具的任务（采集/收割/狩猎） */
export const needsTool = kind => kind === 'chop' || kind === 'harvest' || kind === 'hunt';
/* 效率系数：有工具 ×1.25，空手不惩罚（cozy） */
export const toolMul = v => (v.hasTool ? TOOL_MUL : 1);
/* 到岗装备：库存有工具且未装备 → 扣 1 件入库工具，村民装备 */
export function tryEquip(v) {
  if (v.hasTool || !needsTool(v.task && v.task.kind)) return;
  ensureToolStock();
  if (G.res.tool >= 1) { G.res.tool -= 1; v.hasTool = true; }
}
/* 任务完成后调用：20% 概率工具损坏（toast 限频） */
export function maybeBreakTool(v) {
  if (!v.hasTool || Math.random() >= BREAK_CHANCE) return;
  v.hasTool = false;
  if ((G._toolToastDay || -99) + TOAST_COOLDOWN_DAYS <= G.day) {
    G._toolToastDay = G.day;
    ctx.toast(`🪓 ${v.name} 的工具用坏了（锯木厂可以再造）`);
  }
}

/* ---- S36 背篓：村民头顶小棕色背篓，携带时显示并随量变大 ---- */
const basketGeo = new THREE.BoxGeometry(.22, .18, .16);
const basketMat = new THREE.MeshLambertMaterial({ color: 0x8a5f36 });
export function makeBasket() {
  const m = new THREE.Mesh(basketGeo, basketMat);
  m.position.set(.3, 1.05, -.22);      // 背在身后（wrap 局部坐标，随整体缩放）
  m.castShadow = true;
  m.visible = false;
  return m;
}
export function updateBasket(v, carryTotal) {
  if (!v.basket) return;
  const n = carryTotal(v);
  v.basket.visible = n > 0;
  if (n > 0) v.basket.scale.setScalar(1 + Math.min(n, 6) * 0.08);
}
