/* Tool: Auto Cut — remove silences from the timeline */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, A = AK.analysis;

  AK.addStrings({
    'ac.title': ['Auto Cut', 'Auto Cut'],
    'ac.desc': ['يحذف السكتات والفراغات تلقائياً', 'Removes silences automatically'],
    'ac.ref': ['تراك الصوت المرجعي', 'Reference audio track'],
    'ac.thr': ['حد الصمت (dB)', 'Silence threshold (dB)'],
    'ac.auto': ['تلقائي', 'Auto'],
    'ac.min': ['أقل مدة سكتة', 'Minimum silence'],
    'ac.pad': ['هامش قبل وبعد الكلام', 'Padding around speech'],
    'ac.backup': ['احفظ نسخة احتياطية من السيكونس قبل القص', 'Save a backup sequence before cutting'],
    'ac.result': ['{n} سكتة · راح ينحذف {s} ثانية من {t}', '{n} silences · removes {s}s of {t}'],
    'ac.cut': ['قص السكتات', 'Cut silences'],
    'ac.cutting': ['جاري قص التايملاين...', 'Cutting timeline...'],
    'ac.allTracks': ['قص كل التراكات (فيديو + صوت)', 'Cut all tracks (video + audio)'],
    'ac.help': ['يحلل الصوت ويحدد الأماكن الساكتة. الأحمر = راح ينحذف.', 'Analyzes audio and marks silent parts. Red = removed.']
  });

  var o = { track: 0, threshold: -38, auto: true, minSilence: 0.45, padding: 0.12, backup: true, allTracks: true };
  var last = null;

  AK.registerTool({
    id: 'autocut', icon: '✂', title: 'ac.title', desc: 'ac.desc', colors: ['#ff4d6a', '#ff8a3d'], badge: 'popular',
    mount: function (el) {
      var strip = h('canvas', { class: 'timeline-strip', width: 800, height: 34 });
      var res = h('div', { class: 'hint' });
      var thrSlider;
      el.appendChild(ui.note(AK.t('ac.help')));
      el.appendChild(ui.section(null, [
        ui.field(AK.t('ac.ref'), ui.trackSelect('audio', o.track, function (v) { o.track = v; last = null; })),
        h('div', { class: 'row' }, [
          ui.field(AK.t('ac.thr'), thrSlider = ui.slider(-70, -15, 1, o.threshold, function (v) { o.threshold = v; o.auto = false; recompute(); }, function (v) { return v + ' dB'; })),
          ui.check(AK.t('ac.auto'), o.auto, function (v) { o.auto = v; recompute(); })
        ]),
        h('div', { class: 'row' }, [
          ui.field(AK.t('ac.min'), ui.slider(0.15, 3, 0.05, o.minSilence, function (v) { o.minSilence = v; recompute(); }, function (v) { return v.toFixed(2) + 's'; })),
          ui.field(AK.t('ac.pad'), ui.slider(0, 0.5, 0.01, o.padding, function (v) { o.padding = v; recompute(); }, function (v) { return v.toFixed(2) + 's'; }))
        ]),
        ui.check(AK.t('ac.allTracks'), o.allTracks, function (v) { o.allTracks = v; }),
        ui.check(AK.t('ac.backup'), o.backup, function (v) { o.backup = v; }),
        ui.button(AK.t('btn.analyze'), analyze, 'block')
      ]));
      el.appendChild(ui.section(null, [strip, res]));
      el.appendChild(ui.button(AK.t('ac.cut'), cut, 'primary block'));

      function analyze() {
        return AK.host('ak_trackClips', { kind: 'audio', track: o.track }).then(function (r) {
          if (!r.clips.length) throw new Error(AK.t('err.noClips'));
          return AK.job(AK.t('st.analyzing'), function (b) {
            var win = 0.05;
            return AK.trackLoudness(r.clips, win, function (p) { b.set(null, p); }).then(function (db) {
              /* regions with no clip on the reference track are never "silence" (protects B-roll) */
              var covered = new Uint8Array(db.length);
              r.clips.forEach(function (c) { for (var i = Math.floor(c.start / win); i < Math.ceil(c.end / win) && i < db.length; i++) covered[i] = 1; });
              for (var i = 0; i < db.length; i++) if (!covered[i]) db[i] = 0;
              var end = 0; r.clips.forEach(function (c) { end = Math.max(end, c.end); });
              last = { db: db, win: win, end: end };
              recompute();
            });
          });
        });
      }
      function recompute() {
        if (!last) return;
        var thr = o.auto ? Math.round(A.autoThreshold(last.db, 8)) : o.threshold;
        if (o.auto) { var s = thrSlider.querySelector('input'); s.value = thr; thrSlider.querySelector('.slider-val').textContent = thr + ' dB'; }
        last.ranges = A.silences(last.db, last.win, { threshold: thr, minSilence: o.minSilence, padding: o.padding, totalEnd: last.end });
        var removed = last.ranges.reduce(function (a, r) { return a + r[1] - r[0]; }, 0);
        res.textContent = AK.t('ac.result', { n: last.ranges.length, s: removed.toFixed(1), t: AK.fmtTime(last.end) });
        drawStrip();
      }
      function drawStrip() {
        var ctx = strip.getContext('2d'), W = strip.width, H = strip.height;
        ctx.clearRect(0, 0, W, H);
        var db = last.db, n = db.length;
        ctx.fillStyle = '#2f8cff';
        for (var x = 0; x < W; x++) {
          var i0 = Math.floor(x / W * n), i1 = Math.max(i0 + 1, Math.floor((x + 1) / W * n)), mx = -120;
          for (var i = i0; i < i1; i++) mx = Math.max(mx, db[i]);
          var hh = Math.max(1, (mx + 70) / 70 * H);
          ctx.fillRect(x, (H - hh) / 2, 1, hh);
        }
        ctx.fillStyle = 'rgba(255,60,90,0.55)';
        var total = n * last.win;
        last.ranges.forEach(function (r) { ctx.fillRect(r[0] / total * W, 0, Math.max(1, (r[1] - r[0]) / total * W), H); });
      }
      function cut() {
        var p = last ? Promise.resolve() : analyze();
        return p.then(function () {
          if (!last.ranges.length) return;
          return AK.job(AK.t('ac.cutting'), function (b) {
            return (o.backup ? (b.set(AK.t('st.backup')), AK.host('ak_backupSequence')) : Promise.resolve()).then(function () {
              b.set(AK.t('ac.cutting'));
              return AK.host('ak_removeRanges', { ranges: last.ranges, tracks: o.allTracks ? null : { video: [], audio: [o.track] } });
            });
          }).then(function (r) { last = null; AK.toast(AK.t('st.done') + ' (' + r.removed + ')', 'ok'); });
        });
      }
      if (last) recompute();
    }
  });
})();
