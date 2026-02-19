#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_TEMPLATE = "cloudflare";
const DEFAULT_PROVISION_STAGE = "dev";

const usage = `Usage:
  lytx [target-dir] [--template cloudflare] [--name my-app] [options]

Examples:
  lytx my-app --template cloudflare
  lytx . --template cloudflare --name my-app
  lytx my-app --template cloudflare --provision --yes

Options:
  --force                  Scaffold into non-empty target directory
  --interactive            Prompt for optional setup values
  --app-domain <domain>    Default app domain for .env.example
  --tracking-domain <d>    Default tracking domain for .env.example
  --email-from <email>     Default sender address for .env.example
  --auth-google            Enable Google social auth by default
  --auth-github            Enable GitHub social auth by default
  --provision              Run install + alchemy deploy after scaffold
  --stage <name>           Stage for --provision (default: dev)
  --no-install             Skip install during --provision
  --yes                    Skip confirmation prompts for provisioning
`;

function boolToEnv(value) {
  return value ? "true" : "false";
}

function quoteShellArg(value) {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'"'"'`)}`;
}

function parseArgs(argv) {
  const args = {
    targetDir: ".",
    targetProvided: false,
    template: DEFAULT_TEMPLATE,
    templateProvided: false,
    projectName: "",
    projectNameProvided: false,
    force: false,
    interactive: false,
    appDomain: "",
    appDomainProvided: false,
    trackingDomain: "",
    trackingDomainProvided: false,
    emailFrom: "noreply@example.com",
    emailFromProvided: false,
    authGoogle: false,
    authGoogleProvided: false,
    authGithub: false,
    authGithubProvided: false,
    provision: false,
    provisionProvided: false,
    provisionStage: DEFAULT_PROVISION_STAGE,
    provisionStageProvided: false,
    skipInstall: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--force") {
      args.force = true;
      continue;
    }

    if (token === "--interactive") {
      args.interactive = true;
      continue;
    }

    if (token === "--yes") {
      args.yes = true;
      continue;
    }

    if (token === "--no-install") {
      args.skipInstall = true;
      continue;
    }

    if (token === "--provision") {
      args.provision = true;
      args.provisionProvided = true;
      continue;
    }

    if (token === "--auth-google") {
      args.authGoogle = true;
      args.authGoogleProvided = true;
      continue;
    }

    if (token === "--auth-github") {
      args.authGithub = true;
      args.authGithubProvided = true;
      continue;
    }

    if (token.startsWith("--template=")) {
      args.template = token.slice("--template=".length);
      args.templateProvided = true;
      continue;
    }

    if (token === "--template") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --template");
      args.template = value;
      args.templateProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("--name=")) {
      args.projectName = token.slice("--name=".length);
      args.projectNameProvided = true;
      continue;
    }

    if (token === "--name") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --name");
      args.projectName = value;
      args.projectNameProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("--app-domain=")) {
      args.appDomain = token.slice("--app-domain=".length);
      args.appDomainProvided = true;
      continue;
    }

    if (token === "--app-domain") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("Missing value for --app-domain");
      args.appDomain = value;
      args.appDomainProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("--tracking-domain=")) {
      args.trackingDomain = token.slice("--tracking-domain=".length);
      args.trackingDomainProvided = true;
      continue;
    }

    if (token === "--tracking-domain") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("Missing value for --tracking-domain");
      args.trackingDomain = value;
      args.trackingDomainProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("--email-from=")) {
      args.emailFrom = token.slice("--email-from=".length);
      args.emailFromProvided = true;
      continue;
    }

    if (token === "--email-from") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("Missing value for --email-from");
      args.emailFrom = value;
      args.emailFromProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("--stage=")) {
      args.provisionStage = token.slice("--stage=".length);
      args.provisionStageProvided = true;
      continue;
    }

    if (token === "--stage") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --stage");
      args.provisionStage = value;
      args.provisionStageProvided = true;
      i += 1;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown flag: ${token}`);
    }

    args.targetDir = token;
    args.targetProvided = true;
  }

  return args;
}

function parsePromptBoolean(answer, defaultValue) {
  const normalized = answer.trim().toLowerCase();
  if (normalized.length === 0) return defaultValue;
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  throw new Error(`Invalid boolean answer: ${answer}`);
}

async function promptMissingValues(args, templates) {
  const isInteractiveTerminal = process.stdin.isTTY && process.stdout.isTTY;
  if (!isInteractiveTerminal) return;

  if (!(args.interactive || !args.targetProvided || !args.projectNameProvided || !args.templateProvided)) {
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!args.targetProvided) {
      const targetAnswer = await rl.question(`Target directory (.): `);
      const target = targetAnswer.trim();
      if (target.length > 0) {
        args.targetDir = target;
        args.targetProvided = true;
      }
    }

    if (!args.templateProvided && templates.length > 1) {
      const templateAnswer = await rl.question(
        `Template (${templates.join(", ")}) [${DEFAULT_TEMPLATE}]: `,
      );
      const template = templateAnswer.trim();
      if (template.length > 0) {
        args.template = template;
        args.templateProvided = true;
      }
    }

    if (!args.projectNameProvided) {
      const inferredName = path.basename(path.resolve(process.cwd(), args.targetDir));
      const packageNameDefault = toPackageName(inferredName);
      const nameAnswer = await rl.question(`Project name (${packageNameDefault}): `);
      const projectName = nameAnswer.trim();
      if (projectName.length > 0) {
        args.projectName = projectName;
      }
      args.projectNameProvided = true;
    }

    if (!args.interactive) return;

    if (!args.appDomainProvided) {
      const appDomainAnswer = await rl.question("App domain (blank for none): ");
      args.appDomain = appDomainAnswer.trim();
      args.appDomainProvided = true;
    }

    if (!args.trackingDomainProvided) {
      const trackingDomainAnswer = await rl.question("Tracking domain (blank for none): ");
      args.trackingDomain = trackingDomainAnswer.trim();
      args.trackingDomainProvided = true;
    }

    if (!args.emailFromProvided) {
      const emailAnswer = await rl.question(`Email sender (${args.emailFrom}): `);
      const email = emailAnswer.trim();
      if (email.length > 0) {
        args.emailFrom = email;
      }
      args.emailFromProvided = true;
    }

    if (!args.authGoogleProvided) {
      const googleAnswer = await rl.question("Enable Google auth by default? (y/N): ");
      args.authGoogle = parsePromptBoolean(googleAnswer, false);
      args.authGoogleProvided = true;
    }

    if (!args.authGithubProvided) {
      const githubAnswer = await rl.question("Enable GitHub auth by default? (y/N): ");
      args.authGithub = parsePromptBoolean(githubAnswer, false);
      args.authGithubProvided = true;
    }

    if (!args.provisionProvided) {
      const provisionAnswer = await rl.question("Provision infra now? (y/N): ");
      args.provision = parsePromptBoolean(provisionAnswer, false);
      args.provisionProvided = true;
    }

    if (args.provision && !args.provisionStageProvided) {
      const stageAnswer = await rl.question(`Provision stage (${args.provisionStage}): `);
      const stage = stageAnswer.trim();
      if (stage.length > 0) {
        args.provisionStage = stage;
      }
      args.provisionStageProvided = true;
    }
  } finally {
    rl.close();
  }
}

function toPackageName(input) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized : "lytx-app";
}

async function listTemplateNames(templatesRoot) {
  const entries = await fs.readdir(templatesRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).toSorted();
}

async function ensureDestination(destinationPath, force) {
  try {
    const stat = await fs.stat(destinationPath);
    if (!stat.isDirectory()) {
      throw new Error(`Target exists and is not a directory: ${destinationPath}`);
    }

    const existing = await fs.readdir(destinationPath);
    if (existing.length > 0 && !force) {
      throw new Error(
        `Target directory is not empty: ${destinationPath}\nUse --force to scaffold into a non-empty directory.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await fs.mkdir(destinationPath, { recursive: true });
      return;
    }
    throw error;
  }
}

