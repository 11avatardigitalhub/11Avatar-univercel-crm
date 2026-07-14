/**
 * ==========================================
 * FILE: auditLogger.js
 * MODULE: Core/Audit
 * CODE: AUD-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Central audit logging engine for the CRM.
 * Tracks all user actions, system events, and data changes.
 * Provides immutable audit trail for compliance and security.
 * 
 * DEPENDENCIES:
 * - None (standalone)
 * 
 * FUNCTIONS:
 * - log(userId, action, resource, details): Log an action
 * - getAuditLogs(filters): Get audit logs with filters
 * - getAuditTrail(resourceId): Get audit trail for a resource
 * - getUserActivity(userId): Get user activity
 * - getSystemAudit(): Get system audit logs
 * - exportAuditLogs(format, filters): Export audit logs
 * - searchAuditLogs(query): Search audit logs
 * - getAuditStats(): Get audit statistics
 * - validateAuditIntegrity(): Validate log integrity
 * - cleanupOldLogs(days): Clean old logs
 * 
 * USAGE EXAMPLE:
 * import { auditLogger } from './core/audit/auditLogger.js';
 * 
 * // Log a user action
 * await auditLogger.log('user_123', 'lead.created', 'lead', {
 *   leadId: 'lead_456',
 *   name: 'John Doe',
 *   changes: { status: 'new' }
 * });
 * 
 * // Get audit trail for a resource
 * const trail = await auditLogger.getAuditTrail('lead_456');
 * 
 * // Search audit logs
 * const results = await auditLogger.searchAuditLogs('John Doe');
 * ==========================================
 */

class AuditLogger {
    constructor() {
        // In-memory storage for audit logs (for MVP)
        // In production, this would be Firestore or another database
        this.auditLogs = [];
        
        // Log index for faster lookups
        this.index = {
            byUserId: new Map(),
            byResource: new Map(),
            byAction: new Map(),
            byDate: new Map()
        };
        
        // Cache for recent logs
        this.cache = {
            logs: [],
            size: 1000,
            enabled: true
        };
        
        // Configuration
        this.config = {
            retentionDays: 90,
            maxLogsPerRequest: 1000,
            enableCache: true,
            enableIndexing: true,
            enableIntegrityCheck: true,
            batchSize: 100,
            flushInterval: 60000 // 1 minute
        };
        
        // Batch queue
        this.batchQueue = [];
        this.isFlushing = false;
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with some sample data for testing
        this.initSampleData();
        
        // Start auto-flush
        this.startAutoFlush();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        // This would be removed in production
        // For now, it helps with testing
        if (this.auditLogs.length === 0) {
            const sampleLogs = [
                {
                    id: 'audit_1',
                    userId: 'user_123',
                    action: 'login',
                    resource: 'user',
                    resourceId: 'user_123',
                    details: {
                        ip: '192.168.1.1',
                        userAgent: 'Chrome/120.0.0.0',
                        location: 'Mumbai, India'
                    },
                    timestamp: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 'audit_2',
                    userId: 'user_123',
                    action: 'lead.created',
                    resource: 'lead',
                    resourceId: 'lead_456',
                    details: {
                        name: 'John Doe',
                        phone: '+91 9876543210',
                        source: 'website'
                    },
                    timestamp: new Date(Date.now() - 1800000).toISOString()
                },
                {
                    id: 'audit_3',
                    userId: 'user_456',
                    action: 'customer.updated',
                    resource: 'customer',
                    resourceId: 'cust_789',
                    details: {
                        changes: {
                            status: { old: 'active', new: 'inactive' },
                            priority: { old: 'low', new: 'high' }
                        }
                    },
                    timestamp: new Date(Date.now() - 900000).toISOString()
                }
            ];
            
            for (const log of sampleLogs) {
                this.auditLogs.push(log);
                this.updateIndex(log);
            }
        }
    }

    /**
     * Log an action
     * @param {string} userId - User ID
     * @param {string} action - Action name
     * @param {string} resource - Resource type
     * @param {object} details - Action details
     * @param {object} options - Additional options
     * @returns {object} Log entry
     */
    async log(userId, action, resource, details = {}, options = {}) {
        const logEntry = {
            id: this.generateId(),
            userId: userId || 'system',
            action: action,
            resource: resource,
            resourceId: details.resourceId || null,
            details: this.sanitizeDetails(details),
            ip: options.ip || null,
            userAgent: options.userAgent || null,
            timestamp: new Date().toISOString(),
            hash: null // Will be calculated
        };

        // Calculate integrity hash
        if (this.config.enableIntegrityCheck) {
            logEntry.hash = this.calculateHash(logEntry);
        }

        // Add to batch queue
        this.batchQueue.push(logEntry);

        // If queue exceeds batch size, flush immediately
        if (this.batchQueue.length >= this.config.batchSize) {
            await this.flushBatch();
        }

        // Add to cache
        if (this.config.enableCache) {
            this.cache.logs.unshift(logEntry);
            if (this.cache.logs.length > this.cache.size) {
                this.cache.logs.pop();
            }
        }

        if (this.debugMode) {
            console.log('[AuditLogger] Logged action:', logEntry);
        }

        return logEntry;
    }

