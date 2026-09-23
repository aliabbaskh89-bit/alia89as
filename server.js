const express = require('express');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const fs      = require('fs');
const crypto  = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'ALI_ABBAS_SECURITY_SALT_2026').digest('hex');
}

// ─── Global crash protection ──────────────────────────────────────────────
// These handlers prevent the ENTIRE server from dying on unexpected errors
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] ❌ UNCAUGHT EXCEPTION:`, err.stack || err);
    // DO NOT call process.exit — keep the server alive
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] ❌ UNHANDLED REJECTION:`, reason);
});

const app        = express();
const PORT       = process.env.PORT || 3000;
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
    'students.json':       { students: [] },
    'user_accounts.json':  { users: [] },
    'questions.json':      { questions: [] },
    'registrations.json':  { registrations: [] },
    'receipts.json':       { receipts: [] },
    'faqs.json':           { faqs: [] },
    'resources.json':      { resources: [] },
    'pdfs.json':           { pdfs: [] },
    'pdf_orders.json':     { orders: [] },
    'videos.json': {
        courses: [
            { id: 'graphics',  title: 'الكورس الشامل في الجرافيك', videos: [] },
            { id: 'social',    title: 'تصميم السوشيال ميديا',       videos: [] },
            { id: 'branding',  title: 'الهوية البصرية والبراند',    videos: [] },
            { id: 'indesign',  title: 'كورس Adobe InDesign',        videos: [] },
            { id: 'recorded',  title: 'الكورس المسجل (مقاطع)',      videos: [] },
            { id: 'baghdad1',  title: 'كورس بغداد الحضوري ١',       videos: [] },
            { id: 'baghdad2',  title: 'كورس بغداد الحضوري ٢',       videos: [] }
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

// Clean Platform URL Routes
app.get(['/platform', '/app'], (_req, res) => {
    res.sendFile(path.join(__dirname, 'platform.html'));
});

// ─── Health check (Cloudflare / uptime monitors) ─────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        timestamp: new Date().toISOString()
    });
});

// ─── Data helpers (crash-safe) ────────────────────────────────────────────
const JSON_DEFAULTS = {
    'students.json':       { students: [] },
    'questions.json':      { questions: [] },
    'registrations.json':  { registrations: [] },
    'receipts.json':       { receipts: [] },
    'faqs.json':           { faqs: [] },
    'resources.json':      { resources: [] },
    'videos.json':         { courses: [] }
};

function readJSON(file) {
    const filePath = path.join(dataDir, file);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw || !raw.trim()) throw new Error('Empty file');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ⚠️ readJSON(${file}) failed:`, err.message);
        // Try reading backup
        const backupPath = filePath + '.bak';
        try {
            if (fs.existsSync(backupPath)) {
                console.log(`  ↪ Restoring from backup: ${backupPath}`);
                const backupRaw = fs.readFileSync(backupPath, 'utf8');
                const backupData = JSON.parse(backupRaw);
                // Restore the main file from backup
                fs.writeFileSync(filePath, backupRaw, 'utf8');
                return backupData;
            }
        } catch (backupErr) {
            console.error(`  ↪ Backup restore also failed:`, backupErr.message);
        }
        // Last resort: return empty defaults
        console.log(`  ↪ Using empty defaults for ${file}`);
        return JSON_DEFAULTS[file] || {};
    }
}

function writeJSON(file, data) {
    const filePath = path.join(dataDir, file);
    try {
        const jsonStr = JSON.stringify(data, null, 2);
        // Create backup of current file before writing
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, filePath + '.bak');
        }
        // Atomic write: write to .tmp first, then rename
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, jsonStr, 'utf8');
        fs.renameSync(tmpPath, filePath);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ⚠️ writeJSON(${file}) failed:`, err.message);
    }
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

// ─── Student User Account System ──────────────────────────────────────────

