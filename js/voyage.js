/* =====================================================================
 * S11. 航海远航 —— 灯塔建成后在信息面板发起远航贸易
 *      消耗 银10 + 粮8 → 派船出海，8 天后归航：
 *      带回 银 22~30 + 快乐3；20% 概率带回「远方的种子」（快乐再 +5）。
 *      状态挂 G.voyage = { day: 出发日 }；弹窗复刻 letters.js 的动态节点范式。
 * ===================================================================*/
import { G } from './world.js';
import { toast } from './ui.js';
import { ctx } from './context.js';

const COST = { silver: 10, food: 8 };
const DAYS = 8;

/* ---- 归航弹窗：独立 #voyage 节点（复刻 #event 样式，不碰 ui.js/mvp.html） ---- */
const css = document.createElement('style');
css.textContent = `
#voyage{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);width:330px;
  background:rgba(30,24,17,.97);border:1px solid rgba(232,200,130,.4);border-radius:12px;
  color:var(--txt,#e8dcc0);padding:16px 18px;font-size:13px;line-height:1.8;display:none;z-index:15;
  box-shadow:0 8px 30px rgba(0,0,0,.5)}
#voyage b{color:var(--gold,#e8c882);font-size:15px}
#voyage button{margin:10px 6px 0 0;background:#5a8a4a;color:#fff;border:none;border-radius:7px;
  padding:6px 14px;font-size:12px;cursor:pointer}
`;
document.head.appendChild(css);
const el = document.createElement('div');
el.id = 'voyage';
document.getElementById('main').appendChild(el);

export function voyageDayTick() {                    // main.js nightTick 链调用
  const V = G.voyage;
  if (!V || G.day - V.day < DAYS) return;
  G.voyage = null;
  const silver = 22 + Math.floor(Math.random() * 9); // 22~30
  const seed = Math.random() < 0.2;                  // 20% 远方的种子
  G.res.silver = (G.res.silver || 0) + silver;
  G.happy = Math.max(0, Math.min(100, G.happy + 3 + (seed ? 5 : 0)));
  toast(`⛵ 远航船队归航！+${silver}🪙 快乐+3${seed ? '（还带回了远方的种子！快乐+5）' : ''}`);
  el.innerHTML = `<b>⛵ 远航归港</b><div style="color:#d8ccb0;white-space:pre-line;margin-top:4px">桅影出现在海平线上——村民们涌向岸边。船舱里装满了远方集市的稀罕货：\
银子 +${silver}🪙，全村人围着水手听海那头的故事（快乐 +3）。\
${seed ? '\n\n最令人惊喜的是一只密封的陶罐，里面睡着几粒「远方的种子」——没人知道会种出什么，但捧着它，心里暖洋洋的（快乐 +5）。' : ''}</div>\
<button id="btn-voyok">卸货庆功</button>`;
  el.style.display = 'block';
  document.getElementById('btn-voyok').onclick = () => { el.style.display = 'none'; };
}

/* ---- 灯塔信息面板装饰：追加「发起远航」按钮（farm.js initFarm 范式） ---- */
export function initVoyage() {
  const hook = () => {
    if (!ctx.UI || ctx.UI.__voyageHooked) return;
    const orig = ctx.UI.showBuildingInfo.bind(ctx.UI);
    ctx.UI.showBuildingInfo = entry => {
      orig(entry);
      if (entry.def.id !== 'lighthouse') return;
      const panel = document.getElementById('info');
      const del = document.getElementById('btn-del');
      if (!panel || !del) return;
      const row = document.createElement('div');
      if (G.voyage) {
        const left = DAYS - (G.day - G.voyage.day);
        row.innerHTML = `⛵ <b style="color:#8fb8d8">远航中…</b><span style="color:#a89880;font-size:11px">还有 ${Math.max(0, left)} 天归航</span>`;
      } else {
        const ok = (G.res.silver || 0) >= COST.silver && G.res.food >= COST.food;
        row.innerHTML = `⛵ 远航贸易：<span style="color:#a89880;font-size:11px">需 🪙${COST.silver} 🍎${COST.food}，8 天后归航（银 22~30 + 快乐）</span><br><button id="btn-voy" ${ok ? '' : 'disabled'}>发起远航</button>`;
      }
      panel.insertBefore(row, del);
      const btn = document.getElementById('btn-voy');
      if (btn) btn.onclick = () => {
        if (G.voyage) return;
        if ((G.res.silver || 0) < COST.silver || G.res.food < COST.food) { toast('🪙 银 10 + 粮 8 才够一支船队的开销'); return; }
        G.res.silver -= COST.silver;
        G.res.food = Math.max(0, G.res.food - COST.food);
        G.voyage = { day: G.day };
        toast('⛵ 船队扬帆出海！预计 8 天后归航');
        ctx.UI.refresh();
        ctx.UI.showBuildingInfo(entry);
      };
    };
    ctx.UI.__voyageHooked = true;
  };
  hook();
}
