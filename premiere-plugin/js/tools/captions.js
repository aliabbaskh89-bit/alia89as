/* Tool: automatic Arabic/English captions with animated styles */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui, D = AK.draw, E = AK.ease, M = AK.m;

  AK.addStrings({
    'cap.title': ['الكابشن التلقائي', 'Auto Captions'],
    'cap.desc': ['كابشن عربي بلهجتك + ستايلات متحركة', 'Arabic captions with animated styles'],
    'cap.source': ['مصدر الصوت', 'Audio source'],
    'cap.range': ['المدى', 'Range'],
    'cap.range.all': ['كل التراك', 'Whole track'],
    'cap.range.io': ['بين In و Out', 'In to Out'],
    'cap.lang': ['اللغة', 'Language'],
    'cap.dialect': ['اللهجة', 'Dialect'],
    'cap.provider': ['محرك التفريغ', 'Transcription engine'],
    'cap.transcribe': ['استخراج الكلام', 'Transcribe'],
    'cap.extract': ['تجهيز الصوت...', 'Preparing audio...'],
    'cap.uploading': ['جاري التفريغ بالذكاء الاصطناعي...', 'Transcribing with AI...'],
    'cap.words': ['{n} كلمة · {c} سطر', '{n} words · {c} captions'],
    'cap.edit': ['عدّل النص (التوقيت يتوزع تلقائياً)', 'Edit text (timing redistributes automatically)'],
    'cap.style': ['الستايل', 'Style'],
    'cap.size': ['حجم الخط', 'Font size'],
    'cap.maxWords': ['أعلى عدد كلمات بالسطر', 'Max words per caption'],
    'cap.lines': ['عدد الأسطر', 'Lines'],
    'cap.y': ['الارتفاع', 'Vertical position'],
    'cap.hl': ['لون الكلمة الحالية', 'Active word colour'],
    'cap.stroke': ['حدود للنص', 'Text outline'],
    'cap.shadow': ['ظل', 'Shadow'],
    'cap.srt': ['تصدير SRT', 'Export SRT'],
    'cap.load': ['فتح ملف SRT/JSON', 'Load SRT/JSON'],
    'cap.none': ['استخرج الكلام أولاً', 'Transcribe first'],
    'cap.weight': ['سماكة الخط', 'Font weight'],
    'st.pop': ['منبثق', 'Pop'], 'st.karaoke': ['كاريوكي', 'Karaoke'], 'st.word': ['كلمة كلمة', 'Word by word'],
    'st.box': ['صندوق ملون', 'Highlight box'], 'st.glass': ['زجاجي', 'Glass'], 'st.thinbold': ['رفيع/عريض', 'Thin/Bold'], 'st.minimal': ['بسيط', 'Minimal'],
    'd.msa': ['فصحى', 'MSA'], 'd.iq': ['عراقي', 'Iraqi'], 'd.gulf': ['خليجي', 'Gulf'], 'd.eg': ['مصري', 'Egyptian'], 'd.lev': ['شامي', 'Levantine'], 'd.ma': ['مغربي', 'Maghrebi']
  });

  var DIALECT_PROMPTS = {
    msa: 'نص باللغة العربية الفصحى.',
    iq: 'هذا كلام باللهجة العراقية، اكتبه كما يُنطق: شلونك، شكو ماكو، هواية، چا، گلي، ليش، هسه.',
    gulf: 'هذا كلام باللهجة الخليجية، اكتبه كما يُنطق: شلونك، وايد، زين، يبي، ليش، الحين.',
    eg: 'ده كلام باللهجة المصرية، اكتبه زي ما بيتنطق: إزيك، عايز، كده، دلوقتي، ليه.',
    lev: 'هاد حكي باللهجة الشامية، اكتبه متل ما بينلفظ: كيفك، شو، هلق، منيح، ليش.',
    ma: 'هذا كلام بالدارجة المغربية، اكتبه كما يُنطق.'
  };

  /* ---------------- transcription ---------------- */
  var C = AK.captions = {};
  C.transcribe = function (file, o) {
    var s = AK.settings;
    if (o.provider === 'openai') {
      if (!s.openaiKey) return Promise.reject(new Error(AK.t('err.key', { k: 'OpenAI' })));
      return AK.httpMultipart('https://api.openai.com/v1/audio/transcriptions', { Authorization: 'Bearer ' + s.openaiKey }, {
        file: { file: file, type: 'audio/mpeg' }, model: 'whisper-1', response_format: 'verbose_json',
        'timestamp_granularities[]': 'word', language: o.lang === 'auto' ? undefined : o.lang,
        prompt: o.lang === 'ar' ? DIALECT_PROMPTS[o.dialect] : undefined
      }).then(parseRes).then(function (d) {
        return (d.words || []).map(function (w) { return { text: w.word.trim(), start: w.start, end: w.end }; });
      });
    }
    if (!s.elevenlabsKey) return Promise.reject(new Error(AK.t('err.key', { k: 'ElevenLabs' })));
    return AK.httpMultipart('https://api.elevenlabs.io/v1/speech-to-text', { 'xi-api-key': s.elevenlabsKey }, {
      file: { file: file, type: 'audio/mpeg' }, model_id: s.scribeModel || 'scribe_v1',
      language_code: o.lang === 'auto' ? undefined : (o.lang === 'ar' ? 'ara' : 'eng'),
      timestamps_granularity: 'word', tag_audio_events: 'false'
    }).then(parseRes).then(function (d) {
      return (d.words || []).filter(function (w) { return w.type === 'word' || !w.type; })
        .map(function (w) { return { text: String(w.text).trim(), start: w.start, end: w.end }; })
        .filter(function (w) { return w.text; });
    });
  };
  function parseRes(r) {
    var txt = r.body.toString('utf8'), d;
    try { d = JSON.parse(txt); } catch (e) { throw new Error('HTTP ' + r.status + ': ' + txt.slice(0, 200)); }
    if (r.status >= 400) throw new Error('HTTP ' + r.status + ': ' + JSON.stringify(d.detail || d.error || d).slice(0, 300));
    return d;
  }

  /* group words into captions */
  C.chunk = function (words, maxWords, maxGap) {
    var out = [], cur = null;
    words.forEach(function (w) {
      var brk = !cur || cur.words.length >= maxWords || (w.start - cur.end) > (maxGap || 0.7) || /[.!?؟،,]$/.test(cur.words[cur.words.length - 1].text);
      if (brk) { cur = { start: w.start, end: w.end, words: [] }; out.push(cur); }
      cur.words.push({ text: w.text, start: w.start, end: w.end });
      cur.end = w.end;
    });
    /* hold each caption until the next one (max 0.6s extra) so it doesn't flash */
    for (var i = 0; i < out.length; i++) {
      var next = out[i + 1] ? out[i + 1].start : out[i].end + 0.6;
      out[i].end = Math.min(next, out[i].end + 0.6);
    }
    return out;
  };
  /* user edited a caption's text: redistribute timing by character length */
  C.retext = function (chunk, text) {
    var parts = text.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) { chunk.words = []; return; }
    var total = parts.reduce(function (a, p) { return a + p.length + 1; }, 0);
    var span = (chunk.words.length ? chunk.words[chunk.words.length - 1].end : chunk.end) - chunk.start;
    var t = chunk.start;
    chunk.words = parts.map(function (p) {
      var d = span * (p.length + 1) / total;
      var w = { text: p, start: t, end: t + d }; t += d; return w;
    });
  };
  C.srt = function (chunks) {
    function tc(s) {
      var ms = Math.round(s * 1000), hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60, mmm = ms % 1000;
      function p(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
      return p(hh, 2) + ':' + p(mm, 2) + ':' + p(ss, 2) + ',' + p(mmm, 3);
    }
    return chunks.filter(function (c) { return c.words.length; }).map(function (c, i) {
      return (i + 1) + '\n' + tc(c.start) + ' --> ' + tc(c.end) + '\n' + c.words.map(function (w) { return w.text; }).join(' ') + '\n';
    }).join('\n');
  };
  C.parseSrt = function (txt) {
    var out = [];
    txt.replace(/\r/g, '').split(/\n\n+/).forEach(function (block) {
      var m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\n([\s\S]*)/.exec(block);
      if (!m) return;
      var s = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000, e = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
      var c = { start: s, end: e, words: [{ text: 'x', start: s, end: e }] };
      C.retext(c, m[9].replace(/\n/g, ' '));
      out.push(c);
    });
    return out;
  };

  /* ---------------- rendering ---------------- */
  C.defaults = function () {
    return { style: 'pop', size: 78, weight: 900, color: '#ffffff', hl: '#ffd400', y: 0.72, maxWords: 4, lines: 1, stroke: true, shadow: true, font: '' };
  };
  function layout(ctx, chunk, st, W, u) {
    var size = st.size * u;
    var words = chunk.words;
    var rows = st.lines > 1 && words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))] : [words];
    var maxW = W * 0.86, gap = size * 0.28;
    var measured = rows.map(function (r) {
      return r.map(function (w, i) {
        var wt = st.style === 'thinbold' ? (i % 2 ? 300 : 900) : st.weight;
        return { w: w, weight: wt, width: D.measure(ctx, w.text, wt, size, st.font) };
      });
    });
    var widest = Math.max.apply(null, measured.map(function (r) { return r.reduce(function (a, x) { return a + x.width; }, 0) + gap * (r.length - 1); }));
    if (widest > maxW) {
      var k = maxW / widest; size *= k; gap *= k;
      measured.forEach(function (r) { r.forEach(function (x) { x.width *= k; }); });
    }
    var rtl = D.isRTL(words.map(function (w) { return w.text; }).join(' '));
    var lineH = size * 1.25;
    measured.forEach(function (r, ri) {
      var total = r.reduce(function (a, x) { return a + x.width; }, 0) + gap * (r.length - 1);
      var x = rtl ? W / 2 + total / 2 : W / 2 - total / 2;
      r.forEach(function (it) {
        it.cx = rtl ? x - it.width / 2 : x + it.width / 2;
        it.cy = (ri - (measured.length - 1) / 2) * lineH;
        x += (rtl ? -1 : 1) * (it.width + gap);
      });
    });
    return { rows: measured, size: size, lineH: lineH, rtl: rtl };
  }

  /* draw captions at sequence time t; returns a cache key when the frame is static */
  C.draw = function (ctx, t, chunks, st, W, H) {
    var ci = -1;
    for (var i = 0; i < chunks.length; i++) if (t >= chunks[i].start && t < chunks[i].end) { ci = i; break; }
    if (ci < 0 || !chunks[ci].words.length) return 'empty';
    var c = chunks[ci], u = Math.min(W, H) / 1080;
    var L = layout(ctx, c, st, W, u);
    var cy = st.y * H;
    var since = t - c.start;
    var intro = M.p(since, 0, 0.18);
    var wi = -1;
    c.words.forEach(function (w, k) { if (t >= w.start) wi = k; });
    var wSince = wi >= 0 ? t - c.words[wi].start : 1;
    var animating = intro < 1 || wSince < 0.15;

    ctx.save();
    ctx.translate(0, cy);
    if (st.style === 'glass' || st.style === 'minimal') {
      ctx.globalAlpha = E.outCubic(intro);
      ctx.translate(0, (1 - E.outCubic(intro)) * 30 * u);
    } else if (st.style !== 'word') {
      var k0 = M.lerp(0.82, 1, E.outBack(intro, 2));
      ctx.translate(W / 2, 0); ctx.scale(k0, k0); ctx.translate(-W / 2, 0);
    }
    if (st.style === 'glass') {
      var all = L.rows.reduce(function (a, r) { return a.concat(r); }, []);
      var minX = Math.min.apply(null, all.map(function (x) { return x.cx - x.width / 2; }));
      var maxX = Math.max.apply(null, all.map(function (x) { return x.cx + x.width / 2; }));
      var bh = L.lineH * L.rows.length + L.size * 0.5;
      D.glass(ctx, minX - L.size * 0.5, -bh / 2, maxX - minX + L.size, bh, L.size * 0.45, { base: 'rgba(10,12,24,0.45)' });
    }
    var flat = L.rows.reduce(function (a, r) { return a.concat(r); }, []);
    flat.forEach(function (it, k) {
      var active = k === wi, spoken = k <= wi;
      if (st.style === 'word' && !active) return;
      var color = st.color, alpha = 1, scale = 1;
      if (st.style === 'karaoke') { alpha = spoken ? 1 : 0.45; if (active) color = st.hl; }
      else if (st.style === 'pop' || st.style === 'thinbold') { if (active) { color = st.hl; scale = 1 + 0.14 * Math.sin(M.p(wSince, 0, 0.15) * Math.PI / 2) - 0.06 * M.p(wSince, 0.15, 0.3); } }
      else if (st.style === 'word') { scale = M.lerp(0.6, 1, E.outBack(M.p(wSince, 0, 0.15), 2.5)) * 1.35; color = st.hl; }
      else if (st.style === 'glass' || st.style === 'minimal') { alpha = spoken ? 1 : 0.6; }
      var x = st.style === 'word' ? W / 2 : it.cx, y = st.style === 'word' ? 0 : it.cy;
      ctx.save();
      ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.globalAlpha *= alpha;
      if (st.style === 'box' && active) {
        var pad = L.size * 0.18;
        ctx.fillStyle = st.hl;
        D.rr(ctx, -it.width / 2 - pad, -L.size * 0.62, it.width + pad * 2, L.size * 1.24, L.size * 0.22); ctx.fill();
      }
      if (st.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = L.size * 0.25; ctx.shadowOffsetY = L.size * 0.06; }
      var opts = { weight: it.weight, size: L.size, color: color, family: st.font };
      if (st.stroke && st.style !== 'glass') { opts.stroke = 'rgba(0,0,0,0.9)'; opts.strokeWidth = L.size * 0.14; }
      D.text(ctx, it.w.text, 0, 0, opts);
      ctx.restore();
    });
    ctx.restore();
    return animating ? null : ci + ':' + wi;
  };

  /* demo chunk for the style preview */
  function demoChunks(lang) {
    var txt = lang === 'en' ? 'this is how your captions look' : 'هيج راح يطلع الكابشن مالتك';
    var c = { start: 0, end: 2.6, words: [{ text: 'x', start: 0, end: 2.4 }] };
    C.retext(c, txt);
    return [c];
  }

  /* ---------------- UI ---------------- */
  var state = { words: null, chunks: null, st: C.defaults(), track: 0, range: 'all', lang: 'ar', dialect: 'iq', offset: 0 };

  AK.registerTool({
    id: 'captions', icon: 'CC', title: 'cap.title', desc: 'cap.desc', colors: ['#0f8bff', '#6a5cff'], badge: 'ai',
    mount: function (el) {
      var st = state.st;
      state.provider = state.provider || AK.settings.sttProvider || 'elevenlabs';

      /* source */
      el.appendChild(ui.section(AK.t('cap.source'), [
        h('div', { class: 'row' }, [
          ui.field(AK.t('f.track'), ui.trackSelect('audio', state.track, function (v) { state.track = v; })),
          ui.field(AK.t('cap.range'), ui.select([{ value: 'all', label: AK.t('cap.range.all') }, { value: 'io', label: AK.t('cap.range.io') }], state.range, function (v) { state.range = v; }))
        ]),
        h('div', { class: 'row' }, [
          ui.field(AK.t('cap.lang'), ui.select([{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }, { value: 'auto', label: 'Auto' }], state.lang, function (v) { state.lang = v; })),
          ui.field(AK.t('cap.dialect'), ui.select(['iq', 'gulf', 'eg', 'lev', 'ma', 'msa'].map(function (d) { return { value: d, label: AK.t('d.' + d) }; }), state.dialect, function (v) { state.dialect = v; })),
          ui.field(AK.t('cap.provider'), ui.select([{ value: 'elevenlabs', label: 'ElevenLabs Scribe' }, { value: 'openai', label: 'OpenAI Whisper' }], state.provider, function (v) { state.provider = v; }))
        ]),
        h('div', { class: 'actions' }, [
          ui.button(AK.t('cap.transcribe'), transcribe, 'primary'),
          ui.button(AK.t('cap.load'), loadFile)
        ])
      ]));

      /* transcript editor */
      var listWrap = h('div', { class: 'list' });
      var info = h('div', { class: 'hint' });
      el.appendChild(ui.section(AK.t('cap.edit'), [info, listWrap]));
      function renderList() {
        listWrap.innerHTML = '';
        if (!state.chunks) { info.textContent = AK.t('cap.none'); return; }
        info.textContent = AK.t('cap.words', { n: state.words ? state.words.length : '–', c: state.chunks.length });
        state.chunks.forEach(function (c) {
          listWrap.appendChild(h('div', { class: 'cap-row' }, [
            h('span', { class: 'tc' }, AK.fmtTime(c.start)),
            ui.input(c.words.map(function (w) { return w.text; }).join(' '), function (v) { C.retext(c, v); })
          ]));
        });
      }
      renderList();

      /* style */
      var cv = h('canvas', { class: 'preview', width: 360, height: 640 });
      var stop = AK.preview(cv, 2.6, function (ctx, t, W, H) { C.draw(ctx, t, demoChunks(state.lang), st, W, H); }, { bg: AK.previewBg, pause: 0.3 });
      AK.onLeave(function () { stop(); });
      AK.frameSpec().then(function (fs) { var s = 640 / Math.max(fs.width, fs.height); cv.width = Math.round(fs.width * s); cv.height = Math.round(fs.height * s); });

      el.appendChild(ui.section(AK.t('cap.style'), [
        ui.chips(['pop', 'karaoke', 'word', 'box', 'glass', 'thinbold', 'minimal'].map(function (s) { return { value: s, label: AK.t('st.' + s) }; }), st.style, function (v) { st.style = v; }),
        h('div', { class: 'preview-wrap' }, cv),
        h('div', { class: 'row' }, [
          ui.field(AK.t('f.font'), ui.fontSelect(st.fontKey || '', function (fam) { st.font = fam; })),
          ui.field(AK.t('cap.weight'), ui.select([300, 400, 500, 700, 900].map(function (w) { return { value: w, label: String(w) }; }), st.weight, function (v) { st.weight = +v; }))
        ]),
        h('div', { class: 'row' }, [
          ui.field(AK.t('cap.size'), ui.slider(30, 160, 1, st.size, function (v) { st.size = v; })),
          ui.field(AK.t('cap.y'), ui.slider(0.1, 0.92, 0.01, st.y, function (v) { st.y = v; }, function (v) { return Math.round(v * 100) + '%'; }))
        ]),
        h('div', { class: 'row' }, [
          ui.field(AK.t('cap.maxWords'), ui.slider(1, 10, 1, st.maxWords, function (v) { st.maxWords = v; rechunk(); })),
          ui.field(AK.t('cap.lines'), ui.chips([{ value: 1, label: '1' }, { value: 2, label: '2' }], st.lines, function (v) { st.lines = +v; }))
        ]),
        h('div', { class: 'row' }, [
          ui.field(AK.t('f.color'), ui.color(st.color, function (v) { st.color = v; })),
          ui.field(AK.t('cap.hl'), ui.color(st.hl, function (v) { st.hl = v; }))
        ]),
        h('div', { class: 'row' }, [
          ui.check(AK.t('cap.stroke'), st.stroke, function (v) { st.stroke = v; }),
          ui.check(AK.t('cap.shadow'), st.shadow, function (v) { st.shadow = v; })
        ])
      ]));

      el.appendChild(h('div', { class: 'actions' }, [
        ui.button(AK.t('btn.add'), function () { return place(false); }, 'primary'),
        ui.button(AK.t('cap.srt'), exportSrt)
      ]));

      function rechunk() { if (state.words) { state.chunks = C.chunk(state.words, st.maxWords); renderList(); } }

      function transcribe() {
        var path = require('path');
        return AK.seqInfo().then(function (seq) {
          return AK.host('ak_trackClips', { kind: 'audio', track: state.track }).then(function (r) {
            var clips = r.clips;
            if (!clips.length) throw new Error(AK.t('err.noClips'));
            var r0 = 0, r1 = 1e9;
            if (state.range === 'io' && seq.outPoint > seq.inPoint) { r0 = seq.inPoint; r1 = seq.outPoint; }
            clips = clips.map(function (c) {
              var s0 = Math.max(c.start, r0), s1 = Math.min(c.end, r1);
              if (s1 <= s0) return null;
              return Object.assign({}, c, { start: s0, end: s1, inPoint: c.inPoint + (s0 - c.start) * (c.speed || 1) });
            }).filter(Boolean);
            var audio = path.join(AK.tmpDir(), 'stt-' + AK.stamp() + '.mp3');
            return AK.job(AK.t('cap.extract'), function (b) {
              return AK.timelineAudio(clips, audio, { from: r0 === 0 ? 0 : r0 }).then(function () {
                b.set(AK.t('cap.uploading'), 0.5);
                return C.transcribe(audio, { provider: state.provider, lang: state.lang, dialect: state.dialect });
              });
            }).then(function (words) {
              var off = r0;
              words.forEach(function (w) { w.start += off; w.end += off; });
              state.words = words;
              rechunk();
              try { require('fs').writeFileSync(path.join(AK.mediaDir('Captions'), 'transcript-' + AK.stamp() + '.json'), JSON.stringify(words)); } catch (e) {}
              AK.toast(AK.t('st.done'), 'ok');
            });
          });
        });
      }

      function loadFile() {
        var inp = h('input', { type: 'file', accept: '.srt,.json' });
        inp.addEventListener('change', function () {
          var f = inp.files[0]; if (!f) return;
          var rd = new FileReader();
          rd.onload = function () {
            try {
              if (/\.json$/i.test(f.name)) { state.words = JSON.parse(rd.result); rechunk(); }
              else { state.words = null; state.chunks = C.parseSrt(rd.result); renderList(); }
            } catch (e) { AK.toast(e.message, 'error'); }
          };
          rd.readAsText(f);
        });
        inp.click();
      }

      function place(exportOnly) {
        if (!state.chunks || !state.chunks.length) return Promise.reject(new Error(AK.t('cap.none')));
        var chunks = JSON.parse(JSON.stringify(state.chunks)).filter(function (c) { return c.words.length; });
        var snap = Object.assign({}, st);
        var t0 = chunks[0].start, t1 = chunks[chunks.length - 1].end + 0.1;
        return AK.renderAndPlace({
          name: 'captions', duration: t1 - t0, time: t0, exportOnly: exportOnly, folder: 'Captions',
          codec: AK.settings.alphaCodec === 'prores' ? 'qtrle' : AK.settings.alphaCodec,
          draw: function (ctx, t, W, H) { return C.draw(ctx, t + t0, chunks, snap, W, H); }
        });
      }

      function exportSrt() {
        if (!state.chunks) return AK.toast(AK.t('cap.none'), 'error');
        var p = require('path').join(AK.mediaDir('Captions'), 'captions-' + AK.stamp() + '.srt');
        require('fs').writeFileSync(p, C.srt(state.chunks));
        AK.toast(AK.t('msg.exported', { p: p }), 'ok');
        if (AK.inPremiere) AK.host('ak_importOnly', { path: p }).catch(function () {});
      }
    }
  });
})();
