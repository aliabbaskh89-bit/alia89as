/* Tools: background removal, video downloader, stock media search */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui;

  AK.addStrings({
    'bg.title': ['إزالة الخلفية', 'Remove Background'],
    'bg.desc': ['للصور: من الكليب المحدد أو ملف', 'For images: selected clip or a file'],
    'bg.fromSel': ['من الصورة المحددة بالتايملاين', 'From the selected image on the timeline'],
    'bg.fromFile': ['اختيار صورة من الجهاز', 'Choose an image file'],
    'bg.working': ['جاري إزالة الخلفية...', 'Removing background...'],
    'bg.frame': ['من الفريم الحالي للفيديو', 'From the current video frame'],
    'bg.help': ['تستخدم خدمة remove.bg (تحتاج مفتاح من الإعدادات). الناتج PNG شفاف ينحط فوق الكليب.', 'Uses remove.bg (key in Settings). Result is a transparent PNG placed above the clip.'],

    'dl.title': ['التنزيل', 'Downloader'],
    'dl.desc': ['نزّل فيديو من رابط وحطه بالمشروع', 'Download a video from a link into the project'],
    'dl.url': ['الرابط', 'Link'],
    'dl.quality': ['الجودة', 'Quality'],
    'dl.best': ['أعلى جودة', 'Best'], 'dl.audio': ['صوت فقط', 'Audio only'],
    'dl.place': ['حطه بالتايملاين عند المؤشر', 'Place at the playhead'],
    'dl.go': ['تنزيل', 'Download'],
    'dl.progress': ['جاري التنزيل... {p}%', 'Downloading... {p}%'],
    'dl.noYt': ['ما لكيت yt-dlp. نصّبه بـ brew install yt-dlp', 'yt-dlp not found. Install it with: brew install yt-dlp'],
    'dl.rights': ['نزّل بس المحتوى اللي عندك حق تستخدمه.', 'Only download content you have the rights to use.'],

    'sk.title': ['بحث الوسائط', 'Stock Search'],
    'sk.desc': ['صور وفيديوهات مجانية من Pexels', 'Free photos & videos from Pexels'],
    'sk.q': ['شنو تدور؟ (بالإنكليزي أفضل)', 'Search (English works best)'],
    'sk.photos': ['صور', 'Photos'], 'sk.videos': ['فيديو', 'Videos'],
    'sk.orient': ['الاتجاه', 'Orientation'],
    'sk.portrait': ['عمودي', 'Portrait'], 'sk.landscape': ['أفقي', 'Landscape'], 'sk.any': ['الكل', 'Any'],
    'sk.search': ['بحث', 'Search'],
    'sk.click': ['اضغط على أي نتيجة حتى تنزل وتنضاف عند المؤشر', 'Click a result to download and place it at the playhead'],
    'sk.none': ['ماكو نتائج', 'No results']
  });

  /* ---------------- background removal ---------------- */
  function removeBg(file) {
    var path = require('path'), fs = require('fs');
    if (!AK.settings.removebgKey) return Promise.reject(new Error(AK.t('err.key', { k: 'remove.bg' })));
    return AK.httpMultipart('https://api.remove.bg/v1.0/removebg', { 'X-Api-Key': AK.settings.removebgKey }, {
      image_file: { file: file, type: /\.png$/i.test(file) ? 'image/png' : 'image/jpeg' }, size: 'auto', format: 'png'
    }).then(function (r) {
      if (r.status >= 400) throw new Error('remove.bg ' + r.status + ': ' + r.body.toString('utf8').slice(0, 200));
      var out = path.join(AK.mediaDir('Cutouts'), AK.safeName(path.basename(file).replace(/\.[^.]+$/, '')) + '-cutout-' + AK.stamp() + '.png');
      fs.writeFileSync(out, r.body);
      return out;
    });
  }
  AK.registerTool({
    id: 'bgremove', icon: '✂︎', title: 'bg.title', desc: 'bg.desc', colors: ['#c2185b', '#ff4fa3'], badge: 'ai',
    mount: function (el) {
      el.appendChild(ui.note(AK.t('bg.help')));
      el.appendChild(ui.button(AK.t('bg.fromSel'), function () {
        return AK.host('ak_selection').then(function (r) {
          var c = r.clips.filter(function (x) { return x.kind === 'video'; })[0];
          if (!c) throw new Error(AK.t('err.noSel'));
          return AK.job(AK.t('bg.working'), function () { return removeBg(c.path); })
            .then(function (out) { return AK.host('ak_place', { path: out, time: c.start, duration: c.end - c.start, minTrack: c.track + 1 }); })
            .then(function () { AK.toast(AK.t('st.done'), 'ok'); });
        });
      }, 'primary block'));
      el.appendChild(ui.button(AK.t('bg.frame'), function () {
        var path = require('path');
        return AK.host('ak_clipAtPlayhead', {}).then(function (r) {
          if (!r.clip) throw new Error(AK.t('mt.noClip'));
          var c = r.clip, src = c.inPoint + (r.clip.playhead - c.start) * (c.speed || 1);
          var frame = path.join(AK.tmpDir(), 'bgframe-' + Date.now() + '.png');
          return AK.job(AK.t('bg.working'), function () {
            return AK.ffmpeg(['-ss', String(src), '-i', c.path, '-frames:v', '1', frame]).then(function () { return removeBg(frame); });
          }).then(function (out) { return AK.host('ak_place', { path: out, time: r.clip.playhead, duration: 5, minTrack: c.track + 1 }); })
            .then(function () { AK.toast(AK.t('st.done'), 'ok'); });
        });
      }, 'block'));
      el.appendChild(ui.button(AK.t('bg.fromFile'), function () {
        return new Promise(function (resolve, reject) {
          var inp = h('input', { type: 'file', accept: 'image/*' });
          inp.addEventListener('change', function () {
            var f = inp.files[0]; if (!f || !f.path) return resolve();
            AK.job(AK.t('bg.working'), function () { return removeBg(f.path); }).then(function (out) {
              if (AK.inPremiere) return AK.host('ak_place', { path: out, duration: 5 });
              AK.toast(AK.t('msg.exported', { p: out }), 'ok');
            }).then(function () { AK.toast(AK.t('st.done'), 'ok'); resolve(); }, reject);
          });
          inp.click();
        });
      }, 'block'));
    }
  });

  /* ---------------- downloader ---------------- */
  var dl = { url: '', quality: 'best', place: true };
  AK.registerTool({
    id: 'download', icon: '⬇', title: 'dl.title', desc: 'dl.desc', colors: ['#00a86b', '#4cd964'],
    mount: function (el) {
      el.appendChild(ui.section(null, [
        ui.field(AK.t('dl.url'), ui.input(dl.url, function (v) { dl.url = v.trim(); }, { placeholder: 'https://', dir: 'ltr' })),
        ui.field(AK.t('dl.quality'), ui.chips([
          { value: 'best', label: AK.t('dl.best') }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: 'audio', label: AK.t('dl.audio') }
        ], dl.quality, function (v) { dl.quality = v; })),
        ui.check(AK.t('dl.place'), dl.place, function (v) { dl.place = v; }),
        ui.button(AK.t('dl.go'), go, 'primary block')
      ]));
      el.appendChild(ui.note(AK.t('dl.rights'), 'warn'));
      el.appendChild(ui.button(AK.t('btn.openFolder'), function () { AK.openFolder(AK.mediaDir('Downloads')); }, 'ghost block'));

      function go() {
        var path = require('path'), fs = require('fs');
        if (!/^https?:\/\//.test(dl.url)) return Promise.reject(new Error(AK.t('dl.url')));
        var y = AK.ytdlpPath();
        if (!y) return Promise.reject(new Error(AK.t('dl.noYt')));
        var dir = AK.mediaDir('Downloads');
        var fmt = dl.quality === 'audio' ? ['-x', '--audio-format', 'mp3']
          : dl.quality === 'best' ? ['-f', 'bv*[vcodec^=avc1]+ba[ext=m4a]/bv*+ba/b', '--merge-output-format', 'mp4']
          : ['-f', 'bv*[height<=' + dl.quality + '][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=' + dl.quality + ']+ba/b', '--merge-output-format', 'mp4'];
        var ff = AK.ffmpegPath();
        var args = fmt.concat(['--no-playlist', '--restrict-filenames', '--newline', '-o', path.join(dir, '%(title).60s-%(id)s.%(ext)s'), '--print', 'after_move:filepath'])
          .concat(ff ? ['--ffmpeg-location', path.dirname(ff)] : []).concat([dl.url]);
        return AK.job(AK.t('dl.progress', { p: 0 }), function (b) {
          var outPath = '';
          return AK.run(y, args, {
            name: 'yt-dlp',
            onStdout: function (d) {
              d.toString().split('\n').forEach(function (l) {
                var m = /\[download\]\s+([\d.]+)%/.exec(l);
                if (m) b.set(AK.t('dl.progress', { p: Math.round(+m[1]) }), +m[1] / 100);
                else if (l.trim() && fs.existsSync(l.trim())) outPath = l.trim();
              });
            }
          }).then(function () {
            if (!outPath) throw new Error('Download finished but file not found');
            if (!AK.inPremiere) return outPath;
            b.set(AK.t('st.placing'));
            return (dl.place ? AK.host('ak_place', { path: outPath, kind: dl.quality === 'audio' ? 'audio' : 'video', minTrack: 0, duration: 10 })
              : AK.host('ak_importOnly', { path: outPath })).then(function () { return outPath; });
          });
        }, true).then(function (p) { AK.toast(AK.t('msg.exported', { p: p }), 'ok'); });
      }
    }
  });

  /* ---------------- stock search (Pexels) ---------------- */
  var sk = { q: '', type: 'videos', orient: 'portrait', results: [] };
  AK.registerTool({
    id: 'stock', icon: '⌕', title: 'sk.title', desc: 'sk.desc', colors: ['#0a84ff', '#64d2ff'],
    mount: function (el) {
      var grid = h('div', { class: 'media-grid' });
      var inp = ui.input(sk.q, function (v) { sk.q = v; }, { placeholder: 'city night, coffee, ocean...' });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') search().catch(function (er) { AK.toast(er.message, 'error'); }); });
      el.appendChild(ui.section(null, [
        h('div', { class: 'row' }, [ui.field(AK.t('sk.q'), inp), ui.button(AK.t('sk.search'), search, 'primary')]),
        h('div', { class: 'row' }, [
          ui.chips([{ value: 'videos', label: AK.t('sk.videos') }, { value: 'photos', label: AK.t('sk.photos') }], sk.type, function (v) { sk.type = v; }),
          ui.chips([{ value: 'portrait', label: AK.t('sk.portrait') }, { value: 'landscape', label: AK.t('sk.landscape') }, { value: '', label: AK.t('sk.any') }], sk.orient, function (v) { sk.orient = v; })
        ])
      ]));
      el.appendChild(ui.note(AK.t('sk.click')));
      el.appendChild(grid);
      AK.frameSpec().then(function (fs) { if (!sk.q) sk.orient = fs.width >= fs.height ? 'landscape' : 'portrait'; });
      show();

      function search() {
        if (!AK.settings.pexelsKey) return Promise.reject(new Error(AK.t('err.key', { k: 'Pexels' })));
        if (!sk.q.trim()) return Promise.resolve();
        var base = sk.type === 'videos' ? 'https://api.pexels.com/videos/search' : 'https://api.pexels.com/v1/search';
        var url = base + '?per_page=30&query=' + encodeURIComponent(sk.q) + (sk.orient ? '&orientation=' + sk.orient : '');
        return AK.httpJSON('GET', url, { Authorization: AK.settings.pexelsKey }).then(function (d) {
          sk.results = (d.videos || d.photos || []).map(function (x) {
            if (x.video_files) {
              return { kind: 'video', id: x.id, thumb: x.image, dur: x.duration, files: x.video_files };
            }
            return { kind: 'photo', id: x.id, thumb: x.src.medium, full: x.src.original };
          });
          show();
        });
      }
      function show() {
        grid.innerHTML = '';
        if (!sk.results.length && sk.q) grid.appendChild(h('div', { class: 'hint' }, AK.t('sk.none')));
        sk.results.forEach(function (r) {
          grid.appendChild(h('button', { class: 'media-item', onclick: function () { pick(r).catch(function (e) { AK.toast(e.message, 'error'); }); } }, [
            h('img', { src: r.thumb, loading: 'lazy' }), r.dur ? h('span', {}, r.dur + 's') : null
          ]));
        });
      }
      function pick(r) {
        var path = require('path');
        return AK.frameSpec().then(function (fs) {
          var url, ext;
          if (r.kind === 'video') {
            var target = Math.max(fs.width, fs.height);
            var files = r.files.filter(function (f) { return f.link && /mp4/.test(f.file_type || 'mp4'); })
              .sort(function (a, b) { return Math.abs(Math.max(a.width, a.height) - target) - Math.abs(Math.max(b.width, b.height) - target); });
            url = files[0].link; ext = '.mp4';
          } else { url = r.full; ext = '.jpg'; }
          var out = path.join(AK.mediaDir('Stock'), 'pexels-' + r.id + ext);
          return AK.job(AK.t('dl.progress', { p: '…' }), function (b) {
            return AK.download(url, out).then(function () {
              if (!AK.inPremiere) return;
              b.set(AK.t('st.placing'));
              return AK.host('ak_place', { path: out, duration: r.dur || 5, minTrack: 0 });
            });
          }).then(function () { AK.toast(AK.t('st.done'), 'ok'); });
        });
      }
    }
  });
})();
