/**
 * ==========================================
 * FILE: changeTracker.js
 * MODULE: Core/Audit
 * CODE: AUD-2
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Tracks changes to data entities with before/after comparisons.
 * Provides detailed change history for audit and rollback purposes.
 * Works with auditLogger for comprehensive audit trail.
 * 
 * DEPENDENCIES:
 * - auditLogger.js (for logging changes)
 * 
 * FUNCTIONS:
 * - trackChange(entityType, entityId, oldData, newData, userId): Track a change
 * - getChangeHistory(entityType, entityId): Get change history
 * - getChangesByUser(userId): Get changes by user
 * - getChangesByDateRange(startDate, endDate): Get changes by date
 * - getChangeCount(entityType): Get change count
 * - compareChanges(oldData, newData): Compare two objects
 * - rollbackChange(changeId): Rollback a change
 * - getEntityVersions(entityType, entityId): Get entity versions
 * - getLatestVersion(entityType, entityId): Get latest version
 * - revertToVersion(entityType, entityId, version): Revert to version
 * 
 * USAGE EXAMPLE:
 * import { changeTracker } from './core/audit/changeTracker.js';
 * 
 * // Track a change
 * await changeTracker.trackChange('lead', 'lead_123', oldLead, newLead, 'user_456');
 * 
 * // Get change history
 * const history = await changeTracker.getChangeHistory('lead', 'lead_123');
 * 
 * // Compare changes
 * const diff = changeTracker.compareChanges(oldData, newData);
 * ==========================================
 */

import { auditLogger } from './auditLogger.js';

class ChangeTracker {
    constructor() {
        // In-memory storage for change history (for MVP)
        // In production, this would be Firestore
        this.changes = [];
        this.history = new Map();
        
        // Index for faster lookups
        this.index = {
            byEntity: new Map(),
            byUser: new Map(),
            byDate: new Map()
        };
        
        // Cache for entity versions
        this.versionCache = new Map();
        
        // Configuration
        this.config = {
            maxHistoryPerEntity: 100,
            maxChangesPerRequest: 1000,
            enableVersioning: true,
            enableRollback: true,
            maxVersions: 50,
            trackAllFields: false,
            excludedFields: ['updatedAt', 'lastModified']
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
        const sampleHistory = [
            {
                id: 'change_1',
                entityType: 'lead',
                entityId: 'lead_123',
                userId: 'user_456',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                changes: {
                    status: { old: 'new', new: 'contacted' },
                    priority: { old: 'low', new: 'high' }
                },
                version: 1
            },
            {
                id: 'change_2',
                entityType: 'lead',
                entityId: 'lead_123',
                userId: 'user_456',
                timestamp: new Date(Date.now() - 1800000).toISOString(),
                changes: {
                    status: { old: 'contacted', new: 'qualified' },
                    value: { old: 0, new: 50000 }
                },
                version: 2
            },
            {
                id: 'change_3',
                entityType: 'customer',
                entityId: 'cust_789',
                userId: 'user_789',
                timestamp: new Date(Date.now() - 900000).toISOString(),
                changes: {
                    name: { old: 'ABC Corp', new: 'ABC Enterprises' },
                    status: { old: 'active', new: 'inactive' }
                },
                version: 1
            }
        ];

        for (const change of sampleHistory) {
            this.changes.push(change);
            this.updateIndex(change);
            
            // Add to history
            const key = `${change.entityType}:${change.entityId}`;
            if (!this.history.has(key)) {
                this.history.set(key, []);
            }
            this.history.get(key).push(change);
        }
    }

    /**
     * Track a change
     * @param {string} entityType - Entity type (lead, customer, deal, etc.)
     * @param {string} entityId - Entity ID
     * @param {object} oldData - Old data
     * @param {object} newData - New data
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Change record
     */
    async trackChange(entityType, entityId, oldData, newData, userId, options = {}) {
        const changes = this.compareChanges(oldData, newData);
        
        if (Object.keys(changes).length === 0) {
            return { message: 'No changes detected' };
        }

        const changeRecord = {
            id: this.generateId(),
            entityType: entityType,
            entityId: entityId,
            userId: userId || 'system',
            timestamp: new Date().toISOString(),
            changes: changes,
            version: this.getNextVersion(entityType, entityId),
            oldData: options.includeFullData ? oldData : null,
            newData: options.includeFullData ? newData : null,
            source: options.source || 'user',
            ip: options.ip || null,
            userAgent: options.userAgent || null,
            comment: options.comment || null
        };

        // Add to storage
        this.changes.push(changeRecord);
        this.updateIndex(changeRecord);

        // Add to history
        const key = `${entityType}:${entityId}`;
        if (!this.history.has(key)) {
            this.history.set(key, []);
        }
        this.history.get(key).push(changeRecord);

        // Update version cache
        this.updateVersionCache(entityType, entityId, changeRecord);

        // Log to audit
        await auditLogger.log(userId || 'system', `${entityType}.changed`, entityType, {
            entityId: entityId,
            changes: changes,
            version: changeRecord.version
        });

        if (this.debugMode) {
            console.log(`[ChangeTracker] Tracked change for ${entityType} ${entityId}:`, changes);
        }

        return changeRecord;
    }

    /**
     * Get change history for an entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @param {object} options - Additional options
     * @returns {Array} Change history
     */
    async getChangeHistory(entityType, entityId, options = {}) {
        const key = `${entityType}:${entityId}`;
        
        if (!this.history.has(key)) {
            return [];
        }

        let history = this.history.get(key);
        
        // Sort by timestamp (newest first)
        history = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        if (options.limit) {
            const start = options.offset || 0;
            const end = start + options.limit;
            history = history.slice(start, end);
        }

        return history;
    }

    /**
     * Get changes by user
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} Changes by user
     */
    async getChangesByUser(userId, options = {}) {
        if (!this.index.byUser.has(userId)) {
            return [];
        }

        const changeIds = this.index.byUser.get(userId);
        let changes = changeIds.map(id => this.findById(id)).filter(Boolean);
        
        // Sort by timestamp (newest first)
        changes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (options.limit) {
            changes = changes.slice(0, options.limit);
        }

        return changes;
    }

    /**
     * Get changes by date range
     * @param {string} startDate - Start date (ISO string)
     * @param {string} endDate - End date (ISO string)
     * @param {object} options - Additional options
     * @returns {Array} Changes in date range
     */
    async getChangesByDateRange(startDate, endDate, options = {}) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        let changes = this.changes.filter(change => {
            const timestamp = new Date(change.timestamp);
            return timestamp >= start && timestamp <= end;
        });

        // Sort by timestamp (newest first)
        changes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (options.limit) {
            changes = changes.slice(0, options.limit);
        }

        return changes;
    }

