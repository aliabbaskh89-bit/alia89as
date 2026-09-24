const fs = require('fs');
const path = require('path');

const dir = '/Users/aliabbas/Desktop/por';
const files = [
    'index.html',
    'admin.html',
    'login.html',
    'en.html',
    'platform.html',
    'test.html',
    'styles-v21.css',
    'platform.css'
];

const fontImportCSS = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap');\n`;
const fontImportHTML = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet">\n`;

files.forEach(f => {
    let p = path.join(dir, f);
    if (!fs.existsSync(p)) return;
    let content = fs.readFileSync(p, 'utf8');
    
    // For CSS files, remove old @font-face rules
    if (f.endsWith('.css')) {
        content = content.replace(/@font-face\s*\{[^}]+\}/g, '');
        // Add @import at the very top if not already there
        if (!content.includes('family=IBM+Plex+Sans+Arabic')) {
            content = fontImportCSS + content;
        }
    }
    
    // Replace font family names
    content = content.replace(/'GraphikArabic'/gi, "'IBM Plex Sans Arabic'");
    content = content.replace(/'Graphik Arabic'/gi, "'IBM Plex Sans Arabic'");
    content = content.replace(/"Graphik Arabic"/gi, "'IBM Plex Sans Arabic'");
    content = content.replace(/GraphikArabic/gi, "IBM Plex Sans Arabic");
    
    // For HTML files, we can also add the <link> to be safe
    if (f.endsWith('.html') && !content.includes('family=IBM+Plex+Sans+Arabic')) {
        content = content.replace(/<\/title>/, `</title>\n    ${fontImportHTML}`);
    }
    
    fs.writeFileSync(p, content, 'utf8');
});
console.log('Fonts replaced successfully.');
