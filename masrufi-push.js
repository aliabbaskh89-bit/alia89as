// ─── مصروفي: تطبيق المصروفات (/masrufi) + إشعار التقرير اليومي عبر Web Push ───
// البيانات المالية تبقى على تلفون المستخدم فقط؛ السيرفر يحفظ بس اشتراك الإشعار ووقته،
// ويرسل "تنبيه" بالوقت المحدد، والتلفون نفسه يحسب التقرير ويعرضه.
const fs      = require('fs');
const path    = require('path');
const express = require('express');

module.exports = function mountMasrufi(app, dataDir) {
    const webDir = path.join(__dirname, 'expenses-app', 'web');

    // لا نكشف ملفات المشروع الداخلية (مفتاح التوقيع، المكتبات...) — فقط الواجهة عبر /masrufi
    app.use('/expenses-app', (_req, res) => res.status(404).end());
    app.use('/masrufi', express.static(webDir, {
        setHeaders(res, filePath) {
            if (/sw\.js$/.test(filePath)) res.setHeader('Service-Worker-Allowed', '/masrufi/');
            if (/\.(html|js|css|webmanifest)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
        }
    }));

    let webpush;
    try { webpush = require('web-push'); }
    catch (e) {
        console.warn('⚠️ [masrufi] web-push غير مثبت — إشعارات مصروفي متوقفة (npm install web-push)');
        app.use('/masrufi/api', (_req, res) => res.status(503).json({ error: 'push-disabled' }));
        return;
    }

    // ── مفاتيح VAPID (من المتغيرات أو تُولَّد مرة وحدة وتنحفظ) ──
    const keysFile = path.join(dataDir, 'masrufi_vapid.json');
    let vapid = null;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
        try { vapid = JSON.parse(fs.readFileSync(keysFile, 'utf8')); } catch (e) { }
        if (!vapid || !vapid.publicKey) {
            vapid = webpush.generateVAPIDKeys();
            try { fs.writeFileSync(keysFile, JSON.stringify(vapid)); } catch (e) { }
        }
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@alia89as.com', vapid.publicKey, vapid.privateKey);

    // ── الاشتراكات ──
    const subsFile = path.join(dataDir, 'masrufi_subs.json');
    let subs = {};
    try { subs = JSON.parse(fs.readFileSync(subsFile, 'utf8')) || {}; } catch (e) { subs = {}; }
    function saveSubs() {
        try {
            fs.writeFileSync(subsFile + '.tmp', JSON.stringify(subs));
            fs.renameSync(subsFile + '.tmp', subsFile);
        } catch (e) { console.error('[masrufi] save subs failed', e.message); }
    }

    function validTz(tz) {
        try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
    }
    // يرجّع التاريخ والوقت المحلي للمستخدم: { date: 'YYYY-MM-DD', hm: 'HH:MM' }
    function localNow(tz, now) {
        const parts = {};
        new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(now).forEach(p => { parts[p.type] = p.value; });
        return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` };
    }

    const api = express.Router();
    api.get('/vapid', (_req, res) => res.json({ publicKey: vapid.publicKey }));

    api.post('/subscribe', (req, res) => {
        const { subscription, time, tz, enabled } = req.body || {};
        if (!subscription || typeof subscription.endpoint !== 'string' || !/^https:\/\//.test(subscription.endpoint)
            || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
            return res.status(400).json({ error: 'bad subscription' });
        }
        if (Object.keys(subs).length > 5000 && !subs[subscription.endpoint]) return res.status(429).json({ error: 'full' });
        const prev = subs[subscription.endpoint] || {};
        subs[subscription.endpoint] = {
            subscription: { endpoint: subscription.endpoint, keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) } },
            time: /^\d{2}:\d{2}$/.test(time) ? time : '23:00',
            tz: validTz(tz) ? tz : 'Asia/Baghdad',
            enabled: enabled !== false,
            lastSent: prev.lastSent || null,
            updated: Date.now()
        };
        saveSubs();
        res.json({ ok: true });
    });

    api.post('/unsubscribe', (req, res) => {
        const ep = req.body && req.body.endpoint;
        if (ep && subs[ep]) { delete subs[ep]; saveSubs(); }
        res.json({ ok: true });
    });

    api.post('/test', async (req, res) => {
        const ep = req.body && req.body.endpoint;
        const s = ep && subs[ep];
        if (!s) return res.status(404).json({ error: 'not subscribed' });
        try {
            await webpush.sendNotification(s.subscription, JSON.stringify({ type: 'test' }), { TTL: 600, urgency: 'high' });
            res.json({ ok: true });
        } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) { delete subs[ep]; saveSubs(); }
            res.status(502).json({ error: 'push failed', status: e.statusCode || null });
        }
    });
    app.use('/masrufi/api', api);

    // ── المجدول: كل 30 ثانية يشوف منو وصل وقته ──
    let running = false;
    async function tick() {
        if (running) return;
        running = true;
        try {
            const now = new Date();
            let changed = false;
            for (const [ep, s] of Object.entries(subs)) {
                if (!s.enabled) continue;
                let local;
                try { local = localNow(s.tz, now); } catch (e) { continue; }
                // نرسل إذا وصل الوقت (أو فات بأقل من ساعة بسبب إعادة تشغيل السيرفر) وما انرسل اليوم
                if (local.hm < s.time || s.lastSent === local.date) continue;
                const [h, m] = s.time.split(':').map(Number);
                const [lh, lm] = local.hm.split(':').map(Number);
                if ((lh * 60 + lm) - (h * 60 + m) > 60) { s.lastSent = local.date; changed = true; continue; }
                s.lastSent = local.date; changed = true;
                try {
                    await webpush.sendNotification(s.subscription, JSON.stringify({ type: 'daily', date: local.date }), { TTL: 3 * 3600, urgency: 'high' });
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) delete subs[ep];
                    else console.error('[masrufi] push error', e.statusCode || e.message);
                }
            }
            if (changed) saveSubs();
        } catch (e) {
            console.error('[masrufi] scheduler error', e);
        } finally { running = false; }
    }
    setInterval(tick, 30 * 1000).unref();
    console.log(`💸 مصروفي: /masrufi (${Object.keys(subs).length} اشتراك إشعار)`);
};
