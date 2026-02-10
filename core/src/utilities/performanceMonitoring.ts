/**
 * Performance Monitoring and Alerting System
 * 
 * This module provides real-time performance monitoring for the durable object system,
 * tracking key metrics and triggering alerts when thresholds are exceeded.
 */

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  timestamp: Date;
  siteId?: number;
  
  // Response time metrics (milliseconds)
  responseTime: {
    dashboard: number;
    eventIngestion: number;
    api: number;
  };
  
  // Throughput metrics (requests/events per second)
  throughput: {
    dashboardRequests: number;
    eventIngestion: number;
    apiRequests: number;
  };
  
  // Error metrics (percentage)
  errorRates: {
    dashboard: number;
    eventIngestion: number;
    api: number;
  };
  
  // Resource utilization
  resources: {
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    durableObjectCount: number;
    queueDepth: number;
  };
  
  // Business metrics
  business: {
    activeUsers: number;
    eventsPerMinute: number;
    sitesActive: number;
  };
}

/**
 * Performance thresholds for alerting
 */
export interface PerformanceThresholds {
  responseTime: {
    dashboard: { warning: number; critical: number };
    eventIngestion: { warning: number; critical: number };
    api: { warning: number; critical: number };
  };
  
  throughput: {
    dashboardRequests: { warning: number; critical: number };
    eventIngestion: { warning: number; critical: number };
  };
  
  errorRates: {
    warning: number; // percentage
    critical: number; // percentage
  };
  
  resources: {
    memoryUsage: { warning: number; critical: number }; // MB
    cpuUsage: { warning: number; critical: number }; // percentage
    queueDepth: { warning: number; critical: number };
  };
}

/**
 * Default performance thresholds
 */
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  responseTime: {
    dashboard: { warning: 100, critical: 500 }, // ms
    eventIngestion: { warning: 50, critical: 200 }, // ms
    api: { warning: 200, critical: 1000 } // ms
  },
  
  throughput: {
    dashboardRequests: { warning: 100, critical: 50 }, // req/sec
    eventIngestion: { warning: 500, critical: 100 } // events/sec
  },
  
  errorRates: {
    warning: 1, // 1%
    critical: 5 // 5%
  },
  
  resources: {
    memoryUsage: { warning: 512, critical: 1024 }, // MB
    cpuUsage: { warning: 70, critical: 90 }, // percentage
    queueDepth: { warning: 1000, critical: 5000 }
  }
};

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  siteId?: number;
  resolved?: boolean;
  resolvedAt?: Date;
}