// Public: Student Register
app.post('/api/register', (req, res) => {
    const { name, identity, password, deviceId } = req.body;
    if (!name || !name.trim() || !identity || !identity.trim() || !password) {
        return res.status(400).json({ error: 'يرجى إدخال الاسم ورقم الهاتف/البريد وكلمة المرور' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 4 خانات على الأقل' });
    }

    const cleanIdentity = identity.trim().toLowerCase();
    const data = readJSON('user_accounts.json');
    data.users = data.users || [];

    const existingUser = data.users.find(u => u.identity === cleanIdentity);
    if (existingUser) {
        return res.status(400).json({ error: 'يوجد حساب مسجّل بهذا رقم الهاتف/البريد الإلكتروني مسبقاً' });
    }

    const userId = 'USR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newUser = {
        id: userId,
        name: name.trim(),
        identity: cleanIdentity,
        passwordHash: hashPassword(password),
        deviceId: deviceId || null,
        activeCourses: [],
        activatedCodes: [],
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };

    data.users.push(newUser);
    writeJSON('user_accounts.json', data);

    const token = jwt.sign(
        { userId: newUser.id, name: newUser.name, identity: newUser.identity, courses: newUser.activeCourses },
        JWT_SECRET,
        { expiresIn: '60d' }
    );

    res.json({
        token,
        name: newUser.name,
        user: {
            id: newUser.id,
            name: newUser.name,
            identity: newUser.identity,
            courses: newUser.activeCourses
        }
    });
});

// Public: Student Login (User Account + Device Binding Check)
app.post('/api/login-user', (req, res) => {
    const { identity, password, deviceId } = req.body;
    if (!identity || !password) {
        return res.status(400).json({ error: 'يرجى إدخال رقم الهاتف/البريد وكلمة المرور' });
    }

    const cleanIdentity = identity.trim().toLowerCase();
    const data = readJSON('user_accounts.json');
    const user = (data.users || []).find(u => u.identity === cleanIdentity);

    if (!user) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    if (user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // Single Device Binding Security Check
    if (deviceId) {
        if (!user.deviceId) {
            // First login — bind this device to the user account
            user.deviceId = deviceId;
            writeJSON('user_accounts.json', data);
        } else if (user.deviceId !== deviceId) {
            return res.status(403).json({ error: 'هذا الحساب مرتبط بجهاز آخر. تواصل مع المدرب لإعادة تعيين الجهاز.' });
        }
    }

    user.lastLogin = new Date().toISOString();
    writeJSON('user_accounts.json', data);

    const token = jwt.sign(
        { userId: user.id, name: user.name, identity: user.identity, courses: user.activeCourses },
        JWT_SECRET,
        { expiresIn: '60d' }
    );

    res.json({
        token,
        name: user.name,
        user: {
            id: user.id,
            name: user.name,
            identity: user.identity,
            courses: user.activeCourses
        }
    });
});

// Authenticated: Activate Course Code
app.post('/api/activate-code', auth, (req, res) => {
    const { code } = req.body;
    if (!code || !code.trim()) {
        return res.status(400).json({ error: 'يرجى إدخال كود التفعيل' });
    }

    const cleanCode = code.trim().toUpperCase();
    const studentsData = readJSON('students.json');
    const studentEntry = (studentsData.students || []).find(s => s.code === cleanCode);

    if (!studentEntry) {
        return res.status(404).json({ error: 'كود التفعيل غير صحيح، يرجى التأكد من الكود' });
    }

    if (!studentEntry.active) {
        return res.status(403).json({ error: 'هذا الكود غير مفعّل، يرجى التواصل مع المدرب' });
    }

    const usersData = readJSON('user_accounts.json');
    const user = (usersData.users || []).find(u => u.id === req.student.userId || u.identity === req.student.identity);

    if (!user) {
        return res.status(404).json({ error: 'لم يتم العثور على بيانات الحساب، يرجى تسجيل الدخول بحسابك أولاً' });
    }

    // Check if code was already claimed by another user account
    if (studentEntry.claimedByUserId && studentEntry.claimedByUserId !== user.id) {
        return res.status(400).json({ error: 'هذا الكود تم تفعيله مسبقاً من قبل حساب آخر' });
    }

    // Claim code for this user & add courses
    studentEntry.claimedByUserId = user.id;
    writeJSON('students.json', studentsData);

    const newCourses = studentEntry.courses || [];

    newCourses.forEach(c => {
        if (!user.activeCourses.includes(c)) {
            user.activeCourses.push(c);
        }
    });

    if (!user.activatedCodes.includes(cleanCode)) {
        user.activatedCodes.push(cleanCode);
    }

    writeJSON('user_accounts.json', usersData);

    const token = jwt.sign(
        { userId: user.id, name: user.name, identity: user.identity, courses: user.activeCourses },
        JWT_SECRET,
        { expiresIn: '60d' }
    );

    res.json({
        message: '🎉 تم تفعيل الكورس بنجاح واضافته لحسابك!',
        token,
        courses: user.activeCourses
    });
});

// Authenticated: Get Current User Profile
app.get('/api/me', auth, (req, res) => {
    const usersData = readJSON('user_accounts.json');
    const user = (usersData.users || []).find(u => u.id === req.student.userId || u.identity === req.student.identity);

    if (user) {
        return res.json({
            id: user.id,
            name: user.name,
            identity: user.identity,
            courses: user.activeCourses || [],
            deviceId: user.deviceId
        });
    }

    // Fallback for code-only legacy tokens
    res.json({
        code: req.student.code,
        name: req.student.name,
        courses: req.student.courses || []
    });
});

// ─── Student: Direct Code Login (Legacy Support) ─────────────────────────
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

// ─── Admin: User & Device Management ─────────────────────────────────────
app.get('/api/admin/users', adminAuth, (_req, res) => {
    const usersData = readJSON('user_accounts.json');
    res.json(usersData);
});

app.delete('/api/admin/users/:userId/device', adminAuth, (req, res) => {
    const usersData = readJSON('user_accounts.json');
    const user = (usersData.users || []).find(u => u.id === req.params.userId);
    if (!user) return res.status(404).json({ error: 'الحساب غير موجود' });

    user.deviceId = null;
    writeJSON('user_accounts.json', usersData);
    res.json({ message: `تم فك ربط جهاز الحساب ${user.name} بنجاح ✅` });
});

app.delete('/api/admin/students/:code/device', adminAuth, (req, res) => {
    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === req.params.code);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    student.deviceId = null;
    writeJSON('students.json', data);
    res.json({ message: `تم فك ربط جهاز ${student.name} ✅` });
});

// ─── Video Streaming Helper ───────────────────────────────────────────────
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
        '.mp4':  'video/mp4',
        '.m4v':  'video/mp4',
        '.webm': 'video/webm',
        '.mov':  'video/quicktime',
        '.ogg':  'video/ogg',
        '.ogv':  'video/ogg',
        '.mkv':  'video/x-matroska'
    };
    return mimeMap[ext] || 'video/mp4';
}

