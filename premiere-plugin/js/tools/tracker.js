/* Tool: Motion Tracker — track a region, then pin an overlay to it with Position keyframes */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, A = AK.analysis;

  AK.addStrings({
    'mt.title': ['تتبع الحركة', 'Motion Tracker'],
    'mt.desc': ['ثبّت نص أو عنصر على شي متحرك', 'Pin text or graphics to moving objects'],
    'mt.step1': ['١. وقّف المؤشر على الكليب واضغط "خذ الفريم"', '1. Park the playhead on the clip, press "Grab frame"'],
    'mt.step2': ['٢. ارسم مربع حول الشي اللي تريد تتبعه', '2. Draw a box around what you want to track'],
    'mt.step3': ['٣. اضغط تتبع، بعدين حدد العنصر (النص/القالب) بالتايملاين واضغط ثبّت', '3. Track, then select your overlay on the timeline and press Pin'],
    'mt.grab': ['خذ الفريم', 'Grab frame'],
    'mt.track': ['تتبع', 'Track'],
    'mt.pin': ['ثبّت العنصر المحدد', 'Pin selected overlay'],
    'mt.len': ['مدة التتبع', 'Track length'],
    'mt.radius': ['سرعة الحركة المتوقعة', 'Expected motion speed'],
    'mt.tracking': ['جاري التتبع... {p}%', 'Tracking... {p}%'],
    'mt.decoding': ['جاري قراءة الفريمات...', 'Reading frames...'],
    'mt.noClip': ['ماكو كليب تحت المؤشر', 'No clip under the playhead'],
    'mt.noBox': ['ارسم مربع أولاً', 'Draw a box first'],
    'mt.done': ['تم تتبع {n} فريم', 'Tracked {n} frames']
  });

  AK.grabFrame = function (clip, seqTime, width) {
    var path = require('path'), fs = require('fs');
    var src = clip.inPoint + (seqTime - clip.start) * (clip.speed || 1);
    var out = path.join(AK.tmpDir(), 'frame-' + Date.now() + '.jpg');
    return AK.ffmpeg(['-ss', String(Math.max(0, src)), '-i', clip.path, '-frames:v', '1', '-vf', 'scale=' + (width || 960) + ':-2', '-q:v', '3', out]).then(function () {
      var data = 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64');
      return new Promise(function (res, rej) { var img = new Image(); img.onload = function () { res(img); }; img.onerror = rej; img.src = data; });
    });
  };

  var st = { clip: null, t0: 0, img: null, box: null, path: null, len: 3, radius: 1 };

  AK.registerTool({
    id: 'tracker', icon: '⌖', title: 'mt.title', desc: 'mt.desc', colors: ['#00b37a', '#30e3a0'], badge: 'pro',
    mount: function (el) {
      var cv = h('canvas', { width: 960, height: 540 });
      var stage = h('div', { class: 'stage' }, cv);
      el.appendChild(ui.note([AK.t('mt.step1'), AK.t('mt.step2'), AK.t('mt.step3')].join('\n')));
      el.lastChild.style.whiteSpace = 'pre-line';
      el.appendChild(ui.button(AK.t('mt.grab'), grab, 'block'));
      el.appendChild(stage);
      el.appendChild(ui.section(null, [h('div', { class: 'row' }, [
        ui.field(AK.t('mt.len'), ui.slider(0.5, 20, 0.5, st.len, function (v) { st.len = v; }, function (v) { return v + 's'; })),
        ui.field(AK.t('mt.radius'), ui.slider(0.5, 3, 0.25, st.radius, function (v) { st.radius = v; }, function (v) { return Math.round(v * 100) + '%'; }))
      ])]));
      el.appendChild(h('div', { class: 'actions' }, [ui.button(AK.t('mt.track'), track, 'primary'), ui.button(AK.t('mt.pin'), pin)]));

      function paint() {
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
        if (st.img) ctx.drawImage(st.img, 0, 0, cv.width, cv.height);
        if (st.path) {
          ctx.strokeStyle = '#30e3a0'; ctx.lineWidth = 3; ctx.beginPath();
          st.path.forEach(function (p, i) { var x = p.x * cv.width, y = p.y * cv.height; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke();
        }
        if (st.box) {
          ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
          ctx.strokeRect(st.box.x * cv.width, st.box.y * cv.height, st.box.w * cv.width, st.box.h * cv.height);
          ctx.setLineDash([]);
        }
      }
      paint();
      var down = null;
      function rel(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
      cv.addEventListener('pointerdown', function (e) { down = rel(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', function (e) {
        if (!down) return; var p = rel(e);
        st.box = { x: Math.min(down.x, p.x), y: Math.min(down.y, p.y), w: Math.abs(p.x - down.x), h: Math.abs(p.y - down.y) };
        st.path = null; paint();
      });
      cv.addEventListener('pointerup', function () { down = null; });

      function grab() {
        return AK.host('ak_clipAtPlayhead', {}).then(function (r) {
          if (!r.clip) throw new Error(AK.t('mt.noClip'));
          st.clip = r.clip; st.t0 = r.clip.playhead;
          return AK.grabFrame(r.clip, st.t0, 960);
        }).then(function (img) {
          st.img = img; st.box = null; st.path = null;
          cv.width = 960; cv.height = Math.round(960 * img.height / img.width); paint();
        });
      }
      function track() {
        if (!st.box || st.box.w < 0.01) return Promise.reject(new Error(AK.t('mt.noBox')));
        var c = st.clip;
        return AK.seqInfo().then(function (seq) {
          var dur = Math.min(st.len, c.end - st.t0);
          var TW = 480, TH = Math.round(TW * cv.height / cv.width / 2) * 2;
          var src = c.inPoint + (st.t0 - c.start) * (c.speed || 1);
          return AK.job(AK.t('mt.decoding'), function (b) {
            return AK.ffmpeg(['-ss', String(src), '-t', String(dur * (c.speed || 1)), '-i', c.path, '-vf', 'fps=' + seq.fps + ',scale=' + TW + ':' + TH + ',format=gray', '-f', 'rawvideo', '-']).then(function (r) {
              var buf = r.stdout, n = Math.floor(buf.length / (TW * TH)), frames = [];
              for (var i = 0; i < n; i++) frames.push(new Uint8Array(buf.buffer, buf.byteOffset + i * TW * TH, TW * TH));
              var box = { x: st.box.x * TW, y: st.box.y * TH, w: st.box.w * TW, h: st.box.h * TH };
              var radius = Math.round(Math.max(6, Math.min(box.w, box.h) * 0.35) * st.radius);
              /* run in slices so the UI can repaint */
              return new Promise(function (resolve) {
                setTimeout(function () {
                  var pts = A.track(frames, TW, TH, box, radius, function (p) { b.set(AK.t('mt.tracking', { p: Math.round(p * 100) }), p); });
                  resolve(pts.map(function (p, i) { return { t: st.t0 + i / seq.fps, x: p.x / TW, y: p.y / TH }; }));
                }, 30);
              });
            });
          });
        }).then(function (path) { st.path = path; paint(); AK.toast(AK.t('mt.done', { n: path.length }), 'ok'); });
      }
      function pin() {
        if (!st.path) return Promise.reject(new Error(AK.t('mt.noBox')));
        /* thin out to every 2nd frame to keep Premiere responsive */
        var keys = st.path.filter(function (_, i) { return i % 2 === 0 || i === st.path.length - 1; });
        return AK.host('ak_applyTrack', { keys: keys, source: { track: st.clip.track, index: st.clip.index } }).then(function () { AK.toast(AK.t('st.done'), 'ok'); });
      }
    }
  });
})();
