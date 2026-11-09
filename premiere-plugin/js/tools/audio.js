/* Tools: AI sound effects + audio cleanup */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui;

  AK.addStrings({
    'sfx.title': ['مؤثرات صوتية AI', 'AI Sound Effects'],
    'sfx.desc': ['اكتب المؤثر وينولد وينحط عند المؤشر', 'Describe a sound, it lands at the playhead'],
    'sfx.prompt': ['وصف المؤثر (بالإنكليزي)', 'Describe the sound (English)'],
    'sfx.len': ['المدة', 'Length'],
    'sfx.auto': ['تلقائي', 'Auto'],
    'sfx.gen': ['توليد وإضافة', 'Generate & add'],
    'sfx.working': ['جاري توليد الصوت...', 'Generating sound...'],
    'sfx.quick': ['سريع', 'Quick picks'],

    'au.title': ['تنظيف الصوت', 'Audio Cleanup'],
    'au.desc': ['إزالة ضوضاء + توحيد مستوى الصوت', 'Denoise + loudness normalise'],
    'au.preset': ['البريست', 'Preset'],
    'au.podcast': ['صوت بودكاست', 'Podcast voice'], 'au.denoise': ['إزالة ضوضاء فقط', 'Denoise only'],
    'au.reels': ['ريلز (عالي و واضح)', 'Reels (loud & clear)'], 'au.normalize': ['توحيد المستوى فقط', 'Normalise only'],
    'au.strength': ['قوة إزالة الضوضاء', 'Noise reduction'],
    'au.lufs': ['مستوى الصوت (LUFS)', 'Loudness (LUFS)'],
    'au.help': ['حدد كليب صوت (أو فيديو بيه صوت) بالتايملاين. راح ينعمل نسخة نظيفة على تراك جديد ويتعطل الأصلي.', 'Select audio clip(s). A cleaned copy goes on a new track and the original is disabled.'],
    'au.working': ['جاري تنظيف الصوت {i}/{n}...', 'Cleaning audio {i}/{n}...']
  });

  var QUICK = ['whoosh transition', 'cartoon pop', 'cinematic riser', 'mouse click', 'digital glitch', 'camera shutter', 'notification ding', 'deep boom impact', 'typing on keyboard', 'cash register'];
  var sfx = { prompt: '', len: 0 };

  AK.registerTool({
    id: 'sfx', icon: '♫', title: 'sfx.title', desc: 'sfx.desc', colors: ['#5e5ce6', '#bf5af2'], badge: 'ai',
    mount: function (el) {
      var ta = ui.textarea(sfx.prompt, function (v) { sfx.prompt = v; }, 3);
      el.appendChild(ui.section(null, [
        ui.field(AK.t('sfx.prompt'), ta),
        ui.field(AK.t('sfx.quick'), ui.chips(QUICK.map(function (q) { return { value: q, label: q }; }), '', function (v) { sfx.prompt = v; ta.value = v; })),
        ui.field(AK.t('sfx.len'), ui.slider(0, 22, 0.5, sfx.len, function (v) { sfx.len = v; }, function (v) { return v ? v + 's' : AK.t('sfx.auto'); })),
        ui.button(AK.t('sfx.gen'), gen, 'primary block')
      ]));
      function gen() {
        var path = require('path'), fs = require('fs');
        if (!AK.settings.elevenlabsKey) return Promise.reject(new Error(AK.t('err.key', { k: 'ElevenLabs' })));
        if (!sfx.prompt.trim()) return Promise.resolve();
        var body = { text: sfx.prompt.trim(), prompt_influence: 0.4 };
        if (sfx.len) body.duration_seconds = sfx.len;
        var json = Buffer.from(JSON.stringify(body));
        return AK.job(AK.t('sfx.working'), function (b) {
          return AK.http('POST', 'https://api.elevenlabs.io/v1/sound-generation', { 'xi-api-key': AK.settings.elevenlabsKey, 'Content-Type': 'application/json', 'Content-Length': json.length, Accept: 'audio/mpeg' }, json).then(function (r) {
            if (r.status >= 400) throw new Error('ElevenLabs ' + r.status + ': ' + r.body.toString('utf8').slice(0, 200));
            var out = path.join(AK.mediaDir('SFX'), AK.safeName(sfx.prompt).replace(/\s+/g, '-') + '-' + AK.stamp() + '.mp3');
            fs.writeFileSync(out, r.body);
            if (!AK.inPremiere) return out;
            b.set(AK.t('st.placing'));
            return AK.host('ak_place', { path: out, kind: 'audio', duration: sfx.len || 5, minTrack: 0 }).then(function () { return out; });
          });
        }).then(function () { AK.toast(AK.t('st.done'), 'ok'); });
      }
    }
  });

  /* ---------------- audio cleanup ---------------- */
  var au = { preset: 'podcast', nr: 12, lufs: -16 };
  function filterFor(o) {
    var dn = 'afftdn=nr=' + o.nr + ':nf=-45:tn=1';
    var hp = 'highpass=f=80';
    var norm = 'loudnorm=I=' + o.lufs + ':TP=-1.5:LRA=9';
    if (o.preset === 'denoise') return [hp, dn].join(',');
    if (o.preset === 'normalize') return norm;
    if (o.preset === 'reels') return [hp, dn, 'acompressor=threshold=-20dB:ratio=4:attack=5:release=80:makeup=4', 'equalizer=f=3500:t=q:w=1.2:g=3', 'loudnorm=I=-12:TP=-1:LRA=7'].join(',');
    return [hp, dn, 'acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=3', 'equalizer=f=200:t=q:w=1:g=1.5', 'equalizer=f=4000:t=q:w=1.4:g=2', norm].join(',');
  }
  AK.audioFilterFor = filterFor;
  AK.registerTool({
    id: 'audioclean', icon: '〰', title: 'au.title', desc: 'au.desc', colors: ['#30b0c7', '#34c759'],
    mount: function (el) {
      el.appendChild(ui.note(AK.t('au.help')));
      el.appendChild(ui.section(null, [
        ui.field(AK.t('au.preset'), ui.chips(['podcast', 'reels', 'denoise', 'normalize'].map(function (p) { return { value: p, label: AK.t('au.' + p) }; }), au.preset, function (v) { au.preset = v; })),
        ui.field(AK.t('au.strength'), ui.slider(3, 40, 1, au.nr, function (v) { au.nr = v; }, function (v) { return v + ' dB'; })),
        ui.field(AK.t('au.lufs'), ui.slider(-24, -9, 1, au.lufs, function (v) { au.lufs = v; }, function (v) { return v + ' LUFS'; })),
        ui.button(AK.t('btn.apply'), run, 'primary block')
      ]));
      function run() {
        var path = require('path');
        return AK.host('ak_selection').then(function (r) {
          var clips = r.clips.filter(function (c) { return c.kind === 'audio'; });
          if (!clips.length) clips = r.clips.filter(function (c) { return c.kind === 'video'; });
          if (!clips.length) throw new Error(AK.t('err.noSel'));
          var i = 0;
          return AK.job(AK.t('au.working', { i: 1, n: clips.length }), function (b) {
            function next() {
              if (i >= clips.length) return Promise.resolve();
              var c = clips[i++];
              b.set(AK.t('au.working', { i: i, n: clips.length }), (i - 1) / clips.length);
              var dur = (c.end - c.start) * (c.speed || 1);
              var out = path.join(AK.mediaDir('Clean Audio'), AK.safeName(c.name.replace(/\.[^.]+$/, '')) + '-clean-' + AK.stamp() + '.wav');
              return AK.ffmpeg(['-ss', String(c.inPoint), '-t', String(dur), '-i', c.path, '-vn', '-af', filterFor(au), '-ar', '48000', '-c:a', 'pcm_s24le', out])
                .then(function () { return AK.host('ak_place', { path: out, kind: 'audio', time: c.start, duration: dur, minTrack: c.kind === 'audio' ? c.track + 1 : 0 }); })
                .then(function () { if (c.kind === 'audio') return AK.host('ak_disableClip', { kind: 'audio', track: c.track, index: c.index }); })
                .then(next);
            }
            return next();
          }).then(function () { AK.toast(AK.t('st.done'), 'ok'); });
        });
      }
    }
  });
})();
