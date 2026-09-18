/* =====================================================================
 * 15. 造景与镜头（S13 跟随/拍照 + S37 造景）
 *     - 树苗：装饰类目卡片 → 复用 startPlacing 放置流 → 种下永久装饰树
 *     - V：跟随选中村民；P：拍照模式（隐藏 HUD + 暗角 + 保存截图）
 * ===================================================================*/
import { renderer, camCtl } from './scene';
import { protos } from './assets';
import { G, canPlace, canAfford, pay } from './world';
import { plantDecoTree } from './nature';
import { UI } from './ui';
import { ctx } from './context';

// 树苗"伪建筑"定义：w/d=1 供 footprint/canPlace/ghost 使用，deco 标记走种植分支
const SAPLING = {
  id: 'deco_sapling', name: '树苗', w: 1, d: 1, cat: '装饰', cost: { wood: 1 },
  role: 'deco', deco: true, desc: '种一棵装饰树：不可砍伐、不会被派工，村景更美（幸福 +1）。',
};

function ensureProto() {                            // 幽灵预览用：小一号的橡树
  if (protos.deco_sapling || !protos.nat_tree) return;
  protos.deco_sapling = protos.nat_tree.clone();
  protos.deco_sapling.scale.setScalar(.65);
}

/* ---- 种树模式：由 input.js 的 placing 提交分支调用 ---- */
function plant(def, cell) {
  if (!canPlace(def, cell.x, cell.z, 0)) { ctx.toast('这里种不下树苗'); return false; }
  if (!canAfford(def)) { ctx.toast('木材不够（需 1 木）'); return false; }
  pay(def);
  plantDecoTree(cell.x, cell.z);
  G.happy = Math.min(100, G.happy + 1);
  ctx.toast('🌱 种下一棵树苗，村景更美了（幸福 +1）');
  ctx.UI.refresh();
  return true;
}

/* ---- 跟随镜头 ---- */
let followV = null;
function toggleFollow() {
  if (followV) { stopFollow(); ctx.toast('已退出跟随'); return; }
  if (G.selected.size === 1) {
    followV = [...G.selected][0];
    ctx.toast(`📹 正在跟随 ${followV.name}（再按 V 或按中键退出）`);
  } else ctx.toast('先点击选中一名村民，再按 V 跟随');
}
function stopFollow() { followV = null; }
function stepFollow(_dt?) {
  if (!followV) return;
  if (G.over || !G.villagers.includes(followV)) { followV = null; return; }
  camCtl.target.lerp(followV.obj.position, .12);    // 平滑趋向村民
  camCtl.apply();
}

/* ---- 拍照模式 ---- */
let photoOn = false;
function togglePhoto() {
  photoOn = !photoOn;
  document.body.classList.toggle('photo', photoOn);
  if (photoOn) ctx.toast('📷 拍照模式：构图满意就点右下角保存（P 退出）');
}
function saveShot() {
  const a = document.createElement('a');
  a.download = 'cozyfrontier-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
}

/* ---- 装饰类目注入"树苗"卡片（不改 config/ui，运行时挂载） ---- */
function init() {
  const card = document.createElement('div');
  card.className = 'b';
  card.id = 'b-' + SAPLING.id;
  card.title = SAPLING.desc;
  card.style.display = 'none';
  card.innerHTML = `<div style="font-size:30px;line-height:40px">🌱</div><div class="tx"><div class="nm">${SAPLING.name}</div><div class="cost">🪵1</div></div>`;
  card.onclick = () => {
    if (!canAfford(SAPLING)) { ctx.toast('材料不够：需 1 木'); return; }
    ensureProto();
    ctx.startPlacing(SAPLING);
    ctx.toast('点击草地种下树苗（右键/ESC 取消）');
  };
  document.getElementById('list').appendChild(card);
  // renderList 只遍历 DEFS，这里包一层让树苗卡随类目显隐
  const origRender = UI.renderList.bind(UI);
  UI.renderList = function () {
    origRender();
    document.getElementById('list').appendChild(card);   // origRender 重建 #list 会清掉卡片，重新挂回
    card.style.display = (this.curCat === '全部' || this.curCat === '装饰') ? 'block' : 'none';
  };
  document.getElementById('photo-save').onclick = saveShot;
  addEventListener('keydown', e => {
    if (e.repeat || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'p') togglePhoto();
    else if (k === 'escape' && photoOn) togglePhoto();
  });
}

export const Deco = { init, plant, toggleFollow, stopFollow, step: stepFollow };
Deco.init();
