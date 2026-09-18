/* =====================================================================
 * 9. 输入状态机
 *    idle → maybeSelect → boxSelect
 *    idle → placing（建造）
 *    idle → movingBuilding（搬移）
 *    any  → panning（中键）
 * ===================================================================*/
import * as THREE from 'three';
import { CELL_SINK, DRAG_TOLERANCE, RES_INFO } from './config.js';
import { mainEl, dom, cam, camCtl, buildGrid, raycaster, groundPlane, toGround, pickAt } from './scene.js';
import { G, footprint, cellsOf, canPlace, clampCell, canAfford, pay } from './world.js';
import { makePad, showGhost, hideGhost, updateGhost, createSite, ghostOK, ghostBad } from './buildings.js';
import { command } from './villagers.js';
import { ctx } from './context.js';

const S = {
  mode: 'idle',            // idle | maybeSelect | boxSelect | placing | movingBuilding | panning
  placingDef: null,        // 建造中的建筑定义
  rot: 0, cell: { x: 0, z: 0 },
  moving: null,            // 搬移中的建筑 entry
  downAt: null,
};
const keys = {};

function setBuildGridVisible(on) { buildGrid.visible = on; }

export function startPlacing(def) {
  cancelPlacing();
  S.placingDef = def;
  S.rot = 0;
  S.mode = 'placing';
  setBuildGridVisible(true);
  showGhost(def);
  document.querySelectorAll('.b').forEach(e => e.classList.remove('sel'));
  document.getElementById('b-' + def.id).classList.add('sel');
  dom.style.cursor = 'copy';
}
function cancelPlacing() {
  S.placingDef = null;
  if (S.mode === 'placing') S.mode = 'idle';
  setBuildGridVisible(false);
  hideGhost();
  document.querySelectorAll('.b').forEach(e => e.classList.remove('sel'));
  dom.style.cursor = 'default';
}
function startMoving(entry) {
  cancelPlacing();
  S.moving = entry;
  S.rot = entry.rot;
  S.mode = 'movingBuilding';
  setBuildGridVisible(true);
}
function finishMoving(commit) {
  const m = S.moving;
  if (!m) return;
  if (commit && S.movingValid) {
    cellsOf(m.def, m.x, m.z, m.rot).forEach(k => { if (G.occ.get(k) === m) G.occ.delete(k); });
    m.x = S.cell.x; m.z = S.cell.z; m.rot = S.rot;
    const [w, d] = footprint(m.def, m.rot);
    m.inst.position.set(m.x + w / 2, CELL_SINK, m.z + d / 2);
    m.inst.rotation.y = m.rot * Math.PI / 2;
    m.pad.position.set(m.x, 0, m.z);
    m.pad.clear();
    m.pad.add(makePad(m.def, m.rot).children[0].clone());
    cellsOf(m.def, m.x, m.z, m.rot).forEach(k => G.occ.set(k, m));
  } else {
    m.inst.position.set(m.x + footprint(m.def, m.rot)[0] / 2, CELL_SINK, m.z + footprint(m.def, m.rot)[1] / 2);
    m.inst.rotation.y = m.rot * Math.PI / 2;
  }
  m.inst.traverse(o => { if (o.isMesh && o.userData.origMat) o.material = o.userData.origMat; });
  S.moving = null;
  S.mode = 'idle';
  setBuildGridVisible(false);
}
function beginDragMove(e, entry) {
  startMoving(entry);
  entry.inst.traverse(o => { if (o.isMesh) { o.userData.origMat = o.material; o.material = ghostOK; } });
  stepDragMove(e);
}
function stepDragMove(e) {
  if (e && e.clientX !== undefined) S.lastMoveEv = e;
  const m = S.moving;
  if (!m) return;
  const pt = toGround(S.lastMoveEv || e);
  if (!pt) return;
  S.cell = clampCell(m.def, Math.floor(pt.x), Math.floor(pt.z), S.rot);
  const [w, d] = footprint(m.def, S.rot);
  m.inst.position.set(S.cell.x + w / 2, .05, S.cell.z + d / 2);
  m.inst.rotation.y = S.rot * Math.PI / 2;
  S.movingValid = canPlace(m.def, S.cell.x, S.cell.z, S.rot, m);
  const mat = S.movingValid ? ghostOK : ghostBad;
  m.inst.traverse(o => { if (o.isMesh && o.userData.origMat) o.material = mat; });
}

