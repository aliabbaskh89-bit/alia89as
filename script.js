const currentLang = document.documentElement.lang || 'ar';

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
    const filterBtns = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closeLightboxBtn = document.getElementById('close-lightbox');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    let currentLightboxImages = [];
    let currentLightboxIndex = 0;

    function updateLightbox() {
        if (!currentLightboxImages || currentLightboxImages.length === 0) return;
        lightboxImg.src = currentLightboxImages[currentLightboxIndex];
        if (lightboxPrev && lightboxNext) {
            const hasMultiple = currentLightboxImages.length > 1;
            lightboxPrev.style.display = hasMultiple ? 'flex' : 'none';
            lightboxNext.style.display = hasMultiple ? 'flex' : 'none';

            lightboxPrev.style.opacity = currentLightboxIndex === 0 ? '0.3' : '1';
            lightboxNext.style.opacity = currentLightboxIndex === currentLightboxImages.length - 1 ? '0.3' : '1';
        }
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');
            portfolioItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-category') === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    portfolioItems.forEach(item => {
        item.addEventListener('click', () => {
            const mainImg = item.querySelector('img').src;
            const title = item.querySelector('.portfolio-title').textContent;
            const extraImgsAttr = item.getAttribute('data-images');

            try {
                const extraImgs = extraImgsAttr ? JSON.parse(extraImgsAttr) : [];
                // الحصول على المسار النسبي فقط للصورة الأساسية (لتجنب التكرار إذا كان مكتوباً في المصفوفة)
                const mainImgSrc = item.querySelector('img').getAttribute('src');

                if (extraImgs.length > 0) {
                    // إذا كانت الصورة الأساسية غير موجودة في القائمة، أضفها في البداية
                    if (!extraImgs.includes(mainImgSrc)) {
                        currentLightboxImages = [mainImgSrc, ...extraImgs];
                    } else {
                        currentLightboxImages = extraImgs;
                    }
                } else {
                    currentLightboxImages = [mainImgSrc];
                }
            } catch (e) {
                currentLightboxImages = [item.querySelector('img').src];
            }

            currentLightboxIndex = 0;
            updateLightbox();
            lightboxCaption.textContent = title;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentLightboxIndex > 0) { currentLightboxIndex--; updateLightbox(); }
        });
    }
    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentLightboxIndex < currentLightboxImages.length - 1) { currentLightboxIndex++; updateLightbox(); }
        });
    }

    closeLightboxBtn.addEventListener('click', () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
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
            const submitBtn = consultingForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = currentLang === 'ar' ? 'جاري الإرسال...' : 'Sending...';

            fetch('https://formspree.io/f/xreajwrb', {
                method: 'POST',
                body: new FormData(consultingForm),
                headers: { 'Accept': 'application/json' }
            })
                .then(resp => {
                    if (resp.ok) {
                        showToast(currentLang === 'ar' ? 'تم الإرسال بنجاح!' : 'Sent successfully!');
                        consultingForm.reset();
                    } else {
                        showToast(currentLang === 'ar' ? 'حدث خطأ!' : 'Error occurred!');
                    }
                })
                .catch(() => showToast('Check connection'))
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                });
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
