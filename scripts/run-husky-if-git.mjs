#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(path.join(root, ".git"))) {
  process.exit(0);
}

const huskyBin = path.join(root, "node_modules", "husky", "bin.js");
if (!existsSync(huskyBin)) {
  process.exit(0);
}

const r = spawnSync(process.execPath, [huskyBin], { cwd: root, stdio: "inherit" });
process.exit(r.status === null ? 1 : r.status);
