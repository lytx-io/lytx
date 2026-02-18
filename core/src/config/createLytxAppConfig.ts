import { z } from "zod";

export const CREATE_LYTX_APP_CONFIG_DOC_URL =
  "https://github.com/lytx-io/kit/blob/master/core/docs/oss-contract.md#supported-extension-and-customization-points";

const dbAdapterSchema = z.enum(["sqlite", "postgres", "singlestore", "analytics_engine"]);

const routePathSchema = z
  .string()
  .trim()
  .min(1, "Route path is required")
  .refine((value) => value.startsWith("/"), "Route path must start with '/'")
  .refine((value) => !/\s/.test(value), "Route path cannot contain whitespace");

const bindingNameSchema = z
  .string()
  .trim()
  .min(1, "Binding name is required")
  .max(64, "Binding name must be at most 64 characters")
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Binding name must start with a letter and use letters, numbers, '_' or '-'");

const domainSchema = z
  .string()
  .trim()
  .min(1, "Domain is required")
  .refine((value) => {
    const candidate = value.includes("://") ? value : `https://${value}`;
    try {
      const parsed = new URL(candidate);
      return parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }, "Domain must be a valid hostname or URL");

const envKeySchema = z.string().trim().min(1, "Env var value cannot be empty");

const createLytxAppConfigSchema = z
  .object({
    enableRequestLogging: z.boolean().optional(),
    tagRoutes: z
      .object({
        dbAdapter: dbAdapterSchema.optional(),
        useQueueIngestion: z.boolean().optional(),
        includeLegacyRoutes: z.boolean().optional(),
        scriptPath: routePathSchema.optional(),
        legacyScriptPath: routePathSchema.optional(),
        eventPath: routePathSchema.optional(),
        legacyEventPath: routePathSchema.optional(),
      })
      .strict()
      .optional(),
    features: z
      .object({
        reportBuilderEnabled: z.boolean().optional(),
        askAiEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    names: z
      .object({
        d1Binding: bindingNameSchema.optional(),
        eventsKvBinding: bindingNameSchema.optional(),
        configKvBinding: bindingNameSchema.optional(),
        sessionsKvBinding: bindingNameSchema.optional(),
        queueBinding: bindingNameSchema.optional(),
        durableObjectBinding: bindingNameSchema.optional(),
      })
      .strict()
      .optional(),
    domains: z
      .object({
        app: domainSchema.optional(),
        tracking: domainSchema.optional(),
      })
      .strict()
      .optional(),
    env: z
      .object({
        BETTER_AUTH_SECRET: envKeySchema.optional(),
        BETTER_AUTH_URL: z.string().trim().url("BETTER_AUTH_URL must be a valid URL").optional(),
        ENCRYPTION_KEY: envKeySchema.optional(),
        AI_API_KEY: envKeySchema.optional(),
        AI_MODEL: envKeySchema.optional(),
        LYTX_DOMAIN: domainSchema.optional(),
      })
      .strict()
      .optional(),
    startupValidation: z
      .object({
        requireCoreEnv: z.boolean().optional(),
        requireAiEnvWhenAskAiEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.features?.askAiEnabled === true && value.features?.reportBuilderEnabled === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["features", "askAiEnabled"],
        message: "Ask AI cannot be enabled when reportBuilderEnabled is false",
      });
    }

    const requireCoreEnv = value.startupValidation?.requireCoreEnv === true;
    if (requireCoreEnv) {
      const requiredCoreKeys: Array<keyof NonNullable<typeof value.env>> = [
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "ENCRYPTION_KEY",
      ];
      for (const key of requiredCoreKeys) {
        if (!value.env?.[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["env", key],
            message: `Missing required env var ${key} (required when startupValidation.requireCoreEnv is true)`,
          });
        }
      }
    }

    const requireAiEnv = value.startupValidation?.requireAiEnvWhenAskAiEnabled ?? true;
    if (value.features?.askAiEnabled === true && requireAiEnv) {
      if (!value.env?.AI_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["env", "AI_API_KEY"],
          message: "Missing required env var AI_API_KEY when Ask AI is enabled",
        });
      }
      if (!value.env?.AI_MODEL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["env", "AI_MODEL"],
          message: "Missing required env var AI_MODEL when Ask AI is enabled",
        });
      }
    }
  });

export type CreateLytxAppConfig = z.input<typeof createLytxAppConfigSchema>;

function formatValidationErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `- ${path}: ${issue.message}`;
  });

  return [
    "Invalid createLytxApp config:",
    ...lines,
    `See ${CREATE_LYTX_APP_CONFIG_DOC_URL}`,
  ].join("\n");
}

export function parseCreateLytxAppConfig(config: CreateLytxAppConfig): CreateLytxAppConfig {
  const parsed = createLytxAppConfigSchema.safeParse(config ?? {});
  if (!parsed.success) {
    throw new Error(formatValidationErrors(parsed.error));
  }
  return parsed.data;
}
