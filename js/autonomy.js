/* =====================================================================
 * S12. 村民自治 —— 温和的自动派工
 *      开关 G.autoWork（默认开，控制条「自治:开/关」按钮）。
 *      规则：每 2 秒扫描一次；空闲村民 ≥2 且距玩家最后一次手动派工 ≥30 秒，
 *      才为「多余的那 1 名」空闲者派最近的可做任务（采集节点 → 工地 → 上工）。
 *      首次接管时 toast 提示一次。
 * ===================================================================*/
import { G } from './world.js';
import { command } from './villagers.js';
import { Input } from './input.js';
import { toast } from './ui.js';
import { gameState } from './controls.js';

const SCAN_SECS = 2, IDLE_NEED = 2, MANUAL_COOLDOWN = 30;

/* ---- 包装手动派工入口：Input 是模块单例对象，包装后 input.js 内部调用同样生效 ---- */
export function initAutonomy() {
  if (Input.__autoHooked) return;
  const orig = Input.issueCommand.bind(Input);
  Input.issueCommand = (...a) => { G._lastManualCmd = performance.now(); orig(...a); };
  Input.__autoHooked = true;

  const btn = document.getElementById('btn-autonomy');
  if (btn) {
    btn.textContent = '自治:' + (G.autoWork ? '开' : '关');
    btn.onclick = () => {
      G.autoWork = !G.autoWork;
      btn.textContent = '自治:' + (G.autoWork ? '开' : '关');
      toast(G.autoWork ? '🤝 村民自治：空闲者自动找活（可在设置关闭）' : '🤚 村民自治已关闭');
    };
  }

  setInterval(() => {
    if (!G.autoWork || G.over || gameState.paused) return;
    if (G._lastManualCmd && performance.now() - G._lastManualCmd < MANUAL_COOLDOWN * 1000) return;
    const idle = G.villagers.filter(v => !v.task);
    if (idle.length < IDLE_NEED) return;
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
    if (!best) return;
    command(v, kind, best);
    if (!G._autoToastShown) {
      G._autoToastShown = true;
      toast('🤝 村民自治：空闲者自动找活（可在设置关闭）');
    }
  }, SCAN_SECS * 1000);
}
