#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TEMPLATE = "cloudflare";

const usage = `Usage:
  lytx [target-dir] [--template cloudflare] [--name my-app] [--force]

Examples:
  lytx my-app --template cloudflare
  lytx . --template cloudflare --name my-app
`;

function parseArgs(argv) {
  const args = {
    targetDir: ".",
    template: DEFAULT_TEMPLATE,
    projectName: "",
    force: false,
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

    if (token.startsWith("--template=")) {
      args.template = token.slice("--template=".length);
      continue;
    }

    if (token === "--template") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --template");
      args.template = value;
      i += 1;
      continue;
    }

    if (token.startsWith("--name=")) {
      args.projectName = token.slice("--name=".length);
      continue;
    }

    if (token === "--name") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --name");
      args.projectName = value;
      i += 1;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown flag: ${token}`);
    }

    args.targetDir = token;
  }

  return args;
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
  });
  await renameTemplateSuffixes(targetPath);

  const relativeTarget = path.relative(process.cwd(), targetPath) || ".";
  console.log(`\nCreated Lytx project in ${relativeTarget}`);
  console.log("\nNext steps:");
  if (relativeTarget !== ".") {
    console.log(`  cd ${relativeTarget}`);
  }
  console.log("  cp .env.example .env");
  console.log("  bun install");
  console.log("  bun run dev");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  console.error("\n" + usage);
  process.exit(1);
});
