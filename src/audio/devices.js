import { spawn, execFile } from "child_process";

const IS_WIN = process.platform === "win32";

// Input devices — used for mic & system audio capture
export async function listInputDevices() {
  return IS_WIN ? listInputDevicesWindows() : listInputDevicesMac();
}

// Output devices — for system audio setting display
export async function listOutputDevices() {
  return IS_WIN ? listOutputDevicesWindows() : listOutputDevicesMac();
}

// Check if ffmpeg is available
export function checkFfmpeg() {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: ["pipe", "pipe", "pipe"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

// Combined: returns { input: [...], output: [...], ffmpegAvailable: bool }
export async function listAllDevices() {
  const ffmpegAvailable = await checkFfmpeg();
  if (!ffmpegAvailable) {
    return { input: [], output: [], ffmpegAvailable: false };
  }
  const [input, output] = await Promise.all([listInputDevices(), listOutputDevices()]);
  return { input, output, ffmpegAvailable: true };
}

// ─── macOS ───────────────────────────────────────────────

function listInputDevicesMac() {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f", "avfoundation",
      "-list_devices", "true",
      "-i", "",
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", () => {
      resolve(parseAvfoundation(stderr));
    });
  });
}

const TRANSPORT_LABELS = {
  coreaudio_device_type_bluetooth: "Bluetooth",
  coreaudio_device_type_builtin: "Built-in",
  coreaudio_device_type_hdmi: "HDMI",
  coreaudio_device_type_usb: "USB",
  coreaudio_device_type_virtual: "Virtual",
  coreaudio_device_type_unknown: "Aggregate",
};

function listOutputDevicesMac() {
  return new Promise((resolve) => {
    execFile("system_profiler", ["SPAudioDataType", "-json"], (err, stdout) => {
      if (err) return resolve([]);
      try {
        const data = JSON.parse(stdout);
        const items = data.SPAudioDataType?.[0]?._items || [];
        const outputs = items
          .filter((d) => d.coreaudio_device_output)
          .map((d) => ({
            name: d._name,
            transport: TRANSPORT_LABELS[d.coreaudio_device_transport] || "",
            isDefault: !!d.coreaudio_default_audio_output_device,
          }));
        resolve(outputs);
      } catch {
        resolve([]);
      }
    });
  });
}

function parseAvfoundation(stderr) {
  const lines = stderr.split("\n");
  const devices = [];
  let inAudioSection = false;

  for (const line of lines) {
    if (line.includes("AVFoundation audio devices:")) {
      inAudioSection = true;
      continue;
    }
    if (inAudioSection && line.includes("AVFoundation") && !line.match(/\]\s+\[\d+\]/)) {
      break;
    }
    if (inAudioSection) {
      const match = line.match(/\]\s+\[(\d+)\]\s+(.+)/);
      if (match) {
        devices.push({
          index: parseInt(match[1]),
          name: match[2].trim(),
        });
      }
    }
  }

  return devices;
}

// ─── Windows ─────────────────────────────────────────────

function listInputDevicesWindows() {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f", "dshow",
      "-list_devices", "true",
      "-i", "dummy",
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (err) => {
      console.error("[devices] ffmpeg spawn error:", err.message);
      resolve([]);
    });
    ffmpeg.on("close", () => {
      console.log("[devices] ffmpeg dshow raw output:\n" + stderr);
      const devices = parseDshow(stderr);
      console.log("[devices] parsed devices:", devices);
      resolve(devices);
    });
  });
}

function listOutputDevicesWindows() {
  return new Promise((resolve) => {
    // Use PowerShell to list audio output devices
    execFile("powershell", [
      "-NoProfile", "-Command",
      "Get-CimInstance Win32_SoundDevice | Select-Object Name, Status | ConvertTo-Json -Compress",
    ], (err, stdout) => {
      if (err) return resolve([]);
      try {
        let data = JSON.parse(stdout);
        if (!Array.isArray(data)) data = [data];
        resolve(data.map((d) => ({
          name: d.Name || "Unknown",
          transport: "",
          isDefault: false,
        })));
      } catch {
        resolve([]);
      }
    });
  });
}

function parseDshow(stderr) {
  const lines = stderr.split("\n");
  const devices = [];
  let index = 0;

  // Check if old format with section headers (ffmpeg <7)
  const hasHeaders = lines.some((l) => l.includes("DirectShow audio devices"));

  if (hasHeaders) {
    // Old format: section-based parsing
    let inAudioSection = false;
    for (const line of lines) {
      if (line.includes("DirectShow audio devices")) {
        inAudioSection = true;
        continue;
      }
      if (inAudioSection && line.includes("DirectShow video devices")) {
        break;
      }
      if (inAudioSection && !line.includes("Alternative name")) {
        const match = line.match(/"(.+?)"/);
        if (match) {
          devices.push({ index: index++, name: match[1] });
        }
      }
    }
  } else {
    // New format (ffmpeg 7+): "Device Name" (audio)
    for (const line of lines) {
      if (line.includes("Alternative name")) continue;
      const match = line.match(/"(.+?)"\s*\(audio\)/);
      if (match) {
        devices.push({ index: index++, name: match[1] });
      }
    }
  }

  return devices;
}
