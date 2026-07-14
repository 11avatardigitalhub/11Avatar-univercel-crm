/**
 * ==========================================
 * FILE: subscriptionManager.js
 * MODULE: Finance Module
 * CODE: FIN-4
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Subscription management service for the CRM.
 * Handles plan management, subscription lifecycle, and recurring billing.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - billingEngine.js (for billing operations)
 * 
 * FUNCTIONS:
 * - createPlan(data): Create a new subscription plan
 * - updatePlan(id, data): Update a subscription plan
 * - deletePlan(id): Delete a subscription plan
 * - getPlan(id): Get plan by ID
 * - getPlans(filters): Get all plans with filters
 * - createSubscription(data): Create a new subscription
 * - getSubscription(id): Get subscription by ID
 * - updateSubscription(id, data): Update a subscription
 * - cancelSubscription(id): Cancel a subscription
 * - pauseSubscription(id): Pause a subscription
 * - resumeSubscription(id): Resume a paused subscription
 * - getSubscriptions(filters): Get subscriptions with filters
 * - getSubscriptionsByCustomer(customerId): Get subscriptions by customer
 * - getActiveSubscriptions(): Get all active subscriptions
 * - getExpiringSubscriptions(days): Get expiring subscriptions
 * - getSubscriptionStats(): Get subscription statistics
 * - upgradeSubscription(id, newPlanId): Upgrade a subscription
 * - downgradeSubscription(id, newPlanId): Downgrade a subscription
 * - processRenewals(): Process due renewals
 * 
 * USAGE EXAMPLE:
 * import { subscriptionManager } from './modules/finance/subscriptionManager.js';
 * 
 * // Create a subscription plan
 * const plan = await subscriptionManager.createPlan({
 *   name: 'Pro Plan',
 *   price: 999,
 *   billingCycle: 'monthly',
 *   features: ['Unlimited Leads', 'WhatsApp Integration', 'AI Scoring']
 * });
 * 
 * // Create a subscription
 * const subscription = await subscriptionManager.createSubscription({
 *   customerId: 'cust_123',
 *   planId: 'plan_456',
 *   startDate: new Date().toISOString()
 * });
 * 
 * // Upgrade subscription
 * await subscriptionManager.upgradeSubscription('sub_789', 'plan_new');
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let plans = [];
let subscriptions = [];
let planIdCounter = 1000;
let subscriptionIdCounter = 1000;

// Default plans
const DEFAULT_PLANS = [
    {
        id: 'plan_free',
        name: 'Free',
        description: 'Free plan for small businesses',
        price: 0,
        billingCycle: 'monthly',
        features: ['100 Leads', '5 Users', 'Basic Reports'],
        limits: {
            maxLeads: 100,
            maxUsers: 5,
            maxStorage: '1GB'
        },
        isDefault: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'plan_starter',
        name: 'Starter',
        description: 'Starter plan for growing businesses',
        price: 499,
        billingCycle: 'monthly',
        features: ['1000 Leads', '20 Users', 'Advanced Reports', 'WhatsApp Integration'],
        limits: {
            maxLeads: 1000,
            maxUsers: 20,
            maxStorage: '5GB'
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'plan_growth',
        name: 'Growth',
        description: 'Growth plan for scaling businesses',
        price: 999,
        billingCycle: 'monthly',
        features: ['5000 Leads', '50 Users', 'Advanced AI', 'Field Force Tracking'],
        limits: {
            maxLeads: 5000,
            maxUsers: 50,
            maxStorage: '20GB'
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'plan_pro',
        name: 'Pro',
        description: 'Professional plan for enterprises',
        price: 1999,
        billingCycle: 'monthly',
        features: ['Unlimited Leads', 'Unlimited Users', 'All Features', 'Priority Support'],
        limits: {
            maxLeads: Infinity,
            maxUsers: Infinity,
            maxStorage: '50GB'
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

class SubscriptionManager {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            defaultBillingCycle: 'monthly',
            trialPeriodDays: 14,
            autoRenew: true,
            gracePeriodDays: 7,
            maxRetries: 3,
            retryDelay: 86400000 // 1 day
        };
        
        // Cache
        this.cache = {
            plans: new Map(),
            subscriptions: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = {
            plans: new Map(),
            subscriptions: new Map()
        };
        
        // Statistics
        this.stats = {
            totalPlans: 0,
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            pausedSubscriptions: 0,
            cancelledSubscriptions: 0,
            expiredSubscriptions: 0,
            byPlan: {},
            revenue: {
                monthly: 0,
                yearly: 0,
                total: 0
            }
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with default plans
        this.initDefaultPlans();
    }

    /**
     * Initialize subscription manager
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

            // Update stats
            this.updateStats();

            logger.info('Subscription manager initialized', {
                plans: plans.length,
                defaultPlan: this.getDefaultPlan()?.name
            });

            this.initialized = true;
            
            // Start renewal processor
            this.startRenewalProcessor();
            
            return true;
        } catch (error) {
            logger.error('Subscription manager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize default plans
     */
    initDefaultPlans() {
        for (const plan of DEFAULT_PLANS) {
            plans.push({ ...plan });
            this.cache.plans.set(plan.id, { ...plan });
            this.cacheTimestamps.plans.set(plan.id, Date.now());
        }
        planIdCounter = 1000 + DEFAULT_PLANS.length;
    }

    /**
     * Create a new subscription plan
     * @param {object} data - Plan data
     * @param {object} options - Additional options
     * @returns {object} Created plan
     */
    async createPlan(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Subscription manager not initialized');
        }

        // Validate data
        this.validatePlanData(data);

        // Create plan
        const plan = {
            id: this.generatePlanId(),
            name: data.name,
            description: data.description || '',
            price: data.price || 0,
            billingCycle: data.billingCycle || this.config.defaultBillingCycle,
            features: data.features || [],
            limits: data.limits || {},
            isDefault: data.isDefault || false,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // If this is default, unset other defaults
        if (plan.isDefault) {
            for (const existing of plans) {
                if (existing.isDefault) {
                    existing.isDefault = false;
                    existing.updatedAt = new Date().toISOString();
                }
            }
        }

        // Store plan
        plans.push(plan);
        this.cache.plans.set(plan.id, { ...plan });
        this.cacheTimestamps.plans.set(plan.id, Date.now());

        // Update stats
        this.stats.totalPlans++;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'subscription.plan.created',
            'finance',
            { planId: plan.id, name: plan.name, price: plan.price }
        );

        // Emit event
        eventBus.publish('subscription.plan.created', {
            planId: plan.id,
            name: plan.name,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Plan created: ${plan.name}`);
        }

        return { ...plan };
    }

    /**
     * Update a subscription plan
     * @param {string} id - Plan ID
     * @param {object} data - Updated plan data
     * @param {object} options - Additional options
     * @returns {object} Updated plan
     */
    async updatePlan(id, data, options = {}) {
        const index = plans.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error(`Plan ${id} not found`);
        }

        const plan = plans[index];

        // Update fields
        if (data.name) plan.name = data.name;
        if (data.description !== undefined) plan.description = data.description;
        if (data.price !== undefined) plan.price = data.price;
        if (data.billingCycle) plan.billingCycle = data.billingCycle;
        if (data.features) plan.features = data.features;
        if (data.limits) plan.limits = data.limits;
        if (data.isDefault !== undefined) {
            if (data.isDefault) {
                // Unset other defaults
                for (const existing of plans) {
                    if (existing.id !== id && existing.isDefault) {
                        existing.isDefault = false;
                        existing.updatedAt = new Date().toISOString();
                    }
                }
            }
            plan.isDefault = data.isDefault;
        }
        if (data.isActive !== undefined) plan.isActive = data.isActive;

        plan.updatedAt = new Date().toISOString();
        plans[index] = plan;

        // Update cache
        this.cache.plans.set(id, { ...plan });
        this.cacheTimestamps.plans.set(id, Date.now());

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'subscription.plan.updated',
            'finance',
            { planId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Plan updated: ${plan.name}`);
        }

        return { ...plan };
    }

    /**
     * Delete a subscription plan
     * @param {string} id - Plan ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deletePlan(id, options = {}) {
        const index = plans.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error(`Plan ${id} not found`);
        }

        const plan = plans[index];

        // Check if plan has active subscriptions
        const activeSubs = subscriptions.filter(s => s.planId === id && s.status === 'active');
        if (activeSubs.length > 0 && !options.forceDelete) {
            throw new Error(`Plan has ${activeSubs.length} active subscriptions`);
        }

        // Remove plan
        plans.splice(index, 1);
        this.cache.plans.delete(id);
        this.cacheTimestamps.plans.delete(id);

        // Update stats
        this.stats.totalPlans = Math.max(0, this.stats.totalPlans - 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'subscription.plan.deleted',
            'finance',
            { planId: id, name: plan.name }
        );

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Plan deleted: ${plan.name}`);
        }

        return true;
    }

    /**
     * Get plan by ID
     * @param {string} id - Plan ID
     * @param {object} options - Additional options
     * @returns {object} Plan
     */
    async getPlan(id, options = {}) {
        // Check cache
        if (this.cache.plans.has(id)) {
            const cached = this.cache.plans.get(id);
            const timestamp = this.cacheTimestamps.plans.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.plans.delete(id);
            this.cacheTimestamps.plans.delete(id);
        }

        const plan = plans.find(p => p.id === id);
        if (!plan) {
            throw new Error(`Plan ${id} not found`);
        }

        // Cache result
        this.cache.plans.set(id, { ...plan });
        this.cacheTimestamps.plans.set(id, Date.now());

        return { ...plan };
    }

    /**
     * Get all plans with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of plans
     */
    async getPlans(filters = {}, options = {}) {
        let results = [...plans];

        if (filters.isActive !== undefined) {
            results = results.filter(p => p.isActive === filters.isActive);
        }

        if (filters.isDefault) {
            results = results.filter(p => p.isDefault === filters.isDefault);
        }

        if (filters.billingCycle) {
            results = results.filter(p => p.billingCycle === filters.billingCycle);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm)
            );
        }

        // Sort by price
        results.sort((a, b) => a.price - b.price);

        return results.map(p => ({ ...p }));
    }

    /**
     * Get default plan
     * @param {object} options - Additional options
     * @returns {object|null} Default plan
     */
    getDefaultPlan(options = {}) {
        return plans.find(p => p.isDefault) || null;
    }

    /**
     * Create a new subscription
     * @param {object} data - Subscription data
     * @param {object} options - Additional options
     * @returns {object} Created subscription
     */
    async createSubscription(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Subscription manager not initialized');
        }

        // Validate data
        if (!data.customerId) {
            throw new Error('Customer ID is required');
        }
        if (!data.planId) {
            throw new Error('Plan ID is required');
        }

        // Get plan
        const plan = await this.getPlan(data.planId);
        if (!plan || !plan.isActive) {
            throw new Error(`Plan ${data.planId} is not available`);
        }

        // Check if customer already has active subscription
        const existing = subscriptions.find(s => 
            s.customerId === data.customerId && 
            s.status === 'active'
        );
        if (existing && !options.allowMultiple) {
            throw new Error(`Customer already has an active subscription`);
        }

        // Calculate trial period if applicable
        let trialEnd = null;
        if (plan.price > 0 && this.config.trialPeriodDays > 0) {
            trialEnd = new Date(Date.now() + this.config.trialPeriodDays * 24 * 60 * 60 * 1000).toISOString();
        }

        // Create subscription
        const subscription = {
            id: this.generateSubscriptionId(),
            customerId: data.customerId,
            planId: data.planId,
            status: 'active',
            startDate: data.startDate || new Date().toISOString(),
            trialEnd: data.trialEnd || trialEnd,
            nextBillingDate: this.calculateNextBillingDate(data.startDate, plan.billingCycle),
            billingCycle: plan.billingCycle,
            price: plan.price,
            features: plan.features,
            limits: plan.limits,
            autoRenew: data.autoRenew !== undefined ? data.autoRenew : this.config.autoRenew,
            paymentMethod: data.paymentMethod || null,
            paymentDetails: data.paymentDetails || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store subscription
        subscriptions.push(subscription);
        this.cache.subscriptions.set(subscription.id, { ...subscription });
        this.cacheTimestamps.subscriptions.set(subscription.id, Date.now());

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'subscription.created',
            'finance',
            { subscriptionId: subscription.id, planId: data.planId, customerId: data.customerId }
        );

        // Emit event
        eventBus.publish('subscription.created', {
            subscriptionId: subscription.id,
            customerId: data.customerId,
            planId: data.planId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription created: ${subscription.id}`);
        }

        return { ...subscription };
    }

    /**
     * Get subscription by ID
     * @param {string} id - Subscription ID
     * @param {object} options - Additional options
     * @returns {object} Subscription
     */
    async getSubscription(id, options = {}) {
        // Check cache
        if (this.cache.subscriptions.has(id)) {
            const cached = this.cache.subscriptions.get(id);
            const timestamp = this.cacheTimestamps.subscriptions.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.subscriptions.delete(id);
            this.cacheTimestamps.subscriptions.delete(id);
        }

        const subscription = subscriptions.find(s => s.id === id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        // Cache result
        this.cache.subscriptions.set(id, { ...subscription });
        this.cacheTimestamps.subscriptions.set(id, Date.now());

        return { ...subscription };
    }

    /**
     * Update a subscription
     * @param {string} id - Subscription ID
     * @param {object} data - Updated subscription data
     * @param {object} options - Additional options
     * @returns {object} Updated subscription
     */
    async updateSubscription(id, data, options = {}) {
        const index = subscriptions.findIndex(s => s.id === id);
        if (index === -1) {
            throw new Error(`Subscription ${id} not found`);
        }

        const subscription = subscriptions[index];

        // Check if subscription can be updated
        if (subscription.status === 'cancelled' && !options.forceUpdate) {
            throw new Error('Cannot update a cancelled subscription');
        }

        // Update fields
        if (data.planId) {
            const plan = await this.getPlan(data.planId);
            if (!plan || !plan.isActive) {
                throw new Error(`Plan ${data.planId} is not available`);
            }
            subscription.planId = data.planId;
            subscription.price = plan.price;
            subscription.features = plan.features;
            subscription.limits = plan.limits;
        }
        if (data.status) {
            subscription.status = data.status;
        }
        if (data.paymentMethod) {
            subscription.paymentMethod = data.paymentMethod;
        }
        if (data.paymentDetails) {
            subscription.paymentDetails = data.paymentDetails;
        }
        if (data.autoRenew !== undefined) {
            subscription.autoRenew = data.autoRenew;
        }

        subscription.updatedAt = new Date().toISOString();
        subscriptions[index] = subscription;

        // Update cache
        this.cache.subscriptions.set(id, { ...subscription });
        this.cacheTimestamps.subscriptions.set(id, Date.now());

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'subscription.updated',
            'finance',
            { subscriptionId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription updated: ${id}`);
        }

        return { ...subscription };
    }

    /**
     * Cancel a subscription
     * @param {string} id - Subscription ID
     * @param {object} options - Additional options
     * @returns {object} Cancelled subscription
     */
    async cancelSubscription(id, options = {}) {
        const subscription = await this.getSubscription(id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        if (subscription.status === 'cancelled') {
            return subscription;
        }

        const updated = await this.updateSubscription(id, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        }, { forceUpdate: true });

        // Emit event
        eventBus.publish('subscription.cancelled', {
            subscriptionId: id,
            customerId: updated.customerId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription cancelled: ${id}`);
        }

        return updated;
    }

    /**
     * Pause a subscription
     * @param {string} id - Subscription ID
     * @param {object} options - Additional options
     * @returns {object} Paused subscription
     */
    async pauseSubscription(id, options = {}) {
        const subscription = await this.getSubscription(id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        if (subscription.status !== 'active') {
            throw new Error(`Subscription ${id} is not active`);
        }

        const updated = await this.updateSubscription(id, {
            status: 'paused',
            pausedAt: new Date().toISOString()
        }, { forceUpdate: true });

        // Emit event
        eventBus.publish('subscription.paused', {
            subscriptionId: id,
            customerId: updated.customerId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription paused: ${id}`);
        }

        return updated;
    }

    /**
     * Resume a paused subscription
     * @param {string} id - Subscription ID
     * @param {object} options - Additional options
     * @returns {object} Resumed subscription
     */
    async resumeSubscription(id, options = {}) {
        const subscription = await this.getSubscription(id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        if (subscription.status !== 'paused') {
            throw new Error(`Subscription ${id} is not paused`);
        }

        const updated = await this.updateSubscription(id, {
            status: 'active',
            resumedAt: new Date().toISOString()
        }, { forceUpdate: true });

        // Emit event
        eventBus.publish('subscription.resumed', {
            subscriptionId: id,
            customerId: updated.customerId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription resumed: ${id}`);
        }

        return updated;
    }

    /**
     * Get subscriptions with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of subscriptions
     */
    async getSubscriptions(filters = {}, options = {}) {
        let results = [...subscriptions];

        if (filters.customerId) {
            results = results.filter(s => s.customerId === filters.customerId);
        }

        if (filters.planId) {
            results = results.filter(s => s.planId === filters.planId);
        }

        if (filters.status) {
            results = results.filter(s => s.status === filters.status);
        }

        if (filters.startDate) {
            results = results.filter(s => new Date(s.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(s => new Date(s.createdAt) <= new Date(filters.endDate));
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'startDate' || sortBy === 'nextBillingDate') {
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
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(s => ({ ...s }));
    }

    /**
     * Get subscriptions by customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} List of subscriptions
     */
    async getSubscriptionsByCustomer(customerId, options = {}) {
        return await this.getSubscriptions({ customerId }, options);
    }

    /**
     * Get all active subscriptions
     * @param {object} options - Additional options
     * @returns {Array} List of active subscriptions
     */
    async getActiveSubscriptions(options = {}) {
        return await this.getSubscriptions({ status: 'active' }, options);
    }

    /**
     * Get expiring subscriptions
     * @param {number} days - Days to check
     * @param {object} options - Additional options
     * @returns {Array} List of expiring subscriptions
     */
    async getExpiringSubscriptions(days = 7, options = {}) {
        const active = await this.getActiveSubscriptions(options);
        const now = new Date();
        const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        return active.filter(s => {
            if (!s.nextBillingDate) return false;
            const nextBilling = new Date(s.nextBillingDate);
            return nextBilling <= expiryDate && nextBilling > now;
        });
    }

    /**
     * Get subscription statistics
     * @param {object} options - Additional options
     * @returns {object} Subscription statistics
     */
    async getSubscriptionStats(options = {}) {
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * Upgrade a subscription to a new plan
     * @param {string} id - Subscription ID
     * @param {string} newPlanId - New plan ID
     * @param {object} options - Additional options
     * @returns {object} Updated subscription
     */
    async upgradeSubscription(id, newPlanId, options = {}) {
        const subscription = await this.getSubscription(id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        const plan = await this.getPlan(newPlanId);
        if (!plan || !plan.isActive) {
            throw new Error(`Plan ${newPlanId} is not available`);
        }

        // Check if new plan is higher tier
        if (plan.price <= subscription.price && !options.forceUpgrade) {
            throw new Error('New plan must be higher tier. Use downgrade for lower tier.');
        }

        const updated = await this.updateSubscription(id, {
            planId: newPlanId
        }, { forceUpdate: true });

        // Emit event
        eventBus.publish('subscription.upgraded', {
            subscriptionId: id,
            oldPlanId: subscription.planId,
            newPlanId: newPlanId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription upgraded: ${id}`);
        }

        return updated;
    }

    /**
     * Downgrade a subscription to a new plan
     * @param {string} id - Subscription ID
     * @param {string} newPlanId - New plan ID
     * @param {object} options - Additional options
     * @returns {object} Updated subscription
     */
    async downgradeSubscription(id, newPlanId, options = {}) {
        const subscription = await this.getSubscription(id);
        if (!subscription) {
            throw new Error(`Subscription ${id} not found`);
        }

        const plan = await this.getPlan(newPlanId);
        if (!plan || !plan.isActive) {
            throw new Error(`Plan ${newPlanId} is not available`);
        }

        // Check if new plan is lower tier
        if (plan.price >= subscription.price && !options.forceDowngrade) {
            throw new Error('New plan must be lower tier. Use upgrade for higher tier.');
        }

        const updated = await this.updateSubscription(id, {
            planId: newPlanId
        }, { forceUpdate: true });

        // Emit event
        eventBus.publish('subscription.downgraded', {
            subscriptionId: id,
            oldPlanId: subscription.planId,
            newPlanId: newPlanId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[SubscriptionManager] Subscription downgraded: ${id}`);
        }

        return updated;
    }

    /**
     * Process due renewals
     * @param {object} options - Additional options
     * @returns {Array} Processed renewals
     */
    async processRenewals(options = {}) {
        const now = new Date();
        const dueSubscriptions = subscriptions.filter(s => 
            s.status === 'active' &&
            s.autoRenew &&
            s.nextBillingDate &&
            new Date(s.nextBillingDate) <= now
        );

        const results = [];
        for (const sub of dueSubscriptions) {
            try {
                // In production, this would process payment
                // For MVP, simulate renewal
                const newBillingDate = this.calculateNextBillingDate(now, sub.billingCycle);
                
                const updated = await this.updateSubscription(sub.id, {
                    nextBillingDate: newBillingDate
                }, { forceUpdate: true });

                results.push({
                    subscriptionId: sub.id,
                    status: 'renewed',
                    nextBillingDate: newBillingDate
                });

                // Emit event
                eventBus.publish('subscription.renewed', {
                    subscriptionId: sub.id,
                    userId: options.userId || 'system'
                });

            } catch (error) {
                results.push({
                    subscriptionId: sub.id,
                    status: 'failed',
                    error: error.message
                });
                logger.error(`[SubscriptionManager] Renewal failed for ${sub.id}:`, error);
            }
        }

        return results;
    }

    /**
     * Start renewal processor
     */
    startRenewalProcessor() {
        setInterval(() => {
            if (this.initialized) {
                this.processRenewals().catch(error => {
                    logger.error('[SubscriptionManager] Renewal processor error:', error);
                });
            }
        }, 3600000); // Check every hour
    }

    /**
     * Calculate next billing date
     * @param {string|Date} startDate - Start date
     * @param {string} billingCycle - Billing cycle (monthly, yearly)
     * @returns {string} Next billing date
     */
    calculateNextBillingDate(startDate, billingCycle) {
        const date = new Date(startDate);
        if (billingCycle === 'monthly') {
            date.setMonth(date.getMonth() + 1);
        } else if (billingCycle === 'yearly') {
            date.setFullYear(date.getFullYear() + 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        return date.toISOString();
    }

    /**
     * Validate plan data
     * @param {object} data - Plan data
     * @throws {Error} If validation fails
     */
    validatePlanData(data) {
        if (!data.name) {
            throw new Error('Plan name is required');
        }
        if (data.price !== undefined && data.price < 0) {
            throw new Error('Price cannot be negative');
        }
        if (data.billingCycle && !['monthly', 'yearly', 'weekly'].includes(data.billingCycle)) {
            throw new Error('Invalid billing cycle');
        }
    }

    /**
     * Update statistics
     */
    updateStats() {
        const total = subscriptions.length;
        const active = subscriptions.filter(s => s.status === 'active').length;
        const paused = subscriptions.filter(s => s.status === 'paused').length;
        const cancelled = subscriptions.filter(s => s.status === 'cancelled').length;
        const expired = subscriptions.filter(s => s.status === 'expired').length;

        this.stats.totalSubscriptions = total;
        this.stats.activeSubscriptions = active;
        this.stats.pausedSubscriptions = paused;
        this.stats.cancelledSubscriptions = cancelled;
        this.stats.expiredSubscriptions = expired;

        // By plan
        this.stats.byPlan = {};
        for (const sub of subscriptions) {
            this.stats.byPlan[sub.planId] = (this.stats.byPlan[sub.planId] || 0) + 1;
        }

        // Revenue
        let monthlyRevenue = 0;
        let yearlyRevenue = 0;
        let totalRevenue = 0;
        for (const sub of subscriptions) {
            if (sub.status === 'active') {
                if (sub.billingCycle === 'monthly') {
                    monthlyRevenue += sub.price;
                } else if (sub.billingCycle === 'yearly') {
                    yearlyRevenue += sub.price / 12;
                }
                totalRevenue += sub.price;
            }
        }
        this.stats.revenue.monthly = monthlyRevenue;
        this.stats.revenue.yearly = yearlyRevenue;
        this.stats.revenue.total = totalRevenue;
    }

    /**
     * Generate plan ID
     * @returns {string} Plan ID
     */
    generatePlanId() {
        planIdCounter++;
        return 'plan_' + planIdCounter;
    }

    /**
     * Generate subscription ID
     * @returns {string} Subscription ID
     */
    generateSubscriptionId() {
        subscriptionIdCounter++;
        return 'sub_' + subscriptionIdCounter;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[SubscriptionManager] Debug mode enabled');
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
     * Cleanup service resources
     */
    cleanup() {
        this.initialized = false;
        this.cache.plans.clear();
        this.cache.subscriptions.clear();
        this.cacheTimestamps.plans.clear();
        this.cacheTimestamps.subscriptions.clear();
        logger.info('Subscription manager cleaned up');
    }
}

// Create and export singleton instance
export const subscriptionManager = new SubscriptionManager();

// Export class for testing
export default SubscriptionManager;