/**
 * Performance monitoring class
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  
  constructor(thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }
  
  /**
   * Record performance metrics
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    
    // Check for threshold violations
    this.checkThresholds(metrics);
  }
  
  /**
   * Check metrics against thresholds and generate alerts
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];
    
    // Response time checks
    if (metrics.responseTime.dashboard > this.thresholds.responseTime.dashboard.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'dashboard_response_time',
        metrics.responseTime.dashboard,
        this.thresholds.responseTime.dashboard.critical,
        `Dashboard response time is critically high: ${metrics.responseTime.dashboard}ms`,
        metrics.siteId
      ));
    } else if (metrics.responseTime.dashboard > this.thresholds.responseTime.dashboard.warning) {
      alerts.push(this.createAlert(
        AlertSeverity.WARNING,
        'dashboard_response_time',
        metrics.responseTime.dashboard,
        this.thresholds.responseTime.dashboard.warning,
        `Dashboard response time is elevated: ${metrics.responseTime.dashboard}ms`,
        metrics.siteId
      ));
    }
    
    // Event ingestion response time
    if (metrics.responseTime.eventIngestion > this.thresholds.responseTime.eventIngestion.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'event_ingestion_response_time',
        metrics.responseTime.eventIngestion,
        this.thresholds.responseTime.eventIngestion.critical,
        `Event ingestion response time is critically high: ${metrics.responseTime.eventIngestion}ms`,
        metrics.siteId
      ));
    }
    
    // Throughput checks
    if (metrics.throughput.eventIngestion < this.thresholds.throughput.eventIngestion.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'event_ingestion_throughput',
        metrics.throughput.eventIngestion,
        this.thresholds.throughput.eventIngestion.critical,
        `Event ingestion throughput is critically low: ${metrics.throughput.eventIngestion} events/sec`,
        metrics.siteId
      ));
    }
    
    // Error rate checks
    const avgErrorRate = (metrics.errorRates.dashboard + metrics.errorRates.eventIngestion + metrics.errorRates.api) / 3;
    if (avgErrorRate > this.thresholds.errorRates.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'error_rate',
        avgErrorRate,
        this.thresholds.errorRates.critical,
        `Average error rate is critically high: ${avgErrorRate.toFixed(2)}%`,
        metrics.siteId
      ));
    } else if (avgErrorRate > this.thresholds.errorRates.warning) {
      alerts.push(this.createAlert(
        AlertSeverity.WARNING,
        'error_rate',
        avgErrorRate,
        this.thresholds.errorRates.warning,
        `Average error rate is elevated: ${avgErrorRate.toFixed(2)}%`,
        metrics.siteId
      ));
    }
    
    // Resource utilization checks
    if (metrics.resources.memoryUsage > this.thresholds.resources.memoryUsage.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'memory_usage',
        metrics.resources.memoryUsage,
        this.thresholds.resources.memoryUsage.critical,
        `Memory usage is critically high: ${metrics.resources.memoryUsage}MB`,
        metrics.siteId
      ));
    }
    
    if (metrics.resources.queueDepth > this.thresholds.resources.queueDepth.critical) {
      alerts.push(this.createAlert(
        AlertSeverity.CRITICAL,
        'queue_depth',
        metrics.resources.queueDepth,
        this.thresholds.resources.queueDepth.critical,
        `Queue depth is critically high: ${metrics.resources.queueDepth} items`,
        metrics.siteId
      ));
    }
    
    // Process alerts
    for (const alert of alerts) {
      this.processAlert(alert);
    }
  }
  
  /**
   * Create a performance alert
   */
  private createAlert(
    severity: AlertSeverity,
    metric: string,
    value: number,
    threshold: number,
    message: string,
    siteId?: number
  ): PerformanceAlert {
    return {
      id: `${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      metric,
      value,
      threshold,
      message,
      siteId,
      resolved: false
    };
  }
  
  /**
   * Process and store alert
   */
  private processAlert(alert: PerformanceAlert): void {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(a => 
      a.metric === alert.metric && 
      a.siteId === alert.siteId && 
      !a.resolved
    );
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.value = alert.value;
      existingAlert.timestamp = alert.timestamp;
      existingAlert.message = alert.message;
    } else {
      // Add new alert
      this.alerts.push(alert);
      
      // Keep only last 500 alerts
      if (this.alerts.length > 500) {
        this.alerts = this.alerts.slice(-500);
      }
    }
    
    // Notify alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }
  
  /**
   * Register alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }
  
  /**
   * Get current metrics summary
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
  
  /**
   * Get metrics history
   */
  getMetricsHistory(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }
  
  /**
   * Get alert history
   */
  getAlertHistory(hours: number = 24): PerformanceAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(a => a.timestamp >= cutoff);
  }
  
  /**
   * Generate performance report
   */
  generateReport(hours: number = 24): string {
    const metrics = this.getMetricsHistory(hours * 60);
    const alerts = this.getAlertHistory(hours);
    
    if (metrics.length === 0) {
      return 'No performance data available for the specified time period.';
    }
    
    const lines: string[] = [];
    
    lines.push(`📊 Performance Report (Last ${hours} hours)`);
    lines.push('=' .repeat(50));
    lines.push('');
    
    // Calculate averages
    const avgDashboardTime = metrics.reduce((sum, m) => sum + m.responseTime.dashboard, 0) / metrics.length;
    const avgEventIngestionTime = metrics.reduce((sum, m) => sum + m.responseTime.eventIngestion, 0) / metrics.length;
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput.eventIngestion, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + (m.errorRates.dashboard + m.errorRates.eventIngestion + m.errorRates.api) / 3, 0) / metrics.length;
    
    lines.push('📈 Average Performance Metrics:');
    lines.push(`Dashboard Response Time: ${avgDashboardTime.toFixed(2)}ms`);
    lines.push(`Event Ingestion Time: ${avgEventIngestionTime.toFixed(2)}ms`);
    lines.push(`Event Throughput: ${avgThroughput.toFixed(2)} events/sec`);
    lines.push(`Error Rate: ${avgErrorRate.toFixed(2)}%`);
    lines.push('');
    
    // Alert summary
    const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    const warningAlerts = alerts.filter(a => a.severity === AlertSeverity.WARNING);
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    lines.push('🚨 Alert Summary:');
    lines.push(`Critical Alerts: ${criticalAlerts.length}`);
    lines.push(`Warning Alerts: ${warningAlerts.length}`);
    lines.push(`Active Alerts: ${activeAlerts.length}`);
    lines.push('');
    
    // Recent alerts
    if (activeAlerts.length > 0) {
      lines.push('🔥 Active Alerts:');
      activeAlerts.slice(0, 5).forEach(alert => {
        const icon = alert.severity === AlertSeverity.CRITICAL ? '🔴' : '🟡';
        lines.push(`${icon} ${alert.message}`);
      });
      lines.push('');
    }
    
    // Performance trends
    if (metrics.length >= 2) {
      const recent = metrics.slice(-10);
      const older = metrics.slice(0, 10);
      
      const recentAvgDashboard = recent.reduce((sum, m) => sum + m.responseTime.dashboard, 0) / recent.length;
      const olderAvgDashboard = older.reduce((sum, m) => sum + m.responseTime.dashboard, 0) / older.length;
      
      const trend = recentAvgDashboard > olderAvgDashboard ? '📈 Increasing' : '📉 Decreasing';
      const change = Math.abs(((recentAvgDashboard - olderAvgDashboard) / olderAvgDashboard) * 100);
      
      lines.push('📊 Performance Trends:');
      lines.push(`Dashboard Response Time: ${trend} (${change.toFixed(1)}% change)`);
      lines.push('');
    }
    
    // Recommendations
    lines.push('💡 Recommendations:');
    if (avgDashboardTime > this.thresholds.responseTime.dashboard.warning) {
      lines.push('- Consider optimizing dashboard queries or adding caching');
    }
    if (avgThroughput < this.thresholds.throughput.eventIngestion.warning) {
      lines.push('- Review event ingestion pipeline for bottlenecks');
    }
    if (avgErrorRate > this.thresholds.errorRates.warning) {
      lines.push('- Investigate error patterns and implement fixes');
    }
    if (activeAlerts.length > 0) {
      lines.push('- Address active alerts to improve system stability');
    }
    if (lines.length === 1) {
      lines.push('- System performance is within acceptable thresholds');
    }
    
    return lines.join('\n');
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware for automatic performance tracking
 */
export function createPerformanceMiddleware(monitor: PerformanceMonitor = performanceMonitor) {
  return {
    /**
     * Track dashboard request performance
     */
    trackDashboardRequest: async <T>(operation: () => Promise<T>): Promise<T> => {
      const startTime = performance.now();
      let error = false;
      
      try {
        const result = await operation();
        return result;
      } catch (err) {
        error = true;
        throw err;
      } finally {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Record metrics (simplified - in real implementation, aggregate with other metrics)
        monitor.recordMetrics({
          timestamp: new Date(),
          responseTime: {
            dashboard: responseTime,
            eventIngestion: 0,
            api: 0
          },
          throughput: {
            dashboardRequests: 1,
            eventIngestion: 0,
            apiRequests: 0
          },
          errorRates: {
            dashboard: error ? 100 : 0,
            eventIngestion: 0,
            api: 0
          },
          resources: {
            memoryUsage: 0,
            cpuUsage: 0,
            durableObjectCount: 0,
            queueDepth: 0
          },
          business: {
            activeUsers: 0,
            eventsPerMinute: 0,
            sitesActive: 0
          }
        });
      }
    },
    
    /**
     * Track event ingestion performance
     */
    trackEventIngestion: async <T>(eventCount: number, operation: () => Promise<T>): Promise<T> => {
      const startTime = performance.now();
      let error = false;
      
      try {
        const result = await operation();
        return result;
      } catch (err) {
        error = true;
        throw err;
      } finally {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const throughput = (eventCount / responseTime) * 1000; // events per second
        
        monitor.recordMetrics({
          timestamp: new Date(),
          responseTime: {
            dashboard: 0,
            eventIngestion: responseTime,
            api: 0
          },
          throughput: {
            dashboardRequests: 0,
            eventIngestion: throughput,
            apiRequests: 0
          },
          errorRates: {
            dashboard: 0,
            eventIngestion: error ? 100 : 0,
            api: 0
          },
          resources: {
            memoryUsage: 0,
            cpuUsage: 0,
            durableObjectCount: 0,
            queueDepth: 0
          },
          business: {
            activeUsers: 0,
            eventsPerMinute: eventCount,
            sitesActive: 0
          }
        });
      }
    }
  };
}