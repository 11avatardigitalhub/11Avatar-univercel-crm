/**
 * ==========================================
 * FILE: dealRepository.js
 * MODULE: Data/Repositories
 * CODE: DAT-3
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Data access layer for Deal entities.
 * Handles CRUD operations, pipeline management, and revenue tracking.
 * Implements tenant isolation and caching.
 * 
 * DEPENDENCIES:
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * - changeTracker.js (for tracking changes)
 * - customerRepository.js (for customer reference)
 * 
 * FUNCTIONS:
 * - create(dealData): Create a new deal
 * - findById(id): Find deal by ID
 * - findAll(filters): Find all deals with filters
 * - update(id, dealData): Update a deal
 * - delete(id): Delete a deal
 * - getDealsByCustomer(customerId): Get deals by customer
 * - getDealsByPipeline(pipelineId): Get deals by pipeline
 * - getDealsByStage(stageId): Get deals by stage
 * - getDealsByStatus(status): Get deals by status
 * - updateStage(id, stageId): Update deal stage
 * - markWon(id, data): Mark deal as won
 * - markLost(id, reason): Mark deal as lost
 * - getPipelineStats(): Get pipeline statistics
 * - getRevenueForecast(): Get revenue forecast
 * - getDealAnalytics(): Get deal analytics
 * - addProduct(id, product): Add product to deal
 * - removeProduct(id, productId): Remove product from deal
 * - updateProbability(id, probability): Update deal probability
 * 
 * USAGE EXAMPLE:
 * import { dealRepository } from './data/repositories/dealRepository.js';
 * 
 * // Create a new deal
 * const deal = await dealRepository.create({
 *   customerId: 'cust_123',
 *   title: 'Enterprise Software License',
 *   value: 150000,
 *   pipelineId: 'pipeline_1',
 *   stageId: 'stage_negotiation'
 * });
 * 
 * // Mark deal as won
 * await dealRepository.markWon('deal_456', {
 *   actualClose: new Date().toISOString(),
 *   notes: 'Contract signed'
 * });
 * ==========================================
 */

import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { changeTracker } from '../../core/audit/changeTracker.js';
import { customerRepository } from './customerRepository.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let deals = [];
let idCounter = 1000;

