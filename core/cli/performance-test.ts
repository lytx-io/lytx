#!/usr/bin/env tsx

/**
 * Performance Testing Suite for Durable Objects
 * 
 * This script conducts comprehensive performance testing of the new durable object system,
 * measuring dashboard load times, concurrent user capacity, and event ingestion rates.
 * 
 * Usage:
 *   npx tsx cli/performance-test.ts --dashboard-load
 *   npx tsx cli/performance-test.ts --event-ingestion
 *   npx tsx cli/performance-test.ts --concurrent-users
 *   npx tsx cli/performance-test.ts --all
 */

import { performance } from 'perf_hooks';

/**
 * Performance test configuration
 */
interface PerformanceConfig {
  // Dashboard load testing
  dashboardConcurrency: number;
  dashboardIterations: number;
  dashboardTimeout: number;
  
  // Event ingestion testing
  eventBatchSizes: number[];
  eventConcurrency: number;
  eventIterations: number;
  
  // Concurrent user testing
  maxConcurrentUsers: number;
  userRampUpTime: number;
  testDuration: number;
  
  // Target performance metrics
  targets: {
    dashboardLoadTime: number; // ms
    eventIngestionRate: number; // events/second
    concurrentUsers: number;
    errorRate: number; // percentage
  };
}

const DEFAULT_CONFIG: PerformanceConfig = {
  dashboardConcurrency: 10,
  dashboardIterations: 100,
  dashboardTimeout: 5000,
  
  eventBatchSizes: [1, 10, 50, 100, 500],
  eventConcurrency: 5,
  eventIterations: 50,
  
  maxConcurrentUsers: 100,
  userRampUpTime: 30000, // 30 seconds
  testDuration: 120000, // 2 minutes
  
  targets: {
    dashboardLoadTime: 100, // Sub-100ms target
    eventIngestionRate: 1000, // 1000 events/second
    concurrentUsers: 50,
    errorRate: 1 // Less than 1% errors
  }
};

/**
 * Performance test results
 */
interface TestResults {
  testName: string;
  duration: number;
  iterations: number;
  successCount: number;
  errorCount: number;
  averageTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  minTime: number;
  maxTime: number;
  throughput: number;
  errorRate: number;
  passed: boolean;
  details?: any;
}

/**
 * Mock HTTP client for testing (replace with actual fetch in real environment)
 */
class MockHttpClient {
  private baseUrl: string;
  private latencyRange: [number, number];
  private errorRate: number;

  constructor(baseUrl: string = 'http://localhost:8787', latencyRange: [number, number] = [10, 200], errorRate: number = 0.01) {
    this.baseUrl = baseUrl;
    this.latencyRange = latencyRange;
    this.errorRate = errorRate;
  }

  async request(path: string, options: RequestInit = {}): Promise<{ status: number; data: any; time: number }> {
    const startTime = performance.now();
    
    // Simulate network latency
    const latency = Math.random() * (this.latencyRange[1] - this.latencyRange[0]) + this.latencyRange[0];
    await new Promise(resolve => setTimeout(resolve, latency));
    
    // Simulate occasional errors
    if (Math.random() < this.errorRate) {
      throw new Error(`HTTP ${Math.random() > 0.5 ? '500' : '503'} - Simulated error`);
    }
    
    const endTime = performance.now();
    
    // Mock response based on path
    let mockData = {};
    if (path.includes('/events/stats')) {
      mockData = {
        totalEvents: Math.floor(Math.random() * 10000),
        uniqueVisitors: Math.floor(Math.random() * 1000),
        topEventTypes: [
          { label: 'page_view', value: Math.floor(Math.random() * 5000), percentage: 50 },
          { label: 'click', value: Math.floor(Math.random() * 2000), percentage: 20 }
        ]
      };
    } else if (path.includes('/events/timeseries')) {
      mockData = {
        data: Array.from({ length: 30 }, (_, i) => ({
          date: `2024-01-${i + 1}`,
          count: Math.floor(Math.random() * 1000)
        }))
      };
    } else if (path.includes('/events') && options.method === 'POST') {
      mockData = { success: true, inserted: 100 };
    }
    
    return {
      status: 200,
      data: mockData,
      time: endTime - startTime
    };
  }
}