function streamVideoFile(req, res, videoPath, filename) {
    const safeFilename = filename ? path.basename(filename) : '';
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'الفيديو غير موجود' });
    }

    const stat     = fs.statSync(videoPath);
    const fileSize = stat.size;
    const mime     = getMimeType(safeFilename);
    const range    = req.headers.range;

    // ─── CRITICAL: Bypass Cloudflare CDN caching for video streams ─────
    // Cloudflare overrides Cache-Control, so we MUST use their specific header
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    if (range) {
        // ─── Range request: parse and serve chunk ──────────────────────
        const parts = range.replace(/bytes=/, '').split('-');
        let start, end;

        if (parts[0] === '') {
            // Suffix range: bytes=-N  (Safari moov atom)
            const suffixLength = parseInt(parts[1], 10);
            if (!isNaN(suffixLength) && suffixLength > 0) {
                start = Math.max(0, fileSize - suffixLength);
                end   = fileSize - 1;
            } else {
                start = 0;
                end   = fileSize - 1;
            }
        } else {
            start = parseInt(parts[0], 10);
            end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        }

        // Clamp
        if (start < 0) start = 0;
        if (end >= fileSize) end = fileSize - 1;
        if (start > end || start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': chunkSize,
            'Content-Type':   mime,
        });
        fs.createReadStream(videoPath, { start, end }).pipe(res);

    } else {
        // ─── No Range header: serve full file with 200 OK ─────────────
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges':  'bytes',
            'Content-Type':   mime,
        });
        fs.createReadStream(videoPath).pipe(res);
    }
}

// ─── Public: Preview videos (no auth) ─────────────────────────────────────
app.get('/api/public/video/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const videoPath = path.join(videosDir, 'public', filename);
    streamVideoFile(req, res, videoPath, filename);
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
    const course   = decodeURIComponent(req.params.course);
    const filename = decodeURIComponent(req.params.filename);

    const { students } = readJSON('students.json');
    const student = students.find(s => s.code === req.student.code);

    if (!student || !student.active) {
        return res.status(403).json({ error: 'غير مصرح' });
    }

    const studentCourses = student.courses || [];
    if (!studentCourses.includes('all') && !studentCourses.includes(course)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية الوصول لهذا الكورس' });
    }

    const videoPath = path.join(videosDir, course, filename);
    streamVideoFile(req, res, videoPath, filename);
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

// ─── Admin: Update student name ───────────────────────────────────────────
app.patch('/api/admin/students/:code/name', adminAuth, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'يرجى إدخال اسم صحيح' });
    const data    = readJSON('students.json');
    const student = data.students.find(s => s.code === req.params.code);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    student.name = name.trim();
    writeJSON('students.json', data);
    res.json({ message: 'تم تحديث الاسم بنجاح ✅' });
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