class DealRepository {
    constructor() {
        // In-memory cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Indexes for faster lookups
        this.indexes = {
            byCustomer: new Map(),
            byPipeline: new Map(),
            byStage: new Map(),
            byStatus: new Map(),
            byAssignedTo: new Map(),
            byTenant: new Map()
        };
        
        // Pipeline definitions
        this.pipelines = new Map();
        this.initPipelines();
        
        // Configuration
        this.config = {
            enableCache: true,
            enableIndexes: true,
            defaultLimit: 100,
            maxLimit: 1000,
            defaultPipeline: 'default'
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample data
        this.initSampleData();
    }

    /**
     * Initialize pipeline definitions
     */
    initPipelines() {
        // Default pipeline stages
        this.pipelines.set('default', {
            id: 'default',
            name: 'Default Pipeline',
            description: 'Standard sales pipeline',
            stages: [
                { id: 'stage_new', name: 'New', order: 0, probability: 10 },
                { id: 'stage_contacted', name: 'Contacted', order: 1, probability: 20 },
                { id: 'stage_qualified', name: 'Qualified', order: 2, probability: 30 },
                { id: 'stage_negotiation', name: 'Negotiation', order: 3, probability: 50 },
                { id: 'stage_proposal', name: 'Proposal Sent', order: 4, probability: 60 },
                { id: 'stage_verbal_yes', name: 'Verbal Yes', order: 5, probability: 80 },
                { id: 'stage_invoice', name: 'Invoice Sent', order: 6, probability: 85 },
                { id: 'stage_won', name: 'Won', order: 7, probability: 100 },
                { id: 'stage_lost', name: 'Lost', order: 8, probability: 0 }
            ]
        });
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const sampleDeals = [
            {
                id: 'deal_1001',
                tenantId: 'tenant_1',
                customerId: 'cust_1001',
                title: 'Annual ERP License',
                description: 'Enterprise resource planning license for 50 users',
                value: 500000,
                currency: 'INR',
                pipelineId: 'default',
                stageId: 'stage_negotiation',
                probability: 50,
                expectedClose: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                actualClose: null,
                status: 'active',
                assignedTo: 'user_123',
                products: [
                    { id: 'prod_1', name: 'ERP License', quantity: 50, price: 10000, total: 500000 }
                ],
                notes: 'Client is evaluating our proposal. Price negotiation in progress.',
                tags: ['enterprise', 'high_value'],
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'deal_1002',
                tenantId: 'tenant_1',
                customerId: 'cust_1002',
                title: 'Healthcare Management Suite',
                description: 'Complete healthcare management solution',
                value: 250000,
                currency: 'INR',
                pipelineId: 'default',
                stageId: 'stage_proposal',
                probability: 60,
                expectedClose: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                actualClose: null,
                status: 'active',
                assignedTo: 'user_456',
                products: [
                    { id: 'prod_2', name: 'Healthcare Suite', quantity: 10, price: 25000, total: 250000 }
                ],
                notes: 'Proposal sent. Awaiting client feedback.',
                tags: ['healthcare', 'urgent'],
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'deal_1003',
                tenantId: 'tenant_1',
                customerId: 'cust_1003',
                title: 'IT Support Contract',
                description: 'Annual IT support and maintenance contract',
                value: 100000,
                currency: 'INR',
                pipelineId: 'default',
                stageId: 'stage_won',
                probability: 100,
                expectedClose: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                actualClose: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'won',
                assignedTo: 'user_789',
                products: [
                    { id: 'prod_3', name: 'IT Support', quantity: 12, price: 8333.33, total: 100000 }
                ],
                notes: 'Contract signed. Implementation starting next week.',
                tags: ['recurring', 'support'],
                createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const deal of sampleDeals) {
            deals.push(deal);
            this.updateIndexes(deal);
        }
    }

    /**
     * Create a new deal
     * @param {object} dealData - Deal data
     * @param {object} options - Additional options
     * @returns {object} Created deal
     */
    async create(dealData, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate deal data
        this.validateDeal(dealData);

        // Validate customer exists
        const customer = await customerRepository.findById(dealData.customerId);
        if (!customer) {
            throw new Error(`Customer ${dealData.customerId} not found`);
        }

        // Get pipeline stages
        const pipeline = this.pipelines.get(dealData.pipelineId || this.config.defaultPipeline);
        if (!pipeline) {
            throw new Error(`Pipeline ${dealData.pipelineId} not found`);
        }

        // Get stage details
        const stage = pipeline.stages.find(s => s.id === dealData.stageId);
        if (!stage) {
            throw new Error(`Stage ${dealData.stageId} not found in pipeline ${pipeline.id}`);
        }

        // Create deal object
        const deal = {
            id: this.generateId(),
            tenantId: tenantId,
            customerId: dealData.customerId,
            title: dealData.title,
            description: dealData.description || '',
            value: dealData.value || 0,
            currency: dealData.currency || 'INR',
            pipelineId: dealData.pipelineId || this.config.defaultPipeline,
            stageId: dealData.stageId,
            probability: stage.probability || 0,
            expectedClose: dealData.expectedClose || null,
            actualClose: null,
            status: 'active',
            assignedTo: dealData.assignedTo || null,
            products: dealData.products || [],
            notes: dealData.notes || '',
            tags: dealData.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        deals.push(deal);
        this.updateIndexes(deal);
        this.invalidateCache(deal.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.created',
            'deal',
            { dealId: deal.id, title: deal.title, value: deal.value }
        );

        if (this.debugMode) {
            console.log('[DealRepository] Created deal:', deal.id);
        }

        return { ...deal };
    }

    /**
     * Find deal by ID
     * @param {string} id - Deal ID
     * @param {object} options - Additional options
     * @returns {object|null} Deal or null
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

        const deal = deals.find(d => d.id === id);
        
        if (!deal) {
            return null;
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (deal.tenantId !== tenantId) {
            return null;
        }

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(id, deal);
            this.cacheTimestamps.set(id, Date.now());
        }

        return { ...deal };
    }

    /**
     * Find all deals with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async findAll(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = deals.filter(deal => deal.tenantId === tenantId);

        // Apply filters
        if (filters.customerId) {
            results = results.filter(deal => deal.customerId === filters.customerId);
        }

        if (filters.pipelineId) {
            results = results.filter(deal => deal.pipelineId === filters.pipelineId);
        }

        if (filters.stageId) {
            results = results.filter(deal => deal.stageId === filters.stageId);
        }

        if (filters.status) {
            results = results.filter(deal => deal.status === filters.status);
        }

        if (filters.assignedTo) {
            results = results.filter(deal => deal.assignedTo === filters.assignedTo);
        }

        if (filters.minValue) {
            results = results.filter(deal => deal.value >= filters.minValue);
        }

        if (filters.maxValue) {
            results = results.filter(deal => deal.value <= filters.maxValue);
        }

        if (filters.startDate) {
            results = results.filter(deal => new Date(deal.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(deal => new Date(deal.createdAt) <= new Date(filters.endDate));
        }

        if (filters.tags) {
            const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
            results = results.filter(deal => 
                tags.some(tag => deal.tags.includes(tag))
            );
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(deal =>
                deal.title.toLowerCase().includes(searchTerm) ||
                (deal.description && deal.description.toLowerCase().includes(searchTerm)) ||
                (deal.notes && deal.notes.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'expectedClose' || sortBy === 'actualClose') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
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

        return paginated.map(deal => ({ ...deal }));
    }

    /**
     * Update a deal
     * @param {string} id - Deal ID
     * @param {object} dealData - Updated deal data
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async update(id, dealData, options = {}) {
        const index = deals.findIndex(d => d.id === id);
        
        if (index === -1) {
            throw new Error(`Deal ${id} not found`);
        }

        const oldDeal = { ...deals[index] };
        const deal = deals[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (deal.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // If updating stage, validate it exists
        if (dealData.stageId) {
            const pipeline = this.pipelines.get(deal.pipelineId);
            const stage = pipeline.stages.find(s => s.id === dealData.stageId);
            if (!stage) {
                throw new Error(`Stage ${dealData.stageId} not found in pipeline ${deal.pipelineId}`);
            }
            // Update probability based on stage
            dealData.probability = stage.probability;
        }

        // Track changes
        const changedFields = {};
        for (const [key, value] of Object.entries(dealData)) {
            if (value !== undefined && deal[key] !== value) {
                changedFields[key] = { old: deal[key], new: value };
                deal[key] = value;
            }
        }

        deal.updatedAt = new Date().toISOString();

        // Update indexes
        this.updateIndexes(deal);
        this.invalidateCache(id);

        // Track change
        await changeTracker.trackChange(
            'deal',
            id,
            oldDeal,
            deal,
            options.userId || 'system'
        );

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.updated',
            'deal',
            { dealId: id, changes: changedFields }
        );

        if (this.debugMode) {
            console.log('[DealRepository] Updated deal:', id);
        }

        return { ...deal };
    }

    /**
     * Delete a deal
     * @param {string} id - Deal ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async delete(id, options = {}) {
        const index = deals.findIndex(d => d.id === id);
        
        if (index === -1) {
            throw new Error(`Deal ${id} not found`);
        }

        const deal = deals[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (deal.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Can't delete won or lost deals (for audit purposes)
        if (deal.status === 'won' || deal.status === 'lost') {
            throw new Error(`Cannot delete ${deal.status} deal`);
        }

        // Soft delete
        deals.splice(index, 1);

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.deleted',
            'deal',
            { dealId: id, title: deal.title }
        );

        if (this.debugMode) {
            console.log('[DealRepository] Deleted deal:', id);
        }

        return true;
    }

    /**
     * Get deals by customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async getDealsByCustomer(customerId, options = {}) {
        return await this.findAll({ customerId }, options);
    }

    /**
     * Get deals by pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async getDealsByPipeline(pipelineId, options = {}) {
        return await this.findAll({ pipelineId }, options);
    }

    /**
     * Get deals by stage
     * @param {string} stageId - Stage ID
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async getDealsByStage(stageId, options = {}) {
        return await this.findAll({ stageId }, options);
    }

    /**
     * Get deals by status
     * @param {string} status - Deal status (active, won, lost)
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async getDealsByStatus(status, options = {}) {
        return await this.findAll({ status }, options);
    }

    /**
     * Update deal stage
     * @param {string} id - Deal ID
     * @param {string} stageId - New stage ID
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async updateStage(id, stageId, options = {}) {
        return await this.update(id, { stageId }, options);
    }

    /**
     * Mark deal as won
     * @param {string} id - Deal ID
     * @param {object} data - Won data
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async markWon(id, data = {}, options = {}) {
        const deal = await this.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        // Get won stage
        const pipeline = this.pipelines.get(deal.pipelineId);
        const wonStage = pipeline.stages.find(s => s.id === 'stage_won');
        if (!wonStage) {
            throw new Error('Won stage not found in pipeline');
        }

        const updateData = {
            stageId: 'stage_won',
            status: 'won',
            probability: 100,
            actualClose: data.actualClose || new Date().toISOString(),
            notes: data.notes ? `${deal.notes}\n\nWon: ${data.notes}` : deal.notes
        };

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.won',
            'deal',
            { dealId: id, value: deal.value }
        );

        return await this.update(id, updateData, options);
    }

    /**
     * Mark deal as lost
     * @param {string} id - Deal ID
     * @param {string} reason - Loss reason
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async markLost(id, reason = '', options = {}) {
        const deal = await this.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        // Get lost stage
        const pipeline = this.pipelines.get(deal.pipelineId);
        const lostStage = pipeline.stages.find(s => s.id === 'stage_lost');
        if (!lostStage) {
            throw new Error('Lost stage not found in pipeline');
        }

        const updateData = {
            stageId: 'stage_lost',
            status: 'lost',
            probability: 0,
            actualClose: new Date().toISOString(),
            lossReason: reason,
            notes: deal.notes ? `${deal.notes}\n\nLost: ${reason}` : `Lost: ${reason}`
        };

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.lost',
            'deal',
            { dealId: id, reason }
        );

        return await this.update(id, updateData, options);
    }

    /**
     * Get pipeline statistics
     * @param {object} options - Additional options
     * @returns {object} Pipeline statistics
     */
    async getPipelineStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantDeals = deals.filter(d => d.tenantId === tenantId);
        const activeDeals = tenantDeals.filter(d => d.status === 'active');

        const stats = {
            total: tenantDeals.length,
            active: activeDeals.length,
            won: tenantDeals.filter(d => d.status === 'won').length,
            lost: tenantDeals.filter(d => d.status === 'lost').length,
            totalValue: 0,
            weightedValue: 0,
            byStage: {},
            conversionRate: 0
        };

        let totalValue = 0;
        let weightedValue = 0;

        for (const deal of tenantDeals) {
            totalValue += deal.value || 0;
            weightedValue += (deal.value || 0) * (deal.probability / 100);
            
            if (deal.status === 'active') {
                const stageName = this.getStageName(deal.pipelineId, deal.stageId);
                if (stageName) {
                    stats.byStage[stageName] = stats.byStage[stageName] || {
                        count: 0,
                        value: 0
                    };
                    stats.byStage[stageName].count++;
                    stats.byStage[stageName].value += deal.value || 0;
                }
            }
        }

        stats.totalValue = totalValue;
        stats.weightedValue = Math.round(weightedValue);
        
        // Calculate conversion rate
        const wonCount = tenantDeals.filter(d => d.status === 'won').length;
        const lostCount = tenantDeals.filter(d => d.status === 'lost').length;
        const closedCount = wonCount + lostCount;
        stats.conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

        return stats;
    }

    /**
     * Get revenue forecast
     * @param {object} options - Additional options
     * @returns {object} Revenue forecast
     */
    async getRevenueForecast(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const activeDeals = deals.filter(d => 
            d.tenantId === tenantId && 
            d.status === 'active'
        );

        const forecast = {
            monthly: [],
            quarterly: [],
            total: 0,
            weightedTotal: 0,
            dealsCount: activeDeals.length
        };

        // Group by month
        const monthlyData = {};
        const now = new Date();
        const sixMonths = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);

        for (const deal of activeDeals) {
            if (deal.expectedClose) {
                const closeDate = new Date(deal.expectedClose);
                if (closeDate >= now && closeDate <= sixMonths) {
                    const monthKey = closeDate.getFullYear() + '-' + String(closeDate.getMonth() + 1).padStart(2, '0');
                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = {
                            total: 0,
                            weighted: 0,
                            deals: []
                        };
                    }
                    monthlyData[monthKey].total += deal.value || 0;
                    monthlyData[monthKey].weighted += (deal.value || 0) * (deal.probability / 100);
                    monthlyData[monthKey].deals.push(deal.id);
                }
            }
        }

        // Convert to array and sort
        for (const [month, data] of Object.entries(monthlyData)) {
            forecast.monthly.push({
                month: month,
                totalValue: data.total,
                weightedValue: Math.round(data.weighted),
                dealsCount: data.deals.length
            });
            forecast.total += data.total;
            forecast.weightedTotal += data.weighted;
        }

        forecast.monthly.sort((a, b) => a.month.localeCompare(b.month));
        forecast.total = Math.round(forecast.total);
        forecast.weightedTotal = Math.round(forecast.weightedTotal);

        return forecast;
    }

