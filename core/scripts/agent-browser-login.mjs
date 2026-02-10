#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const email = process.env.local_email ?? process.env.LOCAL_EMAIL;
const password =
  process.env.local_email_pass ?? process.env.LOCAL_EMAIL_PASS;

if (!email || !password) {
  console.error(
    "Missing credentials. Set local_email and local_email_pass in the environment.",
  );
  process.exit(1);
}

const session = process.env.AGENT_BROWSER_SESSION ?? "lytx";
const baseUrl = process.env.LYTX_BASE_URL ?? "http://localhost:6123";

const run = (args) => {
  const result = spawnSync("agent-browser", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(["--session", session, "set", "device", "iPhone 14"]);
run(["--session", session, "open", `${baseUrl}/login`]);
run(["--session", session, "find", "first", "input[type=email]", "fill", email]);
run([
  "--session",
  session,
  "find",
  "first",
  "input[type=password]",
  "fill",
  password,
]);
run([
  "--session",
  session,
  "find",
  "role",
  "button",
  "click",
  "--name",
  "Sign In",
]);
run(["--session", session, "wait", "--load", "networkidle"]);
run(["--session", session, "open", `${baseUrl}/dashboard`]);
run(["--session", session, "wait", "--text", "Filter"]);