// ─── Question attachments upload ──────────────────────────────────────────
const attachDir = path.join(STORAGE_DIR, 'uploads', 'questions');
fs.mkdirSync(attachDir, { recursive: true });

const attachStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, attachDir),
    filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});
const uploadAttach = multer({
    storage: attachStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const okMime = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','application/octet-stream'];
        const okExt  = ['.jpg','.jpeg','.png','.gif','.webp','.pdf'];
        const ext    = path.extname(file.originalname).toLowerCase();
        (okMime.includes(file.mimetype) || okExt.includes(ext)) ? cb(null, true) : cb(new Error('يرجى رفع صورة أو PDF فقط'));
    }
});

app.post('/api/upload-attachment', auth, (req, res, next) => {
    uploadAttach.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    res.json({ filename: req.file.filename, url: `/uploads/questions/${req.file.filename}` });
});

app.post('/api/admin/upload-attachment', adminAuth, (req, res, next) => {
    uploadAttach.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    res.json({ filename: req.file.filename, url: `/uploads/questions/${req.file.filename}` });
});

app.use('/uploads/questions', express.static(attachDir));

// ─── Admin: Course Settings ────────────────────────────────────────────────
app.get('/api/admin/courses', adminAuth, (_req, res) => {
    const { courses } = readJSON('videos.json');
    res.json({ courses });
});

app.patch('/api/admin/courses/:id', adminAuth, (req, res) => {
    const { id } = req.params;
    const { coverImage } = req.body;
    
    const data = readJSON('videos.json');
    const courseIndex = data.courses.findIndex(c => c.id === id);
    if (courseIndex === -1) return res.status(404).json({ error: 'الكورس غير موجود' });
    
    if (coverImage !== undefined) {
        data.courses[courseIndex].coverImage = coverImage;
    }
    
    writeJSON('videos.json', data);
    res.json({ success: true, course: data.courses[courseIndex] });
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

    // Auto-optimize video for fast web playback (move moov atom to start)
    try {
        const { execSync } = require('child_process');
        const originalPath = req.file.path;
        const tempPath     = path.join(path.dirname(originalPath), 'fast_' + req.file.filename);
        execSync(`ffmpeg -y -i "${originalPath}" -c copy -movflags +faststart "${tempPath}"`, { timeout: 60000 });
        if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
            fs.renameSync(tempPath, originalPath);
        }
    } catch (optErr) {
        console.log('⚠️ Faststart optimization note:', optErr.message);
    }

    let duration = 0;
    try {
        const { execSync } = require('child_process');
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${req.file.path}"`;
        const output = execSync(cmd).toString().trim();
        duration = Math.round(parseFloat(output)) || 0;
    } catch (err) {
        console.error('Error extracting duration:', err.message);
    }

    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    course.videos.push({
        id:         Date.now(),
        title:      title || req.file.originalname,
        filename:   req.file.filename,
        duration:   duration,
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
    const courseId = decodeURIComponent(req.params.courseId);
    const filename = decodeURIComponent(req.params.filename);
    const videoPath = path.join(videosDir, courseId, filename);
    streamVideoFile(req, res, videoPath, filename);
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

// ─── Admin: Rename video title ─────────────────────────────────────────────
app.patch('/api/admin/videos/:courseId/:videoId/title', adminAuth, (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'العنوان مطلوب' });

    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const videoId = parseInt(req.params.videoId);
    const video   = course.videos.find(v => v.id === videoId);
    if (!video) return res.status(404).json({ error: 'الفيديو غير موجود' });

    video.title = title.trim();
    writeJSON('videos.json', data);
    res.json({ message: 'تم تحديث العنوان', title: video.title });
});

// ─── Admin: Replace video file ─────────────────────────────────────────────
app.post('/api/admin/videos/:courseId/:videoId/replace', adminAuth, (req, res, next) => {
    upload.single('video')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'فشل رفع الملف' });
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف الفيديو' });

    const { courseId, videoId } = req.params;
    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const video = course.videos.find(v => String(v.id) === String(videoId));
    if (!video) return res.status(404).json({ error: 'الفيديو غير موجود' });

    // Auto-optimize video for fast web playback (move moov atom to start)
    try {
        const { execSync } = require('child_process');
        const originalPath = req.file.path;
        const tempPath     = path.join(path.dirname(originalPath), 'fast_' + req.file.filename);
        execSync(`ffmpeg -y -i "${originalPath}" -c copy -movflags +faststart "${tempPath}"`, { timeout: 60000 });
        if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
            fs.renameSync(tempPath, originalPath);
        }
    } catch (optErr) {
        console.log('⚠️ Faststart optimization note:', optErr.message);
    }

    let duration = 0;
    try {
        const { execSync } = require('child_process');
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${req.file.path}"`;
        const output = execSync(cmd).toString().trim();
        duration = Math.round(parseFloat(output)) || 0;
    } catch (err) {
        console.error('Error extracting duration:', err.message);
    }

    // Remove old file from disk
    if (video.filename) {
        const oldPath = path.join(videosDir, courseId, video.filename);
        if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (_) {}
        }
    }

    video.filename = req.file.filename;
    if (duration > 0) video.duration = duration;
    video.updatedAt = new Date().toISOString();
    writeJSON('videos.json', data);

    res.json({ message: 'تم استبدال ملف الفيديو بنجاح', filename: req.file.filename });
});

