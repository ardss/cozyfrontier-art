/* =====================================================================
 * 12.5 村庄总览面板（S32 产能监控）—— 资源流 / 劳动力 / 警报
 * 只读运行时真实状态（G.res、G.villagers、G.placed），不写任何游戏状态
 * ===================================================================*/
import { DAY_SECONDS, RES_INFO, RECIPES, isWinterDay, seasonOf, SEASON_DAYS, YEAR_DAYS, traitOf } from './config';
import { ICONS } from './icons';
import { G, houseCapacity } from './world';
import { productionPerDay } from './sim';

/* ---- 面板 DOM 动态创建，样式与人口面板一致（暗色圆角玻璃） ---- */
function ensureDom() {
  if (document.getElementById('statspanel')) return;
  const st = document.createElement('style');
  st.textContent = `
  #statspanel{position:absolute;left:14px;top:96px;width:250px;max-height:56vh;overflow-y:auto;padding:12px 14px;font-size:12px;line-height:1.7;display:none;z-index:6}
  #statspanel b.hd{color:var(--ink);font-size:14px}
  #statspanel .sec{margin-top:8px;padding-top:4px;color:var(--ink);font-size:11.5px;letter-spacing:1px}
  #statspanel .srow{display:flex;align-items:center;gap:6px;border-top:1px solid rgba(125,143,90,.18);padding:3px 2px;flex-wrap:wrap}
  #statspanel .srow .nm{flex:1;color:var(--txt)}
  #statspanel .srow .num{color:var(--dim);font-size:11px}
  #statspanel .pos{color:var(--ok)}
  #statspanel .neg{color:var(--bad)}
  #statspanel .warn{color:#7a5a1a}
  #statspanel .alerts{margin-top:4px;background:var(--wheat-bg);border:1px solid var(--wheat);border-radius:9px;padding:4px 8px}
  #statspanel .alerts .srow{border-top-color:rgba(217,185,106,.45)}
  #statspanel .foot{margin-top:8px;text-align:right}
  #statspanel .foot button{background:#d9d3c0;color:var(--txt);border:none;border-radius:999px;padding:4px 14px;font-size:12px;cursor:pointer}
  #statspanel .foot button:hover{background:#e4decb}`;
  document.head.appendChild(st);
  const el = document.createElement('div');
  el.id = 'statspanel';
  el.className = 'panel';
  const hud = document.getElementById('hud');
  (hud || document.body).appendChild(el);
  el.insertAdjacentHTML('beforeend', `<div class="foot"><button id="btn-statsclose">关闭</button></div>`);
  document.getElementById('btn-statsclose').onclick = () => Stats.toggle();
}

/* ---- 每日预期产量（天为单位）：配方建筑 + 露天产出 ---- */
function flowPerDay() {
  const winter = isWinterDay(G.day);
  const prod: any = {};                                    // res -> 每日预期产量
  const use: any = {};                                     // res -> 每日预期消耗
  const shortBlds = [];                               // 缺原料的在岗配方建筑
  for (const p of G.placed) {
    const rc = RECIPES[p.def.id];
    if (!rc) continue;
    const n = G.villagers.filter(v => v.task && v.task.kind === 'work' && v.task.target === p).length;
    if (!n) continue;
    const cycles = Math.min(n, 2) * (winter ? 0.5 : 1) * (DAY_SECONDS / rc.time);   // 每天循环次数
    const starved = !Object.entries(rc.in).every(([r, v]) => (G.res[r] || 0) >= v);
    if (starved) shortBlds.push({ name: p.def.name, need: Object.entries(rc.in).map(([r, v]) => (RES_INFO[r].label) + v).join('') });
    for (const [r, v] of Object.entries(rc.in) as [string, number][]) use[r] = (use[r] || 0) + (starved ? 0 : v * cycles);
    for (const [r, v] of Object.entries(rc.out) as [string, number][]) prod[r] = (prod[r] || 0) + (starved ? 0 : v * cycles);
  }
  const pp = productionPerDay();                      // 露天/农牧产出（已含效率与冬季折减）
  prod.wood = (prod.wood || 0) + pp.wood;
  prod.food = (prod.food || 0) + pp.food;
  /* ---- 每日预期消耗：对齐 nightSettlement 口径 ---- */
  const pop = G.villagers.length;
  const glutton = G.villagers.filter(v => traitOf(v).extraFood).length;
  use.food = (use.food || 0) + pop * (winter ? 2 : 1) + glutton;   // 面包优先抵扣，这里按总量计
  if (winter) {
    const fire = G.placed.some(p => p.def.id === 'campfire');
    use.wood = (use.wood || 0) + Math.ceil(pop * (fire ? 0.5 : 1));
  }
  return { prod, use, shortBlds, winter };
}

/* ---- 资源上限（与 world 的 foodCap 对齐；其余资源暂无上限） ---- */
function capOf(r) { return (r === 'food' || r === 'bread') ? G.foodCap : Infinity; }

const f1 = n => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

