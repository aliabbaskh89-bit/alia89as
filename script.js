const currentLang = document.documentElement.lang || 'ar';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

// =============================================================
// LOGIC — الموقع الآن يدار بالكامل من ملف الـ HTML
// =============================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const bodyEl = document.body;

    const savedTheme = localStorage.getItem('aliAbbasTheme') || 'dark';
    bodyEl.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        let currentTheme = bodyEl.getAttribute('data-theme');
        let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        bodyEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('aliAbbasTheme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }

    // --- Navbar & Mobile Menu ---
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    const header = document.getElementById('header');

    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });

    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = mobileToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }));

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        updateScrollProgress();
    });

    function updateScrollProgress() {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const progressBar = document.getElementById('scroll-progress');
        if (progressBar) progressBar.style.width = scrolled + "%";
    }

    // --- Courses Modal ---
    const courseModal = document.getElementById('course-modal');
    const modalBody = document.getElementById('modal-body');
    const closeCourseModalBtn = document.getElementById('close-course-modal');

    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.course-card');
            const title = card.querySelector('h3').textContent;
            const img = card.querySelector('.course-img').src;
            const fullDesc = e.target.getAttribute('data-full-desc');
            const meta = card.querySelector('.course-meta').innerHTML;

            const bookTxt = currentLang === 'ar' ? 'احجز مقعدك الآن' : 'Book Your Seat';

            modalBody.innerHTML = `
                <img src="${img}" alt="${title}" class="modal-img">
                <h2 style="margin-bottom: 15px; font-size: 1.8rem;">${title}</h2>
                <div class="course-meta" style="margin-bottom: 20px; display:flex; gap: 10px; justify-content: flex-start;">
                    ${meta}
                </div>
                <p style="color: var(--text-muted); line-height: 1.8; margin-bottom: 25px; font-size: 1.05rem;">${fullDesc}</p>
                <a href="#consulting" class="btn btn-primary w-100" id="modal-book-btn" style="padding: 12px; font-size: 1.1rem;">${bookTxt}</a>
            `;

            document.getElementById('modal-book-btn').addEventListener('click', () => {
                closeCourseModal();
            });

            courseModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeCourseModal() {
        courseModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    if (closeCourseModalBtn) closeCourseModalBtn.addEventListener('click', closeCourseModal);
    courseModal.addEventListener('click', (e) => {
        if (e.target === courseModal) closeCourseModal();
    });

    // --- Search Filter Logic ---
    function filterItems(containerId, searchInputId) {
        const input = document.getElementById(searchInputId);
        const container = document.getElementById(containerId);
        if (!input || !container) return;

        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = container.querySelectorAll('.tutorial-card');

            cards.forEach(card => {
                const title = card.querySelector('h4').textContent.toLowerCase();
                if (title.includes(term)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    filterItems('tutorials-container', 'tutorial-search');
    filterItems('lectures-container', 'lecture-search');

    // --- Portfolio Filter & Lightbox ---
    const filterBtns     = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    const lightbox       = document.getElementById('lightbox');
    const lbImg          = document.getElementById('lb-img');
    const lbCaption      = document.getElementById('lightbox-caption');
    const lbCounter      = document.getElementById('lb-counter');
    const lbPrev         = document.getElementById('lightbox-prev');
    const lbNext         = document.getElementById('lightbox-next');
    const lbBackdrop     = document.getElementById('lb-backdrop');
    const lbCloseBtn     = document.getElementById('close-lightbox');

    let lbImages = [];
    let lbIndex  = 0;

    function lbShow(idx) {
        lbIndex = Math.max(0, Math.min(idx, lbImages.length - 1));
        lbImg.style.opacity = '0';
        lbImg.src = lbImages[lbIndex];
        lbImg.onload = () => { lbImg.style.opacity = '1'; };
        lbImg.onerror = () => { lbImg.style.opacity = '1'; };
        lbCounter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
        if (lbPrev) lbPrev.style.opacity = lbIndex === 0 ? '0.3' : '1';
        if (lbNext) lbNext.style.opacity = lbIndex === lbImages.length - 1 ? '0.3' : '1';
    }

    function lbOpen(images, title) {
        lbImages = images;
        const multi = images.length > 1;
        if (lbPrev) lbPrev.style.display = multi ? 'flex' : 'none';
        if (lbNext) lbNext.style.display = multi ? 'flex' : 'none';
        lbCaption.textContent = title;
        lbShow(0);
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function lbClose() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lbImg.src = '';
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');
            portfolioItems.forEach(item => {
                item.style.display = (filter === 'all' || item.getAttribute('data-category') === filter)
                    ? 'block' : 'none';
            });
        });
    });

    portfolioItems.forEach(item => {
        item.addEventListener('click', () => {
            const mainSrc = item.querySelector('img').getAttribute('src');
            const title   = item.querySelector('.portfolio-title')?.textContent || '';
            let images;
            try {
                const raw = JSON.parse(item.getAttribute('data-images') || '[]');
                images = raw.length ? (raw.includes(mainSrc) ? raw : [mainSrc, ...raw]) : [mainSrc];
            } catch { images = [mainSrc]; }
            lbOpen(images, title);
        });
    });

    lbPrev?.addEventListener('click', e => { e.stopPropagation(); lbShow(lbIndex - 1); });
    lbNext?.addEventListener('click', e => { e.stopPropagation(); lbShow(lbIndex + 1); });
    lbCloseBtn?.addEventListener('click', lbClose);
    lbBackdrop?.addEventListener('click', lbClose);

    document.addEventListener('keydown', e => {
        if (!lightbox?.classList.contains('active')) return;
        if (e.key === 'Escape')     lbClose();
        if (e.key === 'ArrowRight') lbShow(lbIndex - 1);
        if (e.key === 'ArrowLeft')  lbShow(lbIndex + 1);
    });

    let lbTouchX = 0;
    lightbox?.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
    lightbox?.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - lbTouchX;
        if (Math.abs(dx) < 40) return;
        dx < 0 ? lbShow(lbIndex - 1) : lbShow(lbIndex + 1);
    });

    // --- Highlights / Stories ---
    const highlightItems = document.querySelectorAll('.highlight-item');
    const storyModal = document.getElementById('story-modal');
    const storyImg = document.getElementById('story-img');
    const closeStoryBtn = document.getElementById('close-story');
    const storyPrev = document.getElementById('story-prev');
    const storyNext = document.getElementById('story-next');

    let currentStoryImages = [];
    let currentStoryIndex = 0;

    highlightItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const gallery = item.querySelector('.highlight-gallery');
            if (gallery) {
                currentStoryImages = Array.from(gallery.querySelectorAll('img')).map(img => img.src);
            } else {
                currentStoryImages = [item.querySelector('.circle-img img').src];
            }

            currentStoryIndex = 0;
            updateStoryModal();
            storyModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function updateStoryModal() {
        if (currentStoryImages.length === 0) return;
        storyImg.src = currentStoryImages[currentStoryIndex];
        storyPrev.style.display = currentStoryImages.length > 1 ? 'flex' : 'none';
        storyNext.style.display = currentStoryImages.length > 1 ? 'flex' : 'none';

        storyPrev.style.opacity = currentStoryIndex === 0 ? '0.3' : '1';
        storyNext.style.opacity = currentStoryIndex === currentStoryImages.length - 1 ? '0.3' : '1';
    }

    if (storyPrev) {
        storyPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentStoryIndex > 0) { currentStoryIndex--; updateStoryModal(); }
        });
    }
    if (storyNext) {
        storyNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentStoryIndex < currentStoryImages.length - 1) { currentStoryIndex++; updateStoryModal(); }
            else { closeStory(); }
        });
    }

    function closeStory() {
        storyModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    if (closeStoryBtn) closeStoryBtn.addEventListener('click', closeStory);
    storyModal.addEventListener('click', (e) => { if (e.target === storyModal) closeStory(); });

    // --- Consulting Form ---
    const consultingForm = document.getElementById('consulting-form');
    if (consultingForm) {
        consultingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name    = document.getElementById('c-name')?.value.trim() || '';
            const phone   = document.getElementById('c-phone')?.value.trim() || '';
            const email   = document.getElementById('c-email')?.value.trim() || '';
            const type    = document.getElementById('c-type')?.value || '';
            const message = document.getElementById('c-msg')?.value.trim() || '';

            const text = `مرحباً علي،\n\n*الاسم:* ${name}\n*الهاتف:* ${phone}\n*البريد:* ${email}\n*نوع الطلب:* ${type}\n*التفاصيل:* ${message}`;
            window.open(`https://wa.me/9647718669939?text=${encodeURIComponent(text)}`, '_blank');
            consultingForm.reset();
        });
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        if (toast && toastMsg) {
            toastMsg.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }

    // --- Typewriter Effect ---
    const typewriterEl = document.querySelector('.typewriter');
    if (typewriterEl) {
        const text = typewriterEl.getAttribute('data-text');
        let index = 0;
        function type() {
            if (index < text.length) {
                typewriterEl.textContent += text.charAt(index);
                index++;
                setTimeout(type, 100);
            }
        }
        typewriterEl.textContent = '';
        setTimeout(type, 1000);
    }

    // --- Reveal on Scroll ---
    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // observer.unobserve(entry.target); // Optional: stop observing once revealed
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.15
    });

    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });
});

