/* =====================================================================
 * S27. 外部世界——远方来信（每季第 3 天，一封来自远方的信）
 * 弹窗复用 #event 的样式范式（动态注入自己的 #letter 节点与 CSS）。
 * 状态挂 G.letterState = { pending, debt, order }（world.js；G.letters 数组已被 S25 村志占用）。
 * 文案基调：官网 world-data.js——群屿边陲、行商与书信、重建与治愈。
 * ===================================================================*/
import { seasonOf, YEAR_DAYS, SEASON_DAYS } from './config';
import { G } from './world';
import { UI, toast } from './ui';
import { Events } from './events';

/* ---- 样式：复制 mvp.html 中 #event 的规则，换成 #letter 专属节点 ---- */
const css = document.createElement('style');
css.textContent = `
#letter{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);width:330px;
  background:rgba(30,24,17,.97);border:1px solid rgba(232,200,130,.4);border-radius:12px;
  color:var(--txt,#e8dcc0);padding:16px 18px;font-size:13px;line-height:1.8;display:none;z-index:15;
  box-shadow:0 8px 30px rgba(0,0,0,.5)}
#letter b{color:var(--gold,#e8c882);font-size:15px}
#letter .lbody{color:#d8ccb0;white-space:pre-line;margin-top:4px}
#letter button{margin:10px 6px 0 0;background:#5a8a4a;color:#fff;border:none;border-radius:7px;
  padding:6px 14px;font-size:12px;cursor:pointer}
#letter button.alt{background:#3a3226;color:var(--txt,#e8dcc0)}
`;
document.head.appendChild(css);

const el = document.createElement('div');
el.id = 'letter';
document.getElementById('main').appendChild(el);

const clampHappy = v => Math.max(0, Math.min(100, v));
const seasonIdx = () => ((G.year || 1) - 1) * 4 + ['春', '夏', '秋', '冬'].indexOf(seasonOf(G.day));

/* ---- 信件内容池：12 封（k: family/debt/order/loan/story/tale） ---- */
const POOL = [
  { k: 'family', from: '妹妹 阿苇', text: '哥：岛那边的春天来得晚，屋后的野樱桃才刚打苞。娘的咳嗽好了，她总念叨你在边陲别亏待自己。随信捎来一小包晒干的梅子——收下吧，就当我们在陪你守着那片村子的灯火。' },
  { k: 'family', from: '叔父 沉舟', text: '孩子，听说你把一座荒村重新点起了炊烟，我这条老船都替你高兴。记住你爷爷的话：地不亏人，慢慢来。入了冬记得多囤柴，火旺，人心就旺。' },
  { k: 'family', from: '阿婆 青禾', text: '小满他叔捎来的口信，说边陲的星星比城里亮。我这把年纪走不动远路了，就托风给你带句话：把日子过成田垄，一垄一垄来，不着急。' },
  { k: 'loan', from: '旧友 陆行舟', text: '老友，别来无恙。我在南边岛屿看中一片无主的桑田，只差 5 两银子做定金。知道你在边陲立足不易，但除你之外我无人可借——若肯相帮，来年我双倍奉还。' },
  { k: 'debt', from: '旧友 陆行舟', text: '老友！桑田成了！头一茬丝卖了好价钱。当年 5 两雪中送炭，我记到今天——随信附上 8 两，多出的算利息，别推辞。哪天你出海，务必来我的岛上喝一盅。' },
  { k: 'order', from: '远商 白帆', text: '听闻边陲有个村子木工了得。我下一站要去雾港，那里缺上好的木料。下季启程前，若你能备好木料，我按行价之外再添酬谢——边陲的手艺，值得被远方记住。' },
  { k: 'order', from: '远商 白帆', text: '又是我，白帆。雾港的船坞要扩建，托我寻可靠木料。你若能在下季结束前攒够存货，我把酬金一并带来。慢工出细活，我不催，只等。' },
  { k: 'orderDone', from: '远商 白帆', text: '货收到了，成色极好！雾港的匠人赞不绝口。说好的酬谢分文不少，另附一角海边捡的螺钿，给村里孩子们玩。来年我还走这条航线。' },
  { k: 'orderFail', from: '远商 白帆', text: '启程那天货舱还空着，船老大直叹气。不过不怪你——边陲的日子，先把自家的炉火烧旺要紧。这单算了，下回有货，随时托行商捎话给我。' },
  { k: 'tale', from: '灯塔守 老盐', text: '我守着西边海角的灯塔四十年了。昨夜风大，光柱扫过海面时，我看见远处礁石上停着一只白鸟——像极了古书里画的"引路鸟"。边陲不荒，孩子，荒的是没人守。你守着村子，我守着光。' },
  { k: 'tale', from: '游学士子 云汀', text: '途经贵地，见田垄层叠、炊烟有序，恍惚间像在残卷里读到的古文明图景。听说土里还埋着他们留下的种子——也许你翻开的每一垄地，都是在替他们把没种完的春天种完。' },
  { k: 'tale', from: '牧鹿人 岩叔', text: '北边山里今年鹿群兴旺，小鹿跟着母鹿学跳溪。老辈人说，鹿肯来的地方，地气就是活的。你这村子，地气是活的。' },
];

