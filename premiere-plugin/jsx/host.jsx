/*
 * Ali Kit — Premiere Pro host script (ExtendScript, ES3).
 * Every public function takes one JSON string argument and returns a JSON string:
 *   { ok: true, ...data }  or  { ok: false, error: "..." }
 */

var AK_BIN_NAME = "Ali Kit";

/* ---------------- JSON helpers (ExtendScript has no JSON) ---------------- */
function ak_q(s) {
    s = String(s);
    var out = '"';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i);
        if (c === '"') out += '\\"';
        else if (c === '\\') out += '\\\\';
        else if (c === '\n') out += '\\n';
        else if (c === '\r') out += '\\r';
        else if (c === '\t') out += '\\t';
        else if (code < 32) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
        else out += c;
    }
    return out + '"';
}
function ak_json(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return ak_q(v);
    if (v instanceof Array) {
        var a = [];
        for (var i = 0; i < v.length; i++) a.push(ak_json(v[i]));
        return '[' + a.join(',') + ']';
    }
    var parts = [];
    for (var k in v) if (v.hasOwnProperty(k)) parts.push(ak_q(k) + ':' + ak_json(v[k]));
    return '{' + parts.join(',') + '}';
}
function ak_parse(s) { if (!s) return {}; return eval('(' + s + ')'); }
function ak_ok(o) { o = o || {}; o.ok = true; return ak_json(o); }
function ak_err(e) { return ak_json({ ok: false, error: String(e && e.message ? e.message : e), line: e && e.line }); }
function ak_wrap(fn) {
    return function (argStr) {
        try { return fn(ak_parse(argStr)); } catch (e) { return ak_err(e); }
    };
}

/* ---------------- generic helpers ---------------- */
function ak_seq() {
    var s = app.project.activeSequence;
    if (!s) throw new Error("NO_SEQUENCE");
    return s;
}
function ak_fps(seq) {
    var fd = seq.getSettings().videoFrameRate.seconds;
    return fd > 0 ? 1 / fd : 30;
}
function ak_time(sec) { var t = new Time(); t.seconds = sec; return t; }
function ak_tc(seq, sec) {
    var st = seq.getSettings();
    return ak_time(sec).getFormatted(st.videoFrameRate, st.videoDisplayFormat);
}
function ak_tracks(seq, kind) { return kind === 'audio' ? seq.audioTracks : seq.videoTracks; }
function ak_qeTrack(qeSeq, kind, i) { return kind === 'audio' ? qeSeq.getAudioTrackAt(i) : qeSeq.getVideoTrackAt(i); }

function ak_clipInfo(c, idx) {
    var path = '';
    try { path = c.projectItem ? c.projectItem.getMediaPath() : ''; } catch (e) {}
    var speed = 1;
    try { speed = c.getSpeed(); } catch (e2) {}
    var info = {
        index: idx,
        name: c.name,
        start: c.start.seconds,
        end: c.end.seconds,
        inPoint: c.inPoint.seconds,
        outPoint: c.outPoint.seconds,
        path: path,
        mediaType: c.mediaType,
        speed: speed,
        selected: false,
        disabled: false
    };
    try { info.selected = c.isSelected(); } catch (e3) {}
    try { info.disabled = !!c.disabled; } catch (e4) {}
    return info;
}

function ak_findBin() {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
        var ch = root.children[i];
        if (ch && ch.name === AK_BIN_NAME && ch.type === ProjectItemType.BIN) return ch;
    }
    root.createBin(AK_BIN_NAME);
    for (var j = 0; j < root.children.numItems; j++) {
        var c2 = root.children[j];
        if (c2 && c2.name === AK_BIN_NAME && c2.type === ProjectItemType.BIN) return c2;
    }
    return root;
}

function ak_samePath(a, b) {
    return String(a).replace(/\\/g, '/').toLowerCase() === String(b).replace(/\\/g, '/').toLowerCase();
}
function ak_findItemByPath(bin, path) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var it = bin.children[i];
        if (!it) continue;
        if (it.type === ProjectItemType.BIN) {
            var r = ak_findItemByPath(it, path);
            if (r) return r;
        } else {
            try { if (ak_samePath(it.getMediaPath(), path)) return it; } catch (e) {}
        }
    }
    return null;
}
function ak_import(path) {
    var bin = ak_findBin();
    var existing = ak_findItemByPath(bin, path);
    if (existing) return existing;
    app.project.importFiles([path], true, bin, false);
    var item = ak_findItemByPath(bin, path);
    if (!item) item = ak_findItemByPath(app.project.rootItem, path);
    if (!item) throw new Error("IMPORT_FAILED: " + path);
    return item;
}

