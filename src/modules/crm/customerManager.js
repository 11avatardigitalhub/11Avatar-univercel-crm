/**
 * ==========================================
 * FILE: customerManager.js
 * MODULE: CRM Module
 * CODE: CRM-3
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Customer management operations for the CRM module.
 * Handles customer lifecycle, relationship management,
 * and customer 360 operations.
 * 
 * DEPENDENCIES:
 * - customerRepository.js (for data access)
 * - dealRepository.js (for deal operations)
 * - invoiceRepository.js (for invoice operations)
 * - taskRepository.js (for task creation)
 * - eventBus.js (for events)
 * 
 * FUNCTIONS:
 * - bulkImport(customers): Bulk import customers
 * - bulkUpdate(updates): Bulk update customers
 * - addNote(id, note): Add note to customer
 * - addTag(id, tag): Add tag to customer
 * - removeTag(id, tag): Remove tag from customer
 * - getCustomerJourney(id): Get customer journey
 * - getCustomerInsights(id): Get AI insights
 * - getRelationshipMap(id): Get relationship map
 * - calculateCLV(id): Calculate customer lifetime value
 * - getChurnRisk(id): Get churn risk assessment
 * - getUpsellOpportunities(id): Get upsell opportunities
 * - getCustomerTimeline(id): Get customer timeline
 * - archiveCustomer(id): Archive customer
 * - restoreCustomer(id): Restore archived customer
 * - getCustomersBySegment(segment): Get customers by segment
 * - getCustomerEngagement(id): Get engagement metrics
 * - getSatisfactionScore(id): Get satisfaction score
 * 
 * USAGE EXAMPLE:
 * import { customerManager } from './modules/crm/customerManager.js';
 * 
 * // Get customer journey
 * const journey = await customerManager.getCustomerJourney('cust_123');
 * 
 * // Calculate customer lifetime value
 * const clv = await customerManager.calculateCLV('cust_123');
 * 
 * // Get upsell opportunities
 * const opportunities = await customerManager.getUpsellOpportunities('cust_123');
 * ==========================================
 */

import { customerRepository } from '../../layers/data/repositories/customerRepository.js';
import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { invoiceRepository } from '../../layers/data/repositories/invoiceRepository.js';
import { taskRepository } from '../../layers/data/repositories/taskRepository.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

