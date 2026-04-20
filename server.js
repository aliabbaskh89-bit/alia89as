const express = require('express');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ali-course-secret-change-me';
const ADMIN_KEY  = process.env.ADMIN_KEY  || 'admin2024';

// STORAGE_DIR: on Railway set this to the mounted volume path (e.g. /storage)
// Locally it falls back to the project folder
const STORAGE_DIR = process.env.STORAGE_DIR || __dirname;
const dataDir     = path.join(STORAGE_DIR, 'data');
const videosDir   = path.join(STORAGE_DIR, 'videos');

// Create directories and seed initial JSON files if they don't exist
fs.mkdirSync(dataDir,  { recursive: true });
fs.mkdirSync(videosDir, { recursive: true });

const seedFiles = {
    'students.json':  { students: [] },
    'questions.json': { questions: [] },
    'videos.json': {
        courses: [
            { id: 'graphics',  title: 'الكورس الشامل في الجرافيك', videos: [] },
            { id: 'social',    title: 'تصميم السوشيال ميديا',       videos: [] },
            { id: 'branding',  title: 'الهوية البصرية والبراند',    videos: [] },
            { id: 'indesign',  title: 'كورس Adobe InDesign',        videos: [] },
            { id: 'recorded',  title: 'الكورس المسجل (مقاطع)',      videos: [] },
            { id: 'baghdad1',  title: 'كورس بغداد الحضوري ١',       videos: [] }
        ]
    }
};

for (const [file, seed] of Object.entries(seedFiles)) {
    const filePath = path.join(dataDir, file);
    const localFile = path.join(__dirname, 'data', file);
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(localFile)) {
            fs.copyFileSync(localFile, filePath);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(seed, null, 2));
        }
    }
    // Auto-add any missing courses to existing videos.json
    if (file === 'videos.json') {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const existing = data.courses.map(c => c.id);
        let changed = false;
        for (const course of seed.courses) {
            if (!existing.includes(course.id)) {
                data.courses.push(course);
                changed = true;
            }
        }
        if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
}

app.use(express.json());

// gzip compression for all responses
try {
    const compression = require('compression');
    app.use(compression());
} catch(e) {}

// Block direct access to data/ and videos/ directories
app.use(['/data', '/videos'], (_req, res) => res.status(403).end());

// Serve static files — cache images for 7 days, no-cache for HTML/JS/CSS
app.use(express.static(path.join(__dirname), {
    setHeaders(res, filePath) {
        if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ─── Data helpers ──────────────────────────────────────────────────────────
function readJSON(file) {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

function writeJSON(file, data) {
    fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), 'utf8');
}

// ─── Middleware ────────────────────────────────────────────────────────────
function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    try {
        req.student = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول' });
    }
}

function adminAuth(req, res, next) {
    if (req.headers['x-admin-key'] !== ADMIN_KEY) {
        return res.status(403).json({ error: 'مفتاح الأدمن غير صحيح' });
    }
    next();
}

// ─── Student: Login ────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { code, deviceId } = req.body;
    if (!code) return res.status(400).json({ error: 'يرجى إدخال الكود' });

    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === code.trim().toUpperCase());

    if (!student)        return res.status(401).json({ error: 'الكود غير صحيح' });
    if (!student.active) return res.status(403).json({ error: 'هذا الكود موقوف، يرجى التواصل مع المدرب' });

    // Device binding
    if (deviceId) {
        if (!student.deviceId) {
            // First login — bind this device
            student.deviceId = deviceId;
            writeJSON('students.json', data);
        } else if (student.deviceId !== deviceId) {
            return res.status(403).json({ error: 'هذا الكود مرتبط بجهاز آخر، تواصل مع المدرب لإعادة التعيين' });
        }
    }

    student.lastLogin = new Date().toISOString();
    writeJSON('students.json', data);

    const token = jwt.sign(
        { code: student.code, name: student.name, courses: student.courses },
        JWT_SECRET,
        { expiresIn: '60d' }
    );

    res.json({ token, name: student.name, courses: student.courses });
});

// ─── Admin: Reset device binding ──────────────────────────────────────────
app.delete('/api/admin/students/:code/device', adminAuth, (req, res) => {
    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === req.params.code);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    student.deviceId = null;
    writeJSON('students.json', data);
    res.json({ message: `تم فك ربط جهاز ${student.name} ✅` });
});