    /**
     * Get deal analytics
     * @param {object} options - Additional options
     * @returns {object} Deal analytics
     */
    async getDealAnalytics(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantDeals = deals.filter(d => d.tenantId === tenantId);
        const now = new Date();

        const analytics = {
            averageDealSize: 0,
            averageSalesCycle: 0,
            winRate: 0,
            dealsByValue: {
                small: 0,    // < 50,000
                medium: 0,   // 50,000 - 200,000
                large: 0,    // 200,000 - 500,000
                enterprise: 0 // > 500,000
            },
            dealsByIndustry: {},
            topPerformingProducts: {},
            revenueByMonth: {}
        };

        let totalValue = 0;
        let totalCycleTime = 0;
        let cycleCount = 0;
        const wonDeals = tenantDeals.filter(d => d.status === 'won');

        for (const deal of tenantDeals) {
            totalValue += deal.value || 0;

            // Categorize by value
            const value = deal.value || 0;
            if (value < 50000) analytics.dealsByValue.small++;
            else if (value < 200000) analytics.dealsByValue.medium++;
            else if (value < 500000) analytics.dealsByValue.large++;
            else analytics.dealsByValue.enterprise++;

            // Calculate sales cycle for won deals
            if (deal.status === 'won' && deal.actualClose && deal.createdAt) {
                const created = new Date(deal.createdAt);
                const closed = new Date(deal.actualClose);
                const days = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
                totalCycleTime += days;
                cycleCount++;
            }

            // Group by industry (would need customer data)
            // Group by product
            if (deal.products) {
                for (const product of deal.products) {
                    const name = product.name || 'Unknown';
                    analytics.topPerformingProducts[name] = (analytics.topPerformingProducts[name] || 0) + product.total || 0;
                }
            }

            // Revenue by month for won deals
            if (deal.status === 'won' && deal.actualClose) {
                const date = new Date(deal.actualClose);
                const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
                analytics.revenueByMonth[monthKey] = (analytics.revenueByMonth[monthKey] || 0) + (deal.value || 0);
            }
        }

        analytics.averageDealSize = tenantDeals.length > 0 ? Math.round(totalValue / tenantDeals.length) : 0;
        analytics.averageSalesCycle = cycleCount > 0 ? Math.round(totalCycleTime / cycleCount) : 0;
        analytics.winRate = tenantDeals.length > 0 ? Math.round((wonDeals.length / tenantDeals.length) * 100) : 0;

        return analytics;
    }