async function copyDirectory(sourcePath, destinationPath) {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  await fs.mkdir(destinationPath, { recursive: true });

  for (const entry of entries) {
    const from = path.join(sourcePath, entry.name);
    const to = path.join(destinationPath, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(from, to);
      continue;
    }

    await fs.copyFile(from, to);
  }
}

function isTemplatedTextFile(filePath) {
  const base = path.basename(filePath);
  if (base === ".gitignore" || base === ".env.example") return true;
  if (filePath.endsWith(".template")) return true;

  const ext = path.extname(filePath);
  return [".json", ".md", ".mjs", ".js", ".ts", ".tsx", ".css"].includes(ext);
}

async function renameTemplateSuffixes(rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await renameTemplateSuffixes(fullPath);
      continue;
    }

    if (!entry.name.endsWith(".template")) continue;
    const nextPath = fullPath.slice(0, -".template".length);
    await fs.rename(fullPath, nextPath);
  }
}

async function applyTemplateTokens(rootPath, replacements) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await applyTemplateTokens(fullPath, replacements);
      continue;
    }

    if (!isTemplatedTextFile(fullPath)) continue;

    const initialContent = await fs.readFile(fullPath, "utf8");
    let nextContent = initialContent;
    for (const [needle, value] of Object.entries(replacements)) {
      nextContent = nextContent.split(needle).join(value);
    }

    if (nextContent !== initialContent) {
      await fs.writeFile(fullPath, nextContent, "utf8");
    }
  }
}

