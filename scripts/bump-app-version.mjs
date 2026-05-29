#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const versionFile = path.join(repoRoot, "packages/shared/src/version.ts");

let text = fs.readFileSync(versionFile, "utf8");
const re = /APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/;
const m = text.match(re);
if (!m) {
  console.error("bump-app-version: could not parse APP_VERSION in", versionFile);
  process.exit(1);
}

const major = parseInt(m[1], 10);
const minor = parseInt(m[2], 10);
let patch = parseInt(m[3], 10);
patch += 1;

const next = `${major}.${minor}.${patch}`;
text = text.replace(re, `APP_VERSION = "${next}"`);
fs.writeFileSync(versionFile, text);
console.log(`bump-app-version: APP_VERSION -> ${next}`);

const gradleFile = path.join(
  repoRoot,
  "apps/android/android/app/build.gradle"
);
if (fs.existsSync(gradleFile)) {
  let gradle = fs.readFileSync(gradleFile, "utf8");
  const codeRe = /versionCode\s+(\d+)/;
  const codeMatch = gradle.match(codeRe);
  if (codeMatch) {
    const nextCode = parseInt(codeMatch[1], 10) + 1;
    gradle = gradle.replace(codeRe, `versionCode ${nextCode}`);
    gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${next}"`);
    fs.writeFileSync(gradleFile, gradle);
    console.log(`bump-app-version: android versionCode -> ${nextCode}, versionName -> ${next}`);
  }
}

const build = spawnSync(
  "pnpm",
  ["--filter", "@geeklogs/shared", "build"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);
if (build.status !== 0) {
  console.error(
    "bump-app-version: failed to rebuild @geeklogs/shared. The API reads APP_VERSION from packages/shared/dist/version.js; without this rebuild /api/health may report a stale version for the optional update prompt."
  );
  process.exit(build.status === null ? 1 : build.status);
}
