/* Ali Kit — animated template library (all original, drawn in code). */
(function (global) {
  'use strict';
  var AK = global.AK;
  var E = AK.ease, M = AK.m, D = AK.draw;

  /* common fields */
  var F = {
    text: function (def) { return { key: 'text', type: 'text', label: 'f.text', def: def }; },
    sub: function (def) { return { key: 'sub', type: 'text', label: 'f.sub', def: def }; },
    accent: function (def) { return { key: 'accent', type: 'color', label: 'f.accent', def: def || '#2f8cff' }; },
    color: function (def) { return { key: 'color', type: 'color', label: 'f.color', def: def || '#ffffff' }; }
  };

  function setup(ctx, p, W, H) {
    var u = Math.min(W, H) / 1080 * (p.scale || 1);
    return { u: u, cx: (p.x === undefined ? 0.5 : p.x) * W, cy: (p.y === undefined ? 0.5 : p.y) * H };
  }

  var T = [];

  /* ======================= TEXT ======================= */
  T.push({
    id: 'pop_title', cat: 'text', name: { ar: 'عنوان منبثق', en: 'Pop Title' }, dur: 3,
    fields: [F.text('عنوان قوي'), F.sub('نص فرعي هنا'), F.accent('#2f8cff'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.55, 0.35);
      var k = E.outBack(e.i, 2.2) * (1 - E.inCubic(e.o));
      ctx.save(); ctx.translate(s.cx, s.cy); ctx.scale(k, k); ctx.globalAlpha = M.clamp(e.i * 3, 0, 1) * (1 - e.o);
      var size = D.fit(ctx, p.text, 900, 130 * u, W * 0.86 / Math.max(k, 0.01) / 1, p.font);
      D.glow(ctx, AK.rgba(p.accent, 0.9), 40 * u, function () { D.text(ctx, p.text, 0, 0, { weight: 900, size: size, color: p.color, family: p.font }); });
      if (p.sub) {
        ctx.globalAlpha *= M.p(t, 0.35, 0.8);
        D.text(ctx, p.sub, 0, size * 0.85, { weight: 400, size: size * 0.36, color: AK.rgba(p.color, 0.85), family: p.font });
      }
      ctx.restore();
    }
  });

  T.push({
    id: 'wipe_reveal', cat: 'text', name: { ar: 'كشف بشريط', en: 'Bar Wipe' }, dur: 3,
    fields: [F.text('النصوص والعناصر'), F.accent('#00d4ff'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.8, 0.5);
      var size = D.fit(ctx, p.text, 800, 110 * u, W * 0.85, p.font);
      var tw = D.measure(ctx, p.text, 800, size, p.font), th = size * 1.3;
      var rtl = D.isRTL(p.text);
      var a = E.inOutCubic(M.p(e.i, 0, 0.55)), b = E.inOutCubic(M.p(e.i, 0.45, 1));
      var oa = E.inOutCubic(M.p(e.o, 0, 0.5)), ob = E.inOutCubic(M.p(e.o, 0.5, 1));
      var x0 = s.cx - tw / 2 - 20 * u, w = tw + 40 * u;
      function span(from, to) { return rtl ? [x0 + w * (1 - to), x0 + w * (1 - from)] : [x0 + w * from, x0 + w * to]; }
      /* intro: bar sweeps in then uncovers the text; outro: bar sweeps in again and takes it away */
      var bar = e.o > 0 ? span(ob, oa) : span(b, a);
      var vis = e.o > 0 ? span(oa, 1) : span(0, b);
      ctx.fillStyle = p.accent;
      ctx.fillRect(bar[0], s.cy - th / 2, Math.max(0, bar[1] - bar[0]), th);
      ctx.save();
      ctx.beginPath(); ctx.rect(vis[0], s.cy - th, Math.max(0, vis[1] - vis[0]), th * 2); ctx.clip();
      D.text(ctx, p.text, s.cx, s.cy, { weight: 800, size: size, color: p.color, family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'slanted_glow', cat: 'text', name: { ar: 'مائل متوهج', en: 'Slanted Glow' }, dur: 3,
    fields: [F.text('فريق إبداعي'), F.accent('#ffb02e'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.6, 0.4);
      var size = D.fit(ctx, p.text, 900, 140 * u, W * 0.8, p.font);
      ctx.save(); ctx.translate(s.cx, s.cy); ctx.transform(1, 0, -0.22, 1, 0, 0);
      var slide = (1 - E.outExpo(e.i)) * 300 * u - E.inExpo(e.o) * 300 * u;
      for (var k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.18 * k * (1 - e.o) * e.i;
        D.text(ctx, p.text, slide * (1 + k * 0.4), k * size * 0.08, { weight: 900, size: size, color: 'transparent', stroke: AK.rgba(p.accent, 0.9), strokeWidth: 2 * u, family: p.font });
      }
      ctx.globalAlpha = M.clamp(e.i * 2, 0, 1) * (1 - e.o);
      D.glow(ctx, p.accent, 50 * u, function () { D.text(ctx, p.text, slide, 0, { weight: 900, size: size, color: p.color, family: p.font }); });
      ctx.restore();
    }
  });

  T.push({
    id: 'giant_echo', cat: 'text', name: { ar: 'صدى ضخم', en: 'Giant Echo' }, dur: 3,
    fields: [F.text('مهارات'), F.accent('#2f8cff'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.5, 0.4);
      var size = D.fit(ctx, p.text, 900, 260 * u, W * 0.95, p.font);
      for (var k = 1; k <= 4; k++) {
        var ph = ((t * 0.6 + k / 4) % 1);
        ctx.save(); ctx.translate(s.cx, s.cy); var sc = 1 + ph * 0.8; ctx.scale(sc, sc);
        ctx.globalAlpha = (1 - ph) * 0.35 * e.i * (1 - e.o);
        D.text(ctx, p.text, 0, 0, { weight: 900, size: size, color: 'transparent', stroke: p.accent, strokeWidth: 2.5 * u / sc, family: p.font });
        ctx.restore();
      }
      ctx.save(); ctx.translate(s.cx, s.cy);
      var k2 = M.lerp(1.6, 1, E.outExpo(e.i)) * (1 - 0.2 * e.o);
      ctx.scale(k2, k2); ctx.globalAlpha = e.i * (1 - e.o);
      D.text(ctx, p.text, 0, 0, { weight: 900, size: size, color: p.color, family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'neon', cat: 'text', name: { ar: 'نيون', en: 'Neon' }, dur: 3,
    fields: [F.text('افتح الآن'), F.accent('#ff2bd6')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.9, 0.35);
      var flick = [0, 1, 0, 0, 1, 0.3, 1, 1, 0, 1];
      var on = e.i < 1 ? flick[Math.floor(e.i * flick.length) % flick.length] : (Math.sin(t * 40) > 0.97 ? 0.5 : 1);
      on *= (1 - e.o);
      var size = D.fit(ctx, p.text, 700, 120 * u, W * 0.85, p.font);
      ctx.save(); ctx.globalAlpha = 0.25;
      D.text(ctx, p.text, s.cx, s.cy, { weight: 700, size: size, color: 'transparent', stroke: p.accent, strokeWidth: 3 * u, family: p.font });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = on;
      D.glow(ctx, p.accent, 45 * u, function () {
        D.text(ctx, p.text, s.cx, s.cy, { weight: 700, size: size, color: 'transparent', stroke: p.accent, strokeWidth: 7 * u, family: p.font });
        D.text(ctx, p.text, s.cx, s.cy, { weight: 700, size: size, color: 'transparent', stroke: '#fff', strokeWidth: 2.2 * u, family: p.font });
      });
      ctx.restore();
    }
  });

  T.push({
    id: 'text_3d', cat: 'text', name: { ar: 'نص 3D', en: '3D Text' }, dur: 3,
    fields: [F.text('ثلاثي الأبعاد'), F.accent('#2f8cff'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.7, 0.4);
      var size = D.fit(ctx, p.text, 900, 130 * u, W * 0.8, p.font);
      var rot = (1 - E.outBack(e.i, 1.4)) * 1.2 + E.inCubic(e.o) * -1.2;
      var depth = Math.round(22 * u) || 10;
      var sway = Math.sin(t * 1.5) * 0.25;
      ctx.save(); ctx.translate(s.cx, s.cy);
      ctx.scale(1, Math.max(0.02, Math.cos(rot)));
      ctx.globalAlpha = 1 - e.o;
      for (var d = depth; d > 0; d--) {
        D.text(ctx, p.text, d * (0.6 + sway), d, { weight: 900, size: size, color: AK.mix(p.accent, '#000000', 0.35 + 0.4 * d / depth), family: p.font });
      }
      var g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, AK.mix(p.color, p.accent, 0.25));
      D.text(ctx, p.text, 0, 0, { weight: 900, size: size, color: g, family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'thin_bold', cat: 'text', name: { ar: 'رفيع + عريض', en: 'Thin + Bold' }, dur: 3.5,
    fields: [F.text('أفضل'), F.sub('طريقة للمونتاج'), F.accent('#00e0b8'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u;
      var size = 95 * u;
      var lines = [{ s: p.text, w: 300, d: 0 }, { s: p.sub, w: 900, d: 0.15 }];
      lines.forEach(function (L, i) {
        if (!L.s) return;
        var e = AK.env(t - L.d, p.dur - L.d, 0.6, 0.35);
        var sz = D.fit(ctx, L.s, L.w, size * (i ? 1.15 : 0.95), W * 0.85, p.font);
        var y = s.cy + (i - 0.5) * size * 1.15;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, y - sz * 0.75, W, sz * 1.5); ctx.clip();
        var off = (1 - E.outExpo(e.i)) * sz * 1.4 - E.inExpo(e.o) * sz * 1.4;
        D.text(ctx, L.s, s.cx, y + off, { weight: L.w, size: sz, color: p.color, family: p.font });
        ctx.restore();
      });
      var eb = AK.env(t - 0.3, p.dur - 0.3, 0.6, 0.3);
      var bw = 160 * u * E.outExpo(eb.i) * (1 - eb.o);
      ctx.fillStyle = p.accent; D.rr(ctx, s.cx - bw / 2, s.cy + size * 1.25, bw, 8 * u, 4 * u); ctx.fill();
    }
  });

  T.push({
    id: 'glitch', cat: 'text', name: { ar: 'جلتش', en: 'Glitch' }, dur: 2.5,
    fields: [F.text('GLITCH غلتش'), F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.4, 0.3);
      var size = D.fit(ctx, p.text, 900, 120 * u, W * 0.85, p.font);
      var r = M.rand(Math.floor(t * 24) + 7);
      var burst = e.i < 1 || e.o > 0 || (t % 1.1) < 0.12;
      var amp = burst ? 18 * u : 0;
      ctx.save(); ctx.globalAlpha = (e.i < 1 ? (r() > 0.3 ? 1 : 0.2) : 1) * (1 - e.o);
      ctx.globalCompositeOperation = 'lighter';
      D.text(ctx, p.text, s.cx - amp * r(), s.cy, { weight: 900, size: size, color: 'rgba(255,0,80,0.9)', family: p.font });
      D.text(ctx, p.text, s.cx + amp * r(), s.cy + amp * 0.3 * r(), { weight: 900, size: size, color: 'rgba(0,220,255,0.9)', family: p.font });
      ctx.globalCompositeOperation = 'source-over';
      D.text(ctx, p.text, s.cx, s.cy, { weight: 900, size: size, color: p.color, family: p.font });
      if (burst) {
        for (var k = 0; k < 4; k++) {
          var yy = s.cy + (r() - 0.5) * size, hh = r() * size * 0.18;
          var img = ctx.getImageData(0, Math.max(0, yy) | 0, W, Math.max(1, hh | 0));
          ctx.putImageData(img, ((r() - 0.5) * 50 * u) | 0, Math.max(0, yy) | 0);
        }
      }
      ctx.restore();
    }
  });

  /* ======================= GLASS / UI ======================= */
  T.push({
    id: 'glass_card', cat: 'glass', name: { ar: 'بطاقة زجاجية', en: 'Glass Card' }, dur: 4,
    fields: [F.text('تم رفع الفيديو'), F.sub('الريلز جاهز للنشر'), F.accent('#ff3b5c')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.7, 0.4);
      var w = 820 * u, h = 190 * u;
      var k = E.outBack(e.i, 1.6), y = s.cy + (1 - E.outExpo(e.i)) * 120 * u + E.inCubic(e.o) * 80 * u;
      ctx.save(); ctx.globalAlpha = M.clamp(e.i * 2, 0, 1) * (1 - e.o);
      ctx.translate(s.cx, y); ctx.scale(M.lerp(0.85, 1, k), M.lerp(0.85, 1, k));
      D.glass(ctx, -w / 2, -h / 2, w, h, h * 0.32, { base: 'rgba(20,24,40,0.35)' });
      var ix = w / 2 - 110 * u;
      ctx.fillStyle = '#fff'; D.rr(ctx, ix - 55 * u, -55 * u, 110 * u, 110 * u, 28 * u); ctx.fill();
      ctx.fillStyle = p.accent; D.rr(ctx, ix - 30 * u, -30 * u, 60 * u, 60 * u, 12 * u); ctx.fill();
      ctx.globalAlpha *= M.p(t, 0.3, 0.7);
      D.text(ctx, p.text, ix - 90 * u, -24 * u, { weight: 800, size: 52 * u, align: 'right', family: p.font });
      D.text(ctx, p.sub, ix - 90 * u, 38 * u, { weight: 400, size: 36 * u, align: 'right', color: 'rgba(255,255,255,0.75)', family: p.font });
      D.text(ctx, AK.t('tpl.now'), -w / 2 + 50 * u, -45 * u, { weight: 400, size: 28 * u, align: 'left', color: 'rgba(255,255,255,0.6)', family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'subscribe', cat: 'glass', name: { ar: 'زر اشتراك + مؤشر', en: 'Subscribe + Cursor' }, dur: 4,
    fields: [F.text('اشترك عشان يوصلك الجديد'), { key: 'btn', type: 'text', label: 'f.button', def: 'اشترك' }, { key: 'done', type: 'text', label: 'f.after', def: 'مشترك' }, F.accent('#ff2d55')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.6, 0.4);
      var w = 860 * u, h = 140 * u;
      var clickT = 1.7, pressed = t > clickT;
      ctx.save(); ctx.globalAlpha = M.clamp(e.i * 2, 0, 1) * (1 - e.o);
      var k = M.lerp(0.7, 1, E.outBack(e.i, 1.8));
      ctx.translate(s.cx, s.cy); ctx.scale(k, k);
      D.glass(ctx, -w / 2, -h / 2, w, h, h / 2, { base: 'rgba(30,30,60,0.3)' });
      /* checkbox circle on the right */
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2 - 75 * u, 0, 40 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.accent; D.rr(ctx, w / 2 - 95 * u, -20 * u, 40 * u, 40 * u, 8 * u); ctx.fill();
      D.text(ctx, p.text, w / 2 - 140 * u, 0, { weight: 700, size: D.fit(ctx, p.text, 700, 40 * u, w * 0.48, p.font), align: 'right', family: p.font });
      /* button */
      var bp = M.p(t, clickT, clickT + 0.25);
      var bw = 220 * u, bh = 90 * u, bx = -w / 2 + 30 * u;
      var squish = 1 - Math.sin(bp * Math.PI) * 0.12;
      ctx.save(); ctx.translate(bx + bw / 2, 0); ctx.scale(squish, squish);
      ctx.fillStyle = pressed ? 'rgba(255,255,255,0.25)' : p.accent;
      D.glow(ctx, pressed ? 'transparent' : p.accent, 30 * u, function () { D.rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); });
      D.text(ctx, pressed ? p.done : p.btn, 0, 2 * u, { weight: 800, size: 40 * u, family: p.font });
      ctx.restore();
      ctx.restore();
      /* cursor */
      var cp = E.inOutCubic(M.p(t, 0.6, clickT));
      var cx = M.lerp(s.cx + 200 * u, s.cx + (bx + bw * 0.6) * k, cp), cy = M.lerp(s.cy + 320 * u, s.cy + 20 * u * k, cp);
      var press = t > clickT ? M.p(t, clickT, clickT + 0.4) : 0;
      ctx.save(); ctx.globalAlpha = M.p(t, 0.4, 0.7) * (1 - e.o);
      D.cursor(ctx, cx, cy, 1.6 * u, press > 0 && press < 1 ? press : 0);
      ctx.restore();
    }
  });

  T.push({
    id: 'notification', cat: 'glass', name: { ar: 'إشعار', en: 'Notification' }, dur: 4,
    fields: [{ key: 'app', type: 'text', label: 'f.app', def: 'Ali Kit' }, F.text('وصلك طلب جديد 🔥'), F.sub('افتح التطبيق للتفاصيل'), F.accent('#2f8cff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.6, 0.45);
      var w = 900 * u, h = 210 * u;
      var y = s.cy - (1 - E.outBack(e.i, 1.3)) * 400 * u - E.inBack(e.o) * 400 * u;
      ctx.save(); ctx.globalAlpha = 1 - e.o * 0.5;
      ctx.translate(s.cx, y);
      D.glass(ctx, -w / 2, -h / 2, w, h, 48 * u, { base: 'rgba(30,32,40,0.55)' });
      var ix = w / 2 - 95 * u;
      var g = ctx.createLinearGradient(ix - 50 * u, -50 * u, ix + 50 * u, 50 * u);
      g.addColorStop(0, AK.mix(p.accent, '#ffffff', 0.3)); g.addColorStop(1, p.accent);
      ctx.fillStyle = g; D.rr(ctx, ix - 50 * u, -70 * u, 100 * u, 100 * u, 24 * u); ctx.fill();
      D.text(ctx, '⚡', ix, -20 * u, { weight: 900, size: 50 * u });
      D.text(ctx, p.app, ix - 80 * u, -62 * u, { weight: 500, size: 30 * u, align: 'right', color: 'rgba(255,255,255,0.7)', family: p.font });
      D.text(ctx, p.text, ix - 80 * u, -10 * u, { weight: 800, size: 44 * u, align: 'right', family: p.font });
      D.text(ctx, p.sub, ix - 80 * u, 50 * u, { weight: 400, size: 34 * u, align: 'right', color: 'rgba(255,255,255,0.8)', family: p.font });
      D.text(ctx, AK.t('tpl.now'), -w / 2 + 45 * u, -62 * u, { weight: 400, size: 28 * u, align: 'left', color: 'rgba(255,255,255,0.6)', family: p.font });
      ctx.restore();
    }
  });
  E.inBack = function (x) { var c1 = 1.70158, c3 = c1 + 1; return c3 * x * x * x - c1 * x * x; };

  T.push({
    id: 'search_bar', cat: 'glass', name: { ar: 'شريط بحث يكتب', en: 'Typing Search Bar' }, dur: 4,
    fields: [F.text('أفضل أدوات المونتاج'), F.accent('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.6, 0.4);
      var w = 880 * u, h = 130 * u;
      ctx.save(); ctx.globalAlpha = M.clamp(e.i * 2, 0, 1) * (1 - e.o);
      ctx.translate(s.cx, s.cy); var k = M.lerp(0.6, 1, E.outBack(e.i, 1.5)); ctx.scale(k, 1);
      D.glass(ctx, -w / 2, -h / 2, w, h, h / 2, { base: 'rgba(20,20,40,0.25)' });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = e.i * (1 - e.o); ctx.translate(s.cx, s.cy);
      /* magnifier */
      var mx = w / 2 - 75 * u;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(mx, -6 * u, 22 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 16 * u, 10 * u); ctx.lineTo(mx - 32 * u, 26 * u); ctx.stroke();
      var chars = Array.from(p.text || '');
      var n = Math.floor(chars.length * M.p(t, 0.7, 0.7 + chars.length * 0.07));
      var shown = chars.slice(0, n).join('');
      var rtl = D.isRTL(p.text), size = D.fit(ctx, p.text, 600, 48 * u, w - 220 * u, p.font);
      var tx = rtl ? mx - 60 * u : -w / 2 + 60 * u;
      D.text(ctx, shown, tx, 2 * u, { weight: 600, size: size, align: rtl ? 'right' : 'left', family: p.font });
      var tw = D.measure(ctx, shown, 600, size, p.font);
      if (Math.floor(t * 2.5) % 2 === 0 || n < chars.length) {
        ctx.fillStyle = p.accent;
        ctx.fillRect(rtl ? tx - tw - 10 * u : tx + tw + 6 * u, -size * 0.6, 4 * u, size * 1.2);
      }
      ctx.restore();
    }
  });

  T.push({
    id: 'toggle', cat: 'glass', name: { ar: 'زر تفعيل', en: 'Toggle Switch' }, dur: 3,
    fields: [F.text('الوضع الاحترافي'), F.accent('#34c759')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.5, 0.4);
      var on = E.outBack(M.p(t, 1.0, 1.35), 2);
      ctx.save(); ctx.globalAlpha = e.i * (1 - e.o); ctx.translate(s.cx, s.cy);
      var tw = 220 * u, th = 120 * u, x0 = -tw / 2 + (p.text ? 230 * u : 0);
      ctx.fillStyle = AK.rgba(AK.mix('#555a66', p.accent, M.clamp(on, 0, 1)), 0.95);
      D.rr(ctx, x0, -th / 2, tw, th, th / 2); ctx.fill();
      D.glass(ctx, x0, -th / 2, tw, th, th / 2, { shadow: false, alpha: 0.7 });
      var kx = M.lerp(x0 + th / 2, x0 + tw - th / 2, on);
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 20 * u;
      ctx.beginPath(); ctx.ellipse(kx, 0, th * 0.42 * (1 + Math.sin(M.p(t, 1.0, 1.35) * Math.PI) * 0.25), th * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      if (p.text) D.text(ctx, p.text, x0 - 40 * u, 0, { weight: 800, size: 58 * u, align: 'right', family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'name_callout', cat: 'glass', name: { ar: 'بطاقة اسم', en: 'Name Callout' }, dur: 4,
    fields: [F.text('علي عباس'), F.sub('مونتير ومصمم'), F.accent('#ffb02e')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.7, 0.45);
      var nameSize = 64 * u, subSize = 36 * u;
      var w = Math.max(D.measure(ctx, p.text, 900, nameSize, p.font), D.measure(ctx, p.sub, 400, subSize, p.font)) + 120 * u;
      var h = 190 * u;
      var open = E.outExpo(e.i) * (1 - E.inExpo(e.o));
      ctx.save(); ctx.translate(s.cx + w / 2, s.cy);
      ctx.fillStyle = p.accent; D.rr(ctx, -14 * u, -h / 2, 14 * u, h * M.clamp(e.i * 3, 0, 1) * (1 - e.o), 7 * u); ctx.fill();
      ctx.beginPath(); ctx.rect(-w - 30 * u, -h, w + 10 * u, h * 2); ctx.clip();
      ctx.translate((1 - open) * (w + 20 * u), 0);
      D.glass(ctx, -w - 24 * u, -h / 2, w, h, 26 * u, { base: 'rgba(10,12,24,0.45)' });
      D.text(ctx, p.text, -60 * u, -28 * u, { weight: 900, size: nameSize, align: 'right', family: p.font });
      D.text(ctx, p.sub, -60 * u, 46 * u, { weight: 400, size: subSize, align: 'right', color: p.accent, family: p.font });
      ctx.restore();
    }
  });

  /* ======================= INFOGRAPHIC / ELEMENTS ======================= */
  T.push({
    id: 'counter', cat: 'info', name: { ar: 'عداد أرقام', en: 'Counter' }, dur: 4,
    fields: [{ key: 'value', type: 'number', label: 'f.value', def: 1207 }, { key: 'prefix', type: 'text', label: 'f.prefix', def: '+ ' }, F.sub('مشترك جديد'), F.accent('#2f8cff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.5, 0.4);
      var v = Math.round((+p.value || 0) * E.outExpo(M.p(t, 0.3, p.dur * 0.65)));
      var str = (p.prefix || '') + v.toLocaleString('en-US');
      var w = 640 * u, h = 170 * u;
      ctx.save(); ctx.globalAlpha = e.i * (1 - e.o); ctx.translate(s.cx, s.cy);
      var k = M.lerp(0.8, 1, E.outBack(e.i, 2)); ctx.scale(k, k);
      D.glass(ctx, -w / 2, -h / 2, w, h, 30 * u, { base: 'rgba(8,10,20,0.55)', dark: true });
      /* people icon */
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * u;
      var ix = -w / 2 + 100 * u;
      ctx.beginPath(); ctx.arc(ix, -18 * u, 22 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ix, 50 * u, 42 * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(ix + 38 * u, -10 * u, 16 * u, 0, Math.PI * 2); ctx.stroke();
      D.text(ctx, str, ix + 90 * u, -4 * u, { weight: 500, size: 90 * u, align: 'left', family: 'Helvetica Neue' });
      ctx.restore();
      if (p.sub) { ctx.save(); ctx.globalAlpha = M.p(t, 0.5, 0.9) * (1 - e.o); D.text(ctx, p.sub, s.cx, s.cy + h * 0.8 * k, { weight: 700, size: 44 * u, family: p.font }); ctx.restore(); }
      ctx.save(); ctx.globalAlpha = 0.9 * e.i * (1 - e.o); ctx.fillStyle = p.accent;
      D.rr(ctx, s.cx - w / 2 * k, s.cy + h / 2 * k + 6 * u, w * k * E.outExpo(M.p(t, 0.3, p.dur * 0.65)), 6 * u, 3 * u); ctx.fill(); ctx.restore();
    }
  });

  T.push({
    id: 'progress', cat: 'info', name: { ar: 'شريط تقدم', en: 'Progress Bar' }, dur: 4,
    fields: [F.text('جاري التحميل...'), F.sub('Saving a backup'), F.accent('#4f7cff')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.5, 0.4);
      var w = 820 * u, h = 120 * u;
      var prog = E.inOutCubic(M.p(t, 0.5, p.dur - 0.6));
      ctx.save(); ctx.globalAlpha = e.i * (1 - e.o); ctx.translate(s.cx, s.cy);
      D.glass(ctx, -w / 2, -h / 2, w, h, 26 * u, { base: 'rgba(8,10,24,0.6)', dark: true });
      D.text(ctx, p.text, w / 2 - 40 * u, -16 * u, { weight: 700, size: 36 * u, align: 'right', family: p.font });
      D.text(ctx, p.sub, -w / 2 + 40 * u, -16 * u, { weight: 400, size: 26 * u, align: 'left', color: 'rgba(255,255,255,0.55)', family: p.font });
      var bw = w - 80 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; D.rr(ctx, -bw / 2, 22 * u, bw, 10 * u, 5 * u); ctx.fill();
      var g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, p.accent); g.addColorStop(1, '#ff4f8b');
      ctx.fillStyle = g; D.glow(ctx, p.accent, 16 * u, function () { D.rr(ctx, bw / 2 - bw * prog, 22 * u, bw * prog, 10 * u, 5 * u); ctx.fill(); });
      D.text(ctx, Math.round(prog * 100) + '%', 0, -16 * u, { weight: 600, size: 26 * u, color: 'rgba(255,255,255,0.8)' });
      ctx.restore();
    }
  });

  T.push({
    id: 'arrow', cat: 'info', name: { ar: 'سهم مرسوم', en: 'Drawn Arrow' }, dur: 3,
    fields: [F.text('شوف هنا'), F.accent('#ffdd00')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.9, 0.4);
      var pts = [];
      for (var i = 0; i <= 40; i++) {
        var k = i / 40;
        pts.push([s.cx + 260 * u - k * 260 * u + Math.sin(k * Math.PI) * 90 * u, s.cy + 260 * u - k * 260 * u - Math.sin(k * Math.PI) * 30 * u]);
      }
      ctx.save(); ctx.globalAlpha = 1 - e.o;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 12 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      D.partialPath(ctx, pts, E.outCubic(M.p(e.i, 0, 0.75)));
      var hp = E.outBack(M.p(e.i, 0.7, 1), 2.5);
      if (hp > 0) {
        var a = Math.atan2(pts[40][1] - pts[37][1], pts[40][0] - pts[37][0]);
        ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(a); ctx.scale(hp, hp);
        ctx.beginPath(); ctx.moveTo(-50 * u, -34 * u); ctx.lineTo(0, 0); ctx.lineTo(-50 * u, 34 * u); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = M.p(t, 0.2, 0.6) * (1 - e.o);
      D.text(ctx, p.text, s.cx + 270 * u, s.cy + 330 * u, { weight: 900, size: 64 * u, color: p.accent, stroke: 'rgba(0,0,0,0.6)', strokeWidth: 10 * u, family: p.font });
      D.text(ctx, p.text, s.cx + 270 * u, s.cy + 330 * u, { weight: 900, size: 64 * u, color: p.accent, family: p.font });
      ctx.restore();
    }
  });

  T.push({
    id: 'circle_mark', cat: 'info', name: { ar: 'دائرة تحديد', en: 'Circle Highlight' }, dur: 3,
    fields: [F.accent('#ff3b30'), { key: 'w', type: 'number', label: 'f.width', def: 360 }, { key: 'h', type: 'number', label: 'f.height', def: 220 }],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.8, 0.4);
      var rx = (+p.w || 360) / 2 * u, ry = (+p.h || 220) / 2 * u, pts = [];
      for (var i = 0; i <= 80; i++) {
        var a = -Math.PI * 0.6 + (i / 80) * Math.PI * 2.25;
        var wob = 1 + Math.sin(i * 0.4) * 0.03 + i / 80 * 0.08;
        pts.push([s.cx + Math.cos(a) * rx * wob, s.cy + Math.sin(a) * ry * wob]);
      }
      ctx.save(); ctx.globalAlpha = 1 - e.o;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 10 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      D.glow(ctx, AK.rgba(p.accent, 0.6), 18 * u, function () { D.partialPath(ctx, pts, E.inOutCubic(e.i)); });
      ctx.restore();
    }
  });

  T.push({
    id: 'quote', cat: 'info', name: { ar: 'بطاقة اقتباس', en: 'Quote Card' }, dur: 4.5,
    fields: [F.text('“فينا نستفيد من قدرة الجسم”'), F.sub('★★★★★'), F.accent('#b0102c')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.6, 0.4);
      var w = 780 * u, h = 260 * u;
      ctx.save(); ctx.globalAlpha = M.clamp(e.i * 2, 0, 1) * (1 - e.o);
      ctx.translate(s.cx, s.cy + (1 - E.outBack(e.i, 1.4)) * 140 * u);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
      ctx.fillStyle = '#fff'; D.rr(ctx, -w / 2, -h / 2, w, h, 34 * u); ctx.fill();
      ctx.shadowColor = 'transparent';
      var ap = E.outBack(M.p(t, 0.35, 0.8), 2.5);
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(0, -h / 2, 70 * u * ap, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8 * u; ctx.stroke();
      var chars = Array.from(p.text || ''), n = Math.floor(chars.length * M.p(t, 0.6, 0.6 + chars.length * 0.045));
      D.text(ctx, chars.slice(0, n).join(''), 0, 10 * u, { weight: 800, size: D.fit(ctx, p.text, 800, 48 * u, w - 80 * u, p.font), color: '#1a1a1a', family: p.font });
      ctx.globalAlpha *= M.p(t, 1.2, 1.6);
      D.text(ctx, p.sub, 0, 85 * u, { weight: 400, size: 34 * u, color: '#f5b400' });
      ctx.restore();
    }
  });

  T.push({
    id: 'handle', cat: 'info', name: { ar: 'حساب سوشال', en: 'Social Handle' }, dur: 3.5,
    fields: [F.text('@ali.abbas'), F.accent('#e1306c')],
    draw: function (ctx, t, p, W, H) {
      var s = setup(ctx, p, W, H), u = s.u, e = AK.env(t, p.dur, 0.7, 0.4);
      var size = 54 * u, tw = D.measure(ctx, p.text, 700, size, p.font);
      var full = tw + 190 * u, h = 120 * u;
      var w = M.lerp(h, full, E.outExpo(M.p(e.i, 0.35, 1))) * (1 - E.inExpo(e.o) * 0.6);
      ctx.save(); ctx.globalAlpha = M.clamp(e.i * 3, 0, 1) * (1 - e.o); ctx.translate(s.cx, s.cy);
      D.glass(ctx, -w / 2, -h / 2, w, h, h / 2, { base: 'rgba(10,10,20,0.4)' });
      var ix = -w / 2 + h / 2;
      var g = ctx.createLinearGradient(ix - 40 * u, 40 * u, ix + 40 * u, -40 * u);
      g.addColorStop(0, '#feda75'); g.addColorStop(0.5, p.accent); g.addColorStop(1, '#4f5bd5');
      ctx.fillStyle = g; D.rr(ctx, ix - 40 * u, -40 * u, 80 * u, 80 * u, 24 * u); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * u;
      D.rr(ctx, ix - 24 * u, -24 * u, 48 * u, 48 * u, 14 * u); ctx.stroke();
      ctx.beginPath(); ctx.arc(ix, 0, 11 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h, w, 2 * h); ctx.clip();
      D.text(ctx, p.text, ix + 70 * u, 2 * u, { weight: 700, size: size, align: 'left', family: p.font });
      ctx.restore(); ctx.restore();
    }
  });

  /* ======================= OVERLAYS / TRANSITION FX ======================= */
  T.push({
    id: 'flash', cat: 'fx', name: { ar: 'فلاش أبيض', en: 'White Flash' }, dur: 0.7, fullframe: true,
    fields: [F.color('#ffffff')],
    draw: function (ctx, t, p, W, H) {
      var k = t < p.dur * 0.3 ? E.outCubic(t / (p.dur * 0.3)) : 1 - E.inOutCubic((t - p.dur * 0.3) / (p.dur * 0.7));
      var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, AK.rgba(p.color, k)); g.addColorStop(1, AK.rgba(p.color, k * 0.7));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  });

  T.push({
    id: 'light_leak', cat: 'fx', name: { ar: 'تسريب ضوئي', en: 'Light Leak' }, dur: 1.5, fullframe: true,
    fields: [F.accent('#ff8a00'), F.color('#ff2e63')],
    draw: function (ctx, t, p, W, H) {
      var k = Math.sin(M.p(t, 0, p.dur) * Math.PI);
      var x = M.lerp(-0.3, 1.3, M.p(t, 0, p.dur)) * W;
      ctx.globalCompositeOperation = 'source-over';
      [[p.accent, 0, 0.9], [p.color, 0.25, 0.7], ['#ffe9a8', -0.15, 0.5]].forEach(function (c) {
        var g = ctx.createRadialGradient(x + c[1] * W, H * (0.4 + c[1]), 0, x + c[1] * W, H * (0.4 + c[1]), Math.max(W, H) * 0.6);
        g.addColorStop(0, AK.rgba(c[0], c[2] * k)); g.addColorStop(1, AK.rgba(c[0], 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
    }
  });

  T.push({
    id: 'swipe_shape', cat: 'fx', name: { ar: 'مسح دائري', en: 'Circle Wipe' }, dur: 1, fullframe: true,
    fields: [F.accent('#2f8cff'), F.color('#0b0f1c')],
    draw: function (ctx, t, p, W, H) {
      var R = Math.hypot(W, H) * 0.55;
      var a = E.inOutCubic(M.p(t, 0, p.dur * 0.5)), b = E.inOutCubic(M.p(t, p.dur * 0.5, p.dur));
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * a, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * M.p(a, 0.15, 1), 0, Math.PI * 2); ctx.fill();
      if (b > 0) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(W / 2, H / 2, R * b, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
  });

  AK.templates = T;
  AK.templateCats = [
    { id: 'all', icon: '▦' }, { id: 'text', icon: 'Aa' }, { id: 'glass', icon: '◩' }, { id: 'info', icon: '◔' }, { id: 'fx', icon: '✦' }
  ];
  AK.templateDefaults = function (tpl) {
    var p = { x: 0.5, y: 0.5, scale: 1, dur: tpl.dur, font: '' };
    tpl.fields.forEach(function (f) { p[f.key] = f.def; });
    return p;
  };
})(window);