// ─── Admin: Reorder videos ─────────────────────────────────────────────────
app.patch('/api/admin/videos/:courseId/reorder', adminAuth, (req, res) => {
    const { order } = req.body; // array of video IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'بيانات الترتيب غير صالحة' });

    const data   = readJSON('videos.json');
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const orderStrings = order.map(String);
    course.videos.sort((a, b) => {
        const idxA = orderStrings.indexOf(String(a.id));
        const idxB = orderStrings.indexOf(String(b.id));
        return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
    });
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
    const { courseId, videoId, videoTitle, text, link } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'يرجى كتابة ملاحظتك أو سؤالك' });

    const data = readJSON('questions.json');
    const note = {
        id:          Date.now(),
        studentCode: req.student.code,
        studentName: req.student.name,
        courseId,
        videoId,
        videoTitle,
        text:            text.trim(),
        link:            link?.trim() || null,
        attachment:      req.body.attachment || null,
        reply:           null,
        replyLink:       null,
        replyAttachment: null,
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
    const { reply, replyLink, replyAttachment } = req.body;
    if (!reply?.trim() && !replyLink?.trim() && !replyAttachment) return res.status(400).json({ error: 'يرجى كتابة الرد أو إضافة رابط أو ملف' });

    const data = readJSON('questions.json');
    const q    = data.questions.find(q => q.id === parseInt(req.params.id));
    if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });

    q.reply           = reply?.trim() || null;
    q.replyLink       = replyLink?.trim() || null;
    q.replyAttachment = req.body.replyAttachment || null;
    q.repliedAt       = new Date().toISOString();
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

// ─── Course Registrations ──────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
    const { fullName, age, experience, telegram, whatsapp, instagram, course } = req.body;
    if (!fullName?.trim() || !whatsapp?.trim() || !instagram?.trim()) return res.status(400).json({ error: 'الاسم، رقم الواتساب ويوزر الانستا مطلوبات' });
    const data = readJSON('registrations.json');
    data.registrations.push({
        id:         Date.now(),
        fullName:   fullName.trim(),
        age:        age?.trim() || '',
        experience: experience?.trim() || '',
        telegram:   telegram?.trim() || '',
        whatsapp:   whatsapp.trim(),
        instagram:  instagram.trim(),
        course:     course?.trim() || '',
        createdAt:  new Date().toISOString()
    });
    writeJSON('registrations.json', data);
    res.json({ message: 'تم استلام طلبك بنجاح ✅' });
});

app.get('/api/admin/registrations', adminAuth, (req, res) => {
    res.json(readJSON('registrations.json'));
});

app.delete('/api/admin/registrations/:id', adminAuth, (req, res) => {
    const data = readJSON('registrations.json');
    data.registrations = data.registrations.filter(r => r.id !== parseInt(req.params.id));
    writeJSON('registrations.json', data);
    res.json({ message: 'تم الحذف' });
});

// ─── Receipts ──────────────────────────────────────────────────────────────
app.post('/api/admin/receipts', adminAuth, (req, res) => {
    const data = readJSON('receipts.json');
    const receipt = { id: Date.now(), ...req.body, savedAt: new Date().toISOString() };
    data.receipts.unshift(receipt);
    writeJSON('receipts.json', data);
    res.json({ message: 'تم الحفظ', id: receipt.id });
});

