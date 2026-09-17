/* =====================================================================
 * 11. UI —— 侧栏、缩略图、选择面板、提示、toast
 * ===================================================================*/
import * as THREE from 'three';
import { DAY_SECONDS, RES_INFO, CARRY_CAP, DEFS, CATS, RECIPES, TECHS, MILESTONES, seasonOf, SEASON_DAYS, YEAR_DAYS } from './config.js';
import { mainEl, camCtl, pickAt } from './scene.js';
import { G, canAfford, unlocked, houseCapacity } from './world.js';
import { protos } from './assets.js';
import { carryTotal } from './drops.js';
import { removeEntry } from './buildings.js';
import { ctx } from './context.js';

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

export const UI = {
  curCat: '全部',
  infoEntry: null,       // 当前展示的建筑
  infoVillager: null,    // 当前展示的村民

  initSidebar() {
    const catsEl = document.getElementById('cats');
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.textContent = c;
      if (c === this.curCat) b.className = 'on';
      b.onclick = () => {
        this.curCat = c;
        [...catsEl.children].forEach(x => x.className = '');
        b.className = 'on';
        this.renderList();
      };
      catsEl.appendChild(b);
    });
    const listEl = document.getElementById('list');
    DEFS.forEach(def => {
      const row = document.createElement('div');
      row.className = 'b';
      row.id = 'b-' + def.id;
      row.innerHTML = `<img draggable="false"><div class="tx"><div class="nm">${def.name}</div><div class="cost">${Object.entries(def.cost).map(([r, v]) => v + RES_INFO[r].label).join(' ')}</div></div>`;
      row.onmouseenter = e => UI.showSideTip(def, row);
      row.onmouseleave = () => UI.hideSideTip();
      row.onclick = () => {
        if (!unlocked(def)) {
          toast(def.tech ? '🔒 需在【科技】中研究 ' + ((TECHS.find(t => t.id === def.tech) || {}).name || def.tech) : '🔒 先建造村中心，才能解锁其他建筑');
          return;
        }
        if (canAfford(def)) ctx.startPlacing(def);
        else toast('材料不够：需 ' + Object.entries(def.cost).map(([r, v]) => v + RES_INFO[r].label).join(' '));
      };
      listEl.appendChild(row);
    });
  },

  renderList() {    DEFS.forEach(def => {
      const row = document.getElementById('b-' + def.id);
      if (!row) return;                                   // 侧栏尚未初始化
      const locked = !unlocked(def);
      row.style.display = (this.curCat === '全部' || def.cat === this.curCat) ? 'flex' : 'none';
      row.classList.toggle('poor', locked || !canAfford(def));
      row.classList.toggle('locked', locked);
      const lockEl = row.querySelector('.lk');
      if (locked && !lockEl) {
        const reason = def.tech ? '🔒 需研究 ' + ((TECHS.find(t => t.id === def.tech) || {}).name || def.tech) : '🔒 需村中心';
        row.querySelector('.tx').insertAdjacentHTML('beforeend', `<div class="lk" style="font-size:10px;color:#c98">${reason}</div>`);
      }
      else if (!locked && lockEl) lockEl.remove();
    });
  },

  // 缩略图渲染队列（共用一个离屏渲染器）
  thumbQueue: [],
  startThumbs() {
    DEFS.forEach(d => this.thumbQueue.push(d));
    this.pumpThumb();
  },
  pumpThumb() {
    const def = this.thumbQueue.shift();
    if (!def) return;
    try {
    if (!UI._thumbR) {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setSize(96, 96);
      r.toneMappingExposure = 1.4;
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0xf5f1e6);
      const tl = new THREE.DirectionalLight(0xfff0d8, 2.4); tl.position.set(3, 5, 2);
      sc.add(tl, new THREE.HemisphereLight(0xfff4e2, 0x8a7358, 1), new THREE.AmbientLight(0xffffff, .5));
      const c = new THREE.PerspectiveCamera(40, 1, .01, 100);
      UI._thumbR = { r, sc, c };
    }
    const { r, sc, c } = UI._thumbR;
    const obj = protos[def.id].clone();
    sc.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(ctr.x, box.min.y, ctr.z));
    const dd = Math.max(size.x, size.y, size.z) * 1.9;
    c.position.set(dd * .75, dd * .65, dd * .75);
    c.lookAt(0, size.y * .35, 0);
    c.far = dd * 10;
    c.updateProjectionMatrix();
    r.render(sc, c);
    const img = document.querySelector('#b-' + def.id + ' img');
    if (img) img.src = r.domElement.toDataURL();
    sc.remove(obj);
    } catch (err) { console.error('thumb fail', def.id, err); }
    requestAnimationFrame(() => UI.pumpThumb());
  },

  // 侧栏悬停说明：这张卡是干什么的
  showSideTip(def, row) {
    const tip = document.getElementById('tip');
    const roleTxt = { house: '住房 · 提升人口上限', wood: '生产 · 派村民上工产木', food: '生产 · 派村民上工产食', granary: '粮仓 · 食物上限+25', well: '设施 · 附近民居更满意', happy: '设施 · 提升快乐', market: '设施 · 4木换5食', tower: '设施 · 夜间防狼', deco: '' }[def.role] || def.cat;
    const rcTxt = RECIPES[def.id] ? '<br>⚙ 配方：' + Object.entries(RECIPES[def.id].in).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + ' → ' + Object.entries(RECIPES[def.id].out).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + ' / ' + RECIPES[def.id].time + '秒' : '';
    tip.innerHTML = `<b>${def.name}</b><br><span style="color:#a8d8a0">${roleTxt}${def.cap ? ' · 容量' + def.cap : ''}${def.out ? ' · 产量' + def.out : ''}</span>${rcTxt}<br>${def.desc}<br><span style="color:#a89880">造价：${Object.entries(def.cost).map(([r, v]) => v + RES_INFO[r].label).join(' ')} · ${def.w}×${def.d}</span>`;
    const m = row.getBoundingClientRect(), mm = mainEl.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = '12px';
    tip.style.top = Math.max(8, m.top - mm.top) + 'px';
  },
  hideSideTip() { document.getElementById('tip').style.display = 'none'; },

  refresh() {
    document.getElementById('r-wood').textContent = Math.floor(G.res.wood);
    document.getElementById('r-food').textContent = Math.floor(G.res.food);
    document.getElementById('r-stone').textContent = Math.floor(G.res.stone);
    document.getElementById('r-plank').textContent = Math.floor(G.res.plank || 0);
    document.getElementById('r-bread').textContent = Math.floor(G.res.bread || 0);
    document.getElementById('r-know').textContent = Math.floor(G.res.know || 0);
    document.getElementById('r-happy').textContent = Math.round(G.happy);
    document.getElementById('r-pop').textContent = G.villagers.length;
    document.getElementById('r-cap').textContent = '/' + houseCapacity();
    // 年历：第X年 第X天 · 季节 · 季节进度
    const din = ((G.day - 1) % YEAR_DAYS) + 1;
    const season = seasonOf(G.day);
    const sp = Math.min(100, Math.floor(((din - 1) % SEASON_DAYS + G.time / DAY_SECONDS) / SEASON_DAYS * 100));
    document.getElementById('daybox').textContent = `第 ${G.year || 1}年 第${din}天 · ${season} ${sp}%${season === '冬' ? ' ❄' : ''} · 🏆${(G.milestones && G.milestones.size) || 0}/${MILESTONES.length}`;
    const vl = document.getElementById('vlist');
    vl.innerHTML = G.villagers.map(v => {
      const t = v.task;
      const st = !t ? '待命' : t.kind === 'move' ? '移动' : t.kind === 'chop' ? RES_INFO[t.target.def.yield].icon : t.kind === 'deliver' ? '📦' : t.kind === 'build' ? '🔨' : '🏭';
      return `<div class="v" data-i="${G.villagers.indexOf(v)}"><span>${v.name}</span><span>${st}</span></div>`;
    }).join('');
    vl.querySelectorAll('.v').forEach(row => {
      row.onclick = () => {
        const v = G.villagers[+row.dataset.i];
        if (!v) return;
        ctx.Input.clearSelection();
        G.selected.add(v);
        v.ring.visible = true;
        UI.selectionChanged();
        camCtl.target.copy(v.obj.position);
        camCtl.apply();
      };
    });
    this.renderList();
    if (this.infoEntry && !G.placed.includes(this.infoEntry)) this.hideInfo();
  },

  selectionChanged() {
    const el = document.getElementById('selbox');
    el.style.display = G.selected.size ? 'inline' : 'none';
    el.textContent = '已选 ' + G.selected.size + ' 人';
    document.getElementById('vlist').querySelectorAll('.v').forEach((row, i) => row.classList.toggle('sel', G.selected.has(G.villagers[i])));
    if (G.selected.size === 1) this.showVillagerInfo([...G.selected][0]);
    else if (G.selected.size === 0 && this.infoVillager) this.hideInfo();
  },

  showVillagerInfo(v) {
    this.infoVillager = v;
    this.infoEntry = null;
    const el = document.getElementById('info');
    el.style.display = 'block';
    const t = v.task;
    const taskTxt = !t ? '🚶 待命' : t.kind === 'move' ? '🚶 移动中'
      : t.kind === 'chop' ? (t.target.def.yield === 'wood' ? '🪓 砍' : t.target.def.yield === 'stone' ? '⛏ 采' : '🍎 采') + t.target.def.name
      : t.kind === 'deliver' ? '📦 送货入库'
      : t.kind === 'build' ? '🔨 建造 ' + (t.target.def?.name || '')
      : '🏭 ' + (t.target.def?.name || '');
    const carryTxt = carryTotal(v) ? '携带：' + Object.entries(v.carry).filter(([,n])=>n).map(([r,n]) => RES_INFO[r].icon + n).join(' ') : '';
    el.innerHTML = `<b>${v.name}</b><br><span style="color:#a89880;font-size:11px">村民 · 搬运上限 ${CARRY_CAP}</span><br>当前：${taskTxt}<br>${carryTxt}<button id="btn-stoptask">取消任务</button>`;
    document.getElementById('btn-stoptask').onclick = () => { v.task = null; this.showVillagerInfo(v); };
  },

  showBuildingInfo(entry) {
    ctx.Input.clearSelection();
    this.infoEntry = entry;
    this.infoVillager = null;
    const el = document.getElementById('info');
    el.style.display = 'block';
    const d = entry.def;
    const workers = G.villagers.filter(v => v.task && v.task.target === entry).length;
    const trade = d.role === 'market' && G.res.wood >= 4 ? '<button id="btn-trade">4 木换 5 食</button>' : '';
    const rc = RECIPES[d.id];
    const rcTxt = rc ? '⚙ 配方：' + Object.entries(rc.in).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + ' → ' + Object.entries(rc.out).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + ' / ' + rc.time + '秒<br>进度 ' + Math.floor(((entry.prodT || 0) / rc.time) * 100) + '%<br>' : '';
    const assignBtn = rc && G.selected.size ? `<button id="btn-assign">派选中 ${G.selected.size} 人上工</button>` : '';
    el.innerHTML = `<b>${d.name}</b><br><span style="color:#a89880;font-size:11px">${d.cat} · ${d.w}×${d.d} · 拖拽可搬移</span><br>${d.desc}<br>${rcTxt}在岗：${workers} 人${trade}${assignBtn}<button id="btn-del">拆除</button>`;
    document.getElementById('btn-del').onclick = () => { removeEntry(entry); this.hideInfo(); };
    const ba = document.getElementById('btn-assign');
    if (ba) ba.onclick = () => {
      for (const v of [...G.selected]) { v.task = { kind: 'work', target: entry, workT: 0 }; v.ring.visible = false; }
      G.selected.clear();
      this.selectionChanged();
      this.showBuildingInfo(entry);
      toast('🏭 派工完成');
    };
    const bt = document.getElementById('btn-trade');
    if (bt) bt.onclick = () => {
      if (G.res.wood >= 4) { G.res.wood -= 4; G.res.food = Math.min(G.foodCap, G.res.food + 5); toast('🛒 -4 木 +5 食'); UI.refresh(); }
    };
  },

  hideInfo() { document.getElementById('info').style.display = 'none'; this.infoEntry = this.infoVillager = null; },

  // 科技面板：研究消耗知识📘，解锁进阶建筑
  toggleTech() {
    const el = document.getElementById('tech');
    if (el.style.display === 'block') { el.style.display = 'none'; return; }
    this.hideInfo();
    el.style.display = 'block';
    this.renderTech();
  },
  renderTech() {
    const el = document.getElementById('tech');
    el.innerHTML = `<b>🔬 科技（知识 ${Math.floor(G.res.know || 0)}）</b>` + TECHS.map(t => {
      const done = G.tech.has(t.id);
      const can = !done && (G.res.know || 0) >= t.cost;
      return `<div class="trow ${done ? 'done' : can ? 'can' : ''}"><span>${done ? '✓' : '📘' + t.cost} ${t.name}</span><span style="color:var(--dim);font-size:10px">${t.desc}</span>${done ? '' : `<button data-t="${t.id}" ${can ? '' : 'disabled'}>研究</button>`}</div>`;
    }).join('') + `<b style="display:block;margin-top:8px">🏆 里程碑 ${G.milestones.size}/${MILESTONES.length}</b>` + MILESTONES.map(m =>
      `<div class="trow ${G.milestones.has(m.id) ? 'done' : ''}"><span>${G.milestones.has(m.id) ? '✓' : '○'} ${m.name}</span><span style="color:var(--dim);font-size:10px">${m.desc}</span></div>`
    ).join('') + `<div style="text-align:right"><button id="btn-techclose">关闭</button></div>`;
    el.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => {
      const t = TECHS.find(x => x.id === b.dataset.t);
      if (!t || G.tech.has(t.id) || (G.res.know || 0) < t.cost) return;
      G.res.know -= t.cost;
      G.tech.add(t.id);
      toast('🔬 研究完成：' + t.name + '（' + t.unlock.map(id => (DEFS.find(d => d.id === id) || {}).name || id).join('/') + ' 解锁）');
      this.renderTech();
      this.renderList();
    });
    document.getElementById('btn-techclose').onclick = () => el.style.display = 'none';
  },

  hoverTip(e) {
    const tip = document.getElementById('tip');
    const nat = pickAt(e, G.nature, true);
    const site = nat ? null : pickAt(e, G.sites);
    const bld = (nat || site) ? null : pickAt(e, G.placed);
    const vil = (nat || bld || site) ? null : pickAt(e, G.villagers);
    if (!nat && !bld && !vil && !site) { tip.style.display = 'none'; return; }
    const m = mainEl.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX - m.left + 14, m.width - 260) + 'px';
    tip.style.top = Math.min(e.clientY - m.top + 10, m.height - 90) + 'px';
    if (site) {
      const r = Math.min(1, site.progress / site.need);
      tip.innerHTML = `<b>🏗 ${site.def.name} 工地</b><br>进度 ${Math.floor(r * 100)}%${site.builder ? '' : '<br><span style="color:#c98">等待村民建造…</span>'}`;
    }
    else if (nat) tip.innerHTML = `<b>${nat.def.name}</b><br>剩余 ${nat.hp} 次 · ${RES_INFO[nat.def.yield].icon}+${nat.def.amt}/次<br><span style="color:#a89880">选村民后右键或框选派工</span>`;
    else if (bld) {
      const rc = RECIPES[bld.def.id];
      const rcTxt = rc ? '<br>⚙ ' + Object.entries(rc.in).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + ' → ' + Object.entries(rc.out).map(([r, v]) => v + RES_INFO[r].icon).join(' ') + '（缺原料会停工）' : '';
      tip.innerHTML = `<b>${bld.def.name}</b><br>${bld.def.desc}${rcTxt}<br><span style="color:#a89880">点击看详情 · 拖拽可搬移${bld.def.role === 'wood' || bld.def.role === 'food' ? ' · 选村民右键它=上工' : ''}</span>`;
    }
    else tip.innerHTML = `<b>${vil.name}</b><br>${vil.task ? '忙' : '待命'} · 点击选中`;
  },
};