    /**
     * Add product to deal
     * @param {string} id - Deal ID
     * @param {object} product - Product data
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async addProduct(id, product, options = {}) {
        const deal = await this.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        const products = [...deal.products];
        products.push({
            id: product.id || 'prod_' + Date.now(),
            name: product.name,
            quantity: product.quantity || 1,
            price: product.price || 0,
            total: (product.quantity || 1) * (product.price || 0)
        });

        // Update deal value
        const totalValue = products.reduce((sum, p) => sum + p.total, 0);

        return await this.update(id, { products, value: totalValue }, options);
    }

    /**
     * Remove product from deal
     * @param {string} id - Deal ID
     * @param {string} productId - Product ID
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async removeProduct(id, productId, options = {}) {
        const deal = await this.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        const products = deal.products.filter(p => p.id !== productId);
        
        // Update deal value
        const totalValue = products.reduce((sum, p) => sum + p.total, 0);

        return await this.update(id, { products, value: totalValue }, options);
    }

    /**
     * Update deal probability
     * @param {string} id - Deal ID
     * @param {number} probability - New probability (0-100)
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async updateProbability(id, probability, options = {}) {
        if (probability < 0 || probability > 100) {
            throw new Error('Probability must be between 0 and 100');
        }

        return await this.update(id, { probability }, options);
    }

    /**
     * Get stage name from pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {string} stageId - Stage ID
     * @returns {string|null} Stage name or null
     */
    getStageName(pipelineId, stageId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) return null;
        const stage = pipeline.stages.find(s => s.id === stageId);
        return stage ? stage.name : null;
    }

    /**
     * Get all pipelines
     * @param {object} options - Additional options
     * @returns {Array} List of pipelines
     */
    getPipelines(options = {}) {
        const result = [];
        for (const [id, pipeline] of this.pipelines) {
            result.push({ ...pipeline });
        }
        return result;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'deal_' + idCounter;
    }

    /**
     * Validate deal data
     * @param {object} dealData - Deal data to validate
     * @throws {Error} If validation fails
     */
    validateDeal(dealData) {
        if (!dealData.customerId) {
            throw new Error('Customer ID is required');
        }

        if (!dealData.title) {
            throw new Error('Deal title is required');
        }

        if (dealData.value !== undefined && dealData.value < 0) {
            throw new Error('Deal value cannot be negative');
        }
    }

    /**
     * Update indexes for a deal
     * @param {object} deal - Deal object
     */
    updateIndexes(deal) {
        // Customer index
        if (deal.customerId) {
            if (!this.indexes.byCustomer.has(deal.customerId)) {
                this.indexes.byCustomer.set(deal.customerId, new Set());
            }
            this.indexes.byCustomer.get(deal.customerId).add(deal.id);
        }

        // Pipeline index
        if (deal.pipelineId) {
            if (!this.indexes.byPipeline.has(deal.pipelineId)) {
                this.indexes.byPipeline.set(deal.pipelineId, new Set());
            }
            this.indexes.byPipeline.get(deal.pipelineId).add(deal.id);
        }

        // Stage index
        if (deal.stageId) {
            if (!this.indexes.byStage.has(deal.stageId)) {
                this.indexes.byStage.set(deal.stageId, new Set());
            }
            this.indexes.byStage.get(deal.stageId).add(deal.id);
        }

        // Status index
        if (deal.status) {
            if (!this.indexes.byStatus.has(deal.status)) {
                this.indexes.byStatus.set(deal.status, new Set());
            }
            this.indexes.byStatus.get(deal.status).add(deal.id);
        }

        // AssignedTo index
        if (deal.assignedTo) {
            if (!this.indexes.byAssignedTo.has(deal.assignedTo)) {
                this.indexes.byAssignedTo.set(deal.assignedTo, new Set());
            }
            this.indexes.byAssignedTo.get(deal.assignedTo).add(deal.id);
        }

        // Tenant index
        if (deal.tenantId) {
            if (!this.indexes.byTenant.has(deal.tenantId)) {
                this.indexes.byTenant.set(deal.tenantId, new Set());
            }
            this.indexes.byTenant.get(deal.tenantId).add(deal.id);
        }
    }

    /**
     * Invalidate cache for a deal
     * @param {string} id - Deal ID
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
        console.log('[DealRepository] Debug mode enabled');
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
export const dealRepository = new DealRepository();

// Export class for testing
export default DealRepository;