/* ---- 弹窗：展示信件 + 按钮回调（交互全在此文件内完成） ---- */
function openLetter(letter, opts) {
  el.innerHTML = `<b>✉ 远方来信 · ${letter.from}</b><div class="lbody">${letter.text}</div>`
    + opts.map((o, i) => `<button data-o="${i}" class="${i ? 'alt' : ''}">${o.label}</button>`).join('');
  el.style.display = 'block';
  el.querySelectorAll('button[data-o]').forEach((b: any) => b.onclick = () => {
    const o = opts[+b.dataset.o];
    el.style.display = 'none';
    if (o.act) o.act();
    if (o.msg) toast(o.msg);
    UI.refresh();
  });
}
const addSilver = n => { G.res.silver = Math.max(0, (G.res.silver || 0) + n); };
const addHappy = n => { G.happy = clampHappy(G.happy + n); };

/* ---- 每季第 3 天调用（main.js nightTick 后钩子） ---- */
export function dayTick() {
  const din = ((G.day - 1) % YEAR_DAYS) + 1;
  if (((din - 1) % SEASON_DAYS) !== 2) return;         // 每季第 3 天
  const L = G.letterState || (G.letterState = { pending: null, debt: 0, order: null });
  const si = seasonIdx();
  // 1) 远商订单结算：上一季承诺的木料，本封信兑现
  if (L.order) {
    const done = (G.res.wood || 0) >= L.order.need;
    if (done) G.res.wood -= L.order.need;
    const od = POOL.find(p => p.k === (done ? 'orderDone' : 'orderFail'));
    openLetter(od, [{ label: '拆信读毕', act: () => done && addSilver(L.order.reward), msg: done ? `🪙 履约成功 +${L.order.reward}🪙` : '📦 订单过期，来日再约' }]);
    L.order = null;
    return;
  }
  // 2) 旧友还债：借出两季后（含当季）的信里归还 8 银
  if (L.debt && si >= L.debt) {
    openLetter(POOL.find(p => p.k === 'debt'), [{ label: '收下这份心意（+8 银）', act: () => addSilver(8), msg: '🪙 旧友还银 +8🪙' }]);
    L.debt = 0;
    return;
  }
  // 3) 随机新信（避免与上一次同封）
  let pick;
  do { pick = POOL[Math.floor(Math.random() * POOL.length)]; } while (pick.k === L.pending && POOL.length > 1);
  L.pending = pick.k;
  if (pick.k === 'family') {
    openLetter(pick, [{ label: '回一封家书', act: () => addHappy(2), msg: '💛 家书抵万金 快乐 +2' }]);
  } else if (pick.k === 'loan') {
    openLetter(pick, [
      { label: '借出 5 两', act: () => {
          if ((G.res.silver || 0) < 5) { toast('🪙 银两不足，只好回信致歉'); return; }
          addSilver(-5); L.debt = si + 2; toast('✉ 已托行商带去 5🪙（两季后归还）');
        } },
      { label: '婉言相拒', msg: '✉ 各有各的日子，情谊不减' },
    ]);
  } else if (pick.k === 'order') {
    const need = 6 + Math.floor(Math.random() * 3) * 3;   // 6 / 9 / 12 木
    L.order = { need, due: si + 1, reward: 6 };
    openLetter({ ...pick, text: pick.text + `\n\n（订单：下季第 3 天前存够 ${need} 木🪵，酬谢 6 银🪙）` },
      [{ label: '接下订单', msg: `📋 接单：下季前备 ${need}🪵` },
       { label: '回绝', act: () => { L.order = null; }, msg: '✉ 婉拒了订单' }]);
  } else {
    openLetter(pick, [{ label: '读完信', act: () => addHappy(1), msg: '💛 远方的故事 快乐 +1' }]);
  }
}

/* ---- 新一天：远方来信（原 main.js nightTick 包装平移；晚于村志故事） ---- */
Events.on('day', () => { if (!G.over) dayTick(); }, 20);
