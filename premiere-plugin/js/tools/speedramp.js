/* Tool: Speed Ramp — curve editor + presets, rendered with ffmpeg */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, A = AK.analysis, M = AK.m;

  AK.addStrings({
    'sr.title': ['Speed Ramp', 'Speed Ramp'],
    'sr.desc': ['تسريع وتبطيء بمنحنى + بريستات', 'Curve-based speed ramps + presets'],
    'sr.presets': ['البريستات', 'Presets'],
    'sr.curve': ['المنحنى — اسحب النقاط، دبل كلك يضيف نقطة، كلك يمين يحذف', 'Curve — drag points, double-click adds, right-click deletes'],
    'sr.blend': ['دمج الفريمات (أنعم وأبطأ بالرندر)', 'Frame blending (smoother, slower render)'],
    'sr.audio': ['احتفظ بالصوت', 'Keep audio'],
    'sr.reverse': ['عكسي', 'Reverse'],
    'sr.boom': ['بومرانج (ذهاب وإياب)', 'Boomerang'],
    'sr.disable': ['عطّل الكليب الأصلي', 'Disable the original clip'],
    'sr.info': ['المدة: {a} ← {b}', 'Duration: {a} → {b}'],
    'sr.pick': ['حدد كليب فيديو بالتايملاين واضغط تطبيق', 'Select a video clip on the timeline, then Apply'],
    'sr.save': ['حفظ كبريست', 'Save as preset'],
    'sr.name': ['اسم البريست', 'Preset name'],
    'p.hero': ['Hero', 'Hero'], 'p.buildup': ['Build Up', 'Build Up'], 'p.glide': ['Glide', 'Glide'], 'p.car': ['Car Shot', 'Car Shot'],
    'p.smooth': ['Smooth Slow', 'Smooth Slow'], 'p.whip': ['Whip', 'Whip'], 'p.pulse': ['Pulse', 'Pulse'], 'p.linear': ['Normal', 'Normal']
  });

  var PRESETS = {
    linear: [{ x: 0, s: 1 }, { x: 1, s: 1 }],
    hero: [{ x: 0, s: 3 }, { x: 0.35, s: 3 }, { x: 0.45, s: 0.3 }, { x: 0.7, s: 0.3 }, { x: 0.8, s: 3 }, { x: 1, s: 3 }],
    buildup: [{ x: 0, s: 0.4 }, { x: 0.6, s: 0.8 }, { x: 1, s: 4 }],
    glide: [{ x: 0, s: 4 }, { x: 0.4, s: 1.2 }, { x: 1, s: 0.35 }],
    car: [{ x: 0, s: 1 }, { x: 0.3, s: 1 }, { x: 0.4, s: 0.25 }, { x: 0.65, s: 0.25 }, { x: 0.75, s: 4 }, { x: 1, s: 4 }],
    smooth: [{ x: 0, s: 1 }, { x: 0.25, s: 0.4 }, { x: 1, s: 0.4 }],
    whip: [{ x: 0, s: 5 }, { x: 0.3, s: 5 }, { x: 0.5, s: 1 }, { x: 1, s: 1 }],
    pulse: [{ x: 0, s: 2.5 }, { x: 0.2, s: 0.4 }, { x: 0.4, s: 2.5 }, { x: 0.6, s: 0.4 }, { x: 0.8, s: 2.5 }, { x: 1, s: 0.5 }]
  };
  var MIN_S = 0.1, MAX_S = 8;
  var o = { pts: PRESETS.hero.map(function (p) { return Object.assign({}, p); }), blend: false, audio: false, reverse: false, boom: false, disable: true };

  function loadUserPresets() { try { return JSON.parse(localStorage.getItem('alikit.ramps') || '{}'); } catch (e) { return {}; } }

  AK.registerTool({
    id: 'speedramp', icon: '⏩', title: 'sr.title', desc: 'sr.desc', colors: ['#00a3ff', '#00e0c6'],
    mount: function (el) {
      var cv = h('canvas', { class: 'curve', width: 800, height: 360 });
      var info = h('div', { class: 'hint' });
      var clipDur = 4;
      var presetWrap = h('div');
      function presetChips() {
        presetWrap.innerHTML = '';
        var opts = Object.keys(PRESETS).map(function (k) { return { value: k, label: AK.t('p.' + k) }; });
        var user = loadUserPresets();
        Object.keys(user).forEach(function (k) { opts.push({ value: 'u:' + k, label: '★ ' + k }); });
        presetWrap.appendChild(ui.chips(opts, '', function (v) {
          var src = v.indexOf('u:') === 0 ? user[v.slice(2)] : PRESETS[v];
          o.pts = src.map(function (p) { return Object.assign({}, p); }); paint();
        }));
      }
      presetChips();
      el.appendChild(ui.section(AK.t('sr.presets'), [presetWrap]));
      el.appendChild(ui.section(AK.t('sr.curve'), [cv, info]));
      el.appendChild(ui.section(null, [
        ui.check(AK.t('sr.blend'), o.blend, function (v) { o.blend = v; }),
        ui.check(AK.t('sr.audio'), o.audio, function (v) { o.audio = v; }),
        ui.check(AK.t('sr.reverse'), o.reverse, function (v) { o.reverse = v; }),
        ui.check(AK.t('sr.boom'), o.boom, function (v) { o.boom = v; }),
        ui.check(AK.t('sr.disable'), o.disable, function (v) { o.disable = v; })
      ]));
      el.appendChild(ui.note(AK.t('sr.pick')));
      el.appendChild(h('div', { class: 'actions' }, [
        ui.button(AK.t('btn.apply'), apply, 'primary'),
      ]));
      var presetName = '';
      el.appendChild(ui.section(null, [h('div', { class: 'row' }, [
        ui.field(AK.t('sr.name'), ui.input('', function (v) { presetName = v.trim(); })),
        ui.button(AK.t('sr.save'), function () {
          if (!presetName) return;
          var u = loadUserPresets(); u[presetName] = o.pts; localStorage.setItem('alikit.ramps', JSON.stringify(u)); presetChips();
          AK.toast(AK.t('st.done'), 'ok');
        })
      ])]));

      AK.host('ak_selection').then(function (r) {
        var v = r.clips.filter(function (c) { return c.kind === 'video'; })[0];
        if (v) { clipDur = v.end - v.start; paint(); }
      }).catch(function () {});

      /* ---- curve editor ---- */
      var W = cv.width, H = cv.height, pad = 30;
      function sx(x) { return pad + x * (W - pad * 2); }
      function sy(s) { return H - pad - (Math.log(s) - Math.log(MIN_S)) / (Math.log(MAX_S) - Math.log(MIN_S)) * (H - pad * 2); }
      function ix(px) { return M.clamp((px - pad) / (W - pad * 2), 0, 1); }
      function iy(py) { var k = (H - pad - py) / (H - pad * 2); return M.clamp(Math.exp(Math.log(MIN_S) + k * (Math.log(MAX_S) - Math.log(MIN_S))), MIN_S, MAX_S); }
      function paint() {
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.font = '20px GraphikArabic, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'left';
        [0.25, 0.5, 1, 2, 4].forEach(function (s) {
          ctx.strokeStyle = s === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)';
          ctx.setLineDash(s === 1 ? [6, 6] : []);
          ctx.beginPath(); ctx.moveTo(pad, sy(s)); ctx.lineTo(W - pad, sy(s)); ctx.stroke();
          ctx.fillText(s + 'x', 4, sy(s) - 4);
        });
        ctx.setLineDash([]);
        /* curve */
        var g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#a970ff'); g.addColorStop(1, '#00d4ff');
        ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath();
        for (var x = 0; x <= 200; x++) { var k = x / 200, s = A.speedAt(o.pts, k); if (x) ctx.lineTo(sx(k), sy(s)); else ctx.moveTo(sx(k), sy(s)); }
        ctx.stroke();
        ctx.lineTo(sx(1), H - pad); ctx.lineTo(sx(0), H - pad); ctx.closePath();
        var f = ctx.createLinearGradient(0, 0, 0, H); f.addColorStop(0, 'rgba(0,212,255,0.25)'); f.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.fillStyle = f; ctx.fill();
        o.pts.forEach(function (p) {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2f8cff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(sx(p.x), sy(p.s), 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
        var segs = A.rampSegments(o.pts, clipDur, 40);
        var out = A.rampDuration(segs) * (o.boom ? 2 : 1);
        info.textContent = AK.t('sr.info', { a: clipDur.toFixed(2) + 's', b: out.toFixed(2) + 's' });
      }
      var drag = null;
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
      function hit(p) { for (var i = 0; i < o.pts.length; i++) if (Math.hypot(sx(o.pts[i].x) - p.x, sy(o.pts[i].s) - p.y) < 22) return i; return -1; }
      cv.addEventListener('pointerdown', function (e) { var i = hit(pos(e)); if (i >= 0 && e.button === 0) { drag = i; cv.setPointerCapture(e.pointerId); } });
      cv.addEventListener('pointermove', function (e) {
        if (drag === null) return;
        var p = pos(e), pt = o.pts[drag];
        var isEnd = drag === 0 || drag === o.pts.length - 1;
        if (!isEnd) pt.x = M.clamp(ix(p.x), o.pts[drag - 1].x + 0.01, o.pts[drag + 1].x - 0.01);
        pt.s = iy(p.y);
        paint();
      });
      cv.addEventListener('pointerup', function () { drag = null; });
      cv.addEventListener('dblclick', function (e) {
        var p = pos(e), x = ix(p.x);
        o.pts.push({ x: x, s: iy(p.y) });
        o.pts.sort(function (a, b) { return a.x - b.x; }); paint();
      });
      cv.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var i = hit(pos(e));
        if (i > 0 && i < o.pts.length - 1) { o.pts.splice(i, 1); paint(); }
      });
      paint();

      function apply() {
        var path = require('path');
        return Promise.all([AK.host('ak_selection'), AK.seqInfo()]).then(function (rs) {
          var clip = rs[0].clips.filter(function (c) { return c.kind === 'video'; })[0];
          var seq = rs[1];
          if (!clip) throw new Error(AK.t('err.noSel'));
          var dur = (clip.end - clip.start) * (clip.speed || 1);
          var segs = A.rampSegments(o.pts, dur, 30);
          var outDur = A.rampDuration(segs);
          var out = path.join(AK.mediaDir('Speed Ramps'), AK.safeName(clip.name.replace(/\.[^.]+$/, '')) + '-ramp-' + AK.stamp() + '.mov');
          var filter = A.rampFilter(segs, { fps: seq.fps, blend: o.blend, audio: o.audio, reverse: o.reverse });
          var maps = o.audio ? ['-map', '[outv]', '-map', '[outa]', '-c:a', 'pcm_s16le'] : ['-map', '[outv]'];
          if (o.boom) {
            filter = filter.replace(/\[outv\]$/, '[fw]') + ';[fw]split[f1][f2];[f2]reverse[rv];[f1][rv]concat=n=2:v=1:a=0[outv]';
            maps = ['-map', '[outv]'];
            outDur *= 2;
          }
          var args = ['-ss', String(clip.inPoint), '-t', String(dur), '-i', clip.path, '-filter_complex', filter]
            .concat(maps).concat(['-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le', out]);
          return AK.job(AK.t('st.rendering', { p: 0 }), function (b) {
            return AK.ffmpeg(args, { onLine: AK.ffProgress(outDur, function (p) { b.set(AK.t('st.rendering', { p: Math.round(p * 100) }), p); }) })
              .then(function () {
                b.set(AK.t('st.placing'));
                return AK.host('ak_place', { path: out, time: clip.start, duration: outDur, minTrack: clip.track + 1 });
              })
              .then(function () { if (o.disable) return AK.host('ak_disableClip', { kind: 'video', track: clip.track, index: clip.index }); });
          }).then(function () { AK.toast(AK.t('st.done'), 'ok'); });
        });
      }
    }
  });
})();
