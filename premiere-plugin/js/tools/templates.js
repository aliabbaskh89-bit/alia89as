/* Tool: template library (text styles, glass UI, infographics, overlay FX) */
(function () {
  'use strict';
  var AK = window.AK, h = AK.h, ui = AK.ui;

  AK.addStrings({
    'tpl.title': ['مكتبة القوالب', 'Template Library'],
    'tpl.desc': ['نصوص، زجاج، واجهات وعناصر متحركة', 'Text, glass, UI & animated elements'],
    'tpl.text.title': ['ستايل النص', 'Text Styles'], 'tpl.text.desc': ['عناوين متحركة جاهزة', 'Animated titles'],
    'tpl.glass.title': ['الزجاج والواجهات', 'Glass & UI'], 'tpl.glass.desc': ['أزرار، إشعارات، بطاقات', 'Buttons, notifications, cards'],
    'tpl.info.title': ['إنفوجرافيك وعناصر', 'Infographics'], 'tpl.info.desc': ['عدادات، أسهم، تحديد', 'Counters, arrows, callouts'],
    'tpl.fx.title': ['مؤثرات فوق الفيديو', 'Overlay FX'], 'tpl.fx.desc': ['فلاش، تسريب ضوئي، مسح', 'Flash, light leak, wipes'],
    'cat.all': ['الكل', 'All'], 'cat.text': ['نصوص', 'Text'], 'cat.glass': ['زجاج وواجهات', 'Glass & UI'], 'cat.info': ['عناصر', 'Elements'], 'cat.fx': ['مؤثرات', 'FX'],
    'tpl.hover': ['مرّر الماوس على أي قالب حتى يتحرك', 'Hover a template to play it']
  });

  function count(cat) { return function () { return AK.templates.filter(function (t) { return !cat || t.cat === cat; }).length; }; }

  AK.registerTool({ id: 'templates', icon: '◈', title: 'tpl.title', desc: 'tpl.desc', colors: ['#5b6cff', '#9b4dff'], count: count(), wide: true, badge: 'popular', mount: function (el) { gallery(el, 'all'); } });
  AK.registerTool({ id: 'tpl-text', icon: 'Aa', title: 'tpl.text.title', desc: 'tpl.text.desc', colors: ['#2f6bff', '#00b3ff'], count: count('text'), mount: function (el) { gallery(el, 'text'); } });
  AK.registerTool({ id: 'tpl-glass', icon: '◩', title: 'tpl.glass.title', desc: 'tpl.glass.desc', colors: ['#00a99d', '#1fd1a5'], count: count('glass'), mount: function (el) { gallery(el, 'glass'); } });
  AK.registerTool({ id: 'tpl-info', icon: '◔', title: 'tpl.info.title', desc: 'tpl.info.desc', colors: ['#ff7a1a', '#ffb02e'], count: count('info'), mount: function (el) { gallery(el, 'info'); } });
  AK.registerTool({ id: 'tpl-fx', icon: '✦', title: 'tpl.fx.title', desc: 'tpl.fx.desc', colors: ['#e0389b', '#ff6a88'], count: count('fx'), mount: function (el) { gallery(el, 'fx'); } });

  function gallery(el, cat) {
    var stops = [];
    AK.onLeave(function () { stops.forEach(function (s) { s(); }); });
    var grid = h('div', { class: 'tpl-grid' });
    function fill(c) {
      stops.forEach(function (s) { s(); }); stops = [];
      grid.innerHTML = '';
      AK.templates.filter(function (t) { return c === 'all' || t.cat === c; }).forEach(function (tpl) {
        var cv = h('canvas', { width: 270, height: 360 });
        var p = AK.templateDefaults(tpl);
        var stop = null;
        function still() {
          var ctx = cv.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0); AK.previewBg(ctx, 270, 360);
          tpl.draw(ctx, Math.min(tpl.dur * 0.55, tpl.dur - 0.5 > 0 ? tpl.dur - 0.5 : tpl.dur * 0.5), p, 270, 360);
        }
        var card = h('button', { class: 'tpl-card', onclick: function () { AK.openTool('tpl-edit', { tpl: tpl, back: cat }); } }, [cv, h('span', {}, AK.L(tpl.name))]);
        card.addEventListener('mouseenter', function () { if (!stop) { stop = AK.preview(cv, tpl.dur, function (ctx, t, W, H) { tpl.draw(ctx, t, p, W, H); }, { bg: AK.previewBg }); stops.push(stop); } });
        card.addEventListener('mouseleave', function () { if (stop) { stop(); stop = null; still(); } });
        grid.appendChild(card);
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(still);
      });
    }
    el.appendChild(ui.chips(AK.templateCats.map(function (c) { return { value: c.id, label: c.icon + '  ' + AK.t('cat.' + c.id) }; }), cat, fill));
    el.appendChild(ui.note(AK.t('tpl.hover')));
    el.appendChild(grid);
    fill(cat);
  }

  /* -------- editor -------- */
  AK.registerTool({
    id: 'tpl-edit', hidden: true, icon: '◈', title: 'tpl.title', desc: 'tpl.desc', colors: ['#5b6cff', '#9b4dff'],
    mount: function (el, arg) {
      var tpl = arg.tpl;
      var p = AK.templateDefaults(tpl);
      var spec = { width: 1080, height: 1920 };
      var cv = h('canvas', { class: 'preview' });
      function size() {
        var s = 360 / Math.max(spec.width, spec.height);
        cv.width = Math.round(spec.width * s * 1.5); cv.height = Math.round(spec.height * s * 1.5);
      }
      size();
      var stop = AK.preview(cv, p.dur, function (ctx, t, W, H) { tpl.draw(ctx, t, p, W, H); }, { bg: AK.previewBg });
      function restart() { stop(); stop = AK.preview(cv, p.dur, function (ctx, t, W, H) { tpl.draw(ctx, t, p, W, H); }, { bg: AK.previewBg }); }
      AK.onLeave(function () { stop(); });
      AK.frameSpec().then(function (fs) { spec = fs; size(); });

      el.appendChild(h('div', { class: 'section-title' }, AK.L(tpl.name)));
      el.appendChild(h('div', { class: 'preview-wrap' }, cv));

      var fields = tpl.fields.map(function (f) {
        var ctl;
        if (f.type === 'color') ctl = ui.color(p[f.key], function (v) { p[f.key] = v; });
        else if (f.type === 'number') ctl = ui.input(p[f.key], function (v) { p[f.key] = +v; }, { type: 'number' });
        else ctl = ui.input(p[f.key], function (v) { p[f.key] = v; });
        return ui.field(AK.t(f.label), ctl);
      });
      el.appendChild(ui.section(null, [h('div', { class: 'row' }, fields)]));

      var posRow = [];
      if (!tpl.fullframe) {
        posRow = [
          ui.field(AK.t('f.position'), ui.chips([
            { value: 0.2, label: AK.t('pos.top') }, { value: 0.5, label: AK.t('pos.center') }, { value: 0.78, label: AK.t('pos.bottom') }
          ], 0.5, function (v) { p.y = +v; })),
          h('div', { class: 'row' }, [
            ui.field('X', ui.slider(0, 1, 0.01, p.x, function (v) { p.x = v; }, function (v) { return Math.round(v * 100) + '%'; })),
            ui.field('Y', ui.slider(0, 1, 0.01, p.y, function (v) { p.y = v; }, function (v) { return Math.round(v * 100) + '%'; }))
          ]),
          ui.field(AK.t('f.scale'), ui.slider(0.3, 2.5, 0.05, p.scale, function (v) { p.scale = v; }, function (v) { return Math.round(v * 100) + '%'; })),
          ui.field(AK.t('f.font'), ui.fontSelect('', function (fam) { p.font = fam; }))
        ];
      }
      el.appendChild(ui.section(null, posRow.concat([
        ui.field(AK.t('f.duration'), ui.slider(0.5, 15, 0.1, p.dur, function (v) { p.dur = v; restart(); }, function (v) { return v.toFixed(1) + 's'; }))
      ])));

      function go(exportOnly) {
        var snap = Object.assign({}, p);
        return AK.renderAndPlace({
          name: tpl.id, duration: snap.dur, exportOnly: exportOnly, folder: 'Templates',
          draw: function (ctx, t, W, H) { tpl.draw(ctx, t, snap, W, H); }
        });
      }
      el.appendChild(h('div', { class: 'actions' }, [
        ui.button(AK.t('btn.add'), function () { return go(false); }, 'primary'),
        ui.button(AK.t('btn.export'), function () { return go(true); })
      ]));
    }
  });
})();