function ak_trackFree(track, t0, t1) {
    for (var i = 0; i < track.clips.numItems; i++) {
        var c = track.clips[i];
        if (c.start.seconds < t1 - 0.001 && c.end.seconds > t0 + 0.001) return false;
    }
    return true;
}
function ak_addTrack(seq, kind) {
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (kind === 'audio') qeSeq.addTracks(0, 0, 1, 1, seq.audioTracks.numTracks);
    else qeSeq.addTracks(1, seq.videoTracks.numTracks, 0);
}
/* first track at/above `minIndex` that is free over [t0,t1]; creates one if needed */
function ak_freeTrack(seq, kind, t0, t1, minIndex) {
    var tracks = ak_tracks(seq, kind);
    for (var i = (minIndex || 0); i < tracks.numTracks; i++) {
        if (!tracks[i].isLocked() && ak_trackFree(tracks[i], t0, t1)) return i;
    }
    ak_addTrack(seq, kind);
    tracks = ak_tracks(seq, kind);
    return tracks.numTracks - 1;
}

function ak_component(clip, matchName, displayNames) {
    var comps = clip.components;
    for (var i = 0; i < comps.numItems; i++) {
        var c = comps[i];
        if (c.matchName === matchName) return c;
        for (var j = 0; j < displayNames.length; j++) if (c.displayName === displayNames[j]) return c;
    }
    return null;
}
function ak_motion(clip) { return ak_component(clip, 'AE.ADBE Motion', ['Motion', 'الحركة']); }
function ak_opacity(clip) { return ak_component(clip, 'AE.ADBE Opacity', ['Opacity', 'التعتيم']); }
/* Motion params by index: 0 Position, 1 Scale, 2 Scale Width, 3 Uniform Scale, 4 Rotation, 5 Anchor Point */
function ak_prop(comp, names, fallbackIndex) {
    for (var i = 0; i < comp.properties.numItems; i++) {
        var p = comp.properties[i];
        for (var j = 0; j < names.length; j++) if (p.displayName === names[j]) return p;
    }
    return comp.properties[fallbackIndex];
}
function ak_posProp(clip) { return ak_prop(ak_motion(clip), ['Position', 'الموضع'], 0); }
function ak_scaleProp(clip) { return ak_prop(ak_motion(clip), ['Scale', 'المقياس'], 1); }
function ak_rotProp(clip) { return ak_prop(ak_motion(clip), ['Rotation', 'التدوير'], 4); }
function ak_opacityProp(clip) { return ak_prop(ak_opacity(clip), ['Opacity', 'التعتيم'], 0); }

/* keyframe times on a clip's effect are expressed in media time (relative to source start) */
function ak_keyTime(clip, seqSec) {
    return ak_time(clip.inPoint.seconds + (seqSec - clip.start.seconds));
}
function ak_setKeys(clip, prop, keys) {
    /* keys: [{t: seqSeconds, v: value}] */
    prop.setTimeVarying(true);
    for (var i = 0; i < keys.length; i++) {
        var kt = ak_keyTime(clip, keys[i].t);
        prop.addKey(kt);
        prop.setValueAtKey(kt, keys[i].v, i === keys.length - 1);
        if (keys[i].ease) { try { prop.setInterpolationTypeAtKey(kt, 5, false); } catch (e) {} }
    }
}

function ak_mediaSize(item) {
    try {
        var x = item.getProjectMetadata();
        var m = x.match(/VideoInfo>\s*([0-9]+)\s*x\s*([0-9]+)/);
        if (m) return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
    } catch (e) {}
    try {
        var fi = item.getFootageInterpretation();
        if (fi && fi.frameWidth) return { w: fi.frameWidth, h: fi.frameHeight };
    } catch (e2) {}
    return null;
}

/* ---------------- public API ---------------- */

var ak_ping = ak_wrap(function () {
    return ak_ok({ version: app.version, project: app.project ? app.project.name : '' });
});