function render() {
  const el = document.getElementById('statspanel');
  if (!el || el.style.display !== 'block') return;
  const { prod, use, shortBlds, winter } = flowPerDay();
  /* ---- 资源流 ---- */
  const keys = ['wood', 'food', 'stone', 'plank', 'bread', 'know', 'tool'];
  let rows = '';
  for (const r of keys) {
    const cur = Math.floor(G.res[r] || 0);
    const cap = capOf(r), capTxt = cap === Infinity ? '' : '/' + cap;
    const p = prod[r] || 0, u = use[r] || 0, net = p - u;
    const netTxt = net > 0.05 ? `<span class="pos">+${f1(net)}/日</span>`
      : net < -0.05 ? `<span class="neg">${f1(net)}/日</span>`
      : `<span style="color:var(--dim)">±0</span>`;
    rows += `<div class="srow">${ICONS[r] || ''}<span class="nm">${RES_INFO[r].label}</span>`
      + `<span class="num">${cur}${capTxt}</span>`
      + `<span class="num" title="日产量">产 ${f1(p)}</span>`
      + `<span class="num" title="日消耗">耗 ${f1(u)}</span>${netTxt}</div>`;
  }
  /* ---- 劳动力 ---- */
  let nIdle = 0, nChop = 0, nWork = 0, nHaul = 0, nBuild = 0;
  for (const v of G.villagers) {
    const k = v.task && v.task.kind;
    if (!k) nIdle++;
    else if (k === 'chop') nChop++;
    else if (k === 'work') nWork++;
    else if (k === 'deliver' || k === 'fetch') nHaul++;
    else if (k === 'build') nBuild++;
    else nIdle++;
  }
  const labor = `<div class="srow">${ICONS.pop || ''}<span class="nm">村民</span><span class="num">${G.villagers.length}/${houseCapacity()}</span></div>`
    + `<div class="srow">${ICONS.box || ''}<span class="nm">搬运 / 建造</span><span class="num">${nHaul} / ${nBuild}</span></div>`
    + `<div class="srow">${ICONS.axe || ''}<span class="nm">采集</span><span class="num">${nChop}</span></div>`
    + `<div class="srow">${ICONS.gear || ''}<span class="nm">岗位（配方建筑）</span><span class="num">${nWork}</span></div>`
    + `<div class="srow">${ICONS.happy || ''}<span class="nm">空闲 / 待命</span><span class="num">${nIdle}</span></div>`;
  /* ---- 警报 ---- */
  const glutton = G.villagers.filter(v => traitOf(v).extraFood).length;
  const foodNeed = Math.max(0.01, G.villagers.length * (winter ? 2 : 1) + glutton - (G.res.bread || 0));
  const foodDays = foodNeed <= 0 ? Infinity : (G.res.food || 0) / foodNeed;
  const foodTxt = foodDays === Infinity ? `<span class="pos">充足</span>`
    : foodDays < 2 ? `<span class="neg">仅够 ${f1(foodDays)} 天！</span>`
    : `<span class="num">约 ${f1(foodDays)} 天</span>`;
  const din = ((G.day - 1) % YEAR_DAYS) + 1;
  const toWinter = din <= SEASON_DAYS * 3 ? SEASON_DAYS * 3 + 1 - din : YEAR_DAYS + SEASON_DAYS * 3 + 1 - din;
  let winterTxt;
  if (winter) winterTxt = `<span class="neg">寒冬进行中</span>`;
  else if (toWinter <= SEASON_DAYS) {
    const p = G.villagers.length;
    const ok = (G.res.wood || 0) >= p * 8 && (G.res.food || 0) >= p * 5;
    winterTxt = `<span class="${ok ? 'pos' : 'neg'}">${toWinter} 天后入冬（建议柴≥${p * 8} 粮≥${p * 5}）</span>`;
  } else winterTxt = `<span class="num">${toWinter} 天后入冬（现 ${seasonOf(G.day)}季）</span>`;
  const shortTxt = shortBlds.length
    ? shortBlds.map(b => `<div class="srow"><span class="nm neg">${b.name}</span><span class="num">缺原料 ${b.need}，已停工待料</span></div>`).join('')
    : `<div class="srow"><span class="num pos">各在岗作坊原料充足</span></div>`;
  const alerts = `<div class="alerts">`
    + `<div class="srow">${ICONS.food || ''}<span class="nm">存粮可撑</span>${foodTxt}</div>`
    + `<div class="srow">${ICONS.sword || ''}<span class="nm">季节</span>${winterTxt}</div>`
    + `</div>`
    + `<div class="srow">${ICONS.hammer || ''}<span class="nm">断供作坊</span></div>${shortTxt}`;
  el.innerHTML = `<b class="hd">${ICONS.gear || ''} 村庄总览</b>`
    + `<div class="sec">资源流（每日预期）</div>${rows}`
    + `<div class="sec">劳动力</div>${labor}`
    + `<div class="sec">警报</div>${alerts}`
    + el.querySelector('.foot').outerHTML;
  document.getElementById('btn-statsclose').onclick = () => Stats.toggle();
}

export const Stats = {
  toggle() {
    ensureDom();
    const el = document.getElementById('statspanel');
    if (el.style.display === 'block') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    render();
  },
  render,                                                // 主循环每秒调用；面板未开时内部直接返回
};
