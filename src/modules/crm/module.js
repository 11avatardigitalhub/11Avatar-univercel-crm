/**
 * ==========================================
 * FILE: module.js
 * MODULE: CRM Module
 * CODE: CRM-1
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Main CRM module that orchestrates lead, customer, and deal management.
 * Provides unified interface for CRM operations and integrates with
 * repositories for data access.
 * 
 * DEPENDENCIES:
 * - leadRepository.js (for lead operations)
 * - customerRepository.js (for customer operations)
 * - dealRepository.js (for deal operations)
 * - taskRepository.js (for task operations)
 * - auditLogger.js (for logging)
 * - eventBus.js (for events)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize CRM module
 * - getLead(id): Get lead by ID
 * - createLead(data): Create a new lead
 * - updateLead(id, data): Update a lead
 * - deleteLead(id): Delete a lead
 * - getCustomer(id): Get customer by ID
 * - createCustomer(data): Create a new customer
 * - updateCustomer(id, data): Update a customer
 * - deleteCustomer(id): Delete a customer
 * - convertLeadToCustomer(leadId): Convert lead to customer
 * - getDeal(id): Get deal by ID
 * - createDeal(data): Create a new deal
 * - updateDeal(id, data): Update a deal
 * - deleteDeal(id): Delete a deal
 * - getLeads(filters): Get leads with filters
 * - getCustomers(filters): Get customers with filters
 * - getDeals(filters): Get deals with filters
 * - getDashboardData(): Get dashboard data
 * - getPipelineData(): Get pipeline data
 * - getStats(): Get CRM statistics
 * 
 * USAGE EXAMPLE:
 * import { crmModule } from './modules/crm/module.js';
 * 
 * // Initialize CRM
 * await crmModule.initialize();
 * 
 * // Create a lead
 * const lead = await crmModule.createLead({
 *   name: 'John Doe',
 *   phone: '+91 9876543210',
 *   email: 'john@example.com'
 * });
 * 
 * // Convert lead to customer
 * const customer = await crmModule.convertLeadToCustomer(lead.id);
 * 
 * // Get dashboard data
 * const dashboard = await crmModule.getDashboardData();
 * ==========================================
 */

import { leadRepository } from '../../layers/data/repositories/leadRepository.js';
import { customerRepository } from '../../layers/data/repositories/customerRepository.js';
import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { taskRepository } from '../../layers/data/repositories/taskRepository.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { roleEngine } from '../../core/rbac/roleEngine.js';