// ─── Public: Preview videos (no auth) ─────────────────────────────────────
app.get('/api/public/video/:filename', (req, res) => {
    const videoPath = path.join(videosDir, 'public', req.params.filename);
    if (!fs.existsSync(videoPath)) return res.status(404).end();
    const fileSize = fs.statSync(videoPath).size;
    const ext  = path.extname(req.params.filename).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm' }[ext] || 'video/mp4';
    const range = req.headers.range;
    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': mime });
        fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Accept-Ranges': 'bytes', 'Content-Type': mime });
        fs.createReadStream(videoPath).pipe(res);
    }
});

// ─── Student: Get videos ───────────────────────────────────────────────────
app.get('/api/my-videos', auth, (req, res) => {
    const { courses: allCourses } = readJSON('videos.json');
    const { students } = readJSON('students.json');
    const student = students.find(s => s.code === req.student.code);
    if (!student || !student.active) return res.status(403).json({ error: 'غير مصرح' });
    const studentCourses = student.courses || [];

    const available = studentCourses.includes('all')
        ? allCourses
        : allCourses.filter(c => studentCourses.includes(c.id));

    res.json({ courses: available, name: student.name });
});

// ─── Student: Stream video (token via query param for <video> element) ─────
app.get('/api/video/:course/:filename', auth, (req, res) => {
    const { course, filename } = req.params;
    const studentCourses = req.student.courses;

    if (!studentCourses.includes('all') && !studentCourses.includes(course)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية الوصول لهذا الكورس' });
    }

    const videoPath = path.join(videosDir, course, filename);
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'الفيديو غير موجود' });
    }

    const stat     = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range    = req.headers.range;

    // Detect MIME type
    const ext  = path.extname(filename).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }[ext] || 'video/mp4';

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start     = parseInt(startStr, 10);
        const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': chunkSize,
            'Content-Type':   mime,
        });
        fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges':  'bytes',
            'Content-Type':   mime,
        });
        fs.createReadStream(videoPath).pipe(res);
    }
});

// ─── Admin: List students ──────────────────────────────────────────────────
app.get('/api/admin/students', adminAuth, (_req, res) => {
    res.json(readJSON('students.json'));
});

// ─── Admin: Add student ────────────────────────────────────────────────────
app.post('/api/admin/students', adminAuth, (req, res) => {
    const { name, courses } = req.body;
    if (!name || !courses?.length) {
        return res.status(400).json({ error: 'يرجى إدخال الاسم واختيار الكورس' });
    }

    const data = readJSON('students.json');
    // Generate short, readable code
    const code = `A${Date.now().toString(36).toUpperCase().slice(-4)}${Math.random().toString(36).toUpperCase().slice(2, 6)}`;

    data.students.push({ code, name, courses, active: true, createdAt: new Date().toISOString() });
    writeJSON('students.json', data);

    res.json({ code, message: `تم إضافة ${name} بنجاح` });
});

// ─── Admin: Update student courses ────────────────────────────────────────────
app.patch('/api/admin/students/:code/courses', adminAuth, (req, res) => {
    const { courses } = req.body;
    if (!courses?.length) return res.status(400).json({ error: 'يرجى اختيار كورس واحد على الأقل' });

    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === req.params.code);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    student.courses = courses;
    writeJSON('students.json', data);
    res.json({ message: `تم تحديث كورسات ${student.name} بنجاح ✅` });
});

// ─── Admin: Toggle student active/inactive ─────────────────────────────────
app.patch('/api/admin/students/:code', adminAuth, (req, res) => {
    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === req.params.code);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    student.active = !student.active;
    writeJSON('students.json', data);
    res.json({ active: student.active });
});

// ─── Admin: Delete student ─────────────────────────────────────────────────
app.delete('/api/admin/students/:code', adminAuth, (req, res) => {
    const data    = readJSON('students.json');
    data.students = data.students.filter(s => s.code !== req.params.code);
    writeJSON('students.json', data);
    res.json({ message: 'تم حذف الطالب' });
});

// ─── Admin: Upload video ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const dir = path.join(videosDir, req.params.courseId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safe = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, safe);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
    fileFilter: (_req, file, cb) => {
        const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error('صيغة الملف غير مدعومة. يرجى رفع MP4 أو WebM'));
    }
});

app.post('/api/admin/videos/:courseId', adminAuth, (req, res, next) => {
    upload.single('video')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'فشل رفع الملف' });
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });

    const { title } = req.body;
    const { courseId } = req.params;

    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    course.videos.push({
        id:         Date.now(),
        title:      title || req.file.originalname,
        filename:   req.file.filename,
        uploadedAt: new Date().toISOString()
    });
    writeJSON('videos.json', data);

    res.json({ message: 'تم رفع الفيديو بنجاح', filename: req.file.filename });
});

