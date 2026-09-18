/* =====================================================================
 * 11.5 科技树渲染 —— 三层树状 UI（奶油水彩风），从 ui.ts 拆出
 * 节点三态：done=已研究（苔绿底白勾）/ can=可研究（白底+研究胶囊）/ locked=前置未满
 * ===================================================================*/
import { TECHS, DEFS, MILESTONES } from './config';
import { ICONS } from './icons';
import { G, canResearch, missingNeeds } from './world';

/* 科技 → 现有 SVG 图标（icons.ts 体系，禁止 emoji） */
const TECH_ICON: any = {
  woodwork: 'wood', baking: 'bread', masonry: 'stone', watch: 'sword',
  storage: 'box', glass: 'food', wellness: 'happy', sailing: 'trade',
};

const techName = (id: string) => (TECHS.find(x => x.id === id) || {}).name || id;

function nodeHtml(t: any) {
  const done = G.tech.has(t.id);
  const missing = missingNeeds(t);
  const can = canResearch(t);
  const icon = `<span class="tic">${ICONS[TECH_ICON[t.id]] || ICONS.gear}</span>`;
  if (done) return `<div class="tnode done" title="${t.desc}">${icon}<div class="tnm">${t.name}</div><div class="tcost">已研究</div></div>`;
  const missTxt = missing.length ? '需先研究 ' + missing.map(techName).join('、') + '。' : '';
  const btn = `<button class="rbtn" data-t="${t.id}" ${can ? '' : 'disabled'}>研究</button>`;
  return `<div class="tnode ${missing.length ? 'locked' : 'can'}" title="${missTxt}${t.desc}（知识成本 ${t.cost}）">${icon}<div class="tnm">${t.name}</div><div class="tcost">知识成本 ${t.cost}</div>${btn}</div>`;
}

/* 按 tier 分行：同父节点包进 .tbranch（CSS 画横向母线 + 每节点竖向支线） */
const parentOf = (t: any) => (Array.isArray(t.needs) && t.needs[0]) || '_root';
function tierHtml(tier: number) {
  const list = TECHS.filter(t => (t.tier || 1) === tier);
  if (tier === 1) return `<div class="ttier">${list.map(nodeHtml).join('')}</div>`;
  const groups: any = {};
  list.forEach(t => { const p = parentOf(t); (groups[p] = groups[p] || []).push(t); });
  return `<div class="ttier">${Object.values(groups).map((g: any) => `<div class="tbranch">${g.map(nodeHtml).join('')}</div>`).join('')}</div>`;
}

export function renderTechTree(el: HTMLElement, notify: (msg: string) => void) {
  el.innerHTML = `<b>${ICONS.gear} 科技</b> <span style="color:var(--dim);font-size:11px">知识 ${ICONS.know}${Math.floor(G.res.know || 0)} · 前置研究完才可解锁下层</span>`
    + [1, 2, 3].map(tierHtml).join('')
    + `<b style="display:block;margin-top:10px;font-size:12px">${ICONS.flag} 里程碑 ${G.milestones.size}/${MILESTONES.length}</b>` + MILESTONES.map(m =>
      `<div class="mrow ${G.milestones.has(m.id) ? 'done' : ''}"><span>${G.milestones.has(m.id) ? '✓' : '○'} ${m.name}</span><span style="color:var(--dim);font-size:10px">${m.desc}</span></div>`).join('')
    + `<div style="text-align:right"><button id="btn-techclose">关闭</button></div>`;
  el.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach(b => b.onclick = () => {
    const t = TECHS.find(x => x.id === b.dataset.t);
    if (!t || !canResearch(t)) return;
    G.res.know -= t.cost;
    G.tech.add(t.id);
    notify('研究完成：' + t.name + '（' + t.unlock.map(id => (DEFS.find(d => d.id === id) || {}).name || id).join('/') + ' 解锁）');
    renderTechTree(el, notify);
  });
  document.getElementById('btn-techclose')!.onclick = () => el.style.display = 'none';
}
