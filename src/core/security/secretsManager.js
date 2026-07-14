/**
 * ==========================================
 * FILE: secretsManager.js
 * MODULE: Core/Security
 * CODE: SEC-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Secure secrets management for the CRM.
 * Handles encryption, storage, and retrieval of sensitive data.
 * Integrates with encryptionService for cryptographic operations.
 * 
 * DEPENDENCIES:
 * - encryptionService.js (for cryptographic operations)
 * 
 * FUNCTIONS:
 * - setSecret(key, value, options): Store a secret
 * - getSecret(key, options): Retrieve a secret
 * - deleteSecret(key, options): Delete a secret
 * - listSecrets(options): List all secrets
 * - rotateSecret(key, options): Rotate a secret
 * - getSecretMetadata(key): Get secret metadata
 * - setSecretVersion(key, value, version): Set specific version
 * - getSecretVersion(key, version): Get specific version
 * - listSecretVersions(key): List all versions
 * - deleteSecretVersion(key, version): Delete specific version
 * - getSecretStats(): Get secrets statistics
 * - validateSecret(key): Validate secret integrity
 * - exportSecrets(options): Export secrets (encrypted)
 * - importSecrets(file, options): Import secrets (encrypted)
 * 
 * USAGE EXAMPLE:
 * import { secretsManager } from './core/security/secretsManager.js';
 * 
 * // Set a secret
 * await secretsManager.setSecret('API_KEY', 'sk_123456789', {
 *   description: 'Groq API Key',
 *   expiresIn: '30d'
 * });
 * 
 * // Get a secret
 * const apiKey = await secretsManager.getSecret('API_KEY');
 * 
 * // Rotate a secret
 * await secretsManager.rotateSecret('API_KEY');
 * ==========================================
 */

import { encryptionService } from './encryptionService.js';
import { auditLogger } from '../audit/auditLogger.js';
import { logger } from '../monitoring/logger.js';

// In-memory storage (for MVP)
// In production, this would be a secure database
let secrets = [];
let idCounter = 1000;
let versionCounter = {};