// ─── Admin: List videos ────────────────────────────────────────────────────
app.get('/api/admin/videos/:courseId', adminAuth, (req, res) => {
    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });
    res.json({ videos: course.videos });
});

// ─── Admin: Stream video (accepts key via query param for <video> element) ──
app.get('/api/admin/video/:courseId/:filename', (req, res) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مصرح' });
    const { courseId, filename } = req.params;
    const videoPath = path.join(videosDir, courseId, filename);
    if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'الفيديو غير موجود' });

    const fileSize = fs.statSync(videoPath).size;
    const ext  = path.extname(filename).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }[ext] || 'video/mp4';
    const range = req.headers.range;

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': chunkSize,
            'Content-Type':   mime,
        });
        fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Accept-Ranges': 'bytes', 'Content-Type': mime });
        fs.createReadStream(videoPath).pipe(res);
    }
});

// ─── Admin: Delete video ───────────────────────────────────────────────────
app.delete('/api/admin/videos/:courseId/:videoId', adminAuth, (req, res) => {
    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const videoId = parseInt(req.params.videoId);
    const video   = course.videos.find(v => v.id === videoId);

    if (video) {
        const videoPath = path.join(videosDir, req.params.courseId, video.filename);
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        course.videos = course.videos.filter(v => v.id !== videoId);
        writeJSON('videos.json', data);
    }

    res.json({ message: 'تم حذف الفيديو' });
});

// ─── Admin: Reorder videos ─────────────────────────────────────────────────
app.patch('/api/admin/videos/:courseId/reorder', adminAuth, (req, res) => {
    const { order } = req.body; // array of video IDs in new order
    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    course.videos.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    writeJSON('videos.json', data);
    res.json({ message: 'تم إعادة الترتيب' });
});

// ─── Notes & Questions ────────────────────────────────────────────────────────

// GET /api/my-questions — all student's notes/questions across all videos
app.get('/api/my-questions', auth, (req, res) => {
    const { questions } = readJSON('questions.json');
    const mine = questions
        .filter(q => q.studentCode === req.student.code)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ questions: mine });
});

// GET /api/notes/:courseId/:videoId — student sees their own notes for a video
app.get('/api/notes/:courseId/:videoId', auth, (req, res) => {
    const { questions } = readJSON('questions.json');
    const mine = questions.filter(q =>
        q.studentCode === req.student.code &&
        q.courseId    === req.params.courseId &&
        q.videoId     === parseInt(req.params.videoId)
    );
    res.json({ notes: mine });
});

// POST /api/notes — student submits a note or question
app.post('/api/notes', auth, (req, res) => {
    const { courseId, videoId, videoTitle, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'يرجى كتابة ملاحظتك أو سؤالك' });

    const data = readJSON('questions.json');
    const note = {
        id:          Date.now(),
        studentCode: req.student.code,
        studentName: req.student.name,
        courseId,
        videoId,
        videoTitle,
        text:        text.trim(),
        reply:       null,
        repliedAt:   null,
        createdAt:   new Date().toISOString()
    };
    data.questions.push(note);
    writeJSON('questions.json', data);
    res.json({ message: 'تم إرسال ملاحظتك للمدرب ✅', note });
});

// Admin: GET /api/admin/questions — all questions sorted newest first
app.get('/api/admin/questions', adminAuth, (_req, res) => {
    const data = readJSON('questions.json');
    data.questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(data);
});

// Admin: POST /api/admin/questions/:id/reply — reply to a note/question
app.post('/api/admin/questions/:id/reply', adminAuth, (req, res) => {
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ error: 'يرجى كتابة الرد' });

    const data = readJSON('questions.json');
    const q    = data.questions.find(q => q.id === parseInt(req.params.id));
    if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });

    q.reply     = reply.trim();
    q.repliedAt = new Date().toISOString();
    writeJSON('questions.json', data);
    res.json({ message: 'تم إرسال الرد للطالب ✅' });
});

// Admin: DELETE /api/admin/questions/:id
app.delete('/api/admin/questions/:id', adminAuth, (req, res) => {
    const data     = readJSON('questions.json');
    data.questions = data.questions.filter(q => q.id !== parseInt(req.params.id));
    writeJSON('questions.json', data);
    res.json({ message: 'تم الحذف' });
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n✅ المنصة تعمل على: http://localhost:${PORT}`);
    console.log(`🔑 مفتاح الأدمن: ${ADMIN_KEY}`);
    console.log(`⚙️  لوحة التحكم:  http://localhost:${PORT}/admin.html\n`);
});
