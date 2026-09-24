const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, 'data', 'videos.json');
const videosDir = path.join(__dirname, 'videos');

function readJSON(file) {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function getVideoDuration(filePath) {
    try {
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
        const output = execSync(cmd).toString().trim();
        return parseFloat(output);
    } catch (e) {
        console.error(`Error getting duration for ${filePath}:`, e.message);
        return 0;
    }
}

async function backfill() {
    const data = readJSON(dataPath);
    if (!data.courses) return;

    let updated = false;

    for (const course of data.courses) {
        if (!course.videos) continue;
        for (const video of course.videos) {
            if (video.duration === undefined || video.duration === 0) {
                const videoPath = path.join(videosDir, course.id, video.filename);
                if (fs.existsSync(videoPath)) {
                    console.log(`Calculating duration for ${course.id}/${video.filename}...`);
                    const duration = getVideoDuration(videoPath);
                    if (duration > 0) {
                        video.duration = Math.round(duration);
                        updated = true;
                        console.log(`  -> ${video.duration} seconds`);
                    }
                } else {
                    console.log(`File not found: ${videoPath}`);
                }
            }
        }
    }

    if (updated) {
        writeJSON(dataPath, data);
        console.log('Successfully updated videos.json with durations.');
    } else {
        console.log('No new durations were calculated.');
    }
}

backfill();
