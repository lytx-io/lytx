/**
 * Data Validation Functions for Durable Object Migration
 * 
 * These functions validate data integrity during migration from original databases
 * to site-specific durable objects, ensuring consistency and completeness.
 */

import type { SiteEventInput } from "@/session/siteSchema";
import { getDashboardDataFromDurableObject } from "@db/durable/durableObjectClient";
import type { DashboardOptions } from "@db/types";
import { IS_DEV } from "rwsdk/constants";

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recordCount?: number;
  validRecords?: number;
  invalidRecords?: number;
}

/**
 * Site event validation configuration
 */
export interface ValidationConfig {
  strictMode?: boolean; // If true, warnings become errors
  allowEmptyFields?: string[]; // Fields that can be empty/null
  maxStringLength?: number; // Maximum string field length
  dateRange?: {
    minDate?: Date;
    maxDate?: Date;
  };
}

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: ValidationConfig = {
  strictMode: false,
  allowEmptyFields: ['bot_data', 'custom_data', 'query_params', 'rid', 'postal', 'region', 'city', 'country'],
  maxStringLength: 2000,
  dateRange: {
    minDate: new Date('2020-01-01'), // Reasonable minimum date
    maxDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Allow up to 1 day in future
  }
};

/**
 * Validate a single site event record
 */
export function validateSiteEvent(
  event: SiteEventInput, 
  config: ValidationConfig = DEFAULT_CONFIG
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!event.event || typeof event.event !== 'string') {
    errors.push('Field "event" is required and must be a string');
  }

  if (!event.tag_id || typeof event.tag_id !== 'string') {
    errors.push('Field "tag_id" is required and must be a string');
  }

  // String length validation
  const stringFields = ['event', 'tag_id', 'browser', 'city', 'client_page_url', 'country', 
                       'device_type', 'operating_system', 'page_url', 'postal', 'referer', 
                       'region', 'rid'];
  
  for (const field of stringFields) {
    const value = event[field as keyof SiteEventInput];
    if (value && typeof value === 'string' && value.length > (config.maxStringLength || 2000)) {
      errors.push(`Field "${field}" exceeds maximum length of ${config.maxStringLength}`);
    }
  }

  // Numeric field validation
  if (event.screen_height !== undefined && (typeof event.screen_height !== 'number' || event.screen_height < 0)) {
    errors.push('Field "screen_height" must be a positive number');
  }

  if (event.screen_width !== undefined && (typeof event.screen_width !== 'number' || event.screen_width < 0)) {
    errors.push('Field "screen_width" must be a positive number');
  }

  // Date validation
  if (event.createdAt) {
    const date = new Date(event.createdAt);
    if (isNaN(date.getTime())) {
      errors.push('Field "createdAt" must be a valid date');
    } else {
      const { minDate, maxDate } = config.dateRange || {};
      if (minDate && date < minDate) {
        warnings.push(`Field "createdAt" is before minimum date ${minDate.toISOString()}`);
      }
      if (maxDate && date > maxDate) {
        warnings.push(`Field "createdAt" is after maximum date ${maxDate.toISOString()}`);
      }
    }
  }

  // JSON field validation
  const jsonFields = ['bot_data', 'custom_data', 'query_params'];
  for (const field of jsonFields) {
    const value = event[field as keyof SiteEventInput];
    if (value !== undefined && value !== null) {
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        } else if (typeof value !== 'object') {
          errors.push(`Field "${field}" must be a valid JSON object or string`);
        }
      } catch (e) {
        errors.push(`Field "${field}" contains invalid JSON`);
      }
    }
  }

  // URL validation (basic)
  const urlFields = ['client_page_url', 'page_url', 'referer'];
  for (const field of urlFields) {
    const value = event[field as keyof SiteEventInput];
    if (value && typeof value === 'string') {
      try {
        new URL(value);
      } catch (e) {
        warnings.push(`Field "${field}" does not appear to be a valid URL: ${value}`);
      }
    }
  }

  // Convert warnings to errors in strict mode
  if (config.strictMode) {
    errors.push(...warnings);
    warnings.length = 0;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recordCount: 1,
    validRecords: errors.length === 0 ? 1 : 0,
    invalidRecords: errors.length > 0 ? 1 : 0
  };
}

/**
 * Validate an array of site events
 */
export function validateSiteEvents(
  events: SiteEventInput[], 
  config: ValidationConfig = DEFAULT_CONFIG
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let validRecords = 0;
  let invalidRecords = 0;

  if (!Array.isArray(events)) {
    return {
      isValid: false,
      errors: ['Input must be an array of events'],
      warnings: [],
      recordCount: 0,
      validRecords: 0,
      invalidRecords: 0
    };
  }

  events.forEach((event, index) => {
    const result = validateSiteEvent(event, config);
    
    if (result.isValid) {
      validRecords++;
    } else {
      invalidRecords++;
    }

    // Prefix errors and warnings with record index
    result.errors.forEach(error => {
      allErrors.push(`Record ${index}: ${error}`);
    });
    
    result.warnings.forEach(warning => {
      allWarnings.push(`Record ${index}: ${warning}`);
    });
  });

  return {
    isValid: invalidRecords === 0,
    errors: allErrors,
    warnings: allWarnings,
    recordCount: events.length,
    validRecords,
    invalidRecords
  };
}

/**
 * Compare record counts between original database and durable object
 */
