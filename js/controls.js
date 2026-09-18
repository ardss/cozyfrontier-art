/* =====================================================================
 * 14. 暂停与倍速（S1）—— gameState 供主循环消费，控制条 UI 与快捷键
 * 空格 = 暂停/继续，1/2/3 = 0.5×/1×/2×。暂停只停模拟，相机/菜单照常。
 * ===================================================================*/
import { saveGame, loadGame, clearSave } from './save.js';
import { ctx } from './context.js';

export const gameState = { paused: false, speed: 1 };
const SPEEDS = [0.5, 1, 2];

let pauseBtn = null, spdBtn = null;
function refreshHud() {
  if (pauseBtn) pauseBtn.textContent = gameState.paused ? '继续' : '暂停';
  if (spdBtn) spdBtn.textContent = gameState.speed + '×';
}
function setSpeed(s) { gameState.speed = s; refreshHud(); }
function togglePause() { gameState.paused = !gameState.paused; refreshHud(); }

export function setupControls() {
  pauseBtn = document.getElementById('btn-pause');
  spdBtn = document.getElementById('btn-spd');
  if (pauseBtn) pauseBtn.onclick = togglePause;
  if (spdBtn) spdBtn.onclick = () => {
    const i = SPEEDS.indexOf(gameState.speed);
    setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  };
  const onSave = document.getElementById('btn-save');
  const onLoad = document.getElementById('btn-load');
  const onNew = document.getElementById('btn-new');
  if (onSave) onSave.onclick = () => ctx.toast && ctx.toast(saveGame() ? '已保存到本地存档' : '保存失败');
  if (onLoad) onLoad.onclick = () => ctx.toast && ctx.toast(loadGame() ? '已读取存档' : '读取失败或无存档');
  if (onNew) onNew.onclick = () => { clearSave(); location.reload(); };
  addEventListener('keydown', e => {
    if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (e.key === '1') setSpeed(0.5);
    else if (e.key === '2') setSpeed(1);
    else if (e.key === '3') setSpeed(2);
  });
  refreshHud();
}
