#!/bin/bash
cd "$(dirname "$0")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  منصة علي عباس — جاري التشغيل..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing server on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null

/usr/local/bin/node server.js &
sleep 2

echo ""
echo "✅ المنصة تعمل الآن!"
echo ""
echo "🔗 افتح في المتصفح:"
echo "   الطلاب    → http://localhost:3001/login.html"
echo "   لوحة التحكم → http://localhost:3001/admin.html"
echo ""

# Open browser automatically
open http://localhost:3001/login.html

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  اغلق هذه النافذة لإيقاف السيرفر"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
wait
