#!/usr/bin/env tsx

/**
 * Migration Validation CLI Tool
 * 
 * This script validates data integrity after migrating from original databases
 * to site-specific durable objects.
 * 
 * Usage:
 *   npx tsx cli/validate-migration.ts --site-id=123
 *   npx tsx cli/validate-migration.ts --all-sites
 *   npx tsx cli/validate-migration.ts --site-id=123 --strict
 */

import { env } from 'cloudflare:workers';
import { 
  validateSiteMigration, 
  generateValidationReport,
  type ValidationConfig 
} from '@/utilities/dataValidation';
import type { SiteEventInput } from '@/session/siteSchema';

// Mock data fetching functions - replace with actual database queries
async function getOriginalSiteEvents(siteId: number): Promise<SiteEventInput[]> {
  // TODO: Implement actual database query to fetch original events
  // This would query postgres/singlestore for the site's events
  console.log(`Fetching original events for site ${siteId}...`);
  
  // For now, return empty array - replace with actual implementation
  return [];
}

async function getOriginalEventCount(siteId: number): Promise<number> {
  // TODO: Implement actual database query to count original events
  console.log(`Counting original events for site ${siteId}...`);
  
  // For now, return 0 - replace with actual implementation
  return 0;
}

async function getAllSiteIds(): Promise<number[]> {
  // TODO: Implement actual database query to get all site IDs
  console.log('Fetching all site IDs...');
  
  // For now, return empty array - replace with actual implementation
  return [];
}

/**
 * Validate a single site's migration
 */
async function validateSite(
  siteId: number, 
  config: ValidationConfig,
  env: Env
): Promise<boolean> {
  console.log(`\n=== Validating Site ${siteId} ===`);
  
  try {
    // Fetch original data
    const originalEvents = await getOriginalSiteEvents(siteId);
    const originalCount = await getOriginalEventCount(siteId);
    
    if (originalCount === 0) {
      console.log(`Site ${siteId} has no events to validate.`);
      return true;
    }
    
    // Run validation
    const result = await validateSiteMigration(
      siteId, 
      originalEvents, 
      originalCount, 
      env, 
      config
    );
    
    // Generate and display report
    const report = generateValidationReport(result, siteId);
    console.log(report);
    
    // Return success status
    return result.isValid;
    
  } catch (error) {
    console.error(`Error validating site ${siteId}:`, error);
    return false;
  }
}

/**
 * Main validation function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let siteId: number | null = null;
  let validateAllSites = false;
  let strictMode = false;
  
  for (const arg of args) {
    if (arg.startsWith('--site-id=')) {
      siteId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all-sites') {
      validateAllSites = true;
    } else if (arg === '--strict') {
      strictMode = true;
    } else if (arg === '--help') {
      console.log(`
Migration Validation Tool

Usage:
  npx tsx cli/validate-migration.ts --site-id=123    # Validate specific site
  npx tsx cli/validate-migration.ts --all-sites      # Validate all sites
  npx tsx cli/validate-migration.ts --strict         # Use strict validation mode

Options:
  --site-id=N     Validate specific site by ID
  --all-sites     Validate all sites
  --strict        Enable strict mode (warnings become errors)
  --help          Show this help message
      `);
      process.exit(0);
    }
  }
  
  // Validation configuration
  const config: ValidationConfig = {
    strictMode,
    allowEmptyFields: ['bot_data', 'custom_data', 'query_params', 'rid', 'postal', 'region', 'city', 'country'],
    maxStringLength: 2000,
    dateRange: {
      minDate: new Date('2020-01-01'),
      maxDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  };
  
  console.log('Starting migration validation...');
  console.log(`Strict mode: ${strictMode ? 'ON' : 'OFF'}`);
  
  let allPassed = true;
  let totalSites = 0;
  let passedSites = 0;
  
  try {
    if (siteId) {
      // Validate single site
      totalSites = 1;
      const passed = await validateSite(siteId, config, env);
      if (passed) passedSites = 1;
      allPassed = passed;
      
    } else if (validateAllSites) {
      // Validate all sites
      const siteIds = await getAllSiteIds();
      totalSites = siteIds.length;
      
      console.log(`Found ${siteIds.length} sites to validate.`);
      
      for (const id of siteIds) {
        const passed = await validateSite(id, config, env);
        if (passed) {
          passedSites++;
        } else {
          allPassed = false;
        }
      }
      
    } else {
      console.error('Error: Must specify either --site-id=N or --all-sites');
      console.log('Use --help for usage information.');
      process.exit(1);
    }
    
    // Final summary
    console.log(`\n=== Validation Summary ===`);
    console.log(`Total sites validated: ${totalSites}`);
    console.log(`Sites passed: ${passedSites}`);
    console.log(`Sites failed: ${totalSites - passedSites}`);
    console.log(`Overall status: ${allPassed ? 'PASSED' : 'FAILED'}`);
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { validateSite, main };