export async function validateRecordCounts(
  siteId: number,
  originalCount: number,
  env: Env,
  dateRange?: { start: Date; end: Date }
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get count from durable object
    const options: DashboardOptions = {
      site_id: siteId,
      site_uuid: `site-${siteId}`,
      team_id: 1, // TODO: Get actual team_id
      date: dateRange
    };

    const dashboardData = await getDashboardDataFromDurableObject(options);
    const durableObjectCount = dashboardData.query?.events?.length || 0;

    // Compare counts
    if (durableObjectCount !== originalCount) {
      const difference = Math.abs(durableObjectCount - originalCount);
      const percentageDiff = originalCount > 0 ? (difference / originalCount) * 100 : 100;

      if (percentageDiff > 5) { // More than 5% difference is an error
        errors.push(
          `Significant count mismatch for site ${siteId}: ` +
          `Original DB: ${originalCount}, Durable Object: ${durableObjectCount} ` +
          `(${percentageDiff.toFixed(2)}% difference)`
        );
      } else {
        warnings.push(
          `Minor count mismatch for site ${siteId}: ` +
          `Original DB: ${originalCount}, Durable Object: ${durableObjectCount} ` +
          `(${percentageDiff.toFixed(2)}% difference)`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recordCount: durableObjectCount,
      validRecords: durableObjectCount,
      invalidRecords: 0
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to validate record counts for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      recordCount: 0,
      validRecords: 0,
      invalidRecords: 0
    };
  }
}

/**
 * Validate data consistency between original database and durable object
 * Compares a sample of records to ensure data integrity
 */
export async function validateDataConsistency(
  siteId: number,
  originalEvents: SiteEventInput[],
  env: Env,
  sampleSize: number = 100
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get events from durable object
    const options: DashboardOptions = {
      site_id: siteId,
      site_uuid: `site-${siteId}`,
      team_id: 1, // TODO: Get actual team_id
    };

    const dashboardData = await getDashboardDataFromDurableObject(options);
    const durableObjectEvents = dashboardData.query?.events || [];

    if (durableObjectEvents.length === 0) {
      errors.push(`No events found in durable object for site ${siteId}`);
      return { isValid: false, errors, warnings };
    }

    // Sample events for comparison (take first N events)
    const sampleOriginal = originalEvents.slice(0, Math.min(sampleSize, originalEvents.length));
    const sampleDurableObject = durableObjectEvents.slice(0, Math.min(sampleSize, durableObjectEvents.length));

    // Compare key fields for sampled records
    const keyFields = ['event', 'tag_id', 'country', 'device_type', 'browser'];
    
    for (let i = 0; i < Math.min(sampleOriginal.length, sampleDurableObject.length); i++) {
      const original = sampleOriginal[i];
      const durableObj = sampleDurableObject[i];

      for (const field of keyFields) {
        const originalValue = original[field as keyof SiteEventInput];
        const durableObjValue = durableObj[field as keyof SiteEventInput];

        if (originalValue !== durableObjValue) {
          warnings.push(
            `Data mismatch in record ${i}, field "${field}": ` +
            `Original: "${originalValue}", Durable Object: "${durableObjValue}"`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recordCount: Math.min(sampleOriginal.length, sampleDurableObject.length),
      validRecords: Math.min(sampleOriginal.length, sampleDurableObject.length) - warnings.length,
      invalidRecords: warnings.length
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to validate data consistency for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      recordCount: 0,
      validRecords: 0,
      invalidRecords: 0
    };
  }
}

/**
 * Comprehensive validation suite for site migration
 */
export async function validateSiteMigration(
  siteId: number,
  originalEvents: SiteEventInput[],
  originalCount: number,
  env: Env,
  config: ValidationConfig = DEFAULT_CONFIG
): Promise<ValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Validate event data structure
  if (IS_DEV) console.log(`Validating ${originalEvents.length} events for site ${siteId}...`);
  const structureValidation = validateSiteEvents(originalEvents, config);
  allErrors.push(...structureValidation.errors);
  allWarnings.push(...structureValidation.warnings);

  // 2. Validate record counts
  if (IS_DEV) console.log(`Validating record counts for site ${siteId}...`);
  const countValidation = await validateRecordCounts(siteId, originalCount, env);
  allErrors.push(...countValidation.errors);
  allWarnings.push(...countValidation.warnings);

  // 3. Validate data consistency (sample)
  if (IS_DEV) console.log(`Validating data consistency for site ${siteId}...`);
  const consistencyValidation = await validateDataConsistency(siteId, originalEvents, env);
  allErrors.push(...consistencyValidation.errors);
  allWarnings.push(...consistencyValidation.warnings);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    recordCount: originalEvents.length,
    validRecords: structureValidation.validRecords || 0,
    invalidRecords: structureValidation.invalidRecords || 0
  };
}

/**
 * Generate validation report
 */
export function generateValidationReport(result: ValidationResult, siteId?: number): string {
  const lines: string[] = [];
  
  if (siteId) {
    lines.push(`=== Validation Report for Site ${siteId} ===`);
  } else {
    lines.push(`=== Validation Report ===`);
  }
  
  lines.push(`Status: ${result.isValid ? 'PASSED' : 'FAILED'}`);
  lines.push(`Total Records: ${result.recordCount || 0}`);
  lines.push(`Valid Records: ${result.validRecords || 0}`);
  lines.push(`Invalid Records: ${result.invalidRecords || 0}`);
  
  if (result.errors.length > 0) {
    lines.push(`\nErrors (${result.errors.length}):`);
    result.errors.forEach(error => lines.push(`  - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    lines.push(`\nWarnings (${result.warnings.length}):`);
    result.warnings.forEach(warning => lines.push(`  - ${warning}`));
  }
  
  lines.push('');
  return lines.join('\n');
}
