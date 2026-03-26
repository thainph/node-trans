import { spawn } from "child_process";
import { Transform } from "stream";

const CHUNK_SIZE = 3840; // 120ms at 16kHz mono 16-bit
const IS_WIN = process.platform === "win32";

class ChunkTransform extends Transform {
  constructor() {
    super();
    this.pending = Buffer.alloc(0);
  }

  _transform(data, encoding, callback) {
    this.pending = Buffer.concat([this.pending, data]);
    while (this.pending.length >= CHUNK_SIZE) {
      this.push(this.pending.subarray(0, CHUNK_SIZE));
      this.pending = this.pending.subarray(CHUNK_SIZE);
    }
    callback();
  }

  _flush(callback) {
    if (this.pending.length > 0) {
      this.push(this.pending);
    }
    callback();
  }
}

/**
 * @param {number|string} device - Device index (macOS) or device name (Windows)
 */
export function startCapture(device) {
  const args = IS_WIN
    ? ["-f", "dshow", "-i", `audio=${device}`]
    : ["-f", "avfoundation", "-i", `:${device}`];

  args.push(
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-f", "s16le",
    "pipe:1",
  );

  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const ffmpeg = spawn(ffmpegBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let paused = false;

  // Gate: when paused, drop audio data (ffmpeg keeps running but Soniox gets nothing)
  const gate = new Transform({
    transform(chunk, enc, cb) {
      if (!paused) this.push(chunk);
      cb();
    },
  });

  const chunker = new ChunkTransform();
  ffmpeg.stdout.pipe(gate).pipe(chunker);

  // Suppress ffmpeg stderr noise
  ffmpeg.stderr.on("data", () => {});

  return {
    stream: chunker,
    process: ffmpeg,

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    stop() {
      if (IS_WIN) {
        // On Windows, write 'q' to stdin for graceful exit, then force kill as fallback
        try {
          ffmpeg.stdin.write("q");
        } catch {}
        setTimeout(() => {
          try { ffmpeg.kill(); } catch {}
        }, 500);
      } else {
        ffmpeg.kill("SIGTERM");
      }
    },

    onError(callback) {
      ffmpeg.on("error", callback);
      ffmpeg.on("exit", (code) => {
        if (code && code !== 0 && code !== 255) {
          callback(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    },
  };
}