var ak_seqInfo = ak_wrap(function () {
    var seq = ak_seq();
    var v = [], a = [], i;
    for (i = 0; i < seq.videoTracks.numTracks; i++) v.push({ index: i, name: seq.videoTracks[i].name, clips: seq.videoTracks[i].clips.numItems, locked: seq.videoTracks[i].isLocked() });
    for (i = 0; i < seq.audioTracks.numTracks; i++) a.push({ index: i, name: seq.audioTracks[i].name, clips: seq.audioTracks[i].clips.numItems, locked: seq.audioTracks[i].isLocked() });
    var inP = 0, outP = 0;
    try { inP = seq.getInPointAsTime().seconds; outP = seq.getOutPointAsTime().seconds; } catch (e) {}
    return ak_ok({
        name: seq.name,
        width: seq.frameSizeHorizontal,
        height: seq.frameSizeVertical,
        fps: ak_fps(seq),
        playhead: seq.getPlayerPosition().seconds,
        end: seq.end ? Number(seq.end) / 254016000000 : 0,
        inPoint: inP, outPoint: outP,
        video: v, audio: a
    });
});

var ak_trackClips = ak_wrap(function (a) {
    var seq = ak_seq();
    var tr = ak_tracks(seq, a.kind)[a.track];
    if (!tr) throw new Error("NO_TRACK");
    var out = [];
    for (var i = 0; i < tr.clips.numItems; i++) out.push(ak_clipInfo(tr.clips[i], i));
    return ak_ok({ clips: out });
});

var ak_selection = ak_wrap(function () {
    var seq = ak_seq();
    var out = [];
    var kinds = ['video', 'audio'];
    for (var k = 0; k < 2; k++) {
        var tracks = ak_tracks(seq, kinds[k]);
        for (var t = 0; t < tracks.numTracks; t++) {
            for (var i = 0; i < tracks[t].clips.numItems; i++) {
                var c = tracks[t].clips[i];
                if (c.isSelected()) {
                    var info = ak_clipInfo(c, i);
                    info.kind = kinds[k]; info.track = t;
                    out.push(info);
                }
            }
        }
    }
    return ak_ok({ clips: out });
});

/* Clip under the playhead (topmost enabled video clip, or on a given track) */
var ak_clipAtPlayhead = ak_wrap(function (a) {
    var seq = ak_seq();
    var t = seq.getPlayerPosition().seconds;
    var kind = a.kind || 'video';
    var tracks = ak_tracks(seq, kind);
    var from = a.track !== undefined ? a.track : tracks.numTracks - 1;
    var to = a.track !== undefined ? a.track : 0;
    for (var ti = from; ti >= to; ti--) {
        for (var i = 0; i < tracks[ti].clips.numItems; i++) {
            var c = tracks[ti].clips[i];
            if (c.start.seconds <= t + 0.0001 && c.end.seconds > t && !c.disabled) {
                var info = ak_clipInfo(c, i); info.kind = kind; info.track = ti; info.playhead = t;
                return ak_ok({ clip: info });
            }
        }
    }
    return ak_ok({ clip: null, playhead: t });
});

/* Import a file and lay it on a free track above existing content */
var ak_place = ak_wrap(function (a) {
    var seq = ak_seq();
    var item = ak_import(a.path);
    var kind = a.kind || 'video';
    var t0 = (a.time === undefined || a.time === null) ? seq.getPlayerPosition().seconds : a.time;
    var dur = a.duration || 5;
    var trackIndex = (a.track !== undefined && a.track !== null) ? a.track : ak_freeTrack(seq, kind, t0, t0 + dur, a.minTrack || 1);
    var tr = ak_tracks(seq, kind)[trackIndex];
    tr.overwriteClip(item, t0);
    return ak_ok({ track: trackIndex, time: t0 });
});

var ak_importOnly = ak_wrap(function (a) {
    var paths = a.paths || [a.path];
    for (var i = 0; i < paths.length; i++) ak_import(paths[i]);
    return ak_ok({ count: paths.length });
});

var ak_backupSequence = ak_wrap(function () {
    var seq = ak_seq();
    seq.clone();
    return ak_ok({});
});

