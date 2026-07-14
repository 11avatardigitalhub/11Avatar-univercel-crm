/**
 * ==========================================
 * FILE: leadRepository.js
 * MODULE: Data/Repositories
 * CODE: DAT-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Data access layer for Lead entities.
 * Handles CRUD operations, queries, and data persistence.
 * Implements tenant isolation and caching.
 * 
 * DEPENDENCIES:
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * - changeTracker.js (for tracking changes)
 * 
 * FUNCTIONS:
 * - create(leadData): Create a new lead
 * - findById(id): Find lead by ID
 * - findAll(filters): Find all leads with filters
 * - update(id, leadData): Update a lead
 * - delete(id): Delete a lead
 * - findByPhone(phone): Find lead by phone
 * - findByEmail(email): Find lead by email
 * - getLeadsByStatus(status): Get leads by status
 * - getLeadsBySource(source): Get leads by source
 * - getLeadsByAssignedTo(userId): Get leads assigned to user
 * - getLeadsByDateRange(startDate, endDate): Get leads by date
 * - getLeadStats(): Get lead statistics
 * - bulkCreate(leads): Bulk create leads
 * - bulkUpdate(leads): Bulk update leads
 * - archive(id): Archive a lead
 * - restore(id): Restore a lead
 * 
 * USAGE EXAMPLE:
 * import { leadRepository } from './data/repositories/leadRepository.js';
 * 
 * // Create a new lead
 * const lead = await leadRepository.create({
 *   name: 'John Doe',
 *   phone: '+91 9876543210',
 *   email: 'john@example.com',
 *   source: 'website'
 * });
 * 
 * // Find leads with filters
 * const leads = await leadRepository.findAll({
 *   status: 'new',
 *   source: 'website'
 * });
 * ==========================================
 */

import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { changeTracker } from '../../core/audit/changeTracker.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let leads = [];
let idCounter = 1000;

