/* مهامي — تطبيق المصمم: عملاء، أوردرات، ومهام يومية (يعمل محلياً على الهاتف) */
(function () {
  'use strict';

  // ---------- ثوابت ----------
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

  var DEFAULT_SERVICES = [
    { id: 'logo', name: 'لوكو', icon: '🔷' },
    { id: 'identity', name: 'هوية بصرية', icon: '🎨' },
    { id: 'social', name: 'سوشيال ميديا', icon: '📱' },
    { id: 'poster', name: 'بوستر وإعلان', icon: '🖼️' },
    { id: 'print', name: 'مطبوعات', icon: '🖨️' },
    { id: 'motion', name: 'موشن وفيديو', icon: '🎬' },
    { id: 'retouch', name: 'تعديل صور', icon: '🪄' },
    { id: 'other', name: 'أخرى', icon: '📦' }
  ];

  var STATUSES = [
    { id: 'new', name: 'جديد', icon: '🆕' },
    { id: 'progress', name: 'قيد التنفيذ', icon: '🎨' },
    { id: 'review', name: 'بانتظار الملاحظات', short: 'ملاحظات', icon: '👀' },
    { id: 'done', name: 'تم التسليم', short: 'تسليم', icon: '✅' }
  ];
  var CANCEL = { id: 'cancel', name: 'ملغي', icon: '🚫' };
  var PRIOS = [{ id: 'low', name: 'عادي' }, { id: 'mid', name: 'مهم' }, { id: 'high', name: 'عاجل 🔥' }];

  var DEFAULT_SETTINGS = {
    name: '',
    currency: 'د.ع',
    weekStart: 6,
    notify: true,
    notifyTime: '09:00',
    taskAlerts: true,
    services: DEFAULT_SERVICES
  };

  // ---------- التخزين ----------
  var KEY = { clients: 'mahami.clients.v1', orders: 'mahami.orders.v1', tasks: 'mahami.tasks.v1', settings: 'mahami.settings.v1' };
  function load(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast('تعذّر الحفظ!'); }
  }

  var clients = load(KEY.clients, []);
  var orders = load(KEY.orders, []);
  var tasks = load(KEY.tasks, []);
  var settings = Object.assign({}, DEFAULT_SETTINGS, load(KEY.settings, {}));
  if (!Array.isArray(settings.services) || !settings.services.length) settings.services = DEFAULT_SERVICES.slice();

  function persist() {
    save(KEY.clients, clients); save(KEY.orders, orders); save(KEY.tasks, tasks);
    scheduleNotifications();
  }
  function persistSettings() { save(KEY.settings, settings); scheduleNotifications(); }

  // ---------- أدوات ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function today() { return ymd(new Date()); }
  function startOfWeek(d) { return addDays(d, -((d.getDay() - settings.weekStart + 7) % 7)); }
  function dayTitle(d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function shortDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }

  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function money(n) { return fmt(n) + ' ' + settings.currency; }
  function fmtShort(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return fmt(n);
  }
  function parseAmount(s) {
    if (s == null || s === '') return NaN;
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
  function timeLabel(t) {
    if (!t) return '';
    var hm = t.split(':'), h = +hm[0];
    return (h % 12 || 12) + ':' + hm[1] + ' ' + (h < 12 ? 'ص' : 'م');
  }

  // ---------- الوصول للبيانات ----------
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function clientOf(o) { return byId(clients, o.clientId) || { id: '', name: 'بدون عميل', phone: '' }; }
  function svcOf(id) { return byId(settings.services, id) || { id: id, name: 'أخرى', icon: '📦' }; }
  function statusOf(id) { return byId(STATUSES, id) || (id === 'cancel' ? CANCEL : STATUSES[0]); }
  function paidOf(o) { return (o.payments || []).reduce(function (s, p) { return s + p.amount; }, 0); }
  function dueOf(o) { return o.status === 'cancel' ? 0 : Math.max(0, (o.price || 0) - paidOf(o)); }
  function isActive(o) { return o.status !== 'done' && o.status !== 'cancel'; }
  function isLate(o) { return isActive(o) && o.deadline && o.deadline < today(); }
  function ordersOf(c) { return orders.filter(function (o) { return o.clientId === c.id; }); }
  function tasksOn(d) { return tasks.filter(function (t) { return t.date === d; }); }
  function overdueTasks() { var t0 = today(); return tasks.filter(function (t) { return !t.done && t.date < t0; }); }
  var PRANK = { high: 0, mid: 1, low: 2 };
  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      return (a.done - b.done) || ((PRANK[a.prio] || 2) - (PRANK[b.prio] || 2)) ||
        ((a.time || '99') .localeCompare(b.time || '99')) || a.created - b.created;
    });
  }
  function sortByDeadline(list) {
    return list.slice().sort(function (a, b) { return (a.deadline || '9999').localeCompare(b.deadline || '9999') || b.created - a.created; });
  }

  function deadlinePill(o) {
    if (!o.deadline) return '';
    if (o.status === 'done') return '<span class="pill done">سُلّم ' + (o.deliveredAt ? shortDate(parseYmd(o.deliveredAt)) : '') + '</span>';
    if (o.status === 'cancel') return '';
    var n = daysBetween(today(), o.deadline);
    if (n < 0) return '<span class="pill late">متأخر ' + dayCount(-n) + '</span>';
    if (n === 0) return '<span class="pill late">التسليم اليوم</span>';
    if (n === 1) return '<span class="pill soon">التسليم باچر</span>';
    if (n <= 3) return '<span class="pill soon">باقي ' + dayCount(n) + '</span>';
    return '<span class="pill">' + shortDate(parseYmd(o.deadline)) + '</span>';
  }
  function dayCount(n) { return n === 1 ? 'يوم' : n === 2 ? 'يومين' : n + (n <= 10 ? ' أيام' : ' يوم'); }
  function statusPill(o) { var s = statusOf(o.status); return '<span class="pill ' + s.id + '">' + s.icon + ' ' + s.name + '</span>'; }

  // ---------- واجهة: عام ----------
  var toastTimer;
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  var currentTab = 'home';
  function showTab(name) {
    currentTab = name;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    window.scrollTo(0, 0);
    render();
  }

  function render() {
    var now = new Date();
    $('todayLabel').textContent = dayTitle(now) + ' ' + now.getFullYear();
    $('hello').textContent = settings.name ? 'أهلاً ' + settings.name + ' 👋' : 'أهلاً 👋';
    if (currentTab === 'home') renderHome();
    else if (currentTab === 'orders') renderOrders();
    else if (currentTab === 'clients') renderClients();
    else if (currentTab === 'reports') renderReports();
    else if (currentTab === 'settings') renderSettings();
  }

  function taskRow(t, showDate) {
    var o = t.orderId ? byId(orders, t.orderId) : null;
    var bits = [];
    if (showDate) bits.push(shortDate(parseYmd(t.date)));
    if (t.time) bits.push('🕒 ' + timeLabel(t.time));
    if (o) bits.push('📦 ' + o.title);
    else if (t.note) bits.push(t.note);
    return '<li class="row' + (t.done ? ' done' : '') + '" data-task="' + t.id + '">' +
      '<span class="prio ' + (t.done ? '' : (t.prio || '')) + '"></span>' +
      '<input type="checkbox" class="check" data-toggle="' + t.id + '"' + (t.done ? ' checked' : '') + ' aria-label="تم">' +
      '<div class="main"><div class="ttl">' + esc(t.title) + '</div>' +
      (bits.length ? '<div class="sub">' + esc(bits.join(' • ')) + '</div>' : '') + '</div></li>';
  }

  function orderRow(o, compact) {
    var s = svcOf(o.service), c = clientOf(o), due = dueOf(o);
    return '<li class="row" data-order="' + o.id + '">' +
      '<div class="ic">' + esc(s.icon) + '</div>' +
      '<div class="main"><div class="ttl">' + esc(o.title) + '</div>' +
      '<div class="sub">' + esc(c.name) + ' • ' + esc(s.name) + '</div>' +
      '<div class="pills">' + (compact ? '' : statusPill(o)) + deadlinePill(o) + '</div></div>' +
      '<div class="side"><b>' + fmtShort(o.price || 0) + '</b>' +
      (o.status === 'cancel' ? '' : due > 0 ? '<small>باقي ' + fmtShort(due) + '</small>' : (o.price ? '<small class="down">مدفوع ✓</small>' : '')) +
      '</div></li>';
  }

  // ---------- الرئيسية ----------
  var selDay = today();
  function renderHome() {
    var t0 = today();
    var todays = tasksOn(t0), doneN = todays.filter(function (t) { return t.done; }).length;
    var pct = todays.length ? Math.round(doneN / todays.length * 100) : 0;
    $('heroNum').textContent = doneN + ' / ' + todays.length;
    $('heroPct').textContent = pct + '%';
    $('heroRing').style.setProperty('--p', pct);
    var active = orders.filter(isActive);
    var weekEnd = ymd(addDays(new Date(), 7));
    $('hActive').textContent = active.length;
    $('hWeek').textContent = active.filter(function (o) { return o.deadline && o.deadline <= weekEnd; }).length;
    $('hDue').textContent = fmtShort(orders.reduce(function (s, o) { return s + dueOf(o); }, 0));

    // شريط الأيام
    var ws = startOfWeek(parseYmd(selDay)), html = '<button class="nav" data-shift="-7" aria-label="الأسبوع السابق">›</button>';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), k = ymd(d), list = tasksOn(k);
      var left = list.filter(function (t) { return !t.done; }).length;
      html += '<button data-day="' + k + '" class="' + (k === selDay ? 'on ' : '') + (k === t0 ? 'today' : '') + '">' +
        DAYS_SHORT[d.getDay()] + '<b>' + d.getDate() + '</b>' +
        (list.length ? '<i class="' + (left ? '' : 'done') + '"></i>' : '') + '</button>';
    }
    html += '<button class="nav" data-shift="7" aria-label="الأسبوع التالي">‹</button>';
    $('dayStrip').innerHTML = html;

    var sel = parseYmd(selDay);
    var diff = daysBetween(t0, selDay);
    $('tasksTitle').textContent = diff === 0 ? 'مهام اليوم' : diff === 1 ? 'مهام باچر' : diff === -1 ? 'مهام البارحة' : 'مهام ' + dayTitle(sel);
    var dayTasks = sortTasks(tasksOn(selDay));
    var dueOrders = orders.filter(function (o) { return isActive(o) && o.deadline === selDay; });
    var dueHtml = dueOrders.map(function (o) {
      return '<li class="row" data-order="' + o.id + '"><span class="prio high"></span><div class="ic">🚚</div>' +
        '<div class="main"><div class="ttl">تسليم: ' + esc(o.title) + '</div><div class="sub">' + esc(clientOf(o).name) + '</div></div></li>';
    }).join('');
    $('taskList').innerHTML = (dueHtml + dayTasks.map(function (t) { return taskRow(t, false); }).join('')) ||
      '<li class="empty">ماكو مهام ' + (diff === 0 ? 'اليوم' : 'بهذا اليوم') + '. اضغط ➕ حتى تضيف مهمة أو أوردر.</li>';

    var od = diff === 0 ? sortTasks(overdueTasks()) : [];
    $('overdueCard').hidden = !od.length;
    $('overdueList').innerHTML = od.map(function (t) { return taskRow(t, true); }).join('');

    var next = sortByDeadline(active).slice(0, 5);
    $('deadlineList').innerHTML = next.length ? next.map(function (o) { return orderRow(o, true); }).join('')
      : '<li class="empty">ماكو أوردرات شغّالة حالياً 🎉</li>';
  }

  // ---------- الأوردرات ----------
  var orderFilter = 'active';
  function renderOrders() {
    document.querySelectorAll('#orderSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === orderFilter); });
    var q = $('orderSearch').value.trim().toLowerCase();
    var list = orders.filter(function (o) {
      if (orderFilter === 'active' && !isActive(o)) return false;
      if (orderFilter === 'late' && !isLate(o)) return false;
      if (orderFilter === 'unpaid' && !(dueOf(o) > 0)) return false;
      if (orderFilter === 'done' && isActive(o)) return false;
      if (!q) return true;
      return (o.title + ' ' + clientOf(o).name + ' ' + svcOf(o.service).name + ' ' + (o.note || '')).toLowerCase().indexOf(q) >= 0;
    });
    list = orderFilter === 'done'
      ? list.sort(function (a, b) { return (b.deliveredAt || '').localeCompare(a.deliveredAt || '') || b.created - a.created; })
      : sortByDeadline(list);
    var total = list.reduce(function (s, o) { return s + (o.status === 'cancel' ? 0 : o.price || 0); }, 0);
    var due = list.reduce(function (s, o) { return s + dueOf(o); }, 0);
    $('orderSum').innerHTML = '<div><span>العدد</span><b>' + list.length + '</b></div>' +
      '<div><span>القيمة</span><b>' + fmtShort(total) + '</b></div>' +
      '<div><span>الباقي</span><b class="' + (due ? 'up' : '') + '">' + fmtShort(due) + '</b></div>';
    var empty = { active: 'ماكو أوردرات شغّالة. اضغط ➕ حتى تضيف أوردر جديد.', late: 'ماكو أوردرات متأخرة 👏', unpaid: 'كل الأوردرات مدفوعة 👌', done: 'ماكو أوردرات مسلّمة بعد' }[orderFilter];
    $('orderList').innerHTML = list.length ? list.map(function (o) { return orderRow(o, false); }).join('')
      : '<li class="card empty">' + (q ? 'ماكو نتائج' : empty) + '</li>';
  }

  // ---------- العملاء ----------
  function renderClients() {
    var q = $('clientSearch').value.trim().toLowerCase();
    var list = clients.filter(function (c) { return !q || (c.name + ' ' + (c.phone || '') + ' ' + (c.note || '')).toLowerCase().indexOf(q) >= 0; })
      .map(function (c) {
        var os = ordersOf(c);
        return { c: c, n: os.length, act: os.filter(isActive).length, paid: os.reduce(function (s, o) { return s + paidOf(o); }, 0), due: os.reduce(function (s, o) { return s + dueOf(o); }, 0), last: os.reduce(function (m, o) { return Math.max(m, o.created); }, c.created || 0) };
      }).sort(function (a, b) { return b.last - a.last; });
    $('clientList').innerHTML = list.length ? list.map(function (x) {
      return '<li class="row" data-client="' + x.c.id + '"><div class="ic av">' + esc(initial(x.c.name)) + '</div>' +
        '<div class="main"><div class="ttl">' + esc(x.c.name) + '</div><div class="sub">' +
        x.n + ' أوردر' + (x.act ? ' • ' + x.act + ' شغّال' : '') + (x.c.phone ? ' • ' + esc(x.c.phone) : '') + '</div></div>' +
        '<div class="side"><b class="down">' + fmtShort(x.paid) + '</b>' + (x.due ? '<small>باقي ' + fmtShort(x.due) + '</small>' : '') + '</div></li>';
    }).join('') : '<li class="card empty">' + (q ? 'ماكو نتائج' : 'ما عندك عملاء بعد. أضف أول عميل من زر «+ عميل».') + '</li>';
  }
  function initial(name) { return (String(name || '؟').trim()[0] || '؟').toUpperCase(); }

  // ---------- التقارير ----------
  var rKind = 'week', rAnchor = today();
  function periodRange(kind, anchor) {
    var a = parseYmd(anchor), from, to, title;
    if (kind === 'day') { from = to = a; title = dayTitle(a); }
    else if (kind === 'week') { from = startOfWeek(a); to = addDays(from, 6); title = shortDate(from) + ' — ' + shortDate(to); }
    else { from = new Date(a.getFullYear(), a.getMonth(), 1); to = new Date(a.getFullYear(), a.getMonth() + 1, 0); title = MONTHS[a.getMonth()] + ' ' + a.getFullYear(); }
    return { from: ymd(from), to: ymd(to), fromD: from, title: title };
  }
  function shiftAnchor(kind, anchor, dir) {
    var a = parseYmd(anchor);
    if (kind === 'day') return ymd(addDays(a, dir));
    if (kind === 'week') return ymd(addDays(a, 7 * dir));
    return ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }
  function periodStats(r) {
    var inR = function (d) { return d && d >= r.from && d <= r.to; };
    var pays = [];
    orders.forEach(function (o) { (o.payments || []).forEach(function (p) { if (inR(p.date)) pays.push({ o: o, p: p }); }); });
    return {
      tasksPlanned: tasks.filter(function (t) { return inR(t.date); }),
      tasksDone: tasks.filter(function (t) { return t.done && inR(t.doneAt); }),
      delivered: orders.filter(function (o) { return o.status === 'done' && inR(o.deliveredAt); }),
      created: orders.filter(function (o) { return inR(ymd(new Date(o.created))); }),
      pays: pays,
      income: pays.reduce(function (s, x) { return s + x.p.amount; }, 0)
    };
  }

  function renderReports() {
    document.querySelectorAll('#periodSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === rKind); });
    var r = periodRange(rKind, rAnchor);
    $('periodTitle').textContent = r.title;
    $('nextPeriod').disabled = r.to >= today();
    var s = periodStats(r);
    $('rTasks').textContent = s.tasksDone.length;
    $('rOrders').textContent = s.delivered.length;
    $('rIncome').textContent = fmtShort(s.income);

    var prev = periodStats(periodRange(rKind, shiftAnchor(rKind, rAnchor, -1)));
    var prevName = { day: 'أمس', week: 'الأسبوع الماضي', month: 'الشهر الماضي' }[rKind];
    var ins = [];
    var planned = s.tasksPlanned.length, plannedDone = s.tasksPlanned.filter(function (t) { return t.done; }).length;
    if (planned) ins.push(['نسبة إنجاز المهام', '<b class="' + (plannedDone / planned >= .7 ? 'down' : 'up') + '">' + Math.round(plannedDone / planned * 100) + '%</b> (' + plannedDone + ' من ' + planned + ')']);
    ins.push(['أوردرات جديدة', String(s.created.length)]);
    var newVal = s.created.filter(function (o) { return o.status !== 'cancel'; }).reduce(function (x, o) { return x + (o.price || 0); }, 0);
    if (newVal) ins.push(['قيمة الأوردرات الجديدة', money(newVal)]);
    if (s.created.length) ins.push(['متوسط سعر الأوردر', money(newVal / Math.max(1, s.created.filter(function (o) { return o.status !== 'cancel'; }).length))]);
    ins.push(['الوارد', money(s.income)]);
    if (prev.income > 0) {
      var ch = (s.income - prev.income) / prev.income * 100;
      ins.push(['الوارد مقارنة بـ' + prevName, '<b class="' + (ch >= 0 ? 'down' : 'up') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(0) + '%</b> (' + fmtShort(prev.income) + ')']);
    }
    var late = s.delivered.filter(function (o) { return o.deadline && o.deliveredAt > o.deadline; }).length;
    if (s.delivered.length) ins.push(['تسليم بالموعد', '<b class="' + (late ? 'up' : 'down') + '">' + Math.round((s.delivered.length - late) / s.delivered.length * 100) + '%</b>']);
    var totalDue = orders.reduce(function (x, o) { return x + dueOf(o); }, 0);
    ins.push(['مبالغ باقية عند العملاء (الكل)', money(totalDue)]);
    $('insights').innerHTML = ins.map(function (p) {
      return '<div><span>' + esc(p[0]) + '</span><b>' + (p[1].indexOf('<b') === 0 ? p[1] : esc(p[1])) + '</b></div>';
    }).join('');

    renderChart(r, s);
    var bySvc = {}, byCl = {};
    s.pays.forEach(function (x) {
      bySvc[x.o.service] = (bySvc[x.o.service] || 0) + x.p.amount;
      byCl[x.o.clientId] = (byCl[x.o.clientId] || 0) + x.p.amount;
    });
    renderBreak('svcBreak', Object.keys(bySvc).map(function (k) { var v = svcOf(k); return { label: v.icon + ' ' + v.name, sum: bySvc[k] }; }), s.income);
    renderBreak('clientBreak', Object.keys(byCl).map(function (k) { var c = byId(clients, k); return { label: '👤 ' + (c ? c.name : 'بدون عميل'), sum: byCl[k] }; }), s.income);
  }

  function renderChart(r, s) {
    var card = $('chartCard');
    if (rKind === 'day') { card.hidden = true; return; }
    card.hidden = false;
    var days = [], d = r.fromD;
    while (ymd(d) <= r.to) { days.push(ymd(d)); d = addDays(d, 1); }
    var sums = {};
    s.tasksDone.forEach(function (t) { sums[t.doneAt] = (sums[t.doneAt] || 0) + 1; });
    var max = 0; days.forEach(function (k) { max = Math.max(max, sums[k] || 0); });
    var t0 = today(), dense = days.length > 10;
    $('chart').className = 'chart' + (dense ? ' dense' : '');
    $('chart').innerHTML = days.map(function (k) {
      var v = sums[k] || 0, dd = parseYmd(k);
      var lbl = dense ? ((dd.getDate() % 5 === 1 || k === t0) ? dd.getDate() : '&nbsp;') : DAYS_SHORT[dd.getDay()];
      return '<div class="col' + (k === t0 ? ' today' : '') + (max && v === max ? ' max' : '') + '">' +
        (!dense && v ? '<div class="val">' + v + '</div>' : '') +
        '<div class="bars"><div class="b t" style="height:' + (max ? v / max * 100 : 0) + '%"></div></div>' +
        '<div class="lbl">' + lbl + '</div></div>';
    }).join('');
  }

  function renderBreak(elId, rows, total) {
    rows.sort(function (a, b) { return b.sum - a.sum; });
    $(elId).innerHTML = rows.length ? rows.map(function (x) {
      var pct = total ? x.sum / total * 100 : 0;
      return '<div class="brk in"><div class="brk-head"><span>' + esc(x.label) + '</span><span>' + fmt(x.sum) + ' • ' + pct.toFixed(0) + '%</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('') : '<div class="empty">ماكو وارد مسجّل بهذي الفترة</div>';
  }

  function reportText() {
    var r = periodRange(rKind, rAnchor), s = periodStats(r);
    var name = { day: 'تقرير اليوم', week: 'تقرير الأسبوع', month: 'تقرير الشهر' }[rKind];
    var lines = ['📊 ' + name + ' — ' + r.title, '',
      '✅ مهام منجزة: ' + s.tasksDone.length,
      '📦 أوردرات مسلّمة: ' + s.delivered.length,
      '🆕 أوردرات جديدة: ' + s.created.length,
      '💰 الوارد: ' + money(s.income)];
    if (s.delivered.length) {
      lines.push('', 'الأوردرات المسلّمة:');
      s.delivered.forEach(function (o) { lines.push('• ' + svcOf(o.service).icon + ' ' + o.title + ' — ' + clientOf(o).name); });
    }
    return lines.join('\n');
  }

  // ---------- الإعدادات ----------
  function renderSettings() {
    $('sName').value = settings.name;
    $('sCurrency').value = settings.currency;
    $('sWeekStart').value = String(settings.weekStart);
    $('sNotify').checked = settings.notify;
    $('sTime').value = settings.notifyTime;
    $('sTaskAlerts').checked = settings.taskAlerts;
    $('svcChips').innerHTML = settings.services.map(function (c) {
      return '<span class="chip">' + esc(c.icon) + ' ' + esc(c.name) + '<button data-del-svc="' + esc(c.id) + '" aria-label="حذف">×</button></span>';
    }).join('');
    updateNotifyStatus();
  }

  // ---------- النافذة السفلية ----------
  var sheetStack = [];   // دوال لإعادة فتح النوافذ السابقة (رجوع)
  var currentSheet = null;
  var acts = {};         // أزرار النافذة الحالية: data-act → دالة
  var onSubmit = null;

  function openSheet(reopen, html, actions, submit) {
    currentSheet = reopen;
    acts = actions || {}; onSubmit = submit || null;
    $('sheetBody').innerHTML = html;
    $('sheetBackdrop').hidden = false;
    $('sheet').scrollTop = 0;
  }
  function nested(fn) { if (currentSheet) sheetStack.push(currentSheet); fn(); }
  function back() {
    var prev = sheetStack.pop();
    if (prev) prev(); else closeSheet();
  }
  function closeSheet() { $('sheetBackdrop').hidden = true; sheetStack = []; currentSheet = null; acts = {}; onSubmit = null; }
  function refresh() {
    render();
    if (!currentSheet) return;
    var y = $('sheet').scrollTop; currentSheet(); $('sheet').scrollTop = y;
  }

  function optGrid(name, items, sel) {
    return '<div class="opt-grid" data-opt="' + name + '">' + items.map(function (x) {
      return '<button type="button" data-v="' + esc(x.id) + '" class="' + (x.id === sel ? 'on' : '') + '">' + (x.icon ? esc(x.icon) + ' ' : '') + esc(x.name) + '</button>';
    }).join('') + '</div>';
  }
  function optVal(name) { var b = document.querySelector('[data-opt="' + name + '"] button.on'); return b ? b.dataset.v : null; }
  function formBtns(delAct) {
    return '<div class="row-btns">' + (delAct ? '<button type="button" class="btn danger" data-act="' + delAct + '">حذف</button>' : '') +
      '<button type="button" class="btn ghost" data-act="back">إلغاء</button><button type="submit" class="btn primary grow">حفظ</button></div>';
  }

  // --- اختيار ماذا تضيف ---
  function openChooser() {
    sheetStack = [];
    openSheet(openChooser,
      '<div class="sheet-title"><h3>شنو تريد تضيف؟</h3></div>' +
      '<div class="chooser">' +
      '<button data-act="task"><span>✅</span>مهمة<small>شغلة اليوم</small></button>' +
      '<button data-act="order"><span>📦</span>أوردر<small>طلب من عميل</small></button>' +
      '<button data-act="client"><span>👤</span>عميل<small>زبون جديد</small></button></div>', {
        task: function () { openTaskForm(null, { date: currentTab === 'home' ? selDay : today() }); },
        order: function () { openOrderForm(null, {}); },
        client: function () { openClientForm(null); }
      });
  }

  // --- نموذج المهمة ---
  function openTaskForm(t, def) {
    def = def || {};
    var draft = t ? Object.assign({}, t) : { title: '', date: def.date || today(), time: '', prio: 'low', orderId: def.orderId || '', note: '' };
    var act = sortByDeadline(orders.filter(function (o) { return isActive(o) || o.id === draft.orderId; }));
    var html = '<form id="f" autocomplete="off"><div style="display:grid;gap:12px">' +
      '<div class="sheet-title"><h3>' + (t ? 'تعديل مهمة' : 'مهمة جديدة') + '</h3></div>' +
      '<input id="fTitle" class="big-in" placeholder="شنو المهمة؟ (مثلاً: تصميم ستوري للعرض)" maxlength="140" value="' + esc(draft.title) + '">' +
      '<div class="two"><label class="fld">اليوم<input type="date" id="fDate" value="' + draft.date + '"></label>' +
      '<label class="fld">الوقت (اختياري)<input type="time" id="fTime" value="' + (draft.time || '') + '"></label></div>' +
      '<div class="fld">الأهمية' + optGrid('prio', PRIOS, draft.prio || 'low') + '</div>' +
      '<label class="fld">مرتبطة بأوردر<select id="fOrder"><option value="">— بدون —</option>' +
      act.map(function (o) { return '<option value="' + o.id + '"' + (o.id === draft.orderId ? ' selected' : '') + '>' + esc(o.title + ' — ' + clientOf(o).name) + '</option>'; }).join('') +
      '</select></label>' +
      '<input id="fNote" placeholder="ملاحظة (اختياري)" maxlength="200" value="' + esc(draft.note || '') + '">' +
      formBtns(t ? 'del' : '') + '</div></form>';
    openSheet(function () { openTaskForm(t, def); }, html, {
      del: function () {
        if (!confirm('تحذف هذي المهمة؟')) return;
        tasks = tasks.filter(function (x) { return x !== t; }); persist(); back(); render(); toast('تم الحذف');
      }
    }, function () {
      var title = $('fTitle').value.trim();
      if (!title) { toast('اكتب المهمة'); $('fTitle').focus(); return; }
      var data = { title: title, date: $('fDate').value || today(), time: $('fTime').value || '', prio: optVal('prio') || 'low', orderId: $('fOrder').value, note: $('fNote').value.trim() };
      if (t) { Object.assign(t, data); toast('تم التعديل ✓'); }
      else { data.id = uid(); data.created = Date.now(); data.done = false; tasks.push(data); toast('تمت إضافة المهمة ✓'); }
      persist(); back(); render();
    });
    if (!t) setTimeout(function () { var el = $('fTitle'); if (el) el.focus(); }, 150);
  }

  // --- نموذج الأوردر ---
  function openOrderForm(o, def) {
    def = def || {};
    var d = o ? Object.assign({}, o) : { title: '', clientId: def.clientId || '', service: settings.services[0].id, price: '', deadline: ymd(addDays(new Date(), 3)), note: '' };
    var cl = clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
    var html = '<form id="f" autocomplete="off"><div style="display:grid;gap:12px">' +
      '<div class="sheet-title"><h3>' + (o ? 'تعديل أوردر' : 'أوردر جديد') + '</h3></div>' +
      '<input id="fTitle" class="big-in" placeholder="اسم الأوردر (مثلاً: لوكو مطعم الريم)" maxlength="140" value="' + esc(d.title) + '">' +
      '<label class="fld">العميل<select id="fClient">' +
      (cl.length ? '' : '<option value="">— ماكو عملاء —</option>') +
      cl.map(function (c) { return '<option value="' + c.id + '"' + (c.id === d.clientId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '<option value="__new"' + (!cl.length ? ' selected' : '') + '>➕ عميل جديد…</option></select></label>' +
      '<div class="two" id="newClientBox"' + (cl.length ? ' hidden' : '') + '><input id="fNewName" placeholder="اسم العميل" maxlength="80"><input id="fNewPhone" placeholder="رقم التلفون" inputmode="tel" maxlength="20"></div>' +
      '<div class="fld">نوع الشغل' + optGrid('svc', settings.services, d.service) + '</div>' +
      '<div class="two"><label class="fld">السعر (' + esc(settings.currency) + ')<input id="fPrice" inputmode="decimal" placeholder="0" value="' + (d.price ? fmt(d.price) : '') + '"></label>' +
      (o ? '' : '<label class="fld">عربون مستلم<input id="fDeposit" inputmode="decimal" placeholder="0"></label>') +
      (o ? '<label class="fld">موعد التسليم<input type="date" id="fDeadline" value="' + (d.deadline || '') + '"></label>' : '') + '</div>' +
      (o ? '' : '<label class="fld">موعد التسليم<input type="date" id="fDeadline" value="' + (d.deadline || '') + '"></label>') +
      '<textarea id="fNote" placeholder="تفاصيل الطلب، المقاسات، الألوان، الملاحظات…" maxlength="1000">' + esc(d.note || '') + '</textarea>' +
      formBtns(o ? 'del' : '') + '</div></form>';
    openSheet(function () { openOrderForm(o, def); }, html, {
      del: function () {
        if (!confirm('تحذف الأوردر "' + o.title + '" وكل دفعاته؟ المهام المرتبطة بيه راح تبقى.')) return;
        orders = orders.filter(function (x) { return x !== o; });
        tasks.forEach(function (t) { if (t.orderId === o.id) t.orderId = ''; });
        persist(); closeSheet(); render(); toast('تم حذف الأوردر');
      }
    }, function () {
      var title = $('fTitle').value.trim();
      if (!title) { toast('اكتب اسم الأوردر'); $('fTitle').focus(); return; }
      var clientId = $('fClient').value;
      if (clientId === '__new' || !clientId) {
        var nm = $('fNewName').value.trim();
        if (!nm) { toast('اكتب اسم العميل'); $('fNewName').focus(); return; }
        var nc = { id: uid(), name: nm, phone: $('fNewPhone').value.trim(), note: '', created: Date.now() };
        clients.push(nc); clientId = nc.id;
      }
      var price = parseAmount($('fPrice').value) || 0;
      var data = { title: title, clientId: clientId, service: optVal('svc') || 'other', price: price, deadline: $('fDeadline').value || '', note: $('fNote').value.trim() };
      if (o) { Object.assign(o, data); persist(); toast('تم التعديل ✓'); back(); render(); return; }
      data.id = uid(); data.created = Date.now(); data.status = 'new'; data.payments = [];
      var dep = parseAmount($('fDeposit').value);
      if (dep > 0) data.payments.push({ id: uid(), amount: dep, date: today(), note: 'عربون' });
      orders.push(data); persist(); render();
      toast('تمت إضافة الأوردر ✓');
      sheetStack = []; openOrderView(data);
    });
    var sel = $('fClient');
    sel.addEventListener('change', function () { $('newClientBox').hidden = sel.value !== '__new'; if (sel.value === '__new') $('fNewName').focus(); });
    $('fPrice').addEventListener('input', liveAmount);
    if ($('fDeposit')) $('fDeposit').addEventListener('input', liveAmount);
    if (!o) setTimeout(function () { var el = $('fTitle'); if (el) el.focus(); }, 150);
  }
  function liveAmount() {
    var raw = this.value, n = parseAmount(raw);
    if (raw && !/[.٫]$/.test(raw) && !isNaN(n)) this.value = fmt(n);
  }

  // --- عرض الأوردر ---
  function openOrderView(o) {
    if (!byId(orders, o.id)) { back(); return; }
    var c = clientOf(o), s = svcOf(o.service), paid = paidOf(o), due = dueOf(o);
    var pct = o.price ? Math.min(100, paid / o.price * 100) : 0;
    var ot = sortTasks(tasks.filter(function (t) { return t.orderId === o.id; }));
    var html = '<div class="sheet-title"><h3>' + esc(s.icon) + ' ' + esc(o.title) + '</h3><button class="link" data-act="edit">تعديل ✏️</button></div>' +
      '<div class="pills">' + statusPill(o) + deadlinePill(o) + '<span class="pill">' + esc(s.name) + '</span></div>' +
      '<button class="row" data-act="client" style="border:1px solid var(--line);border-radius:14px;padding:10px;background:var(--surface-2);width:100%;text-align:inherit">' +
      '<div class="ic av">' + esc(initial(c.name)) + '</div><div class="main"><div class="ttl">' + esc(c.name) + '</div><div class="sub">' + esc(c.phone || 'اضغط لعرض العميل') + '</div></div><span class="muted-sm">←</span></button>' +
      (o.status === 'cancel' ? '<p class="muted-sm">🚫 هذا الأوردر ملغي.</p>' :
        '<div class="status-steps">' + STATUSES.map(function (st) {
          return '<button data-act="st" data-v="' + st.id + '" class="' + (o.status === st.id ? 'on' : '') + '"><span>' + st.icon + '</span>' + (st.short || st.name) + '</button>';
        }).join('') + '</div>') +
      '<div class="kv"><div><span>السعر</span><b>' + money(o.price || 0) + '</b></div>' +
      '<div><span>المستلم</span><b class="down">' + money(paid) + '</b></div>' +
      '<div><span>الباقي</span><b class="' + (due ? 'up' : '') + '">' + money(due) + '</b></div>' +
      '<div class="money-bar"><i style="width:' + pct + '%"></i></div>' +
      (o.deadline ? '<div><span>موعد التسليم</span><b>' + dayTitle(parseYmd(o.deadline)) + '</b></div>' : '') +
      (o.deliveredAt ? '<div><span>تاريخ التسليم</span><b>' + dayTitle(parseYmd(o.deliveredAt)) + '</b></div>' : '') +
      '<div><span>تاريخ الطلب</span><b>' + shortDate(new Date(o.created)) + '</b></div></div>' +
      (o.note ? '<div class="kv" style="white-space:pre-wrap">' + esc(o.note) + '</div>' : '') +
      (o.status !== 'cancel' && due > 0 ? '<div class="mini-add"><input id="payAmt" inputmode="decimal" placeholder="مبلغ دفعة مستلمة"><button class="btn ok" data-act="pay">استلمت</button></div>' +
        '<button class="btn ghost" data-act="payall">💰 استلمت المبلغ كامل (' + fmt(due) + ')</button>' : '') +
      ((o.payments || []).length ? '<div class="sec-h">الدفعات</div><ul class="list">' + o.payments.map(function (p) {
        return '<li class="row" data-act="delpay" data-v="' + p.id + '"><div class="ic" style="background:var(--in-soft)">💵</div><div class="main"><div class="ttl down">+' + fmt(p.amount) + '</div><div class="sub">' + shortDate(parseYmd(p.date)) + (p.note ? ' • ' + esc(p.note) : '') + '</div></div><span class="muted-sm">×</span></li>';
      }).join('') + '</ul>' : '') +
      '<div class="sec-h">مهام الأوردر<span class="muted-sm">' + ot.filter(function (t) { return t.done; }).length + '/' + ot.length + '</span></div>' +
      '<ul class="list">' + ot.map(function (t) { return taskRow(t, true); }).join('') + '</ul>' +
      '<div class="mini-add"><input id="qTask" placeholder="مهمة سريعة لهذا الأوردر (لليوم)" maxlength="140"><button class="btn" data-act="qtask">+</button></div>' +
      '<div class="row-btns"><button class="btn ghost grow" data-act="share">📤 أرسل التفاصيل للعميل</button>' +
      (o.status === 'cancel' ? '<button class="btn ghost" data-act="uncancel">↩️ استرجاع</button>' : '<button class="btn danger" data-act="cancel">إلغاء الأوردر</button>') + '</div>' +
      '<button class="btn ghost wide" data-act="back" style="margin-top:0">إغلاق</button>';
    var re = function () { openOrderView(o); };
    openSheet(re, html, {
      edit: function () { nested(function () { openOrderForm(o); }); },
      client: function () { if (byId(clients, o.clientId)) nested(function () { openClientView(c); }); },
      st: function (el) {
        var v = el.dataset.v; if (o.status === v) return;
        o.status = v;
        if (v === 'done') { o.deliveredAt = today(); toast(due > 0 ? 'تم التسليم ✓ — باقي ' + fmt(due) + ' عند العميل' : 'تم التسليم ✓'); }
        else o.deliveredAt = '';
        persist(); refresh();
      },
      pay: function () {
        var a = parseAmount($('payAmt').value);
        if (!(a > 0)) { toast('اكتب مبلغ صحيح'); $('payAmt').focus(); return; }
        o.payments = o.payments || []; o.payments.push({ id: uid(), amount: a, date: today() });
        persist(); refresh(); toast('تم تسجيل الدفعة ✓');
      },
      payall: function () {
        o.payments = o.payments || []; o.payments.push({ id: uid(), amount: due, date: today(), note: due === o.price ? 'المبلغ كامل' : 'الباقي' });
        persist(); refresh(); toast('الأوردر صار مدفوع بالكامل 💰');
      },
      delpay: function (el) {
        var p = byId(o.payments, el.dataset.v);
        if (!p || !confirm('تحذف دفعة ' + fmt(p.amount) + '؟')) return;
        o.payments = o.payments.filter(function (x) { return x !== p; }); persist(); refresh();
      },
      qtask: function () {
        var v = $('qTask').value.trim(); if (!v) { $('qTask').focus(); return; }
        tasks.push({ id: uid(), title: v, date: today(), time: '', prio: 'low', orderId: o.id, note: '', done: false, created: Date.now() });
        persist(); refresh(); toast('تمت إضافة المهمة ✓');
      },
      share: function () { shareText(orderText(o), 'تفاصيل الطلب'); },
      cancel: function () { if (!confirm('تلغي هذا الأوردر؟')) return; o.status = 'cancel'; o.deliveredAt = ''; persist(); refresh(); },
      uncancel: function () { o.status = 'progress'; persist(); refresh(); }
    });
    var pa = $('payAmt'); if (pa) pa.addEventListener('input', liveAmount);
    var qt = $('qTask'); if (qt) qt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); acts.qtask(); } });
  }

  function orderText(o) {
    var c = clientOf(o), paid = paidOf(o), due = dueOf(o);
    var lines = ['مرحباً ' + c.name + ' 🌷', 'تفاصيل طلبك:', '',
      '📌 ' + o.title + ' (' + svcOf(o.service).name + ')',
      '📍 الحالة: ' + statusOf(o.status).name];
    if (o.deadline && isActive(o)) lines.push('📅 موعد التسليم: ' + dayTitle(parseYmd(o.deadline)));
    if (o.price) {
      lines.push('💰 السعر: ' + money(o.price));
      if (paid) lines.push('✅ المدفوع: ' + money(paid));
      lines.push(due > 0 ? '⏳ الباقي: ' + money(due) : '✔️ المبلغ مدفوع بالكامل، شكراً لك');
    }
    if (settings.name) lines.push('', settings.name);
    return lines.join('\n');
  }

  // --- نموذج العميل ---
  function openClientForm(c, after) {
    var d = c || { name: '', phone: '', note: '' };
    var html = '<form id="f" autocomplete="off"><div style="display:grid;gap:12px">' +
      '<div class="sheet-title"><h3>' + (c ? 'تعديل عميل' : 'عميل جديد') + '</h3></div>' +
      '<input id="fName" class="big-in" placeholder="اسم العميل أو البراند" maxlength="80" value="' + esc(d.name) + '">' +
      '<input id="fPhone" placeholder="رقم التلفون / واتساب" inputmode="tel" maxlength="20" value="' + esc(d.phone || '') + '">' +
      '<textarea id="fNote" placeholder="ملاحظات (انستغرام، العنوان، طريقة التعامل…)" maxlength="500">' + esc(d.note || '') + '</textarea>' +
      formBtns(c ? 'del' : '') + '</div></form>';
    openSheet(function () { openClientForm(c, after); }, html, {
      del: function () {
        var os = ordersOf(c);
        if (!confirm(os.length ? 'هذا العميل عنده ' + os.length + ' أوردر. راح تنحذف أوردراته هم. متأكد؟' : 'تحذف العميل "' + c.name + '"؟')) return;
        var ids = {}; os.forEach(function (o) { ids[o.id] = 1; });
        orders = orders.filter(function (o) { return !ids[o.id]; });
        tasks.forEach(function (t) { if (ids[t.orderId]) t.orderId = ''; });
        clients = clients.filter(function (x) { return x !== c; });
        persist(); closeSheet(); render(); toast('تم حذف العميل');
      }
    }, function () {
      var name = $('fName').value.trim();
      if (!name) { toast('اكتب اسم العميل'); $('fName').focus(); return; }
      var data = { name: name, phone: $('fPhone').value.trim(), note: $('fNote').value.trim() };
      if (c) { Object.assign(c, data); persist(); toast('تم التعديل ✓'); back(); render(); return; }
      data.id = uid(); data.created = Date.now(); clients.push(data); persist(); render();
      toast('تمت إضافة العميل ✓');
      sheetStack = []; openClientView(data);
    });
    if (!c) setTimeout(function () { var el = $('fName'); if (el) el.focus(); }, 150);
  }

  function waNumber(phone) {
    var p = String(phone || '').replace(/[٠-٩]/g, function (ch) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(ch); }).replace(/[^\d+]/g, '');
    if (p.indexOf('+') === 0) return p.slice(1);
    if (p.indexOf('00') === 0) return p.slice(2);
    if (p.indexOf('07') === 0 && p.length === 11) return '964' + p.slice(1); // رقم عراقي
    return p;
  }

  // --- عرض العميل ---
  function openClientView(c) {
    if (!byId(clients, c.id)) { back(); return; }
    var os = ordersOf(c).sort(function (a, b) { return (isActive(b) - isActive(a)) || b.created - a.created; });
    var total = os.reduce(function (s, o) { return s + (o.status === 'cancel' ? 0 : o.price || 0); }, 0);
    var paid = os.reduce(function (s, o) { return s + paidOf(o); }, 0);
    var due = os.reduce(function (s, o) { return s + dueOf(o); }, 0);
    var html = '<div class="sheet-title"><h3>👤 ' + esc(c.name) + '</h3><button class="link" data-act="edit">تعديل ✏️</button></div>' +
      (c.phone ? '<div class="contact-btns"><a class="btn ghost" href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">📞 اتصال</a>' +
        '<a class="btn ghost" href="https://wa.me/' + esc(waNumber(c.phone)) + '" target="_blank" rel="noopener">💬 واتساب</a></div>' : '') +
      (c.note ? '<div class="kv" style="white-space:pre-wrap">' + esc(c.note) + '</div>' : '') +
      '<div class="stats3"><div class="stat"><span>الأوردرات</span><b>' + os.length + '</b></div>' +
      '<div class="stat in"><span>المستلم</span><b>' + fmtShort(paid) + '</b></div>' +
      '<div class="stat out"><span>الباقي</span><b>' + fmtShort(due) + '</b></div></div>' +
      (total ? '<p class="muted-sm">إجمالي الشغل وياه: ' + money(total) + '</p>' : '') +
      '<div class="sec-h">أوردراته<button class="link" data-act="neworder">+ أوردر جديد</button></div>' +
      '<ul class="list">' + (os.length ? os.map(function (o) { return orderRow(o, false); }).join('') : '<li class="empty">ماكو أوردرات لهذا العميل بعد</li>') + '</ul>' +
      '<button class="btn ghost wide" data-act="back" style="margin-top:0">إغلاق</button>';
    openSheet(function () { openClientView(c); }, html, {
      edit: function () { nested(function () { openClientForm(c); }); },
      neworder: function () { nested(function () { openOrderForm(null, { clientId: c.id }); }); }
    });
  }

  // ---------- التنبيهات ----------
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  function plugin(name) {
    if (!Cap) return null;
    return (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin ? Cap.registerPlugin(name) : null);
  }
  var LN = isNative ? plugin('LocalNotifications') : null;
  var CHANNEL = 'daily-tasks';
  var lastNotifyState = '';

  function dailyBody(ds, includeOverdue) {
    var list = sortTasks(tasksOn(ds)).filter(function (t) { return !t.done; });
    var due = orders.filter(function (o) { return isActive(o) && o.deadline === ds; });
    var late = includeOverdue ? orders.filter(isLate) : [];
    var od = includeOverdue ? overdueTasks() : [];
    var lines = [];
    if (!list.length && !due.length && !late.length && !od.length) {
      lines.push('ما عندك مهام مسجّلة لليوم. خطّط يومك هسه حتى تبقى ماشي على الخطة ✍️');
      return lines.join('\n');
    }
    if (list.length) {
      lines.push('✅ ' + list.length + ' مهمة اليوم:');
      list.slice(0, 5).forEach(function (t) { lines.push('• ' + (t.time ? timeLabel(t.time) + ' ' : '') + t.title + (t.prio === 'high' ? ' 🔥' : '')); });
      if (list.length > 5) lines.push('… و' + (list.length - 5) + ' غيرها');
    }
    if (due.length) lines.push('🚚 تسليم اليوم: ' + due.map(function (o) { return o.title + ' (' + clientOf(o).name + ')'; }).join('، '));
    if (late.length) lines.push('⚠️ أوردرات متأخرة: ' + late.length);
    if (od.length) lines.push('⏰ مهام متأخرة من قبل: ' + od.length);
    return lines.join('\n');
  }

  function buildSchedule() {
    var list = [], now = new Date();
    if (settings.notify) {
      var hm = settings.notifyTime.split(':');
      for (var i = 0; i < 30; i++) {
        var day = addDays(now, i);
        var at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), +hm[0], +hm[1], 0);
        if (at <= now) continue;
        var ds = ymd(day), body = dailyBody(ds, list.length === 0);
        list.push({ id: +ds.replace(/-/g, ''), title: '☀️ مهامك — ' + dayTitle(day), body: body, at: at, extra: { date: ds } });
      }
    }
    if (settings.taskAlerts) {
      var limit = addDays(now, 30), n = 0;
      tasks.forEach(function (t) {
        if (t.done || !t.time || n >= 60) return;
        var p = t.time.split(':'), d = parseYmd(t.date);
        var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +p[0], +p[1], 0);
        if (at <= now || at > limit) return;
        var o = t.orderId ? byId(orders, t.orderId) : null;
        list.push({ id: 300000000 + (n++), title: '⏰ ' + t.title, body: o ? '📦 ' + o.title + ' — ' + clientOf(o).name : 'وقت المهمة هسه', at: at, extra: { date: t.date, task: t.id } });
      });
    }
    return list;
  }

  async function scheduleNotifications() {
    if (!isNative || !LN) { scheduleWeb(); return; }
    try {
      var pending = await LN.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(function (n) { return { id: n.id }; }) });
      }
      if (!settings.notify && !settings.taskAlerts) { lastNotifyState = 'off'; updateNotifyStatus(); return; }
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { lastNotifyState = 'denied'; updateNotifyStatus(); return; }
      var list = buildSchedule().map(function (n) {
        return { id: n.id, title: n.title, body: n.body.split('\n')[0] + (n.body.indexOf('\n') > 0 ? ' …' : ''), largeBody: n.body, channelId: CHANNEL, schedule: { at: n.at, allowWhileIdle: true }, extra: n.extra };
      });
      if (list.length) await LN.schedule({ notifications: list });
      lastNotifyState = 'ok';
    } catch (err) { console.error(err); lastNotifyState = 'error'; }
    updateNotifyStatus();
  }

  // نسخة الويب: التنبيه يوصل بس والتطبيق مفتوح أو بالخلفية بنفس الجلسة
  var webTimers = [];
  function scheduleWeb() {
    webTimers.forEach(clearTimeout); webTimers = [];
    if (!('Notification' in window)) { lastNotifyState = 'web-unsupported'; updateNotifyStatus(); return; }
    if (!settings.notify && !settings.taskAlerts) { lastNotifyState = 'off'; updateNotifyStatus(); return; }
    if (Notification.permission !== 'granted') { lastNotifyState = Notification.permission === 'denied' ? 'web-denied' : 'web-noperm'; updateNotifyStatus(); return; }
    var horizon = Date.now() + 24 * 3600 * 1000;
    buildSchedule().forEach(function (n) {
      var ms = n.at - Date.now();
      if (ms > 0 && n.at.getTime() < horizon) webTimers.push(setTimeout(function () { webNotify(n.title, n.body); }, ms));
    });
    lastNotifyState = 'web-ok'; updateNotifyStatus();
  }
  function webNotify(title, body) {
    var opts = { body: body, icon: 'apple-touch-icon.png', dir: 'rtl', lang: 'ar', tag: 'mahami-' + title };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, opts); }).catch(function () { try { new Notification(title, opts); } catch (e) { } });
    } else { try { new Notification(title, opts); } catch (e) { } }
  }

  function updateNotifyStatus() {
    var el = $('notifyStatus'); if (!el) return;
    var msg = {
      ok: '✅ التذكير مفعّل — راح يوصلك ملخص مهامك كل يوم الساعة ' + timeLabel(settings.notifyTime),
      off: '🔕 التذكير متوقف',
      denied: '⚠️ صلاحية الإشعارات مرفوضة. فعّلها من إعدادات التلفون ← التطبيقات ← مهامي ← الإشعارات',
      error: '⚠️ صار خطأ بجدولة التذكير، جرّب مرة ثانية',
      'web-ok': 'ℹ️ بنسخة المتصفح التذكير يوصل بس والتطبيق مفتوح. للتذكير الكامل ثبّت نسخة الأندرويد (APK).',
      'web-noperm': '🔔 اضغط «جرّب التذكير» حتى تسمح بالإشعارات.',
      'web-denied': '⚠️ الإشعارات مرفوضة بهذا المتصفح.',
      'web-unsupported': 'ℹ️ هذا المتصفح ما يدعم الإشعارات.'
    }[lastNotifyState] || '';
    if (!settings.notify && !settings.taskAlerts) msg = '🔕 التذكير متوقف';
    else if (!settings.notify && lastNotifyState === 'ok') msg = '✅ تذكير المهام اللي إلها وقت مفعّل (الملخص الصباحي متوقف)';
    el.textContent = msg;
  }

  async function testNotification() {
    var body = dailyBody(today(), true);
    var title = '☀️ مهامك اليوم (تجربة)';
    if (isNative && LN) {
      try {
        var perm = await LN.requestPermissions();
        if (perm.display !== 'granted') { toast('لازم تسمح بالإشعارات'); return; }
        await LN.schedule({ notifications: [{ id: 1, title: title, body: body.split('\n')[0], largeBody: body, channelId: CHANNEL, schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, extra: { date: today() } }] });
        toast('راح يوصلك إشعار تجريبي خلال ثواني');
      } catch (e) { toast('تعذّر إرسال الإشعار'); }
      return;
    }
    if (!('Notification' in window)) { toast('الإشعارات غير مدعومة هنا'); return; }
    var p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') { toast('لازم تسمح بالإشعارات'); scheduleWeb(); return; }
    webNotify(title, body); scheduleWeb();
  }

  async function setupNative() {
    if (!isNative || !LN) return;
    try {
      if (LN.createChannel) await LN.createChannel({ id: CHANNEL, name: 'تذكير المهام', description: 'ملخص مهامك وتسليماتك اليومية', importance: 4, visibility: 1, vibration: true });
    } catch (e) { }
    try {
      LN.addListener('localNotificationActionPerformed', function (ev) {
        var ex = ev && ev.notification && ev.notification.extra;
        selDay = (ex && ex.date) || today();
        showTab('home');
      });
    } catch (e) { }
    try {
      if (LN.checkExactNotificationSetting) {
        var ex = await LN.checkExactNotificationSetting();
        $('exactAlarm').hidden = ex.exact_alarm === 'granted';
      }
    } catch (e) { }
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
    var data = JSON.stringify({ app: 'mahami', version: 1, exported: new Date().toISOString(), settings: settings, clients: clients, orders: orders, tasks: tasks });
    var name = 'mahami-backup-' + today() + '.json';
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
        if (!d || d.app !== 'mahami' || !Array.isArray(d.orders)) throw new Error('bad');
        if (!confirm('بالنسخة: ' + (d.clients || []).length + ' عميل، ' + d.orders.length + ' أوردر، ' + (d.tasks || []).length + ' مهمة. المكرر ما ينضاف مرتين. نكمل؟')) return;
        var added = 0;
        function merge(target, src) {
          var ids = {}; target.forEach(function (x) { ids[x.id] = 1; });
          (src || []).forEach(function (x) { if (x && x.id && !ids[x.id]) { target.push(x); added++; } });
        }
        merge(clients, d.clients); merge(orders, d.orders); merge(tasks, d.tasks);
        if (d.settings && Array.isArray(d.settings.services)) {
          var have = {}; settings.services.forEach(function (c) { have[c.id] = 1; });
          d.settings.services.forEach(function (c) { if (c && c.id && !have[c.id]) settings.services.push(c); });
          save(KEY.settings, settings);
        }
        persist(); render(); toast('تمت إضافة ' + added + ' عنصر ✓');
      } catch (e) { toast('الملف غير صالح'); }
    };
    reader.readAsText(file);
  }

  // ---------- الأحداث ----------
  function toggleTask(id) {
    var t = byId(tasks, id); if (!t) return;
    t.done = !t.done; t.doneAt = t.done ? today() : '';
    persist();
    if (t.done) {
      var left = tasksOn(today()).filter(function (x) { return !x.done; }).length;
      toast(t.date === today() && left === 0 ? 'خلّصت كل مهام اليوم 🎉' : 'عاشت إيدك ✓');
    }
    refresh();
  }

  function bind() {
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
    document.querySelector('[data-tab-btn="settings"]').addEventListener('click', function () { showTab('settings'); });

    document.addEventListener('click', function (e) {
      var inSheet = e.target.closest('#sheetBody');
      var tg = e.target.closest('[data-toggle]');
      if (tg) { e.preventDefault(); toggleTask(tg.dataset.toggle); return; }
      if (inSheet) {
        var a = e.target.closest('[data-act]');
        if (a) {
          e.preventDefault();
          if (a.dataset.act === 'back') back();
          else if (acts[a.dataset.act]) acts[a.dataset.act](a);
          return;
        }
        var opt = e.target.closest('[data-opt] button');
        if (opt) { opt.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === opt); }); return; }
      }
      var g = e.target.closest('[data-goto]');
      if (g) { showTab(g.dataset.goto); return; }
      var dd = e.target.closest('[data-day]');
      if (dd) { selDay = dd.dataset.day; renderHome(); return; }
      var sh = e.target.closest('[data-shift]');
      if (sh) { selDay = ymd(addDays(parseYmd(selDay), +sh.dataset.shift)); renderHome(); return; }
      var tr = e.target.closest('[data-task]');
      if (tr) { var t = byId(tasks, tr.dataset.task); if (t) { if (inSheet) nested(function () { openTaskForm(t); }); else { sheetStack = []; openTaskForm(t); } } return; }
      var or = e.target.closest('[data-order]');
      if (or) { var o = byId(orders, or.dataset.order); if (o) { if (inSheet) nested(function () { openOrderView(o); }); else { sheetStack = []; openOrderView(o); } } return; }
      var cr = e.target.closest('[data-client]');
      if (cr) { var c = byId(clients, cr.dataset.client); if (c) { sheetStack = []; openClientView(c); } }
    });
    $('sheetBody').addEventListener('submit', function (e) { e.preventDefault(); if (onSubmit) onSubmit(); });
    $('sheetBackdrop').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });

    $('fab').addEventListener('click', function () {
      if (currentTab === 'orders') { sheetStack = []; openOrderForm(null, {}); }
      else if (currentTab === 'clients') { sheetStack = []; openClientForm(null); }
      else openChooser();
    });
    $('addTaskQuick').addEventListener('click', function () { sheetStack = []; openTaskForm(null, { date: selDay }); });
    $('addClientBtn').addEventListener('click', function () { sheetStack = []; openClientForm(null); });

    $('orderSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; orderFilter = b.dataset.f; renderOrders(); });
    $('orderSearch').addEventListener('input', renderOrders);
    $('clientSearch').addEventListener('input', renderClients);

    $('periodSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; rKind = b.dataset.p; renderReports(); });
    $('prevPeriod').addEventListener('click', function () { rAnchor = shiftAnchor(rKind, rAnchor, -1); renderReports(); });
    $('nextPeriod').addEventListener('click', function () { var n = shiftAnchor(rKind, rAnchor, 1); rAnchor = n > today() ? today() : n; renderReports(); });
    $('shareReport').addEventListener('click', function () { shareText(reportText(), 'تقرير مهامي'); });

    $('sName').addEventListener('change', function () { settings.name = this.value.trim(); persistSettings(); render(); });
    $('sCurrency').addEventListener('change', function () { settings.currency = this.value.trim() || 'د.ع'; persistSettings(); });
    $('sWeekStart').addEventListener('change', function () { settings.weekStart = +this.value; persistSettings(); });
    $('sNotify').addEventListener('change', function () { settings.notify = this.checked; persistSettings(); });
    $('sTaskAlerts').addEventListener('change', function () { settings.taskAlerts = this.checked; persistSettings(); });
    $('sTime').addEventListener('change', function () { if (this.value) { settings.notifyTime = this.value; persistSettings(); } });
    $('testNotify').addEventListener('click', testNotification);
    $('exactAlarm').addEventListener('click', async function () { try { await LN.changeExactNotificationSetting(); } catch (e) { } });

    $('addSvc').addEventListener('click', function () {
      var name = $('newSvcName').value.trim();
      if (!name) { toast('اكتب اسم النوع'); return; }
      settings.services.push({ id: 's_' + uid(), name: name, icon: $('newSvcIcon').value.trim() || '🎨' });
      $('newSvcName').value = ''; $('newSvcIcon').value = '';
      persistSettings(); renderSettings(); toast('تمت الإضافة ✓');
    });
    $('svcChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-svc]'); if (!b) return;
      if (settings.services.length <= 1) { toast('لازم يبقى نوع واحد على الأقل'); return; }
      var s = svcOf(b.dataset.delSvc);
      if (!confirm('تحذف نوع "' + s.name + '"؟ الأوردرات القديمة تبقى.')) return;
      settings.services = settings.services.filter(function (x) { return x.id !== s.id; });
      persistSettings(); renderSettings();
    });

    $('exportBtn').addEventListener('click', exportBackup);
    $('importFile').addEventListener('change', function () { if (this.files[0]) importBackup(this.files[0]); this.value = ''; });
    $('wipeBtn').addEventListener('click', function () {
      if (!confirm('راح تنحذف كل العملاء والأوردرات والمهام نهائياً. متأكد؟')) return;
      if (!confirm('تأكيد أخير: حذف كل البيانات؟')) return;
      clients = []; orders = []; tasks = []; persist(); render(); toast('تم حذف البيانات');
    });

    var lastDay = today();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (lastDay !== today()) { if (selDay === lastDay) selDay = today(); lastDay = today(); }
      render(); scheduleNotifications();
    });
    var App = isNative ? plugin('App') : null;
    if (App) {
      try {
        App.addListener('backButton', function () {
          if (!$('sheetBackdrop').hidden) back();
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
  if ('serviceWorker' in navigator && !isNative && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
})();
