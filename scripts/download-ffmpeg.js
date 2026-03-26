/**
 * Download/copy FFmpeg binary for electron-builder packaging.
 *
 * Usage:
 *   node scripts/download-ffmpeg.js          # current platform
 *   node scripts/download-ffmpeg.js --win    # Windows x64 (cross-platform)
 *   node scripts/download-ffmpeg.js --mac    # macOS (from ffmpeg-static)
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const forceWin = args.includes("--win");
const forceMac = args.includes("--mac");

const targetPlatform = forceWin ? "win" : forceMac ? "mac" : (process.platform === "win32" ? "win" : "mac");

if (targetPlatform === "mac") {
  // macOS: copy from ffmpeg-static (only works on macOS host)
  const ffmpegStaticPath = require("ffmpeg-static");
  if (!ffmpegStaticPath || !fs.existsSync(ffmpegStaticPath)) {
    console.error("ffmpeg-static binary not found. Run: npm install ffmpeg-static");
    process.exit(1);
  }

  const destDir = path.join(ROOT, "ffmpeg-bin", "mac");
  const destPath = path.join(destDir, "ffmpeg");

  if (fs.existsSync(destPath)) {
    console.log(`FFmpeg binary already exists at ${destPath}, skipping.`);
    process.exit(0);
  }

  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(ffmpegStaticPath, destPath);
  fs.chmodSync(destPath, 0o755);
  console.log(`Copied FFmpeg binary to ${destPath}`);
} else {
  // Windows: download ffmpeg from GitHub (BtbN release)
  const destDir = path.join(ROOT, "ffmpeg-bin", "win");
  const destPath = path.join(destDir, "ffmpeg.exe");

  if (fs.existsSync(destPath)) {
    console.log(`FFmpeg binary already exists at ${destPath}, skipping.`);
    process.exit(0);
  }

  fs.mkdirSync(destDir, { recursive: true });

  const ZIP_NAME = "ffmpeg-n7.1-latest-win64-gpl-7.1.zip";
  const DOWNLOAD_URL = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${ZIP_NAME}`;
  const zipPath = path.join(ROOT, "ffmpeg-bin", ZIP_NAME);

  console.log(`Downloading FFmpeg for Windows from ${DOWNLOAD_URL}...`);

  await downloadFile(DOWNLOAD_URL, zipPath);
  console.log("Download complete. Extracting ffmpeg.exe...");

  // Extract only ffmpeg.exe from the zip
  try {
    // Use unzip (available on macOS/Linux) or PowerShell on Windows
    if (process.platform === "win32") {
      execSync(
        `powershell -Command "Add-Type -A System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead('${zipPath}'); $entry = $zip.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' -and $_.FullName -like '*/bin/ffmpeg.exe' } | Select-Object -First 1; [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '${destPath}', $true); $zip.Dispose()"`,
        { stdio: "inherit" }
      );
    } else {
      // macOS/Linux: use unzip with -j (junk paths) to extract only ffmpeg.exe
      execSync(
        `unzip -o -j "${zipPath}" "*/bin/ffmpeg.exe" -d "${destDir}"`,
        { stdio: "inherit" }
      );
    }

    if (!fs.existsSync(destPath)) {
      console.error("Failed to extract ffmpeg.exe from archive.");
      process.exit(1);
    }

    console.log(`Extracted FFmpeg binary to ${destPath}`);
  } finally {
    // Clean up zip
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      console.log("Cleaned up downloaded archive.");
    }
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = parseInt(res.headers["content-length"], 10) || 0;
        let downloaded = 0;

        const file = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\rDownloading... ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log("");
          resolve();
        });
        file.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}
