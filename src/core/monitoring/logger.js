/**
 * ==========================================
 * FILE: logger.js
 * MODULE: Core/Monitoring
 * CODE: MON-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Central logging engine for the CRM.
 * Provides structured logging with different levels,
 * log rotation, and transport to multiple destinations.
 * 
 * DEPENDENCIES:
 * - None (standalone)
 * 
 * FUNCTIONS:
 * - debug(message, context): Log debug message
 * - info(message, context): Log info message
 * - warn(message, context): Log warning message
 * - error(message, context): Log error message
 * - fatal(message, context): Log fatal error
 * - setLevel(level): Set minimum log level
 * - addTransport(transport): Add log transport
 * - getLogs(filters): Get stored logs
 * - clearLogs(): Clear all logs
 * - getStats(): Get logging statistics
 * - createChild(metadata): Create child logger with context
 * 
 * USAGE EXAMPLE:
 * import { logger } from './core/monitoring/logger.js';
 * 
 * logger.info('User logged in', {
 *   userId: 'user_123',
 *   ip: '192.168.1.1',
 *   tenantId: 'tenant_1'
 * });
 * 
 * try {
 *   // Some operation
 * } catch (error) {
 *   logger.error('Operation failed', {
 *     error: error.message,
 *     stack: error.stack,
 *     operation: 'createLead'
 *   });
 * }
 * ==========================================
 */

class Logger {
    constructor() {
        // Log levels
        this.LEVELS = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4,
            OFF: 5
        };

        // Current log level (default: INFO)
        this.currentLevel = this.LEVELS.INFO;
        
        // In-memory log storage (for MVP)
        this.logs = [];
        this.maxLogs = 10000;
        
        // Transports (destinations)
        this.transports = [];
        
        // Default transports
        this.addTransport({
            type: 'console',
            enabled: true,
            level: this.LEVELS.INFO
        });
        
        // Configuration
        this.config = {
            includeTimestamp: true,
            includeLevel: true,
            includeMetadata: true,
            timestampFormat: 'ISO',
            enableStackTrace: true
        };
        
        // Child loggers
        this.children = new Map();
        