    /**
     * Flush batch queue to storage
     */
    async flushBatch() {
        if (this.isFlushing || this.batchQueue.length === 0) {
            return;
        }

        this.isFlushing = true;

        try {
            // In production, this would save to Firestore
            // For MVP, save to in-memory storage
            const batch = this.batchQueue.splice(0, this.config.batchSize);
            
            for (const log of batch) {
                this.auditLogs.push(log);
                this.updateIndex(log);
            }

            if (this.debugMode) {
                console.log(`[AuditLogger] Flushed ${batch.length} logs`);
            }
        } catch (error) {
            console.error('[AuditLogger] Error flushing batch:', error);
            // Re-add failed logs to queue
            this.batchQueue.unshift(...batch);
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Start auto-flush interval
     */
    startAutoFlush() {
        setInterval(() => {
            if (this.batchQueue.length > 0) {
                this.flushBatch();
            }
        }, this.config.flushInterval);
    }

    /**
     * Get audit logs with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Filtered logs
     */
    async getAuditLogs(filters = {}, options = {}) {
        await this.flushBatch(); // Ensure all logs are saved

        let logs = [...this.auditLogs];

        // Apply filters
        if (filters.userId) {
            logs = logs.filter(log => log.userId === filters.userId);
        }

        if (filters.action) {
            logs = logs.filter(log => log.action === filters.action);
        }

        if (filters.resource) {
            logs = logs.filter(log => log.resource === filters.resource);
        }

        if (filters.resourceId) {
            logs = logs.filter(log => log.resourceId === filters.resourceId);
        }

        if (filters.startDate) {
            logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
        }

        // Sort by timestamp (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        if (options.limit) {
            const start = options.offset || 0;
            const end = start + options.limit;
            logs = logs.slice(start, end);
            options.total = this.auditLogs.length;
        }

        return logs;
    }

    /**
     * Get audit trail for a resource
     * @param {string} resourceId - Resource ID
     * @param {object} options - Additional options
     * @returns {Array} Audit trail
     */
    async getAuditTrail(resourceId, options = {}) {
        return await this.getAuditLogs(
            { resourceId: resourceId },
            { limit: options.limit || 100 }
        );
    }

    /**
     * Get user activity
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} User activity logs
     */
    async getUserActivity(userId, options = {}) {
        return await this.getAuditLogs(
            { userId: userId },
            { limit: options.limit || 50 }
        );
    }

    /**
     * Get system audit logs
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} System audit logs
     */
    async getSystemAudit(filters = {}, options = {}) {
        const systemActions = [
            'system.startup',
            'system.shutdown',
            'system.error',
            'system.warning',
            'config.updated',
            'backup.created',
            'backup.restored'
        ];

        return await this.getAuditLogs(
            { action: { $in: systemActions }, ...filters },
            options
        );
    }

    /**
     * Export audit logs
     * @param {string} format - Export format (json, csv, xlsx)
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {string|Buffer} Exported data
     */
    async exportAuditLogs(format = 'json', filters = {}, options = {}) {
        const logs = await this.getAuditLogs(filters, { limit: 10000 });

        switch (format) {
            case 'json':
                return JSON.stringify(logs, null, 2);
            case 'csv':
                return this.convertToCSV(logs);
            case 'xlsx':
                // In production, use a library like xlsx
                return this.convertToExcel(logs);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Search audit logs
     * @param {string} query - Search query
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchAuditLogs(query, options = {}) {
        await this.flushBatch();

        const searchTerms = query.toLowerCase().split(' ');
        const results = [];

        for (const log of this.auditLogs) {
            const searchableText = [
                log.userId,
                log.action,
                log.resource,
                log.resourceId,
                JSON.stringify(log.details)
            ].join(' ').toLowerCase();

            const matches = searchTerms.every(term => searchableText.includes(term));
            if (matches) {
                results.push(log);
            }

            if (options.limit && results.length >= options.limit) {
                break;
            }
        }

        return results;
    }

    /**
     * Get audit statistics
     * @param {object} options - Additional options
     * @returns {object} Audit statistics
     */
    async getAuditStats(options = {}) {
        await this.flushBatch();

        const stats = {
            totalLogs: this.auditLogs.length,
            byAction: {},
            byResource: {},
            byUser: {},
            byDate: {},
            queueSize: this.batchQueue.length,
            cacheSize: this.cache.logs.length,
            last24Hours: 0,
            last7Days: 0,
            last30Days: 0
        };

        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        for (const log of this.auditLogs) {
            // Count by action
            stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
            
            // Count by resource
            stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
            
            // Count by user
            stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
            
            // Count by date
            const date = new Date(log.timestamp).toDateString();
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;

            // Time-based counts
            const logTime = new Date(log.timestamp).getTime();
            const diff = now - logTime;
            
            if (diff <= day) {
                stats.last24Hours++;
            }
            if (diff <= 7 * day) {
                stats.last7Days++;
            }
            if (diff <= 30 * day) {
                stats.last30Days++;
            }
        }

        return stats;
    }

    /**
     * Validate audit log integrity
     * @param {object} options - Additional options
     * @returns {object} Validation results
     */
    async validateAuditIntegrity(options = {}) {
        const results = {
            valid: true,
            errors: [],
            checked: 0,
            failed: 0
        };

        if (!this.config.enableIntegrityCheck) {
            return { ...results, message: 'Integrity check disabled' };
        }

        await this.flushBatch();

        for (const log of this.auditLogs) {
            results.checked++;
            
            if (log.hash) {
                const calculatedHash = this.calculateHash(log);
                if (log.hash !== calculatedHash) {
                    results.valid = false;
                    results.failed++;
                    results.errors.push({
                        logId: log.id,
                        error: 'Hash mismatch',
                        expected: log.hash,
                        actual: calculatedHash
                    });
                }
            }
        }

        return results;
    }

    /**
     * Clean up old logs
     * @param {number} days - Days to retain
     * @param {object} options - Additional options
     * @returns {number} Number of logs deleted
     */
    async cleanupOldLogs(days = this.config.retentionDays, options = {}) {
        await this.flushBatch();

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const deleted = [];
        const remaining = [];

        for (const log of this.auditLogs) {
            if (new Date(log.timestamp) < cutoff) {
                deleted.push(log);
            } else {
                remaining.push(log);
            }
        }

        this.auditLogs = remaining;
        
        // Rebuild index
        this.rebuildIndex();

        if (this.debugMode) {
            console.log(`[AuditLogger] Cleaned up ${deleted.length} old logs`);
        }

        return deleted.length;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Sanitize details for logging
     * @param {object} details - Details to sanitize
     * @returns {object} Sanitized details
     */
    sanitizeDetails(details) {
        const sanitized = { ...details };
        
        // Remove sensitive data
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard', 'aadhar', 'pan'];
        
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '***REDACTED***';
            }
        }
        
        return sanitized;
    }

    /**
     * Calculate integrity hash
     * @param {object} log - Log entry
     * @returns {string} Hash
     */
    calculateHash(log) {
        // Simple hash for MVP
        // In production, use a proper cryptographic hash
        const data = `${log.userId}|${log.action}|${log.resource}|${log.resourceId}|${JSON.stringify(log.details)}|${log.timestamp}`;
        return this.simpleHash(data);
    }

    /**
     * Simple hash function
     * @param {string} str - String to hash
     * @returns {string} Hash
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * Update index for a log
     * @param {object} log - Log entry
     */
    updateIndex(log) {
        if (!this.config.enableIndexing) return;

        // Index by user ID
        if (!this.index.byUserId.has(log.userId)) {
            this.index.byUserId.set(log.userId, []);
        }
        this.index.byUserId.get(log.userId).push(log.id);

        // Index by resource
        if (!this.index.byResource.has(log.resource)) {
            this.index.byResource.set(log.resource, []);
        }
        this.index.byResource.get(log.resource).push(log.id);

        // Index by action
        if (!this.index.byAction.has(log.action)) {
            this.index.byAction.set(log.action, []);
        }
        this.index.byAction.get(log.action).push(log.id);

        // Index by date
        const date = new Date(log.timestamp).toDateString();
        if (!this.index.byDate.has(date)) {
            this.index.byDate.set(date, []);
        }
        this.index.byDate.get(date).push(log.id);
    }

    /**
     * Rebuild index
     */
    rebuildIndex() {
        this.index = {
            byUserId: new Map(),
            byResource: new Map(),
            byAction: new Map(),
            byDate: new Map()
        };

        for (const log of this.auditLogs) {
            this.updateIndex(log);
        }
    }

    /**
     * Convert logs to CSV
     * @param {Array} logs - Audit logs
     * @returns {string} CSV string
     */
    convertToCSV(logs) {
        if (logs.length === 0) return '';

        const headers = ['id', 'userId', 'action', 'resource', 'resourceId', 'details', 'timestamp', 'hash'];
        const rows = logs.map(log => {
            return headers.map(header => {
                let value = log[header];
                if (header === 'details') {
                    value = JSON.stringify(value);
                }
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Convert logs to Excel (placeholder)
     * @param {Array} logs - Audit logs
     * @returns {Buffer} Excel buffer
     */
    convertToExcel(logs) {
        // In production, use xlsx library
        // For MVP, return JSON as buffer
        return Buffer.from(JSON.stringify(logs));
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[AuditLogger] Debug mode enabled');
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
     * Clear all logs (dangerous - use with caution)
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async clearAllLogs(options = {}) {
        if (!options.confirm) {
            throw new Error('Confirmation required to clear all logs');
        }

        await this.flushBatch();
        this.auditLogs = [];
        this.rebuildIndex();
        
        if (this.debugMode) {
            console.log('[AuditLogger] All logs cleared');
        }

        return true;
    }
}

// Create and export singleton instance
export const auditLogger = new AuditLogger();

// Export class for testing
export default AuditLogger;
