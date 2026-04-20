/* ═══════════════════════════════════════════════════
   Platform JS — Login / Platform / Admin
   ═══════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

const TOKEN_KEY  = 'plt_token';
const NAME_KEY   = 'plt_name';
const DEVICE_KEY = 'plt_device';

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
}

// ─── Auth helpers ──────────────────────────────────
function getToken()           { return localStorage.getItem(TOKEN_KEY); }
function getName()            { return localStorage.getItem(NAME_KEY);  }
function saveAuth(tok, name)  { localStorage.setItem(TOKEN_KEY, tok); localStorage.setItem(NAME_KEY, name); }
function clearAuth()          { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); }
function authFetch(url, opts) {
    return fetch(url, { ...opts, headers: { ...(opts?.headers), Authorization: `Bearer ${getToken()}` } });
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 4000);
}

/* ══════════════════════════════════════
   LOGIN PAGE
   ══════════════════════════════════════ */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    if (getToken()) window.location.href = 'platform.html';

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code     = document.getElementById('codeInput').value.trim();
        const btn      = document.getElementById('loginBtn');
        const errorEl  = document.getElementById('loginError');

        btn.disabled    = true;
        btn.textContent = 'جاري التحقق...';
        errorEl.style.display = 'none';

        try {
            const res  = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, deviceId: getDeviceId() })
            });
            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error;
                errorEl.style.display = 'block';
                btn.disabled    = false;
                btn.textContent = 'دخول';
                return;
            }

            saveAuth(data.token, data.name);
            window.location.href = 'platform.html';
        } catch {
            errorEl.textContent   = 'خطأ في الاتصال بالسيرفر، حاول مرة أخرى';
            errorEl.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'دخول';
        }
    });
}

/* ══════════════════════════════════════
   PLATFORM PAGE
   ══════════════════════════════════════ */
