#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const cliPath = resolve(dirname(fileURLToPath(import.meta.url)), "./setup.ts");
const result = spawnSync("bun", [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("lytx-setup requires Bun to run: npm i -g bun or install via https://bun.sh");
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