app.get('/api/admin/receipts', adminAuth, (_req, res) => {
    res.json(readJSON('receipts.json'));
});

app.delete('/api/admin/receipts/:id', adminAuth, (req, res) => {
    const data = readJSON('receipts.json');
    data.receipts = data.receipts.filter(r => r.id !== parseInt(req.params.id));
    writeJSON('receipts.json', data);
    res.json({ message: 'تم الحذف' });
});

// ─── FAQs (Frequently Asked Questions) ───────────────────────────────────
// Public: GET /api/faqs — all published FAQs
app.get('/api/faqs', (_req, res) => {
    const data = readJSON('faqs.json');
    const published = (data.faqs || []).filter(f => f.published !== false);
    res.json({ faqs: published });
});

// Admin: GET /api/admin/faqs — all FAQs (including unpublished)
app.get('/api/admin/faqs', adminAuth, (_req, res) => {
    res.json(readJSON('faqs.json'));
});

// Admin: POST /api/admin/faqs — add new FAQ
app.post('/api/admin/faqs', adminAuth, (req, res) => {
    const { question, answer } = req.body;
    if (!question?.trim() || !answer?.trim()) {
        return res.status(400).json({ error: 'السؤال والجواب مطلوبان' });
    }
    const data = readJSON('faqs.json');
    const faq = {
        id:        Date.now(),
        question:  question.trim(),
        answer:    answer.trim(),
        published: true,
        order:     data.faqs.length,
        createdAt: new Date().toISOString()
    };
    data.faqs.push(faq);
    writeJSON('faqs.json', data);
    res.json({ message: 'تم إضافة السؤال بنجاح ✅', faq });
});

// Admin: PATCH /api/admin/faqs/:id — edit FAQ
app.patch('/api/admin/faqs/:id', adminAuth, (req, res) => {
    const { question, answer, published, order } = req.body;
    const data = readJSON('faqs.json');
    const faq  = data.faqs.find(f => f.id === parseInt(req.params.id));
    if (!faq) return res.status(404).json({ error: 'السؤال غير موجود' });
    if (question !== undefined) faq.question  = question.trim();
    if (answer   !== undefined) faq.answer    = answer.trim();
    if (published !== undefined) faq.published = published;
    if (order    !== undefined) faq.order     = order;
    writeJSON('faqs.json', data);
    res.json({ message: 'تم التحديث بنجاح ✅', faq });
});

// Admin: DELETE /api/admin/faqs/:id — delete FAQ
app.delete('/api/admin/faqs/:id', adminAuth, (req, res) => {
    const data = readJSON('faqs.json');
    data.faqs  = data.faqs.filter(f => f.id !== parseInt(req.params.id));
    writeJSON('faqs.json', data);
    res.json({ message: 'تم الحذف ✅' });
});

// ─── Resources / Files Channel ──────────────────────────────────────────
const resourcesDir = path.join(STORAGE_DIR, 'uploads', 'resources');
fs.mkdirSync(resourcesDir, { recursive: true });

const resourceStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, resourcesDir),
    filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const uploadResource = multer({
    storage: resourceStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
});

// Admin: Upload a new resource
app.post('/api/admin/resources', adminAuth, (req, res, next) => {
    uploadResource.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    
    const { title, courseId } = req.body;
    if (!title?.trim()) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'يرجى إدخال عنوان للملف' });
    }

    const data = readJSON('resources.json');
    const resource = {
        id: Date.now(),
        title: title.trim(),
        courseId: courseId || 'all',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: `/uploads/resources/${req.file.filename}`,
        createdAt: new Date().toISOString()
    };
    
    data.resources.unshift(resource);
    writeJSON('resources.json', data);
    
    res.json({ message: 'تم رفع الملف بنجاح ✅', resource });
});

// Admin: Get all resources
app.get('/api/admin/resources', adminAuth, (_req, res) => {
    res.json(readJSON('resources.json'));
});