if (document.getElementById('platformPage')) {
    if (!getToken()) { window.location.href = 'login.html'; }

    const $player       = document.getElementById('videoPlayer');
    const $lessonTitle  = document.getElementById('lessonTitle');
    const $coursesList  = document.getElementById('coursesList');
    const $lessonsList  = document.getElementById('lessonsList');
    const $studentName  = document.getElementById('studentName');
    const $welcomeTitle = document.getElementById('welcomeTitle');
    const $welcomeSub   = document.getElementById('welcomeSub');
    const $playerArea   = document.getElementById('playerArea');
    const $welcomeScr   = document.getElementById('welcomeScreen');

    // ── Replies Drawer ─────────────────────────────
    window.openReplies = function() {
        document.getElementById('repliesDrawer').classList.add('open');
        document.getElementById('drawerOverlay').classList.add('open');
        loadMyReplies();
    };

    window.closeReplies = function() {
        document.getElementById('repliesDrawer').classList.remove('open');
        document.getElementById('drawerOverlay').classList.remove('open');
    };

    async function loadMyReplies() {
        try {
            const res = await authFetch('/api/my-questions');
            if (!res.ok) return;
            const { questions } = await res.json();

            // Badge: count questions that have replies
            const withReply = questions.filter(q => q.reply).length;
            const badge = document.getElementById('repliesBadge');
            if (withReply > 0) {
                badge.textContent   = withReply;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }

            renderReplies(questions);
        } catch { /* silent */ }
    }

    function renderReplies(questions) {
        const list = document.getElementById('repliesList');
        if (!questions.length) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:12px; opacity:.3">📭</div>
                    <p style="font-size:.875rem;">لم ترسل أي سؤال بعد</p>
                    <p style="font-size:.78rem; margin-top:6px;">اضغط على محاضرة واكتب سؤالك أسفل الفيديو</p>
                </div>`;
            return;
        }

        list.innerHTML = questions.map(q => `
            <div class="reply-card ${q.reply ? 'has-reply' : ''}">
                <div class="reply-card-video">📹 ${q.videoTitle || 'محاضرة'}</div>
                <p class="reply-card-question">${q.text}</p>
                <p class="reply-card-date">${new Date(q.createdAt).toLocaleDateString('ar-IQ', {year:'numeric',month:'long',day:'numeric'})}</p>
                ${q.reply
                    ? `<div class="reply-card-answer">
                           <p class="reply-card-answer-label">✅ رد المدرب:</p>
                           <p>${q.reply}</p>
                       </div>`
                    : `<p class="reply-card-pending">⏳ في انتظار رد المدرب</p>`
                }
            </div>
        `).join('');
    }

    // Load badge count on page load
    loadMyReplies();

    $studentName.textContent = getName();

    document.getElementById('logoutBtn').addEventListener('click', () => {
        clearAuth();
        window.location.href = 'login.html';
    });

    // ── Progress tracking ──────────────────────────
    const _b64 = getToken().split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const studentCode = JSON.parse(atob(_b64 + '='.repeat((4 - _b64.length % 4) % 4))).code;
    const PROGRESS_KEY = `progress_${studentCode}`;

    function getProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
    }
    function markWatched(courseId, videoId) {
        const p = getProgress();
        if (!p[courseId]) p[courseId] = [];
        const id = String(videoId);
        if (!p[courseId].includes(id)) p[courseId].push(id);
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    }
    function isWatched(courseId, videoId) {
        const p = getProgress();
        return (p[courseId] || []).includes(String(videoId));
    }
    function getLastVideo(courseId) {
        try { return JSON.parse(localStorage.getItem(`last_${studentCode}_${courseId}`)); } catch { return null; }
    }
    function saveLastVideo(courseId, videoId, filename, title) {
        localStorage.setItem(`last_${studentCode}_${courseId}`, JSON.stringify({ videoId, filename, title }));
    }

    // ── Watermark ──────────────────────────────────
    let _wmInterval = null;
    function initWatermark() {
        const wm = document.getElementById('videoWatermark');
        if (!wm) return;
        wm.textContent = `${getName()} • ${studentCode}`;

        function moveWatermark() {
            const container = document.getElementById('videoPlayerContainer');
            if (!container || !container.offsetWidth) return;
            const maxX = container.offsetWidth  - wm.offsetWidth  - 16;
            const maxY = container.offsetHeight - wm.offsetHeight - 16;
            if (maxX > 0) wm.style.left = Math.floor(10 + Math.random() * maxX) + 'px';
            if (maxY > 0) wm.style.top  = Math.floor(10 + Math.random() * maxY) + 'px';
        }

        if (_wmInterval) clearInterval(_wmInterval);
        // Small delay so container has rendered dimensions
        setTimeout(moveWatermark, 300);
        _wmInterval = setInterval(moveWatermark, 8000);
    }

    // Pause video when user switches tab (deters screen recorders)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && $player && !$player.paused) $player.pause();
    });

    // ── Current video state (for notes) ───────────
    let currentNote = null; // { courseId, videoId, videoTitle }

    // ── Load courses ───────────────────────────────
    async function loadCourses() {
        try {
            const res = await authFetch('/api/my-videos');
            if (!res.ok) { clearAuth(); window.location.href = 'login.html'; return; }
            const { courses } = await res.json();
            window._courses = courses;
            renderCourses(courses);
        } catch {
            showToast('خطأ في تحميل المحتوى، تأكد من تشغيل السيرفر', 'error');
        }
    }

    function renderCourses(courses) {
        if (!courses.length) {
            $coursesList.innerHTML = '<p class="no-content">لا توجد كورسات مسجلة</p>';
            return;
        }

        $coursesList.innerHTML = courses.map((c, i) => `
            <div class="course-tab ${i === 0 ? 'active' : ''}" data-id="${c.id}" onclick="selectCourse('${c.id}')">
                <span class="course-icon">📚</span>
                <span class="course-tab-name">${c.title}</span>
                <span class="lesson-count">${c.videos.length} درس</span>
            </div>
        `).join('');

        // Show first course lessons but do NOT auto-play
        if (courses[0]) selectCourse(courses[0].id);
    }

    window.selectCourse = function(courseId) {
        const courses = window._courses || [];
        const course  = courses.find(c => c.id === courseId);
        if (!course) return;

        document.querySelectorAll('.course-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.course-tab[data-id="${courseId}"]`)?.classList.add('active');

        // Update welcome screen text
        $welcomeTitle.textContent = course.title;
        $welcomeSub.textContent   = `${course.videos.length} محاضرة — اضغط على أي محاضرة لتشغيلها`;

        // Hide player, show welcome
        $playerArea.style.display = 'none';
        $welcomeScr.style.display = 'flex';

        if (!course.videos.length) {
            $lessonsList.innerHTML = '<p class="no-content">لم يتم رفع محاضرات لهذا الكورس بعد</p>';
            $lessonsList.style.display = 'block';
            return;
        }

        const watched    = getProgress()[courseId] || [];
        const watchedCnt = watched.length;
        const total      = course.videos.length;
        const lastVid    = getLastVideo(courseId);

        $lessonsList.style.display = 'block';
        $lessonsList.innerHTML = `
            <div class="lessons-list-header">
                <p class="lessons-list-title">محتوى الكورس — ${total} محاضرة</p>
                <span class="progress-count">${watchedCnt}/${total} ✅</span>
            </div>
            ${lastVid ? `<button class="btn-resume" onclick="resumeVideo('${courseId}')">▶ استكمل من حيث توقفت</button>` : ''}
            ${course.videos.map((v, i) => `
                <div class="lesson-item ${isWatched(courseId, v.id) ? 'watched' : ''}" data-course="${courseId}" data-id="${v.id}" data-file="${v.filename}" data-title="${v.title.replace(/"/g,'&quot;')}">
                    <span class="lesson-num">${isWatched(courseId, v.id) ? '✅' : (i + 1)}</span>
                    <span class="lesson-name" onclick="playVideo('${courseId}','${v.id}','${v.filename}','${v.title.replace(/'/g,"\\'")}',this.closest('.lesson-item'))">${v.title}</span>
                    <span class="play-icon">▶</span>
                </div>
            `).join('')}
        `;
    };

    window.playVideo = function(courseId, videoId, filename, videoTitle, element) {
        document.querySelectorAll('.lesson-item').forEach(l => l.classList.remove('active'));
        element.classList.add('active');

        $playerArea.style.display = 'flex';
        $welcomeScr.style.display = 'none';

        $lessonTitle.textContent = videoTitle;
        $player.src = `/api/video/${courseId}/${filename}?token=${encodeURIComponent(getToken())}`;
        $player.play().catch(() => {});

        // Save last watched
        saveLastVideo(courseId, videoId, filename, videoTitle);

        // Mark watched when 80% of video is played
        $player.onended = null;
        $player.ontimeupdate = null;
        $player.ontimeupdate = function() {
            if ($player.duration && ($player.currentTime / $player.duration) >= 0.8) {
                if (!isWatched(courseId, videoId)) {
                    markWatched(courseId, videoId);
                    element.classList.add('watched');
                    element.querySelector('.lesson-num').textContent = '✅';
                    // Refresh progress counter
                    const p    = getProgress()[courseId] || [];
                    const tot  = document.querySelectorAll('.lesson-item').length;
                    const cntEl = document.querySelector('.progress-count');
                    if (cntEl) cntEl.textContent = `${p.length}/${tot} ✅`;
                }
            }
        };

        // Init watermark
        initWatermark();

        document.querySelector('.platform-main').scrollTo({ top: 0, behavior: 'smooth' });

        currentNote = { courseId, videoId: parseInt(videoId), videoTitle };
        loadNotes();
    };

    window.resumeVideo = function(courseId) {
        const last = getLastVideo(courseId);
        if (!last) return;
        const course = (window._courses || []).find(c => c.id === courseId);
        if (!course) return;
        const video = course.videos.find(v => String(v.id) === String(last.videoId));
        if (!video) return;
        const el = document.querySelector(`.lesson-item[data-id="${video.id}"]`);
        if (el) playVideo(courseId, video.id, video.filename, video.title, el);
    };

    // ── Notes ──────────────────────────────────────
    async function loadNotes() {
        if (!currentNote) return;
        try {
            const res = await authFetch(`/api/notes/${currentNote.courseId}/${currentNote.videoId}`);
            const { notes } = await res.json();
            renderNotes(notes);
        } catch { /* silent */ }
    }

    function renderNotes(notes) {
        const list = document.getElementById('notesList');
        if (!notes.length) {
            list.innerHTML = '<p style="font-size:.8rem; color:var(--text-muted); padding:4px 0;">لا توجد ملاحظات بعد لهذه المحاضرة</p>';
            return;
        }
        list.innerHTML = notes.map(n => `
            <div class="note-item ${n.reply ? 'has-reply' : ''}">
                <p class="note-text">${n.text}</p>
                <p class="note-meta">${new Date(n.createdAt).toLocaleDateString('ar-IQ', { year:'numeric', month:'long', day:'numeric' })}</p>
                ${n.reply ? `
                    <div class="note-reply">
                        <p class="note-reply-label">رد المدرب:</p>
                        <p>${n.reply}</p>
                    </div>
                ` : '<p style="font-size:.72rem; color:var(--text-muted); margin-top:6px;">⏳ في انتظار رد المدرب</p>'}
            </div>
        `).join('');
    }

    document.getElementById('addNoteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentNote) return;
        const text = document.getElementById('noteText').value.trim();
        if (!text) return;

        const btn = document.getElementById('noteSubmitBtn');
        btn.disabled    = true;
        btn.textContent = 'جاري الإرسال...';

        try {
            const res = await authFetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentNote, text })
            });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('noteText').value = '';
                showToast(data.message);
                loadNotes();
            } else {
                showToast(data.error, 'error');
            }
        } catch {
            showToast('خطأ في الإرسال', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'إرسال للمدرب';
        }
    });

    loadCourses();
}