function copyPayNum(num, btn) {
    navigator.clipboard.writeText(num).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ تم النسخ';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    });
}

// ══════════════════════════════════════════════
// ── Interactive Effects ──
// ══════════════════════════════════════════════
(function initEffects() {
    const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

    // ── 2. Magnetic Buttons ───────────────────
    if (!isTouchDevice()) {
        document.querySelectorAll('.btn-primary, .btn-outline').forEach(btn => {
            btn.addEventListener('mousemove', e => {
                const r = btn.getBoundingClientRect();
                const x = (e.clientX - r.left - r.width  / 2) * 0.35;
                const y = (e.clientY - r.top  - r.height / 2) * 0.35;
                btn.style.transform = `translate(${x}px, ${y}px)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // ── 3. Card 3D Tilt ───────────────────────
    if (!isTouchDevice()) {
        document.querySelectorAll('.course-card, .portfolio-item').forEach(card => {
            card.addEventListener('mousemove', e => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width  - 0.5;
                const y = (e.clientY - r.top)  / r.height - 0.5;
                card.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.03)`;
                card.style.boxShadow = `${-x * 20}px ${-y * 20}px 40px rgba(167,255,13,0.08)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });
    }

    // ── 4. Text Scramble on Reveal ────────────
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZابتثجحخدذرزسشصضطظعغفقكلمنهوي0123456789';

    function scramble(el) {
        const original = el.dataset.original || el.textContent;
        el.dataset.original = original;
        let iter = 0;
        clearInterval(el._scrambleTimer);
        el._scrambleTimer = setInterval(() => {
            el.textContent = original.split('').map((ch, i) => {
                if (ch === ' ') return ' ';
                if (i < iter) return original[i];
                return CHARS[Math.floor(Math.random() * CHARS.length)];
            }).join('');
            if (iter >= original.length) {
                clearInterval(el._scrambleTimer);
                el.textContent = original;
            }
            iter += 0.7;
        }, 28);
    }

    const scrambleObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                scramble(entry.target);
                scrambleObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.section-title h2, .section-title h3').forEach(el => {
        scrambleObserver.observe(el);
    });

    // ── 5. Scroll Progress Bar ────────────────
    const bar = document.getElementById('scroll-progress');
    if (bar) {
        window.addEventListener('scroll', () => {
            const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            bar.style.width = (window.scrollY / h * 100) + '%';
        }, { passive: true });
    }

    // ── 6. Interactive Blobs ──────────────────
    const blobs = [
        { el: document.querySelector('.blob-1'), speedX: 0.025, speedY: 0.018 },
        { el: document.querySelector('.blob-2'), speedX: -0.02, speedY: -0.015 },
        { el: document.querySelector('.blob-3'), speedX: 0.015, speedY: -0.022 },
        { el: document.querySelector('.blob-4'), speedX: -0.03, speedY: 0.012 },
    ].filter(b => b.el);

    if (blobs.length && !('ontouchstart' in window)) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let cx = mouseX, cy = mouseY;

        window.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }, { passive: true });

        function animateBlobs() {
            cx += (mouseX - cx) * 0.06;
            cy += (mouseY - cy) * 0.06;

            const dx = cx - window.innerWidth / 2;
            const dy = cy - window.innerHeight / 2;

            blobs.forEach(b => {
                const tx = dx * b.speedX * 100;
                const ty = dy * b.speedY * 100;
                b.el.style.transform = `translate(${tx}px, ${ty}px)`;
            });

            requestAnimationFrame(animateBlobs);
        }
        animateBlobs();
    }

})();