        // Statistics
        this.stats = {
            total: 0,
            byLevel: {
                DEBUG: 0,
                INFO: 0,
                WARN: 0,
                ERROR: 0,
                FATAL: 0
            },
            byTransport: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample data
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
                level: 'INFO',
                message: 'System started',
                timestamp: new Date(now.getTime() - 3600000).toISOString(),
                metadata: {
                    version: '1.0.0',
                    environment: 'development'
                }
            },
            {
                id: 'log_1002',
                level: 'DEBUG',
                message: 'User authentication successful',
                timestamp: new Date(now.getTime() - 1800000).toISOString(),
                metadata: {
                    userId: 'user_123',
                    tenantId: 'tenant_1'
                }
            },
            {
                id: 'log_1003',
                level: 'ERROR',
                message: 'Database connection failed',
                timestamp: new Date(now.getTime() - 900000).toISOString(),
                metadata: {
                    error: 'ECONNREFUSED',
                    retryCount: 3,
                    database: 'firestore'
                }
            }
        ];

        for (const log of sampleLogs) {
            this.logs.push(log);
            this.updateStats(log);
        }
    }

    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    debug(message, metadata = {}, options = {}) {
        this.log('DEBUG', message, metadata, options);
    }

    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    info(message, metadata = {}, options = {}) {
        this.log('INFO', message, metadata, options);
    }

    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    warn(message, metadata = {}, options = {}) {
        this.log('WARN', message, metadata, options);
    }

    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    error(message, metadata = {}, options = {}) {
        // If error object is passed, extract details
        if (metadata instanceof Error) {
            const error = metadata;
            metadata = {
                error: error.message,
                stack: error.stack,
                ...(options.includeStack !== false ? { stack: error.stack } : {})
            };
        }
        this.log('ERROR', message, metadata, options);
    }

    /**
     * Log a fatal error message
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    fatal(message, metadata = {}, options = {}) {
        if (metadata instanceof Error) {
            const error = metadata;
            metadata = {
                error: error.message,
                stack: error.stack,
                ...(options.includeStack !== false ? { stack: error.stack } : {})
            };
        }
        this.log('FATAL', message, metadata, options);
    }

    /**
     * Core logging function
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     * @param {object} options - Additional options
     */
    log(level, message, metadata = {}, options = {}) {
        // Check if level is enabled
        const levelValue = this.LEVELS[level];
        if (levelValue < this.currentLevel) {
            return;
        }

        // Create log entry
        const entry = {
            id: this.generateId(),
            level: level,
            message: message,
            timestamp: new Date().toISOString(),
            metadata: metadata,
            ...(options.includeStackTrace ? { stack: new Error().stack } : {})
        };

        // Store log
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Update stats
        this.updateStats(entry);

        // Send to transports
        this.sendToTransports(entry);

        // Debug output
        if (this.debugMode) {
            console.log(`[Logger] ${level}: ${message}`, metadata);
        }

        return entry;
    }

    /**
     * Set minimum log level
     * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, FATAL, OFF)
     */
    setLevel(level) {
        if (this.LEVELS[level] === undefined) {
            throw new Error(`Invalid log level: ${level}`);
        }
        this.currentLevel = this.LEVELS[level];
        if (this.debugMode) {
            console.log(`[Logger] Log level set to: ${level}`);
        }
    }

    /**
     * Get current log level
     * @returns {string} Current log level
     */
    getLevel() {
        for (const [name, value] of Object.entries(this.LEVELS)) {
            if (value === this.currentLevel) {
                return name;
            }
        }
        return 'INFO';
    }

    /**
     * Add log transport
     * @param {object} transport - Transport configuration
     */
    addTransport(transport) {
        this.transports.push({
            ...transport,
            enabled: transport.enabled !== undefined ? transport.enabled : true
        });
        
        if (this.debugMode) {
            console.log(`[Logger] Transport added: ${transport.type}`);
        }
    }

    /**
     * Remove log transport
     * @param {string} type - Transport type
     */
    removeTransport(type) {
        this.transports = this.transports.filter(t => t.type !== type);
        if (this.debugMode) {
            console.log(`[Logger] Transport removed: ${type}`);
        }
    }

    /**
     * Send log entry to all transports
     * @param {object} entry - Log entry
     */
    sendToTransports(entry) {
        for (const transport of this.transports) {
            if (!transport.enabled) continue;
            
            // Check if transport level allows this log
            if (transport.level !== undefined && this.LEVELS[entry.level] < transport.level) {
                continue;
            }

            try {
                this.sendToTransport(transport, entry);
            } catch (error) {
                console.error(`[Logger] Error sending to transport ${transport.type}:`, error);
            }
        }
    }

    /**
     * Send log entry to specific transport
     * @param {object} transport - Transport configuration
     * @param {object} entry - Log entry
     */
    sendToTransport(transport, entry) {
        const formattedEntry = this.formatEntry(entry, transport.format);

        switch (transport.type) {
            case 'console':
                this.sendToConsole(entry.level, formattedEntry);
                break;
            case 'file':
                this.sendToFile(formattedEntry, transport);
                break;
            case 'http':
                this.sendToHttp(formattedEntry, transport);
                break;
            case 'database':
                this.sendToDatabase(entry, transport);
                break;
            default:
                // Unknown transport, just console log
                this.sendToConsole(entry.level, formattedEntry);
        }

        // Update transport stats
        this.stats.byTransport[transport.type] = (this.stats.byTransport[transport.type] || 0) + 1;
    }

    /**
     * Send log to console
     * @param {string} level - Log level
     * @param {string} message - Formatted message
     */
    sendToConsole(level, message) {
        switch (level) {
            case 'DEBUG':
                console.debug(message);
                break;
            case 'INFO':
                console.info(message);
                break;
            case 'WARN':
                console.warn(message);
                break;
            case 'ERROR':
                console.error(message);
                break;
            case 'FATAL':
                console.error(`[FATAL] ${message}`);
                break;
            default:
                console.log(message);
        }
    }

    /**
     * Send log to file (simulated for MVP)
     * @param {string} message - Formatted message
     * @param {object} transport - Transport configuration
     */
    sendToFile(message, transport) {
        // In production, this would write to a file
        if (this.debugMode) {
            console.log(`[Logger] File transport: ${message}`);
        }
    }

    /**
     * Send log via HTTP (simulated for MVP)
     * @param {string} message - Formatted message
     * @param {object} transport - Transport configuration
     */
    sendToHttp(message, transport) {
        // In production, this would send HTTP request
        if (this.debugMode) {
            console.log(`[Logger] HTTP transport: ${message}`);
        }
    }

    /**
     * Send log to database (simulated for MVP)
     * @param {object} entry - Log entry
     * @param {object} transport - Transport configuration
     */
    sendToDatabase(entry, transport) {
        // In production, this would save to database
        if (this.debugMode) {
            console.log(`[Logger] Database transport: ${entry.id}`);
        }
    }

    /**
     * Format log entry
     * @param {object} entry - Log entry
     * @param {string} format - Format type
     * @returns {string} Formatted message
     */
    formatEntry(entry, format = 'json') {
        const parts = [];

        if (this.config.includeTimestamp) {
            const timestamp = this.config.timestampFormat === 'ISO' 
                ? entry.timestamp 
                : new Date(entry.timestamp).toLocaleString();
            parts.push(`[${timestamp}]`);
        }

        if (this.config.includeLevel) {
            parts.push(`[${entry.level}]`);
        }

        parts.push(entry.message);

        if (this.config.includeMetadata && entry.metadata && Object.keys(entry.metadata).length > 0) {
            parts.push(JSON.stringify(entry.metadata));
        }

        return parts.join(' ');
    }

    /**
     * Get stored logs with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Filtered logs
     */
    getLogs(filters = {}, options = {}) {
        let results = [...this.logs];

        // Apply filters
        if (filters.level) {
            const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
            results = results.filter(log => levels.includes(log.level));
        }

        if (filters.startDate) {
            results = results.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(log => 
                log.message.toLowerCase().includes(searchTerm) ||
                JSON.stringify(log.metadata).toLowerCase().includes(searchTerm)
            );
        }

        if (filters.hasMetadata) {
            results = results.filter(log => log.metadata && Object.keys(log.metadata).length > 0);
        }

        // Apply sorting
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated;
    }

    /**
     * Clear all logs
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    clearLogs(options = {}) {
        if (!options.confirm) {
            throw new Error('Confirmation required to clear all logs');
        }

        this.logs = [];
        this.stats.total = 0;
        for (const level of Object.keys(this.stats.byLevel)) {
            this.stats.byLevel[level] = 0;
        }
        this.stats.byTransport = {};

        if (this.debugMode) {
            console.log('[Logger] All logs cleared');
        }

        return true;
    }

    /**
     * Get logging statistics
     * @param {object} options - Additional options
     * @returns {object} Logging statistics
     */
    getStats(options = {}) {
        return {
            ...this.stats,
            currentLevel: this.getLevel(),
            totalTransports: this.transports.length,
            maxLogs: this.maxLogs,
            currentLogs: this.logs.length
        };
    }

    /**
     * Create a child logger with context
     * @param {object} metadata - Context metadata
     * @param {object} options - Additional options
     * @returns {object} Child logger
     */
    createChild(metadata = {}, options = {}) {
        const childId = 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        const child = {
            id: childId,
            metadata: metadata,
            parent: this,
            debug: (msg, meta, opts) => this.debug(msg, { ...metadata, ...meta }, opts),
            info: (msg, meta, opts) => this.info(msg, { ...metadata, ...meta }, opts),
            warn: (msg, meta, opts) => this.warn(msg, { ...metadata, ...meta }, opts),
            error: (msg, meta, opts) => this.error(msg, { ...metadata, ...meta }, opts),
            fatal: (msg, meta, opts) => this.fatal(msg, { ...metadata, ...meta }, opts),
            setLevel: (level) => this.setLevel(level),
            getLevel: () => this.getLevel(),
            getLogs: (filters) => this.getLogs(filters),
            getStats: () => this.getStats()
        };

        this.children.set(childId, child);
        
        if (this.debugMode) {
            console.log(`[Logger] Child logger created: ${childId}`);
        }

        return child;
    }

    /**
     * Update statistics for a log entry
     * @param {object} entry - Log entry
     */
    updateStats(entry) {
        this.stats.total++;
        this.stats.byLevel[entry.level] = (this.stats.byLevel[entry.level] || 0) + 1;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[Logger] Debug mode enabled');
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
     * Clean up old logs
     * @param {number} days - Days to retain
     * @returns {number} Number of logs deleted
     */
    cleanupOldLogs(days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const before = this.logs.length;
        this.logs = this.logs.filter(log => new Date(log.timestamp) >= cutoff);
        const deleted = before - this.logs.length;

        if (this.debugMode) {
            console.log(`[Logger] Cleaned up ${deleted} old logs`);
        }

        return deleted;
    }
}

// Create and export singleton instance
export const logger = new Logger();

// Export class for testing
export default Logger;
