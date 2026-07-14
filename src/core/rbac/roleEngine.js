/**
 * ==========================================
 * FILE: roleEngine.js
 * MODULE: Core/RBAC
 * CODE: RBAC-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Central role management engine for the CRM.
 * Defines roles, permissions, and access control rules.
 * Supports hierarchical roles and custom permissions.
 * 
 * DEPENDENCIES:
 * - None (standalone)
 * 
 * FUNCTIONS:
 * - getRole(roleId): Get role definition
 * - getAllRoles(): Get all roles
 * - createRole(roleData): Create new role
 * - updateRole(roleId, roleData): Update role
 * - deleteRole(roleId): Delete role
 * - assignRole(userId, roleId): Assign role to user
 * - removeRole(userId, roleId): Remove role from user
 * - getUserRoles(userId): Get user's roles
 * - hasPermission(userId, permission): Check permission
 * - hasRole(userId, roleId): Check role
 * - getPermissionsForRole(roleId): Get role permissions
 * - addPermissionToRole(roleId, permission): Add permission
 * - removePermissionFromRole(roleId, permission): Remove permission
 * - getUsersWithRole(roleId): Get users with role
 * - validateRoleHierarchy(parentRole, childRole): Validate hierarchy
 * 
 * USAGE EXAMPLE:
 * import { roleEngine } from './core/rbac/roleEngine.js';
 * 
 * // Check if user has permission
 * if (roleEngine.hasPermission('user_123', 'can_edit_leads')) {
 *   // Allow action
 * }
 * 
 * // Assign role to user
 * await roleEngine.assignRole('user_123', 'manager');
 * 
 * // Get user's roles
 * const roles = roleEngine.getUserRoles('user_123');
 * ==========================================
 */

class RoleEngine {
    constructor() {
        // Role definitions
        this.roles = new Map();
        
        // User role assignments
        this.userRoles = new Map();
        
        // Role hierarchies
        this.roleHierarchy = new Map();
        
        // Permission cache
        this.permissionCache = new Map();
        
        // Cache TTL (5 minutes)
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize default roles
        this.initDefaultRoles();
    }

