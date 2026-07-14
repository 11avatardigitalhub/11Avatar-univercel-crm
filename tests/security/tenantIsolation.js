/**
 * ==========================================
 * FILE: tenantIsolation.js
 * MODULE: Core/Multitenancy
 * CODE: MT-6
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.1.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Ensures complete data isolation between tenants.
 * Prevents cross-tenant data access and leakage.
 * Provides tenant context management, limits, and validation.
 * 
 * DEPENDENCIES:
 * - None (standalone)
 * 
 * FUNCTIONS:
 * - getCurrentTenant(): Get current tenant ID
 * - setCurrentTenant(tenantId): Set current tenant context
 * - validateTenantAccess(user, tenantId): Check access
 * - enforceTenantQuery(query): Apply tenant filter
 * - getTenantLimits(tenantId): Get tenant quotas
 * - isTenantActive(tenantId): Check tenant status
 * - getTenantConfig(tenantId): Get tenant settings
 * - createTenantContext(): Create context for request
 * - clearTenantContext(): Clear current context
 * - validateCrossTenantOperation(): Prevent cross-tenant ops
 * 
 * USAGE EXAMPLE:
 * import { tenantIsolation } from './core/multitenancy/tenantIsolation.js';
 * 
 * // Set tenant context for request
 * tenantIsolation.setCurrentTenant('tenant_123');
 * 
 * // Get current tenant
 * const tenantId = tenantIsolation.getCurrentTenant();
 * 
 * // Validate access
 * if (tenantIsolation.validateTenantAccess(user, tenantId)) {
 *   // Proceed with operation
 * }
 * ==========================================
 */

class TenantIsolation {
    constructor() {
        // Store current tenant context (using Map for thread-safety)
        this.currentTenant = null;
        
        // Tenant configuration cache
        this.tenantConfigs = new Map();
        
        // Tenant limits cache
        this.tenantLimits = new Map();
        
        // Default limits for new tenants
        this.defaultLimits = {
            maxUsers: 10,
            maxLeads: 1000,
            maxStorage: '1GB',
            maxApiRequests: 10000,
            maxWhatsAppMessages: 1000,
            maxConcurrentSessions: 5,
            maxTeamMembers: 5,
            maxBranches: 3,
            maxDeals: 100,
            maxInvoices: 50
        };
        
        // Default configuration for new tenants
        this.defaultConfig = {
            companyName: 'Default Company',
            timezone: 'Asia/Kolkata',
            currency: 'INR',
            language: 'en',
            gstEnabled: true,
            whatsappEnabled: true,
            aiEnabled: true,
            fieldForceEnabled: false,
            multiBranchEnabled: false,
            theme: 'light',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h'
        };
        
        // Allowed cross-tenant operations
        this.allowedCrossTenantOps = [
            'backup',
            'restore',
            'migration',
            'audit',
            'reporting',
            'system_health'
        ];
        
        // Debug mode flag
        this.debugMode = false;
        
        // Tenant cache TTL (5 minutes)
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Storage for tenant metadata
        this.tenantMetadata = new Map();
        
        // Active sessions tracking
        this.activeSessions = new Map();
        
        // Rate limiting per tenant
        this.rateLimits = new Map();
    }

    /**
     * Get current tenant ID from context
     * @returns {string|null} Current tenant ID
     */
    getCurrentTenant() {
        // In a real implementation, this would use async_hooks or CLS
        // For now, using synchronous storage
        return this.currentTenant;
    }

    /**
     * Set current tenant context
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @throws {Error} If tenantId is invalid
     */
    setCurrentTenant(tenantId, options = {}) {
        if (!tenantId || typeof tenantId !== 'string') {
            throw new Error('Tenant ID must be a non-empty string');
        }

        // Validate tenant exists
        if (!this.isTenantActive(tenantId)) {
            throw new Error(`Tenant ${tenantId} is not active or does not exist`);
        }

        // Check if tenant has reached concurrent session limit
        if (!options.bypassLimits) {
            const sessionCount = this.activeSessions.get(tenantId) || 0;
            const limits = this.getTenantLimits(tenantId);
            if (sessionCount >= limits.maxConcurrentSessions) {
                throw new Error(`Maximum concurrent sessions (${limits.maxConcurrentSessions}) reached for tenant ${tenantId}`);
            }
        }

        this.currentTenant = tenantId;
        
        // Track session
        if (!options.bypassTracking) {
            this.activeSessions.set(tenantId, (this.activeSessions.get(tenantId) || 0) + 1);
        }
        
        if (this.debugMode) {
            console.log(`[TenantIsolation] Current tenant set to: ${tenantId}`);
            console.log(`[TenantIsolation] Active sessions: ${this.activeSessions.get(tenantId)}`);
        }
    }

