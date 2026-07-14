/**
 * ==========================================
 * FILE: permissionEngine.js
 * MODULE: Core/RBAC
 * CODE: RBAC-2
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Advanced permission management engine for the CRM.
 * Handles field-level, record-level, and hierarchical permissions.
 * Works with roleEngine to provide fine-grained access control.
 * 
 * DEPENDENCIES:
 * - roleEngine.js (for role definitions)
 * 
 * FUNCTIONS:
 * - checkPermission(userId, permission, resource): Check permission
 * - checkFieldPermission(userId, field, resource): Check field access
 * - checkRecordPermission(userId, record, operation): Check record access
 * - getAccessibleFields(userId, resource): Get accessible fields
 * - filterRecords(userId, records, operation): Filter records by access
 * - validatePermission(userId, permission, context): Validate permission
 * - getEffectivePermissions(userId): Get all effective permissions
 * - hasFieldAccess(userId, field, resource): Check field access
 * - hasRecordAccess(userId, record, operation): Check record access
 * - getAccessibleRecords(userId, resource, operation): Get accessible records
 * 
 * USAGE EXAMPLE:
 * import { permissionEngine } from './core/rbac/permissionEngine.js';
 * 
 * // Check field permission
 * if (permissionEngine.checkFieldPermission('user_123', 'salary', 'employee')) {
 *   // Can view salary field
 * }
 * 
 * // Check record permission
 * if (permissionEngine.checkRecordPermission('user_123', leadRecord, 'update')) {
 *   // Can update this lead
 * }
 * 
 * // Filter records by access
 * const accessibleRecords = permissionEngine.filterRecords('user_123', records, 'read');
 * ==========================================
 */

import { roleEngine } from './roleEngine.js';

class PermissionEngine {
    constructor() {
        // Permission definitions
        this.permissions = new Map();
        
        // Field-level security rules
        this.fieldRules = new Map();
        
        // Record-level security rules
        this.recordRules = new Map();
        
        // Permission cache
        this.permissionCache = new Map();
        
        // Cache TTL (5 minutes)
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize default permissions
        this.initDefaultPermissions();
    }