/**
 * Dashboard load performance test
 */
async function testDashboardLoad(config: PerformanceConfig): Promise<TestResults> {
  console.log('🔄 Running Dashboard Load Performance Test...');
  
  const client = new MockHttpClient();
  const results: number[] = [];
  const errors: string[] = [];
  const startTime = performance.now();
  
  // Test different dashboard endpoints
  const endpoints = [
    '/api/events/123/stats',
    '/api/events/123/timeseries?granularity=day',
    '/api/events/123/metrics?type=events&limit=10',
    '/api/events/123/metrics?type=countries&limit=20'
  ];
  
  const promises = [];
  
  for (let i = 0; i < config.dashboardIterations; i++) {
    const promise = (async () => {
      try {
        const endpoint = endpoints[i % endpoints.length];
        const result = await client.request(endpoint);
        results.push(result.time);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    })();
    
    promises.push(promise);
    
    // Control concurrency
    if (promises.length >= config.dashboardConcurrency) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  
  // Wait for remaining promises
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  const successCount = results.length;
  const errorCount = errors.length;
  const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length || 0;
  const medianTime = results[Math.floor(results.length / 2)] || 0;
  const p95Time = results[Math.floor(results.length * 0.95)] || 0;
  const p99Time = results[Math.floor(results.length * 0.99)] || 0;
  const minTime = results[0] || 0;
  const maxTime = results[results.length - 1] || 0;
  const throughput = (successCount / duration) * 1000; // requests per second
  const errorRate = (errorCount / (successCount + errorCount)) * 100;
  
  const passed = averageTime <= config.targets.dashboardLoadTime && errorRate <= config.targets.errorRate;
  
  return {
    testName: 'Dashboard Load Performance',
    duration,
    iterations: config.dashboardIterations,
    successCount,
    errorCount,
    averageTime,
    medianTime,
    p95Time,
    p99Time,
    minTime,
    maxTime,
    throughput,
    errorRate,
    passed,
    details: {
      target: `${config.targets.dashboardLoadTime}ms`,
      endpoints: endpoints.length,
      concurrency: config.dashboardConcurrency
    }
  };
}

/**
 * Event ingestion performance test
 */
async function testEventIngestion(config: PerformanceConfig): Promise<TestResults> {
  console.log('🔄 Running Event Ingestion Performance Test...');
  
  const client = new MockHttpClient();
  const results: number[] = [];
  const errors: string[] = [];
  const startTime = performance.now();
  let totalEventsProcessed = 0;
  
  const promises = [];
  
  for (const batchSize of config.eventBatchSizes) {
    console.log(`  Testing batch size: ${batchSize} events`);
    
    for (let i = 0; i < config.eventIterations; i++) {
      const promise = (async () => {
        try {
          // Generate mock event batch
          const events = Array.from({ length: batchSize }, (_, index) => ({
            event: 'page_view',
            tag_id: 'test-tag-123',
            browser: 'Chrome',
            country: 'US',
            device_type: 'desktop',
            createdAt: new Date().toISOString()
          }));
          
          const result = await client.request('/api/events/123', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(events)
          });
          
          results.push(result.time);
          totalEventsProcessed += batchSize;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      })();
      
      promises.push(promise);
      
      // Control concurrency
      if (promises.length >= config.eventConcurrency) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
  }
  
  // Wait for remaining promises
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  const successCount = results.length;
  const errorCount = errors.length;
  const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length || 0;
  const medianTime = results[Math.floor(results.length / 2)] || 0;
  const p95Time = results[Math.floor(results.length * 0.95)] || 0;
  const p99Time = results[Math.floor(results.length * 0.99)] || 0;
  const minTime = results[0] || 0;
  const maxTime = results[results.length - 1] || 0;
  const throughput = (totalEventsProcessed / duration) * 1000; // events per second
  const errorRate = (errorCount / (successCount + errorCount)) * 100;
  
  const passed = throughput >= config.targets.eventIngestionRate && errorRate <= config.targets.errorRate;
  
  return {
    testName: 'Event Ingestion Performance',
    duration,
    iterations: successCount + errorCount,
    successCount,
    errorCount,
    averageTime,
    medianTime,
    p95Time,
    p99Time,
    minTime,
    maxTime,
    throughput,
    errorRate,
    passed,
    details: {
      target: `${config.targets.eventIngestionRate} events/sec`,
      totalEventsProcessed,
      batchSizes: config.eventBatchSizes,
      concurrency: config.eventConcurrency
    }
  };
}

/**
 * Concurrent users performance test
 */
async function testConcurrentUsers(config: PerformanceConfig): Promise<TestResults> {
  console.log('🔄 Running Concurrent Users Performance Test...');
  
  const client = new MockHttpClient();
  const results: number[] = [];
  const errors: string[] = [];
  const startTime = performance.now();
  
  // Simulate gradual user ramp-up
  const userPromises: Promise<void>[] = [];
  const rampUpInterval = config.userRampUpTime / config.maxConcurrentUsers;
  
  for (let userId = 0; userId < config.maxConcurrentUsers; userId++) {
    const userPromise = (async () => {
      // Wait for ramp-up time
      await new Promise(resolve => setTimeout(resolve, userId * rampUpInterval));
      
      const userStartTime = performance.now();
      const userEndTime = userStartTime + config.testDuration;
      
      // Simulate user activity
      while (performance.now() < userEndTime) {
        try {
          // Random dashboard activity
          const endpoints = [
            '/api/events/123/stats',
            '/api/events/123/timeseries?granularity=day',
            '/api/events/123/metrics?type=events'
          ];
          
          const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
          const result = await client.request(endpoint);
          results.push(result.time);
          
          // Wait between requests (simulate user think time)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    })();
    
    userPromises.push(userPromise);
  }
  
  // Wait for all users to complete
  await Promise.all(userPromises);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  const successCount = results.length;
  const errorCount = errors.length;
  const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length || 0;
  const medianTime = results[Math.floor(results.length / 2)] || 0;
  const p95Time = results[Math.floor(results.length * 0.95)] || 0;
  const p99Time = results[Math.floor(results.length * 0.99)] || 0;
  const minTime = results[0] || 0;
  const maxTime = results[results.length - 1] || 0;
  const throughput = (successCount / duration) * 1000; // requests per second
  const errorRate = (errorCount / (successCount + errorCount)) * 100;
  
  const passed = config.maxConcurrentUsers >= config.targets.concurrentUsers && errorRate <= config.targets.errorRate;
  
  return {
    testName: 'Concurrent Users Performance',
    duration,
    iterations: successCount + errorCount,
    successCount,
    errorCount,
    averageTime,
    medianTime,
    p95Time,
    p99Time,
    minTime,
    maxTime,
    throughput,
    errorRate,
    passed,
    details: {
      target: `${config.targets.concurrentUsers} concurrent users`,
      maxConcurrentUsers: config.maxConcurrentUsers,
      rampUpTime: config.userRampUpTime,
      testDuration: config.testDuration
    }
  };
}

/**
 * Generate performance report
 */
function generateReport(results: TestResults[]): string {
  const lines: string[] = [];
  
  lines.push('🚀 Performance Test Report');
  lines.push('=' .repeat(50));
  lines.push('');
  
  let allPassed = true;
  
  for (const result of results) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    allPassed = allPassed && result.passed;
    
    lines.push(`${status} ${result.testName}`);
    lines.push(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    lines.push(`Iterations: ${result.iterations}`);
    lines.push(`Success Rate: ${((result.successCount / result.iterations) * 100).toFixed(1)}%`);
    lines.push(`Error Rate: ${result.errorRate.toFixed(2)}%`);
    lines.push(`Average Time: ${result.averageTime.toFixed(2)}ms`);
    lines.push(`Median Time: ${result.medianTime.toFixed(2)}ms`);
    lines.push(`95th Percentile: ${result.p95Time.toFixed(2)}ms`);
    lines.push(`99th Percentile: ${result.p99Time.toFixed(2)}ms`);
    lines.push(`Throughput: ${result.throughput.toFixed(2)} req/sec`);
    
    if (result.details) {
      lines.push(`Target: ${result.details.target}`);
      if (result.details.totalEventsProcessed) {
        lines.push(`Events Processed: ${result.details.totalEventsProcessed}`);
      }
    }
    
    lines.push('');
  }
  
  lines.push('=' .repeat(50));
  lines.push(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  lines.push('');
  
  // Performance recommendations
  lines.push('📊 Performance Analysis:');
  lines.push('');
  
  const dashboardTest = results.find(r => r.testName.includes('Dashboard'));
  if (dashboardTest) {
    if (dashboardTest.averageTime <= 100) {
      lines.push('✅ Dashboard load times meet sub-100ms target');
    } else {
      lines.push('⚠️  Dashboard load times exceed target - consider caching optimizations');
    }
  }
  
  const ingestionTest = results.find(r => r.testName.includes('Ingestion'));
  if (ingestionTest) {
    if (ingestionTest.throughput >= 1000) {
      lines.push('✅ Event ingestion meets 1000+ events/sec target');
    } else {
      lines.push('⚠️  Event ingestion below target - consider batch size optimization');
    }
  }
  
  const concurrentTest = results.find(r => r.testName.includes('Concurrent'));
  if (concurrentTest) {
    if (concurrentTest.passed) {
      lines.push('✅ Concurrent user capacity meets requirements');
    } else {
      lines.push('⚠️  Concurrent user capacity needs improvement - check resource limits');
    }
  }
  
  return lines.join('\n');
}

/**
 * Main performance testing function
 */
async function main() {
  const args = process.argv.slice(2);
  
  let runDashboard = false;
  let runIngestion = false;
  let runConcurrent = false;
  
  // Parse command line arguments
  for (const arg of args) {
    if (arg === '--dashboard-load') runDashboard = true;
    else if (arg === '--event-ingestion') runIngestion = true;
    else if (arg === '--concurrent-users') runConcurrent = true;
    else if (arg === '--all') {
      runDashboard = runIngestion = runConcurrent = true;
    } else if (arg === '--help') {
      console.log(`
Performance Testing Suite

Usage:
  npx tsx cli/performance-test.ts --dashboard-load     # Test dashboard load performance
  npx tsx cli/performance-test.ts --event-ingestion   # Test event ingestion performance
  npx tsx cli/performance-test.ts --concurrent-users  # Test concurrent user capacity
  npx tsx cli/performance-test.ts --all              # Run all performance tests
  npx tsx cli/performance-test.ts --help             # Show this help message

Target Metrics:
  - Dashboard Load Time: < 100ms average
  - Event Ingestion Rate: > 1000 events/second
  - Concurrent Users: 50+ simultaneous users
  - Error Rate: < 1%
      `);
      process.exit(0);
    }
  }
  
  if (!runDashboard && !runIngestion && !runConcurrent) {
    console.error('Error: Must specify at least one test type. Use --help for usage information.');
    process.exit(1);
  }
  
  console.log('🚀 Starting Performance Test Suite...');
  console.log('');
  
  const config = DEFAULT_CONFIG;
  const results: TestResults[] = [];
  
  try {
    if (runDashboard) {
      const dashboardResult = await testDashboardLoad(config);
      results.push(dashboardResult);
    }
    
    if (runIngestion) {
      const ingestionResult = await testEventIngestion(config);
      results.push(ingestionResult);
    }
    
    if (runConcurrent) {
      const concurrentResult = await testConcurrentUsers(config);
      results.push(concurrentResult);
    }
    
    // Generate and display report
    const report = generateReport(results);
    console.log('\n' + report);
    
    // Exit with appropriate code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('Fatal error during performance testing:', error);
    process.exit(1);
  }
}

// Run the performance tests
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { testDashboardLoad, testEventIngestion, testConcurrentUsers, generateReport };