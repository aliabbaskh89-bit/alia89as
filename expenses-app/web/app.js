/* مصروفي — تطبيق إدارة المصروفات والواردات (يعمل محلياً على الهاتف) */
(function () {
  'use strict';

  // ---------- ثوابت ----------
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

  var DEFAULT_CATS = [
    { id: 'food', name: 'طعام', icon: '🍔', type: 'out' },
    { id: 'market', name: 'مسواك', icon: '🛒', type: 'out' },
    { id: 'transport', name: 'نقل', icon: '🚕', type: 'out' },
    { id: 'fuel', name: 'بنزين', icon: '⛽', type: 'out' },
    { id: 'bills', name: 'فواتير', icon: '💡', type: 'out' },
    { id: 'phone', name: 'رصيد ونت', icon: '📱', type: 'out' },
    { id: 'rent', name: 'إيجار', icon: '🏠', type: 'out' },
    { id: 'health', name: 'صحة', icon: '💊', type: 'out' },
    { id: 'shopping', name: 'تسوق', icon: '🛍️', type: 'out' },
    { id: 'fun', name: 'ترفيه', icon: '🎮', type: 'out' },
    { id: 'edu', name: 'تعليم', icon: '📚', type: 'out' },
    { id: 'other_out', name: 'أخرى', icon: '📦', type: 'out' },
    { id: 'salary', name: 'راتب', icon: '💼', type: 'in' },
    { id: 'work', name: 'شغل حر', icon: '💻', type: 'in' },
    { id: 'sales', name: 'مبيعات', icon: '🏷️', type: 'in' },
    { id: 'gift', name: 'هدية', icon: '🎁', type: 'in' },
    { id: 'debt_back', name: 'دين راجع', icon: '🤝', type: 'in' },
    { id: 'other_in', name: 'أخرى', icon: '💰', type: 'in' }
  ];

  var DEFAULT_SETTINGS = {
    name: '',
    currency: 'د.ع',
    budget: 0,
    weekStart: 6, // السبت
    notify: true,
    notifyTime: '23:00',
    cats: DEFAULT_CATS
  };

  // ---------- التخزين ----------
  var KEY_TX = 'masrufi.tx.v1';
  var KEY_SET = 'masrufi.settings.v1';

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast('تعذّر الحفظ!'); }
  }

  var txs = load(KEY_TX, []);
  var settings = Object.assign({}, DEFAULT_SETTINGS, load(KEY_SET, {}));
  if (!Array.isArray(settings.cats) || !settings.cats.length) settings.cats = DEFAULT_CATS.slice();

  function persist() {
    save(KEY_TX, txs);
    scheduleNotifications();
  }
  function persistSettings() {
    save(KEY_SET, settings);
    scheduleNotifications();
  }

  // ---------- أدوات التاريخ والأرقام ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  function startOfWeek(d) {
    var diff = (d.getDay() - settings.weekStart + 7) % 7;
    return addDays(d, -diff);
  }
  function dayTitle(d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function shortDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }

  function fmt(n) {
    var v = Math.round(n * 100) / 100;
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function money(n) { return fmt(n) + ' ' + settings.currency; }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
  function parseAmount(s) {
    if (!s) return NaN;
    var map = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
    s = String(s).replace(/[٠-٩]/g, function (c) { return map[c]; }).replace(/[,،\s]/g, '').replace('٫', '.');
    return parseFloat(s);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  function catOf(id) {
    for (var i = 0; i < settings.cats.length; i++) if (settings.cats[i].id === id) return settings.cats[i];
    return { id: id, name: 'غير مصنّف', icon: '❔', type: 'out' };
  }

  // ---------- الحسابات ----------
  function inRange(from, to) { // from/to: YYYY-MM-DD شامل
    return txs.filter(function (t) { return t.date >= from && t.date <= to; });
  }
  function totals(list) {
    var r = { in: 0, out: 0 };
    list.forEach(function (t) { r[t.type] += t.amount; });
    r.net = r.in - r.out;
    return r;
  }
  function byCat(list, type) {
    var m = {};
    list.forEach(function (t) { if (t.type === type) m[t.cat] = (m[t.cat] || 0) + t.amount; });
    return Object.keys(m).map(function (k) { return { cat: catOf(k), sum: m[k] }; })
      .sort(function (a, b) { return b.sum - a.sum; });
  }
  function sortTx(list) {
    return list.slice().sort(function (a, b) {
      return (b.date + b.time).localeCompare(a.date + a.time) || b.created - a.created;
    });
  }

  function periodRange(kind, anchor) {
    var a = parseYmd(anchor), from, to, title;
    if (kind === 'day') {
      from = to = a;
      title = dayTitle(a);
    } else if (kind === 'week') {
      from = startOfWeek(a); to = addDays(from, 6);
      title = shortDate(from) + ' — ' + shortDate(to);
    } else {
      from = new Date(a.getFullYear(), a.getMonth(), 1);
      to = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      title = MONTHS[a.getMonth()] + ' ' + a.getFullYear();
    }
    return { from: ymd(from), to: ymd(to), fromD: from, toD: to, title: title };
  }
  function shiftAnchor(kind, anchor, dir) {
    var a = parseYmd(anchor);
    if (kind === 'day') return ymd(addDays(a, dir));
    if (kind === 'week') return ymd(addDays(a, 7 * dir));
    return ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  // ---------- واجهة: عام ----------
  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  var currentTab = 'home';
  function showTab(name) {
    currentTab = name;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    window.scrollTo(0, 0);
    render();
  }

  function txItem(t, showDate) {
    var c = catOf(t.cat);
    var sub = t.note ? esc(t.note) : (showDate ? '' : t.time);
    var dateLine = showDate ? shortDate(parseYmd(t.date)) + ' • ' + t.time : (t.note ? t.time : '');
    return '<li class="tx" data-id="' + t.id + '">' +
      '<div class="tx-ic ' + t.type + '">' + esc(c.icon) + '</div>' +
      '<div class="tx-main"><div class="tx-cat">' + esc(c.name) + '</div><div class="tx-note">' + (sub || '&nbsp;') + '</div></div>' +
      '<div class="tx-amt ' + t.type + '">' + (t.type === 'in' ? '+' : '−') + fmt(t.amount) +
      (dateLine ? '<small>' + dateLine + '</small>' : '') + '</div></li>';
  }

  function render() {
    var now = new Date();
    $('todayLabel').textContent = dayTitle(now) + ' ' + now.getFullYear();
    $('hello').textContent = settings.name ? 'أهلاً ' + settings.name + ' 👋' : 'أهلاً 👋';
    $('amountCur').textContent = settings.currency;
    if (currentTab === 'home') renderHome();
    else if (currentTab === 'reports') renderReports();
    else if (currentTab === 'history') renderHistory();
    else if (currentTab === 'settings') renderSettings();
  }

  // ---------- الرئيسية ----------
  function renderHome() {
    var all = totals(txs);
    $('balance').textContent = money(all.net);
    var mr = periodRange('month', ymd(new Date()));
    var mt = totals(inRange(mr.from, mr.to));
    $('monthIn').textContent = fmt(mt.in);
    $('monthOut').textContent = fmt(mt.out);

    var bb = $('budgetBox');
    if (settings.budget > 0) {
      bb.hidden = false;
      var pct = Math.min(100, (mt.out / settings.budget) * 100);
      $('budgetBar').style.width = pct + '%';
      bb.classList.toggle('over', mt.out > settings.budget);
      var left = settings.budget - mt.out;
      $('budgetText').textContent = left >= 0 ? 'باقي ' + fmt(left) : 'متجاوز بـ ' + fmt(-left);
    } else bb.hidden = true;

    var today = ymd(new Date());
    var dt = totals(inRange(today, today));
    $('dayIn').textContent = fmt(dt.in);
    $('dayOut').textContent = fmt(dt.out);
    $('dayNet').textContent = signed(dt.net);

    var recent = sortTx(txs).slice(0, 6);
    $('recentList').innerHTML = recent.length ? recent.map(function (t) { return txItem(t, true); }).join('')
      : '<li class="empty">ما عندك عمليات بعد. اضغط ➕ حتى تسجّل أول مصروف أو وارد.</li>';
  }

  // ---------- التقارير ----------
  var rKind = 'week';
  var rAnchor = ymd(new Date());

  function renderReports() {
    document.querySelectorAll('#periodSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === rKind); });
    var r = periodRange(rKind, rAnchor);
    $('periodTitle').textContent = r.title;
    $('nextPeriod').disabled = r.to >= ymd(new Date());

    var list = inRange(r.from, r.to);
    var t = totals(list);
    $('rIn').textContent = fmt(t.in);
    $('rOut').textContent = fmt(t.out);
    $('rNet').textContent = signed(t.net);

    // مقارنة بالفترة السابقة
    var pr = periodRange(rKind, shiftAnchor(rKind, rAnchor, -1));
    var pt = totals(inRange(pr.from, pr.to));
    var todayStr = ymd(new Date());
    var lastDay = r.to > todayStr ? parseYmd(todayStr) : r.toD;
    var daysCount = Math.max(1, Math.round((lastDay - r.fromD) / 86400000) + 1);
    var outCount = list.filter(function (x) { return x.type === 'out'; }).length;
    var biggest = list.filter(function (x) { return x.type === 'out'; }).sort(function (a, b) { return b.amount - a.amount; })[0];
    var prevName = { day: 'أمس', week: 'الأسبوع الماضي', month: 'الشهر الماضي' }[rKind];
    var ins = [];
    ins.push(['عدد العمليات', list.length + ' (' + outCount + ' مصروف)']);
    if (rKind !== 'day') ins.push(['معدل الصرف اليومي', money(t.out / daysCount)]);
    if (biggest) ins.push(['أكبر مصروف', fmt(biggest.amount) + ' — ' + catOf(biggest.cat).name + (biggest.note ? ' (' + biggest.note + ')' : '')]);
    if (pt.out > 0) {
      var ch = ((t.out - pt.out) / pt.out) * 100;
      ins.push(['المصروف مقارنة بـ' + prevName,
        '<b class="' + (ch > 0 ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(0) + '%</b> (' + fmt(pt.out) + ')']);
    }
    if (t.in > 0) ins.push(['نسبة الادخار', '<b class="' + (t.net >= 0 ? 'down' : 'up') + '">' + ((t.net / t.in) * 100).toFixed(0) + '%</b>']);
    $('insights').innerHTML = ins.map(function (p) {
      return '<div><span>' + esc(p[0]) + '</span><b>' + (p[1].indexOf('<b') === 0 ? p[1] : esc(p[1])) + '</b></div>';
    }).join('');

    renderChart(r, list);
    renderBreak('catBreak', byCat(list, 'out'), t.out, 'out', 'ما صرفت شي بهذي الفترة 👏');
    renderBreak('incBreak', byCat(list, 'in'), t.in, 'in', 'ماكو وارد مسجّل بهذي الفترة');

    var sorted = sortTx(list);
    var shown = sorted.slice(0, 40);
    $('periodList').innerHTML = sorted.length ? shown.map(function (x) { return txItem(x, rKind !== 'day'); }).join('') +
      (sorted.length > shown.length ? '<li class="empty">+ ' + (sorted.length - shown.length) + ' عملية أخرى — شوفها كلها بالسجل</li>' : '')
      : '<li class="empty">ماكو عمليات</li>';
  }

  function renderChart(r, list) {
    var card = $('chartCard');
    if (rKind === 'day') { card.hidden = true; return; }
    card.hidden = false;
    $('chartTitle').textContent = 'المصروف حسب الأيام';
    var days = [], d = r.fromD;
    while (ymd(d) <= r.to) { days.push(ymd(d)); d = addDays(d, 1); }
    var sums = {};
    list.forEach(function (x) { if (x.type === 'out') sums[x.date] = (sums[x.date] || 0) + x.amount; });
    var max = 0;
    days.forEach(function (k) { max = Math.max(max, sums[k] || 0); });
    var today = ymd(new Date());
    var dense = days.length > 10;
    $('chart').className = 'chart' + (dense ? ' dense' : '');
    $('chart').innerHTML = days.map(function (k) {
      var v = sums[k] || 0, dd = parseYmd(k);
      var lbl = dense ? ((dd.getDate() % 5 === 1 || k === today) ? dd.getDate() : '&nbsp;') : DAYS_SHORT[dd.getDay()];
      return '<div class="col' + (k === today ? ' today' : '') + (max && v === max ? ' max' : '') + '" title="' + k + ': ' + fmt(v) + '">' +
        (!dense && v ? '<div class="val">' + fmtShort(v) + '</div>' : '') +
        '<div class="bars"><div class="b out" style="height:' + (max ? (v / max) * 100 : 0) + '%"></div></div>' +
        '<div class="lbl">' + lbl + '</div></div>';
    }).join('');
  }
  function fmtShort(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return fmt(n);
  }

  function renderBreak(elId, rows, total, cls, emptyMsg) {
    $(elId).innerHTML = rows.length ? rows.map(function (r) {
      var pct = total ? (r.sum / total) * 100 : 0;
      return '<div class="brk ' + cls + '"><div class="brk-head"><span>' + esc(r.cat.icon) + ' ' + esc(r.cat.name) + '</span>' +
        '<span>' + fmt(r.sum) + ' • ' + pct.toFixed(0) + '%</span></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('') : '<div class="empty">' + emptyMsg + '</div>';
  }

  function reportText(kind, anchor) {
    var r = periodRange(kind, anchor);
    var list = inRange(r.from, r.to);
    var t = totals(list);
    var name = { day: 'التقرير اليومي', week: 'التقرير الأسبوعي', month: 'التقرير الشهري' }[kind];
    var lines = ['📊 ' + name + ' — ' + r.title, '',
      '🟢 الوارد: ' + money(t.in),
      '🔴 المصروف: ' + money(t.out),
      '⚖️ الصافي: ' + signed(t.net) + ' ' + settings.currency];
    var cats = byCat(list, 'out');
    if (cats.length) {
      lines.push('', 'أين ذهبت فلوسك:');
      cats.forEach(function (c) { lines.push('• ' + c.cat.icon + ' ' + c.cat.name + ': ' + fmt(c.sum)); });
    }
    return lines.join('\n');
  }

  // ---------- السجل ----------
  function renderHistory() {
    var q = $('search').value.trim().toLowerCase();
    var ft = $('filterType').value;
    var list = sortTx(txs).filter(function (t) {
      if (ft !== 'all' && t.type !== ft) return false;
      if (!q) return true;
      var c = catOf(t.cat);
      return (t.note || '').toLowerCase().indexOf(q) >= 0 || c.name.toLowerCase().indexOf(q) >= 0 || String(t.amount).indexOf(q) >= 0;
    });
    if (!list.length) { $('historyGroups').innerHTML = '<div class="card empty">ماكو نتائج</div>'; return; }
    var groups = {}, order = [];
    list.forEach(function (t) {
      if (!groups[t.date]) { groups[t.date] = []; order.push(t.date); }
      groups[t.date].push(t);
    });
    $('historyGroups').innerHTML = order.slice(0, 120).map(function (d) {
      var tt = totals(groups[d]);
      return '<div class="day-group"><h4><span>' + dayTitle(parseYmd(d)) + '</span><span>' +
        (tt.in ? '<span class="down">+' + fmt(tt.in) + '</span> ' : '') + (tt.out ? '<span class="up">−' + fmt(tt.out) + '</span>' : '') +
        '</span></h4><div class="card"><ul class="tx-list">' + groups[d].map(function (t) { return txItem(t, false); }).join('') + '</ul></div></div>';
    }).join('');
  }

  // ---------- الإعدادات ----------
  function renderSettings() {
    $('sName').value = settings.name;
    $('sCurrency').value = settings.currency;
    $('sBudget').value = settings.budget || '';
    $('sWeekStart').value = String(settings.weekStart);
    $('sNotify').checked = settings.notify;
    $('sTime').value = settings.notifyTime;
    $('catChips').innerHTML = settings.cats.map(function (c) {
      return '<span class="chip ' + c.type + '">' + esc(c.icon) + ' ' + esc(c.name) +
        '<button data-del-cat="' + esc(c.id) + '" aria-label="حذف">×</button></span>';
    }).join('');
    updateNotifyStatus();
  }

  // ---------- نافذة الإضافة ----------
  var editing = null;
  var formType = 'out';
  var formCat = null;

  function openSheet(tx) {
    editing = tx || null;
    var now = new Date();
    formType = tx ? tx.type : 'out';
    formCat = tx ? tx.cat : null;
    $('amount').value = tx ? fmt(tx.amount) : '';
    $('note').value = tx ? (tx.note || '') : '';
    $('txDate').value = tx ? tx.date : ymd(now);
    $('txTime').value = tx ? tx.time : pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('deleteTx').hidden = !tx;
    renderSheet();
    $('sheetBackdrop').hidden = false;
    if (!tx) setTimeout(function () { $('amount').focus(); }, 150);
  }
  function closeSheet() { $('sheetBackdrop').hidden = true; editing = null; }

  function renderSheet() {
    document.querySelectorAll('#typeSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === formType); });
    var cats = settings.cats.filter(function (c) { return c.type === formType; });
    if (!formCat || !cats.some(function (c) { return c.id === formCat; })) formCat = cats.length ? cats[0].id : null;
    $('catGrid').innerHTML = cats.map(function (c) {
      return '<button type="button" data-cat="' + esc(c.id) + '" class="' + (c.id === formCat ? 'on' : '') + '"><span>' + esc(c.icon) + '</span>' + esc(c.name) + '</button>';
    }).join('');
    var q = formType === 'out' ? [1000, 2000, 5000, 10000, 25000, 50000] : [25000, 50000, 100000, 250000, 500000, 1000000];
    $('quickAmounts').innerHTML = q.map(function (v) { return '<button type="button" data-q="' + v + '">' + fmt(v) + '</button>'; }).join('');
  }

  function submitTx(e) {
    e.preventDefault();
    var amount = parseAmount($('amount').value);
    if (!(amount > 0)) { toast('اكتب مبلغ صحيح'); $('amount').focus(); return; }
    if (!formCat) { toast('اختار فئة'); return; }
    var data = {
      type: formType, amount: amount, cat: formCat,
      note: $('note').value.trim(), date: $('txDate').value, time: $('txTime').value || '12:00'
    };
    if (editing) {
      Object.assign(editing, data);
      toast('تم التعديل ✓');
    } else {
      data.id = uid(); data.created = Date.now();
      txs.push(data);
      toast(formType === 'out' ? 'تم تسجيل المصروف ✓' : 'تم تسجيل الوارد ✓');
    }
    persist();
    closeSheet();
    render();
  }

  // ---------- التنبيهات ----------
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  function plugin(name) {
    if (!Cap) return null;
    return (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin ? Cap.registerPlugin(name) : null);
  }
  var LN = isNative ? plugin('LocalNotifications') : null;
  var CHANNEL = 'daily-report';
  var lastNotifyState = '';

  function notifyBody(dateStr) {
    var d = parseYmd(dateStr);
    var t = totals(inRange(dateStr, dateStr));
    var lines = [];
    if (t.in === 0 && t.out === 0) {
      lines.push('ما سجّلت أي عملية اليوم. صرفت شي؟ سجّله هسه حتى يبقى حسابك مضبوط ✍️');
    } else {
      lines.push('🟢 الوارد: ' + money(t.in));
      lines.push('🔴 المصروف: ' + money(t.out));
      lines.push('⚖️ الصافي: ' + signed(t.net));
      var top = byCat(inRange(dateStr, dateStr), 'out')[0];
      if (top) lines.push('أكثر صرف على: ' + top.cat.icon + ' ' + top.cat.name + ' (' + fmt(top.sum) + ')');
    }
    // نهاية الأسبوع
    if (ymd(addDays(startOfWeek(d), 6)) === dateStr) {
      var w = periodRange('week', dateStr), wt = totals(inRange(w.from, w.to));
      lines.push('', '📅 الأسبوع: وارد ' + fmt(wt.in) + ' • مصروف ' + fmt(wt.out) + ' • صافي ' + signed(wt.net));
    }
    // نهاية الشهر
    if (addDays(d, 1).getDate() === 1) {
      var m = periodRange('month', dateStr), mt = totals(inRange(m.from, m.to));
      lines.push('🗓️ الشهر: وارد ' + fmt(mt.in) + ' • مصروف ' + fmt(mt.out) + ' • صافي ' + signed(mt.net));
    }
    return lines.join('\n');
  }

  function futureBody(d) {
    var extra = '';
    if (ymd(addDays(startOfWeek(d), 6)) === ymd(d)) extra = ' + ملخص الأسبوع';
    if (addDays(d, 1).getDate() === 1) extra += ' + ملخص الشهر';
    return 'اضغط حتى تشوف تقرير اليوم' + extra + ' 📊';
  }

  async function scheduleNotifications() {
    if (!isNative || !LN) { scheduleWebFallback(); return; }
    try {
      var pending = await LN.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(function (n) { return { id: n.id }; }) });
      }
      if (!settings.notify) { lastNotifyState = 'off'; updateNotifyStatus(); return; }

      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { lastNotifyState = 'denied'; updateNotifyStatus(); return; }

      var hm = settings.notifyTime.split(':');
      var now = new Date(), list = [];
      for (var i = 0; i < 30; i++) {
        var day = addDays(now, i);
        var at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), +hm[0], +hm[1], 0);
        if (at <= now) continue;
        var ds = ymd(day);
        var isFirst = list.length === 0 && i === 0;
        var body = isFirst ? notifyBody(ds) : futureBody(day);
        list.push({
          id: +ds.replace(/-/g, ''),
          title: '📊 تقريرك اليومي — ' + dayTitle(day),
          body: body.split('\n')[0] + (body.indexOf('\n') > 0 ? ' …' : ''),
          largeBody: body,
          channelId: CHANNEL,
          schedule: { at: at, allowWhileIdle: true },
          extra: { date: ds }
        });
      }
      if (list.length) await LN.schedule({ notifications: list });
      lastNotifyState = 'ok';
    } catch (err) {
      console.error(err);
      lastNotifyState = 'error';
    }
    updateNotifyStatus();
  }

  async function setupNative() {
    if (!isNative || !LN) return;
    try {
      if (LN.createChannel) {
        await LN.createChannel({ id: CHANNEL, name: 'التقرير اليومي', description: 'ملخص مصروفاتك ووارداتك نهاية كل يوم', importance: 4, visibility: 1, vibration: true });
      }
    } catch (e) { /* iOS لا يدعم القنوات */ }
    try {
      LN.addListener('localNotificationActionPerformed', function (ev) {
        var d = ev && ev.notification && ev.notification.extra && ev.notification.extra.date;
        rKind = 'day'; rAnchor = d || ymd(new Date());
        showTab('reports');
      });
    } catch (e) { }
    try {
      if (LN.checkExactNotificationSetting) {
        var ex = await LN.checkExactNotificationSetting();
        $('exactAlarm').hidden = ex.exact_alarm === 'granted';
      }
    } catch (e) { }
  }

  // ---------- إشعارات نسخة الويب (آيفون/المتصفح) عبر Web Push من السيرفر ----------
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var pushSupported = !isNative && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var API = 'api/';

  // نسخة من البيانات بـ IndexedDB حتى الـ Service Worker يحسب التقرير وقت الإشعار
  function idbMirror() {
    if (isNative || !('indexedDB' in window)) return;
    try {
      var req = indexedDB.open('masrufi', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () {
        try {
          var tx = req.result.transaction('kv', 'readwrite');
          var st = tx.objectStore('kv');
          st.put(txs, 'txs');
          st.put({ currency: settings.currency, cats: settings.cats, weekStart: settings.weekStart }, 'settings');
          tx.oncomplete = function () { req.result.close(); };
        } catch (e) { }
      };
    } catch (e) { }
  }

  function b64ToUint8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function keyToB64(buf) {
    if (!buf) return '';
    var s = String.fromCharCode.apply(null, new Uint8Array(buf));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function postJSON(url, data) {
    return fetch(API + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  // يتأكد إن الاشتراك موجود ومحدّث بالسيرفر (askPermission = true فقط عند ضغطة المستخدم)
  async function syncPush(askPermission) {
    if (!pushSupported) return null;
    if (isIOS && !isStandalone) { lastNotifyState = 'ios-install'; updateNotifyStatus(); return null; }
    try {
      var perm = Notification.permission;
      if (perm === 'default' && askPermission) perm = await Notification.requestPermission();
      if (perm !== 'granted') { lastNotifyState = perm === 'denied' ? 'web-denied' : 'web-noperm'; updateNotifyStatus(); return null; }
      var reg = await navigator.serviceWorker.ready;
      var keyRes = await fetch(API + 'vapid').then(function (r) { if (!r.ok) throw new Error('no-server'); return r.json(); });
      var appKey = keyRes.publicKey;
      var sub = await reg.pushManager.getSubscription();
      if (sub && sub.options && sub.options.applicationServerKey && keyToB64(sub.options.applicationServerKey) !== appKey) {
        await sub.unsubscribe(); sub = null; // مفتاح السيرفر تغيّر
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(appKey) });
      var tz = 'Asia/Baghdad';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { }
      await postJSON('subscribe', { subscription: sub.toJSON(), time: settings.notifyTime, tz: tz, enabled: !!settings.notify });
      lastNotifyState = settings.notify ? 'ok' : 'off';
      updateNotifyStatus();
      return sub;
    } catch (e) {
      console.error(e);
      lastNotifyState = 'web-error'; updateNotifyStatus();
      return null;
    }
  }

  var syncedKey = '';
  function scheduleWebFallback() {
    idbMirror();
    if (isIOS && !isStandalone) { lastNotifyState = 'ios-install'; updateNotifyStatus(); return; }
    if (!pushSupported) { lastNotifyState = 'web-unsupported'; updateNotifyStatus(); return; }
    var k = settings.notifyTime + '|' + settings.notify;
    if (k === syncedKey) return; // ماكو تغيير بالإعدادات، الاشتراك محدّث
    syncPush(false).then(function (sub) { if (sub) syncedKey = k; });
  }

  function updateNotifyStatus() {
    var el = $('notifyStatus'); if (!el) return;
    var msg = {
      ok: '✅ التنبيه مفعّل — راح يوصلك تقرير يومك كل يوم الساعة ' + timeLabel(settings.notifyTime),
      off: '🔕 التنبيه متوقف',
      denied: '⚠️ صلاحية الإشعارات مرفوضة. فعّلها من إعدادات التلفون ← التطبيقات ← مصروفي ← الإشعارات',
      error: '⚠️ صار خطأ بجدولة التنبيه، جرّب مرة ثانية',
      'ios-install': '📲 حتى توصلك الإشعارات على الآيفون: اضغط زر المشاركة ⬆️ بـ Safari ← "إضافة إلى الشاشة الرئيسية"، وافتح مصروفي من أيقونته.',
      'web-noperm': '🔔 اضغط "فعّل التنبيه" حتى تسمح بالإشعارات.',
      'web-denied': '⚠️ الإشعارات مرفوضة. فعّلها من الإعدادات ← الإشعارات ← مصروفي.',
      'web-error': '⚠️ ما گدرنا نفعّل التنبيه (تأكد من الإنترنت) — جرّب مرة ثانية.',
      'web-unsupported': 'ℹ️ هذا المتصفح ما يدعم الإشعارات. على الآيفون لازم iOS 16.4 أو أحدث وتضيف التطبيق للشاشة الرئيسية.'
    }[lastNotifyState] || '';
    if (!settings.notify) msg = '🔕 التنبيه متوقف';
    el.textContent = msg;
    var tb = $('testNotify');
    if (tb && !isNative) tb.textContent = (lastNotifyState === 'ok') ? '🔔 جرّب التنبيه' : '🔔 فعّل التنبيه';
    var ib = $('iosInstall');
    if (ib) ib.hidden = !(isIOS && !isStandalone && !isNative);
  }
  function timeLabel(t) {
    var hm = t.split(':'), h = +hm[0];
    var suf = h < 12 ? 'صباحاً' : 'مساءً';
    var h12 = h % 12 || 12;
    return h12 + ':' + hm[1] + ' ' + suf;
  }

  async function testNotification() {
    var body = notifyBody(ymd(new Date()));
    if (isNative && LN) {
      try {
        var perm = await LN.requestPermissions();
        if (perm.display !== 'granted') { toast('لازم تسمح بالإشعارات'); return; }
        await LN.schedule({ notifications: [{
          id: 1, title: '📊 تقريرك اليومي (تجربة)', body: body.split('\n')[0], largeBody: body,
          channelId: CHANNEL, schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, extra: { date: ymd(new Date()) }
        }] });
        toast('راح يوصلك إشعار تجريبي خلال ثواني');
      } catch (e) { toast('تعذّر إرسال الإشعار'); }
      return;
    }
    if (isIOS && !isStandalone) { lastNotifyState = 'ios-install'; updateNotifyStatus(); toast('أضف التطبيق للشاشة الرئيسية أولاً'); return; }
    if (!pushSupported) { lastNotifyState = 'web-unsupported'; updateNotifyStatus(); toast('الإشعارات غير مدعومة هنا'); return; }
    if (!settings.notify) { settings.notify = true; save(KEY_SET, settings); $('sNotify').checked = true; }
    idbMirror();
    var sub = await syncPush(true);
    if (!sub) { toast('ما تفعّل التنبيه'); return; }
    try {
      await postJSON('test', { endpoint: sub.endpoint });
      toast('✓ راح يوصلك إشعار تجريبي خلال ثواني');
    } catch (e) { toast('تفعّل التنبيه ✓ بس التجربة ما وصلت، جرّب بعد شوية'); }
  }

  // ---------- مشاركة ونسخ احتياطي ----------
  async function shareText(text, title) {
    var Share = isNative ? plugin('Share') : null;
    try {
      if (Share) { await Share.share({ title: title, text: text, dialogTitle: title }); return; }
      if (navigator.share) { await navigator.share({ title: title, text: text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('تم النسخ للحافظة ✓'); }
    catch (e) { prompt('انسخ النص:', text); }
  }

  function exportBackup() {
    var data = JSON.stringify({ app: 'masrufi', version: 1, exported: new Date().toISOString(), settings: settings, txs: txs });
    var name = 'masrufi-backup-' + ymd(new Date()) + '.json';
    if (isNative) { shareText(data, name); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('تم تنزيل النسخة ✓');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || d.app !== 'masrufi' || !Array.isArray(d.txs)) throw new Error('bad');
        if (!confirm('راح تنضاف ' + d.txs.length + ' عملية من النسخة. العمليات المكررة ما تنضاف مرتين. نكمل؟')) return;
        var ids = {}; txs.forEach(function (t) { ids[t.id] = 1; });
        var added = 0;
        d.txs.forEach(function (t) {
          if (t && t.id && !ids[t.id] && t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) { txs.push(t); added++; }
        });
        if (d.settings && Array.isArray(d.settings.cats)) {
          var have = {}; settings.cats.forEach(function (c) { have[c.id] = 1; });
          d.settings.cats.forEach(function (c) { if (c && c.id && !have[c.id]) settings.cats.push(c); });
          save(KEY_SET, settings);
        }
        persist(); render();
        toast('تمت إضافة ' + added + ' عملية ✓');
      } catch (e) { toast('الملف غير صالح'); }
    };
    reader.readAsText(file);
  }

  // ---------- الأحداث ----------
  function bind() {
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]');
      if (g) {
        if (g.dataset.period) { rKind = g.dataset.period; rAnchor = ymd(new Date()); }
        showTab(g.dataset.goto); return;
      }
      var li = e.target.closest('.tx[data-id]');
      if (li) {
        var t = txs.find(function (x) { return x.id === li.dataset.id; });
        if (t) openSheet(t);
      }
    });
    $('fab').addEventListener('click', function () { openSheet(null); });
    $('cancelTx').addEventListener('click', closeSheet);
    $('sheetBackdrop').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
    $('txForm').addEventListener('submit', submitTx);
    $('deleteTx').addEventListener('click', function () {
      if (!editing || !confirm('متأكد تريد تحذف هذي العملية؟')) return;
      txs = txs.filter(function (x) { return x !== editing; });
      persist(); closeSheet(); render(); toast('تم الحذف');
    });
    $('typeSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      formType = b.dataset.t; formCat = null; renderSheet();
    });
    $('catGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      formCat = b.dataset.cat; renderSheet();
    });
    $('quickAmounts').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $('amount').value = fmt(+b.dataset.q);
    });
    $('amount').addEventListener('input', function () {
      var el = this, raw = el.value;
      var n = parseAmount(raw);
      if (raw && !/[.٫]$/.test(raw) && !isNaN(n)) el.value = fmt(n);
    });

    $('periodSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      rKind = b.dataset.p; renderReports();
    });
    $('prevPeriod').addEventListener('click', function () { rAnchor = shiftAnchor(rKind, rAnchor, -1); renderReports(); });
    $('nextPeriod').addEventListener('click', function () {
      var n = shiftAnchor(rKind, rAnchor, 1);
      rAnchor = n > ymd(new Date()) ? ymd(new Date()) : n; renderReports();
    });
    $('shareReport').addEventListener('click', function () { shareText(reportText(rKind, rAnchor), 'تقرير مصروفي'); });

    $('search').addEventListener('input', renderHistory);
    $('filterType').addEventListener('change', renderHistory);

    $('sName').addEventListener('change', function () { settings.name = this.value.trim(); persistSettings(); render(); });
    $('sCurrency').addEventListener('change', function () { settings.currency = this.value.trim() || 'د.ع'; persistSettings(); render(); });
    $('sBudget').addEventListener('change', function () { settings.budget = parseAmount(this.value) || 0; persistSettings(); });
    $('sWeekStart').addEventListener('change', function () { settings.weekStart = +this.value; persistSettings(); });
    $('sNotify').addEventListener('change', function () { settings.notify = this.checked; persistSettings(); });
    $('sTime').addEventListener('change', function () { if (this.value) { settings.notifyTime = this.value; persistSettings(); } });
    $('testNotify').addEventListener('click', testNotification);
    $('exactAlarm').addEventListener('click', async function () {
      try { await LN.changeExactNotificationSetting(); } catch (e) { }
    });

    $('addCat').addEventListener('click', function () {
      var name = $('newCatName').value.trim();
      if (!name) { toast('اكتب اسم الفئة'); return; }
      settings.cats.push({ id: 'c_' + uid(), name: name, icon: $('newCatIcon').value.trim() || '🏷️', type: $('newCatType').value });
      $('newCatName').value = ''; $('newCatIcon').value = '';
      persistSettings(); renderSettings(); toast('تمت إضافة الفئة ✓');
    });
    $('catChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-cat]'); if (!b) return;
      var id = b.dataset.delCat;
      var used = txs.some(function (t) { return t.cat === id; });
      var c = catOf(id);
      if (settings.cats.filter(function (x) { return x.type === c.type; }).length <= 1) { toast('لازم تبقى فئة وحدة على الأقل'); return; }
      if (!confirm(used ? 'هذي الفئة مستخدمة بعمليات سابقة. العمليات راح تبقى بس تظهر "غير مصنّف". تحذفها؟' : 'تحذف فئة "' + c.name + '"؟')) return;
      settings.cats = settings.cats.filter(function (x) { return x.id !== id; });
      persistSettings(); renderSettings();
    });

    $('exportBtn').addEventListener('click', exportBackup);
    $('importFile').addEventListener('change', function () { if (this.files[0]) importBackup(this.files[0]); this.value = ''; });
    $('wipeBtn').addEventListener('click', function () {
      if (!confirm('راح تنحذف كل العمليات نهائياً. متأكد؟')) return;
      if (!confirm('تأكيد أخير: حذف كل البيانات؟')) return;
      txs = []; persist(); render(); toast('تم حذف البيانات');
    });

    // تحديث التنبيه عند الرجوع للتطبيق (حتى يكون رقم اليوم محدّث)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { render(); scheduleNotifications(); }
    });
    var App = isNative ? plugin('App') : null;
    if (App) {
      try {
        App.addListener('backButton', function () {
          if (!$('sheetBackdrop').hidden) closeSheet();
          else if (currentTab !== 'home') showTab('home');
          else App.exitApp();
        });
        App.addListener('resume', function () { render(); scheduleNotifications(); });
      } catch (e) { }
    }
  }

  // ---------- تشغيل ----------
  bind();
  render();
  setupNative().then(scheduleNotifications);
  if (!isNative && /[?&]report=day/.test(location.search)) { rKind = 'day'; rAnchor = ymd(new Date()); showTab('reports'); }
  if ('serviceWorker' in navigator && !isNative && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
})();