class CRMModule {
    constructor() {
        // Module state
        this.initialized = false;
        this.config = {
            enableAutoAssignment: true,
            enableLeadScoring: true,
            enableDuplicationCheck: true,
            defaultPipeline: 'default',
            maxLeadsPerUser: 1000,
            maxCustomersPerUser: 500
        };
        
        // Statistics
        this.stats = {
            leadsCreated: 0,
            customersCreated: 0,
            dealsCreated: 0,
            tasksCreated: 0,
            leadsConverted: 0,
            dealsWon: 0,
            dealsLost: 0
        };
        
        // Event subscriptions
        this.subscriptions = [];
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize CRM module
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

            // Setup event listeners
            this.setupEventListeners();

            // Log initialization
            logger.info('CRM module initialized', { 
                version: '1.0.0',
                config: this.config 
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('CRM module initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Lead created event
        const leadCreatedSub = eventBus.subscribe('lead.created', async (data) => {
            this.stats.leadsCreated++;
            
            // Auto-assign if enabled
            if (this.config.enableAutoAssignment) {
                await this.autoAssignLead(data.leadId);
            }
            
            // Create initial task
            await this.createInitialTask(data.leadId);
            
            // Log to audit
            await auditLogger.log(
                data.userId || 'system',
                'lead.created.auto',
                'lead',
                { leadId: data.leadId }
            );
        });

        // Lead converted event
        const leadConvertedSub = eventBus.subscribe('lead.converted', async (data) => {
            this.stats.leadsConverted++;
            
            // Log to audit
            await auditLogger.log(
                data.userId || 'system',
                'lead.converted.auto',
                'lead',
                { leadId: data.leadId, customerId: data.customerId }
            );
        });

        // Deal won event
        const dealWonSub = eventBus.subscribe('deal.won', async (data) => {
            this.stats.dealsWon++;
            
            // Log to audit
            await auditLogger.log(
                data.userId || 'system',
                'deal.won.auto',
                'deal',
                { dealId: data.dealId }
            );
        });

        // Deal lost event
        const dealLostSub = eventBus.subscribe('deal.lost', async (data) => {
            this.stats.dealsLost++;
            
            // Log to audit
            await auditLogger.log(
                data.userId || 'system',
                'deal.lost.auto',
                'deal',
                { dealId: data.dealId, reason: data.reason }
            );
        });

        this.subscriptions = [leadCreatedSub, leadConvertedSub, dealWonSub, dealLostSub];
    }

    /**
     * Auto-assign lead to a user
     * @param {string} leadId - Lead ID
     */
    async autoAssignLead(leadId) {
        try {
            // In production, this would use round-robin or AI-based assignment
            // For MVP, assign to first available executive
            const lead = await leadRepository.findById(leadId);
            if (!lead) return;

            // Get available executives
            // For MVP, skip assignment if no executives
            if (this.debugMode) {
                logger.debug(`[CRM] Auto-assign skipped for lead ${leadId}`);
            }
        } catch (error) {
            logger.error(`[CRM] Auto-assign failed for lead ${leadId}:`, error);
        }
    }

    /**
     * Create initial task for a lead
     * @param {string} leadId - Lead ID
     */
    async createInitialTask(leadId) {
        try {
            const lead = await leadRepository.findById(leadId);
            if (!lead) return;

            await taskRepository.create({
                title: `Follow up with ${lead.name}`,
                description: `Initial follow-up for lead from ${lead.source || 'unknown source'}`,
                type: 'followup',
                priority: 'high',
                dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                relatedTo: {
                    type: 'lead',
                    id: leadId
                },
                notes: `Auto-created task for new lead: ${lead.name}`
            });

            this.stats.tasksCreated++;
        } catch (error) {
            logger.error(`[CRM] Failed to create initial task for lead ${leadId}:`, error);
        }
    }

    // ===== LEAD OPERATIONS =====

    /**
     * Get lead by ID
     * @param {string} id - Lead ID
     * @returns {object} Lead data
     */
    async getLead(id) {
        return await leadRepository.findById(id);
    }

    /**
     * Create a new lead
     * @param {object} data - Lead data
     * @param {object} options - Additional options
     * @returns {object} Created lead
     */
    async createLead(data, options = {}) {
        // Check for duplicates if enabled
        if (this.config.enableDuplicationCheck) {
            const isDuplicate = await leadRepository.checkDuplicate(data);
            if (isDuplicate) {
                throw new Error('Duplicate lead detected');
            }
        }

        const lead = await leadRepository.create(data, options);
        this.stats.leadsCreated++;

        // Emit event
        eventBus.publish('lead.created', {
            leadId: lead.id,
            userId: options.userId || 'system'
        });

        return lead;
    }

    /**
     * Update a lead
     * @param {string} id - Lead ID
     * @param {object} data - Updated lead data
     * @param {object} options - Additional options
     * @returns {object} Updated lead
     */
    async updateLead(id, data, options = {}) {
        const lead = await leadRepository.update(id, data, options);
        
        // Check if status changed to converted
        if (data.status === 'converted' && !data.customerId) {
            // Auto-convert if status changed to converted
            await this.convertLeadToCustomer(id, options);
        }

        // Emit event
        eventBus.publish('lead.updated', {
            leadId: lead.id,
            userId: options.userId || 'system'
        });

        return lead;
    }

    /**
     * Delete a lead
     * @param {string} id - Lead ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteLead(id, options = {}) {
        const result = await leadRepository.delete(id, options);
        
        // Emit event
        eventBus.publish('lead.deleted', {
            leadId: id,
            userId: options.userId || 'system'
        });

        return result;
    }

    /**
     * Get leads with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeads(filters = {}, options = {}) {
        return await leadRepository.findAll(filters, options);
    }

    /**
     * Convert lead to customer
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} Created customer
     */
    async convertLeadToCustomer(leadId, options = {}) {
        const customer = await customerRepository.convertFromLead(leadId, options);
        
        // Emit event
        eventBus.publish('lead.converted', {
            leadId: leadId,
            customerId: customer.id,
            userId: options.userId || 'system'
        });

        return customer;
    }

    // ===== CUSTOMER OPERATIONS =====

    /**
     * Get customer by ID
     * @param {string} id - Customer ID
     * @returns {object} Customer data
     */
    async getCustomer(id) {
        return await customerRepository.findById(id);
    }

    /**
     * Create a new customer
     * @param {object} data - Customer data
     * @param {object} options - Additional options
     * @returns {object} Created customer
     */
    async createCustomer(data, options = {}) {
        const customer = await customerRepository.create(data, options);
        this.stats.customersCreated++;
        return customer;
    }

    /**
     * Update a customer
     * @param {string} id - Customer ID
     * @param {object} data - Updated customer data
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async updateCustomer(id, data, options = {}) {
        return await customerRepository.update(id, data, options);
    }

    /**
     * Delete a customer
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteCustomer(id, options = {}) {
        return await customerRepository.delete(id, options);
    }

    /**
     * Get customers with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async getCustomers(filters = {}, options = {}) {
        return await customerRepository.findAll(filters, options);
    }

    /**
     * Get customer 360 view
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object} Customer 360 data
     */
    async getCustomer360(id, options = {}) {
        return await customerRepository.getCustomer360(id, options);
    }

    // ===== DEAL OPERATIONS =====

    /**
     * Get deal by ID
     * @param {string} id - Deal ID
     * @returns {object} Deal data
     */
    async getDeal(id) {
        return await dealRepository.findById(id);
    }

    /**
     * Create a new deal
     * @param {object} data - Deal data
     * @param {object} options - Additional options
     * @returns {object} Created deal
     */
    async createDeal(data, options = {}) {
        const deal = await dealRepository.create(data, options);
        this.stats.dealsCreated++;
        return deal;
    }

    /**
     * Update a deal
     * @param {string} id - Deal ID
     * @param {object} data - Updated deal data
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async updateDeal(id, data, options = {}) {
        return await dealRepository.update(id, data, options);
    }

    /**
     * Delete a deal
     * @param {string} id - Deal ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteDeal(id, options = {}) {
        return await dealRepository.delete(id, options);
    }

    /**
     * Get deals with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of deals
     */
    async getDeals(filters = {}, options = {}) {
        return await dealRepository.findAll(filters, options);
    }

    /**
     * Mark deal as won
     * @param {string} id - Deal ID
     * @param {object} data - Won data
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async markDealWon(id, data = {}, options = {}) {
        const deal = await dealRepository.markWon(id, data, options);
        
        // Emit event
        eventBus.publish('deal.won', {
            dealId: deal.id,
            userId: options.userId || 'system'
        });

        return deal;
    }

    /**
     * Mark deal as lost
     * @param {string} id - Deal ID
     * @param {string} reason - Loss reason
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async markDealLost(id, reason, options = {}) {
        const deal = await dealRepository.markLost(id, reason, options);
        
        // Emit event
        eventBus.publish('deal.lost', {
            dealId: deal.id,
            reason: reason,
            userId: options.userId || 'system'
        });

        return deal;
    }

    // ===== DASHBOARD & ANALYTICS =====

    /**
     * Get dashboard data
     * @param {object} options - Additional options
     * @returns {object} Dashboard data
     */
    async getDashboardData(options = {}) {
        const [leadStats, customerStats, dealStats, taskStats] = await Promise.all([
            leadRepository.getLeadStats(options),
            customerRepository.getCustomerStats(options),
            dealRepository.getPipelineStats(options),
            taskRepository.getTaskStats(options)
        ]);

        return {
            leads: leadStats,
            customers: customerStats,
            deals: dealStats,
            tasks: taskStats,
            recentActivities: await this.getRecentActivities(options),
            upcomingTasks: await taskRepository.getTasksForToday(options),
            revenueForecast: await dealRepository.getRevenueForecast(options)
        };
    }

    /**
     * Get pipeline data
     * @param {object} options - Additional options
     * @returns {object} Pipeline data
     */
    async getPipelineData(options = {}) {
        const pipelines = dealRepository.getPipelines();
        const pipelineData = {};

        for (const pipeline of pipelines) {
            const deals = await dealRepository.getDealsByPipeline(pipeline.id, options);
            const stages = pipeline.stages.map(stage => ({
                ...stage,
                deals: deals.filter(d => d.stageId === stage.id),
                count: deals.filter(d => d.stageId === stage.id).length,
                value: deals.filter(d => d.stageId === stage.id).reduce((sum, d) => sum + (d.value || 0), 0)
            }));

            pipelineData[pipeline.id] = {
                ...pipeline,
                stages: stages,
                totalDeals: deals.length,
                totalValue: deals.reduce((sum, d) => sum + (d.value || 0), 0)
            };
        }

        return pipelineData;
    }

    /**
     * Get recent activities
     * @param {object} options - Additional options
     * @returns {Array} Recent activities
     */
    async getRecentActivities(options = {}) {
        // In production, this would fetch from activity service
        // For MVP, return empty array
        return [];
    }

    /**
     * Get CRM statistics
     * @param {object} options - Additional options
     * @returns {object} CRM statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            leads: await leadRepository.getLeadStats(options),
            customers: await customerRepository.getCustomerStats(options),
            deals: await dealRepository.getPipelineStats(options),
            tasks: await taskRepository.getTaskStats(options),
            module: {
                initialized: this.initialized,
                version: '1.0.0'
            }
        };
    }

    /**
     * Cleanup module resources
     */
    cleanup() {
        // Unsubscribe from events
        for (const subscription of this.subscriptions) {
            if (typeof subscription === 'function') {
                subscription();
            }
        }
        this.subscriptions = [];
        
        this.initialized = false;
        logger.info('CRM module cleaned up');
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[CRM] Debug mode enabled');
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
export const crmModule = new CRMModule();

// Export class for testing
export default CRMModule;