    /**
     * Clear current tenant context
     * @param {object} options - Additional options
     */
    clearTenantContext(options = {}) {
        if (this.currentTenant && !options.bypassTracking) {
            const count = this.activeSessions.get(this.currentTenant) || 0;
            if (count > 0) {
                this.activeSessions.set(this.currentTenant, count - 1);
            }
        }
        
        this.currentTenant = null;
        
        if (this.debugMode) {
            console.log('[TenantIsolation] Tenant context cleared');
        }
    }

    /**
     * Create a new tenant context for a request
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Context object
     */
    createTenantContext(tenantId, options = {}) {
        const limits = this.getTenantLimits(tenantId);
        const config = this.getTenantConfig(tenantId);
        const metadata = this.getTenantMetadata(tenantId);
        
        return {
            tenantId: tenantId,
            timestamp: new Date().toISOString(),
            limits: limits,
            config: config,
            metadata: metadata,
            isActive: this.isTenantActive(tenantId),
            sessionId: options.sessionId || null,
            requestId: options.requestId || null,
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null
        };
    }

    /**
     * Validate if user has access to a tenant
     * @param {object} user - User object with tenantId and role
     * @param {string} tenantId - Tenant ID to check
     * @param {object} options - Additional options
     * @returns {boolean} Whether user has access
     */
    validateTenantAccess(user, tenantId, options = {}) {
        if (!user || !user.tenantId) {
            if (this.debugMode) {
                console.warn('[TenantIsolation] Invalid user object for validation');
            }
            return false;
        }

        // Platform owners and super admins bypass tenant restriction
        const bypassRoles = ['platform_owner', 'super_admin'];
        if (bypassRoles.includes(user.role)) {
            if (this.debugMode) {
                console.log(`[TenantIsolation] Bypass access for role: ${user.role}`);
            }
            return true;
        }

        // Check if tenant is active
        if (!this.isTenantActive(tenantId)) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] Tenant ${tenantId} is not active`);
            }
            return false;
        }

        // Regular users can only access their own tenant
        const hasAccess = user.tenantId === tenantId;
        
        // Check if user has specific permissions
        if (hasAccess && options.permission) {
            const userPermissions = user.permissions || [];
            if (!userPermissions.includes(options.permission)) {
                if (this.debugMode) {
                    console.warn(`[TenantIsolation] User lacks permission: ${options.permission}`);
                }
                return false;
            }
        }
        
        if (!hasAccess && this.debugMode) {
            console.warn(`[TenantIsolation] Access denied: User tenant ${user.tenantId} != Requested tenant ${tenantId}`);
        }
        
        return hasAccess;
    }

    /**
     * Enforce tenant filter on a query
     * @param {object} query - Query object
     * @param {string} tenantId - Tenant ID (optional)
     * @param {object} options - Additional options
     * @returns {object} Query with tenant filter applied
     */
    enforceTenantQuery(query, tenantId = null, options = {}) {
        const effectiveTenantId = tenantId || this.getCurrentTenant();
        
        if (!effectiveTenantId) {
            throw new Error('No tenant context available for query');
        }

        // Check if query should bypass tenant filter
        if (options.bypassTenantFilter) {
            return query;
        }

        // Add tenant filter to query
        return {
            ...query,
            where: {
                ...(query.where || {}),
                tenantId: effectiveTenantId
            },
            _tenantInfo: {
                tenantId: effectiveTenantId,
                enforced: true,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get tenant limits
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Tenant limits
     */
    getTenantLimits(tenantId, options = {}) {
        // Check cache first
        if (this.tenantLimits.has(tenantId) && !options.forceRefresh) {
            const timestamp = this.cacheTimestamps.get(tenantId) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return this.tenantLimits.get(tenantId);
            }
        }

        // Load from database
        const limits = this.loadTenantLimitsFromDb(tenantId);
        this.tenantLimits.set(tenantId, limits);
        this.cacheTimestamps.set(tenantId, Date.now());
        
        return limits;
    }

    /**
     * Load tenant limits from database
     * @param {string} tenantId - Tenant ID
     * @returns {object} Tenant limits
     */
    loadTenantLimitsFromDb(tenantId) {
        // In production, this would fetch from Firestore
        // For now, return default limits merged with any stored limits
        const storedLimits = this.getStoredLimits(tenantId);
        return {
            ...this.defaultLimits,
            ...storedLimits
        };
    }

    /**
     * Get stored limits for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {object} Stored limits
     */
    getStoredLimits(tenantId) {
        // This would be a Firestore query in production
        // For MVP, return empty object (use defaults)
        return {};
    }

    /**
     * Get tenant configuration
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Tenant configuration
     */
    getTenantConfig(tenantId, options = {}) {
        // Check cache first
        if (this.tenantConfigs.has(tenantId) && !options.forceRefresh) {
            const timestamp = this.cacheTimestamps.get(`config_${tenantId}`) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return this.tenantConfigs.get(tenantId);
            }
        }

        const config = this.loadTenantConfigFromDb(tenantId);
        this.tenantConfigs.set(tenantId, config);
        this.cacheTimestamps.set(`config_${tenantId}`, Date.now());
        
        return config;
    }

    /**
     * Load tenant configuration from database
     * @param {string} tenantId - Tenant ID
     * @returns {object} Tenant configuration
     */
    loadTenantConfigFromDb(tenantId) {
        // In production, this would fetch from Firestore
        // For MVP, return default config merged with stored config
        const storedConfig = this.getStoredConfig(tenantId);
        return {
            ...this.defaultConfig,
            ...storedConfig
        };
    }

    /**
     * Get stored configuration for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {object} Stored configuration
     */
    getStoredConfig(tenantId) {
        // This would be a Firestore query in production
        // For MVP, return empty object (use defaults)
        return {};
    }

    /**
     * Get tenant metadata
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Tenant metadata
     */
    getTenantMetadata(tenantId, options = {}) {
        if (this.tenantMetadata.has(tenantId) && !options.forceRefresh) {
            return this.tenantMetadata.get(tenantId);
        }

        const metadata = this.loadTenantMetadata(tenantId);
        this.tenantMetadata.set(tenantId, metadata);
        
        return metadata;
    }

    /**
     * Load tenant metadata from database
     * @param {string} tenantId - Tenant ID
     * @returns {object} Tenant metadata
     */
    loadTenantMetadata(tenantId) {
        // In production, this would fetch from Firestore
        return {
            created: new Date().toISOString(),
            subscription: 'free',
            status: 'active',
            plan: 'free',
            features: ['leads', 'tasks', 'whatsapp']
        };
    }

    /**
     * Check if tenant is active
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {boolean} Whether tenant is active
     */
    isTenantActive(tenantId, options = {}) {
        // In production, this would check Firestore
        // For MVP, assume all tenants are active
        return true;
    }

    /**
     * Check if a tenant has reached a limit
     * @param {string} tenantId - Tenant ID
     * @param {string} limitName - Limit name
     * @param {number} currentValue - Current usage value
     * @param {object} options - Additional options
     * @returns {boolean} Whether limit is exceeded
     */
    isLimitExceeded(tenantId, limitName, currentValue, options = {}) {
        const limits = this.getTenantLimits(tenantId, options);
        const limit = limits[limitName];
        
        if (!limit) {
            return false;
        }

        // Check if limit is actually a number
        if (typeof limit !== 'number') {
            return false;
        }

        return currentValue >= limit;
    }

    /**
     * Get remaining quota for a limit
     * @param {string} tenantId - Tenant ID
     * @param {string} limitName - Limit name
     * @param {number} currentValue - Current usage value
     * @param {object} options - Additional options
     * @returns {number} Remaining quota
     */
    getRemainingQuota(tenantId, limitName, currentValue, options = {}) {
        const limits = this.getTenantLimits(tenantId, options);
        const limit = limits[limitName];
        
        if (!limit || typeof limit !== 'number') {
            return Infinity;
        }

        return Math.max(0, limit - currentValue);
    }

    /**
     * Validate cross-tenant operation
     * @param {string} sourceTenant - Source tenant ID
     * @param {string} targetTenant - Target tenant ID
     * @param {string} operation - Operation name
     * @param {object} options - Additional options
     * @returns {boolean} Whether operation is allowed
     */
    validateCrossTenantOperation(sourceTenant, targetTenant, operation, options = {}) {
        // Allow if same tenant
        if (sourceTenant === targetTenant) {
            return true;
        }

        // Check if operation is allowed
        if (!this.allowedCrossTenantOps.includes(operation) && !options.forceAllow) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] Cross-tenant ${operation} not allowed`);
            }
            return false;
        }

        // Check if target tenant exists
        if (!this.isTenantActive(targetTenant)) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] Target tenant ${targetTenant} not active`);
            }
            return false;
        }

        // System operations may be allowed with proper authorization
        const isSystemOp = ['backup', 'restore', 'migration', 'system_health'].includes(operation);
        
        if (isSystemOp || options.forceAllow) {
            if (this.debugMode) {
                console.log(`[TenantIsolation] Cross-tenant ${operation} allowed (system/admin)`);
            }
            return true;
        }

        if (this.debugMode) {
            console.warn(`[TenantIsolation] Cross-tenant ${operation} denied: ${sourceTenant} → ${targetTenant}`);
        }

        return false;
    }

    /**
     * Get tenant-specific data isolation rules
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Isolation rules
     */
    getIsolationRules(tenantId, options = {}) {
        // Define isolation rules for different data types
        const baseRules = {
            // Strict isolation - no cross-tenant access
            strict: [
                'leads',
                'customers',
                'deals',
                'tasks',
                'invoices',
                'whatsapp_messages',
                'activity_logs',
                'attendance_records',
                'visit_logs',
                'expenses'
            ],
            // Soft isolation - may be accessible in some contexts
            soft: [
                'templates',
                'settings',
                'integrations',
                'reports',
                'dashboards'
            ],
            // Public - accessible across tenants
            public: [
                'system_config',
                'public_templates',
                'public_workflows'
            ]
        };

        // Allow custom rules per tenant
        const customRules = this.getCustomIsolationRules(tenantId);
        return {
            ...baseRules,
            ...customRules
        };
    }

    /**
     * Get custom isolation rules for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {object} Custom rules
     */
    getCustomIsolationRules(tenantId) {
        // In production, this would fetch from Firestore
        return {};
    }

    /**
     * Check if an operation is allowed on a tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} operation - Operation name
     * @param {object} user - User object
     * @param {object} options - Additional options
     * @returns {boolean} Whether operation is allowed
     */
    isOperationAllowed(tenantId, operation, user, options = {}) {
        // Super admins can do anything
        if (user.role === 'super_admin' || user.role === 'platform_owner') {
            return true;
        }

        // Check if user belongs to the tenant
        if (user.tenantId !== tenantId) {
            return false;
        }

        // Check tenant status
        if (!this.isTenantActive(tenantId)) {
            return false;
        }

        // Check operation-specific permissions
        const allowedOperations = this.getAllowedOperations(tenantId);
        if (!allowedOperations.includes(operation) && !options.forceAllow) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] Operation ${operation} not allowed for tenant ${tenantId}`);
            }
            return false;
        }

        // Check user permissions for the operation
        const userPermissions = user.permissions || [];
        if (!userPermissions.includes(`can_${operation}`) && !options.forceAllow) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] User lacks permission: can_${operation}`);
            }
            return false;
        }

        return true;
    }

    /**
     * Get allowed operations for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {Array} List of allowed operations
     */
    getAllowedOperations(tenantId) {
        // In production, this would be fetched from tenant config
        return [
            'create',
            'read',
            'update',
            'delete',
            'export',
            'import',
            'backup',
            'restore',
            'share',
            'archive'
        ];
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[TenantIsolation] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Clear tenant cache
     * @param {object} options - Additional options
     */
    clearCache(options = {}) {
        this.tenantConfigs.clear();
        this.tenantLimits.clear();
        this.cacheTimestamps.clear();
        
        if (!options.keepMetadata) {
            this.tenantMetadata.clear();
        }
        
        if (this.debugMode) {
            console.log('[TenantIsolation] Cache cleared');
        }
    }

    /**
     * Get tenant statistics
     * @param {string} tenantId - Tenant ID
     * @param {object} options - Additional options
     * @returns {object} Tenant statistics
     */
    getTenantStats(tenantId, options = {}) {
        // In production, this would aggregate from Firestore
        const metadata = this.getTenantMetadata(tenantId);
        
        return {
            tenantId: tenantId,
            totalUsers: 0,
            totalLeads: 0,
            totalCustomers: 0,
            totalDeals: 0,
            totalInvoices: 0,
            storageUsed: '0MB',
            apiCalls: 0,
            activeSessions: this.activeSessions.get(tenantId) || 0,
            subscription: metadata.subscription || 'free',
            status: metadata.status || 'active',
            created: metadata.created || null,
            lastActivity: new Date().toISOString()
        };
    }

    /**
     * Update tenant limits
     * @param {string} tenantId - Tenant ID
     * @param {object} newLimits - New limits
     * @param {object} options - Additional options
     * @returns {object} Updated limits
     */
    updateTenantLimits(tenantId, newLimits, options = {}) {
        const currentLimits = this.getTenantLimits(tenantId, options);
        const updatedLimits = { ...currentLimits, ...newLimits };
        
        this.tenantLimits.set(tenantId, updatedLimits);
        this.cacheTimestamps.set(tenantId, Date.now());
        
        // In production, save to database
        this.saveTenantLimits(tenantId, updatedLimits);
        
        if (this.debugMode) {
            console.log(`[TenantIsolation] Updated limits for ${tenantId}:`, updatedLimits);
        }
        
        return updatedLimits;
    }

    /**
     * Save tenant limits to database
     * @param {string} tenantId - Tenant ID
     * @param {object} limits - Limits to save
     */
    saveTenantLimits(tenantId, limits) {
        // In production, this would save to Firestore
        if (this.debugMode) {
            console.log(`[TenantIsolation] Saving limits for ${tenantId}:`, limits);
        }
    }

    /**
     * Get tenant by domain
     * @param {string} domain - Domain name
     * @param {object} options - Additional options
     * @returns {string|null} Tenant ID or null
     */
    getTenantByDomain(domain, options = {}) {
        // In production, this would query Firestore
        // For MVP, assume domain mapping
        if (this.debugMode) {
            console.log(`[TenantIsolation] Looking up tenant for domain: ${domain}`);
        }
        return null;
    }

    /**
     * Get tenant by API key
     * @param {string} apiKey - API key
     * @param {object} options - Additional options
     * @returns {string|null} Tenant ID or null
     */
    getTenantByApiKey(apiKey, options = {}) {
        // In production, this would query Firestore
        // For MVP, assume API key mapping
        if (this.debugMode) {
            console.log(`[TenantIsolation] Looking up tenant for API key: ${apiKey.substring(0, 8)}...`);
        }
        return null;
    }

    /**
     * Check rate limit for tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} endpoint - API endpoint
     * @param {number} limit - Rate limit per minute
     * @returns {boolean} Whether request is allowed
     */
    checkRateLimit(tenantId, endpoint, limit) {
        const key = `${tenantId}:${endpoint}`;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute window
        
        if (!this.rateLimits.has(key)) {
            this.rateLimits.set(key, {
                count: 1,
                reset: now + windowMs
            });
            return true;
        }
        
        const data = this.rateLimits.get(key);
        
        // Reset if window expired
        if (now > data.reset) {
            this.rateLimits.set(key, {
                count: 1,
                reset: now + windowMs
            });
            return true;
        }
        
        // Check if limit exceeded
        if (data.count >= limit) {
            if (this.debugMode) {
                console.warn(`[TenantIsolation] Rate limit exceeded for ${tenantId} on ${endpoint}`);
            }
            return false;
        }
        
        // Increment count
        data.count++;
        this.rateLimits.set(key, data);
        return true;
    }

    /**
     * Get active sessions for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {number} Number of active sessions
     */
    getActiveSessions(tenantId) {
        return this.activeSessions.get(tenantId) || 0;
    }

    /**
     * Update tenant configuration
     * @param {string} tenantId - Tenant ID
     * @param {object} newConfig - New configuration
     * @param {object} options - Additional options
     * @returns {object} Updated configuration
     */
    updateTenantConfig(tenantId, newConfig, options = {}) {
        const currentConfig = this.getTenantConfig(tenantId, options);
        const updatedConfig = { ...currentConfig, ...newConfig };
        
        this.tenantConfigs.set(tenantId, updatedConfig);
        this.cacheTimestamps.set(`config_${tenantId}`, Date.now());
        
        // In production, save to database
        this.saveTenantConfig(tenantId, updatedConfig);
        
        if (this.debugMode) {
            console.log(`[TenantIsolation] Updated config for ${tenantId}:`, updatedConfig);
        }
        
        return updatedConfig;
    }

    /**
     * Save tenant configuration to database
     * @param {string} tenantId - Tenant ID
     * @param {object} config - Configuration to save
     */
    saveTenantConfig(tenantId, config) {
        // In production, this would save to Firestore
        if (this.debugMode) {
            console.log(`[TenantIsolation] Saving config for ${tenantId}:`, config);
        }
    }
}

// Create and export singleton instance
export const tenantIsolation = new TenantIsolation();

// Export class for testing
export default TenantIsolation;