class SecretsManager {
    constructor() {
        // Secret storage
        this.secrets = new Map();
        this.secretVersions = new Map();
        this.secretMetadata = new Map();
        
        // Cache for frequently accessed secrets
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Configuration
        this.config = {
            maxSecrets: 1000,
            maxVersions: 10,
            defaultTTL: 86400, // 24 hours in seconds
            rotationPeriod: '30d',
            requireAudit: true,
            enableCache: true,
            allowExport: true,
            allowImport: true
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
        const sampleSecrets = [
            {
                id: 'sec_1001',
                key: 'GROQ_API_KEY',
                value: 'gsk_encrypted_abc123',
                description: 'Groq API Key for AI services',
                version: 1,
                status: 'active',
                createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'system',
                metadata: {
                    service: 'groq',
                    environment: 'production'
                }
            },
            {
                id: 'sec_1002',
                key: 'WHATSAPP_TOKEN',
                value: 'wa_encrypted_xyz789',
                description: 'WhatsApp Business API Token',
                version: 2,
                status: 'active',
                createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'user_123',
                metadata: {
                    service: 'whatsapp',
                    environment: 'production'
                }
            },
            {
                id: 'sec_1003',
                key: 'RAZORPAY_SECRET',
                value: 'rzp_encrypted_456def',
                description: 'Razorpay API Secret',
                version: 1,
                status: 'active',
                createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'user_456',
                metadata: {
                    service: 'razorpay',
                    environment: 'production'
                }
            }
        ];

        for (const secret of sampleSecrets) {
            this.secrets.set(secret.key, secret);
            this.secretMetadata.set(secret.key, {
                versions: [secret.version],
                createdAt: secret.createdAt,
                updatedAt: secret.updatedAt,
                createdBy: secret.createdBy
            });
        }
    }

    /**
     * Set a secret
     * @param {string} key - Secret key
     * @param {string} value - Secret value
     * @param {object} options - Additional options
     * @returns {object} Created secret
     */
    async setSecret(key, value, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!value || typeof value !== 'string') {
            throw new Error('Secret value is required');
        }

        // Check if secret already exists
        if (this.secrets.has(key) && !options.forceUpdate) {
            throw new Error(`Secret ${key} already exists. Use forceUpdate or rotateSecret`);
        }

        // Encrypt the secret value
        const encryptedValue = await encryptionService.encrypt(value);

        // Get next version
        const version = this.getNextVersion(key);

        // Create secret object
        const secret = {
            id: this.generateId(),
            key: key,
            value: encryptedValue,
            description: options.description || '',
            version: version,
            status: options.status || 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: options.expiresAt || this.calculateExpiry(options.expiresIn),
            createdBy: options.createdBy || 'system',
            metadata: options.metadata || {},
            tags: options.tags || []
        };

        // Store secret
        this.secrets.set(key, secret);
        
        // Update metadata
        if (!this.secretMetadata.has(key)) {
            this.secretMetadata.set(key, {
                versions: [],
                createdAt: secret.createdAt,
                updatedAt: secret.updatedAt,
                createdBy: secret.createdBy
            });
        }
        const metadata = this.secretMetadata.get(key);
        metadata.versions.push(version);
        metadata.updatedAt = secret.updatedAt;
        this.secretMetadata.set(key, metadata);

        // Store version
        if (!this.secretVersions.has(key)) {
            this.secretVersions.set(key, new Map());
        }
        this.secretVersions.get(key).set(version, secret);

        // Invalidate cache
        this.invalidateCache(key);

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.createdBy || 'system',
                'secret.created',
                'secret',
                { key: key, version: version, description: options.description }
            );
        }

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret set: ${key} (v${version})`);
        }

        return { ...secret };
    }

    /**
     * Get a secret
     * @param {string} key - Secret key
     * @param {object} options - Additional options
     * @returns {string} Decrypted secret value
     */
    async getSecret(key, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        // Check cache first
        if (this.config.enableCache && this.cache.has(key)) {
            const cached = this.cache.get(key);
            const timestamp = this.cacheTimestamps.get(key) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
        }

        // Get secret
        const secret = this.secrets.get(key);
        if (!secret) {
            throw new Error(`Secret ${key} not found`);
        }

        // Check if expired
        if (secret.expiresAt && new Date(secret.expiresAt) < new Date()) {
            throw new Error(`Secret ${key} has expired`);
        }

        // Check status
        if (secret.status !== 'active') {
            throw new Error(`Secret ${key} is not active (status: ${secret.status})`);
        }

        // Decrypt the value
        const decryptedValue = await encryptionService.decrypt(secret.value);

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(key, decryptedValue);
            this.cacheTimestamps.set(key, Date.now());
        }

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.userId || 'system',
                'secret.accessed',
                'secret',
                { key: key, version: secret.version }
            );
        }

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret accessed: ${key} (v${secret.version})`);
        }

        return decryptedValue;
    }

    /**
     * Delete a secret
     * @param {string} key - Secret key
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteSecret(key, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secrets.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        // Delete secret
        this.secrets.delete(key);
        this.secretVersions.delete(key);
        this.secretMetadata.delete(key);
        this.invalidateCache(key);

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.userId || 'system',
                'secret.deleted',
                'secret',
                { key: key }
            );
        }

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret deleted: ${key}`);
        }

        return true;
    }

    /**
     * List all secrets
     * @param {object} options - List options
     * @returns {Array} List of secrets (without values)
     */
    async listSecrets(options = {}) {
        const results = [];
        for (const [key, secret] of this.secrets) {
            if (options.filter) {
                const match = this.matchesFilter(secret, options.filter);
                if (!match) continue;
            }

            results.push({
                key: secret.key,
                description: secret.description,
                version: secret.version,
                status: secret.status,
                createdAt: secret.createdAt,
                updatedAt: secret.updatedAt,
                expiresAt: secret.expiresAt,
                createdBy: secret.createdBy,
                tags: secret.tags || [],
                metadata: secret.metadata || {}
            });
        }

        // Apply sorting
        if (options.sortBy) {
            results.sort((a, b) => {
                const valA = a[options.sortBy] || '';
                const valB = b[options.sortBy] || '';
                return valA < valB ? -1 : 1;
            });
        }

        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        return results.slice(offset, offset + limit);
    }

    /**
     * Rotate a secret
     * @param {string} key - Secret key
     * @param {object} options - Rotation options
     * @returns {object} New secret version
     */
    async rotateSecret(key, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secrets.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        // Get current secret
        const currentSecret = this.secrets.get(key);

        // Generate new value if not provided
        const newValue = options.newValue || await this.generateNewSecret(currentSecret);

        // Create new version
        const newSecret = await this.setSecret(key, newValue, {
            ...options,
            forceUpdate: true,
            version: currentSecret.version + 1,
            description: currentSecret.description,
            createdBy: options.createdBy || 'system',
            metadata: currentSecret.metadata,
            tags: currentSecret.tags
        });

        // Mark old secret as rotated
        currentSecret.status = 'rotated';
        currentSecret.rotatedAt = new Date().toISOString();
        currentSecret.rotatedToVersion = newSecret.version;
        this.secrets.set(key, currentSecret);

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.createdBy || 'system',
                'secret.rotated',
                'secret',
                { key: key, oldVersion: currentSecret.version, newVersion: newSecret.version }
            );
        }

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret rotated: ${key} (${currentSecret.version} → ${newSecret.version})`);
        }

        return newSecret;
    }

    /**
     * Get secret metadata
     * @param {string} key - Secret key
     * @returns {object} Secret metadata
     */
    async getSecretMetadata(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secrets.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        const secret = this.secrets.get(key);
        const metadata = this.secretMetadata.get(key);

        return {
            key: key,
            currentVersion: secret.version,
            versions: metadata.versions || [],
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            createdBy: secret.createdBy,
            status: secret.status,
            description: secret.description,
            expiresAt: secret.expiresAt,
            tags: secret.tags || []
        };
    }

    /**
     * Set specific version of a secret
     * @param {string} key - Secret key
     * @param {string} value - Secret value
     * @param {number} version - Version number
     * @param {object} options - Additional options
     * @returns {object} Created secret version
     */
    async setSecretVersion(key, value, version, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secrets.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        // Encrypt the secret value
        const encryptedValue = await encryptionService.encrypt(value);

        const secret = {
            id: this.generateId(),
            key: key,
            value: encryptedValue,
            description: options.description || '',
            version: version,
            status: options.status || 'archived',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: options.expiresAt || null,
            createdBy: options.createdBy || 'system',
            metadata: options.metadata || {},
            tags: options.tags || []
        };

        // Store version
        if (!this.secretVersions.has(key)) {
            this.secretVersions.set(key, new Map());
        }
        this.secretVersions.get(key).set(version, secret);

        // Update metadata
        const metadata = this.secretMetadata.get(key);
        if (!metadata.versions.includes(version)) {
            metadata.versions.push(version);
        }
        this.secretMetadata.set(key, metadata);

        this.invalidateCache(key);

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret version set: ${key} (v${version})`);
        }

        return { ...secret };
    }

    /**
     * Get specific version of a secret
     * @param {string} key - Secret key
     * @param {number} version - Version number
     * @param {object} options - Additional options
     * @returns {string} Decrypted secret value
     */
    async getSecretVersion(key, version, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secretVersions.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        const versions = this.secretVersions.get(key);
        const secret = versions.get(version);
        if (!secret) {
            throw new Error(`Version ${version} not found for secret ${key}`);
        }

        // Decrypt the value
        const decryptedValue = await encryptionService.decrypt(secret.value);

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.userId || 'system',
                'secret.version.accessed',
                'secret',
                { key: key, version: version }
            );
        }

        return decryptedValue;
    }

    /**
     * List all versions of a secret
     * @param {string} key - Secret key
     * @param {object} options - Additional options
     * @returns {Array} List of versions
     */
    async listSecretVersions(key, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secretVersions.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        const versions = this.secretVersions.get(key);
        const results = [];
        for (const [version, secret] of versions) {
            results.push({
                version: version,
                status: secret.status,
                createdAt: secret.createdAt,
                updatedAt: secret.updatedAt,
                expiresAt: secret.expiresAt,
                createdBy: secret.createdBy,
                description: secret.description
            });
        }

        results.sort((a, b) => b.version - a.version);
        return results;
    }

    /**
     * Delete specific version of a secret
     * @param {string} key - Secret key
     * @param {number} version - Version number
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteSecretVersion(key, version, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secretVersions.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        const versions = this.secretVersions.get(key);
        if (!versions.has(version)) {
            throw new Error(`Version ${version} not found for secret ${key}`);
        }

        // Don't delete active version
        const currentSecret = this.secrets.get(key);
        if (currentSecret.version === version) {
            throw new Error(`Cannot delete active version ${version} of secret ${key}`);
        }

        versions.delete(version);

        // Update metadata
        const metadata = this.secretMetadata.get(key);
        const index = metadata.versions.indexOf(version);
        if (index !== -1) {
            metadata.versions.splice(index, 1);
        }
        this.secretMetadata.set(key, metadata);

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Secret version deleted: ${key} (v${version})`);
        }

        return true;
    }

    /**
     * Get secrets statistics
     * @param {object} options - Additional options
     * @returns {object} Secrets statistics
     */
    async getSecretStats(options = {}) {
        const stats = {
            total: this.secrets.size,
            byStatus: {},
            byVersion: {},
            active: 0,
            rotated: 0,
            expired: 0,
            totalVersions: 0
        };

        for (const [key, secret] of this.secrets) {
            stats.byStatus[secret.status] = (stats.byStatus[secret.status] || 0) + 1;
            
            if (secret.status === 'active') stats.active++;
            if (secret.status === 'rotated') stats.rotated++;
            if (secret.expiresAt && new Date(secret.expiresAt) < new Date()) stats.expired++;
        }

        for (const [key, versions] of this.secretVersions) {
            stats.totalVersions += versions.size;
        }

        return stats;
    }

    /**
     * Validate secret integrity
     * @param {string} key - Secret key
     * @param {object} options - Additional options
     * @returns {object} Validation result
     */
    async validateSecret(key, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error('Secret key is required');
        }

        if (!this.secrets.has(key)) {
            throw new Error(`Secret ${key} not found`);
        }

        const secret = this.secrets.get(key);
        const isValid = secret.status === 'active' && 
                       (!secret.expiresAt || new Date(secret.expiresAt) > new Date());

        return {
            valid: isValid,
            key: key,
            version: secret.version,
            status: secret.status,
            expiresAt: secret.expiresAt,
            reason: isValid ? 'Valid' : 'Invalid or expired'
        };
    }

    /**
     * Export secrets (encrypted)
     * @param {object} options - Export options
     * @returns {string} Encrypted export data
     */
    async exportSecrets(options = {}) {
        if (!this.config.allowExport) {
            throw new Error('Export is disabled');
        }

        const keys = options.keys || Array.from(this.secrets.keys());
        const exportData = {};

        for (const key of keys) {
            if (this.secrets.has(key)) {
                const secret = this.secrets.get(key);
                // Don't export the actual encrypted value, just metadata
                exportData[key] = {
                    description: secret.description,
                    version: secret.version,
                    status: secret.status,
                    createdAt: secret.createdAt,
                    expiresAt: secret.expiresAt,
                    metadata: secret.metadata,
                    tags: secret.tags
                };
            }
        }

        // Encrypt the export data
        const jsonData = JSON.stringify(exportData);
        const encrypted = await encryptionService.encrypt(jsonData);

        // Log to audit
        if (this.config.requireAudit) {
            await auditLogger.log(
                options.userId || 'system',
                'secret.exported',
                'secret',
                { count: Object.keys(exportData).length }
            );
        }

        return encrypted;
    }

    /**
     * Import secrets (encrypted)
     * @param {string} encryptedData - Encrypted import data
     * @param {object} options - Import options
     * @returns {object} Import result
     */
    async importSecrets(encryptedData, options = {}) {
        if (!this.config.allowImport) {
            throw new Error('Import is disabled');
        }

        try {
            // Decrypt the data
            const decrypted = await encryptionService.decrypt(encryptedData);
            const importData = JSON.parse(decrypted);

            const results = {
                imported: 0,
                failed: 0,
                errors: []
            };

            for (const [key, data] of Object.entries(importData)) {
                try {
                    if (this.secrets.has(key) && !options.overwrite) {
                        results.failed++;
                        results.errors.push(`Secret ${key} already exists (use overwrite)`);
                        continue;
                    }

                    // Generate a new value if not provided
                    const value = data.value || this.generateRandomSecret();

                    await this.setSecret(key, value, {
                        description: data.description || '',
                        status: data.status || 'active',
                        expiresAt: data.expiresAt || null,
                        createdBy: options.userId || 'system',
                        metadata: data.metadata || {},
                        tags: data.tags || [],
                        forceUpdate: options.overwrite
                    });

                    results.imported++;
                } catch (error) {
                    results.failed++;
                    results.errors.push(`Failed to import ${key}: ${error.message}`);
                }
            }

            // Log to audit
            if (this.config.requireAudit) {
                await auditLogger.log(
                    options.userId || 'system',
                    'secret.imported',
                    'secret',
                    { imported: results.imported, failed: results.failed }
                );
            }

            return results;
        } catch (error) {
            throw new Error(`Import failed: ${error.message}`);
        }
    }

    /**
     * Get next version number
     * @param {string} key - Secret key
     * @returns {number} Next version number
     */
    getNextVersion(key) {
        if (!this.secretMetadata.has(key)) {
            return 1;
        }
        const metadata = this.secretMetadata.get(key);
        return metadata.versions.length + 1;
    }

    /**
     * Calculate expiry date
     * @param {string|number} expiresIn - Expiry duration (e.g., '30d', '1h', or seconds)
     * @returns {string} Expiry date ISO string
     */
    calculateExpiry(expiresIn) {
        if (!expiresIn) {
            const defaultSeconds = this.config.defaultTTL;
            return new Date(Date.now() + defaultSeconds * 1000).toISOString();
        }

        if (typeof expiresIn === 'number') {
            return new Date(Date.now() + expiresIn * 1000).toISOString();
        }

        // Parse string like '30d', '1h', '60m'
        const match = expiresIn.match(/^(\d+)([dhms])$/);
        if (!match) {
            return new Date(Date.now() + this.config.defaultTTL * 1000).toISOString();
        }

        const value = parseInt(match[1]);
        const unit = match[2];
        let seconds;

        switch (unit) {
            case 'd': seconds = value * 24 * 60 * 60; break;
            case 'h': seconds = value * 60 * 60; break;
            case 'm': seconds = value * 60; break;
            case 's': seconds = value; break;
            default: seconds = this.config.defaultTTL;
        }

        return new Date(Date.now() + seconds * 1000).toISOString();
    }

    /**
     * Generate new secret value
     * @param {object} currentSecret - Current secret
     * @returns {string} New secret value
     */
    async generateNewSecret(currentSecret) {
        // If it's an API key type, generate a new one
        const keyType = currentSecret.key.toLowerCase();
        if (keyType.includes('api') || keyType.includes('token') || keyType.includes('key')) {
            return this.generateApiKey();
        }

        // Otherwise, generate random secret
        return this.generateRandomSecret();
    }

    /**
     * Generate API key
     * @param {number} length - Length of the key
     * @returns {string} Generated API key
     */
    generateApiKey(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'sk_' + result;
    }

    /**
     * Generate random secret
     * @param {number} length - Length of the secret
     * @returns {string} Generated secret
     */
    generateRandomSecret(length = 24) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Check if secret matches filter
     * @param {object} secret - Secret object
     * @param {object} filter - Filter criteria
     * @returns {boolean} Whether matches
     */
    matchesFilter(secret, filter) {
        for (const [key, value] of Object.entries(filter)) {
            if (key === 'tags' && Array.isArray(value)) {
                const secretTags = secret.tags || [];
                if (!value.some(tag => secretTags.includes(tag))) {
                    return false;
                }
            } else if (key === 'status') {
                if (secret.status !== value) {
                    return false;
                }
            } else if (key === 'metadata') {
                const secretMetadata = secret.metadata || {};
                for (const [mKey, mValue] of Object.entries(value)) {
                    if (secretMetadata[mKey] !== mValue) {
                        return false;
                    }
                }
            } else if (secret[key] !== value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Invalidate cache for a secret
     * @param {string} key - Secret key
     */
    invalidateCache(key) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'sec_' + idCounter;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[SecretsManager] Debug mode enabled');
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
     * Clean up expired secrets
     * @param {object} options - Additional options
     * @returns {number} Number of secrets cleaned up
     */
    async cleanupExpiredSecrets(options = {}) {
        let cleaned = 0;
        const now = new Date();

        for (const [key, secret] of this.secrets) {
            if (secret.expiresAt && new Date(secret.expiresAt) < now) {
                if (options.deleteExpired) {
                    await this.deleteSecret(key, { userId: options.userId || 'system' });
                } else {
                    secret.status = 'expired';
                    this.secrets.set(key, secret);
                }
                cleaned++;
            }
        }

        if (this.debugMode) {
            logger.debug(`[SecretsManager] Cleaned up ${cleaned} expired secrets`);
        }

        return cleaned;
    }
}

// Create and export singleton instance
export const secretsManager = new SecretsManager();

// Export class for testing
export default SecretsManager;
