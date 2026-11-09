/* Tool: podcast multicam — automatic camera switching by who is talking */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, A = AK.analysis;

  AK.addStrings({
    'pc.title': ['مونتاج البودكاست', 'Podcast Multicam'],
    'pc.desc': ['يقطع على الكاميرا حسب منو دا يحچي', 'Cuts to whoever is speaking'],
    'pc.mode': ['الشكل', 'Layout'],
    'pc.switch': ['تبديل كاميرات (يوتيوب / ريلز)', 'Switch cameras (YouTube / Reels)'],
    'pc.stack': ['ريلز · فوق بعض', 'Reels · stacked'],
    'pc.cams': ['الكاميرات والمايكات', 'Cameras & mics'],
    'pc.cam': ['كاميرا {n}', 'Camera {n}'],
    'pc.mic': ['مايك', 'Mic'],
    'pc.addCam': ['+ كاميرا', '+ Camera'],
    'pc.wide': ['لقطة واسعة (اختياري)', 'Wide shot (optional)'],
    'pc.none': ['بدون', 'None'],
    'pc.minShot': ['أقل مدة لقطة', 'Minimum shot length'],
    'pc.sens': ['الحساسية', 'Sensitivity'],
    'pc.lead': ['القطع قبل الكلام بـ', 'Cut before speech by'],
    'pc.result': ['{n} قطعة · {d}', '{n} cuts · {d}'],
    'pc.top': ['الكاميرا الفوق', 'Top camera'],
    'pc.bottom': ['الكاميرا الجوة', 'Bottom camera'],
    'pc.help': ['حط كل كاميرا على تراك فيديو، وكل مايك على تراك صوت، ومزامنة الكل قبل التشغيل.', 'Put each camera on its own video track and each mic on its own audio track, synced.']
  });

  var o = { mode: 'switch', cams: [{ v: 0, a: 0 }, { v: 1, a: 1 }], wide: -1, minShot: 2, sensitivity: 6, lead: 0.15, top: 0, bottom: 1, backup: true };
  var COLORS = ['#2f8cff', '#ff4d6a', '#2ad38b', '#ffb02e', '#a970ff'];
  var last = null;

  AK.registerTool({
    id: 'podcast', icon: '🎙', title: 'pc.title', desc: 'pc.desc', colors: ['#7b3fe4', '#c254ff'], badge: 'new',
    mount: function (el) {
      var body = h('div', { class: 'tool-body' });
      el.appendChild(ui.note(AK.t('pc.help')));
      el.appendChild(ui.section(AK.t('pc.mode'), [ui.chips([{ value: 'switch', label: AK.t('pc.switch') }, { value: 'stack', label: AK.t('pc.stack') }], o.mode, function (v) { o.mode = v; draw(); })]));
      el.appendChild(body);
      function draw() {
        body.innerHTML = '';
        if (o.mode === 'stack') {
          body.appendChild(ui.section(null, [h('div', { class: 'row' }, [
            ui.field(AK.t('pc.top'), ui.trackSelect('video', o.top, function (v) { o.top = v; })),
            ui.field(AK.t('pc.bottom'), ui.trackSelect('video', o.bottom, function (v) { o.bottom = v; }))
          ])]));
          body.appendChild(ui.button(AK.t('btn.apply'), function () {
            return AK.job(AK.t('st.placing'), function () { return AK.host('ak_stackLayout', { top: o.top, bottom: o.bottom }); })
              .then(function () { AK.toast(AK.t('st.done'), 'ok'); });
          }, 'primary block'));
          return;
        }
        var rows = o.cams.map(function (c, i) {
          return h('div', { class: 'row' }, [
            h('span', { style: { flex: '0 0 12px', height: '12px', borderRadius: '50%', background: COLORS[i], alignSelf: 'center' } }),
            ui.field(AK.t('pc.cam', { n: i + 1 }), ui.trackSelect('video', c.v, function (v) { c.v = v; })),
            ui.field(AK.t('pc.mic'), ui.trackSelect('audio', c.a, function (v) { c.a = v; })),
            o.cams.length > 2 ? h('button', { class: 'icon-btn', style: { flex: '0 0 30px' }, onclick: function () { o.cams.splice(i, 1); draw(); } }, '×') : null
          ]);
        });
        var strip = h('canvas', { class: 'timeline-strip', width: 800, height: 34 });
        var res = h('div', { class: 'hint' });
        body.appendChild(ui.section(AK.t('pc.cams'), rows.concat([
          o.cams.length < 4 ? ui.button(AK.t('pc.addCam'), function () { o.cams.push({ v: o.cams.length, a: o.cams.length }); draw(); }, 'small ghost') : null,
          ui.field(AK.t('pc.wide'), ui.trackSelect('video', o.wide, function (v) { o.wide = v; }, { allowNone: true, noneLabel: AK.t('pc.none') }))
        ])));
        body.appendChild(ui.section(null, [
          h('div', { class: 'row' }, [
            ui.field(AK.t('pc.minShot'), ui.slider(0.8, 6, 0.1, o.minShot, function (v) { o.minShot = v; recompute(); }, function (v) { return v.toFixed(1) + 's'; })),
            ui.field(AK.t('pc.sens'), ui.slider(2, 18, 1, o.sensitivity, function (v) { o.sensitivity = v; recompute(); }, function (v) { return v + ' dB'; }))
          ]),
          ui.field(AK.t('pc.lead'), ui.slider(0, 0.6, 0.05, o.lead, function (v) { o.lead = v; recompute(); }, function (v) { return v.toFixed(2) + 's'; })),
          ui.check(AK.t('ac.backup'), o.backup, function (v) { o.backup = v; }),
          ui.button(AK.t('btn.analyze'), analyze, 'block'),
          strip, res
        ]));
        body.appendChild(ui.button(AK.t('btn.apply'), apply, 'primary block'));

        function analyze() {
          var win = 0.1;
          return AK.job(AK.t('st.analyzing'), function (b) {
            var levels = [], i = 0;
            function next() {
              if (i >= o.cams.length) return Promise.resolve();
              var cam = o.cams[i++];
              return AK.host('ak_trackClips', { kind: 'audio', track: cam.a }).then(function (r) {
                return AK.trackLoudness(r.clips, win, function (p) { b.set(null, (i - 1 + p) / o.cams.length); });
              }).then(function (db) { levels.push(db); return next(); });
            }
            return next().then(function () { last = { levels: levels, win: win }; recompute(); });
          });
        }
        function recompute() {
          if (!last) return;
          last.segs = A.speakers(last.levels, last.win, { minShot: o.minShot, sensitivity: o.sensitivity, wide: o.wide, lead: o.lead });
          var total = last.segs.length ? last.segs[last.segs.length - 1].end : 1;
          res.textContent = AK.t('pc.result', { n: Math.max(0, last.segs.length - 1), d: AK.fmtTime(total) });
          var ctx = strip.getContext('2d');
          ctx.clearRect(0, 0, strip.width, strip.height);
          last.segs.forEach(function (s) {
            ctx.fillStyle = s.cam === o.cams.length ? '#8d97b5' : COLORS[s.cam];
            ctx.fillRect(s.start / total * strip.width, 0, Math.max(1, (s.end - s.start) / total * strip.width), strip.height);
          });
        }
        function apply() {
          var p = last ? Promise.resolve() : analyze();
          return p.then(function () {
            var cams = o.cams.map(function (c) { return c.v; });
            if (o.wide >= 0) cams.push(o.wide);
            return AK.job(AK.t('ac.cutting'), function (b) {
              return (o.backup ? AK.host('ak_backupSequence') : Promise.resolve()).then(function () {
                b.set(AK.t('ac.cutting'));
                return AK.host('ak_multicamSwitch', { cams: cams, segments: last.segs });
              });
            }).then(function (r) { AK.toast(AK.t('st.done') + ' (' + r.cuts + ')', 'ok'); });
          });
        }
        if (last) recompute();
      }
      draw();
    }
  });
})();
