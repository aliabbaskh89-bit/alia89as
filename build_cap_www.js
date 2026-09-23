const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = [
    'index.html',
    'platform.html',
    'admin.html',
    'login.html',
    'en.html',
    'pdf.html',
    'styles-v21.css',
    'platform.css',
    'pdf.css',
    'pwa-install.css',
    'pwa-install.js',
    'script.js',
    'platform.js',
    'manifest.json',
    'manifest-platform.json',
    'manifest-admin.json',
    'sw.js',
    'logocopy.png',
    'profile.jpg',
    'icon.png',
    'logo.svg'
];

const dirsToCopy = ['font', 'branding', 'data'];

// Copy individual files
filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// Copy directories
dirsToCopy.forEach(dir => {
    const srcPath = path.join(srcDir, dir);
    const destPath = path.join(destDir, dir);
    if (fs.existsSync(srcPath)) {
        fs.cpSync(srcPath, destPath, { recursive: true });
    }
});

console.log('✅ www directory updated successfully for Capacitor bundle!');
