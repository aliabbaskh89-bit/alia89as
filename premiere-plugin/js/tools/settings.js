/* Tool: settings + health check */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui;

  AK.addStrings({
    'set.title': ['الإعدادات', 'Settings'],
    'set.desc': ['المفاتيح والأدوات والمسارات', 'Keys, tools and paths'],
    'set.status': ['حالة النظام', 'System status'],
    'set.keys': ['مفاتيح الخدمات (تنحفظ على جهازك فقط)', 'Service keys (stored on this computer only)'],
    'set.paths': ['المسارات', 'Paths'],
    'set.ffmpeg': ['مسار ffmpeg (اتركه فارغ للبحث التلقائي)', 'ffmpeg path (blank = auto)'],
    'set.ytdlp': ['مسار yt-dlp', 'yt-dlp path'],
    'set.media': ['مجلد الملفات الناتجة', 'Output folder'],
    'set.codec': ['كودك الفيديو الشفاف للقوالب', 'Alpha codec for templates'],
    'set.saved': ['انحفظت الإعدادات', 'Settings saved'],
    'set.found': ['موجود', 'Found'], 'set.missing': ['غير موجود', 'Missing'],
    'set.connected': ['متصل', 'Connected'], 'set.notConnected': ['غير متصل', 'Not connected'],
    'set.getKey': ['جيب مفتاح', 'Get key'],
    'set.stt': ['محرك الكابشن الافتراضي', 'Default caption engine']
  });

  AK.registerTool({
    id: 'settings', hidden: true, icon: '⚙', title: 'set.title', desc: 'set.desc', colors: ['#3a3f55', '#5a6078'],
    mount: function (el) {
      var s = AK.settings;
      var status = h('div', { class: 'status' });
      function line(label, ok, extra) {
        return h('div', {}, [h('span', {}, label), h('span', { class: ok ? 'ok-t' : 'err-t' }, (ok ? '● ' : '○ ') + (extra || ''))]);
      }
      function refresh() {
        status.innerHTML = '';
        var ff = AK.hasNode ? AK.ffmpegPath() : null, yt = AK.hasNode ? AK.ytdlpPath() : null;
        status.appendChild(line('Premiere', AK.inPremiere, AK.inPremiere ? AK.t('set.connected') : AK.t('set.notConnected')));
        status.appendChild(line('ffmpeg', !!ff, ff || AK.t('set.missing')));
        status.appendChild(line('yt-dlp', !!yt, yt || AK.t('set.missing')));
        if (AK.inPremiere) AK.host('ak_ping').then(function (r) { status.appendChild(line('Premiere version', true, r.version)); }).catch(function (e) { status.appendChild(line('Host script', false, e.message)); });
      }
      refresh();
      el.appendChild(ui.section(AK.t('set.status'), [status, ui.button(AK.t('btn.refresh'), refresh, 'small ghost')]));

      function key(label, prop, url) {
        return ui.field(label, h('div', { class: 'row' }, [
          ui.input(s[prop], function (v) { s[prop] = v.trim(); }, { type: 'password', dir: 'ltr', autocomplete: 'off' }),
          h('button', { class: 'btn small ghost', style: { flex: '0 0 auto' }, onclick: function () { AK.openUrl(url); } }, AK.t('set.getKey'))
        ]));
      }
      el.appendChild(ui.section(AK.t('set.keys'), [
        key('ElevenLabs (captions + SFX)', 'elevenlabsKey', 'https://elevenlabs.io/app/settings/api-keys'),
        key('OpenAI (Whisper captions)', 'openaiKey', 'https://platform.openai.com/api-keys'),
        key('Pexels (stock media)', 'pexelsKey', 'https://www.pexels.com/api/'),
        key('remove.bg', 'removebgKey', 'https://www.remove.bg/api'),
        ui.field(AK.t('set.stt'), ui.select([{ value: 'elevenlabs', label: 'ElevenLabs Scribe' }, { value: 'openai', label: 'OpenAI Whisper' }], s.sttProvider, function (v) { s.sttProvider = v; }))
      ]));
      el.appendChild(ui.section(AK.t('set.paths'), [
        ui.field(AK.t('set.ffmpeg'), ui.input(s.ffmpeg, function (v) { s.ffmpeg = v.trim(); }, { dir: 'ltr', placeholder: '/opt/homebrew/bin/ffmpeg' })),
        ui.field(AK.t('set.ytdlp'), ui.input(s.ytdlp, function (v) { s.ytdlp = v.trim(); }, { dir: 'ltr', placeholder: '/opt/homebrew/bin/yt-dlp' })),
        ui.field(AK.t('set.media'), ui.input(s.mediaDir, function (v) { s.mediaDir = v.trim(); }, { dir: 'ltr', placeholder: '~/Documents/Ali Kit Media' })),
        ui.field(AK.t('set.codec'), ui.select([{ value: 'prores', label: 'ProRes 4444 (best quality)' }, { value: 'qtrle', label: 'QuickTime Animation (smaller)' }], s.alphaCodec, function (v) { s.alphaCodec = v; })),
        AK.hasNode ? ui.button(AK.t('btn.openFolder'), function () { AK.openFolder(AK.mediaDir()); }, 'small ghost') : null
      ]));
      el.appendChild(ui.button(AK.t('btn.save'), function () { AK.saveSettings(); AK.toast(AK.t('set.saved'), 'ok'); refresh(); }, 'primary block'));
    }
  });
})();
