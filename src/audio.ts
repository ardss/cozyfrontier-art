/* =====================================================================
 * 15. 音频系统（S33）—— WebAudio 纯程序化合成，零音频资产，cozy 低音量
 * 首次用户手势（开始按钮）时 init()；所有方法静默容错，未 init/异常直接返回。
 * 环境音：setInterval 每 8-15 秒随机触发（白天鸟鸣 / 冬季风垫），暂停时静默。
 * ===================================================================*/
import { G } from './world';
import { gameState } from './controls';
import { seasonOf } from './config';
import { Events } from './events';

let ac = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('cf_muted') === '1'; } catch (e) { }

function tone(freq, dur, { type = 'sine', vol = .5, when = 0, slide = 0 } = {}) {
  const t0 = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + .05);
}
function noise(dur, { vol = .4, freq = 1200, q = 1, type = 'bandpass', when = 0, sweep = 0 } = {}) {
  const t0 = ac.currentTime + when;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0); src.stop(t0 + dur + .05);
}

export const Sfx: any = {
  init() {
    try {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.25;                 // cozy：整体音量压低
      master.connect(ac.destination);
      const len = ac.sampleRate * 1.2;                      // 共享白噪声缓冲
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      Sfx._ambient();
    } catch (e) { ac = null; }
  },
  setMuted(b) {
    muted = b;
    try { if (master) master.gain.value = b ? 0 : 0.25; localStorage.setItem('cf_muted', b ? '1' : '0'); } catch (e) { }
  },
  toggleMuted() { Sfx.setMuted(!muted); return muted; },
  get muted() { return muted; },

  chop() {                                                // 砍伐：短促滤波噪声 + 低频冲击
    try {
      if (!ac) return;
      noise(.12, { vol: .5, freq: 2600, q: .8, sweep: -1800 });
      tone(90, .16, { type: 'triangle', vol: .55, slide: -45 });
    } catch (e) { }
  },
  place() {                                               // 放置：轻柔低敲
    try {
      if (!ac) return;
      tone(220, .14, { type: 'sine', vol: .5, slide: -60 });
      noise(.06, { vol: .18, freq: 900, q: 2 });
    } catch (e) { }
  },
  build() {                                               // 建造：两下木鱼式敲击
    try {
      if (!ac) return;
      tone(340, .09, { type: 'triangle', vol: .45 });
      tone(260, .12, { type: 'triangle', vol: .45, when: .12 });
    } catch (e) { }
  },
  harvest() {                                             // 收获：上扬双音
    try {
      if (!ac) return;
      tone(523, .12, { type: 'sine', vol: .4 });
      tone(784, .18, { type: 'sine', vol: .38, when: .09 });
    } catch (e) { }
  },
  coin() {                                                // 金币：清脆双音
    try {
      if (!ac) return;
      tone(1318, .09, { type: 'square', vol: .16 });
      tone(1760, .14, { type: 'square', vol: .14, when: .07 });
    } catch (e) { }
  },
  festival() {                                            // 节日：三连上行琶音
    try {
      if (!ac) return;
      [523, 659, 784].forEach((f, i) => tone(f, .22, { type: 'triangle', vol: .35, when: i * .11 }));
      tone(1046, .35, { type: 'sine', vol: .3, when: .33 });
    } catch (e) { }
  },
  night() {                                               // 夜幕：柔和低音垫
    try {
      if (!ac) return;
      tone(130, 1.6, { type: 'sine', vol: .3 });
      tone(196, 1.8, { type: 'sine', vol: .2, when: .1 });
      noise(1.8, { vol: .05, freq: 300, q: .5, type: 'lowpass' });
    } catch (e) { }
  },

  _ambient() {                                            // 环境音：8-15s 随机触发
    const tick = () => {
      try {
        if (ac && !muted && !gameState.paused && !G.over) {
          if (seasonOf(G.day) === '冬') {                    // 冬季：风声噪声垫
            noise(2.6, { vol: .06, freq: 500, q: .4, type: 'lowpass', sweep: 350 });
          } else {                                        // 白天：高频短颤鸟鸣
            const base = 2200 + Math.random() * 1400;
            for (let i = 0; i < 3; i++) tone(base + Math.random() * 500, .07, { type: 'sine', vol: .12, when: i * .12, slide: 400 });
          }
        }
      } catch (e) { }
      Sfx._ambient.tid = setTimeout(tick, 8000 + Math.random() * 7000);
    };
    Sfx._ambient.tid = setTimeout(tick, 6000);
  },
};

/* ---- 夜幕音效（原 main.js nightTick 包装平移；晚于声望结算、早于故事/来信） ---- */
Events.on('night', () => Sfx.night(), 20);