// Admin: Delete resource
app.delete('/api/admin/resources/:id', adminAuth, (req, res) => {
    const data = readJSON('resources.json');
    const id = parseInt(req.params.id);
    const resourceIndex = data.resources.findIndex(r => r.id === id);
    
    if (resourceIndex !== -1) {
        const resource = data.resources[resourceIndex];
        const filePath = path.join(resourcesDir, resource.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        data.resources.splice(resourceIndex, 1);
        writeJSON('resources.json', data);
    }
    res.json({ message: 'تم الحذف' });
});

// Serve files
app.use('/uploads/resources', express.static(resourcesDir));

// Student: Get resources filtered by their courses
app.get('/api/resources', auth, (req, res) => {
    const data = readJSON('resources.json');
    const { students } = readJSON('students.json');
    const student = students.find(s => s.code === req.student.code);
    
    if (!student || !student.active) return res.status(403).json({ error: 'غير مصرح' });
    
    const studentCourses = student.courses || [];
    const availableResources = data.resources.filter(r => {
        if (r.courseId === 'all') return true;
        if (studentCourses.includes('all')) return true;
        return studentCourses.includes(r.courseId);
    });
    
    res.json({ resources: availableResources });
});

// ─── PDF Digital Products & Store Routes ─────────────────────────────────
const pdfsDir = path.join(STORAGE_DIR, 'uploads', 'pdfs');
fs.mkdirSync(pdfsDir, { recursive: true });

const pdfStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, pdfsDir),
    filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'pdf-' + unique + ext);
    }
});
const pdfUpload = multer({ storage: pdfStorage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

// Public: Get list of active PDF products
app.get('/api/pdfs', (_req, res) => {
    const data = readJSON('pdfs.json');
    const safePdfs = (data.pdfs || []).map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        priceFormatted: p.priceFormatted || (p.price + ' د.ع'),
        coverUrl: p.coverUrl || '/profile.jpg',
        createdAt: p.createdAt
    }));
    res.json({ pdfs: safePdfs });
});

// Public: Get single PDF details for checkout page
app.get('/api/pdf/:id', (req, res) => {
    const data = readJSON('pdfs.json');
    const pdf = (data.pdfs || []).find(p => p.id === req.params.id);
    if (!pdf) return res.status(404).json({ error: 'ملف الـ PDF غير موجود' });
    res.json({
        id: pdf.id,
        title: pdf.title,
        description: pdf.description,
        price: pdf.price,
        priceFormatted: pdf.priceFormatted || (pdf.price + ' د.ع'),
        coverUrl: pdf.coverUrl || '/profile.jpg'
    });
});

// Public: Checkout PDF (create purchase order)
app.post('/api/pdf/checkout', (req, res) => {
    const { pdfId, name, phone, paymentMethod, referenceCode } = req.body;
    if (!pdfId || !name || !phone) {
        return res.status(400).json({ error: 'يرجى إدخال الاسم ورقم الهاتف والملف المطلوب' });
    }
    if (!referenceCode || !referenceCode.trim()) {
        return res.status(400).json({ error: 'يرجى إدخال رقم الوصل أو كود التحويل لتأكيد طلبك' });
    }
    const pdfsData = readJSON('pdfs.json');
    const pdf = (pdfsData.pdfs || []).find(p => p.id === pdfId);
    if (!pdf) return res.status(404).json({ error: 'الملف غير موجود' });

    const ordersData = readJSON('pdf_orders.json');
    const orderId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    // Create pending order requiring Admin approval
    const order = {
        id: orderId,
        pdfId: pdf.id,
        pdfTitle: pdf.title,
        customerName: name,
        customerPhone: phone,
        paymentMethod: paymentMethod || 'qicard',
        referenceCode: referenceCode.trim(),
        price: pdf.price,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    ordersData.orders.unshift(order);
    writeJSON('pdf_orders.json', ordersData);

    res.json({
        message: 'تم إرسال الطلب بنجاح! طلبك قيد المراجعة وتأكيد التحويل.',
        orderId: order.id,
        status: 'pending'
    });
});

// Public: Lookup order by orderId + phone (so buyer can re-download)
app.post('/api/pdf/order-lookup', (req, res) => {
    const { orderId, phone } = req.body;
    if (!orderId || !phone) {
        return res.status(400).json({ error: 'يرجى إدخال رقم الطلب ورقم الهاتف' });
    }
    const ordersData = readJSON('pdf_orders.json');
    const order = (ordersData.orders || []).find(o => o.id === orderId && o.customerPhone === phone);
    if (!order) return res.status(404).json({ error: 'لم يتم العثور على الطلب. تأكد من رقم الطلب ورقم الهاتف' });

    res.json({
        orderId: order.id,
        pdfTitle: order.pdfTitle,
        status: order.status,
        downloadUrl: order.status === 'approved' ? `/api/pdf/download/${order.id}` : null,
        message: order.status === 'approved' ? 'الطلب مؤكد — يمكنك تنزيل الملف' : 'الطلب قيد المراجعة'
    });
});

// Secure Download Endpoint for Purchased PDF
app.get('/api/pdf/download/:orderId', (req, res) => {
    const ordersData = readJSON('pdf_orders.json');
    const order = (ordersData.orders || []).find(o => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'طلب غير موجود' });
    if (order.status !== 'approved') {
        return res.status(403).json({ error: 'الطلب قيد المراجعة وتأكيد الدفع' });
    }

    const pdfsData = readJSON('pdfs.json');
    const pdf = (pdfsData.pdfs || []).find(p => p.id === order.pdfId);
    if (!pdf || !pdf.filename) return res.status(404).json({ error: 'ملف الـ PDF غير موجود على السيرفر' });

    const filePath = path.join(pdfsDir, pdf.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير متوفر حالياً' });

    // Detect content type from extension
    const ext = path.extname(pdf.filename).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.psd': 'application/octet-stream',
        '.ai': 'application/postscript',
        '.eps': 'application/postscript'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const downloadExt = ext || '.pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(pdf.title)}${downloadExt}"`);
    res.sendFile(filePath);
});

// Admin: Upload new PDF product
app.post('/api/admin/pdfs', adminAuth, pdfUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف PDF' });

    const { title, description, price, priceFormatted, coverUrl } = req.body;
    const data = readJSON('pdfs.json');
    const pdf = {
        id: 'pdf-' + Date.now(),
        title: title || req.file.originalname,
        description: description || '',
        price: parseInt(price, 10) || 0,
        priceFormatted: priceFormatted || (price ? price + ' د.ع' : 'مجاني'),
        filename: req.file.filename,
        coverUrl: coverUrl || '/profile.jpg',
        createdAt: new Date().toISOString()
    };

    data.pdfs.unshift(pdf);
    writeJSON('pdfs.json', data);

    res.json({ message: 'تم رفع وتوفير ملف الـ PDF بنجاح', pdf });
});

