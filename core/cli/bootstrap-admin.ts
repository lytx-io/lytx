#!/usr/bin/env bun

import { execSync } from "node:child_process";
import { randomBytes, scrypt } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { randomName } from "@lib/random_name";

type QueryRow = Record<string, unknown>;

const args = process.argv.slice(2);

const hasFlag = (flag: string) => args.includes(flag);

const getOptionalArg = (flag: string, shortFlag?: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index !== -1) {
    const value = args[index + 1];
    if (value && !value.startsWith("-")) return value;
    return undefined;
  }

  if (!shortFlag) return undefined;
  const shortIndex = args.indexOf(shortFlag);
  if (shortIndex !== -1) {
    const value = args[shortIndex + 1];
    if (value && !value.startsWith("-")) return value;
  }
  return undefined;
};

const getRequiredArg = (flag: string, shortFlag?: string): string => {
  const value = getOptionalArg(flag, shortFlag);
  if (!value) {
    throw new Error(`Missing required argument: ${flag}${shortFlag ? ` / ${shortFlag}` : ""}`);
  }
  return value;
};

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Usage: bun run cli/bootstrap-admin.ts [options]

Options:
  -e, --email <email>         Admin email (required)
  -p, --password <password>   Password (required only when user does not exist)
  -n, --name <name>           Name for new user (default: "Admin User")
  -d, --database <name>       D1 database name (default: "lytx_core_db")
  --local                     Use local D1 (default)
  --remote                    Use remote D1
  --reset-password            Reset credential password if user already exists
  -h, --help                  Show this help

Examples:
  bun run cli/bootstrap-admin.ts --email admin@example.com --password "MyStrongPass123"
  bun run cli/bootstrap-admin.ts --email admin@example.com --remote --reset-password --password "NewPass123"
`);
  process.exit(0);
}

const email = getRequiredArg("--email", "-e").trim().toLowerCase();
const password = getOptionalArg("--password", "-p");
const displayName = getOptionalArg("--name", "-n") ?? "Admin User";
const database = getOptionalArg("--database", "-d") ?? "lytx_core_db";
const resetPassword = hasFlag("--reset-password");
const isRemote = hasFlag("--remote");
const isLocal = hasFlag("--local") || !isRemote;

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function parseResults(raw: string): QueryRow[] {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0].results)) {
    return parsed[0].results as QueryRow[];
  }
  throw new Error("Unexpected wrangler JSON response shape");
}

function runWrangler(sql: string, asJson: boolean): string {
  const tempFile = join(process.cwd(), `temp_bootstrap_${Date.now()}_${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(tempFile, sql);

  try {
    const modeFlag = isLocal ? "--local" : "--remote";
    const jsonFlag = asJson ? "--json" : "";
    const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${modeFlag} ${jsonFlag} --yes`;
    return execSync(command, { encoding: "utf8", stdio: "pipe" });
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

function execute(sql: string, description: string): void {
  console.log(`- ${description}`);
  runWrangler(sql, false);
}

function query(sql: string, description: string): QueryRow[] {
  console.log(`- ${description}`);
  const raw = runWrangler(sql, true);
  return parseResults(raw);
}

async function hashPassword(rawPassword: string): Promise<string> {
  const normalized = rawPassword.normalize("NFKC");
  const salt = randomBytes(16).toString("hex");

  return await new Promise((resolve, reject) => {
    scrypt(
      normalized,
      salt,
      64,
      {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 128 * 16384 * 16 * 2,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(`${salt}:${derivedKey.toString("hex")}`);
      },
    );
  });
}

async function main() {
  console.log(`\nBootstrapping admin on ${database} (${isLocal ? "local" : "remote"})`);

  const now = Math.floor(Date.now() / 1000);
  const escapedEmail = escapeSql(email);

  const existingUsers = query(
    `SELECT id FROM user WHERE lower(email) = lower('${escapedEmail}') LIMIT 1;`,
    "Checking for existing user",
  );

  let userId = String(existingUsers[0]?.id ?? "");

  if (!userId) {
    if (!password) {
      throw new Error("--password is required when creating a new admin user");
    }

    userId = createId();
    const accountId = createId();
    const hashedPassword = await hashPassword(password);
    const escapedName = escapeSql(displayName);

    execute(
      `
INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES ('${userId}', '${escapedName}', '${escapedEmail}', 1, ${now}, ${now});
`,
      "Creating user",
    );

    execute(
      `
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('${accountId}', '${userId}', 'credential', '${userId}', '${escapeSql(hashedPassword)}', ${now}, ${now});
`,
      "Creating credential account",
    );
  } else if (resetPassword) {
    if (!password) {
      throw new Error("--password is required when using --reset-password");
    }

    const hashedPassword = await hashPassword(password);
    const existingCredential = query(
      `
SELECT id FROM account
WHERE user_id = '${escapeSql(userId)}' AND provider_id = 'credential'
LIMIT 1;
`,
      "Checking credential account",
    );

    if (existingCredential[0]?.id) {
      execute(
        `
UPDATE account
SET password = '${escapeSql(hashedPassword)}', updated_at = ${now}
WHERE id = '${escapeSql(String(existingCredential[0].id))}';
`,
        "Resetting existing credential password",
      );
    } else {
      execute(
        `
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('${createId()}', '${escapeSql(userId)}', 'credential', '${escapeSql(userId)}', '${escapeSql(hashedPassword)}', ${now}, ${now});
`,
        "Creating credential account for existing user",
      );
    }
  }

  const primaryTeam = query(
    "SELECT id FROM team ORDER BY id ASC LIMIT 1;",
    "Finding primary team",
  );

  let teamId = Number(primaryTeam[0]?.id ?? 0);

  if (!teamId) {
    const teamUuid = createId();
    execute(
      `
INSERT INTO team (created_by, name, uuid, db_adapter, created_at, updated_at)
VALUES ('${escapeSql(userId)}', '${escapeSql(randomName())}', '${teamUuid}', 'sqlite', ${now}, ${now});
`,
      "Creating bootstrap team",
    );

    const createdTeam = query(
      `SELECT id FROM team WHERE uuid = '${teamUuid}' LIMIT 1;`,
      "Resolving bootstrap team id",
    );
    teamId = Number(createdTeam[0]?.id ?? 0);
    if (!teamId) {
      throw new Error("Failed to resolve bootstrap team id");
    }
  }

  const existingMembership = query(
    `
SELECT id, role FROM team_member
WHERE team_id = ${teamId} AND user_id = '${escapeSql(userId)}'
LIMIT 1;
`,
    "Checking existing team membership",
  );

  if (existingMembership[0]?.id) {
    execute(
      `
UPDATE team_member
SET role = 'admin', allowed_site_ids = '["all"]', updated_at = ${now}
WHERE id = ${Number(existingMembership[0].id)};
`,
      "Promoting existing member to admin",
    );
  } else {
    execute(
      `
INSERT INTO team_member (team_id, user_id, role, allowed_site_ids, created_at, updated_at)
VALUES (${teamId}, '${escapeSql(userId)}', 'admin', '["all"]', ${now}, ${now});
`,
      "Adding admin membership",
    );
  }

  execute(
    `
UPDATE user
SET last_team_id = ${teamId}, updated_at = ${now}
WHERE id = '${escapeSql(userId)}';
`,
    "Updating user team preference",
  );

  console.log("\nDone.");
  console.log(`- Admin email: ${email}`);
  console.log(`- Team id: ${teamId}`);
  console.log("- Role: admin");
}

main().catch((error) => {
  console.error("\nBootstrap admin failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
