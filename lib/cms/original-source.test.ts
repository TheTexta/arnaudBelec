import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { localOriginal } from "./original-import/source";

test("probing uses the hashed descriptor even when the source symlink is swapped during probing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "arnaud-original-descriptor-"));
  const previousPath = process.env.PATH;
  try {
    const a = join(directory, "a.mp4"), b = join(directory, "b.mp4"), link = join(directory, "source.mp4");
    const bytes = Buffer.alloc(64);
    bytes.writeUInt32BE(24, 0); bytes.write("ftypisom", 4); bytes.write("isomiso2", 16); bytes[40] = 65;
    await writeFile(a, bytes); await writeFile(b, Buffer.from(bytes.map((value, index) => index === 40 ? 66 : value)));
    await symlink(a, link);
    const probe = join(directory, "ffprobe");
    // The synthetic probe swaps the link while opening its input. Reading the
    // inherited descriptor must still observe A, never replacement B.
    await writeFile(probe, `#!${process.execPath}\nconst fs=require('node:fs'); const a=${JSON.stringify(a)},b=${JSON.stringify(b)},link=${JSON.stringify(link)};fs.unlinkSync(link);fs.symlinkSync(b,link);try{const data=fs.readFileSync(process.argv.at(-1));console.log(JSON.stringify({format:{duration:'1'},streams:[{codec_type:'video',codec_name:'h264',width:data[40]===65?1920:640,height:1080}]}));}finally{fs.unlinkSync(link);fs.symlinkSync(a,link);}\n`);
    await chmod(probe, 0o700); process.env.PATH = directory + ":" + previousPath;
    const result = await localOriginal(link).scan();
    assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(result.probe.width, 1920);
    assert.deepEqual(await readFile(a), bytes);
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