    /**
     * Get change count for an entity type
     * @param {string} entityType - Entity type
     * @returns {number} Change count
     */
    getChangeCount(entityType) {
        let count = 0;
        for (const change of this.changes) {
            if (change.entityType === entityType) {
                count++;
            }
        }
        return count;
    }

    /**
     * Compare two objects and return differences
     * @param {object} oldData - Old data
     * @param {object} newData - New data
     * @param {object} options - Additional options
     * @returns {object} Differences
     */
    compareChanges(oldData, newData, options = {}) {
        if (!oldData || !newData) {
            return {};
        }

        const changes = {};
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

        // Exclude specified fields
        const excludedFields = options.excludeFields || this.config.excludedFields;

        for (const key of allKeys) {
            if (excludedFields.includes(key)) {
                continue;
            }

            const oldValue = oldData[key];
            const newValue = newData[key];

            // Skip if both values are undefined or null
            if (oldValue === undefined && newValue === undefined) {
                continue;
            }

            // Compare objects/arrays deeply
            if (typeof oldValue === 'object' && typeof newValue === 'object') {
                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    changes[key] = {
                        old: oldValue,
                        new: newValue,
                        type: 'object'
                    };
                }
                continue;
            }

            // Simple value comparison
            if (oldValue !== newValue) {
                changes[key] = {
                    old: oldValue,
                    new: newValue,
                    type: typeof newValue
                };
            }
        }

