//! Runtime controls for Durable Object analytics caching behavior.

export type DurableAnalyticsCacheRuntimeConfig = {
  persistHistoricalAnalyticsToEventsKv?: boolean;
};

const DEFAULT_DURABLE_ANALYTICS_CACHE_RUNTIME_CONFIG: Required<DurableAnalyticsCacheRuntimeConfig> = {
  persistHistoricalAnalyticsToEventsKv: false,
};

let durable_analytics_cache_runtime_config = {
  ...DEFAULT_DURABLE_ANALYTICS_CACHE_RUNTIME_CONFIG,
};

export function setDurableAnalyticsCacheRuntimeConfig(
  config: DurableAnalyticsCacheRuntimeConfig = {},
) {
  durable_analytics_cache_runtime_config = {
    ...DEFAULT_DURABLE_ANALYTICS_CACHE_RUNTIME_CONFIG,
    ...config,
  };
}

export function getDurableAnalyticsCacheRuntimeConfig() {
  return durable_analytics_cache_runtime_config;
}