    /**
     * Initialize default permissions
     */
    initDefaultPermissions() {
        // Define all available permissions
        const defaultPermissions = [
            // Lead permissions
            { id: 'lead_create', resource: 'lead', action: 'create' },
            { id: 'lead_read', resource: 'lead', action: 'read' },
            { id: 'lead_update', resource: 'lead', action: 'update' },
            { id: 'lead_delete', resource: 'lead', action: 'delete' },
            { id: 'lead_assign', resource: 'lead', action: 'assign' },
            { id: 'lead_convert', resource: 'lead', action: 'convert' },
            { id: 'lead_export', resource: 'lead', action: 'export' },
            { id: 'lead_import', resource: 'lead', action: 'import' },
            
            // Customer permissions
            { id: 'customer_create', resource: 'customer', action: 'create' },
            { id: 'customer_read', resource: 'customer', action: 'read' },
            { id: 'customer_update', resource: 'customer', action: 'update' },
            { id: 'customer_delete', resource: 'customer', action: 'delete' },
            { id: 'customer_export', resource: 'customer', action: 'export' },
            { id: 'customer_import', resource: 'customer', action: 'import' },
            
            // Deal permissions
            { id: 'deal_create', resource: 'deal', action: 'create' },
            { id: 'deal_read', resource: 'deal', action: 'read' },
            { id: 'deal_update', resource: 'deal', action: 'update' },
            { id: 'deal_delete', resource: 'deal', action: 'delete' },
            { id: 'deal_export', resource: 'deal', action: 'export' },
            
            // Task permissions
            { id: 'task_create', resource: 'task', action: 'create' },
            { id: 'task_read', resource: 'task', action: 'read' },
            { id: 'task_update', resource: 'task', action: 'update' },
            { id: 'task_delete', resource: 'task', action: 'delete' },
            { id: 'task_assign', resource: 'task', action: 'assign' },
            
            // WhatsApp permissions
            { id: 'whatsapp_send', resource: 'whatsapp', action: 'send' },
            { id: 'whatsapp_read', resource: 'whatsapp', action: 'read' },
            { id: 'whatsapp_broadcast', resource: 'whatsapp', action: 'broadcast' },
            { id: 'whatsapp_template', resource: 'whatsapp', action: 'template' },
            
            // Invoice permissions
            { id: 'invoice_create', resource: 'invoice', action: 'create' },
            { id: 'invoice_read', resource: 'invoice', action: 'read' },
            { id: 'invoice_update', resource: 'invoice', action: 'update' },
            { id: 'invoice_delete', resource: 'invoice', action: 'delete' },
            { id: 'invoice_pay', resource: 'invoice', action: 'pay' },
            
            // Report permissions
            { id: 'report_view', resource: 'report', action: 'view' },
            { id: 'report_create', resource: 'report', action: 'create' },
            { id: 'report_export', resource: 'report', action: 'export' },
            { id: 'report_schedule', resource: 'report', action: 'schedule' },
            
            // Admin permissions
            { id: 'admin_users', resource: 'admin', action: 'users' },
            { id: 'admin_tenants', resource: 'admin', action: 'tenants' },
            { id: 'admin_settings', resource: 'admin', action: 'settings' },
            { id: 'admin_billing', resource: 'admin', action: 'billing' },
            { id: 'admin_audit', resource: 'admin', action: 'audit' },
            { id: 'admin_backup', resource: 'admin', action: 'backup' },
            
            // Field permissions
            { id: 'field_sensitive', resource: 'field', action: 'sensitive' },
            { id: 'field_pii', resource: 'field', action: 'pii' },
            { id: 'field_financial', resource: 'field', action: 'financial' },
            { id: 'field_hr', resource: 'field', action: 'hr' }
        ];

        for (const perm of defaultPermissions) {
            this.permissions.set(perm.id, perm);
        }

        // Define field-level security rules
        this.fieldRules.set('lead', {
            sensitive: ['phone', 'email', 'address', 'notes'],
            pii: ['phone', 'email', 'address'],
            financial: ['budget', 'value', 'expected_revenue'],
            hr: ['assigned_to', 'created_by']
        });

        this.fieldRules.set('customer', {
            sensitive: ['phone', 'email', 'address', 'gstin', 'pan'],
            pii: ['phone', 'email', 'address', 'gstin', 'pan'],
            financial: ['credit_limit', 'balance', 'total_purchases'],
            hr: ['account_manager', 'created_by']
        });

        this.fieldRules.set('employee', {
            sensitive: ['phone', 'email', 'address', 'salary'],
            pii: ['phone', 'email', 'address', 'aadhar', 'pan'],
            financial: ['salary', 'bonus', 'incentives'],
            hr: ['manager', 'department', 'performance']
        });

        // Define record-level security rules
        this.recordRules.set('lead', {
            ownerOnly: ['update', 'delete'],
            teamOnly: ['read', 'update'],
            allAccess: ['read']
        });

        this.recordRules.set('customer', {
            ownerOnly: ['update', 'delete'],
            teamOnly: ['read', 'update'],
            allAccess: ['read']
        });

        this.recordRules.set('deal', {
            ownerOnly: ['update', 'delete'],
            teamOnly: ['read', 'update'],
            allAccess: ['read']
        });

        if (this.debugMode) {
            console.log('[PermissionEngine] Default permissions initialized');
        }
    }

    /**
     * Check if user has a specific permission
     * @param {string} userId - User ID
     * @param {string} permissionId - Permission ID
     * @param {object} context - Additional context
     * @returns {boolean} Whether user has permission
     */
    checkPermission(userId, permissionId, context = {}) {
        // Check cache
        const cacheKey = `perm:${userId}:${permissionId}`;
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
        }

        // Get user roles
        const roles = roleEngine.getUserRoles(userId, { includeHierarchy: true });
        
        // Check each role's permissions
        for (const roleId of roles) {
            const role = roleEngine.getRole(roleId);
            if (!role) continue;
            
            // Check for wildcard permission
            if (role.permissions.includes('*')) {
                this.cachePermission(cacheKey, true);
                return true;
            }
            
            // Check for specific permission
            if (role.permissions.includes(permissionId)) {
                this.cachePermission(cacheKey, true);
                return true;
            }
            
            // Check for resource-level wildcard
            const resource = this.getResourceFromPermission(permissionId);
            if (resource && role.permissions.includes(`${resource}_*`)) {
                this.cachePermission(cacheKey, true);
                return true;
            }
        }

