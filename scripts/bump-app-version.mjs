#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFile = path.join(__dirname, "../packages/shared/src/version.ts");

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