        return changes;
    }

    /**
     * Rollback a change
     * @param {string} changeId - Change ID
     * @param {object} options - Additional options
     * @returns {object} Rollback result
     */
    async rollbackChange(changeId, options = {}) {
        const change = this.findById(changeId);
        
        if (!change) {
            throw new Error(`Change ${changeId} not found`);
        }

        if (!this.config.enableRollback) {
            throw new Error('Rollback is disabled');
        }

        // Create rollback change
        const rollbackChanges = {};
        for (const [key, value] of Object.entries(change.changes)) {
            rollbackChanges[key] = {
                old: value.new,
                new: value.old
            };
        }

        const rollbackRecord = {
            id: this.generateId(),
            entityType: change.entityType,
            entityId: change.entityId,
            userId: options.userId || 'system',
            timestamp: new Date().toISOString(),
            changes: rollbackChanges,
            version: this.getNextVersion(change.entityType, change.entityId),
            oldData: null,
            newData: null,
            source: 'rollback',
            comment: options.comment || `Rollback of change ${changeId}`,
            rollbackOf: changeId
        };

        // Store rollback
        this.changes.push(rollbackRecord);
        this.updateIndex(rollbackRecord);

        const key = `${change.entityType}:${change.entityId}`;
        if (this.history.has(key)) {
            this.history.get(key).push(rollbackRecord);
        }

        // Log to audit
        await auditLogger.log(options.userId || 'system', `${change.entityType}.rollback`, change.entityType, {
            entityId: change.entityId,
            rollbackOf: changeId,
            changes: rollbackChanges
        });

        if (this.debugMode) {
            console.log(`[ChangeTracker] Rolled back change ${changeId}`);
        }

        return {
            success: true,
            rollbackRecord: rollbackRecord,
            originalChange: change
        };
    }

    /**
     * Get entity versions
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @param {object} options - Additional options
     * @returns {Array} Entity versions
     */
    async getEntityVersions(entityType, entityId, options = {}) {
        const history = await this.getChangeHistory(entityType, entityId);
        
        if (history.length === 0) {
            return [];
        }

        // Build versions from history
        const versions = [];
        let currentData = {};

        // Start from oldest to newest
        const reversedHistory = [...history].reverse();

        for (let i = 0; i < reversedHistory.length; i++) {
            const change = reversedHistory[i];
            
            // Apply changes to build version
            const versionData = { ...currentData };
            for (const [key, value] of Object.entries(change.changes)) {
                versionData[key] = value.old;
            }
            
            versions.push({
                version: change.version,
                timestamp: change.timestamp,
                userId: change.userId,
                data: versionData,
                changeId: change.id
            });

            // Update current data for next iteration
            currentData = { ...versionData };
            for (const [key, value] of Object.entries(change.changes)) {
                currentData[key] = value.new;
            }
        }

        // Add current version
        versions.push({
            version: versions.length + 1,
            timestamp: new Date().toISOString(),
            userId: 'current',
            data: currentData,
            changeId: null,
            isCurrent: true
        });

        return versions;
    }

    /**
     * Get latest version of an entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @returns {object} Latest version
     */
    async getLatestVersion(entityType, entityId) {
        const versions = await this.getEntityVersions(entityType, entityId);
        return versions[versions.length - 1] || null;
    }

    /**
     * Revert to a specific version
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @param {number} version - Version number
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Revert result
     */
    async revertToVersion(entityType, entityId, version, userId, options = {}) {
        const versions = await this.getEntityVersions(entityType, entityId);
        const targetVersion = versions.find(v => v.version === version);
        
        if (!targetVersion) {
            throw new Error(`Version ${version} not found for ${entityType} ${entityId}`);
        }

        const currentVersion = versions[versions.length - 1];
        if (targetVersion.version === currentVersion.version) {
            return { message: 'Already at this version' };
        }

        // Track the revert as a change
        const changes = this.compareChanges(currentVersion.data, targetVersion.data);
        
        if (Object.keys(changes).length === 0) {
            return { message: 'No changes to revert' };
        }

        const changeRecord = await this.trackChange(
            entityType,
            entityId,
            currentVersion.data,
            targetVersion.data,
            userId,
            { comment: `Reverted to version ${version}`, ...options }
        );

        return {
            success: true,
            versionReverted: version,
            changeRecord: changeRecord
        };
    }

    /**
     * Find change by ID
     * @param {string} id - Change ID
     * @returns {object|null} Change record or null
     */
    findById(id) {
        return this.changes.find(change => change.id === id) || null;
    }

    /**
     * Get next version number for an entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @returns {number} Next version number
     */
    getNextVersion(entityType, entityId) {
        const key = `${entityType}:${entityId}`;
        if (!this.history.has(key)) {
            return 1;
        }
        return this.history.get(key).length + 1;
    }

    /**
     * Update version cache
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     * @param {object} change - Change record
     */
    updateVersionCache(entityType, entityId, change) {
        const key = `${entityType}:${entityId}`;
        this.versionCache.set(key, change);
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'change_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Update index for a change
     * @param {object} change - Change record
     */
    updateIndex(change) {
        // Index by entity
        const entityKey = `${change.entityType}:${change.entityId}`;
        if (!this.index.byEntity.has(entityKey)) {
            this.index.byEntity.set(entityKey, []);
        }
        this.index.byEntity.get(entityKey).push(change.id);

        // Index by user
        if (!this.index.byUser.has(change.userId)) {
            this.index.byUser.set(change.userId, []);
        }
        this.index.byUser.get(change.userId).push(change.id);

        // Index by date
        const date = new Date(change.timestamp).toDateString();
        if (!this.index.byDate.has(date)) {
            this.index.byDate.set(date, []);
        }
        this.index.byDate.get(date).push(change.id);
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[ChangeTracker] Debug mode enabled');
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
     * Get statistics
     * @returns {object} Statistics
     */
    getStats() {
        const stats = {
            totalChanges: this.changes.length,
            byEntityType: {},
            byUser: {},
            uniqueEntities: this.history.size,
            cacheSize: this.versionCache.size
        };

        // Count by entity type
        for (const change of this.changes) {
            stats.byEntityType[change.entityType] = (stats.byEntityType[change.entityType] || 0) + 1;
            stats.byUser[change.userId] = (stats.byUser[change.userId] || 0) + 1;
        }

        return stats;
    }

    /**
     * Clear all change history (dangerous - use with caution)
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async clearAll(options = {}) {
        if (!options.confirm) {
            throw new Error('Confirmation required to clear all change history');
        }

        this.changes = [];
        this.history.clear();
        this.versionCache.clear();
        this.index = {
            byEntity: new Map(),
            byUser: new Map(),
            byDate: new Map()
        };

        if (this.debugMode) {
            console.log('[ChangeTracker] All change history cleared');
        }

        return true;
    }
}

// Create and export singleton instance
export const changeTracker = new ChangeTracker();

// Export class for testing
export default ChangeTracker;
