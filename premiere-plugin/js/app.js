/* Ali Kit — panel shell, navigation and shared UI controls */
(function (global) {
  'use strict';
  var AK = global.AK;
  var tools = AK.toolList = [];
  AK.registerTool = function (def) { tools.push(def); };

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(kids) ? kids : (kids === undefined ? [] : [kids])).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  AK.h = h;

  /* ---------------- shared controls ---------------- */
  var ui = AK.ui = {};
  ui.section = function (title, kids) { return h('div', { class: 'section' }, [title ? h('div', { class: 'section-title' }, title) : null].concat(kids)); };
  ui.row = function (kids) { return h('div', { class: 'row' }, kids); };
  ui.field = function (label, control, hint) {
    return h('label', { class: 'field' }, [h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null]);
  };
  ui.input = function (val, onInput, attrs) {
    var el = h('input', Object.assign({ class: 'input', value: val === undefined ? '' : val }, attrs || {}));
    el.addEventListener('input', function () { onInput && onInput(el.value); });
    return el;
  };
  ui.textarea = function (val, onInput, rows) {
    var el = h('textarea', { class: 'input', rows: rows || 2 });
    el.value = val || '';
    el.addEventListener('input', function () { onInput && onInput(el.value); });
    return el;
  };
  ui.color = function (val, onInput) {
    var el = h('input', { type: 'color', class: 'color', value: val });
    el.addEventListener('input', function () { onInput && onInput(el.value); });
    return el;
  };
  ui.select = function (options, val, onChange) {
    var el = h('select', { class: 'input' }, options.map(function (o) {
      return h('option', { value: o.value, selected: String(o.value) === String(val) }, o.label);
    }));
    el.addEventListener('change', function () { onChange && onChange(el.value); });
    return el;
  };
  ui.slider = function (min, max, step, val, onInput, fmt) {
    fmt = fmt || function (v) { return v; };
    var out = h('span', { class: 'slider-val' }, fmt(val));
    var el = h('input', { type: 'range', min: min, max: max, step: step, value: val, class: 'slider' });
    el.addEventListener('input', function () { out.textContent = fmt(+el.value); onInput && onInput(+el.value); });
    return h('div', { class: 'slider-wrap' }, [el, out]);
  };
  ui.check = function (label, val, onChange) {
    var el = h('input', { type: 'checkbox', checked: !!val });
    el.addEventListener('change', function () { onChange && onChange(el.checked); });
    return h('label', { class: 'check' }, [el, h('span', { class: 'switch' }), h('span', {}, label)]);
  };
  ui.button = function (label, onClick, kind) {
    var b = h('button', { class: 'btn ' + (kind || '') }, label);
    b.addEventListener('click', function (e) {
      if (b.disabled) return;
      var r = onClick && onClick(e);
      if (r && r.then) {
        b.disabled = true;
        r.catch(function (err) { AK.toast(err.message || String(err), 'error'); console.error(err); })
          .then(function () { b.disabled = false; });
      }
    });
    return b;
  };
  ui.chips = function (options, val, onChange) {
    var wrap = h('div', { class: 'chips' });
    options.forEach(function (o) {
      var c = h('button', { class: 'chip' + (String(o.value) === String(val) ? ' on' : '') }, o.label);
      c.addEventListener('click', function () {
        Array.prototype.forEach.call(wrap.children, function (x) { x.classList.remove('on'); });
        c.classList.add('on'); onChange && onChange(o.value);
      });
      wrap.appendChild(c);
    });
    return wrap;
  };
  ui.note = function (text, kind) { return h('div', { class: 'note ' + (kind || '') }, text); };

  /* video track / audio track selector, filled from the active sequence */
  ui.trackSelect = function (kind, val, onChange, opts) {
    opts = opts || {};
    var el = h('select', { class: 'input' });
    function fill(info) {
      el.innerHTML = '';
      var list = info ? info[kind] : [0, 1, 2, 3].map(function (i) { return { index: i }; });
      if (opts.allowNone) el.appendChild(h('option', { value: -1 }, opts.noneLabel || '—'));
      list.forEach(function (tr) {
        el.appendChild(h('option', { value: tr.index, selected: tr.index === val },
          (kind === 'video' ? 'V' : 'A') + (tr.index + 1) + (tr.clips !== undefined ? '  (' + tr.clips + ')' : '')));
      });
    }
    fill(null);
    AK.seqInfo().then(fill).catch(function () {});
    el.addEventListener('change', function () { onChange && onChange(+el.value); });
    return el;
  };

  /* font picker: built-in Graphik + system fonts */
  ui.fontSelect = function (val, onChange) {
    var opts = [{ value: '', label: 'Graphik Arabic' }];
    var sys = AK.systemFonts();
    sys.forEach(function (f, i) { opts.push({ value: 'sys:' + i, label: f.name }); });
    var el = ui.select(opts, val, function (v) {
      if (!v) return onChange('');
      var f = sys[+v.slice(4)];
      AK.loadFontFile(f).then(onChange).catch(function () { AK.toast('Font failed', 'error'); });
    });
    return el;
  };

  /* ---------------- toasts & busy overlay ---------------- */
  AK.toast = function (msg, kind) {
    var wrap = document.getElementById('toasts');
    var el = h('div', { class: 'toast ' + (kind || '') }, msg);
    wrap.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); }, kind === 'error' ? 6000 : 3000);
  };
  /* busy(label) -> {set(label, progress), done(), cancel} */
  AK.busy = function (label, cancellable) {
    var cancel = { cancelled: false };
    var bar = h('div', { class: 'busy-bar-fill' });
    var txt = h('div', { class: 'busy-text' }, label);
    var box = h('div', { class: 'busy' }, [h('div', { class: 'busy-card' }, [
      h('div', { class: 'spinner' }), txt, h('div', { class: 'busy-bar' }, bar),
      cancellable ? ui.button(AK.t('btn.cancel'), function () { cancel.cancelled = true; }, 'ghost small') : null
    ])]);
    document.body.appendChild(box);
    return {
      cancel: cancel,
      set: function (l, p) { if (l) txt.textContent = l; if (p !== undefined) bar.style.width = Math.round(p * 100) + '%'; },
      done: function () { box.remove(); }
    };
  };
  /* run an async job with the busy overlay */
  AK.job = function (label, fn, cancellable) {
    var b = AK.busy(label, cancellable);
    return Promise.resolve().then(function () { return fn(b); })
      .then(function (r) { b.done(); return r; }, function (e) { b.done(); throw e; });
  };

  /* ---------------- sequence info (cached briefly) ---------------- */
  var seqCache = null, seqTime = 0;
  AK.seqInfo = function (force) {
    if (!AK.inPremiere) return Promise.reject(new Error(AK.t('err.notPremiere')));
    if (!force && seqCache && Date.now() - seqTime < 1500) return Promise.resolve(seqCache);
    return AK.host('ak_seqInfo').then(function (s) { seqCache = s; seqTime = Date.now(); return s; })
      .catch(function (e) { if (/NO_SEQUENCE/.test(e.message)) throw new Error(AK.t('err.noSeq')); throw e; });
  };
  /* frame size to render at: active sequence, or a vertical 1080x1920 default outside Premiere */
  AK.frameSpec = function () {
    return AK.seqInfo().then(function (s) { return { width: s.width, height: s.height, fps: s.fps, playhead: s.playhead }; })
      .catch(function () { return { width: 1080, height: 1920, fps: 30, playhead: 0, offline: true }; });
  };

  /* render an overlay and drop it on the timeline at the playhead (or `time`) */
  AK.renderAndPlace = function (o) {
    return AK.frameSpec().then(function (fs) {
      var out = require('path').join(AK.mediaDir(o.folder || 'Renders'), AK.safeName(o.name) + '-' + AK.stamp() + (o.codec === 'h264' ? '.mp4' : '.mov'));
      return AK.job(AK.t('st.rendering', { p: 0 }), function (b) {
        return AK.renderVideo({
          width: fs.width, height: fs.height, fps: fs.fps, duration: o.duration, out: out, codec: o.codec, cancel: b.cancel,
          draw: o.draw, onProgress: function (p) { b.set(AK.t('st.rendering', { p: Math.round(p * 100) }), p); }
        }).then(function () {
          if (o.exportOnly || fs.offline) return { path: out, placed: false };
          b.set(AK.t('st.placing'));
          return AK.host('ak_place', { path: out, time: o.time, duration: o.duration, minTrack: o.minTrack || 1 })
            .then(function () { return { path: out, placed: true }; });
        });
      }, true);
    }).then(function (r) {
      AK.toast(r.placed ? AK.t('st.done') : AK.t('msg.exported', { p: r.path }), 'ok');
      return r;
    });
  };

  /* ---------------- navigation ---------------- */
  var main;
  AK.showHome = function () {
    main.innerHTML = '';
    main.className = 'home';
    var header = h('header', { class: 'top' }, [
      h('div', { class: 'brand' }, [h('span', { class: 'bolt' }, '⚡'), h('b', {}, AK.t('app.name'))]),
      h('div', { class: 'top-actions' }, [
        h('span', { class: 'pill-count' }, [h('i', { class: 'dot' }), AK.t('app.tools', { n: tools.filter(function (t) { return !t.hidden; }).length })]),
        langToggle(),
        h('button', { class: 'icon-btn', title: 'Settings', onclick: function () { AK.openTool('settings'); } }, '⚙')
      ])
    ]);
    main.appendChild(header);
    var grid = h('div', { class: 'grid' });
    tools.forEach(function (t) {
      if (t.hidden) return;
      var count = typeof t.count === 'function' ? t.count() : t.count;
      grid.appendChild(h('button', { class: 'tile' + (t.wide ? ' wide' : ''), style: { '--c1': t.colors[0], '--c2': t.colors[1] }, onclick: function () { AK.openTool(t.id); } }, [
        t.badge ? h('span', { class: 'badge' }, AK.t('badge.' + t.badge)) : null,
        h('span', { class: 'tile-icon' }, t.icon),
        h('span', { class: 'tile-text' }, [h('b', {}, AK.t(t.title)), h('small', {}, AK.t(t.desc))]),
        count ? h('span', { class: 'tile-count' }, String(count)) : null
      ]));
    });
    main.appendChild(grid);
    main.appendChild(h('footer', { class: 'foot' }, [
      h('span', {}, 'v0.1 · '), h('span', { id: 'conn' }, AK.inPremiere ? '● Premiere' : '○ ' + AK.t('err.notPremiere'))
    ]));
  };
  function langToggle() {
    var wrap = h('div', { class: 'lang' });
    ['ar', 'en'].forEach(function (l) {
      wrap.appendChild(h('button', { class: AK.lang() === l ? 'on' : '', onclick: function () {
        AK.settings.lang = l; AK.saveSettings(); applyDir(); AK.showHome();
      } }, l.toUpperCase()));
    });
    return wrap;
  }
  function applyDir() {
    document.documentElement.lang = AK.lang();
    document.documentElement.dir = AK.lang() === 'ar' ? 'rtl' : 'ltr';
  }
  var cleanup = null;
  AK.onLeave = function (fn) { cleanup = fn; };
  AK.openTool = function (id, arg) {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    var t = tools.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    main.innerHTML = '';
    main.className = 'tool';
    main.appendChild(h('header', { class: 'top tool-top' }, [
      h('button', { class: 'icon-btn back', onclick: function () { if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } AK.showHome(); } }, AK.lang() === 'ar' ? '→' : '←'),
      h('span', { class: 'tile-icon sm', style: { '--c1': t.colors[0], '--c2': t.colors[1] } }, t.icon),
      h('b', {}, AK.t(t.title))
    ]));
    var body = h('div', { class: 'tool-body' });
    main.appendChild(body);
    t.mount(body, arg);
    main.scrollTop = 0;
  };

  AK.boot = function () {
    AK.loadSettings();
    applyDir();
    main = document.getElementById('app');
    AK.showHome();
    if (AK.inPremiere) {
      /* load host script explicitly too (ScriptPath sometimes isn't evaluated on reload) */
      var p = AK.extensionPath() + '/jsx/host.jsx';
      global.__adobe_cep__.evalScript('$.evalFile(' + JSON.stringify(p) + ')', function () {});
    }
  };
})(window);
