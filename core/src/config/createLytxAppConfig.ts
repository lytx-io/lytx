import { z } from "zod";

export const CREATE_LYTX_APP_CONFIG_DOC_URL =
  "https://github.com/lytx-io/kit/blob/master/core/docs/oss-contract.md#supported-extension-and-customization-points";

const dbAdapterValues = ["sqlite", "postgres", "singlestore", "analytics_engine"] as const;

const dbAdapterSchema = z.enum(dbAdapterValues);
const eventStoreSchema = z.enum([...dbAdapterValues, "durable_objects"] as const);

const dbConfigSchema = z
  .object({
    dbAdapter: dbAdapterSchema.optional(),
    eventStore: eventStoreSchema.optional(),
  })
  .strict();

export type LytxDbAdapter = z.infer<typeof dbAdapterSchema>;
export type LytxEventStore = z.infer<typeof eventStoreSchema>;
export type LytxDbConfig = z.input<typeof dbConfigSchema>;

const routePathSchema = z
  .string()
  .trim()
  .min(1, "Route path is required")
  .refine((value) => value.startsWith("/"), "Route path must start with '/'")
  .refine((value) => !/\s/.test(value), "Route path cannot contain whitespace");

const routePrefixSchema = z
  .string()
  .trim()
  .min(1, "Route prefix is required")
  .refine((value) => value.startsWith("/"), "Route prefix must start with '/'")
  .refine((value) => !/\s/.test(value), "Route prefix cannot contain whitespace")
  .refine((value) => value === "/" || !value.endsWith("/"), "Route prefix must not end with '/' unless it is '/'");

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
    db: dbConfigSchema.optional(),
    dbAdapter: dbAdapterSchema.optional(),
    useQueueIngestion: z.boolean().optional(),
    includeLegacyTagRoutes: z.boolean().optional(),
    trackingRoutePrefix: routePrefixSchema.optional(),
    auth: z
      .object({
        emailPasswordEnabled: z.boolean().optional(),
        requireEmailVerification: z.boolean().optional(),
        socialProviders: z
          .object({
            google: z.boolean().optional(),
            github: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    tagRoutes: z
      .object({
        scriptPath: routePathSchema.optional(),
        legacyScriptPath: routePathSchema.optional(),
        eventPath: routePathSchema.optional(),
        legacyEventPath: routePathSchema.optional(),
      })
      .strict()
      .optional(),
    features: z
      .object({
        dashboard: z.boolean().optional(),
        events: z.boolean().optional(),
        auth: z.boolean().optional(),
        ai: z.boolean().optional(),
        tagScript: z.boolean().optional(),
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
        EMAIL_FROM: z.string().trim().email("EMAIL_FROM must be a valid email address").optional(),
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
    if (value.db?.dbAdapter && value.dbAdapter && value.db.dbAdapter !== value.dbAdapter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["db", "dbAdapter"],
        message: "db.dbAdapter must match top-level dbAdapter when both are provided",
      });
    }

    if (value.features?.dashboard === true && value.features?.auth === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["features", "dashboard"],
        message: "Dashboard cannot be enabled when auth is disabled",
      });
    }

    if (value.features?.reportBuilderEnabled === true && value.features?.dashboard === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["features", "reportBuilderEnabled"],
        message: "Report builder cannot be enabled when dashboard is disabled",
      });
    }

    if (value.features?.ai === false && value.features?.askAiEnabled === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["features", "askAiEnabled"],
        message: "Ask AI cannot be enabled when AI feature is disabled",
      });
    }

    if (value.features?.askAiEnabled === true && value.features?.reportBuilderEnabled === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["features", "askAiEnabled"],
        message: "Ask AI cannot be enabled when reportBuilderEnabled is false",
      });
    }

    const emailPasswordEnabled = value.auth?.emailPasswordEnabled ?? true;
    const googleExplicitlyDisabled = value.auth?.socialProviders?.google === false;
    const githubExplicitlyDisabled = value.auth?.socialProviders?.github === false;
    if (!emailPasswordEnabled && googleExplicitlyDisabled && githubExplicitlyDisabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auth", "emailPasswordEnabled"],
        message: "At least one auth method must be enabled",
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
