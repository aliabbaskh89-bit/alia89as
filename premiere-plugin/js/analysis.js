/* Ali Kit — pure analysis algorithms (no DOM, no Premiere). Usable from the panel and from Node tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.AK = window.AK || {}; window.AK.analysis = api; }
})(this, function () {
  'use strict';

  /*
   * Silence ranges from an RMS timeline.
   * db: Float32Array (dB per window), win: window seconds
   * o: { threshold (dB), minSilence (s), padding (s), totalEnd (s) }
   * returns [[start,end], ...] — the parts to remove
   */
  function silences(db, win, o) {
    var thr = o.threshold, minS = o.minSilence, pad = o.padding || 0;
    var out = [], start = -1;
    for (var i = 0; i <= db.length; i++) {
      var silent = i < db.length && db[i] < thr;
      if (silent && start < 0) start = i;
      if (!silent && start >= 0) {
        var s = start * win, e = i * win;
        if (e - s >= minS) {
          var s2 = start === 0 ? s : s + pad;
          var e2 = i === db.length ? e : e - pad;
          if (o.totalEnd) e2 = Math.min(e2, o.totalEnd);
          if (e2 - s2 > 0.05) out.push([round(s2), round(e2)]);
        }
        start = -1;
      }
    }
    return out;
  }
  function round(x) { return Math.round(x * 1000) / 1000; }

  /* auto threshold: noise floor (10th percentile) + margin, clamped */
  function autoThreshold(db, margin) {
    var arr = Array.prototype.filter.call(db, function (v) { return v > -100; }).sort(function (a, b) { return a - b; });
    if (!arr.length) return -40;
    var floor = arr[Math.floor(arr.length * 0.1)];
    var speech = arr[Math.floor(arr.length * 0.7)];
    var thr = floor + Math.max(margin || 8, (speech - floor) * 0.35);
    return Math.max(-60, Math.min(-18, thr));
  }

  /*
   * Active-speaker segments for a multicam podcast.
   * tracks: [Float32Array dB, ...] one per mic, same window `win`
   * o: { minShot (s), sensitivity (dB above that mic's noise floor), wide (index or -1), wideAfter (s of silence/overlap), lead (s switch early) }
   * returns [{start, end, cam}]
   */
  function speakers(tracks, win, o) {
    var n = tracks.length, len = 0;
    tracks.forEach(function (t) { len = Math.max(len, t.length); });
    var floors = tracks.map(function (t) {
      var a = Array.prototype.filter.call(t, function (v) { return v > -100; }).sort(function (x, y) { return x - y; });
      return a.length ? a[Math.floor(a.length * 0.15)] : -90;
    });
    var sens = o.sensitivity || 6;
    /* smooth with a short moving average (0.3s) to ignore syllable gaps */
    var sm = Math.max(1, Math.round(0.3 / win));
    var lv = tracks.map(function (t, k) {
      var out = new Float32Array(len);
      for (var i = 0; i < len; i++) {
        var s = 0, c = 0;
        for (var j = Math.max(0, i - sm); j <= Math.min(len - 1, i + sm); j++) { s += (j < t.length ? t[j] : -120); c++; }
        out[i] = s / c - floors[k];
      }
      return out;
    });
    /* raw label per window: loudest mic above sensitivity, -1 = nobody, -2 = overlap */
    var raw = new Int16Array(len);
    for (var i = 0; i < len; i++) {
      var best = -1, bestV = sens, second = -1e9;
      for (var k = 0; k < n; k++) {
        var v = lv[k][i];
        if (v > bestV) { second = bestV; bestV = v; best = k; } else if (v > second) second = v;
      }
      raw[i] = best;
      if (best >= 0 && o.wide >= 0 && second > sens && bestV - second < 3) raw[i] = -2;
    }
    /* run-length segments */
    var segs = [];
    for (var a = 0; a < len;) {
      var b = a; while (b < len && raw[b] === raw[a]) b++;
      segs.push({ start: a * win, end: b * win, cam: raw[a] });
      a = b;
    }
    /* silence / overlap: keep current speaker, or go wide when long */
    var wideAfter = o.wideAfter || 2.5;
    segs.forEach(function (s, i) {
      if (s.cam >= 0) return;
      var long = s.end - s.start >= wideAfter;
      if (o.wide >= 0 && (s.cam === -2 || long)) s.cam = n; /* n = wide shot */
      else s.cam = i > 0 ? segs[i - 1].cam : -1;
    });
    if (segs.length && segs[0].cam < 0) {
      var firstReal = segs.filter(function (s) { return s.cam >= 0; })[0];
      segs.forEach(function (s) { if (s.cam < 0) s.cam = firstReal ? firstReal.cam : 0; });
    }
    segs = merge(segs);
    /* enforce minimum shot length: absorb short shots into the longer neighbour */
    var minShot = o.minShot || 2;
    var changed = true;
    while (changed) {
      changed = false;
      for (var q = 0; q < segs.length; q++) {
        var sg = segs[q];
        if (sg.end - sg.start >= minShot || segs.length === 1) continue;
        var prev = segs[q - 1], next = segs[q + 1];
        var into = !prev ? next : !next ? prev : ((prev.end - prev.start) >= (next.end - next.start) ? prev : next);
        sg.cam = into.cam;
        segs = merge(segs);
        changed = true;
        break;
      }
    }
    /* cut slightly before the speaker starts (feels natural) */
    var lead = o.lead || 0;
    for (var z = 1; z < segs.length; z++) {
      var t = Math.max(segs[z - 1].start + 0.2, segs[z].start - lead);
      segs[z - 1].end = t; segs[z].start = t;
    }
    segs.forEach(function (s) { s.start = round(s.start); s.end = round(s.end); });
    return segs;
  }
  function merge(segs) {
    var out = [];
    segs.forEach(function (s) {
      var last = out[out.length - 1];
      if (last && last.cam === s.cam) last.end = s.end; else out.push({ start: s.start, end: s.end, cam: s.cam });
    });
    return out;
  }

  /*
   * Speed curve: points [{x: 0..1 of source time, s: speed}] -> N constant-speed segments.
   * Uses monotone smoothing in log space.
   */
  function speedAt(points, x) {
    var p = points.slice().sort(function (a, b) { return a.x - b.x; });
    if (x <= p[0].x) return p[0].s;
    if (x >= p[p.length - 1].x) return p[p.length - 1].s;
    for (var i = 0; i < p.length - 1; i++) {
      if (x >= p[i].x && x <= p[i + 1].x) {
        var k = (x - p[i].x) / Math.max(1e-6, p[i + 1].x - p[i].x);
        k = k * k * (3 - 2 * k); /* smoothstep ease between keys */
        return Math.exp(Math.log(p[i].s) + (Math.log(p[i + 1].s) - Math.log(p[i].s)) * k);
      }
    }
    return 1;
  }
  function rampSegments(points, srcDur, n) {
    n = n || 30;
    var segs = [];
    for (var i = 0; i < n; i++) {
      var a = i / n, b = (i + 1) / n;
      var sp = speedAt(points, (a + b) / 2);
      segs.push({ start: round(a * srcDur), end: round(b * srcDur), speed: Math.max(0.05, Math.min(20, sp)) });
    }
    /* merge neighbours with near-identical speed */
    var out = [];
    segs.forEach(function (s) {
      var l = out[out.length - 1];
      if (l && Math.abs(Math.log(l.speed / s.speed)) < 0.02) l.end = s.end; else out.push(s);
    });
    return out;
  }
  function rampDuration(segs) { return segs.reduce(function (a, s) { return a + (s.end - s.start) / s.speed; }, 0); }

  /* atempo only accepts 0.5..2 per instance (older ffmpeg); chain them */
  function atempoChain(speed) {
    var parts = [];
    while (speed > 2) { parts.push('atempo=2'); speed /= 2; }
    while (speed < 0.5) { parts.push('atempo=0.5'); speed /= 0.5; }
    parts.push('atempo=' + speed.toFixed(4));
    return parts.join(',');
  }

  /* ffmpeg filter_complex for a speed ramp. Input 0 is the (already trimmed) source. */
  function rampFilter(segs, o) {
    o = o || {};
    var f = [], vl = [], al = [];
    var n = segs.length;
    var pre = o.reverse ? 'reverse,' : '';
    f.push('[0:v]' + pre + 'split=' + n + segs.map(function (_, i) { return '[vs' + i + ']'; }).join(''));
    if (o.audio) f.push('[0:a]' + (o.reverse ? 'areverse,' : '') + 'asplit=' + n + segs.map(function (_, i) { return '[as' + i + ']'; }).join(''));
    segs.forEach(function (s, i) {
      f.push('[vs' + i + ']trim=start=' + s.start + ':end=' + s.end + ',setpts=(PTS-STARTPTS)/' + s.speed.toFixed(4) + '[v' + i + ']');
      vl.push('[v' + i + ']');
      if (o.audio) {
        f.push('[as' + i + ']atrim=start=' + s.start + ':end=' + s.end + ',asetpts=PTS-STARTPTS,' + atempoChain(s.speed) + '[a' + i + ']');
        al.push('[v' + i + '][a' + i + ']');
      }
    });
    var fps = o.fps || 30;
    var post = 'fps=' + fps + (o.blend ? ',minterpolate=fps=' + fps + ':mi_mode=blend' : '');
    if (o.audio) f.push(al.join('') + 'concat=n=' + n + ':v=1:a=1[cv][outa]', '[cv]' + post + '[outv]');
    else f.push(vl.join('') + 'concat=n=' + n + ':v=1:a=0[cv]', '[cv]' + post + '[outv]');
    return f.join(';');
  }

  /*
   * Template-matching tracker (normalised cross-correlation) on grayscale frames.
   * frames: array of Uint8Array (w*h), box: {x,y,w,h} in pixels on frame 0, search radius in px
   * returns [{x,y}] centre per frame
   */
  function track(frames, w, h, box, radius, onProgress) {
    radius = radius || 20;
    var bw = Math.max(4, Math.round(box.w)), bh = Math.max(4, Math.round(box.h));
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var out = [{ x: cx, y: cy }];
    var tpl = patch(frames[0], w, h, Math.round(cx - bw / 2), Math.round(cy - bh / 2), bw, bh);
    var step = Math.max(1, Math.floor(Math.min(bw, bh) / 24)); /* subsample big boxes for speed */
    for (var f = 1; f < frames.length; f++) {
      var best = -2, bx = cx, by = cy;
      for (var dy = -radius; dy <= radius; dy += 1) {
        for (var dx = -radius; dx <= radius; dx += 1) {
          var x0 = Math.round(cx + dx - bw / 2), y0 = Math.round(cy + dy - bh / 2);
          if (x0 < 0 || y0 < 0 || x0 + bw > w || y0 + bh > h) continue;
          var sc = ncc(frames[f], w, x0, y0, tpl, bw, bh, step);
          if (sc > best) { best = sc; bx = cx + dx; by = cy + dy; }
        }
      }
      cx = bx; cy = by;
      out.push({ x: cx, y: cy, score: best });
      /* slowly adapt the template to handle appearance change */
      if (best > 0.6) {
        var np = patch(frames[f], w, h, Math.round(cx - bw / 2), Math.round(cy - bh / 2), bw, bh);
        for (var q = 0; q < tpl.data.length; q++) tpl.data[q] = tpl.data[q] * 0.85 + np.data[q] * 0.15;
        stats(tpl);
      }
      if (onProgress) onProgress(f / frames.length);
    }
    return out;
  }
  function patch(img, w, h, x0, y0, bw, bh) {
    var d = new Float32Array(bw * bh);
    for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
      var xx = Math.min(w - 1, Math.max(0, x0 + x)), yy = Math.min(h - 1, Math.max(0, y0 + y));
      d[y * bw + x] = img[yy * w + xx];
    }
    var p = { data: d, w: bw, h: bh };
    stats(p);
    return p;
  }
  function stats(p) {
    var s = 0, i;
    for (i = 0; i < p.data.length; i++) s += p.data[i];
    p.mean = s / p.data.length;
    var v = 0;
    for (i = 0; i < p.data.length; i++) { var d = p.data[i] - p.mean; v += d * d; }
    p.norm = Math.sqrt(v) || 1;
  }
  function ncc(img, w, x0, y0, tpl, bw, bh, step) {
    var s = 0, c = 0, x, y, v;
    for (y = 0; y < bh; y += step) for (x = 0; x < bw; x += step) { s += img[(y0 + y) * w + x0 + x]; c++; }
    var mean = s / c, num = 0, den = 0, tden = 0;
    for (y = 0; y < bh; y += step) for (x = 0; x < bw; x += step) {
      v = img[(y0 + y) * w + x0 + x] - mean;
      var t = tpl.data[y * bw + x] - tpl.mean;
      num += v * t; den += v * v; tden += t * t;
    }
    return num / (Math.sqrt(den * tden) || 1);
  }

  return {
    silences: silences, autoThreshold: autoThreshold, speakers: speakers,
    speedAt: speedAt, rampSegments: rampSegments, rampDuration: rampDuration, rampFilter: rampFilter, atempoChain: atempoChain,
    track: track
  };
});