// Admin: Delete PDF product
app.delete('/api/admin/pdfs/:id', adminAuth, (req, res) => {
    const data = readJSON('pdfs.json');
    const index = (data.pdfs || []).findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الملف غير موجود' });

    const pdf = data.pdfs[index];
    if (pdf.filename) {
        const filePath = path.join(pdfsDir, pdf.filename);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
        }
    }

    data.pdfs.splice(index, 1);
    writeJSON('pdfs.json', data);

    res.json({ message: 'تم حذف ملف الـ PDF' });
});

// Admin: Get PDF orders
app.get('/api/admin/pdf-orders', adminAuth, (_req, res) => {
    const data = readJSON('pdf_orders.json');
    res.json(data);
});

// Admin: Approve/Reject PDF order
app.post('/api/admin/pdf-orders/approve', adminAuth, (req, res) => {
    const { orderId, action } = req.body;
    const data = readJSON('pdf_orders.json');
    const order = (data.orders || []).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    order.status = action === 'approve' ? 'approved' : 'rejected';
    writeJSON('pdf_orders.json', data);

    res.json({ message: `تم ${action === 'approve' ? 'موافقة' : 'رفض'} الطلب بنجاح`, order });
});

// ─── Express error handler (catch-all) ────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error(`[${new Date().toISOString()}] ❌ EXPRESS ERROR:`, err.stack || err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'حدث خطأ في السيرفر، يرجى المحاولة لاحقاً' });
    }
});

// ─── Start ─────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`\n✅ المنصة تعمل على: http://localhost:${PORT}`);
    console.log(`🔑 مفتاح الأدمن: ${ADMIN_KEY}`);
    console.log(`⚙️  لوحة التحكم:  http://localhost:${PORT}/admin.html`);
    console.log(`💚 Health check:  http://localhost:${PORT}/health\n`);
});

// Keep-alive: prevent idle socket timeouts (Cloudflare has 100s timeout)
server.keepAliveTimeout = 65000;    // 65 seconds
server.headersTimeout   = 66000;    // slightly more than keepAliveTimeout

// ─── Graceful shutdown ────────────────────────────────────────────────────
function shutdown(signal) {
    console.log(`\n⏹  ${signal} received — shutting down gracefully...`);
    server.close(() => {
        console.log('👋 Server closed cleanly.');
        process.exit(0);
    });
    // Force exit after 10 seconds if connections won't close
    setTimeout(() => {
        console.error('⚠️ Forcing shutdown after 10s timeout');
        process.exit(1);
    }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