/* Razor every unlocked track (or a subset) at the given sequence times */
function ak_razorTimes(seq, times, spec) {
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    var kinds = ['video', 'audio'];
    for (var k = 0; k < 2; k++) {
        var kind = kinds[k];
        var list = spec && spec[kind];
        var tracks = ak_tracks(seq, kind);
        for (var ti = 0; ti < tracks.numTracks; ti++) {
            if (list && !ak_inArr(list, ti)) continue;
            if (tracks[ti].isLocked()) continue;
            var qt = ak_qeTrack(qeSeq, kind, ti);
            for (var i = 0; i < times.length; i++) {
                if (!ak_hasClipSpanning(tracks[ti], times[i])) continue;
                qt.razor(ak_tc(seq, times[i]));
            }
        }
    }
}
function ak_inArr(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i] === v) return true; return false; }
function ak_hasClipSpanning(track, t) {
    for (var i = 0; i < track.clips.numItems; i++) {
        var c = track.clips[i];
        if (c.start.seconds < t - 0.01 && c.end.seconds > t + 0.01) return true;
    }
    return false;
}

/*
 * Remove time ranges from the sequence (Auto Cut).
 * a.ranges: [[start,end],...] in sequence seconds, ascending.
 * a.tracks: {video:[...], audio:[...]} indices to cut (default: all unlocked)
 */
var ak_removeRanges = ak_wrap(function (a) {
    var seq = ak_seq();
    var ranges = a.ranges || [];
    if (!ranges.length) return ak_ok({ removed: 0 });
    var times = [];
    for (var i = 0; i < ranges.length; i++) { times.push(ranges[i][0]); times.push(ranges[i][1]); }
    ak_razorTimes(seq, times, a.tracks);

    var removed = 0;
    var kinds = ['video', 'audio'];
    /* walk ranges from last to first so ripple shifts never affect the ones we still need */
    for (var r = ranges.length - 1; r >= 0; r--) {
        var r0 = ranges[r][0], r1 = ranges[r][1];
        for (var k = 0; k < 2; k++) {
            var kind = kinds[k];
            var list = a.tracks && a.tracks[kind];
            var tracks = ak_tracks(seq, kind);
            for (var ti = 0; ti < tracks.numTracks; ti++) {
                if (list && !ak_inArr(list, ti)) continue;
                if (tracks[ti].isLocked()) continue;
                for (var ci = tracks[ti].clips.numItems - 1; ci >= 0; ci--) {
                    var c = tracks[ti].clips[ci];
                    var cs = c.start.seconds, ce = c.end.seconds;
                    if (cs >= r0 - 0.02 && ce <= r1 + 0.02) { c.remove(false, true); removed++; }
                }
            }
        }
        /* close the gap with a ripple delete of the empty space on every track */
        ak_closeGap(seq, r0, r1, a.tracks);
    }
    return ak_ok({ removed: removed });
});

/* Shift every clip that starts at/after `r1` left by (r1-r0) on the given tracks */
function ak_closeGap(seq, r0, r1, spec) {
    var shift = r1 - r0;
    if (shift <= 0) return;
    var kinds = ['video', 'audio'];
    for (var k = 0; k < 2; k++) {
        var kind = kinds[k];
        var list = spec && spec[kind];
        var tracks = ak_tracks(seq, kind);
        for (var ti = 0; ti < tracks.numTracks; ti++) {
            if (list && !ak_inArr(list, ti)) continue;
            if (tracks[ti].isLocked()) continue;
            for (var ci = 0; ci < tracks[ti].clips.numItems; ci++) {
                var c = tracks[ti].clips[ci];
                if (c.start.seconds >= r1 - 0.02) c.move(ak_time(-shift));
            }
        }
    }
}

/*
 * Multicam switching: a.segments = [{start,end,cam}] where cam = index into a.cams (video track indices).
 * Razors the camera tracks at switch points and disables the cameras that are not on air.
 */
var ak_multicamSwitch = ak_wrap(function (a) {
    var seq = ak_seq();
    var cams = a.cams;
    var segs = a.segments;
    var times = [];
    for (var i = 1; i < segs.length; i++) times.push(segs[i].start);
    ak_razorTimes(seq, times, { video: cams, audio: [] });
    var changed = 0;
    for (var ci = 0; ci < cams.length; ci++) {
        var tr = seq.videoTracks[cams[ci]];
        for (var k = 0; k < tr.clips.numItems; k++) {
            var c = tr.clips[k];
            var mid = (c.start.seconds + c.end.seconds) / 2;
            var on = false;
            for (var s = 0; s < segs.length; s++) {
                if (mid >= segs[s].start && mid < segs[s].end) { on = (segs[s].cam === ci); break; }
            }
            c.disabled = !on;
            changed++;
        }
    }
    return ak_ok({ clips: changed, cuts: times.length });
});