class CustomerManager {
    constructor() {
        // Configuration
        this.config = {
            clvCalculationMethod: 'historical',
            churnRiskDays: 90,
            satisfactionTracking: true,
            upsellThreshold: 0.3,
            engagementWeight: 0.4,
            retentionWeight: 0.6
        };
        
        // Cache for customer data
        this.customerCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Bulk import customers
     * @param {Array} customers - Array of customer data
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async bulkImport(customers, options = {}) {
        if (!customers || customers.length === 0) {
            throw new Error('No customers to import');
        }

        const results = {
            total: customers.length,
            imported: 0,
            failed: 0,
            errors: []
        };

        for (const customerData of customers) {
            try {
                // Check for duplicates by phone/email
                let duplicate = null;
                if (customerData.phone) {
                    duplicate = await customerRepository.findByPhone(customerData.phone);
                }
                if (!duplicate && customerData.email) {
                    duplicate = await customerRepository.findByEmail(customerData.email);
                }

                if (duplicate && !options.ignoreDuplicates) {
                    results.failed++;
                    results.errors.push({
                        data: customerData,
                        error: 'Duplicate customer found'
                    });
                    continue;
                }

                await customerRepository.create(customerData, {
                    userId: options.userId || 'system'
                });
                results.imported++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    data: customerData,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk customer import: ${results.imported} imported, ${results.failed} failed`);
        return results;
    }

    /**
     * Bulk update customers
     * @param {Array} updates - Array of {id, data} objects
     * @param {object} options - Additional options
     * @returns {object} Update results
     */
    async bulkUpdate(updates, options = {}) {
        if (!updates || updates.length === 0) {
            throw new Error('No updates to apply');
        }

        const results = {
            total: updates.length,
            updated: 0,
            failed: 0,
            errors: []
        };

        for (const update of updates) {
            try {
                await customerRepository.update(update.id, update.data, {
                    userId: options.userId || 'system'
                });
                results.updated++;
                this.invalidateCache(update.id);
            } catch (error) {
                results.failed++;
                results.errors.push({
                    id: update.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Add note to customer
     * @param {string} id - Customer ID
     * @param {string} note - Note content
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async addNote(id, note, options = {}) {
        const customer = await customerRepository.addNote(id, note, {
            userId: options.userId || 'system'
        });
        this.invalidateCache(id);
        return customer;
    }

    /**
     * Add tag to customer
     * @param {string} id - Customer ID
     * @param {string} tag - Tag name
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async addTag(id, tag, options = {}) {
        const customer = await customerRepository.addTag(id, tag, {
            userId: options.userId || 'system'
        });
        this.invalidateCache(id);
        return customer;
    }

    /**
     * Remove tag from customer
     * @param {string} id - Customer ID
     * @param {string} tag - Tag name
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async removeTag(id, tag, options = {}) {
        const customer = await customerRepository.removeTag(id, tag, {
            userId: options.userId || 'system'
        });
        this.invalidateCache(id);
        return customer;
    }

    /**
     * Get customer journey
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object} Customer journey
     */
    async getCustomerJourney(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const [deals, invoices, tasks] = await Promise.all([
            dealRepository.getDealsByCustomer(id, options),
            invoiceRepository.getInvoicesByCustomer(id, options),
            taskRepository.findAll({ relatedType: 'customer', relatedId: id }, options)
        ]);

        // Build journey timeline
        const journey = {
            customer: customer,
            timeline: this.buildTimeline(customer, deals, invoices, tasks),
            milestones: this.identifyMilestones(customer, deals, invoices),
            currentStage: this.determineCurrentStage(customer, deals),
            value: this.calculateCustomerValue(deals, invoices),
            engagement: this.calculateEngagement(customer, tasks)
        };

        return journey;
    }

    /**
     * Build customer timeline
     * @param {object} customer - Customer object
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @param {Array} tasks - Tasks list
     * @returns {Array} Timeline events
     */
    buildTimeline(customer, deals, invoices, tasks) {
        const events = [];

        // Customer creation
        events.push({
            type: 'customer_created',
            date: customer.createdAt,
            description: `Customer ${customer.name} was created`
        });

        // Deals
        for (const deal of deals) {
            events.push({
                type: 'deal_created',
                date: deal.createdAt,
                description: `Deal "${deal.title}" created (₹${deal.value})`
            });
            if (deal.status === 'won') {
                events.push({
                    type: 'deal_won',
                    date: deal.actualClose || deal.updatedAt,
                    description: `Deal "${deal.title}" won (₹${deal.value})`
                });
            }
        }

        // Invoices
        for (const invoice of invoices) {
            events.push({
                type: 'invoice_created',
                date: invoice.createdAt,
                description: `Invoice ${invoice.invoiceNumber} created (₹${invoice.total})`
            });
            if (invoice.status === 'paid') {
                events.push({
                    type: 'invoice_paid',
                    date: invoice.paidAt || invoice.updatedAt,
                    description: `Invoice ${invoice.invoiceNumber} paid (₹${invoice.total})`
                });
            }
        }

        // Sort by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        return events;
    }

    /**
     * Identify customer milestones
     * @param {object} customer - Customer object
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @returns {Array} Milestones
     */
    identifyMilestones(customer, deals, invoices) {
        const milestones = [];

        // First deal
        const firstDeal = deals.find(d => d.status === 'won');
        if (firstDeal) {
            milestones.push({
                type: 'first_deal',
                date: firstDeal.actualClose || firstDeal.updatedAt,
                description: `First deal closed: ${firstDeal.title} (₹${firstDeal.value})`
            });
        }

        // First invoice
        const firstInvoice = invoices.find(i => i.status === 'paid');
        if (firstInvoice) {
            milestones.push({
                type: 'first_payment',
                date: firstInvoice.paidAt || firstInvoice.updatedAt,
                description: `First payment received: ${firstInvoice.invoiceNumber} (₹${firstInvoice.total})`
            });
        }

        // Repeat customer
        if (deals.filter(d => d.status === 'won').length >= 2) {
            milestones.push({
                type: 'repeat_customer',
                date: deals.filter(d => d.status === 'won')[1].actualClose || deals.filter(d => d.status === 'won')[1].updatedAt,
                description: 'Became a repeat customer'
            });
        }

        // High value
        const totalValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0);
        if (totalValue > 500000) {
            milestones.push({
                type: 'high_value',
                date: new Date().toISOString(),
                description: `Achieved ₹${totalValue.toLocaleString()} in total revenue`
            });
        }

        return milestones;
    }

    /**
     * Determine current stage in customer lifecycle
     * @param {object} customer - Customer object
     * @param {Array} deals - Deals list
     * @returns {string} Current stage
     */
    determineCurrentStage(customer, deals) {
        const wonDeals = deals.filter(d => d.status === 'won');
        const activeDeals = deals.filter(d => d.status === 'active');

        if (wonDeals.length === 0 && activeDeals.length === 0) {
            return 'New';
        }

        if (wonDeals.length === 0 && activeDeals.length > 0) {
            return 'In Progress';
        }

        if (wonDeals.length === 1 && wonDeals[0].value < 100000) {
            return 'Small Customer';
        }

        if (wonDeals.length > 1 && wonDeals[0].value > 500000) {
            return 'Enterprise';
        }

        return 'Growing';
    }

    /**
     * Calculate customer value
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @returns {object} Customer value
     */
    calculateCustomerValue(deals, invoices) {
        const wonDeals = deals.filter(d => d.status === 'won');
        const totalValue = wonDeals.reduce((sum, d) => sum + d.value, 0);
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        const totalPaid = paidInvoices.reduce((sum, i) => sum + i.total, 0);

        return {
            totalDealValue: totalValue,
            totalPaid: totalPaid,
            averageDealValue: wonDeals.length > 0 ? totalValue / wonDeals.length : 0,
            dealCount: wonDeals.length,
            invoiceCount: paidInvoices.length
        };
    }

    /**
     * Calculate engagement metrics
     * @param {object} customer - Customer object
     * @param {Array} tasks - Tasks list
     * @returns {object} Engagement metrics
     */
    calculateEngagement(customer, tasks) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const recentTasks = tasks.filter(t => new Date(t.createdAt) >= thirtyDaysAgo);
        const recentInteractions = customer.timeline ? 
            customer.timeline.filter(e => new Date(e.timestamp) >= thirtyDaysAgo) : [];

        return {
            score: Math.min(100, (recentTasks.length * 10) + (recentInteractions.length * 5)),
            lastInteraction: customer.updatedAt,
            interactionsIn30Days: recentInteractions.length,
            tasksIn30Days: recentTasks.length,
            isActive: recentInteractions.length > 0 || recentTasks.length > 0,
            isAtRisk: recentInteractions.length === 0 && recentTasks.length === 0
        };
    }

    /**
     * Get AI insights for customer
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object} AI insights
     */
    async getCustomerInsights(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const [deals, invoices] = await Promise.all([
            dealRepository.getDealsByCustomer(id, options),
            invoiceRepository.getInvoicesByCustomer(id, options)
        ]);

        // Calculate insights
        const insights = {
            customerId: id,
            name: customer.name,
            company: customer.company,
            lifetimeValue: this.calculateCLVFromData(deals, invoices),
            churnRisk: this.calculateChurnRisk(deals, invoices, customer),
            upselling: this.identifyUpsellOpportunities(deals, customer),
            crossSelling: this.identifyCrossSellOpportunities(deals, customer),
            recommendations: this.generateRecommendations(customer, deals, invoices)
        };

        return insights;
    }

    /**
     * Calculate Customer Lifetime Value
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {number} CLV
     */
    async calculateCLV(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const deals = await dealRepository.getDealsByCustomer(id, options);
        const invoices = await invoiceRepository.getInvoicesByCustomer(id, options);

        return this.calculateCLVFromData(deals, invoices);
    }

    /**
     * Calculate CLV from data
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @returns {number} CLV
     */
    calculateCLVFromData(deals, invoices) {
        const wonDeals = deals.filter(d => d.status === 'won');
        const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        const totalPaid = paidInvoices.reduce((sum, i) => sum + i.total, 0);

        // Simple CLV calculation
        const averageRevenuePerDeal = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;
        const averageDealsPerYear = wonDeals.length > 0 ? wonDeals.length / 1 : 0;

        // Estimated customer lifespan (simplified)
        const lifespan = Math.min(3, wonDeals.length);

        // CLV = Average Revenue per Deal × Average Deals per Year × Lifespan
        const clv = averageRevenuePerDeal * averageDealsPerYear * lifespan;

        return Math.round(clv);
    }

    /**
     * Calculate churn risk
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @param {object} customer - Customer object
     * @returns {object} Churn risk assessment
     */
    calculateChurnRisk(deals, invoices, customer) {
        const now = new Date();
        const lastPurchase = customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate) : new Date(customer.createdAt);
        const daysSinceLastPurchase = (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);

        // Factors contributing to churn risk
        let riskScore = 0;
        const factors = [];

        // Time since last purchase
        if (daysSinceLastPurchase > this.config.churnRiskDays) {
            riskScore += 40;
            factors.push(`No activity in ${Math.round(daysSinceLastPurchase)} days`);
        } else if (daysSinceLastPurchase > this.config.churnRiskDays * 0.5) {
            riskScore += 20;
            factors.push('Decreased activity');
        }

        // Invoice payment history
        const unpaidInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
        if (unpaidInvoices.length > 0) {
            riskScore += 20;
            factors.push(`${unpaidInvoices.length} unpaid invoices`);
        }

        // No active deals
        const activeDeals = deals.filter(d => d.status === 'active');
        if (activeDeals.length === 0 && daysSinceLastPurchase > 60) {
            riskScore += 20;
            factors.push('No active deals');
        }

        // Total value of deals
        const totalValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0);
        if (totalValue > 500000) {
            riskScore -= 10; // High value customers are less risky
        }

        return {
            score: Math.min(100, Math.max(0, riskScore)),
            level: riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low',
            factors: factors,
            lastActivity: customer.lastPurchaseDate || customer.createdAt,
            daysSinceLastActivity: Math.round(daysSinceLastPurchase)
        };
    }

    /**
     * Identify upsell opportunities
     * @param {Array} deals - Deals list
     * @param {object} customer - Customer object
     * @returns {Array} Upsell opportunities
     */
    identifyUpsellOpportunities(deals, customer) {
        const wonDeals = deals.filter(d => d.status === 'won');
        const opportunities = [];

        // If customer has multiple deals, they might be ready for upsell
        if (wonDeals.length >= 2) {
            const avgValue = wonDeals.reduce((sum, d) => sum + d.value, 0) / wonDeals.length;
            opportunities.push({
                type: 'upsell',
                description: `Customer may be ready for premium upgrade`,
                potentialValue: Math.round(avgValue * 1.5),
                probability: 60
            });
        }

        // If customer has high engagement
        if (customer.category === 'enterprise' || customer.tags.includes('high_value')) {
            opportunities.push({
                type: 'upsell',
                description: 'Enterprise customer - upsell additional modules',
                potentialValue: 200000,
                probability: 70
            });
        }

        // If customer has been with us for more than 6 months
        const createdAt = new Date(customer.createdAt);
        const now = new Date();
        const monthsWithUs = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsWithUs > 6) {
            opportunities.push({
                type: 'upsell',
                description: 'Long-term customer - offer annual plan',
                potentialValue: 100000,
                probability: 80
            });
        }

        return opportunities;
    }

    /**
     * Identify cross-sell opportunities
     * @param {Array} deals - Deals list
     * @param {object} customer - Customer object
     * @returns {Array} Cross-sell opportunities
     */
    identifyCrossSellOpportunities(deals, customer) {
        const opportunities = [];

        // Different industry may need different products
        if (customer.industry === 'Healthcare') {
            opportunities.push({
                type: 'cross_sell',
                description: 'Healthcare compliance module',
                potentialValue: 75000,
                probability: 50
            });
        }

        if (customer.industry === 'Education') {
            opportunities.push({
                type: 'cross_sell',
                description: 'Student management system',
                potentialValue: 50000,
                probability: 55
            });
        }

        if (customer.industry === 'Manufacturing') {
            opportunities.push({
                type: 'cross_sell',
                description: 'Inventory management module',
                potentialValue: 85000,
                probability: 45
            });
        }

        return opportunities;
    }

    /**
     * Generate recommendations
     * @param {object} customer - Customer object
     * @param {Array} deals - Deals list
     * @param {Array} invoices - Invoices list
     * @returns {Array} Recommendations
     */
    generateRecommendations(customer, deals, invoices) {
        const recommendations = [];

        // Check if customer is at risk
        const risk = this.calculateChurnRisk(deals, invoices, customer);
        if (risk.score > 60) {
            recommendations.push({
                type: 'retention',
                priority: 'high',
                action: 'Schedule a customer success call',
                description: `Customer at ${risk.level} risk of churn`
            });
        }

        // Check for upsell opportunities
        const upsells = this.identifyUpsellOpportunities(deals, customer);
        if (upsells.length > 0) {
            recommendations.push({
                type: 'upsell',
                priority: 'medium',
                action: 'Reach out with premium offer',
                description: upsells[0].description
            });
        }

        // Check if we should request a testimonial
        const wonDeals = deals.filter(d => d.status === 'won');
        if (wonDeals.length >= 2 && wonDeals[0].value > 100000) {
            recommendations.push({
                type: 'marketing',
                priority: 'low',
                action: 'Request customer testimonial',
                description: 'Satisfied customer - ask for testimonial'
            });
        }

        return recommendations;
    }

    /**
     * Get relationship map
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object} Relationship map
     */
    async getRelationshipMap(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const deals = await dealRepository.getDealsByCustomer(id, options);
        const invoices = await invoiceRepository.getInvoicesByCustomer(id, options);
        const tasks = await taskRepository.findAll({ relatedType: 'customer', relatedId: id }, options);

        // Build relationship data
        return {
            customer: {
                id: customer.id,
                name: customer.name,
                company: customer.company
            },
            deals: deals.map(d => ({
                id: d.id,
                title: d.title,
                value: d.value,
                status: d.status
            })),
            invoices: invoices.map(i => ({
                id: i.id,
                number: i.invoiceNumber,
                amount: i.total,
                status: i.status
            })),
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                assignedTo: t.assignedTo
            })),
            engagement: this.calculateEngagement(customer, tasks)
        };
    }

    /**
     * Get customer timeline
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} Customer timeline
     */
    async getCustomerTimeline(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const [deals, invoices, tasks] = await Promise.all([
            dealRepository.getDealsByCustomer(id, options),
            invoiceRepository.getInvoicesByCustomer(id, options),
            taskRepository.findAll({ relatedType: 'customer', relatedId: id }, options)
        ]);

        return this.buildTimeline(customer, deals, invoices, tasks);
    }

    /**
     * Archive customer
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async archiveCustomer(id, options = {}) {
        const customer = await customerRepository.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        await customerRepository.archive(id, {
            userId: options.userId || 'system'
        });
        this.invalidateCache(id);

        await auditLogger.log(
            options.userId || 'system',
            'customer.archived',
            'customer',
            { customerId: id, name: customer.name }
        );

        return true;
    }

    /**
     * Restore archived customer
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async restoreCustomer(id, options = {}) {
        await customerRepository.restore(id, {
            userId: options.userId || 'system'
        });
        this.invalidateCache(id);

        await auditLogger.log(
            options.userId || 'system',
            'customer.restored',
            'customer',
            { customerId: id }
        );

        return true;
    }

    /**
     * Get customers by segment
     * @param {string} segment - Segment name
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async getCustomersBySegment(segment, options = {}) {
        return await customerRepository.getCustomersByCategory(segment, options);
    }

    /**
     * Invalidate cache for a customer
     * @param {string} id - Customer ID
     */
    invalidateCache(id) {
        this.customerCache.delete(id);
        this.cacheTimestamps.delete(id);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.customerCache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[CustomerManager] Debug mode enabled');
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
export const customerManager = new CustomerManager();

// Export class for testing
export default CustomerManager;