const selrect = document.getElementById('selrect');
function inMainViewport(e) {
  const r = dom.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

addEventListener('pointerdown', e => {
  if (e.target !== dom || G.over) return;
  S.downAt = { x: e.clientX, y: e.clientY };
  try { dom.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.button === 2) return;                       // 右键在 up 时发指令
  if (e.button === 1) { S.mode = 'panning'; e.preventDefault(); return; }
  if (e.button !== 0) return;
  if (S.mode === 'placing') return;
  // 按在建筑上 → 待定（拖拽=搬移，点击=信息面板）
  const bld = pickAt(e, G.placed);
  if (bld) { S.mode = 'maybeMove'; S.moving = bld; S.rot = bld.rot; return; }
  S.mode = 'maybeSelect';
});
addEventListener('pointermove', e => {
  if (G.over) return;
  if ((S.mode === 'maybeSelect' || S.mode === 'maybeMove') && S.downAt &&
      (Math.abs(e.clientX - S.downAt.x) > DRAG_TOLERANCE || Math.abs(e.clientY - S.downAt.y) > DRAG_TOLERANCE)) {
    if (S.mode === 'maybeMove') beginDragMove(e, S.moving);
    else S.mode = 'boxSelect';
  }
  switch (S.mode) {
    case 'boxSelect': {
      const m = mainEl.getBoundingClientRect();
      selrect.style.display = 'block';
      selrect.style.left = Math.min(S.downAt.x, e.clientX) - m.left + 'px';
      selrect.style.top = Math.min(S.downAt.y, e.clientY) - m.top + 'px';
      selrect.style.width = Math.abs(e.clientX - S.downAt.x) + 'px';
      selrect.style.height = Math.abs(e.clientY - S.downAt.y) + 'px';
      return;
    }
    case 'movingBuilding': stepDragMove(e); return;
    case 'placing': {
      if (!inMainViewport(e)) return;
      const pt = toGround(e);
      if (pt && S.placingDef) {
        S.cell = clampCell(S.placingDef, Math.floor(pt.x), Math.floor(pt.z), S.rot);
        updateGhost(S.placingDef, S.cell, S.rot);
      }
      return;
    }
    case 'panning': {
      if (e.movementX || e.movementY) {
        const sp = camCtl.r * .0016, f = camCtl.fwd(), r = camCtl.right();
        camCtl.pan(-e.movementX * sp * r.x + e.movementY * sp * f.x,
                   -e.movementX * sp * r.z + e.movementY * sp * f.z);
      }
      return;
    }
    case 'idle': {
      if (!inMainViewport(e)) return;
      ctx.UI && ctx.UI.hoverTip(e);
      return;
    }
  }
});
addEventListener('pointerup', e => {
  if (G.over) return;
  selrect.style.display = 'none';
  const wasClick = S.downAt && Math.abs(e.clientX - S.downAt.x) < DRAG_TOLERANCE && Math.abs(e.clientY - S.downAt.y) < DRAG_TOLERANCE;

  if (e.button === 2) {
    if (S.mode === 'movingBuilding') { finishMoving(false); }
    else if (G.selected.size) Input.issueCommand(e);
    S.mode = S.placingDef ? 'placing' : 'idle';
    S.downAt = null;
    return;
  }
  if (e.button === 1) {                              // 中键平移结束：必须复位模式
    S.mode = S.placingDef ? 'placing' : 'idle';
    S.downAt = null;
    return;
  }
  if (S.mode === 'boxSelect') {
    Input.selectInScreenRect(S.downAt, e);
  } else if (S.mode === 'maybeSelect' && wasClick && e.button === 0) {
    Input.clickSelect(e);
  } else if (S.mode === 'maybeMove' && wasClick && e.button === 0) {
    ctx.UI.showBuildingInfo(S.moving);               // 点建筑：信息面板
    S.moving = null;
  } else if (S.mode === 'movingBuilding') {
    finishMoving(true);                              // 拖拽搬移：提交新位置
  } else if (S.mode === 'placing' && wasClick && e.button === 0 && S.placingDef) {
    if (canPlace(S.placingDef, S.cell.x, S.cell.z, S.rot) && canAfford(S.placingDef)) {
      pay(S.placingDef);
      createSite(S.placingDef, S.cell.x, S.cell.z, S.rot);
      ctx.toast('🏗 ' + S.placingDef.name + ' 工地开工（等待村民建造）');
      cancelPlacing();
      ctx.UI.refresh();
    }
  }
  if (S.mode !== 'panning') S.mode = S.placingDef ? 'placing' : 'idle';
  S.downAt = null;
});
addEventListener('dragstart', e => e.preventDefault());
dom.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'escape') { cancelPlacing(); Input.clearSelection(); ctx.UI.hideInfo(); return; }
  if (['w','a','s','d','q','e','r'].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === 'r' && S.placingDef) {
    S.rot = (S.rot + 1) % 4;
    S.cell = clampCell(S.placingDef, S.cell.x, S.cell.z, S.rot);
    updateGhost(S.placingDef, S.cell, S.rot);
  }
  if (k === 'r' && S.mode === 'movingBuilding' && S.moving) {
    S.rot = (S.rot + 1) % 4;
    stepDragMove();                                  // 用上次指针位置重算
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
dom.addEventListener('wheel', e => {
  e.preventDefault();
  camCtl.r = THREE.MathUtils.clamp(camCtl.r + e.deltaY * .02, 7, 55);
  camCtl.apply();
}, { passive: false });
document.getElementById('zin').onclick  = () => { camCtl.r = Math.max(7, camCtl.r - 4); camCtl.apply(); };
document.getElementById('zout').onclick = () => { camCtl.r = Math.min(55, camCtl.r + 4); camCtl.apply(); };

// 键盘相机
export function stepCameraKeys() {
  const sp = camCtl.r * .02, f = camCtl.fwd(), r = camCtl.right();
  if (keys.w) camCtl.pan( f.x * sp,  f.z * sp);
  if (keys.s) camCtl.pan(-f.x * sp, -f.z * sp);
  if (keys.d) camCtl.pan( r.x * sp,  r.z * sp);
  if (keys.a) camCtl.pan(-r.x * sp, -r.z * sp);
  if (keys.q) { camCtl.theta += .03; camCtl.apply(); }
  if (keys.e) { camCtl.theta -= .03; camCtl.apply(); }
}

// 指令与选择（从输入事件里剥离出来的游戏语义）
export const Input = {
  issueCommand(e) {
    const nat = pickAt(e, G.nature, true);
    if (nat) {
      G.selected.forEach(v => command(v, 'chop', nat));
      ctx.toast(`${nat.def.name} ×${G.selected.size} 人前往（${RES_INFO[nat.def.yield].label}）`);
      return;
    }
    const site = pickAt(e, G.sites);
    if (site) {
      G.selected.forEach(v => command(v, 'build', site));
      ctx.toast(`派 ${G.selected.size} 人去工地`);
      return;
    }
    const bld = pickAt(e, G.placed);
    if (bld && (bld.def.role === 'wood' || bld.def.role === 'food')) {
      G.selected.forEach(v => command(v, 'work', bld));
      ctx.toast(`派 ${G.selected.size} 人到 ${bld.def.name} 上工`);
      return;
    }
    const pt = toGround(e);
    if (pt) {
      let i = 0;
      G.selected.forEach(v => {
        const a = (i++ / G.selected.size) * Math.PI * 2;
        command(v, 'move', new THREE.Vector3(pt.x + Math.cos(a) * .5, 0, pt.z + Math.sin(a) * .5));
      });
    }
  },
  selectInScreenRect(downAt, e) {
    const r = dom.getBoundingClientRect();
    const x1 = Math.min(downAt.x, e.clientX), x2 = Math.max(downAt.x, e.clientX);
    const y1 = Math.min(downAt.y, e.clientY), y2 = Math.max(downAt.y, e.clientY);
    // 先看框内有没有村民
    const p = new THREE.Vector3();
    const vils = [];
    for (const v of G.villagers) {
      p.copy(v.obj.position); p.y = .5; p.project(cam);
      const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height;
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) vils.push(v);
    }
    if (vils.length) {
      this.clearSelection();
      for (const v of vils) { G.selected.add(v); v.ring.visible = true; }
      ctx.UI.selectionChanged();
      ctx.toast('已选中 ' + vils.length + ' 人，右键派活');
      return;
    }
    // 有选中村民时，框资源 = 派去采集；框空地 = 移动
    if (G.selected.size) {
      const nodes = [];
      for (const n of G.nature) {
        if (!n.alive) continue;
        p.copy(n.inst.position); p.y = .5; p.project(cam);
        const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height;
        if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) nodes.push(n);
      }
      if (nodes.length) {
        let i = 0;
        G.selected.forEach(v => command(v, 'chop', nodes[i++ % nodes.length]));
        ctx.toast(`📋 框选派工：${nodes.length} 个资源 × ${G.selected.size} 人`);
        return;
      }
      const gpt = this._rectCenterGround(x1, y1, x2, y2);
      if (gpt) {
        let i = 0;
        G.selected.forEach(v => {
          const a = (i++ / G.selected.size) * Math.PI * 2;
          command(v, 'move', new THREE.Vector3(gpt.x + Math.cos(a) * .5, 0, gpt.z + Math.sin(a) * .5));
        });
        ctx.toast('移动');
      }
      return;
    }
    // 没选村民时框资源 = 一键自动派工：最近的空闲村民轮流上岗
    const nodes = [];
    for (const n of G.nature) {
      if (!n.alive) continue;
      p.copy(n.inst.position); p.y = .5; p.project(cam);
      const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height;
      if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) nodes.push(n);
    }
    if (nodes.length) {
      const cx = nodes.reduce((s, n) => s + n.inst.position.x, 0) / nodes.length;
      const cz = nodes.reduce((s, n) => s + n.inst.position.z, 0) / nodes.length;
      const idle = G.villagers.filter(v => !v.task)
        .sort((a, b) => Math.hypot(a.obj.position.x - cx, a.obj.position.z - cz) - Math.hypot(b.obj.position.x - cx, b.obj.position.z - cz))
        .slice(0, nodes.length);
      if (!idle.length) { ctx.toast('😶 没有空闲村民——先让人歇会儿或取消任务'); return; }
      let i = 0;
      for (const v of idle) command(v, 'chop', nodes[i++ % nodes.length]);
      ctx.toast(`🪓 自动派工：${idle.length} 名空闲村民 → ${nodes.length} 个资源`);
      return;
    }
    ctx.UI.selectionChanged();
  },
  _rectCenterGround(x1, y1, x2, y2) {
    const r = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (((x1 + x2) / 2 - r.left) / r.width) * 2 - 1,
      -(((y1 + y2) / 2 - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cam);
    const pt = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, pt) ? { x: pt.x, z: pt.z } : null;
  },
  clickSelect(e) {
    const vil = pickAt(e, G.villagers);
    if (vil) {
      if (e.shiftKey) {
        G.selected.has(vil) ? (G.selected.delete(vil), vil.ring.visible = false) : (G.selected.add(vil), vil.ring.visible = true);
      } else {
        this.clearSelection(); G.selected.add(vil); vil.ring.visible = true;
      }
      ctx.UI.selectionChanged();
      return;
    }
    const bld = pickAt(e, G.placed);
    if (bld) { ctx.UI.showBuildingInfo(bld); return; }
    this.clearSelection();
    ctx.UI.hideInfo();
  },
  clearSelection() {
    G.selected.forEach(v => v.ring.visible = false);
    G.selected.clear();
    ctx.UI.selectionChanged();
  },
};
