/* =====================================================================
 * S38. 气候与风向可视化 —— 风 + 树冠摇摆 + 雨/雪粒子 + 光照雾联动
 * 仅视觉：粒子不持久化，雨天每日开局 15% 掷骰（模块内即可）
 * ===================================================================*/
import * as THREE from 'three';
import { GRID, isWinterDay } from './config';
import { scene, sun } from './scene';
import { G } from './world';

/* ---- 风：基础值 + 20~40s 正弦缓变，cozy 幅度很小 ---- */
const WIND_PERIOD = 30;                 // 秒（20~40s 区间中值）
const WIND_BASE = 0.35, WIND_AMP = 0.3; // 归一化风力 0~0.65 左右
let windT = Math.random() * 100;
let wind = WIND_BASE;                   // 当前风力（导出只读用）

/* ---- 树摇摆：G.nature 中的树（clone 实例，rotation.z 每帧直接赋值，代价低） ----
 * 每株随机相位；只对树类（type 以 tree 开头或 dead）生效，幅度 ~0.02 rad */
const SWAY_TYPES = new Set(['tree', 'tree2', 'tree3', 'dead']);
const SWAY_AMP = 0.022, SWAY_FREQ = 1.6;
let phases = null;                      // 与 G.nature 索引对齐的相位表（懒建 + 增量补）
function ensurePhases() {
  if (!phases) phases = [];
  while (phases.length < G.nature.length) phases.push(Math.random() * Math.PI * 2);
}

/* ---- 雨/雪粒子：单个 THREE.Points，600 个，围绕相机目标区循环下落 ---- */
const P_COUNT = 600;
const AREA = GRID + 8;                  // 粒子散布范围
const RAIN_FALL = 14, SNOW_FALL = 1.6;  // 下落速度（单位/秒）
let points = null, pos = null, vel = null, mode = 'none';   // mode: none|rain|snow
const BASE_FOG = { near: 40, far: 95, sun: 2.4 };           // 取自 scene.js 初始值
let weatherOn = false;                  // 当前是否处于雨/雪（光照已调暗）

function makePoints(isSnow) {
  pos = new Float32Array(P_COUNT * 3);
  vel = new Float32Array(P_COUNT);
  for (let i = 0; i < P_COUNT; i++) {
    pos[i * 3] = Math.random() * AREA - AREA / 2 + GRID / 2;
    pos[i * 3 + 1] = Math.random() * 16;
    pos[i * 3 + 2] = Math.random() * AREA - AREA / 2 + GRID / 2;
    vel[i] = 0.7 + Math.random() * 0.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: isSnow ? 0xffffff : 0x9db8d8,
    size: isSnow ? 0.16 : 0.07,
    transparent: true, opacity: isSnow ? 0.75 : 0.45,
    depthWrite: false, sizeAttenuation: true,
  });
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
}

function setMode(m) {
  if (m === mode) return;
  if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); points = null; }
  mode = m;
  if (m !== 'none') makePoints(m === 'snow');
  applyLight(m !== 'none');
}

/* ---- 光照联动：雨/雪时雾距离 -15%，平行光 -20%（离开时恢复） ---- */
function applyLight(on) {
  if (on === weatherOn) return;
  const f = scene.fog;
  if (on) {
    f.near = BASE_FOG.near * 0.85; f.far = BASE_FOG.far * 0.85;
    sun.intensity = BASE_FOG.sun * 0.8;
  } else {
    f.near = BASE_FOG.near; f.far = BASE_FOG.far;
    sun.intensity = BASE_FOG.sun;
  }
  weatherOn = on;
}

/* ---- 每日天气掷骰：冬季必雪，其余 15% 概率雨 ---- */
let rolledDay = -1;
function rollDay() {
  if (rolledDay === G.day) return;
  rolledDay = G.day;
  if (isWinterDay(G.day)) setMode('snow');
  else setMode(Math.random() < 0.15 ? 'rain' : 'none');
}

export function initWeather() {
  ensurePhases();
  applyLight(false);      // 复位雾/光到基线，防读档等场景残留
  rolledDay = -1;
  rollDay();
}

export function stepWeather(dt) {
  // 风力缓变
  windT += dt;
  wind = WIND_BASE + WIND_AMP * Math.sin(windT * Math.PI * 2 / WIND_PERIOD);
  // 树摇摆（树为 clone 实例，直接赋 rotation.z；每 2 帧一次省一半开销）
  if (((stepWeather as any)._f = ((stepWeather as any)._f || 0) + 1) % 2 === 0) {
    ensurePhases();
    const t = windT;
    for (let i = 0; i < G.nature.length; i++) {
      const n = G.nature[i];
      if (!n.alive || !SWAY_TYPES.has(n.type) || !n.inst) continue;
      n.inst.rotation.z = wind * SWAY_AMP * 4 * Math.sin(t * SWAY_FREQ + phases[i]);
    }
  }
  // 每日天气
  rollDay();
  // 粒子更新
  if (!points) return;
  const fall = (mode === 'snow' ? SNOW_FALL : RAIN_FALL);
  const wOff = wind * (mode === 'snow' ? 2.2 : 0.6);   // 雪横向风偏移更明显
  const arr = pos;
  for (let i = 0; i < P_COUNT; i++) {
    const j = i * 3;
    arr[j + 1] -= fall * vel[i] * dt;
    if (mode === 'snow') arr[j] += wOff * vel[i] * dt * Math.sin(windT * 2 + i);
    if (arr[j + 1] < 0) {                                // 循环重生到顶部
      arr[j] = Math.random() * AREA - AREA / 2 + GRID / 2;
      arr[j + 1] = 14 + Math.random() * 4;
      arr[j + 2] = Math.random() * AREA - AREA / 2 + GRID / 2;
    }
  }
  points.geometry.attributes.position.needsUpdate = true;
}

export const windNow = () => wind;
