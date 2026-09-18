/* =====================================================================
 * 13. 声望（S39）与技能成长（S35）
 * 声望：0-100，起始 20。里程碑 +8 / 节日 +3 / 夜间温饱 +1（冻饿夜 -2）。
 *   ≥40 移民间隔 ×0.7；≥60 贸易价格优化 10%；<15 村民流失概率增加。
 * 技能：每次完成工作 +1 经验（同工种），每 10 点经验升 1 级，效率 +10%/级，上限 3 级。
 * ===================================================================*/
import { G } from './world.js';
import { scene } from './scene.js';
import { ctx } from './context.js';

const SKILL_NAMES = { chop: '砍伐', harvest: '收获', work: '做工' };
export const skillLevel = exp => Math.min(3, Math.floor((exp || 0) / 10));
export const skillMul = (v, key) => 1 + 0.1 * skillLevel(v.skills && v.skills[key]);

/* 经验入账（学校加成走同一入口，n=5 跳过成长曲线）；跨过 10/20/30 时升级提示 */
export function gainExp(v, key, n = 1) {
  if (!v.skills) v.skills = {};
  const before = skillLevel(v.skills[key]);
  v.skills[key] = (v.skills[key] || 0) + n;
  const after = skillLevel(v.skills[key]);
  if (after > before) ctx.toast(`🌱 ${v.name} 熟练了${SKILL_NAMES[key] || key}，效率提升`);
}

/* 人口面板小字：最高技能的称号，如「砍伐·熟练」 */
export const skillTag = v => {
  if (!v.skills) return '';
  const [k, e] = Object.entries(v.skills).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const lv = skillLevel(e);
  return lv ? (SKILL_NAMES[k] || k) + '·' + ['熟练', '老手', '大师'][lv - 1] : '';
};

export const Repute = {
  value: () => (G.repute == null ? 20 : G.repute),
  add(n, reason) {
    const old = this.value();
    G.repute = Math.max(0, Math.min(100, old + n));
    const d = G.repute - old;
    if (d) ctx.toast(`⭐ 声望 ${d > 0 ? '+' : ''}${d} → ${G.repute}${reason ? '（' + reason + '）' : ''}`);
  },
  tradeDiscount() { return this.value() >= 60 ? 0.1 : 0; },
  immigrantMul() { return this.value() >= 40 ? 0.7 : 1; },
  /* 夜间结算：fed=全村温饱。低声望有概率流失村民（由 main.js 的 nightTick 包装调用） */
  nightly(fed) {
    if (G.over) return;
    this.add(fed ? 1 : -2, fed ? '全村温饱' : '冻饿之夜');
    if (this.value() < 15 && G.villagers.length > 1 && Math.random() < 0.25) {
      const i = Math.floor(Math.random() * G.villagers.length);
      const lv = G.villagers.splice(i, 1)[0];
      if (lv) { scene.remove(lv.obj); G.selected && G.selected.delete(lv); ctx.toast(`😢 声望低迷，${lv.name} 失望地离开了村庄`); }
    }
  },
};