        this.cachePermission(cacheKey, false);
        return false;
    }

    /**
     * Check field-level permission
     * @param {string} userId - User ID
     * @param {string} field - Field name
     * @param {string} resource - Resource type
     * @param {object} context - Additional context
     * @returns {boolean} Whether user can access field
     */
    checkFieldPermission(userId, field, resource, context = {}) {
        // Check cache
        const cacheKey = `field:${userId}:${resource}:${field}`;
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
        }

        // Get field rules for resource
        const rules = this.fieldRules.get(resource);
        if (!rules) {
            this.cachePermission(cacheKey, true);
            return true;
        }

        // Check if field is in sensitive categories
        const categories = ['sensitive', 'pii', 'financial', 'hr'];
        let isSensitive = false;
        let category = null;

        for (const cat of categories) {
            if (rules[cat] && rules[cat].includes(field)) {
                isSensitive = true;
                category = cat;
                break;
            }
        }

        if (!isSensitive) {
            this.cachePermission(cacheKey, true);
            return true;
        }

        // Check permission for sensitive field
        const permissionId = `field_${category}`;
        const hasPermission = this.checkPermission(userId, permissionId, context);
        
        this.cachePermission(cacheKey, hasPermission);
        return hasPermission;
    }

    /**
     * Check record-level permission
     * @param {string} userId - User ID
     * @param {object} record - Record object
     * @param {string} operation - Operation (read, update, delete)
     * @param {object} context - Additional context
     * @returns {boolean} Whether user can perform operation on record
     */
    checkRecordPermission(userId, record, operation, context = {}) {
        if (!record || !record.resource) {
            return false;
        }

        // Check cache
        const cacheKey = `record:${userId}:${record.resource}:${record.id}:${operation}`;
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
        }

        // Get record rules for resource
        const rules = this.recordRules.get(record.resource);
        if (!rules) {
            this.cachePermission(cacheKey, true);
            return true;
        }

        // Check if user is owner
        const isOwner = record.ownerId === userId || record.createdBy === userId;
        if (isOwner && rules.ownerOnly.includes(operation)) {
            this.cachePermission(cacheKey, true);
            return true;
        }

        // Check if user is in team
        const isTeamMember = context.teamIds && context.teamIds.includes(record.teamId);
        if (isTeamMember && rules.teamOnly.includes(operation)) {
            this.cachePermission(cacheKey, true);
            return true;
        }

        // Check all-access
        if (rules.allAccess.includes(operation)) {
            // Check if user has read permission
            const hasRead = this.checkPermission(userId, `${record.resource}_read`, context);
            if (hasRead) {
                this.cachePermission(cacheKey, true);
                return true;
            }
        }

        // Check permission for specific operation
        const permissionId = `${record.resource}_${operation}`;
        const hasPermission = this.checkPermission(userId, permissionId, context);
        
        this.cachePermission(cacheKey, hasPermission);
        return hasPermission;
    }

    /**
     * Get accessible fields for a resource
     * @param {string} userId - User ID
     * @param {string} resource - Resource type
     * @param {object} context - Additional context
     * @returns {Array} List of accessible fields
     */
    getAccessibleFields(userId, resource, context = {}) {
        const rules = this.fieldRules.get(resource);
        if (!rules) {
            return [];
        }

        const accessible = [];
        const allFields = new Set([
            ...(rules.sensitive || []),
            ...(rules.pii || []),
            ...(rules.financial || []),
            ...(rules.hr || [])
        ]);

        // Also include common fields that are not in rules
        // In production, this would be fetched from schema

        for (const field of allFields) {
            if (this.checkFieldPermission(userId, field, resource, context)) {
                accessible.push(field);
            }
        }

        return accessible;
    }

    /**
     * Filter records by access
     * @param {string} userId - User ID
     * @param {Array} records - List of records
     * @param {string} operation - Operation (read, update, delete)
     * @param {object} context - Additional context
     * @returns {Array} Filtered records
     */
    filterRecords(userId, records, operation, context = {}) {
        if (!records || records.length === 0) {
            return [];
        }

        const filtered = [];
        for (const record of records) {
            if (this.checkRecordPermission(userId, record, operation, context)) {
                filtered.push(record);
            }
        }

        return filtered;
    }

    /**
     * Get accessible records for a resource
     * @param {string} userId - User ID
     * @param {string} resource - Resource type
     * @param {string} operation - Operation (read, update, delete)
     * @param {object} context - Additional context
     * @returns {Array} List of accessible record IDs
     */
    getAccessibleRecords(userId, resource, operation, context = {}) {
        // In production, this would query the database with filters
        // For now, return empty array (to be implemented by data layer)
        return [];
    }

    /**
     * Get effective permissions for a user
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} List of effective permissions
     */
    getEffectivePermissions(userId, options = {}) {
        const roles = roleEngine.getUserRoles(userId, { includeHierarchy: true });
        const permissions = new Set();

        for (const roleId of roles) {
            const role = roleEngine.getRole(roleId);
            if (!role) continue;
            
            for (const perm of role.permissions) {
                if (perm === '*') {
                    // Return all permissions
                    for (const [id] of this.permissions) {
                        permissions.add(id);
                    }
                    return Array.from(permissions);
                }
                permissions.add(perm);
            }
        }

        return Array.from(permissions);
    }

    /**
     * Validate permission in context
     * @param {string} userId - User ID
     * @param {string} permissionId - Permission ID
     * @param {object} context - Validation context
     * @returns {object} Validation result
     */
    validatePermission(userId, permissionId, context = {}) {
        const result = {
            allowed: false,
            reason: '',
            details: {}
        };

        // Check if user exists
        if (!userId) {
            result.reason = 'User ID is required';
            return result;
        }

        // Check if permission exists
        if (!this.permissions.has(permissionId)) {
            result.reason = `Permission ${permissionId} does not exist`;
            return result;
        }

        // Check if user has the permission
        const hasPermission = this.checkPermission(userId, permissionId, context);
        if (!hasPermission) {
            result.reason = 'User does not have required permission';
            return result;
        }

        // Check field-level permissions if context has fields
        if (context.fields && context.resource) {
            for (const field of context.fields) {
                if (!this.checkFieldPermission(userId, field, context.resource, context)) {
                    result.allowed = false;
                    result.reason = `User does not have access to field: ${field}`;
                    result.details = { field };
                    return result;
                }
            }
        }

        // Check record-level permissions if context has records
        if (context.records && context.operation) {
            for (const record of context.records) {
                if (!this.checkRecordPermission(userId, record, context.operation, context)) {
                    result.allowed = false;
                    result.reason = `User does not have access to record: ${record.id}`;
                    result.details = { recordId: record.id };
                    return result;
                }
            }
        }

        result.allowed = true;
        result.reason = 'Permission granted';
        result.details = { permissionId, userId };

        return result;
    }

    /**
     * Get resource from permission ID
     * @param {string} permissionId - Permission ID
     * @returns {string|null} Resource name or null
     */
    getResourceFromPermission(permissionId) {
        const parts = permissionId.split('_');
        if (parts.length >= 2) {
            return parts[0];
        }
        return null;
    }

    /**
     * Cache permission result
     * @param {string} key - Cache key
     * @param {boolean} value - Permission result
     */
    cachePermission(key, value) {
        this.permissionCache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Clear permission cache
     * @param {string} userId - Optional user ID
     */
    clearCache(userId = null) {
        if (userId) {
            const toRemove = [];
            for (const key of this.permissionCache.keys()) {
                if (key.includes(userId)) {
                    toRemove.push(key);
                }
            }
            for (const key of toRemove) {
                this.permissionCache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        } else {
            this.permissionCache.clear();
            this.cacheTimestamps.clear();
        }
    }

    /**
     * Add custom field rule
     * @param {string} resource - Resource type
     * @param {string} category - Category (sensitive, pii, financial, hr)
     * @param {Array} fields - List of fields
     */
    addFieldRule(resource, category, fields) {
        if (!this.fieldRules.has(resource)) {
            this.fieldRules.set(resource, {});
        }
        const rules = this.fieldRules.get(resource);
        rules[category] = fields;
        this.fieldRules.set(resource, rules);
    }

    /**
     * Add custom record rule
     * @param {string} resource - Resource type
     * @param {string} level - Level (ownerOnly, teamOnly, allAccess)
     * @param {Array} operations - List of operations
     */
    addRecordRule(resource, level, operations) {
        if (!this.recordRules.has(resource)) {
            this.recordRules.set(resource, {});
        }
        const rules = this.recordRules.get(resource);
        rules[level] = operations;
        this.recordRules.set(resource, rules);
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[PermissionEngine] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Get permission statistics
     * @param {object} options - Additional options
     * @returns {object} Permission statistics
     */
    getStats(options = {}) {
        return {
            totalPermissions: this.permissions.size,
            totalFieldRules: this.fieldRules.size,
            totalRecordRules: this.recordRules.size,
            cacheSize: this.permissionCache.size
        };
    }
}

// Create and export singleton instance
export const permissionEngine = new PermissionEngine();

// Export class for testing
export default PermissionEngine;
