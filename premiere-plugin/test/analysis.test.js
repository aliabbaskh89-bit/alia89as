/* Run: node test/analysis.test.js  (needs ffmpeg on PATH) */
'use strict';
const A = require('../js/analysis.js');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alikit-test-'));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 30 });
function decode(file, rate = 8000) {
  const b = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}
function rms(samples, rate, win) {
  const n = Math.round(rate * win), out = new Float32Array(Math.ceil(samples.length / n));
  for (let w = 0; w < out.length; w++) {
    let s = 0, c = 0;
    for (let i = w * n; i < Math.min(samples.length, (w + 1) * n); i++) { s += samples[i] ** 2; c++; }
    const r = Math.sqrt(s / Math.max(1, c)); out[w] = r > 0 ? 20 * Math.log10(r) : -120;
  }
  return out;
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓', name); }

/* "speech" = noisy tone bursts, "silence" = faint noise floor */
function speechAudio(file, pattern) {
  // pattern: [[seconds, on(bool)], ...]
  const parts = pattern.map(([d, on], i) => `${on ? `sine=f=${180 + i * 20}:d=${d},volume=0.5` : `anoisesrc=d=${d}:a=0.002`}[p${i}]`);
  const filter = parts.join(';') + ';' + pattern.map((_, i) => `[p${i}]`).join('') + `concat=n=${pattern.length}:v=0:a=1`;
  ff(['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-filter_complex', filter, '-ar', '16000', '-ac', '1', file]);
}

test('silence detection finds the gaps', () => {
  const f = path.join(tmp, 'speech.wav');
  speechAudio(f, [[2, 1], [1.5, 0], [3, 1], [0.3, 0], [2, 1], [2, 0]]);
  const db = rms(decode(f), 8000, 0.05);
  const thr = A.autoThreshold(db, 8);
  const r = A.silences(db, 0.05, { threshold: thr, minSilence: 0.45, padding: 0.1, totalEnd: 10.8 });
  assert.strictEqual(r.length, 2, 'expected 2 removable silences (0.3s gap is too short): ' + JSON.stringify(r));
  assert.ok(Math.abs(r[0][0] - 2.1) < 0.08 && Math.abs(r[0][1] - 3.4) < 0.08, 'first gap ' + r[0]);
  assert.ok(Math.abs(r[1][0] - 8.9) < 0.08 && Math.abs(r[1][1] - 10.8) < 0.08, 'tail ' + r[1]);
});

test('speaker detection switches cameras with min shot length', () => {
  const a = path.join(tmp, 'micA.wav'), b = path.join(tmp, 'micB.wav');
  // A talks 0-4, B talks 4-9, A interjects 0.4s at 6, A talks 9-12
  speechAudio(a, [[4, 1], [2, 0], [0.4, 1], [2.6, 0], [3, 1]]);
  speechAudio(b, [[4, 0], [5, 1], [3, 0]]);
  const la = rms(decode(a), 8000, 0.1), lb = rms(decode(b), 8000, 0.1);
  const segs = A.speakers([la, lb], 0.1, { minShot: 1.5, sensitivity: 6, wide: -1, lead: 0 });
  assert.deepStrictEqual(segs.map(s => s.cam), [0, 1, 0], JSON.stringify(segs));
  assert.ok(Math.abs(segs[1].start - 4) < 0.35 && Math.abs(segs[2].start - 9) < 0.35, JSON.stringify(segs));
});

test('speed ramp segments & output duration', () => {
  const pts = [{ x: 0, s: 2 }, { x: 0.5, s: 0.5 }, { x: 1, s: 2 }];
  const segs = A.rampSegments(pts, 6, 30);
  const d = A.rampDuration(segs);
  assert.ok(d > 3 && d < 12, 'duration ' + d);
  assert.strictEqual(A.atempoChain(0.2), 'atempo=0.5,atempo=0.5,atempo=0.8000');
  // render it for real and compare duration
  const src = path.join(tmp, 'src.mp4'), out = path.join(tmp, 'ramp.mov');
  ff(['-f', 'lavfi', '-i', 'testsrc2=d=6:s=320x240:r=30', '-f', 'lavfi', '-i', 'sine=d=6', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src]);
  const filter = A.rampFilter(segs, { fps: 30, audio: true });
  ff(['-i', src, '-filter_complex', filter, '-map', '[outv]', '-map', '[outa]', '-c:v', 'prores_ks', '-profile:v', '2', '-c:a', 'pcm_s16le', out]);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString();
  assert.ok(Math.abs(parseFloat(probe) - d) < 0.25, `rendered ${probe} vs expected ${d}`);
  // reverse + boomerang variant also renders
  const f2 = A.rampFilter(segs, { fps: 30, reverse: true }).replace(/\[outv\]$/, '[fw]') + ';[fw]split[f1][f2];[f2]reverse[rv];[f1][rv]concat=n=2:v=1:a=0[outv]';
  ff(['-i', src, '-filter_complex', f2, '-map', '[outv]', '-c:v', 'prores_ks', '-profile:v', '2', path.join(tmp, 'boom.mov')]);
});

test('motion tracker follows a moving square', () => {
  const W = 320, H = 180, n = 60;
  const v = path.join(tmp, 'move.mp4');
  // white square moving right+down over noisy background
  ff(['-f', 'lavfi', '-i', `color=c=gray:s=${W}x${H}:d=2:r=30`, '-f', 'lavfi', '-i', `color=c=white:s=24x24:d=2:r=30`,
    '-filter_complex', `[0]noise=alls=30:allf=t[bg];[bg][1]overlay=x='40+t*60':y='50+t*25'`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', v]);
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', v, '-vf', 'format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(new Uint8Array(raw.buffer, raw.byteOffset + i * W * H, W * H));
  const pts = A.track(frames, W, H, { x: 36, y: 46, w: 32, h: 32 }, 8);
  const last = pts[n - 1];
  const ex = 40 + (n - 1) / 30 * 60 + 12, ey = 50 + (n - 1) / 30 * 25 + 12;
  assert.ok(Math.hypot(last.x - ex, last.y - ey) < 4, `tracked ${last.x},${last.y} expected ${ex},${ey}`);
});

console.log(`\n${passed} tests passed`);
fs.rmSync(tmp, { recursive: true, force: true });
