/* =====================================================================
 * S12. 村民自治 —— 温和的自动派工（经 jobs.js 统一轮询，原 2 秒 setInterval 删除）
 *      开关 G.autoWork（默认开，控制条「自治:开/关」按钮）。
 *      规则：空闲村民 ≥2 且距玩家最后一次手动派工 ≥30 秒，
 *      才为「多余的那 1 名」空闲者派最近的可做任务（采集节点 → 工地 → 上工）。
 *      首次接管时 toast 提示一次。手动派工冷却由 input.js 发出的
 *      'manual-dispatch' 事件驱动（原 Input.issueCommand 包装删除）。
 * ===================================================================*/
import { G } from './world.js';
import { Events } from './events.js';
import { registerJobs } from './jobs.js';
import { toast } from './ui.js';

const IDLE_NEED = 2, MANUAL_COOLDOWN = 30;

/* ---- JobSource：每轮最多接管 1 人（once），覆盖采集节点与工地（收割/捡蛋/狩猎归 farm/pasture） ---- */
registerJobs({
  id: 'autonomy',
  once: true,
  scan() {
    if (!G.autoWork) return null;
    if (G._lastManualCmd && performance.now() - G._lastManualCmd < MANUAL_COOLDOWN * 1000) return null;
    const idle = G.villagers.filter(v => !v.task);
    if (idle.length < IDLE_NEED) return null;
    // 候选任务：最近的可采集自然节点 / 未完工工地（农田收割已由 farm.js 自动派工）
    let best = null, kind = null, nd = 1e9;
    const v = idle.sort((a, b) => 0)[0];               // 只派 1 人：任取一名空闲者
    for (const n of G.nature) {
      if (!n.alive || n.def.deco) continue;
      const d = v.obj.position.distanceTo(n.inst.position);
      if (d < nd) { nd = d; best = n; kind = 'chop'; }
    }
    for (const s of G.sites) {
      if (G.villagers.some(x => x.task && x.task.kind === 'build' && x.task.target === s)) continue;
      const d = v.obj.position.distanceTo(s.inst.position);
      if (d < nd) { nd = d; best = s; kind = 'build'; }
    }
    if (!best) return null;
    if (!G._autoToastShown) {
      G._autoToastShown = true;
      toast('🤝 村民自治：空闲者自动找活（可在设置关闭）');
    }
    return { kind, target: best, v };
  },
});

/* ---- 玩家手动派工时刻：冷却 30 秒，期间自治不接管 ---- */
Events.on('manual-dispatch', () => { G._lastManualCmd = performance.now(); });

/* ---- 自治开关按钮 ---- */
export function initAutonomy() {
  const btn = document.getElementById('btn-autonomy');
  if (btn) {
    btn.textContent = '自治:' + (G.autoWork ? '开' : '关');
    btn.onclick = () => {
      G.autoWork = !G.autoWork;
      btn.textContent = '自治:' + (G.autoWork ? '开' : '关');
      toast(G.autoWork ? '🤝 村民自治：空闲者自动找活（可在设置关闭）' : '🤚 村民自治已关闭');
    };
  }
}
