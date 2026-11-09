/* Tool: transitions library — keyframed camera moves on cuts + rendered overlay transitions */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, E = AK.ease, M = AK.m;

  AK.addStrings({
    'tr.title': ['مكتبة الانتقالات', 'Transitions'],
    'tr.desc': ['زووم، سلايد، لف، اهتزاز، فلاش', 'Zoom, slide, spin, shake, flash'],
    'tr.zoomIn': ['زووم دخول', 'Zoom In'], 'tr.zoomOut': ['زووم خروج', 'Zoom Out'],
    'tr.left': ['سلايد يسار', 'Slide Left'], 'tr.right': ['سلايد يمين', 'Slide Right'], 'tr.up': ['سلايد فوق', 'Slide Up'], 'tr.down': ['سلايد جوة', 'Slide Down'],
    'tr.spin': ['لف', 'Spin'], 'tr.shake': ['اهتزاز', 'Shake'], 'tr.fade': ['تلاشي', 'Fade'],
    'tr.flash': ['فلاش', 'Flash'], 'tr.leak': ['تسريب ضوئي', 'Light Leak'], 'tr.wipe': ['مسح دائري', 'Circle Wipe'],
    'tr.amount': ['القوة', 'Strength'],
    'tr.here': ['طبّق على القطع عند المؤشر', 'Apply at the cut nearest the playhead'],
    'tr.all': ['طبّق على كل القطعات بالتراك', 'Apply to every cut on the track'],
    'tr.help': ['حط المؤشر على القطع بين كليبين. الحركات تنضاف كـ keyframes تكدر تعدلها بعدين.', 'Put the playhead on a cut between two clips. Moves are added as editable keyframes.'],
    'tr.applied': ['انطبق على {n} قطع', 'Applied to {n} cuts']
  });

  var TYPES = [
    { id: 'zoomIn', kind: 'kf' }, { id: 'zoomOut', kind: 'kf' }, { id: 'left', kind: 'kf' }, { id: 'right', kind: 'kf' },
    { id: 'up', kind: 'kf' }, { id: 'down', kind: 'kf' }, { id: 'spin', kind: 'kf' }, { id: 'shake', kind: 'kf' }, { id: 'fade', kind: 'kf' },
    { id: 'flash', kind: 'overlay', tpl: 'flash' }, { id: 'leak', kind: 'overlay', tpl: 'light_leak' }, { id: 'wipe', kind: 'overlay', tpl: 'swipe_shape' }
  ];
  var o = { type: 'zoomIn', duration: 0.5, amount: 1, track: 0 };

  /* tiny preview: two "clips" (blue / orange) animated with the transition */
  function previewDraw(type) {
    return function (ctx, t, W, H) {
      var k = M.p(t, 0.3, 1.1), first = k < 0.5, q = first ? E.inCubic(k * 2) : E.outCubic((k - 0.5) * 2);
      function clip(color, sc, dx, dy, rot, alpha) {
        ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.translate(W / 2 + dx * W, H / 2 + dy * H); ctx.rotate(rot || 0); ctx.scale(sc, sc);
        var g = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
        g.addColorStop(0, color[0]); g.addColorStop(1, color[1]);
        ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 ' + H * 0.3 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(color[2], 0, 0);
        ctx.restore();
      }
      var A = ['#1e4bd8', '#29a3ff', 'A'], B = ['#ff6a3d', '#ffb02e', 'B'];
      var d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[type];
      if (type === 'zoomIn') first ? clip(A, 1 + q * 1.5, 0, 0) : clip(B, 1.6 - q * 0.6, 0, 0);
      else if (type === 'zoomOut') first ? clip(A, 1 - q * 0.35, 0, 0) : clip(B, 1.5 - q * 0.5, 0, 0);
      else if (d) first ? clip(A, 1, -d[0] * q, -d[1] * q) : clip(B, 1, d[0] * (1 - q), d[1] * (1 - q));
      else if (type === 'spin') first ? clip(A, 1 + q * 0.6, 0, 0, q * Math.PI) : clip(B, 1.6 - q * 0.6, 0, 0, -(1 - q) * Math.PI);
      else if (type === 'shake') { if (first) clip(A, 1, 0, 0); else { var f = (1 - q) * 0.06; clip(B, 1.08, (Math.random() - 0.5) * f, (Math.random() - 0.5) * f); } }
      else if (type === 'fade') { clip(A, 1, 0, 0); clip(B, 1, 0, 0, 0, k); }
      else {
        var tpl = AK.templates.filter(function (x) { return x.id === ({ flash: 'flash', leak: 'light_leak', wipe: 'swipe_shape' })[type]; })[0];
        k < 0.5 ? clip(A, 1, 0, 0) : clip(B, 1, 0, 0);
        var p = AK.templateDefaults(tpl);
        tpl.draw(ctx, M.p(t, 0.3, 1.1) * p.dur, p, W, H);
      }
    };
  }

  AK.registerTool({
    id: 'transitions', icon: '⇄', title: 'tr.title', desc: 'tr.desc', colors: ['#1d5bff', '#5b8cff'], badge: 'new',
    mount: function (el) {
      var stops = [];
      AK.onLeave(function () { stops.forEach(function (s) { s(); }); });
      var grid = h('div', { class: 'trans-grid' });
      TYPES.forEach(function (tp) {
        var cv = h('canvas', { width: 160, height: 100 });
        var card = h('button', { class: 'trans-card' + (o.type === tp.id ? ' on' : ''), onclick: function () {
          o.type = tp.id;
          Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('on'); });
          card.classList.add('on');
        } }, [cv, h('span', {}, AK.t('tr.' + tp.id))]);
        stops.push(AK.preview(cv, 1.4, previewDraw(tp.id), { pause: 0.2 }));
        grid.appendChild(card);
      });
      el.appendChild(ui.note(AK.t('tr.help')));
      el.appendChild(ui.section(null, [grid]));
      el.appendChild(ui.section(null, [
        h('div', { class: 'row' }, [
          ui.field(AK.t('f.duration'), ui.slider(0.2, 2, 0.05, o.duration, function (v) { o.duration = v; }, function (v) { return v.toFixed(2) + 's'; })),
          ui.field(AK.t('tr.amount'), ui.slider(0.2, 2, 0.05, o.amount, function (v) { o.amount = v; }, function (v) { return Math.round(v * 100) + '%'; }))
        ]),
        ui.field(AK.t('f.track'), ui.trackSelect('video', o.track, function (v) { o.track = v; }))
      ]));
      el.appendChild(h('div', { class: 'actions' }, [
        ui.button(AK.t('tr.here'), function () { return applyAt(null).then(function () { AK.toast(AK.t('st.done'), 'ok'); }); }, 'primary'),
        ui.button(AK.t('tr.all'), applyAll)
      ]));

      function current() { return TYPES.filter(function (x) { return x.id === o.type; })[0]; }
      function applyAt(time) {
        var tp = current();
        if (tp.kind === 'kf') return AK.host('ak_transition', { type: tp.id, duration: o.duration, amount: o.amount, track: o.track, time: time });
        /* overlay: render the effect centred on the cut */
        var tpl = AK.templates.filter(function (x) { return x.id === tp.tpl; })[0];
        var p = AK.templateDefaults(tpl); p.dur = Math.max(o.duration, 0.3) * (tp.id === 'flash' ? 1.2 : 2);
        var t0 = (time === null ? null : time - p.dur / 2);
        var go = t0 === null ? AK.seqInfo(true).then(function (s) { return s.playhead - p.dur / 2; }) : Promise.resolve(t0);
        return go.then(function (start) {
          return AK.renderAndPlace({ name: tp.tpl, duration: p.dur, time: Math.max(0, start), folder: 'Transitions', draw: function (ctx, t, W, H) { tpl.draw(ctx, t, p, W, H); } });
        });
      }
      function applyAll() {
        return Promise.all([AK.host('ak_trackClips', { kind: 'video', track: o.track }), AK.seqInfo()]).then(function (rs) {
          var clips = rs[0].clips, fd = 1 / rs[1].fps, cuts = [];
          for (var i = 0; i < clips.length - 1; i++) if (Math.abs(clips[i + 1].start - clips[i].end) <= fd * 1.5) cuts.push(clips[i].end);
          if (!cuts.length) throw new Error(AK.t('err.noClips'));
          var i2 = 0;
          return AK.job(AK.t('st.placing'), function (b) {
            function next() {
              if (i2 >= cuts.length) return Promise.resolve();
              b.set(null, i2 / cuts.length);
              return applyAt(cuts[i2++]).then(next);
            }
            return next();
          }).then(function () { AK.toast(AK.t('tr.applied', { n: cuts.length }), 'ok'); });
        });
      }
    }
  });
})();
