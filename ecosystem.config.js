module.exports = {
  apps: [{
    name: 'ali-platform',
    script: 'server.js',
    instances: 1,
    autorestart: true,           // يرجعه تلقائياً لمن يطيح
    watch: false,                // لا نراقب الملفات بالإنتاج
    max_memory_restart: '512M',  // يعيد تشغيله لو أكل ذاكرة وايد
    restart_delay: 3000,         // ينتظر 3 ثوان قبل ما يرجع يشغل
    max_restarts: 50,            // عدد المحاولات بالساعة
    min_uptime: 5000,            // لازم يشتغل 5 ثوان على الأقل عشان يعتبره ناجح
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