class LeadRepository {
    constructor() {
        // In-memory cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Indexes for faster lookups
        this.indexes = {
            byPhone: new Map(),
            byEmail: new Map(),
            byStatus: new Map(),
            bySource: new Map(),
            byAssignedTo: new Map(),
            byTenant: new Map()
        };
        
        // Configuration
        this.config = {
            enableCache: true,
            enableIndexes: true,
            defaultLimit: 100,
            maxLimit: 1000
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
        const sampleLeads = [
            {
                id: 'lead_1001',
                tenantId: 'tenant_1',
                name: 'Rahul Sharma',
                phone: '+91 9876543210',
                email: 'rahul@example.com',
                company: 'Tech Solutions',
                industry: 'IT',
                source: 'website',
                status: 'new',
                score: 75,
                assignedTo: 'user_123',
                value: 50000,
                probability: 60,
                expectedClose: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                tags: ['hot', 'followup'],
                notes: 'Interested in our enterprise plan',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false
            },
            {
                id: 'lead_1002',
                tenantId: 'tenant_1',
                name: 'Priya Patel',
                phone: '+91 8765432109',
                email: 'priya@example.com',
                company: 'HealthCare Plus',
                industry: 'Healthcare',
                source: 'facebook',
                status: 'contacted',
                score: 85,
                assignedTo: 'user_456',
                value: 75000,
                probability: 80,
                expectedClose: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                tags: ['urgent', 'meeting'],
                notes: 'Follow up after demo',
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false
            },
            {
                id: 'lead_1003',
                tenantId: 'tenant_1',
                name: 'Amit Kumar',
                phone: '+91 7654321098',
                email: 'amit@example.com',
                company: 'EduWorld',
                industry: 'Education',
                source: 'google',
                status: 'qualified',
                score: 90,
                assignedTo: 'user_789',
                value: 100000,
                probability: 90,
                expectedClose: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                tags: ['high_value', 'decision_maker'],
                notes: 'Budget approved, awaiting proposal',
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false
            }
        ];

        for (const lead of sampleLeads) {
            leads.push(lead);
            this.updateIndexes(lead);
        }
    }

    /**
     * Create a new lead
     * @param {object} leadData - Lead data
     * @param {object} options - Additional options
     * @returns {object} Created lead
     */
    async create(leadData, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate lead data
        this.validateLead(leadData);

        // Create lead object
        const lead = {
            id: this.generateId(),
            tenantId: tenantId,
            ...leadData,
            score: leadData.score || 0,
            probability: leadData.probability || 0,
            tags: leadData.tags || [],
            notes: leadData.notes || '',
            isActive: true,
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        leads.push(lead);
        this.updateIndexes(lead);
        this.invalidateCache(lead.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'lead.created',
            'lead',
            { leadId: lead.id, name: lead.name }
        );

        if (this.debugMode) {
            console.log('[LeadRepository] Created lead:', lead.id);
        }

        return { ...lead };
    }

    /**
     * Find lead by ID
     * @param {string} id - Lead ID
     * @param {object} options - Additional options
     * @returns {object|null} Lead or null
     */
    async findById(id, options = {}) {
        // Check cache first
        if (this.config.enableCache && this.cache.has(id)) {
            const cached = this.cache.get(id);
            const timestamp = this.cacheTimestamps.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(id);
            this.cacheTimestamps.delete(id);
        }

        const lead = leads.find(l => l.id === id && l.isActive && !l.isArchived);
        
        if (!lead) {
            return null;
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (lead.tenantId !== tenantId) {
            return null;
        }

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(id, lead);
            this.cacheTimestamps.set(id, Date.now());
        }

        return { ...lead };
    }

    /**
     * Find all leads with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async findAll(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = leads.filter(lead => 
            lead.tenantId === tenantId && 
            lead.isActive && 
            !lead.isArchived
        );

        // Apply filters
        if (filters.status) {
            results = results.filter(lead => lead.status === filters.status);
        }

        if (filters.source) {
            results = results.filter(lead => lead.source === filters.source);
        }

        if (filters.assignedTo) {
            results = results.filter(lead => lead.assignedTo === filters.assignedTo);
        }

        if (filters.minScore) {
            results = results.filter(lead => lead.score >= filters.minScore);
        }

        if (filters.maxScore) {
            results = results.filter(lead => lead.score <= filters.maxScore);
        }

        if (filters.startDate) {
            results = results.filter(lead => new Date(lead.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(lead => new Date(lead.createdAt) <= new Date(filters.endDate));
        }

        if (filters.tags) {
            const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
            results = results.filter(lead => 
                tags.some(tag => lead.tags.includes(tag))
            );
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(lead =>
                lead.name.toLowerCase().includes(searchTerm) ||
                (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
                (lead.phone && lead.phone.includes(searchTerm)) ||
                (lead.company && lead.company.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'expectedClose') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }
            
            if (sortOrder === 'asc') {
                return valA < valB ? -1 : 1;
            } else {
                return valA > valB ? -1 : 1;
            }
        });

        // Apply pagination
        const limit = Math.min(options.limit || this.config.defaultLimit, this.config.maxLimit);
        const offset = options.offset || 0;
        
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(lead => ({ ...lead }));
    }

    /**
     * Update a lead
     * @param {string} id - Lead ID
     * @param {object} leadData - Updated lead data
     * @param {object} options - Additional options
     * @returns {object} Updated lead
     */
    async update(id, leadData, options = {}) {
        const index = leads.findIndex(l => l.id === id && l.isActive && !l.isArchived);
        
        if (index === -1) {
            throw new Error(`Lead ${id} not found`);
        }

        const oldLead = { ...leads[index] };
        const lead = leads[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (lead.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Track changes
        const changedFields = {};
        for (const [key, value] of Object.entries(leadData)) {
            if (value !== undefined && lead[key] !== value) {
                changedFields[key] = { old: lead[key], new: value };
                lead[key] = value;
            }
        }

        lead.updatedAt = new Date().toISOString();

        // Update indexes
        this.updateIndexes(lead);
        this.invalidateCache(id);

        // Track change
        await changeTracker.trackChange(
            'lead',
            id,
            oldLead,
            lead,
            options.userId || 'system'
        );

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'lead.updated',
            'lead',
            { leadId: id, changes: changedFields }
        );

        if (this.debugMode) {
            console.log('[LeadRepository] Updated lead:', id);
        }

        return { ...lead };
    }

    /**
     * Delete a lead (soft delete)
     * @param {string} id - Lead ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async delete(id, options = {}) {
        const index = leads.findIndex(l => l.id === id && l.isActive && !l.isArchived);
        
        if (index === -1) {
            throw new Error(`Lead ${id} not found`);
        }

        const lead = leads[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (lead.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Soft delete
        lead.isActive = false;
        lead.isArchived = true;
        lead.updatedAt = new Date().toISOString();
        lead.deletedAt = new Date().toISOString();
        lead.deletedBy = options.userId || 'system';

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'lead.deleted',
            'lead',
            { leadId: id, name: lead.name }
        );

        if (this.debugMode) {
            console.log('[LeadRepository] Deleted lead:', id);
        }

        return true;
    }

    /**
     * Find lead by phone
     * @param {string} phone - Phone number
     * @param {object} options - Additional options
     * @returns {object|null} Lead or null
     */
    async findByPhone(phone, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const normalizedPhone = this.normalizePhone(phone);
        
        // Check index first
        if (this.indexes.byPhone.has(normalizedPhone)) {
            const leadId = this.indexes.byPhone.get(normalizedPhone);
            return await this.findById(leadId);
        }

        // Fallback to search
        const lead = leads.find(l => 
            l.tenantId === tenantId && 
            l.isActive && 
            !l.isArchived &&
            this.normalizePhone(l.phone) === normalizedPhone
        );

        return lead ? { ...lead } : null;
    }

    /**
     * Find lead by email
     * @param {string} email - Email address
     * @param {object} options - Additional options
     * @returns {object|null} Lead or null
     */
    async findByEmail(email, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const normalizedEmail = email.toLowerCase().trim();
        
        // Check index first
        if (this.indexes.byEmail.has(normalizedEmail)) {
            const leadId = this.indexes.byEmail.get(normalizedEmail);
            return await this.findById(leadId);
        }

        // Fallback to search
        const lead = leads.find(l => 
            l.tenantId === tenantId && 
            l.isActive && 
            !l.isArchived &&
            l.email && 
            l.email.toLowerCase().trim() === normalizedEmail
        );

        return lead ? { ...lead } : null;
    }

    /**
     * Get leads by status
     * @param {string} status - Lead status
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsByStatus(status, options = {}) {
        return await this.findAll({ status }, options);
    }

    /**
     * Get leads by source
     * @param {string} source - Lead source
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsBySource(source, options = {}) {
        return await this.findAll({ source }, options);
    }

    /**
     * Get leads assigned to a user
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsByAssignedTo(userId, options = {}) {
        return await this.findAll({ assignedTo: userId }, options);
    }

    /**
     * Get leads by date range
     * @param {string} startDate - Start date (ISO string)
     * @param {string} endDate - End date (ISO string)
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsByDateRange(startDate, endDate, options = {}) {
        return await this.findAll({ startDate, endDate }, options);
    }

    /**
     * Get lead statistics
     * @param {object} options - Additional options
     * @returns {object} Lead statistics
     */
    async getLeadStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantLeads = leads.filter(l => 
            l.tenantId === tenantId && 
            l.isActive && 
            !l.isArchived
        );

        const stats = {
            total: tenantLeads.length,
            byStatus: {},
            bySource: {},
            byAssignedTo: {},
            averageScore: 0,
            totalValue: 0,
            averageValue: 0,
            conversionRate: 0
        };

        let totalScore = 0;
        let totalValue = 0;
        let converted = 0;

        for (const lead of tenantLeads) {
            stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;
            stats.bySource[lead.source] = (stats.bySource[lead.source] || 0) + 1;
            
            if (lead.assignedTo) {
                stats.byAssignedTo[lead.assignedTo] = (stats.byAssignedTo[lead.assignedTo] || 0) + 1;
            }

            totalScore += lead.score || 0;
            totalValue += lead.value || 0;

            if (lead.status === 'converted' || lead.status === 'won') {
                converted++;
            }
        }

        if (tenantLeads.length > 0) {
            stats.averageScore = Math.round(totalScore / tenantLeads.length);
            stats.averageValue = Math.round(totalValue / tenantLeads.length);
            stats.totalValue = totalValue;
            stats.conversionRate = Math.round((converted / tenantLeads.length) * 100);
        }

        return stats;
    }

    /**
     * Bulk create leads
     * @param {Array} leadsData - Array of lead data
     * @param {object} options - Additional options
     * @returns {Array} Created leads
     */
    async bulkCreate(leadsData, options = {}) {
        const results = [];
        const errors = [];

        for (const leadData of leadsData) {
            try {
                const lead = await this.create(leadData, options);
                results.push(lead);
            } catch (error) {
                errors.push({ data: leadData, error: error.message });
            }
        }

        return { results, errors, total: leadsData.length };
    }

    /**
     * Bulk update leads
     * @param {Array} leadsData - Array of lead data with IDs
     * @param {object} options - Additional options
     * @returns {Array} Updated leads
     */
    async bulkUpdate(leadsData, options = {}) {
        const results = [];
        const errors = [];

        for (const leadData of leadsData) {
            try {
                const { id, ...updateData } = leadData;
                const lead = await this.update(id, updateData, options);
                results.push(lead);
            } catch (error) {
                errors.push({ data: leadData, error: error.message });
            }
        }

        return { results, errors, total: leadsData.length };
    }

    /**
     * Archive a lead
     * @param {string} id - Lead ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async archive(id, options = {}) {
        const lead = await this.findById(id);
        if (!lead) {
            throw new Error(`Lead ${id} not found`);
        }

        lead.isArchived = true;
        lead.updatedAt = new Date().toISOString();
        lead.archivedAt = new Date().toISOString();
        lead.archivedBy = options.userId || 'system';

        this.invalidateCache(id);

        await auditLogger.log(
            options.userId || 'system',
            'lead.archived',
            'lead',
            { leadId: id, name: lead.name }
        );

        return true;
    }

    /**
     * Restore an archived lead
     * @param {string} id - Lead ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async restore(id, options = {}) {
        const index = leads.findIndex(l => l.id === id && l.isArchived);
        
        if (index === -1) {
            throw new Error(`Archived lead ${id} not found`);
        }

        const lead = leads[index];
        lead.isArchived = false;
        lead.isActive = true;
        lead.updatedAt = new Date().toISOString();
        lead.restoredAt = new Date().toISOString();
        lead.restoredBy = options.userId || 'system';

        this.invalidateCache(id);

        await auditLogger.log(
            options.userId || 'system',
            'lead.restored',
            'lead',
            { leadId: id, name: lead.name }
        );

        return true;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'lead_' + idCounter;
    }

    /**
     * Validate lead data
     * @param {object} leadData - Lead data to validate
     * @throws {Error} If validation fails
     */
    validateLead(leadData) {
        if (!leadData.name) {
            throw new Error('Name is required');
        }

        if (!leadData.phone && !leadData.email) {
            throw new Error('Phone or email is required');
        }

        if (leadData.email && !this.isValidEmail(leadData.email)) {
            throw new Error('Invalid email format');
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Normalize phone number
     * @param {string} phone - Phone number
     * @returns {string} Normalized phone
     */
    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }

    /**
     * Update indexes for a lead
     * @param {object} lead - Lead object
     */
    updateIndexes(lead) {
        // Phone index
        if (lead.phone) {
            const normalizedPhone = this.normalizePhone(lead.phone);
            this.indexes.byPhone.set(normalizedPhone, lead.id);
        }

        // Email index
        if (lead.email) {
            const normalizedEmail = lead.email.toLowerCase().trim();
            this.indexes.byEmail.set(normalizedEmail, lead.id);
        }

        // Status index
        if (lead.status) {
            if (!this.indexes.byStatus.has(lead.status)) {
                this.indexes.byStatus.set(lead.status, new Set());
            }
            this.indexes.byStatus.get(lead.status).add(lead.id);
        }

        // Source index
        if (lead.source) {
            if (!this.indexes.bySource.has(lead.source)) {
                this.indexes.bySource.set(lead.source, new Set());
            }
            this.indexes.bySource.get(lead.source).add(lead.id);
        }

        // AssignedTo index
        if (lead.assignedTo) {
            if (!this.indexes.byAssignedTo.has(lead.assignedTo)) {
                this.indexes.byAssignedTo.set(lead.assignedTo, new Set());
            }
            this.indexes.byAssignedTo.get(lead.assignedTo).add(lead.id);
        }

        // Tenant index
        if (lead.tenantId) {
            if (!this.indexes.byTenant.has(lead.tenantId)) {
                this.indexes.byTenant.set(lead.tenantId, new Set());
            }
            this.indexes.byTenant.get(lead.tenantId).add(lead.id);
        }
    }

    /**
     * Invalidate cache for a lead
     * @param {string} id - Lead ID
     */
    invalidateCache(id) {
        this.cache.delete(id);
        this.cacheTimestamps.delete(id);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[LeadRepository] Debug mode enabled');
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
}

// Create and export singleton instance
export const leadRepository = new LeadRepository();

// Export class for testing
export default LeadRepository;
