/* =====================================================================
 * S22 仓储物流 —— 轻量仓储网络（纯函数式，无持久化状态）
 * 规则：
 *  - 全村资源仍聚合在 G.res（玩家视图不变），本模块只计算系数。
 *  - 入库效率：产出到村中心/仓库的距离 > RANGE（12 格）时，food/bread
 *    类资源按 FAR_EFF（50%）入库（远途损耗）；木/石等不受影响。
 *  - 仓库辐射：仓库 8 格范围内的生产建筑产出 +10%（BOOST）。
 *  - 仓库自身仍提供 +50 foodCap（buildings.js 原逻辑，不变）。
 * 所有数值均可从 G.placed（仓库/村中心坐标）即时推导，存档无需新增字段。
 * ===================================================================*/
import { G } from './world';

export const STORAGE = {
  RANGE: 12,        // 免损耗半径（格）：村中心或任一仓库
  FAR_EFF: 0.5,     // 超出半径的入库效率（远途损耗）
  BOOST_R: 8,       // 仓库辐射半径（格）
  BOOST: 1.1,       // 辐射范围内生产建筑效率加成
};
const FAR_RES = { food: true, bread: true };   // 受远途损耗影响的资源

/* 入库点集合：村中心 + 全部仓库（含在建工地之外的建成建筑） */
export function depots() {
  return G.placed
    .filter(p => p.def.role === 'core' || p.def.id === 'warehouse')
    .map(p => ({ x: p.inst.position.x, z: p.inst.position.z }));
}

/* 最近入库点距离（格） */
export function depotDist(x, z) {
  let best = Infinity;
  for (const d of depots()) best = Math.min(best, Math.hypot(d.x - x, d.z - z));
  return best;
}

/* 入库效率（0.5~1）：food/bread 类在仓储半径外按 50%，其余恒 1 */
export function depositEfficiency(x, z, res) {
  if (!FAR_RES[res]) return 1;
  return depotDist(x, z) <= STORAGE.RANGE ? 1 : STORAGE.FAR_EFF;
}

/* 生产加成（≥1）：仓库 BOOST_R 格内的建筑产出 ×10% */
export function productionBoost(x, z) {
  return depotDist(x, z) <= STORAGE.BOOST_R ? STORAGE.BOOST : 1;
}

/* 描述文本（供后续 UI/调试，当前不接入 ui.js） */
export function describeEfficiency(x, z, res) {
  const e = depositEfficiency(x, z, res);
  const b = productionBoost(x, z);
  const parts = [];
  if (FAR_RES[res] && e < 1) parts.push(`距仓储点过远，${res === 'food' ? '食' : '面包'}入库 ${Math.round(e * 100)}%（建仓库或靠近村中心可消除损耗）`);
  if (b > 1) parts.push('仓库物流加持：生产效率 +10%');
  return parts.join('；') || '物流正常';
}
