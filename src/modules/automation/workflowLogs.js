/**
 * ==========================================
 * FILE: workflowLogs.js
 * MODULE: Automation Module
 * CODE: AUTO-6
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Workflow logging system for automation workflows.
 * Handles log collection, storage, querying, and analysis.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - tenantIsolation.js (for tenant context)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize workflow logs system
 * - logExecution(executionId, data): Log workflow execution
 * - logNodeExecution(executionId, nodeId, data): Log node execution
 * - logActionExecution(executionId, actionId, data): Log action execution
 * - logEvent(eventType, data): Log a workflow event
 * - getLogs(filters): Get logs with filters
 * - getExecutionLogs(executionId): Get logs for an execution
 * - getNodeLogs(executionId, nodeId): Get logs for a node
 * - getActionLogs(executionId, actionId): Get logs for an action
 * - getLogStats(): Get log statistics
 * - searchLogs(query): Search logs
 * - exportLogs(filters, format): Export logs
 * - cleanLogs(days): Clean old logs
 * - getLogSummary(executionId): Get log summary
 * - getLogTimeline(executionId): Get log timeline
 * - getErrorLogs(): Get error logs
 * - getPerformanceLogs(): Get performance logs
 * 
 * USAGE EXAMPLE:
 * import { workflowLogs } from './modules/automation/workflowLogs.js';
 * 
 * // Initialize workflow logs
 * await workflowLogs.initialize();
 * 
 * // Log workflow execution
 * await workflowLogs.logExecution('exec_123', {
 *   workflowId: 'wf_456',
 *   status: 'success',
 *   duration: 5000,
 *   context: { leadId: 'lead_789' }
 * });
 * 
 * // Get execution logs
 * const logs = await workflowLogs.getExecutionLogs('exec_123');
 * 
 * // Search logs
 * const results = await workflowLogs.searchLogs('lead_789');
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory storage (for MVP)
// In production, this would be Firestore or Cloud Logging
let workflowLogs = [];
let logIdCounter = 1000;

// Log levels
const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// Log categories
const LOG_CATEGORIES = {
    EXECUTION: 'execution',
    NODE: 'node',
    ACTION: 'action',
    EVENT: 'event',
    SYSTEM: 'system',
    ERROR: 'error',
    PERFORMANCE: 'performance',
    SECURITY: 'security'
};

class WorkflowLogs {
    constructor() {
        // Service state
        this.initialized = false;
        this.logBuffer = [];
        this.bufferSize = 100;
        this.isFlushing = false;
        
        // Configuration
        this.config = {
            maxLogsPerTenant: 10000,
            maxLogAge: 90, // days
            enableBuffering: true,
            bufferFlushInterval: 5000, // 5 seconds
            enableSearch: true,
            enableExport: true,
            maxExportSize: 1000,
            logRetentionDays: 30,
            enablePerformanceLogging: true,
            enableSecurityLogging: true
        };
        
        // Cache
        this.cache = {
            executions: new Map(),
            logs: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalLogs: 0,
            byLevel: {},
            byCategory: {},
            byDate: {},
            errors: 0,
            warnings: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize
        this.initSampleData();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const now = new Date();
        const sampleLogs = [
            {
                id: 'log_1001',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'info',
                category: 'execution',
                message: 'Workflow execution started',
                data: { workflowId: 'wf_1', trigger: 'lead.created' },
                timestamp: new Date(now.getTime() - 60000).toISOString(),
                duration: null
            },
            {
                id: 'log_1002',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'info',
                category: 'node',
                message: 'Node execution completed',
                data: { nodeId: 'node_1', nodeType: 'trigger' },
                timestamp: new Date(now.getTime() - 55000).toISOString(),
                duration: 5000
            },
            {
                id: 'log_1003',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'info',
                category: 'action',
                message: 'Action executed successfully',
                data: { actionId: 'action_1', actionType: 'send_whatsapp' },
                timestamp: new Date(now.getTime() - 50000).toISOString(),
                duration: 3000
            },
            {
                id: 'log_1004',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'warning',
                category: 'performance',
                message: 'Action execution took longer than expected',
                data: { actionId: 'action_2', duration: 8000, threshold: 5000 },
                timestamp: new Date(now.getTime() - 45000).toISOString(),
                duration: 8000
            },
            {
                id: 'log_1005',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'error',
                category: 'error',
                message: 'Action execution failed',
                data: { actionId: 'action_3', error: 'Invalid phone number' },
                timestamp: new Date(now.getTime() - 40000).toISOString(),
                duration: 2000
            },
            {
                id: 'log_1006',
                tenantId: 'tenant_1',
                executionId: 'exec_1',
                level: 'info',
                category: 'execution',
                message: 'Workflow execution completed with errors',
                data: { workflowId: 'wf_1', status: 'failed' },
                timestamp: new Date(now.getTime() - 35000).toISOString(),
                duration: 25000
            }
        ];

        for (const log of sampleLogs) {
            workflowLogs.push(log);
            this.updateStats(log);
        }
    }

    /**
     * Initialize workflow logs system
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            // Update config if provided
            if (options.config) {
                this.config = { ...this.config, ...options.config };
            }

            // Start buffer flusher
            if (this.config.enableBuffering) {
                this.startBufferFlusher();
            }

            // Start log cleaner
            this.startLogCleaner();

            logger.info('Workflow logs system initialized', {
                totalLogs: workflowLogs.length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Workflow logs system initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start buffer flusher
     */
    startBufferFlusher() {
        setInterval(() => {
            if (this.logBuffer.length > 0) {
                this.flushBuffer();
            }
        }, this.config.bufferFlushInterval);
    }

    /**
     * Start log cleaner
     */
    startLogCleaner() {
        setInterval(() => {
            if (this.initialized) {
                this.cleanLogs();
            }
        }, 86400000); // Run once per day
    }

    /**
     * Flush log buffer to storage
     */
    async flushBuffer() {
        if (this.isFlushing || this.logBuffer.length === 0) {
            return;
        }

        this.isFlushing = true;

        try {
            const batch = this.logBuffer.splice(0, this.bufferSize);
            
            for (const log of batch) {
                workflowLogs.push(log);
                this.updateStats(log);
            }

            if (this.debugMode) {
                logger.debug(`[WorkflowLogs] Flushed ${batch.length} logs`);
            }
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Log a workflow execution
     * @param {string} executionId - Execution ID
     * @param {object} data - Log data
     * @param {object} options - Additional options
     * @returns {object} Created log
     */
    async logExecution(executionId, data, options = {}) {
        return await this.log({
            executionId: executionId,
            level: data.status === 'success' ? 'info' : 'error',
            category: LOG_CATEGORIES.EXECUTION,
            message: `Workflow execution ${data.status}`,
            data: data,
            duration: data.duration || null
        }, options);
    }

    /**
     * Log a node execution
     * @param {string} executionId - Execution ID
     * @param {string} nodeId - Node ID
     * @param {object} data - Log data
     * @param {object} options - Additional options
     * @returns {object} Created log
     */
    async logNodeExecution(executionId, nodeId, data, options = {}) {
        return await this.log({
            executionId: executionId,
            nodeId: nodeId,
            level: data.status === 'success' ? 'info' : 'error',
            category: LOG_CATEGORIES.NODE,
            message: `Node ${nodeId} execution ${data.status}`,
            data: data,
            duration: data.duration || null
        }, options);
    }

    /**
     * Log an action execution
     * @param {string} executionId - Execution ID
     * @param {string} actionId - Action ID
     * @param {object} data - Log data
     * @param {object} options - Additional options
     * @returns {object} Created log
     */
    async logActionExecution(executionId, actionId, data, options = {}) {
        return await this.log({
            executionId: executionId,
            actionId: actionId,
            level: data.status === 'success' ? 'info' : 'error',
            category: LOG_CATEGORIES.ACTION,
            message: `Action ${actionId} execution ${data.status}`,
            data: data,
            duration: data.duration || null
        }, options);
    }

    /**
     * Log a workflow event
     * @param {string} eventType - Event type
     * @param {object} data - Log data
     * @param {object} options - Additional options
     * @returns {object} Created log
     */
    async logEvent(eventType, data, options = {}) {
        return await this.log({
            executionId: data.executionId || null,
            level: 'info',
            category: LOG_CATEGORIES.EVENT,
            message: `Event triggered: ${eventType}`,
            data: { eventType, ...data },
            duration: null
        }, options);
    }

    /**
     * Core logging function
     * @param {object} logData - Log data
     * @param {object} options - Additional options
     * @returns {object} Created log
     */
    async log(logData, options = {}) {
        if (!this.initialized) {
            throw new Error('Workflow logs system not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant() || options.tenantId;
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate log data
        this.validateLogData(logData);

        // Create log entry
        const log = {
            id: this.generateId(),
            tenantId: tenantId,
            executionId: logData.executionId || null,
            nodeId: logData.nodeId || null,
            actionId: logData.actionId || null,
            level: logData.level || LOG_LEVELS.INFO,
            category: logData.category || LOG_CATEGORIES.SYSTEM,
            message: logData.message,
            data: logData.data || {},
            duration: logData.duration || null,
            timestamp: new Date().toISOString(),
            source: options.source || 'system',
            userId: options.userId || null,
            ip: options.ip || null,
            userAgent: options.userAgent || null
        };

        // Add to buffer or store directly
        if (this.config.enableBuffering) {
            this.logBuffer.push(log);
            if (this.logBuffer.length >= this.bufferSize) {
                await this.flushBuffer();
            }
        } else {
            workflowLogs.push(log);
            this.updateStats(log);
        }

        // Log to system logger
        if (log.level === 'error' || log.level === 'critical') {
            logger.error(`[WorkflowLogs] ${log.message}`, log.data);
        } else if (log.level === 'warning') {
            logger.warn(`[WorkflowLogs] ${log.message}`, log.data);
        } else {
            logger.debug(`[WorkflowLogs] ${log.message}`, log.data);
        }

        // Emit event
        eventBus.publish('workflow.log.created', {
            logId: log.id,
            executionId: log.executionId,
            level: log.level,
            message: log.message
        });

        if (this.debugMode) {
            logger.debug(`[WorkflowLogs] Log created: ${log.id}`);
        }

        return { ...log };
    }

    /**
     * Get logs with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of logs
     */
    async getLogs(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Flush buffer to ensure all logs are included
        if (this.config.enableBuffering && this.logBuffer.length > 0) {
            await this.flushBuffer();
        }

        let results = workflowLogs.filter(l => l.tenantId === tenantId);

        // Apply filters
        if (filters.executionId) {
            results = results.filter(l => l.executionId === filters.executionId);
        }

        if (filters.nodeId) {
            results = results.filter(l => l.nodeId === filters.nodeId);
        }

        if (filters.actionId) {
            results = results.filter(l => l.actionId === filters.actionId);
        }

        if (filters.level) {
            const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
            results = results.filter(l => levels.includes(l.level));
        }

        if (filters.category) {
            const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
            results = results.filter(l => categories.includes(l.category));
        }

        if (filters.startDate) {
            results = results.filter(l => new Date(l.timestamp) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(l => new Date(l.timestamp) <= new Date(filters.endDate));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(l =>
                l.message.toLowerCase().includes(searchTerm) ||
                JSON.stringify(l.data).toLowerCase().includes(searchTerm)
            );
        }

        if (filters.hasErrors) {
            results = results.filter(l => l.level === 'error' || l.level === 'critical');
        }

        if (filters.hasWarnings) {
            results = results.filter(l => l.level === 'warning');
        }

        // Apply sorting
        const sortBy = options.sortBy || 'timestamp';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'timestamp' || sortBy === 'duration') {
                valA = valA || 0;
                valB = valB || 0;
            }
            
            if (sortOrder === 'asc') {
                return valA < valB ? -1 : 1;
            } else {
                return valA > valB ? -1 : 1;
            }
        });

        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(l => ({ ...l }));
    }

    /**
     * Get logs for an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {Array} Execution logs
     */
    async getExecutionLogs(executionId, options = {}) {
        return await this.getLogs({ executionId }, options);
    }

    /**
     * Get logs for a node
     * @param {string} executionId - Execution ID
     * @param {string} nodeId - Node ID
     * @param {object} options - Additional options
     * @returns {Array} Node logs
     */
    async getNodeLogs(executionId, nodeId, options = {}) {
        return await this.getLogs({ executionId, nodeId }, options);
    }

    /**
     * Get logs for an action
     * @param {string} executionId - Execution ID
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {Array} Action logs
     */
    async getActionLogs(executionId, actionId, options = {}) {
        return await this.getLogs({ executionId, actionId }, options);
    }

    /**
     * Get log statistics
     * @param {object} options - Additional options
     * @returns {object} Log statistics
     */
    async getLogStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Flush buffer
        if (this.config.enableBuffering && this.logBuffer.length > 0) {
            await this.flushBuffer();
        }

        const tenantLogs = workflowLogs.filter(l => l.tenantId === tenantId);

        const stats = {
            total: tenantLogs.length,
            byLevel: {},
            byCategory: {},
            byDate: {},
            errors: 0,
            warnings: 0,
            averageDuration: 0
        };

        let totalDuration = 0;
        let durationCount = 0;

        for (const log of tenantLogs) {
            // By level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            // By category
            stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
            
            // By date
            const date = new Date(log.timestamp).toDateString();
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;

            // Errors and warnings
            if (log.level === 'error' || log.level === 'critical') {
                stats.errors++;
            }
            if (log.level === 'warning') {
                stats.warnings++;
            }

            // Average duration
            if (log.duration) {
                totalDuration += log.duration;
                durationCount++;
            }
        }

        stats.averageDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

        return stats;
    }

    /**
     * Search logs
     * @param {string} query - Search query
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchLogs(query, options = {}) {
        if (!this.config.enableSearch) {
            throw new Error('Log search is disabled');
        }

        return await this.getLogs({ search: query }, options);
    }

    /**
     * Export logs
     * @param {object} filters - Filter criteria
     * @param {string} format - Export format (json, csv)
     * @param {object} options - Additional options
     * @returns {string|Array} Exported logs
     */
    async exportLogs(filters = {}, format = 'json', options = {}) {
        if (!this.config.enableExport) {
            throw new Error('Log export is disabled');
        }

        // Get logs
        const logs = await this.getLogs(filters, {
            limit: this.config.maxExportSize
        });

        if (format === 'json') {
            return JSON.stringify(logs, null, 2);
        }

        if (format === 'csv') {
            // Convert to CSV
            const headers = ['id', 'executionId', 'level', 'category', 'message', 'timestamp', 'duration'];
            const rows = logs.map(log => {
                return headers.map(header => {
                    let value = log[header] || '';
                    if (typeof value === 'string' && value.includes(',')) {
                        value = `"${value}"`;
                    }
                    return value;
                }).join(',');
            });
            return [headers.join(','), ...rows].join('\n');
        }

        return logs;
    }

    /**
     * Clean old logs
     * @param {number} days - Days to retain
     * @param {object} options - Additional options
     * @returns {number} Number of logs deleted
     */
    async cleanLogs(days = this.config.logRetentionDays, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Flush buffer
        if (this.config.enableBuffering && this.logBuffer.length > 0) {
            await this.flushBuffer();
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const before = workflowLogs.length;
        workflowLogs = workflowLogs.filter(log => 
            log.tenantId !== tenantId || new Date(log.timestamp) >= cutoff
        );

        const deleted = before - workflowLogs.length;

        if (this.debugMode) {
            logger.debug(`[WorkflowLogs] Cleaned ${deleted} old logs`);
        }

        return deleted;
    }

    /**
     * Get log summary for an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {object} Log summary
     */
    async getLogSummary(executionId, options = {}) {
        const logs = await this.getExecutionLogs(executionId, options);

        const summary = {
            executionId: executionId,
            totalLogs: logs.length,
            byLevel: {},
            byCategory: {},
            errors: 0,
            warnings: 0,
            startTime: null,
            endTime: null,
            duration: null
        };

        for (const log of logs) {
            // By level
            summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
            
            // By category
            summary.byCategory[log.category] = (summary.byCategory[log.category] || 0) + 1;

            // Errors and warnings
            if (log.level === 'error' || log.level === 'critical') {
                summary.errors++;
            }
            if (log.level === 'warning') {
                summary.warnings++;
            }

            // Time range
            if (!summary.startTime || log.timestamp < summary.startTime) {
                summary.startTime = log.timestamp;
            }
            if (!summary.endTime || log.timestamp > summary.endTime) {
                summary.endTime = log.timestamp;
            }
        }

        // Calculate duration
        if (summary.startTime && summary.endTime) {
            summary.duration = new Date(summary.endTime).getTime() - new Date(summary.startTime).getTime();
        }

        return summary;
    }

    /**
     * Get log timeline for an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {Array} Log timeline
     */
    async getLogTimeline(executionId, options = {}) {
        const logs = await this.getExecutionLogs(executionId, {
            sortBy: 'timestamp',
            sortOrder: 'asc'
        });

        return logs.map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            category: log.category,
            message: log.message,
            data: log.data,
            duration: log.duration
        }));
    }

    /**
     * Get error logs
     * @param {object} options - Additional options
     * @returns {Array} Error logs
     */
    async getErrorLogs(options = {}) {
        return await this.getLogs({ hasErrors: true }, options);
    }

    /**
     * Get performance logs
     * @param {object} options - Additional options
     * @returns {Array} Performance logs
     */
    async getPerformanceLogs(options = {}) {
        const logs = await this.getLogs({ category: LOG_CATEGORIES.PERFORMANCE }, options);
        
        // Sort by duration descending
        logs.sort((a, b) => (b.duration || 0) - (a.duration || 0));

        return logs;
    }

    /**
     * Validate log data
     * @param {object} logData - Log data
     * @throws {Error} If validation fails
     */
    validateLogData(logData) {
        if (!logData.message) {
            throw new Error('Log message is required');
        }
        if (logData.level && !Object.values(LOG_LEVELS).includes(logData.level)) {
            throw new Error(`Invalid log level: ${logData.level}`);
        }
        if (logData.category && !Object.values(LOG_CATEGORIES).includes(logData.category)) {
            throw new Error(`Invalid log category: ${logData.category}`);
        }
    }

    /**
     * Update statistics
     * @param {object} log - Log entry
     */
    updateStats(log) {
        this.stats.totalLogs++;
        this.stats.byLevel[log.level] = (this.stats.byLevel[log.level] || 0) + 1;
        this.stats.byCategory[log.category] = (this.stats.byCategory[log.category] || 0) + 1;
        
        const date = new Date(log.timestamp).toDateString();
        this.stats.byDate[date] = (this.stats.byDate[date] || 0) + 1;

        if (log.level === 'error' || log.level === 'critical') {
            this.stats.errors++;
        }
        if (log.level === 'warning') {
            this.stats.warnings++;
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        logIdCounter++;
        return 'log_' + logIdCounter;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[WorkflowLogs] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Flush buffer before cleanup
        if (this.logBuffer.length > 0) {
            this.flushBuffer();
        }

        this.initialized = false;
        this.logBuffer = [];
        this.isFlushing = false;
        this.cache.executions.clear();
        this.cache.logs.clear();
        this.cacheTimestamps.clear();

        logger.info('Workflow logs system cleaned up');
    }
}

// Create and export singleton instance
export const workflowLogs = new WorkflowLogs();

// Export class for testing
export default WorkflowLogs;
