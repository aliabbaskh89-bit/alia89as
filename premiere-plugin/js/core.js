/* Ali Kit — core: Premiere bridge, Node helpers, ffmpeg, HTTP, settings. */
(function (global) {
  'use strict';

  var hasNode = typeof require === 'function';
  var fs = hasNode ? require('fs') : null;
  var path = hasNode ? require('path') : null;
  var os = hasNode ? require('os') : null;
  var cp = hasNode ? require('child_process') : null;
  var https = hasNode ? require('https') : null;
  var http = hasNode ? require('http') : null;
  var urlMod = hasNode ? require('url') : null;

  var AK = global.AK = global.AK || {};
  AK.hasNode = hasNode;
  AK.inPremiere = !!(global.__adobe_cep__);

  /* ---------------- Premiere bridge ---------------- */
  AK.host = function (fn, args) {
    return new Promise(function (resolve, reject) {
      if (!AK.inPremiere) return reject(new Error('NOT_IN_PREMIERE'));
      var script = fn + '(' + JSON.stringify(JSON.stringify(args || {})) + ')';
      global.__adobe_cep__.evalScript(script, function (res) {
        if (res === 'EvalScript error.' || res === undefined) return reject(new Error('EvalScript error: ' + fn));
        var data;
        try { data = JSON.parse(res); } catch (e) { return reject(new Error('Bad host reply: ' + res)); }
        if (!data.ok) return reject(new Error(data.error || 'host error'));
        resolve(data);
      });
    });
  };
  AK.extensionPath = function () {
    if (AK.inPremiere) return global.__adobe_cep__.getSystemPath('extension').replace(/^file:\/\//, '');
    return hasNode ? path.resolve(__dirname || '.') : '.';
  };

  /* ---------------- settings ---------------- */
  var defaults = {
    lang: 'ar',
    ffmpeg: '', ytdlp: '',
    elevenlabsKey: '', openaiKey: '', pexelsKey: '', removebgKey: '',
    sttProvider: 'elevenlabs',
    alphaCodec: 'prores', // prores | qtrle
    mediaDir: ''
  };
  function settingsFile() {
    var base = os.platform() === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'AliKit')
      : path.join(os.homedir(), '.alikit');
    mkdirp(base);
    return path.join(base, 'settings.json');
  }
  AK.settings = Object.assign({}, defaults);
  AK.loadSettings = function () {
    if (!hasNode) {
      try { Object.assign(AK.settings, JSON.parse(localStorage.getItem('alikit') || '{}')); } catch (e) {}
      return AK.settings;
    }
    try { Object.assign(AK.settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {}
    return AK.settings;
  };
  AK.saveSettings = function () {
    if (!hasNode) { try { localStorage.setItem('alikit', JSON.stringify(AK.settings)); } catch (e) {} return; }
    fs.writeFileSync(settingsFile(), JSON.stringify(AK.settings, null, 2));
  };

  /* ---------------- filesystem ---------------- */
  function mkdirp(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); return d; }
  AK.mkdirp = mkdirp;
  AK.mediaDir = function (sub) {
    var base = (AK.settings.mediaDir || '').replace(/^~(?=$|[\\/])/, os.homedir()) || path.join(os.homedir(), 'Documents', 'Ali Kit Media');
    return mkdirp(sub ? path.join(base, sub) : base);
  };
  AK.tmpDir = function () { return mkdirp(path.join(os.tmpdir(), 'alikit')); };
  AK.stamp = function () {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  };
  AK.safeName = function (s) { return String(s || 'file').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 60) || 'file'; };

  /* ---------------- external binaries ---------------- */
  function findBin(name, configured) {
    var cands = [];
    if (configured) cands.push(configured.replace(/^~(?=$|[\\/])/, os.homedir()));
    cands.push(path.join(AK.extensionPath(), 'bin', name));
    cands.push('/opt/homebrew/bin/' + name, '/usr/local/bin/' + name, '/usr/bin/' + name);
    if (os.platform() === 'win32') cands.push(path.join(AK.extensionPath(), 'bin', name + '.exe'), 'C:\\ffmpeg\\bin\\' + name + '.exe');
    for (var i = 0; i < cands.length; i++) { try { if (cands[i] && fs.existsSync(cands[i])) return cands[i]; } catch (e) {} }
    return null;
  }
  AK.ffmpegPath = function () { return findBin('ffmpeg', AK.settings.ffmpeg); };
  AK.ffprobePath = function () { var f = AK.ffmpegPath(); return f ? (findBin('ffprobe', f.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'))) : null; };
  AK.ytdlpPath = function () { return findBin('yt-dlp', AK.settings.ytdlp); };

  /* run a binary, collect stdout/stderr; onLine(stderrLine) for progress */
  AK.run = function (bin, args, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (!bin) return reject(new Error('BINARY_NOT_FOUND'));
      var env = Object.assign({}, process.env, { PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + (process.env.PATH || '') });
      var p = cp.spawn(bin, args, { env: env });
      var out = [], err = '';
      p.stdout.on('data', function (d) { if (opts.onStdout) opts.onStdout(d); else out.push(d); });
      p.stderr.on('data', function (d) {
        var s = d.toString(); err += s;
        if (err.length > 200000) err = err.slice(-100000);
        if (opts.onLine) s.split(/\r|\n/).forEach(function (l) { if (l) opts.onLine(l); });
      });
      p.on('error', reject);
      p.on('close', function (code) {
        if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
        else reject(new Error((opts.name || path.basename(bin)) + ' failed (' + code + '): ' + err.split('\n').slice(-6).join('\n')));
      });
      if (opts.proc) opts.proc(p);
    });
  };
  AK.ffmpeg = function (args, opts) {
    var f = AK.ffmpegPath();
    if (!f) return Promise.reject(new Error(AK.t('err.ffmpeg')));
    return AK.run(f, ['-hide_banner', '-y'].concat(args), opts);
  };
  /* ffmpeg progress: parse "time=00:00:12.34" against a known duration */
  AK.ffProgress = function (dur, cb) {
    return function (line) {
      var m = /time=(\d+):(\d+):(\d+\.?\d*)/.exec(line);
      if (m && dur > 0) cb(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / dur));
    };
  };
  AK.probeDuration = function (file) {
    return AK.ffmpeg(['-i', file]).catch(function (e) { return { stderr: String(e.message) }; }).then(function (r) {
      var m = /Duration: (\d+):(\d+):(\d+\.?\d*)/.exec(r.stderr);
      return m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0;
    });
  };

  /* ---------------- audio analysis ---------------- */
  /* decode a range of a file to mono float32 PCM at `rate` Hz */
  AK.decodeAudio = function (file, start, dur, rate) {
    rate = rate || 8000;
    var args = [];
    if (start) args.push('-ss', String(start));
    args.push('-i', file);
    if (dur) args.push('-t', String(dur));
    args.push('-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-');
    return AK.ffmpeg(args).then(function (r) {
      var b = r.stdout;
      return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
    });
  };
  /* RMS in dBFS per window */
  AK.rmsWindows = function (samples, rate, win) {
    var n = Math.max(1, Math.round(rate * win));
    var out = new Float32Array(Math.ceil(samples.length / n));
    for (var w = 0; w < out.length; w++) {
      var s = 0, c = 0;
      for (var i = w * n; i < Math.min(samples.length, (w + 1) * n); i++) { s += samples[i] * samples[i]; c++; }
      var rms = Math.sqrt(s / Math.max(1, c));
      out[w] = rms > 0 ? 20 * Math.log10(rms) : -120;
    }
    return out;
  };

  /*
   * Build an RMS timeline (dB per `win` sec) for a whole sequence track from its clips.
   * clips: [{start,end,inPoint,path}]  ->  Float32Array covering [0, totalEnd]
   */
  AK.trackLoudness = function (clips, win, onProgress) {
    var total = 0;
    clips.forEach(function (c) { total = Math.max(total, c.end); });
    var arr = new Float32Array(Math.ceil(total / win) + 1).fill(-120);
    var i = 0;
    function next() {
      if (i >= clips.length) return Promise.resolve(arr);
      var c = clips[i++];
      if (!c.path || c.disabled) return next();
      var dur = c.end - c.start;
      return AK.decodeAudio(c.path, c.inPoint, dur, 8000).then(function (smp) {
        var w = AK.rmsWindows(smp, 8000, win);
        var off = Math.round(c.start / win);
        for (var k = 0; k < w.length && off + k < arr.length; k++) arr[off + k] = Math.max(arr[off + k], w[k]);
        if (onProgress) onProgress(i / clips.length);
        return next();
      }).catch(function () { return next(); });
    }
    return next();
  };

  /* Mix all clips of a track into one timeline-aligned audio file (for transcription) */
  AK.timelineAudio = function (clips, outFile, opts) {
    opts = opts || {};
    clips = clips.filter(function (c) { return c.path && !c.disabled; });
    if (!clips.length) return Promise.reject(new Error(AK.t('err.noClips')));
    var t0 = opts.from || 0;
    var args = [], filters = [], labels = [];
    clips.forEach(function (c, k) {
      args.push('-ss', String(c.inPoint), '-t', String(c.end - c.start), '-i', c.path);
      var delay = Math.max(0, Math.round((c.start - t0) * 1000));
      filters.push('[' + k + ':a]aresample=16000,aformat=channel_layouts=mono,adelay=' + delay + '|' + delay + '[a' + k + ']');
      labels.push('[a' + k + ']');
    });
    filters.push(labels.join('') + 'amix=inputs=' + clips.length + ':normalize=0:dropout_transition=0[out]');
    args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-ac', '1', '-ar', '16000');
    if (/\.mp3$/i.test(outFile)) args.push('-c:a', 'libmp3lame', '-b:a', '64k'); else args.push('-c:a', 'pcm_s16le');
    args.push(outFile);
    return AK.ffmpeg(args, { onLine: opts.onLine }).then(function () { return outFile; });
  };

  /* ---------------- HTTP (Node, no CORS) ---------------- */
  function request(method, url, headers, body, redirects) {
    redirects = redirects || 0;
    return new Promise(function (resolve, reject) {
      var u = urlMod.parse(url);
      var lib = u.protocol === 'http:' ? http : https;
      var req = lib.request({ method: method, hostname: u.hostname, port: u.port, path: u.path, headers: headers || {} }, function (res) {
        if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location && redirects < 6) {
          res.resume();
          var next = urlMod.resolve(url, res.headers.location);
          return resolve(request(res.statusCode === 303 ? 'GET' : method, next, headers, res.statusCode === 303 ? null : body, redirects + 1));
        }
        var chunks = [];
        res.on('data', function (d) { chunks.push(d); });
        res.on('end', function () { resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }); });
      });
      req.on('error', reject);
      req.setTimeout(10 * 60 * 1000, function () { req.destroy(new Error('timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }
  AK.http = request;
  AK.httpJSON = function (method, url, headers, json) {
    headers = Object.assign({ 'Accept': 'application/json' }, headers || {});
    var body = null;
    if (json !== undefined && json !== null) { body = Buffer.from(JSON.stringify(json)); headers['Content-Type'] = 'application/json'; headers['Content-Length'] = body.length; }
    return request(method, url, headers, body).then(function (r) {
      var txt = r.body.toString('utf8'), data;
      try { data = JSON.parse(txt); } catch (e) { data = txt; }
      if (r.status >= 400) throw new Error('HTTP ' + r.status + ': ' + (typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)));
      return data;
    });
  };
  /* multipart/form-data: fields {name: string | {file, filename, type}} */
  AK.httpMultipart = function (url, headers, fields) {
    var boundary = '----alikit' + Date.now().toString(16);
    var parts = [];
    Object.keys(fields).forEach(function (k) {
      var v = fields[k];
      if (v === undefined || v === null) return;
      var vals = Array.isArray(v) ? v : [v];
      vals.forEach(function (one) {
        if (typeof one === 'object' && one.file) {
          parts.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"; filename="' + (one.filename || path.basename(one.file)) + '"\r\nContent-Type: ' + (one.type || 'application/octet-stream') + '\r\n\r\n'));
          parts.push(fs.readFileSync(one.file));
          parts.push(Buffer.from('\r\n'));
        } else {
          parts.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + String(one) + '\r\n'));
        }
      });
    });
    parts.push(Buffer.from('--' + boundary + '--\r\n'));
    var body = Buffer.concat(parts);
    headers = Object.assign({ 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }, headers || {});
    return request('POST', url, headers, body);
  };
  AK.download = function (url, file, headers) {
    return request('GET', url, headers || { 'User-Agent': 'AliKit/0.1' }).then(function (r) {
      if (r.status >= 400) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(file, r.body);
      return file;
    });
  };

  /* ---------------- misc ---------------- */
  AK.fmtTime = function (s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60), ss = (s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss.toFixed(1);
  };
  AK.openFolder = function (dir) {
    if (!hasNode) return;
    var cmd = os.platform() === 'darwin' ? 'open' : (os.platform() === 'win32' ? 'explorer' : 'xdg-open');
    cp.spawn(cmd, [dir], { detached: true });
  };
  AK.openUrl = function (u) {
    if (AK.inPremiere && global.cep && global.cep.util) return global.cep.util.openURLInDefaultBrowser(u);
    if (hasNode) return AK.openFolder(u);
    window.open(u, '_blank');
  };

  /* list font files installed on the system (macOS + Windows) */
  AK.systemFonts = function () {
    if (!hasNode) return [];
    var dirs = os.platform() === 'darwin'
      ? ['/Library/Fonts', '/System/Library/Fonts', '/System/Library/Fonts/Supplemental', path.join(os.homedir(), 'Library/Fonts')]
      : os.platform() === 'win32' ? ['C:\\Windows\\Fonts', path.join(os.homedir(), 'AppData/Local/Microsoft/Windows/Fonts')]
      : ['/usr/share/fonts', path.join(os.homedir(), '.fonts')];
    var out = [];
    function walk(d, depth) {
      var list; try { list = fs.readdirSync(d); } catch (e) { return; }
      list.forEach(function (f) {
        var p = path.join(d, f);
        if (/\.(ttf|otf)$/i.test(f)) out.push({ name: f.replace(/\.(ttf|otf)$/i, '').replace(/[-_]+/g, ' '), file: p });
        else if (depth < 3) { try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) {} }
      });
    }
    dirs.forEach(function (d) { walk(d, 0); });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  };
  var loadedFonts = {};
  AK.loadFontFile = function (font) {
    if (loadedFonts[font.file]) return Promise.resolve(loadedFonts[font.file]);
    var fam = 'AKF_' + Object.keys(loadedFonts).length;
    var buf = fs.readFileSync(font.file);
    var ff = new FontFace(fam, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    return ff.load().then(function (f) { document.fonts.add(f); loadedFonts[font.file] = fam; return fam; });
  };
})(window);
