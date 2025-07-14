#!/usr/bin/env bun
import { createId } from "@paralleldrive/cuid2";
// Import schemas for reference (not directly used but good for type checking)
// import { user, account, team, team_member } from "@db/d1/schema";
import { randomName } from "@lib/random_name";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { scrypt, randomBytes } from "crypto";

// Hash password using scrypt with better-auth compatible parameters
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const saltHex = salt.toString("hex");

  // Use better-auth compatible scrypt parameters
  const config = {
    N: 16384,
    r: 16,
    p: 1,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2, // 128 * N * r * 2
  };

  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      saltHex,
      config.dkLen,
      {
        N: config.N,
        r: config.r,
        p: config.p,
        maxmem: config.maxmem,
      },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${saltHex}:${derivedKey.toString("hex")}`);
      },
    );
  });
}

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (flag: string, defaultValue?: string): string => {
  const index = args.indexOf(flag);
  if (index === -1) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required argument: ${flag}`);
  }
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Invalid value for ${flag}`);
  }
  return value;
};

const hasFlag = (flag: string): boolean => args.includes(flag);

// Check for help flag first
if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Usage: bun run db/init-db.ts [options]

Options:
  -e, --email <email>       User email (required)
  -p, --password <password> User password (required)  
  -n, --name <name>         User name (default: "Admin User")
  -d, --database <name>     Database name (default: "lytx_core_db")
  --local                   Use local database (default: true)
  --remote                  Use remote database (default: false)
  -h, --help               Show this help message

Example:
  bun run db/init-db.ts --email admin@example.com --password mypassword --name "John Doe"
  bun run db/init-db.ts --email admin@example.com --password mypassword --remote
`);
  process.exit(0);
}

// CLI argument parsing
const getEmailArg = () => {
  try {
    return getArg("--email");
  } catch {
    return getArg("-e");
  }
};

const getPasswordArg = () => {
  try {
    return getArg("--password");
  } catch {
    return getArg("-p");
  }
};

const getNameArg = () => {
  try {
    return getArg("--name");
  } catch {
    try {
      return getArg("-n");
    } catch {
      return "Admin User";
    }
  }
};

const getDatabaseArg = () => {
  try {
    return getArg("--database");
  } catch {
    try {
      return getArg("-d");
    } catch {
      return "lytx_core_db";
    }
  }
};

const email = getEmailArg();
const password = getPasswordArg();
const name = getNameArg();
const database = getDatabaseArg();
const isRemote = hasFlag("--remote");
const isLocal = hasFlag("--local") || !isRemote; // Default to local

// Helper function to execute SQL via wrangler
function executeSQL(sql: string, description: string) {
  console.log(`📝 ${description}...`);

  // Create temporary SQL file
  const tempFile = join(process.cwd(), `temp_${Date.now()}.sql`);
  writeFileSync(tempFile, sql);

  try {
    const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --yes`;
    const result = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`✅ ${description} completed`);
    return result;
  } catch (error: any) {
    console.error(`❌ Error during ${description}:`, error.message);
    throw error;
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function initDatabase() {
  try {
    console.log("🚀 Initializing database with default user...");
    console.log(`📊 Target: ${database} (${isLocal ? "local" : "remote"})`);

    // Generate IDs and timestamp
    const userId = createId();
    const teamUuid = createId();
    const accountId = createId();
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000); // Convert to Unix timestamp (seconds)

    // Hash the password using scrypt (same as better-auth)
    console.log("🔐 Hashing password...");
    const hashedPassword = await hashPassword(password);

    // 1. Create user
    const userSQL = `
INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES ('${userId}', '${name.replace(/'/g, "''")}', '${email}', 1, ${timestamp}, ${timestamp});
`;
    executeSQL(userSQL, "Creating user");

    // 2. Create account with hashed password (for better-auth email/password provider)
    const accountSQL = `
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
VALUES ('${accountId}', '${userId}', 'credential', '${userId}', '${hashedPassword}', ${timestamp}, ${timestamp});
`;
    executeSQL(accountSQL, "Creating account with hashed password");

    // 3. Create team for the user
    const teamName = randomName();
    const teamSQL = `
INSERT INTO team (created_by, name, uuid, db_adapter, created_at, updated_at)
VALUES ('${userId}', '${teamName}', '${teamUuid}', 'sqlite', ${timestamp}, ${timestamp});
`;
    executeSQL(teamSQL, "Creating default team");

    // 4. Get the team ID (we need to query it since it's auto-increment)
    const getTeamIdSQL = `SELECT id FROM team WHERE uuid = '${teamUuid}';`;
    const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
    writeFileSync(tempFile, getTeamIdSQL);

    let teamId: number;
    try {
      const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
      const result = execSync(command, { encoding: "utf8", stdio: "pipe" });
      const jsonResult = JSON.parse(result);
      teamId = jsonResult[0].results[0].id;
      console.log(`🔍 Found team ID: ${teamId}`);
    } catch (error: any) {
      console.error("❌ Error getting team ID:", error.message);
      throw error;
    } finally {
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // 5. Add user to team
    const teamMemberSQL = `
INSERT INTO team_member (team_id, user_id, created_at, updated_at)
VALUES (${teamId}, '${userId}', ${timestamp}, ${timestamp});
`;
    executeSQL(teamMemberSQL, "Adding user to team");

    console.log("✅ Database initialization complete!");
    console.log(`
📊 Summary:
  User ID: ${userId}
  Email: ${email}
  Name: ${name}
  Team ID: ${teamId}
  Team Name: ${teamName}
  Team UUID: ${teamUuid}
  Database: ${database} (${isLocal ? "local" : "remote"})
`);

    console.log(`
🔑 Login credentials:
  Email: ${email}
  Password: ${password}
`);

    console.log(`
🚀 Next steps:
  1. Start the dev server: bun run dev
  2. Visit the login page and use the credentials above
  3. The user will automatically have a team and can create sites
`);
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

// Validate required arguments
if (!email || !password) {
  console.error("❌ Error: --email and --password are required");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error("❌ Error: Invalid email format");
  process.exit(1);
}

// Run the initialization
initDatabase();
