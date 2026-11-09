/* Tool: Draw — sketch on top of the current frame, rendered as an animated draw-on overlay */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, D = AK.draw, E = AK.ease, M = AK.m;

  AK.addStrings({
    'dr.title': ['الرسم المتحرك', 'Animated Draw'],
    'dr.desc': ['ارسم أسهم ودوائر تنرسم بالفيديو', 'Hand-drawn strokes that animate on'],
    'dr.pen': ['قلم', 'Pen'], 'dr.arrow': ['سهم', 'Arrow'], 'dr.circle': ['دائرة', 'Circle'], 'dr.marker': ['هايلايتر', 'Highlighter'],
    'dr.size': ['السماكة', 'Thickness'],
    'dr.undo': ['تراجع', 'Undo'], 'dr.clear': ['مسح الكل', 'Clear'],
    'dr.glow': ['توهج', 'Glow'],
    'dr.drawTime': ['مدة الرسم', 'Draw-on time'],
    'dr.help': ['اضغط "خذ الفريم" حتى ترسم فوق اللقطة الحالية، أو ارسم على الخلفية الفارغة.', 'Grab the current frame to draw over it, or draw on the blank canvas.']
  });

  var st = { tool: 'pen', color: '#ffdd00', size: 10, glow: true, strokes: [], dur: 3, drawTime: 1.2, img: null, aspect: 9 / 16 };

  function strokePts(s, W, H) { return s.pts.map(function (p) { return [p[0] * W, p[1] * H]; }); }
  function drawStroke(ctx, s, prog, W, H) {
    if (prog <= 0) return;
    var u = Math.min(W, H) / 1080;
    ctx.save();
    ctx.strokeStyle = s.color; ctx.lineWidth = s.size * u * (s.tool === 'marker' ? 3 : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.tool === 'marker') ctx.globalAlpha = 0.45;
    if (s.glow) { ctx.shadowColor = s.color; ctx.shadowBlur = 20 * u; }
    var pts;
    if (s.tool === 'circle') {
      var a = s.pts[0], b = s.pts[s.pts.length - 1];
      var cx = (a[0] + b[0]) / 2 * W, cy = (a[1] + b[1]) / 2 * H, rx = Math.abs(b[0] - a[0]) / 2 * W, ry = Math.abs(b[1] - a[1]) / 2 * H;
      pts = [];
      for (var i = 0; i <= 64; i++) { var t = -Math.PI / 2 + i / 64 * Math.PI * 2.15; pts.push([cx + Math.cos(t) * rx * (1 + i / 640), cy + Math.sin(t) * ry]); }
    } else if (s.tool === 'arrow') {
      var a2 = s.pts[0], b2 = s.pts[s.pts.length - 1];
      pts = [[a2[0] * W, a2[1] * H], [b2[0] * W, b2[1] * H]];
    } else pts = strokePts(s, W, H);
    D.partialPath(ctx, pts, E.outCubic(M.clamp(prog * (s.tool === 'arrow' ? 1.25 : 1), 0, 1)));
    if (s.tool === 'arrow') {
      var hp = E.outBack(M.p(prog, 0.75, 1), 2.5);
      if (hp > 0) {
        var p1 = pts[0], p2 = pts[1], ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), L = s.size * u * 4.5 * hp;
        ctx.beginPath();
        ctx.moveTo(p2[0] - Math.cos(ang - 0.5) * L, p2[1] - Math.sin(ang - 0.5) * L); ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p2[0] - Math.cos(ang + 0.5) * L, p2[1] - Math.sin(ang + 0.5) * L); ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* each stroke gets an equal share of the draw-on time, then everything holds, then fades */
  function drawAll(ctx, t, strokes, o, W, H) {
    var n = strokes.length; if (!n) return;
    var per = o.drawTime / n;
    var fade = 1 - M.p(t, o.dur - 0.35, o.dur);
    ctx.save(); ctx.globalAlpha = fade;
    strokes.forEach(function (s, i) { drawStroke(ctx, s, M.p(t, i * per, (i + 1) * per), W, H); });
    ctx.restore();
  }

  AK.registerTool({
    id: 'draw', icon: '✎', title: 'dr.title', desc: 'dr.desc', colors: ['#ff9f0a', '#ffd60a'],
    mount: function (el) {
      var cv = h('canvas', { width: 540, height: 960, style: { touchAction: 'none', cursor: 'crosshair' } });
      var stage = h('div', { class: 'stage', style: { maxWidth: '320px', margin: '0 auto' } }, cv);
      AK.frameSpec().then(function (fs) { st.aspect = fs.width / fs.height; size(); });
      function size() {
        if (st.aspect >= 1) { cv.width = 960; cv.height = Math.round(960 / st.aspect); stage.style.maxWidth = '100%'; }
        else { cv.width = 540; cv.height = Math.round(540 / st.aspect); stage.style.maxWidth = '320px'; }
        paint();
      }
      function paint() {
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (st.img) ctx.drawImage(st.img, 0, 0, cv.width, cv.height); else AK.previewBg(ctx, cv.width, cv.height);
        st.strokes.forEach(function (s) { drawStroke(ctx, s, 1, cv.width, cv.height); });
        if (cur) drawStroke(ctx, cur, 1, cv.width, cv.height);
      }
      var cur = null;
      function rel(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
      cv.addEventListener('pointerdown', function (e) { cur = { tool: st.tool, color: st.color, size: st.size, glow: st.glow, pts: [rel(e)] }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', function (e) { if (!cur) return; cur.pts.push(rel(e)); paint(); });
      cv.addEventListener('pointerup', function () { if (cur && cur.pts.length > 1) st.strokes.push(cur); cur = null; paint(); });

      el.appendChild(ui.note(AK.t('dr.help')));
      el.appendChild(ui.section(null, [
        ui.chips(['pen', 'arrow', 'circle', 'marker'].map(function (x) { return { value: x, label: AK.t('dr.' + x) }; }), st.tool, function (v) { st.tool = v; }),
        h('div', { class: 'row' }, [
          ui.field(AK.t('f.accent'), ui.color(st.color, function (v) { st.color = v; })),
          ui.field(AK.t('dr.size'), ui.slider(3, 40, 1, st.size, function (v) { st.size = v; }))
        ]),
        h('div', { class: 'row' }, [
          ui.check(AK.t('dr.glow'), st.glow, function (v) { st.glow = v; }),
          ui.button(AK.t('dr.undo'), function () { st.strokes.pop(); paint(); }, 'small'),
          ui.button(AK.t('dr.clear'), function () { st.strokes = []; paint(); }, 'small'),
          ui.button(AK.t('mt.grab'), function () {
            return AK.host('ak_clipAtPlayhead', {}).then(function (r) {
              if (!r.clip) throw new Error(AK.t('mt.noClip'));
              return AK.grabFrame(r.clip, r.clip.playhead, 960);
            }).then(function (img) { st.img = img; paint(); });
          }, 'small')
        ])
      ]));
      el.appendChild(stage);
      el.appendChild(ui.section(null, [h('div', { class: 'row' }, [
        ui.field(AK.t('dr.drawTime'), ui.slider(0.2, 5, 0.1, st.drawTime, function (v) { st.drawTime = v; }, function (v) { return v.toFixed(1) + 's'; })),
        ui.field(AK.t('f.duration'), ui.slider(1, 15, 0.5, st.dur, function (v) { st.dur = v; }, function (v) { return v + 's'; }))
      ])]));
      el.appendChild(h('div', { class: 'actions' }, [
        ui.button(AK.t('btn.add'), function () { return go(false); }, 'primary'),
        ui.button(AK.t('btn.export'), function () { return go(true); })
      ]));
      paint();

      function go(exportOnly) {
        if (!st.strokes.length) return Promise.reject(new Error(AK.t('mt.noBox')));
        var strokes = JSON.parse(JSON.stringify(st.strokes)), o = { dur: st.dur, drawTime: Math.min(st.drawTime, st.dur - 0.4) };
        return AK.renderAndPlace({ name: 'drawing', duration: o.dur, exportOnly: exportOnly, folder: 'Drawings', draw: function (ctx, t, W, H) {
          drawAll(ctx, t, strokes, o, W, H);
          return t > o.drawTime && t < o.dur - 0.35 ? 'hold' : null;
        } });
      }
    }
  });
})();
