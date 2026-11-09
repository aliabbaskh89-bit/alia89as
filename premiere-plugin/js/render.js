/* Ali Kit — animation helpers + canvas → transparent video renderer */
(function (global) {
  'use strict';
  var AK = global.AK = global.AK || {};

  /* ---------------- easing & math ---------------- */
  var E = AK.ease = {
    linear: function (x) { return x; },
    inCubic: function (x) { return x * x * x; },
    outCubic: function (x) { return 1 - Math.pow(1 - x, 3); },
    inOutCubic: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    outQuint: function (x) { return 1 - Math.pow(1 - x, 5); },
    outExpo: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    inExpo: function (x) { return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); },
    outBack: function (x, s) { s = s || 1.70158; var c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    outElastic: function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }
  };
  var M = AK.m = {
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    /* progress of t within [a,b] clamped to 0..1 */
    p: function (t, a, b) { return b <= a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a))); },
    rand: function (seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  };
  /* standard intro/outro envelope for a template of length `dur` */
  AK.env = function (t, dur, inD, outD) {
    inD = inD === undefined ? 0.6 : inD; outD = outD === undefined ? 0.45 : outD;
    return { i: M.p(t, 0, inD), o: M.p(t, dur - outD, dur), hold: M.p(t, inD, dur - outD) };
  };

  /* ---------------- colour ---------------- */
  AK.rgba = function (hex, a) {
    hex = String(hex || '#ffffff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a === undefined ? 1 : a) + ')';
  };
  AK.mix = function (h1, h2, t) {
    function c(h) { h = h.replace('#', ''); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var a = c(h1), b = c(h2);
    return '#' + [0, 1, 2].map(function (i) { var v = Math.round(a[i] + (b[i] - a[i]) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  };

  /* ---------------- drawing ---------------- */
  var D = AK.draw = {};
  D.rr = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  D.font = function (weight, size, family) {
    return weight + ' ' + Math.max(1, Math.round(size)) + 'px ' + (family ? '"' + family + '", ' : '') + '"GraphikArabic", "Geeza Pro", "Segoe UI", sans-serif';
  };
  D.isRTL = function (s) { return /[֐-ࣿיִ-ﻼ]/.test(s || ''); };
  D.text = function (ctx, s, x, y, opts) {
    opts = opts || {};
    ctx.font = D.font(opts.weight || 700, opts.size || 60, opts.family);
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.direction = D.isRTL(s) ? 'rtl' : 'ltr';
    if (opts.stroke) { ctx.lineWidth = opts.strokeWidth || 6; ctx.strokeStyle = opts.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = opts.color || '#fff';
    ctx.fillText(s, x, y);
  };
  D.measure = function (ctx, s, weight, size, family) {
    ctx.font = D.font(weight, size, family);
    ctx.direction = D.isRTL(s) ? 'rtl' : 'ltr';
    return ctx.measureText(s).width;
  };
  /* shrink font size until text fits maxW */
  D.fit = function (ctx, s, weight, size, maxW, family) {
    var w = D.measure(ctx, s, weight, size, family);
    return w > maxW ? size * maxW / w : size;
  };
  /* frosted "liquid glass" panel (light refraction look; real backdrop blur is not possible in an overlay) */
  D.glass = function (ctx, x, y, w, h, r, o) {
    o = o || {};
    var tint = o.tint || '#ffffff', alpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (o.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = h * 0.35; ctx.shadowOffsetY = h * 0.08;
    }
    D.rr(ctx, x, y, w, h, r);
    var g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, AK.rgba(tint, o.dark ? 0.22 : 0.34));
    g.addColorStop(0.5, AK.rgba(tint, o.dark ? 0.08 : 0.16));
    g.addColorStop(1, AK.rgba(tint, o.dark ? 0.14 : 0.24));
    ctx.fillStyle = o.fill || g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    /* inner dark base for legibility */
    if (o.base) { ctx.fillStyle = o.base; ctx.fill(); }
    /* rim light */
    var b = ctx.createLinearGradient(x, y, x + w, y + h);
    b.addColorStop(0, 'rgba(255,255,255,0.85)');
    b.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    b.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    b.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.lineWidth = Math.max(1.5, h * 0.018);
    ctx.strokeStyle = b;
    D.rr(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth, r);
    ctx.stroke();
    /* specular highlight on top edge */
    ctx.save();
    D.rr(ctx, x, y, w, h, r); ctx.clip();
    var s = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    s.addColorStop(0, 'rgba(255,255,255,0.35)');
    s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    ctx.beginPath(); ctx.ellipse(x + w / 2, y, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  };
  D.glow = function (ctx, color, blur, fn) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore();
  };
  /* macOS-style pointer; `press` 0..1 squashes it */
  D.cursor = function (ctx, x, y, s, press) {
    press = press || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (1 - press * 0.15), s * (1 - press * 0.15));
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(8, 26); ctx.lineTo(14, 39); ctx.lineTo(20, 36); ctx.lineTo(14, 24); ctx.lineTo(25, 24); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.restore();
    if (press > 0) {
      ctx.save(); ctx.globalAlpha = (1 - press) * 0.6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.arc(x, y, 10 * s + press * 40 * s, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  };
  /* animated partial stroke of a polyline (0..1) */
  D.partialPath = function (ctx, pts, prog) {
    var lens = [0], total = 0, i;
    for (i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(total); }
    var target = total * prog;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) {
      if (lens[i] <= target) ctx.lineTo(pts[i][0], pts[i][1]);
      else {
        var seg = lens[i] - lens[i - 1], k = seg ? (target - lens[i - 1]) / seg : 0;
        ctx.lineTo(M.lerp(pts[i - 1][0], pts[i][0], k), M.lerp(pts[i - 1][1], pts[i][1], k));
        break;
      }
    }
    ctx.stroke();
    return { total: total };
  };

  /* ---------------- renderer ---------------- */
  /*
   * opts: { width, height, fps, duration, draw(ctx, t, W, H) -> optional cache key,
   *         out (file path), codec: 'prores'|'qtrle'|'h264', onProgress(0..1), cancel: {cancelled} }
   */
  AK.renderVideo = function (opts) {
    var W = opts.width, H = opts.height, fps = opts.fps || 30;
    var frames = Math.max(1, Math.round(opts.duration * fps));
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var codec = opts.codec || AK.settings.alphaCodec || 'prores';
    var vcodec = codec === 'qtrle' ? ['-c:v', 'qtrle', '-pix_fmt', 'argb']
      : codec === 'h264' ? ['-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0'];
    var args = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(fps), '-i', '-']
      .concat(vcodec).concat(['-r', String(fps), opts.out]);

    return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      return new Promise(function (resolve, reject) {
        var proc;
        var done = AK.ffmpeg(args, { proc: function (p) { proc = p; } });
        done.then(function () { resolve(opts.out); }, reject);
        var f = 0, lastKey = null, lastBuf = null;
        function pump() {
          if (opts.cancel && opts.cancel.cancelled) { try { proc.kill(); } catch (e) {} return reject(new Error('cancelled')); }
          var batchEnd = Math.min(frames, f + 4);
          for (; f < batchEnd; f++) {
            var t = f / fps;
            var buf;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, W, H);
            var key = opts.draw(ctx, t, W, H);
            if (key !== undefined && key !== null && key === lastKey && lastBuf) buf = lastBuf;
            else {
              var img = ctx.getImageData(0, 0, W, H);
              buf = Buffer.from(img.data.buffer);
              lastKey = key; lastBuf = buf;
            }
            var ok = proc.stdin.write(buf);
            if (opts.onProgress && f % 5 === 0) opts.onProgress(f / frames);
            if (!ok) { f++; proc.stdin.once('drain', pump); return; }
          }
          if (f >= frames) { proc.stdin.end(); if (opts.onProgress) opts.onProgress(1); return; }
          setTimeout(pump, 0);
        }
        proc.stdin.on('error', function () { /* reported by close handler */ });
        pump();
      });
    });
  };

  /* live preview loop on a <canvas>; returns stop() */
  AK.preview = function (canvas, dur, drawFn, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var start = performance.now(), raf, stopped = false;
    function loop(now) {
      if (stopped) return;
      var t = ((now - start) / 1000) % (dur + (opts.pause || 0.6));
      t = Math.min(t, dur - 0.001);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (opts.bg) opts.bg(ctx, canvas.width, canvas.height);
      drawFn(ctx, t, canvas.width, canvas.height);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return function () { stopped = true; cancelAnimationFrame(raf); };
  };
  /* checkerboard-free nice dark preview background */
  AK.previewBg = function (ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1b2a44'); g.addColorStop(0.5, '#0c1222'); g.addColorStop(1, '#22163a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (var i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W * (0.2 + i * 0.15), H * (0.3 + (i % 3) * 0.2), W * 0.18, 0, Math.PI * 2); ctx.fill(); }
  };
})(window);
