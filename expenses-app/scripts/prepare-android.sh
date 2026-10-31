#!/usr/bin/env bash
# يجهّز مشروع الأندرويد (يُستخدم في GitHub Actions أو على جهازك)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d android ] || npx cap add android

# أيقونات وشاشة البداية
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#7c3aed' --iconBackgroundColorDark '#7c3aed' \
  --splashBackgroundColor '#0f1115' --splashBackgroundColorDark '#0f1115' || echo "⚠️ تخطّي توليد الأيقونات"

# أيقونة الإشعار الصغيرة
mkdir -p android/app/src/main/res/drawable
cp android-res/ic_stat_icon.xml android/app/src/main/res/drawable/ic_stat_icon.xml

# صلاحيات الإشعارات والتوقيت الدقيق
MANIFEST=android/app/src/main/AndroidManifest.xml
for perm in POST_NOTIFICATIONS SCHEDULE_EXACT_ALARM USE_EXACT_ALARM RECEIVE_BOOT_COMPLETED WAKE_LOCK; do
  if ! grep -q "android.permission.$perm\"" "$MANIFEST"; then
    sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$perm\" />\n</manifest>#" "$MANIFEST"
  fi
done

npx cap sync android
