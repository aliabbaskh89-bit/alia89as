/* Run: node test/ui.test.js [outDir] — opens the panel in Chromium (outside Premiere), screenshots every tool,
   fails on console errors, and renders template frames through ffmpeg to validate the alpha encode. */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync, spawn } = require('child_process');

const out = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'alikit-ui-'));
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, '00-home-ar.png'), fullPage: true });

  const tools = await page.evaluate(() => AK.toolList.map(t => t.id));
  for (const id of tools) {
    if (id === 'tpl-edit') continue;
    await page.evaluate(id => AK.openTool(id), id);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `tool-${id}.png`), fullPage: true });
  }
  // template editor for each template
  const ids = await page.evaluate(() => AK.templates.map(t => t.id));
  await page.evaluate(() => AK.openTool('tpl-edit', { tpl: AK.templates[0] }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'tpl-editor.png'), fullPage: true });

  // English home
  await page.evaluate(() => { AK.settings.lang = 'en'; document.documentElement.dir = 'ltr'; AK.showHome(); });
  await page.screenshot({ path: path.join(out, '01-home-en.png'), fullPage: true });
  await page.evaluate(() => { AK.settings.lang = 'ar'; document.documentElement.dir = 'rtl'; });

  // contact sheet of every template at 3 moments (1080x1920 drawn, downscaled)
  const sheet = await page.evaluate(async () => {
    const W = 270, H = 480, ts = [0.25, 0.55, 0.9];
    const all = AK.templates;
    const c = document.createElement('canvas');
    c.width = W * ts.length * 2; c.height = H * Math.ceil(all.length / 2);
    const ctx = c.getContext('2d');
    all.forEach((tpl, i) => {
      const p = AK.templateDefaults(tpl);
      ts.forEach((f, j) => {
        const x = ((i % 2) * ts.length + j) * W, y = Math.floor(i / 2) * H;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, W, H); ctx.clip(); ctx.translate(x, y);
        AK.previewBg(ctx, W, H);
        tpl.draw(ctx, f * tpl.dur, p, W, H);
        ctx.restore();
        ctx.strokeStyle = '#000'; ctx.strokeRect(x, y, W, H);
      });
      ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.fillText(tpl.id, (i % 2) * ts.length * W + 8, Math.floor(i / 2) * H + 22);
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(out, 'templates-sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));

  // captions preview sheet: each style at a few times
  const capSheet = await page.evaluate(() => {
    const styles = ['pop', 'karaoke', 'word', 'box', 'glass', 'thinbold', 'minimal'];
    const W = 270, H = 480, c = document.createElement('canvas');
    c.width = W * styles.length; c.height = H;
    const ctx = c.getContext('2d');
    const chunk = { start: 0, end: 3, words: [{ text: 'x', start: 0, end: 2.6 }] };
    AK.captions.retext(chunk, 'هلا بيكم بالحلقة الجديدة');
    styles.forEach((s, i) => {
      const st = Object.assign(AK.captions.defaults(), { style: s, y: 0.5 });
      ctx.save(); ctx.beginPath(); ctx.rect(i * W, 0, W, H); ctx.clip(); ctx.translate(i * W, 0);
      AK.previewBg(ctx, W, H);
      AK.captions.draw(ctx, 1.4, [chunk], st, W, H);
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '700 16px sans-serif'; ctx.fillText(s, i * W + 8, 20);
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(out, 'captions-sheet.png'), Buffer.from(capSheet.split(',')[1], 'base64'));

  // render 2s of one template at full 1080x1920 → raw RGBA → ffmpeg with the same args the panel uses
  const W = 1080, H = 1920, fps = 30, dur = 1.0;
  for (const codec of ['prores', 'qtrle']) {
    const file = path.join(out, `render-${codec}.mov`);
    const vcodec = codec === 'qtrle' ? ['-c:v', 'qtrle', '-pix_fmt', 'argb']
      : ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0'];
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', ...vcodec, '-r', String(fps), file]);
    let err = ''; p.stderr.on('data', d => err += d);
    for (let f = 0; f < dur * fps; f++) {
      const b64 = await page.evaluate(([t, W, H]) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const tpl = AK.templates.find(x => x.id === 'subscribe');
        tpl.draw(ctx, t, AK.templateDefaults(tpl), W, H);
        const d = ctx.getImageData(0, 0, W, H).data;
        let s = ''; const CH = 0x8000;
        for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
        return btoa(s);
      }, [f / fps * 2, W, H]);
      if (!p.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => p.stdin.once('drain', r));
    }
    p.stdin.end();
    await new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(new Error(err))));
    const info = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt,width,height,nb_frames', '-of', 'csv=p=0', file]).toString().trim();
    console.log(codec, '→', info, (fs.statSync(file).size / 1e6).toFixed(1) + 'MB');
    if (!/yuva|argb/.test(info)) throw new Error('no alpha channel in ' + codec);
  }
  // extract a frame with alpha composited over red to visually check transparency
  const f25 = path.join(out, 'frame25.png');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(out, 'render-prores.mov'), '-vf', 'select=eq(n\\,25)', '-frames:v', '1', '-pix_fmt', 'rgba', f25]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=1080x1920', '-i', f25,
    '-filter_complex', '[0][1]overlay,scale=270:-2', '-frames:v', '1', path.join(out, 'alpha-check.png')]);

  await browser.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('UI OK — screenshots in', out);
})().catch(e => { console.error(e); process.exit(1); });
