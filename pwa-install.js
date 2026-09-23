// PWA Smart Install Prompt Handler (iOS, iPadOS, Android) - Ali Abbas Platform

(function () {
    // Check if already running in standalone (installed) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://');

    if (isStandalone) return; // Don't show install prompt if already installed

    // Check if user previously dismissed the prompt recently
    const dismissedTime = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissedTime && (Date.now() - parseInt(dismissedTime, 10)) < 86400000 * 2) {
        // Dismissed within last 2 days
        return;
    }

    let deferredPrompt = null;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Register Service Worker if not registered
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('SW registration skipped or error:', err);
            });
        });
    }

    // Inject HTML Banner into page
    function createInstallUI() {
        const container = document.createElement('div');
        container.id = 'pwaInstallContainer';
        container.innerHTML = `
            <div class="pwa-install-banner" id="pwaBanner">
                <button class="pwa-btn-close" id="pwaCloseBtn" aria-label="إغلاق">✕</button>
                <div class="pwa-banner-content">
                    <img src="/logocopy.png" alt="علي عباس" class="pwa-banner-icon" />
                    <div class="pwa-banner-text">
                        <h4 class="pwa-banner-title">تطبيق علي عباس 📱</h4>
                        <p class="pwa-banner-subtitle">ثبّت التطبيق الآن على جهازك لدخول سريع وسلس للكورسات بدون متصفح.</p>
                    </div>
                </div>
                <div class="pwa-banner-actions">
                    <button class="pwa-btn-install" id="pwaInstallBtn">
                        ⚡ تثبيت التطبيق الآن
                    </button>
                    <button class="pwa-btn-dismiss" id="pwaDismissBtn">لاحقاً</button>
                </div>
            </div>

            <div class="pwa-ios-modal" id="pwaIOSModal">
                <div class="pwa-ios-card">
                    <div class="pwa-ios-header">
                        <h3 class="pwa-ios-title">تثبيت التطبيق على الأيفون والأيباد 📲</h3>
                        <button class="pwa-btn-close" id="pwaIOSCloseBtn">✕</button>
                    </div>
                    <p style="font-size:13px; color:rgba(255,255,255,0.8); margin:0 0 10px 0;">
                        تستطيع تثبيت منصة علي عباس على شاشة الأجهزة الذكية بـ 3 خطوات بسيطة:
                    </p>
                    <ul class="pwa-ios-steps">
                        <li class="pwa-ios-step">
                            <span class="pwa-ios-step-num">1</span>
                            <span>اضغط على زر المشاركة <span class="pwa-ios-icon-inline">⎋</span> أسفل متصفح Safari.</span>
                        </li>
                        <li class="pwa-ios-step">
                            <span class="pwa-ios-step-num">2</span>
                            <span>اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> (Add to Home Screen <span class="pwa-ios-icon-inline">➕</span>).</span>
                        </li>
                        <li class="pwa-ios-step">
                            <span class="pwa-ios-step-num">3</span>
                            <span>اضغط <strong>"إضافة" (Add)</strong> في أعلى الزاوية.</span>
                        </li>
                    </ul>
                    <button class="pwa-btn-install" style="width:100%; margin-top:10px;" id="pwaIOSGotItBtn">تم، فهمت ذلك 👍</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        const banner = document.getElementById('pwaBanner');
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaDismissBtn');
        const closeBtn = document.getElementById('pwaCloseBtn');
        const iosModal = document.getElementById('pwaIOSModal');
        const iosCloseBtn = document.getElementById('pwaIOSCloseBtn');
        const iosGotItBtn = document.getElementById('pwaIOSGotItBtn');

        function showBanner() {
            setTimeout(() => {
                if (banner) banner.classList.add('active');
            }, 1500);
        }

        function hideBanner() {
            if (banner) banner.classList.remove('active');
            localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
        }

        dismissBtn.addEventListener('click', hideBanner);
        closeBtn.addEventListener('click', hideBanner);

        installBtn.addEventListener('click', () => {
            if (isIOS) {
                if (iosModal) iosModal.classList.add('active');
            } else if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(choiceResult => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the PWA install prompt');
                    }
                    deferredPrompt = null;
                    hideBanner();
                });
            } else {
                // Generic fallback instruction
                alert('لتثبيت التطبيق، اضغط خيارات المتصفح (⋮) ثم اختر "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية".');
            }
        });

        iosCloseBtn.addEventListener('click', () => iosModal.classList.remove('active'));
        iosGotItBtn.addEventListener('click', () => {
            iosModal.classList.remove('active');
            hideBanner();
        });

        // Trigger show
        if (isIOS || deferredPrompt) {
            showBanner();
        }
    }

    // Capture Android install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const banner = document.getElementById('pwaBanner');
        if (banner) {
            banner.classList.add('active');
        }
    });

    // Initialize UI when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createInstallUI);
    } else {
        createInstallUI();
    }
})();