    /**
     * Initialize default roles
     */
    initDefaultRoles() {
        // Platform Owner
        this.roles.set('platform_owner', {
            id: 'platform_owner',
            name: 'Platform Owner',
            description: 'Full platform access',
            level: 100,
            permissions: ['*'],
            isSystem: true,
            canAssignRoles: true,
            canManageAll: true,
            createdAt: new Date().toISOString()
        });

        // Super Admin
        this.roles.set('super_admin', {
            id: 'super_admin',
            name: 'Super Admin',
            description: 'Full system access',
            level: 90,
            permissions: [
                'manage_tenants',
                'manage_users',
                'manage_subscriptions',
                'view_all',
                'edit_all',
                'delete_all',
                'manage_billing',
                'manage_settings',
                'view_audit',
                'manage_system'
            ],
            isSystem: true,
            canAssignRoles: true,
            canManageAll: true,
            createdAt: new Date().toISOString()
        });

        // Admin
        this.roles.set('admin', {
            id: 'admin',
            name: 'Admin',
            description: 'Tenant admin access',
            level: 80,
            permissions: [
                'manage_users',
                'manage_settings',
                'view_all',
                'edit_all',
                'manage_teams',
                'manage_branches',
                'view_reports',
                'export_data',
                'manage_integrations',
                'manage_workflows'
            ],
            isSystem: true,
            canAssignRoles: true,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Manager
        this.roles.set('manager', {
            id: 'manager',
            name: 'Manager',
            description: 'Team management access',
            level: 70,
            permissions: [
                'manage_team',
                'view_all',
                'edit_team_leads',
                'assign_tasks',
                'view_reports',
                'approve_requests',
                'manage_team_schedule',
                'view_team_performance',
                'manage_team_visits'
            ],
            isSystem: true,
            canAssignRoles: false,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Executive
        this.roles.set('executive', {
            id: 'executive',
            name: 'Executive',
            description: 'Sales executive access',
            level: 60,
            permissions: [
                'create_leads',
                'edit_own_leads',
                'view_own_leads',
                'manage_tasks',
                'send_whatsapp',
                'make_calls',
                'create_followups',
                'view_own_reports',
                'create_customers',
                'edit_own_customers',
                'view_own_customers'
            ],
            isSystem: true,
            canAssignRoles: false,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Telecaller
        this.roles.set('telecaller', {
            id: 'telecaller',
            name: 'Telecaller',
            description: 'Telecalling access',
            level: 50,
            permissions: [
                'view_assigned_leads',
                'make_calls',
                'send_whatsapp',
                'create_followups',
                'update_lead_status',
                'view_own_tasks',
                'log_calls',
                'view_assigned_customers'
            ],
            isSystem: true,
            canAssignRoles: false,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Support Agent
        this.roles.set('support', {
            id: 'support',
            name: 'Support Agent',
            description: 'Customer support access',
            level: 45,
            permissions: [
                'view_assigned_tickets',
                'reply_tickets',
                'view_customers',
                'send_whatsapp',
                'create_notes',
                'view_ticket_history',
                'escalate_tickets',
                'view_knowledge_base'
            ],
            isSystem: true,
            canAssignRoles: false,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Viewer
        this.roles.set('viewer', {
            id: 'viewer',
            name: 'Viewer',
            description: 'Read-only access',
            level: 40,
            permissions: [
                'view_own_leads',
                'view_reports',
                'export_data',
                'view_dashboard',
                'view_customers',
                'view_tasks'
            ],
            isSystem: true,
            canAssignRoles: false,
            canManageAll: false,
            createdAt: new Date().toISOString()
        });

        // Setup role hierarchy
        this.roleHierarchy.set('platform_owner', ['super_admin', 'admin', 'manager', 'executive', 'telecaller', 'support', 'viewer']);
        this.roleHierarchy.set('super_admin', ['admin', 'manager', 'executive', 'telecaller', 'support', 'viewer']);
        this.roleHierarchy.set('admin', ['manager', 'executive', 'telecaller', 'support', 'viewer']);
        this.roleHierarchy.set('manager', ['executive', 'telecaller', 'support', 'viewer']);
        this.roleHierarchy.set('executive', ['telecaller', 'viewer']);
        this.roleHierarchy.set('telecaller', ['viewer']);
        this.roleHierarchy.set('support', ['viewer']);
        this.roleHierarchy.set('viewer', []);

        if (this.debugMode) {
            console.log('[RoleEngine] Default roles initialized');
        }
    }

    /**
     * Get role definition
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {object|null} Role definition or null
     */
    getRole(roleId, options = {}) {
        if (!this.roles.has(roleId)) {
            if (this.debugMode) {
                console.warn(`[RoleEngine] Role not found: ${roleId}`);
            }
            return null;
        }

        const role = this.roles.get(roleId);
        
        // Return copy to prevent mutation
        return {
            ...role,
            permissions: [...role.permissions]
        };
    }

    /**
     * Get all roles
     * @param {object} options - Additional options
     * @returns {Array} List of roles
     */
    getAllRoles(options = {}) {
        const roles = [];
        for (const [id, role] of this.roles) {
            if (options.includeSystem !== false) {
                roles.push({ ...role, permissions: [...role.permissions] });
            } else if (!role.isSystem) {
                roles.push({ ...role, permissions: [...role.permissions] });
            }
        }
        return roles;
    }

    /**
     * Create new role
     * @param {object} roleData - Role data
     * @param {object} options - Additional options
     * @returns {object} Created role
     * @throws {Error} If role already exists or invalid data
     */
    createRole(roleData, options = {}) {
        if (!roleData.id || !roleData.name) {
            throw new Error('Role ID and name are required');
        }

        if (this.roles.has(roleData.id)) {
            throw new Error(`Role ${roleData.id} already exists`);
        }

        const newRole = {
            id: roleData.id,
            name: roleData.name,
            description: roleData.description || '',
            level: roleData.level || 50,
            permissions: roleData.permissions || [],
            isSystem: false,
            canAssignRoles: roleData.canAssignRoles || false,
            canManageAll: false,
            parentRole: roleData.parentRole || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.roles.set(roleData.id, newRole);

        if (this.debugMode) {
            console.log(`[RoleEngine] Created role: ${roleData.id}`);
        }

        return { ...newRole };
    }

    /**
     * Update role
     * @param {string} roleId - Role ID
     * @param {object} roleData - Updated role data
     * @param {object} options - Additional options
     * @returns {object} Updated role
     * @throws {Error} If role not found or system role
     */
    updateRole(roleId, roleData, options = {}) {
        if (!this.roles.has(roleId)) {
            throw new Error(`Role ${roleId} not found`);
        }

        const role = this.roles.get(roleId);

        if (role.isSystem && !options.forceUpdate) {
            throw new Error(`Cannot update system role: ${roleId}`);
        }

        const updatedRole = {
            ...role,
            ...roleData,
            id: roleId, // Prevent ID change
            updatedAt: new Date().toISOString()
        };

        this.roles.set(roleId, updatedRole);

        // Clear permission cache for this role
        this.clearPermissionCache(roleId);

        if (this.debugMode) {
            console.log(`[RoleEngine] Updated role: ${roleId}`);
        }

        return { ...updatedRole };
    }

    /**
     * Delete role
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether role was deleted
     * @throws {Error} If role not found or system role
     */
    deleteRole(roleId, options = {}) {
        if (!this.roles.has(roleId)) {
            throw new Error(`Role ${roleId} not found`);
        }

        const role = this.roles.get(roleId);

        if (role.isSystem && !options.forceDelete) {
            throw new Error(`Cannot delete system role: ${roleId}`);
        }

        // Check if role is assigned to any user
        const usersWithRole = this.getUsersWithRole(roleId);
        if (usersWithRole.length > 0 && !options.forceDelete) {
            throw new Error(`Role ${roleId} is assigned to ${usersWithRole.length} users`);
        }

        // Remove role from hierarchy
        for (const [parent, children] of this.roleHierarchy) {
            const index = children.indexOf(roleId);
            if (index !== -1) {
                children.splice(index, 1);
                this.roleHierarchy.set(parent, children);
            }
        }

        this.roles.delete(roleId);

        if (this.debugMode) {
            console.log(`[RoleEngine] Deleted role: ${roleId}`);
        }

        return true;
    }

    /**
     * Assign role to user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether role was assigned
     * @throws {Error} If role not found
     */
    assignRole(userId, roleId, options = {}) {
        if (!this.roles.has(roleId)) {
            throw new Error(`Role ${roleId} not found`);
        }

        if (!this.userRoles.has(userId)) {
            this.userRoles.set(userId, []);
        }

        const roles = this.userRoles.get(userId);
        
        if (!roles.includes(roleId)) {
            roles.push(roleId);
            this.userRoles.set(userId, roles);
            
            // Clear permission cache for user
            this.clearUserPermissionCache(userId);

            if (this.debugMode) {
                console.log(`[RoleEngine] Assigned role ${roleId} to user ${userId}`);
            }
            return true;
        }

        if (this.debugMode) {
            console.log(`[RoleEngine] User ${userId} already has role ${roleId}`);
        }
        return false;
    }

    /**
     * Remove role from user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether role was removed
     */
    removeRole(userId, roleId, options = {}) {
        if (!this.userRoles.has(userId)) {
            return false;
        }

        const roles = this.userRoles.get(userId);
        const index = roles.indexOf(roleId);
        
        if (index === -1) {
            return false;
        }

        roles.splice(index, 1);
        
        if (roles.length === 0) {
            this.userRoles.delete(userId);
        } else {
            this.userRoles.set(userId, roles);
        }

        // Clear permission cache for user
        this.clearUserPermissionCache(userId);

        if (this.debugMode) {
            console.log(`[RoleEngine] Removed role ${roleId} from user ${userId}`);
        }

        return true;
    }

    /**
     * Get user's roles
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} List of role IDs
     */
    getUserRoles(userId, options = {}) {
        if (!this.userRoles.has(userId)) {
            return [];
        }

        const roles = this.userRoles.get(userId);
        
        if (options.includeHierarchy) {
            // Include inherited roles
            const allRoles = new Set(roles);
            for (const roleId of roles) {
                const children = this.roleHierarchy.get(roleId) || [];
                for (const child of children) {
                    allRoles.add(child);
                }
            }
            return Array.from(allRoles);
        }

        return [...roles];
    }

    /**
     * Get all users with a specific role
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {Array} List of user IDs
     */
    getUsersWithRole(roleId, options = {}) {
        const users = [];
        for (const [userId, roles] of this.userRoles) {
            if (roles.includes(roleId)) {
                users.push(userId);
            }
        }
        return users;
    }

    /**
     * Check if user has permission
     * @param {string} userId - User ID
     * @param {string} permission - Permission to check
     * @param {object} options - Additional options
     * @returns {boolean} Whether user has permission
     */
    hasPermission(userId, permission, options = {}) {
        // Check cache first
        const cacheKey = `${userId}:${permission}`;
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
        }

        const roles = this.getUserRoles(userId, { includeHierarchy: true });
        
        for (const roleId of roles) {
            const role = this.roles.get(roleId);
            if (!role) continue;
            
            // Check for wildcard permission
            if (role.permissions.includes('*')) {
                this.cachePermission(cacheKey, true);
                return true;
            }
            
            if (role.permissions.includes(permission)) {
                this.cachePermission(cacheKey, true);
                return true;
            }
        }

        this.cachePermission(cacheKey, false);
        return false;
    }

    /**
     * Check if user has role
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether user has role
     */
    hasRole(userId, roleId, options = {}) {
        const roles = this.getUserRoles(userId, options);
        return roles.includes(roleId);
    }

    /**
     * Get all permissions for a role
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {Array} List of permissions
     */
    getPermissionsForRole(roleId, options = {}) {
        const role = this.roles.get(roleId);
        if (!role) {
            return [];
        }

        let permissions = [...role.permissions];
        
        if (options.includeInherited) {
            // Include permissions from parent roles
            const parents = this.roleHierarchy.get(roleId) || [];
            for (const parentId of parents) {
                const parentRole = this.roles.get(parentId);
                if (parentRole) {
                    permissions = [...permissions, ...parentRole.permissions];
                }
            }
            // Remove duplicates
            permissions = [...new Set(permissions)];
        }

        return permissions;
    }

    /**
     * Add permission to role
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to add
     * @param {object} options - Additional options
     * @returns {boolean} Whether permission was added
     */
    addPermissionToRole(roleId, permission, options = {}) {
        if (!this.roles.has(roleId)) {
            throw new Error(`Role ${roleId} not found`);
        }

        const role = this.roles.get(roleId);
        
        if (role.isSystem && !options.forceUpdate) {
            throw new Error(`Cannot modify system role: ${roleId}`);
        }

        if (!role.permissions.includes(permission)) {
            role.permissions.push(permission);
            this.roles.set(roleId, role);
            
            // Clear permission cache for this role
            this.clearPermissionCache(roleId);

            if (this.debugMode) {
                console.log(`[RoleEngine] Added permission ${permission} to role ${roleId}`);
            }
            return true;
        }

        return false;
    }

    /**
     * Remove permission from role
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to remove
     * @param {object} options - Additional options
     * @returns {boolean} Whether permission was removed
     */
    removePermissionFromRole(roleId, permission, options = {}) {
        if (!this.roles.has(roleId)) {
            throw new Error(`Role ${roleId} not found`);
        }

        const role = this.roles.get(roleId);
        
        if (role.isSystem && !options.forceUpdate) {
            throw new Error(`Cannot modify system role: ${roleId}`);
        }

        // Don't remove wildcard permission
        if (permission === '*') {
            return false;
        }

        const index = role.permissions.indexOf(permission);
        if (index === -1) {
            return false;
        }

        role.permissions.splice(index, 1);
        this.roles.set(roleId, role);
        
        // Clear permission cache for this role
        this.clearPermissionCache(roleId);

        if (this.debugMode) {
            console.log(`[RoleEngine] Removed permission ${permission} from role ${roleId}`);
        }

        return true;
    }

    /**
     * Validate role hierarchy
     * @param {string} parentRole - Parent role ID
     * @param {string} childRole - Child role ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether hierarchy is valid
     */
    validateRoleHierarchy(parentRole, childRole, options = {}) {
        if (!this.roles.has(parentRole) || !this.roles.has(childRole)) {
            return false;
        }

        const parent = this.roles.get(parentRole);
        const child = this.roles.get(childRole);

        // Parent must have higher level than child
        if (parent.level <= child.level) {
            if (this.debugMode) {
                console.warn(`[RoleEngine] Invalid hierarchy: ${parentRole} (${parent.level}) <= ${childRole} (${child.level})`);
            }
            return false;
        }

        return true;
    }

    /**
     * Get role hierarchy for a role
     * @param {string} roleId - Role ID
     * @param {object} options - Additional options
     * @returns {Array} List of role IDs in hierarchy
     */
    getRoleHierarchy(roleId, options = {}) {
        const hierarchy = [roleId];
        
        if (options.includeChildren) {
            const children = this.roleHierarchy.get(roleId) || [];
            hierarchy.push(...children);
        }
        
        if (options.includeParents) {
            for (const [parent, children] of this.roleHierarchy) {
                if (children.includes(roleId)) {
                    hierarchy.push(parent);
                }
            }
        }

        return hierarchy;
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
     * Clear permission cache for a role
     * @param {string} roleId - Role ID
     */
    clearPermissionCache(roleId) {
        // Remove all cache entries that might be affected by this role
        const toRemove = [];
        for (const key of this.permissionCache.keys()) {
            // Check if key contains roleId
            if (key.includes(roleId)) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) {
            this.permissionCache.delete(key);
            this.cacheTimestamps.delete(key);
        }
    }

    /**
     * Clear permission cache for a user
     * @param {string} userId - User ID
     */
    clearUserPermissionCache(userId) {
        const toRemove = [];
        for (const key of this.permissionCache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) {
            this.permissionCache.delete(key);
            this.cacheTimestamps.delete(key);
        }
    }

    /**
     * Clear all permission cache
     */
    clearAllPermissionCache() {
        this.permissionCache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[RoleEngine] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Get role statistics
     * @param {object} options - Additional options
     * @returns {object} Role statistics
     */
    getStats(options = {}) {
        const stats = {
            totalRoles: this.roles.size,
            systemRoles: 0,
            customRoles: 0,
            totalUsers: this.userRoles.size,
            roleAssignments: 0,
            totalPermissions: 0,
            permissionsByRole: {}
        };

        for (const [id, role] of this.roles) {
            if (role.isSystem) {
                stats.systemRoles++;
            } else {
                stats.customRoles++;
            }
            stats.totalPermissions += role.permissions.length;
            stats.permissionsByRole[id] = role.permissions.length;
        }

        for (const [userId, roles] of this.userRoles) {
            stats.roleAssignments += roles.length;
        }

        return stats;
    }
}

// Create and export singleton instance
export const roleEngine = new RoleEngine();

// Export class for testing
export default RoleEngine;
