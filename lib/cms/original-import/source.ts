import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { open, realpath, stat, type FileHandle } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { MAX_ORIGINAL_BYTES, validateManifest, type Manifest, type Source } from "./core";

async function probeDescriptor(fd: number) {
  // /dev/fd/3 anchors ffprobe to the same seekable original we hash. Opening the
  // pathname again would permit a symlink-swap race between hash and probe.
  const child = spawn("ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-probesize", "16777216", "-analyzeduration", "10000000", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", "-i", "/dev/fd/3"], {
    stdio: ["ignore", "pipe", "pipe", fd], signal: AbortSignal.timeout(30_000),
    env: { PATH: process.env.PATH, LANG: process.env.LANG || "C", NODE_ENV: process.env.NODE_ENV || "production" },
  });
  return new Promise<string>((resolve, reject) => {
    let output = "";
    let bytes = 0;
    const consume = (chunk: Buffer, stdout: boolean) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) child.kill();
      else if (stdout) output += chunk.toString("utf8");
    };
    child.stdout!.on("data", chunk => consume(chunk, true));
    child.stderr!.on("data", chunk => consume(chunk, false));
    child.once("error", () => reject(new Error("Bounded original probe failed.")));
    child.once("close", code => code === 0 && bytes <= 1024 * 1024 ? resolve(output) : reject(new Error("Bounded original probe failed.")));
  });
}
export function localOriginal(path: string): Source {
  const absolute = resolve(path);
  async function identity() {
    const canonical = await realpath(absolute);
    const info = await stat(absolute, { bigint: true });
    if (!info.isFile() || info.size < BigInt(1) || info.size > BigInt(MAX_ORIGINAL_BYTES) || extname(absolute).toLowerCase() !== ".mp4") throw new Error("Expected a regular MP4 original of 1 byte to 8 GiB.");
    return { path: canonical, dev: String(info.dev), ino: String(info.ino), size: String(info.size), mtime: String(info.mtimeNs), ctime: String(info.ctimeNs) };
  }
  async function assertIdentity(expected: Manifest["identity"]) {
    const actual = await identity();
    if (Object.entries(actual).some(([key, value]) => expected[key] !== value)) throw new Error("Source identity changed; original not modified by importer.");
  }
  async function assertOpened(handle: FileHandle, expected: Manifest["identity"]) {
    const info = await handle.stat({ bigint: true });
    if (String(info.dev) !== expected.dev || String(info.ino) !== expected.ino || String(info.size) !== expected.size || String(info.mtimeNs) !== expected.mtime || String(info.ctimeNs) !== expected.ctime) throw new Error("Opened source identity changed.");
  }
  return {
    assertIdentity,
    async scan() {
      const before = await identity();
      const handle = await open(absolute, "r");
      const digest = createHash("sha256");
      let bytes = 0;
      let prefix = Buffer.alloc(0);
      let stdout = "";
      try {
        await assertOpened(handle, before);
        // Explicit positional reads leave the inherited descriptor at offset 0.
        for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) {
          bytes += chunk.length;
          if (bytes > MAX_ORIGINAL_BYTES) throw new Error("Original exceeds 8 GiB.");
          digest.update(chunk);
          if (prefix.length < 8192) prefix = Buffer.concat([prefix, chunk.subarray(0, 8192 - prefix.length)]);
        }
        await assertOpened(handle, before);
        if (bytes !== Number(before.size) || (await fileTypeFromBuffer(prefix))?.mime !== "video/mp4") throw new Error("Original MP4 bytes do not match the manifest.");
        stdout = await probeDescriptor(handle.fd);
        await assertOpened(handle, before);
        await assertIdentity(before);
      } finally { await handle.close(); }
      const result = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; codec_name: string; width?: number; height?: number }[] };
      const video = result.streams?.filter(stream => stream.codec_type === "video");
      if (video?.length !== 1) throw new Error("Expected exactly one video stream.");
      await assertIdentity(before);
      const manifest: Manifest = { filename: basename(absolute), bytes, sha256: digest.digest("hex"), identity: before, probe: { duration: Number(result.format?.duration), width: video[0].width!, height: video[0].height!, videoCodec: video[0].codec_name, audioCodecs: result.streams!.filter(stream => stream.codec_type === "audio").map(stream => stream.codec_name) } };
      validateManifest(manifest);
      return manifest;
    },
    async part(offset, bytes, expected) {
      await assertIdentity(expected);
      const handle = await open(absolute, "r");
      try {
        await assertOpened(handle, expected);
        const body = Buffer.alloc(bytes);
        let read = 0;
        while (read < bytes) {
          const result = await handle.read(body, read, bytes - read, offset + read);
          if (!result.bytesRead) throw new Error("Source ended during part read.");
          read += result.bytesRead;
        }
        await assertOpened(handle, expected);
        await assertIdentity(expected);
        return body;
      } finally { await handle.close(); }
    },
  };
}
