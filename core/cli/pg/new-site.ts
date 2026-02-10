import { sites, accounts } from "@db/postgres/schema"
import { pg_client } from "@cli/pg/client"
import { eq } from "drizzle-orm";

import { $ } from "bun";

const client = pg_client();


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

function createLytxTag(opts: { apiKey: string, domain?: string, lytxDomain?: string }): string {
  const { apiKey, domain, lytxDomain } = opts;
  const safeDomain = domain ? domain.replace(/"/g, '') : undefined;
  let domainAttribute = safeDomain ? `data-domain="${safeDomain}"` : '';
  const safeApiKey = encodeURIComponent(apiKey);
  return `<script defer ${domainAttribute} src="${lytxDomain ?? 'https://lytx.io'}/lytx.js?account=${safeApiKey}"></script>`;
}
async function getAccountId(accountId: number) {
  const [account] = await client
    .select()
    .from(accounts)
    .where(eq(accounts.account_id, accountId))
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
  return account.account_id;
}

async function new_site(name: string, accountId: number, domain?: string) {
  const checkAccountExists = await getAccountId(accountId);
  if (!checkAccountExists) throw new Error(`Account not found: ${accountId}`);
  console.log(`Creating site: ${name}`);
  const [newSite] = await client
    .insert(sites)
    .values({
      account_id: accountId,
      client: name,
      domain
    }).returning();
  if (!newSite) throw new Error(`Failed to create site: ${name}`);
  await addApiKeyToKv(newSite.tag_id!);
  return newSite;
}

const getAccountIdArg = () => {
  try {
    return +getArg("--account");
  } catch {
    try {
      return +getArg("-a");
    } catch {
      throw new Error("Missing required argument: --account" + " | -a");
    }
  }
}
const getNameArg = () => {
  try {
    return getArg("--name");
  } catch {
    try {
      return getArg("-n");
    } catch {
      throw new Error("Missing required argument: --name" + " | -n");
    }
  }
}

const getDomainArg = () => {
  try {
    return getArg("--domain");
  } catch {
    try {
      return getArg("-d");
    } catch {
      return undefined;
    }
  }
};

async function addApiKeyToKv(apiKey: string) {
  await $`bunx wrangler kv key put ${apiKey} "[]" --binding LYTX_EVENTS --remote`;
}
async function wayLandCopy(apiKey: string) {
  try {
    await $`command -v wl-copy`.quiet();
    await $`echo ${apiKey} | wl-copy`;
  } catch {
    console.log("wl-copy is not available to copy to clipboard");
  }
}
// async function wayLandCopy(apiKey: string) {
//   await $`command -q wl-copy && echo ${apiKey} | wl-copy || echo "wl-copy is not available to copy to clipboard"`;
// }

const defaultScriptName = "cli/pg/new-site.ts"
async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(`
Usage: bun run ${defaultScriptName} [options]

Options:
  -h, --help Show this help message
  -n, --name <name> Site name (required)
  -a, --account <account> Account ID (required)
  -d, --domain <domain> Domain (optional)
  -pt, --print-tag Print the tag to place in the HTML(optional)

Example:
  bun run ${defaultScriptName} --name "Lytx Analytics Test" --account 45 
`);

    await client.$client.end()
    process.exit(0);
  }
  const name = getNameArg();
  const accountId = getAccountIdArg();
  const domain = getDomainArg();
  const printTag = hasFlag("--print-tag");

  const new_site_created = await new_site(name, accountId, domain);
  if (printTag) {
    const tag = createLytxTag({ apiKey: new_site_created.tag_id!, domain });
    // wayLandCopy(new_site_created.tag_id!);
    console.log(`Site created: ${name} use this tag : \n ${tag}`);

  } else {
    // wayLandCopy(new_site_created.tag_id!);
    console.log(`Site created: ${name} ${new_site_created.site_id} use this tag : \n ${new_site_created.tag_id}`);
  }

  await client.$client.end()
}

await main();