async function runCommand(command, commandArgs, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`Command failed (${code}): ${command} ${commandArgs.join(" ")}`));
    });
  });
}

async function confirmProvision(args, targetPath) {
  if (args.yes) return;

  const isInteractiveTerminal = process.stdin.isTTY && process.stdout.isTTY;
  if (!isInteractiveTerminal) {
    throw new Error("--provision requires --yes in non-interactive shells");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const command = `bun alchemy deploy --stage ${quoteShellArg(args.provisionStage)}`;
    const answer = await rl.question(
      `Provision Cloudflare resources now? This may create billable infrastructure.\n  cd ${targetPath}\n  ${command}\nProceed? (y/N): `,
    );
    const confirmed = parsePromptBoolean(answer, false);
    if (!confirmed) {
      throw new Error("Provisioning cancelled by user");
    }
  } finally {
    rl.close();
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }

  const cliFilePath = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(cliFilePath), "..");
  const templatesRoot = path.join(packageRoot, "templates");
  const availableTemplates = await listTemplateNames(templatesRoot);

  await promptMissingValues(args, availableTemplates);

  if (!availableTemplates.includes(args.template)) {
    throw new Error(
      `Unknown template: ${args.template}\nAvailable templates: ${availableTemplates.join(", ") || "(none)"}`,
    );
  }

  const targetPath = path.resolve(process.cwd(), args.targetDir);
  await ensureDestination(targetPath, args.force);

  const templatePath = path.join(templatesRoot, args.template);
  await copyDirectory(templatePath, targetPath);

  const inferredName = path.basename(targetPath);
  const projectName = toPackageName(args.projectName || inferredName);
  await applyTemplateTokens(targetPath, {
    "__PROJECT_NAME__": projectName,
    "__LYTX_APP_NAME__": projectName,
    "__LYTX_APP_DOMAIN__": args.appDomain,
    "__LYTX_TRACKING_DOMAIN__": args.trackingDomain,
    "__EMAIL_FROM__": args.emailFrom,
    "__LYTX_AUTH_GOOGLE__": boolToEnv(args.authGoogle),
    "__LYTX_AUTH_GITHUB__": boolToEnv(args.authGithub),
  });
  await renameTemplateSuffixes(targetPath);

  if (args.provision) {
    await confirmProvision(args, targetPath);
    if (!args.skipInstall) {
      await runCommand("bun", ["install"], targetPath);
    }
    await runCommand("bun", ["alchemy", "deploy", "--stage", args.provisionStage], targetPath);
  }

  const relativeTarget = path.relative(process.cwd(), targetPath) || ".";
  console.log(`\nCreated Lytx project in ${relativeTarget}`);
  console.log("\nNext steps:");
  if (relativeTarget !== ".") {
    console.log(`  cd ${relativeTarget}`);
  }
  console.log("  cp .env.example .env");
  console.log("  bun install");
  console.log("  bun run dev");

  if (args.provision) {
    console.log("\nProvisioning completed.");
  } else {
    console.log("  bun alchemy deploy --stage dev   # optional infra provisioning");
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  console.error("\n" + usage);
  process.exit(1);
});
