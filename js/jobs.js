/* =====================================================================
 * 统一派工系统 —— JobSource 注册表 + 每 1.5s 轮询（替代 farm/pasture/autonomy
 * 各自的内部计时器）。各业务模块只保留 scan()（扫描最近的可做任务），
 * 派发统一走 villagers.js 的 command()：最近空闲村民 → 任务。
 * JobSource = { id, once?, scan(): { kind, target, v?, at? }|null }
 *   kind/target 与 command(v, kind, target) 对齐；v 可选（指定派给谁，如自治接管）；
 *   at 可选（选「最近空闲村民」的参考位置，如狩猎时以猎屋为准而非鹿）。
 * ===================================================================*/
import { G } from './world.js';
import { command } from './villagers.js';

const POLL = 1.5;                                       // 轮询间隔（秒）
const sources = [];
let acc = 0;

/* JobSource 注册：按注册顺序轮询（farm → pasture → autonomy） */
export function registerJobs(source) { sources.push(source); }

/* 主循环调用：累计 gdt（暂停/结束时 gdt=0，自然停摆，与原各内部计时器一致） */
export function stepJobs(dt) {
  acc += dt;
  if (acc < POLL) return;
  acc = 0;
  for (const s of sources) {
    if (G.over) return;
    for (let n = 0; n < 64; n++) {                      // 单次轮询每源最多 64 个任务（防呆）
      const job = s.scan();
      if (!job) break;
      const v = job.v || nearestIdle(job.at || job.target);   // at: 选人参考点（缺省用目标自身位置）
      if (v) command(v, job.kind, job.target);
      if (s.once) break;
    }
  }
}

/* 距目标最近的空闲村民（目标可为建筑 entry 或鹿 mesh） */
export function nearestIdle(target) {
  const pos = (target.inst || target).position;
  let near = null, nd = 1e9;
  for (const v of G.villagers) {
    if (v.task) continue;
    const d = v.obj.position.distanceTo(pos);
    if (d < nd) { nd = d; near = v; }
  }
  return near;
}
