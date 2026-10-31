// Service worker لمصروفي: يشغّل التطبيق بدون إنترنت، ويعرض إشعار التقرير اليومي
// لما يوصل تنبيه (push) من السيرفر. التقرير يُحسب هنا من بيانات التلفون نفسه.
var CACHE = 'masrufi-v3';
var FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-512.png', './apple-touch-icon.png'];

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
      var req = indexedDB.open('masrufi', 1);
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

// ---------- حساب التقرير ----------
var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
function sum(txs, from, to) {
  var r = { in: 0, out: 0, cats: {} };
  txs.forEach(function (t) {
    if (t.date < from || t.date > to) return;
    r[t.type] += t.amount;
    if (t.type === 'out') r.cats[t.cat] = (r.cats[t.cat] || 0) + t.amount;
  });
  r.net = r.in - r.out;
  return r;
}

function buildReport(txs, st, dateStr) {
  var cur = (st && st.currency) || 'د.ع';
  var cats = (st && st.cats) || [];
  var weekStart = st && st.weekStart != null ? st.weekStart : 6;
  var d = parseYmd(dateStr);
  var t = sum(txs, dateStr, dateStr);
  var lines = [];
  if (t.in === 0 && t.out === 0) {
    lines.push('ما سجّلت أي عملية اليوم. صرفت شي؟ سجّله هسه حتى يبقى حسابك مضبوط ✍️');
  } else {
    lines.push('🟢 وارد ' + fmt(t.in) + ' • 🔴 مصروف ' + fmt(t.out) + ' ' + cur);
    lines.push('⚖️ الصافي: ' + signed(t.net) + ' ' + cur);
    var top = Object.keys(t.cats).sort(function (a, b) { return t.cats[b] - t.cats[a]; })[0];
    if (top) {
      var c = cats.filter(function (x) { return x.id === top; })[0] || { name: 'غير مصنّف', icon: '❔' };
      lines.push('أكثر صرف: ' + c.icon + ' ' + c.name + ' (' + fmt(t.cats[top]) + ')');
    }
  }
  var ws = addDays(d, -((d.getDay() - weekStart + 7) % 7));
  if (ymd(addDays(ws, 6)) === dateStr) {
    var w = sum(txs, ymd(ws), dateStr);
    lines.push('📅 الأسبوع: وارد ' + fmt(w.in) + ' • مصروف ' + fmt(w.out) + ' • صافي ' + signed(w.net));
  }
  if (addDays(d, 1).getDate() === 1) {
    var m = sum(txs, ymd(new Date(d.getFullYear(), d.getMonth(), 1)), dateStr);
    lines.push('🗓️ الشهر: وارد ' + fmt(m.in) + ' • مصروف ' + fmt(m.out) + ' • صافي ' + signed(m.net));
  }
  return {
    title: '📊 تقريرك اليومي — ' + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()],
    body: lines.join('\n')
  };
}

self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = {}; }
  e.waitUntil(Promise.all([idbGet('txs'), idbGet('settings')]).then(function (res) {
    var today = ymd(new Date());
    var rep = buildReport(Array.isArray(res[0]) ? res[0] : [], res[1], today);
    if (data.type === 'test') rep.title = rep.title.replace('تقريرك اليومي', 'تقريرك اليومي (تجربة)');
    return self.registration.showNotification(rep.title, {
      body: rep.body, icon: 'apple-touch-icon.png', badge: 'apple-touch-icon.png',
      dir: 'rtl', lang: 'ar', tag: 'masrufi-daily', renotify: true, data: { date: today }
    });
  }).catch(function () {
    return self.registration.showNotification('📊 تقريرك اليومي', { body: 'اضغط حتى تشوف تقرير اليوم', tag: 'masrufi-daily' });
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL('./index.html?report=day', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) {
      if ('focus' in cl[i]) { cl[i].navigate && cl[i].navigate(url).catch(function () { }); return cl[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