/* ══════════════════════════════════════
   ADMIN PAGE
   ══════════════════════════════════════ */
if (document.getElementById('adminPage')) {
    let adminKey = '';

    // ── Modal helpers ──────────────────────────────
    window.closeModal = function() {
        document.getElementById('codeModal').classList.remove('open');
    };

    window.copyModalCode = function() {
        const code = document.getElementById('modalCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast('✅ تم نسخ الكود: ' + code);
        });
    };

    // ── Admin login gate ───────────────────────────
    document.getElementById('adminLoginBtn').addEventListener('click', async () => {
        const key     = document.getElementById('adminKeyInput').value.trim();
        const errEl   = document.getElementById('adminKeyError');
        const netEl   = document.getElementById('adminNetError');
        const btn     = document.getElementById('adminLoginBtn');
        errEl.style.display = 'none';
        netEl.style.display = 'none';
        btn.textContent = 'جاري التحقق...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/admin/students', { headers: { 'x-admin-key': key } });
            if (res.ok) {
                adminKey = key;
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'block';
                loadStudents();
                loadQuestions();
            } else {
                errEl.style.display = 'block';
            }
        } catch {
            netEl.style.display = 'block';
        } finally {
            btn.textContent = 'دخول';
            btn.disabled = false;
        }
    });

    document.getElementById('adminKeyInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
    });

    function aFetch(url, opts) {
        return fetch(url, { ...opts, headers: { ...(opts?.headers), 'x-admin-key': adminKey } });
    }

    // ── Tab switching ──────────────────────────────
    window.showTab = function(tab, btn) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).style.display = 'block';
        if (tab === 'questions') loadQuestions();
        if (tab === 'videos') loadCourseVideos();
    };

    window.loadCourseVideos = async function() {
        const courseId = document.getElementById('manageCourseSel').value;
        const container = document.getElementById('manageVideosList');
        if (!courseId) { container.innerHTML = '<p style="color:var(--text-muted)">اختر كورساً أولاً</p>'; return; }
        container.innerHTML = '<p style="color:var(--text-muted)">جاري التحميل...</p>';
        const res = await aFetch(`/api/admin/videos/${courseId}`);
        const { videos } = await res.json();
        if (!videos || videos.length === 0) { container.innerHTML = '<p style="color:var(--text-muted)">لا توجد فيديوهات في هذا الكورس</p>'; return; }
        container.innerHTML = videos.map((v, i) => `
            <div style="background:var(--card);border-radius:12px;margin-bottom:12px;border:1px solid var(--border-color);overflow:hidden">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
                    <span style="color:var(--text);font-weight:600">${i+1}. ${v.title}</span>
                    <div style="display:flex;gap:8px">
                        <button onclick="togglePreview('${v.id}')" style="background:var(--primary);color:#000;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-family:inherit;font-weight:700">▶ معاينة</button>
                        <button onclick="deleteVideo('${courseId}','${v.id}')" style="background:#e53e3e;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-family:inherit">🗑 حذف</button>
                    </div>
                </div>
                <div id="preview-${v.id}" style="display:none;padding:0 16px 16px">
                    <video controls style="width:100%;border-radius:8px;max-height:420px;background:#000" controlsList="nodownload"
                        src="/api/admin/video/${courseId}/${encodeURIComponent(v.filename)}?key=${encodeURIComponent(adminKey)}">
                    </video>
                </div>
            </div>
        `).join('');
    };

    window.togglePreview = function(videoId) {
        const box = document.getElementById(`preview-${videoId}`);
        const isOpen = box.style.display !== 'none';
        if (isOpen) {
            const vid = box.querySelector('video');
            vid.pause();
            box.style.display = 'none';
        } else {
            box.style.display = 'block';
        }
    };

    window.deleteVideo = async function(courseId, videoId) {
        if (!confirm('تأكيد حذف الفيديو؟')) return;
        const res = await aFetch(`/api/admin/videos/${courseId}/${videoId}`, { method: 'DELETE' });
        if (res.ok) { showToast('تم حذف الفيديو'); loadCourseVideos(); }
        else showToast('خطأ في الحذف');
    };

    // ── Load & render students ─────────────────────
    async function loadStudents() {
        try {
            const res = await aFetch('/api/admin/students');
            const { students } = await res.json();
            renderStudents(students);
            // Update stats
            document.getElementById('statTotal').textContent    = students.length;
            document.getElementById('statActive').textContent   = students.filter(s => s.active).length;
            document.getElementById('statInactive').textContent = students.filter(s => !s.active).length;
        } catch {
            showToast('خطأ في تحميل الطلاب', 'error');
        }
    }

    function renderStudents(students) {
        const tbody = document.getElementById('studentsTable');
        if (!students.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table">لا يوجد طلاب مسجلين بعد — أضف أول طالب من الأعلى</td></tr>';
            return;
        }
        tbody.innerHTML = students.map(s => `
            <tr class="${!s.active ? 'inactive' : ''}">
                <td><strong>${s.name}</strong></td>
                <td>
                    <code class="code-cell">${s.code}</code>
                    <button class="btn-copy" onclick="copyCode('${s.code}')">نسخ</button>
                </td>
                <td style="font-size:.8rem">${Array.isArray(s.courses) ? s.courses.map(courseLabel).join('، ') : s.courses}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${s.lastLogin ? new Date(s.lastLogin).toLocaleString('ar-IQ', {dateStyle:'short', timeStyle:'short'}) : '—'}</td>
                <td><span class="status-badge ${s.active ? 'active' : 'inactive'}">${s.active ? '✅ مفعّل' : '⛔ موقف'}</span></td>
                <td>
                    <button class="btn-toggle" onclick="toggleStudent('${s.code}')">${s.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button class="btn-edit-courses" data-code="${s.code}" data-name="${s.name.replace(/"/g, '&quot;')}" data-courses='${JSON.stringify(s.courses)}' onclick="openEditModal(this)">تعديل</button>
                    ${s.deviceId ? `<button class="btn-reset-device" onclick="resetDevice('${s.code}', '${s.name}')">🔓 فك الجهاز</button>` : '<span style="font-size:.75rem;color:var(--text-muted)">🔗 غير مرتبط</span>'}
                    <button class="btn-delete" onclick="deleteStudent('${s.code}', '${s.name}')">حذف</button>
                </td>
            </tr>
        `).join('');
    }

    function courseLabel(id) {
        const map = { graphics: 'الجرافيك', social: 'السوشيال', branding: 'الهوية', indesign: 'InDesign', recorded: 'المسجل (مقاطع)', baghdad1: 'بغداد الحضوري ١', all: 'الكل' };
        return map[id] || id;
    }

    window.copyCode = function(code) {
        navigator.clipboard.writeText(code).then(() => showToast('تم نسخ الكود: ' + code));
    };

    window.toggleStudent = async function(code) {
        const res = await aFetch(`/api/admin/students/${code}`, { method: 'PATCH' });
        if (res.ok) loadStudents();
    };

    window.resetDevice = async function(code, name) {
        if (!confirm(`فك ربط جهاز "${name}"؟ سيتمكن من الدخول من أي جهاز جديد.`)) return;
        const res = await aFetch(`/api/admin/students/${code}/device`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) { showToast(data.message); loadStudents(); }
        else showToast(data.error, 'error');
    };

    window.deleteStudent = async function(code, name) {
        if (!confirm(`هل تريد حذف الطالب "${name}" بشكل نهائي؟`)) return;
        const res = await aFetch(`/api/admin/students/${code}`, { method: 'DELETE' });
        if (res.ok) { showToast('تم حذف الطالب'); loadStudents(); }
    };

    window.openEditModal = function(el) {
        const code           = el.dataset.code;
        const name           = el.dataset.name;
        const currentCourses = JSON.parse(el.dataset.courses);
        document.getElementById('editStudentCode').value = code;
        document.getElementById('editModalSub').textContent = name;
        document.querySelectorAll('.edit-checkbox').forEach(cb => {
            cb.checked = currentCourses.includes(cb.value);
        });
        document.getElementById('editError').style.display = 'none';
        document.getElementById('editModal').classList.add('open');
    };

    window.closeEditModal = function() {
        document.getElementById('editModal').classList.remove('open');
    };

    window.saveEditCourses = async function() {
        const code    = document.getElementById('editStudentCode').value;
        const courses = [...document.querySelectorAll('.edit-checkbox:checked')].map(c => c.value);
        const errEl   = document.getElementById('editError');

        if (!courses.length) {
            errEl.textContent = 'يرجى اختيار كورس واحد على الأقل';
            errEl.style.display = 'block';
            return;
        }

        const res = await aFetch(`/api/admin/students/${code}/courses`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courses })
        });
        const data = await res.json();
        if (res.ok) {
            closeEditModal();
            showToast(data.message);
            loadStudents();
        } else {
            errEl.textContent = data.error || 'حدث خطأ';
            errEl.style.display = 'block';
        }
    };

    // ── Add student form ───────────────────────────
    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name    = document.getElementById('studentNameInput').value.trim();
        const courses = [...document.querySelectorAll('.course-checkbox:checked')].map(c => c.value);
        const btn     = document.getElementById('addStudentBtn');

        if (!name)           { showToast('يرجى إدخال اسم الطالب', 'error'); return; }
        if (!courses.length) { showToast('يرجى اختيار كورس واحد على الأقل', 'error'); return; }

        btn.disabled    = true;
        btn.textContent = 'جاري الإضافة...';

        try {
            const res  = await aFetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, courses })
            });
            const data = await res.json();

            if (res.ok) {
                // Show code in modal popup — impossible to miss
                document.getElementById('modalCode').textContent = data.code;
                document.getElementById('codeModal').classList.add('open');
                document.getElementById('addStudentForm').reset();
                loadStudents();
            } else {
                showToast(data.error, 'error');
            }
        } catch {
            showToast('خطأ في الاتصال بالسيرفر', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'إضافة وتوليد كود';
        }
    });

    // ── Upload video form ──────────────────────────
    window.updateFileName = function(input) {
        const display = document.getElementById('fileNameDisplay');
        const area    = input.closest('.file-upload-area');
        if (input.files[0]) {
            display.textContent = input.files[0].name;
            display.classList.add('file-selected');
            area.classList.add('has-file');
        } else {
            display.textContent = 'اضغط لاختيار ملف الفيديو';
            display.classList.remove('file-selected');
            area.classList.remove('has-file');
        }
    };

    document.getElementById('uploadVideoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const courseId = document.getElementById('uploadCourseSelect').value;
        const title    = document.getElementById('videoTitleInput').value.trim();
        const file     = document.getElementById('videoFileInput').files[0];

        if (!courseId) { showToast('يرجى اختيار الكورس', 'error'); return; }
        if (!title)    { showToast('يرجى إدخال عنوان الدرس', 'error'); return; }
        if (!file)     { showToast('يرجى اختيار ملف الفيديو', 'error'); return; }

        const formData = new FormData();
        formData.append('video', file);
        formData.append('title', title);

        const progressEl  = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const submitBtn   = document.getElementById('uploadSubmitBtn');

        progressEl.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الرفع...';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/admin/videos/${courseId}`);
        xhr.setRequestHeader('x-admin-key', adminKey);

        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
                const pct = Math.round((ev.loaded / ev.total) * 100);
                progressBar.style.width   = pct + '%';
                progressBar.textContent   = pct + '%';
            }
        };

        xhr.onload = () => {
            progressEl.style.display  = 'none';
            progressBar.style.width   = '0%';
            submitBtn.disabled        = false;
            submitBtn.textContent     = 'رفع الفيديو';
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch (_) {}
            if (xhr.status === 200) {
                showToast('✅ ' + (data.message || 'تم الرفع بنجاح'));
                document.getElementById('uploadVideoForm').reset();
                window.updateFileName(document.getElementById('videoFileInput'));
            } else {
                showToast(data.error || ('فشل الرفع — كود: ' + xhr.status), 'error');
            }
        };

        xhr.onerror = () => {
            showToast('خطأ في الاتصال أثناء الرفع', 'error');
            progressEl.style.display = 'none';
            submitBtn.disabled       = false;
            submitBtn.textContent    = 'رفع الفيديو';
        };

        xhr.send(formData);
    });

    // ── Questions (load, render, reply, delete) ────
    async function loadQuestions() {
        try {
            const res = await aFetch('/api/admin/questions');
            const { questions } = await res.json();
            renderQuestions(questions);

            // Badge count for unanswered
            const unanswered = questions.filter(q => !q.reply).length;
            const badge      = document.getElementById('qBadge');
            if (unanswered > 0) {
                badge.textContent    = unanswered;
                badge.style.display  = 'inline-flex';
            } else {
                badge.style.display  = 'none';
            }
        } catch {
            showToast('خطأ في تحميل الأسئلة', 'error');
        }
    }

    const courseNames = { graphics: 'الجرافيك', social: 'السوشيال ميديا', branding: 'الهوية البصرية', indesign: 'InDesign', all: 'الكل' };

    function renderQuestions(questions) {
        const container = document.getElementById('questionsList');
        if (!questions?.length) {
            container.innerHTML = '<p class="empty-table">لا توجد أسئلة أو ملاحظات بعد</p>';
            return;
        }

        container.innerHTML = questions.map(q => `
            <div class="question-card ${q.reply ? 'replied' : ''}" id="qcard-${q.id}">
                <div class="question-meta">
                    <span class="q-student">👤 ${q.studentName}</span>
                    <span class="q-course-tag">${courseNames[q.courseId] || q.courseId}</span>
                    <span class="q-video-tag">📹 ${q.videoTitle || 'غير محدد'}</span>
                    <span class="q-date">${new Date(q.createdAt).toLocaleDateString('ar-IQ', { year:'numeric', month:'short', day:'numeric' })}</span>
                    <button class="btn-del-q" onclick="deleteQuestion(${q.id})">حذف</button>
                </div>
                <p class="question-text">${q.text}</p>
                ${q.reply ? `
                    <div class="existing-reply">
                        <p class="existing-reply-label">ردك على الطالب:</p>
                        <p>${q.reply}</p>
                    </div>
                    <button class="btn-del-q" onclick="editReply(${q.id},'${q.reply.replace(/'/g,"\\'")}')">تعديل الرد</button>
                ` : `
                    <div class="reply-form">
                        <textarea id="reply-${q.id}" placeholder="اكتب ردك على الطالب هنا..."></textarea>
                        <button class="btn-reply" onclick="submitReply(${q.id})">إرسال الرد</button>
                    </div>
                `}
            </div>
        `).join('');
    }

    window.submitReply = async function(id) {
        const textarea = document.getElementById(`reply-${id}`);
        const reply    = textarea?.value.trim();
        if (!reply) { showToast('يرجى كتابة الرد', 'error'); return; }

        const res  = await aFetch(`/api/admin/questions/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        });
        const data = await res.json();
        if (res.ok) { showToast(data.message); loadQuestions(); }
        else        { showToast(data.error, 'error'); }
    };

    window.editReply = function(id, currentReply) {
        const card = document.getElementById(`qcard-${id}`);
        const existing = card.querySelector('.existing-reply');
        const editBtn  = card.querySelector('.btn-del-q:last-child');
        if (existing) existing.remove();
        if (editBtn)  editBtn.remove();

        const form = document.createElement('div');
        form.className = 'reply-form';
        form.innerHTML = `
            <textarea id="reply-${id}">${currentReply}</textarea>
            <button class="btn-reply" onclick="submitReply(${id})">تحديث الرد</button>
        `;
        card.appendChild(form);
    };

    window.deleteQuestion = async function(id) {
        if (!confirm('هل تريد حذف هذا السؤال؟')) return;
        const res = await aFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('تم الحذف'); loadQuestions(); }
    };

}
