// Service worker لمهامي: يشغّل التطبيق بدون إنترنت
var CACHE = 'mahami-v6';
var FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-512.png', './apple-touch-icon.png', './fonts/plex-arabic-300.woff2', './fonts/plex-arabic-500.woff2', './fonts/plex-arabic-700.woff2', './fonts/plex-latin-300.woff2', './fonts/plex-latin-500.woff2', './fonts/plex-latin-700.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || e.request.url.indexOf('/api/') !== -1) return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match('./index.html'); });
  }));
});
// ---------- قراءة البيانات من IndexedDB ----------
function idbGet(key) {
  return new Promise(function (resolve) {
    try {
      var req = indexedDB.open('mahami', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onerror = function () { resolve(null); };
      req.onsuccess = function () {
        try {
          var g = req.result.transaction('kv').objectStore('kv').get(key);
          g.onsuccess = function () { resolve(g.result || null); req.result.close(); };
          g.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      };
    } catch (e) { resolve(null); }
  });
}

// ---------- نص التذكير ----------
var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function timeLabel(t) { var p = t.split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + ' ' + (h < 12 ? 'ص' : 'م'); }
function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
var PR = { high: 0, mid: 1, low: 2 };

function dailyMsg(data, ds) {
  var tasks = data.tasks || [], orders = data.orders || [], clients = data.clients || [];
  var active = function (o) { return o.status !== 'done' && o.status !== 'cancel'; };
  var cname = function (o) { var c = find(clients, o.clientId); return c ? c.name : ''; };
  var list = tasks.filter(function (t) { return t.date === ds && !t.done; })
    .sort(function (a, b) { return ((PR[a.prio] || 2) - (PR[b.prio] || 2)) || (a.time || '99').localeCompare(b.time || '99'); });
  var due = orders.filter(function (o) { return active(o) && o.deadline === ds; });
  var late = orders.filter(function (o) { return active(o) && o.deadline && o.deadline < ds; });
  var od = tasks.filter(function (t) { return !t.done && t.date < ds; });
  var lines = [];
  if (!list.length && !due.length && !late.length && !od.length) return 'ما عندك مهام مسجّلة لليوم. خطّط يومك هسه حتى تبقى ماشي على الخطة ✍️';
  if (list.length) {
    lines.push('✅ ' + list.length + ' مهمة اليوم:');
    list.slice(0, 5).forEach(function (t) { lines.push('• ' + (t.time ? timeLabel(t.time) + ' ' : '') + t.title + (t.prio === 'high' ? ' 🔥' : '')); });
    if (list.length > 5) lines.push('… و' + (list.length - 5) + ' غيرها');
  }
  if (due.length) lines.push('🚚 تسليم اليوم: ' + due.map(function (o) { return o.title + (cname(o) ? ' (' + cname(o) + ')' : ''); }).join('، '));
  if (late.length) lines.push('⚠️ أوردرات متأخرة: ' + late.length);
  if (od.length) lines.push('⏰ مهام متأخرة من قبل: ' + od.length);
  return lines.join('\n');
}

function show(title, body, tag, date) {
  return self.registration.showNotification(title, {
    body: body, icon: 'apple-touch-icon.png', badge: 'apple-touch-icon.png',
    dir: 'rtl', lang: 'ar', tag: tag, renotify: true, data: { date: date }
  });
}

self.addEventListener('push', function (e) {
  var msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch (err) { msg = {}; }
  e.waitUntil(idbGet('data').then(function (data) {
    data = data || {};
    if (msg.type === 'task') {
      var at = new Date(msg.at), ds = ymd(at), t = hm(at);
      var due = (data.tasks || []).filter(function (x) { return !x.done && x.date === ds && x.time === t; });
      if (!due.length) return; // المهمة انحذفت أو خلصت — ما نزعجك
      var o = due[0].orderId ? find(data.orders || [], due[0].orderId) : null;
      return show('⏰ ' + due.map(function (x) { return x.title; }).join('، '), o ? '📦 ' + o.title : 'وقت المهمة هسه', 'mahami-task-' + msg.at, ds);
    }
    var now = new Date(), today = ymd(now);
    var title = '☀️ مهامك — ' + DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()];
    if (msg.type === 'test') title += ' (تجربة)';
    return show(title, dailyMsg(data, today), 'mahami-daily', today);
  }).catch(function () {
    return show('☀️ مهامك اليوم', 'اضغط حتى تشوف مهام اليوم', 'mahami-daily', '');
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var d = e.notification.data && e.notification.data.date;
  var url = new URL('./index.html' + (d ? '?day=' + d : ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) {
      if ('focus' in cl[i]) { cl[i].navigate && cl[i].navigate(url).catch(function () { }); return cl[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