/* Reels split-screen: top camera / bottom camera, each scaled to fill half the frame */
var ak_stackLayout = ak_wrap(function (a) {
    var seq = ak_seq();
    var W = seq.frameSizeHorizontal, H = seq.frameSizeVertical;
    var slots = [{ track: a.top, y: 0.25 }, { track: a.bottom, y: 0.75 }];
    var n = 0;
    for (var s = 0; s < 2; s++) {
        var tr = seq.videoTracks[slots[s].track];
        for (var i = 0; i < tr.clips.numItems; i++) {
            var c = tr.clips[i];
            var sz = ak_mediaSize(c.projectItem) || { w: 1920, h: 1080 };
            var scale = Math.max(W / sz.w, (H / 2) / sz.h) * 100;
            ak_scaleProp(c).setValue(scale, true);
            ak_posProp(c).setValue([0.5, slots[s].y], true);
            c.disabled = false;
            n++;
        }
    }
    return ak_ok({ clips: n });
});

/*
 * Keyframe transitions at a cut. a.type, a.duration (sec), a.track (video index), a.time (cut, optional = playhead)
 */
var ak_transition = ak_wrap(function (a) {
    var seq = ak_seq();
    var tr = seq.videoTracks[a.track || 0];
    var cut = (a.time === undefined || a.time === null) ? seq.getPlayerPosition().seconds : a.time;
    var fd = 1 / ak_fps(seq);
    var A = null, B = null;
    for (var i = 0; i < tr.clips.numItems; i++) {
        var c = tr.clips[i];
        if (Math.abs(c.end.seconds - cut) <= fd * 1.5) A = c;
        if (Math.abs(c.start.seconds - cut) <= fd * 1.5) B = c;
    }
    if (!A && !B) {
        /* fall back to nearest cut on this track */
        var best = 1e9;
        for (var j = 0; j < tr.clips.numItems - 1; j++) {
            var d = Math.abs(tr.clips[j].end.seconds - cut);
            if (d < best) { best = d; A = tr.clips[j]; B = tr.clips[j + 1]; }
        }
        if (!A) throw new Error("NO_CUT");
        cut = A.end.seconds;
    }
    var half = (a.duration || 0.5) / 2;
    var amt = a.amount || 1;
    var type = a.type;
    var cutA = A ? A.end.seconds : cut, cutB = B ? B.start.seconds : cut;
    var aT0 = cutA - half, bT1 = cutB + half;
    var lastA = cutA - fd, firstB = cutB;
    var dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

    function scaleKeys(clip, from, to, t0, t1) {
        if (!clip) return;
        ak_setKeys(clip, ak_scaleProp(clip), [{ t: t0, v: from, ease: true }, { t: t1, v: to, ease: true }]);
    }
    function posKeys(clip, from, to, t0, t1) {
        if (!clip) return;
        ak_setKeys(clip, ak_posProp(clip), [{ t: t0, v: from, ease: true }, { t: t1, v: to, ease: true }]);
    }
    function rotKeys(clip, from, to, t0, t1) {
        if (!clip) return;
        ak_setKeys(clip, ak_rotProp(clip), [{ t: t0, v: from, ease: true }, { t: t1, v: to, ease: true }]);
    }
    var baseA = A ? ak_scaleProp(A).getValue() : 100, baseB = B ? ak_scaleProp(B).getValue() : 100;

    if (type === 'zoomIn') {
        scaleKeys(A, baseA, baseA * (1 + 1.2 * amt), aT0, lastA);
        scaleKeys(B, baseB * (1 + 0.6 * amt), baseB, firstB, bT1);
    } else if (type === 'zoomOut') {
        scaleKeys(A, baseA, baseA * (1 - 0.35 * amt), aT0, lastA);
        scaleKeys(B, baseB * (1 + 0.5 * amt), baseB, firstB, bT1);
    } else if (dir[type]) {
        var d2 = dir[type];
        posKeys(A, [0.5, 0.5], [0.5 - d2[0] * amt, 0.5 - d2[1] * amt], aT0, lastA);
        posKeys(B, [0.5 + d2[0] * amt, 0.5 + d2[1] * amt], [0.5, 0.5], firstB, bT1);
    } else if (type === 'spin') {
        rotKeys(A, 0, 180 * amt, aT0, lastA);
        scaleKeys(A, baseA, baseA * 1.6, aT0, lastA);
        rotKeys(B, -180 * amt, 0, firstB, bT1);
        scaleKeys(B, baseB * 1.6, baseB, firstB, bT1);
    } else if (type === 'shake') {
        var target = B || A;
        var keys = [];
        var n = Math.max(4, Math.round((half * 2) / fd / 2));
        var t0s = B ? firstB : aT0;
        for (var k = 0; k <= n; k++) {
            var fall = 1 - k / n;
            var dx = k === n ? 0 : (Math.random() - 0.5) * 0.06 * amt * fall;
            var dy = k === n ? 0 : (Math.random() - 0.5) * 0.06 * amt * fall;
            keys.push({ t: t0s + k * fd * 2, v: [0.5 + dx, 0.5 + dy] });
        }
        ak_setKeys(target, ak_posProp(target), keys);
        scaleKeys(target, (B ? baseB : baseA) * 1.08, (B ? baseB : baseA) * 1.08, t0s, t0s + n * fd * 2);
    } else if (type === 'fade') {
        if (A) ak_setKeys(A, ak_opacityProp(A), [{ t: aT0, v: 100 }, { t: lastA, v: 0 }]);
        if (B) ak_setKeys(B, ak_opacityProp(B), [{ t: firstB, v: 0 }, { t: bT1, v: 100 }]);
    } else {
        throw new Error("UNKNOWN_TRANSITION");
    }
    return ak_ok({ cut: cut });
});

