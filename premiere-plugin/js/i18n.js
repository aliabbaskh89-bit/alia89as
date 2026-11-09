/* Ali Kit — strings. Tools add their own via AK.addStrings({ key: ['عربي', 'English'] }) */
(function (global) {
  'use strict';
  var AK = global.AK = global.AK || {};
  var S = {};
  AK.addStrings = function (o) { Object.keys(o).forEach(function (k) { S[k] = o[k]; }); };
  AK.lang = function () { return (AK.settings && AK.settings.lang) || 'ar'; };
  AK.t = function (key, vars) {
    var e = S[key];
    var s = e ? (AK.lang() === 'en' ? e[1] : e[0]) : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  };
  AK.L = function (o) { return o ? (AK.lang() === 'en' ? (o.en || o.ar) : (o.ar || o.en)) : ''; };

  AK.addStrings({
    'app.name': ['Ali Kit', 'Ali Kit'],
    'app.tagline': ['أدوات المونتاج داخل بريمير', 'Editing tools inside Premiere'],
    'app.allTools': ['كل الأدوات', 'All tools'],
    'app.tools': ['{n} أداة', '{n} tools'],
    'app.back': ['رجوع', 'Back'],
    'badge.new': ['جديد', 'New'],
    'badge.pro': ['احترافي', 'Pro'],
    'badge.popular': ['الأكثر استخداماً', 'Popular'],
    'badge.ai': ['AI', 'AI'],

    'btn.add': ['إضافة للتايملاين', 'Add to timeline'],
    'btn.export': ['تصدير فقط', 'Export only'],
    'btn.apply': ['تطبيق', 'Apply'],
    'btn.analyze': ['تحليل', 'Analyze'],
    'btn.cancel': ['إلغاء', 'Cancel'],
    'btn.save': ['حفظ', 'Save'],
    'btn.openFolder': ['فتح المجلد', 'Open folder'],
    'btn.refresh': ['تحديث', 'Refresh'],

    'f.text': ['النص', 'Text'],
    'f.sub': ['النص الفرعي', 'Subtitle'],
    'f.accent': ['اللون الأساسي', 'Accent'],
    'f.color': ['لون النص', 'Text colour'],
    'f.button': ['نص الزر', 'Button'],
    'f.after': ['بعد الضغط', 'After click'],
    'f.app': ['اسم التطبيق', 'App name'],
    'f.value': ['الرقم', 'Value'],
    'f.prefix': ['قبل الرقم', 'Prefix'],
    'f.width': ['العرض', 'Width'],
    'f.height': ['الارتفاع', 'Height'],
    'f.position': ['المكان', 'Position'],
    'f.scale': ['الحجم', 'Size'],
    'f.duration': ['المدة (ثانية)', 'Duration (s)'],
    'f.font': ['الخط', 'Font'],
    'f.track': ['التراك', 'Track'],
    'pos.top': ['فوق', 'Top'], 'pos.center': ['وسط', 'Center'], 'pos.bottom': ['جوة', 'Bottom'],
    'tpl.now': ['الآن', 'now'],

    'st.rendering': ['جاري الرندر... {p}%', 'Rendering... {p}%'],
    'st.placing': ['جاري الإضافة للتايملاين...', 'Placing on timeline...'],
    'st.done': ['تم ✓', 'Done ✓'],
    'st.analyzing': ['جاري التحليل...', 'Analyzing...'],
    'st.backup': ['حفظ نسخة احتياطية من السيكونس...', 'Saving a backup sequence...'],

    'err.ffmpeg': ['ما لكيت ffmpeg. نصّبه من الإعدادات أو بـ brew install ffmpeg', 'ffmpeg not found. Install it (brew install ffmpeg) or set its path in Settings'],
    'err.noSeq': ['افتح سيكونس بالبريمير أولاً', 'Open a sequence in Premiere first'],
    'err.noClips': ['ماكو كليبات بهذا التراك', 'No clips on this track'],
    'err.noSel': ['حدد كليب بالتايملاين أولاً', 'Select a clip on the timeline first'],
    'err.notPremiere': ['هذه الخاصية تشتغل جوة بريمير فقط', 'This works inside Premiere only'],
    'err.key': ['حط مفتاح {k} من الإعدادات', 'Add your {k} key in Settings'],
    'msg.exported': ['انحفظ الملف بـ: {p}', 'Saved to: {p}']
  });
})(window);