/*
 * Motion tracking result -> Position keyframes on the selected clip (an overlay).
 * a.keys: [{t: seqSeconds, x: 0..1, y: 0..1}]
 */
var ak_applyTrack = ak_wrap(function (a) {
    var seq = ak_seq();
    var target = null;
    for (var t = 0; t < seq.videoTracks.numTracks && !target; t++) {
        var tr = seq.videoTracks[t];
        for (var i = 0; i < tr.clips.numItems; i++) if (tr.clips[i].isSelected()) { target = tr.clips[i]; break; }
    }
    if (!target) throw new Error("SELECT_OVERLAY");
    /* map source-frame coords (0..1) to sequence coords using the tracked clip's own Scale/Position */
    var mapX = function (x) { return x; }, mapY = function (y) { return y; };
    if (a.source) {
        try {
            var src = seq.videoTracks[a.source.track].clips[a.source.index];
            var sz = ak_mediaSize(src.projectItem);
            var sc = ak_scaleProp(src).getValue() / 100;
            var sp = ak_posProp(src).getValue();
            var W = seq.frameSizeHorizontal, H = seq.frameSizeVertical;
            if (sz) {
                mapX = function (x) { return sp[0] + (x - 0.5) * sz.w * sc / W; };
                mapY = function (y) { return sp[1] + (y - 0.5) * sz.h * sc / H; };
            }
        } catch (e) {}
    }
    var pos = ak_posProp(target);
    var cur = pos.getValue();
    var ox = cur[0] - mapX(a.keys[0].x), oy = cur[1] - mapY(a.keys[0].y);
    if (a.absolute) { ox = 0; oy = 0; }
    var keys = [];
    for (var k = 0; k < a.keys.length; k++) keys.push({ t: a.keys[k].t, v: [mapX(a.keys[k].x) + ox, mapY(a.keys[k].y) + oy] });
    ak_setKeys(target, pos, keys);
    return ak_ok({ keys: keys.length, clip: target.name });
});

var ak_setPlayhead = ak_wrap(function (a) {
    var seq = ak_seq();
    seq.setPlayerPosition(String(Math.round(a.time * 254016000000)));
    return ak_ok({});
});

var ak_disableClip = ak_wrap(function (a) {
    var seq = ak_seq();
    var c = ak_tracks(seq, a.kind || 'video')[a.track].clips[a.index];
    c.disabled = a.disabled !== false;
    return ak_ok({});
});

var ak_projectPath = ak_wrap(function () {
    return ak_ok({ path: app.project.path });
});
