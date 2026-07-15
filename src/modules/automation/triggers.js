/**
 * ==========================================
 * FILE: triggers.js
 * MODULE: Automation Module
 * CODE: AUTO-4
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Trigger management system for automation workflows.
 * Handles trigger definitions, registration, evaluation,
 * and event processing.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - tenantIsolation.js (for tenant context)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize trigger system
 * - registerTrigger(definition): Register a new trigger
 * - unregisterTrigger(triggerId): Unregister a trigger
 * - getTrigger(triggerId): Get trigger by ID
 * - getTriggers(filters): Get triggers with filters
 * - updateTrigger(triggerId, data): Update a trigger
 * - deleteTrigger(triggerId): Delete a trigger
 * - evaluateTrigger(triggerId, context): Evaluate a trigger
 * - processEvent(eventType, data): Process an event
 * - getTriggerDefinitions(): Get all trigger definitions
 * - getTriggerCategories(): Get trigger categories
 * - enableTrigger(triggerId): Enable a trigger
 * - disableTrigger(triggerId): Disable a trigger
 * - getTriggerStats(triggerId): Get trigger statistics
 * - getTriggerHistory(triggerId): Get trigger history
 * - validateTrigger(triggerData): Validate trigger data
 * - createCustomTrigger(data): Create a custom trigger
 * - getTriggerConditions(triggerId): Get trigger conditions
 * - addTriggerCondition(triggerId, condition): Add a condition
 * - removeTriggerCondition(triggerId, conditionId): Remove a condition
 * 
 * USAGE EXAMPLE:
 * import { triggers } from './modules/automation/triggers.js';
 * 
 * // Initialize trigger system
 * await triggers.initialize();
 * 
 * // Register a custom trigger
 * await triggers.registerTrigger({
 *   id: 'custom_lead_score',
 *   type: 'lead.score',
 *   name: 'Lead Score Threshold',
 *   description: 'Triggered when lead score crosses threshold',
 *   category: 'lead',
 *   params: [
 *     { name: 'threshold', type: 'number', required: true }
 *   ],
 *   handler: async (context) => {
 *     return context.score >= context.threshold;
 *   }
 * });
 * 
 * // Process an event
 * await triggers.processEvent('lead.created', {
 *   leadId: 'lead_123',
 *   score: 85
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let triggerDefinitions = [];
let triggerHistory = [];
let triggerStats = new Map();
let customTriggers = [];
let idCounter = 1000;

// Trigger categories
const TRIGGER_CATEGORIES = {
    LEAD: 'lead',
    DEAL: 'deal',
    TASK: 'task',
    INVOICE: 'invoice',
    WHATSAPP: 'whatsapp',
    EMAIL: 'email',
    CUSTOMER: 'customer',
    SCHEDULE: 'schedule',
    SYSTEM: 'system',
    CUSTOM: 'custom'
};

// Trigger types (system)
const SYSTEM_TRIGGERS = [
    {
        id: 'trigger_lead_created',
        type: 'lead.created',
        name: 'Lead Created',
        description: 'Triggered when a new lead is created',
        category: TRIGGER_CATEGORIES.LEAD,
        priority: 1,
        params: [
            { name: 'source', type: 'string', required: false },
            { name: 'status', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_lead_updated',
        type: 'lead.updated',
        name: 'Lead Updated',
        description: 'Triggered when a lead is updated',
        category: TRIGGER_CATEGORIES.LEAD,
        priority: 2,
        params: [
            { name: 'field', type: 'string', required: false },
            { name: 'oldValue', type: 'string', required: false },
            { name: 'newValue', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_lead_converted',
        type: 'lead.converted',
        name: 'Lead Converted',
        description: 'Triggered when a lead is converted to customer',
        category: TRIGGER_CATEGORIES.LEAD,
        priority: 3,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_lead_score',
        type: 'lead.score',
        name: 'Lead Score Threshold',
        description: 'Triggered when lead score crosses a threshold',
        category: TRIGGER_CATEGORIES.LEAD,
        priority: 4,
        params: [
            { name: 'threshold', type: 'number', required: true },
            { name: 'operator', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_deal_won',
        type: 'deal.won',
        name: 'Deal Won',
        description: 'Triggered when a deal is marked as won',
        category: TRIGGER_CATEGORIES.DEAL,
        priority: 5,
        params: [
            { name: 'value', type: 'number', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_deal_lost',
        type: 'deal.lost',
        name: 'Deal Lost',
        description: 'Triggered when a deal is marked as lost',
        category: TRIGGER_CATEGORIES.DEAL,
        priority: 6,
        params: [
            { name: 'reason', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_deal_stage',
        type: 'deal.stage',
        name: 'Deal Stage Changed',
        description: 'Triggered when a deal stage changes',
        category: TRIGGER_CATEGORIES.DEAL,
        priority: 7,
        params: [
            { name: 'stage', type: 'string', required: true }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_task_due',
        type: 'task.due',
        name: 'Task Due',
        description: 'Triggered when a task is due',
        category: TRIGGER_CATEGORIES.TASK,
        priority: 8,
        params: [
            { name: 'daysBefore', type: 'number', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_task_completed',
        type: 'task.completed',
        name: 'Task Completed',
        description: 'Triggered when a task is completed',
        category: TRIGGER_CATEGORIES.TASK,
        priority: 9,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_invoice_created',
        type: 'invoice.created',
        name: 'Invoice Created',
        description: 'Triggered when a new invoice is created',
        category: TRIGGER_CATEGORIES.INVOICE,
        priority: 10,
        params: [
            { name: 'amount', type: 'number', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_invoice_paid',
        type: 'invoice.paid',
        name: 'Invoice Paid',
        description: 'Triggered when an invoice is paid',
        category: TRIGGER_CATEGORIES.INVOICE,
        priority: 11,
        params: [
            { name: 'amount', type: 'number', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_invoice_overdue',
        type: 'invoice.overdue',
        name: 'Invoice Overdue',
        description: 'Triggered when an invoice becomes overdue',
        category: TRIGGER_CATEGORIES.INVOICE,
        priority: 12,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_whatsapp_received',
        type: 'whatsapp.received',
        name: 'WhatsApp Message Received',
        description: 'Triggered when a WhatsApp message is received',
        category: TRIGGER_CATEGORIES.WHATSAPP,
        priority: 13,
        params: [
            { name: 'keyword', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_whatsapp_sent',
        type: 'whatsapp.sent',
        name: 'WhatsApp Message Sent',
        description: 'Triggered when a WhatsApp message is sent',
        category: TRIGGER_CATEGORIES.WHATSAPP,
        priority: 14,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_email_received',
        type: 'email.received',
        name: 'Email Received',
        description: 'Triggered when an email is received',
        category: TRIGGER_CATEGORIES.EMAIL,
        priority: 15,
        params: [
            { name: 'subject', type: 'string', required: false },
            { name: 'from', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_customer_created',
        type: 'customer.created',
        name: 'Customer Created',
        description: 'Triggered when a new customer is created',
        category: TRIGGER_CATEGORIES.CUSTOMER,
        priority: 16,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_customer_updated',
        type: 'customer.updated',
        name: 'Customer Updated',
        description: 'Triggered when a customer is updated',
        category: TRIGGER_CATEGORIES.CUSTOMER,
        priority: 17,
        params: [
            { name: 'field', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_schedule',
        type: 'schedule',
        name: 'Schedule',
        description: 'Triggered on a schedule (cron)',
        category: TRIGGER_CATEGORIES.SCHEDULE,
        priority: 18,
        params: [
            { name: 'cron', type: 'string', required: true }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_system_startup',
        type: 'system.startup',
        name: 'System Startup',
        description: 'Triggered on system startup',
        category: TRIGGER_CATEGORIES.SYSTEM,
        priority: 19,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_system_shutdown',
        type: 'system.shutdown',
        name: 'System Shutdown',
        description: 'Triggered on system shutdown',
        category: TRIGGER_CATEGORIES.SYSTEM,
        priority: 20,
        params: [],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'trigger_system_error',
        type: 'system.error',
        name: 'System Error',
        description: 'Triggered on system error',
        category: TRIGGER_CATEGORIES.SYSTEM,
        priority: 21,
        params: [
            { name: 'level', type: 'string', required: false }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString()
    }
];

class Triggers {
    constructor() {
        // Service state
        this.initialized = false;
        this.eventListeners = new Map();
        this.activeTriggers = new Map();
        this.handlerCache = new Map();
        
        // Configuration
        this.config = {
            maxTriggersPerTenant: 50,
            maxConditionsPerTrigger: 10,
            enableCustomTriggers: true,
            enableTriggerHistory: true,
            maxHistoryPerTrigger: 100,
            defaultTimeout: 30000, // 30 seconds
            enableAsyncProcessing: true,
            batchSize: 10
        };
        
        // Cache
        this.cache = {
            triggers: new Map(),
            categories: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalTriggers: 0,
            activeTriggers: 0,
            totalEvents: 0,
            processedEvents: 0,
            failedEvents: 0,
            byCategory: {},
            byType: {},
            triggerHits: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with system triggers
        this.initSystemTriggers();
    }

    /**
     * Initialize system triggers
     */
    initSystemTriggers() {
        for (const trigger of SYSTEM_TRIGGERS) {
            triggerDefinitions.push(trigger);
            this.cache.triggers.set(trigger.id, trigger);
            this.cacheTimestamps.set(trigger.id, Date.now());
            this.activeTriggers.set(trigger.id, trigger);
        }
    }

    /**
     * Initialize trigger system
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

            // Start schedule monitor
            this.startScheduleMonitor();

            logger.info('Trigger system initialized', {
                totalTriggers: triggerDefinitions.length,
                systemTriggers: SYSTEM_TRIGGERS.length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Trigger system initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for all system events
     */
    setupEventListeners() {
        // Get unique event types from triggers
        const eventTypes = new Set();
        for (const trigger of triggerDefinitions) {
            if (trigger.type && !trigger.type.startsWith('system.')) {
                eventTypes.add(trigger.type);
            }
        }

        // Subscribe to each event
        for (const eventType of eventTypes) {
            const subscription = eventBus.subscribe(eventType, (data) => {
                this.processEvent(eventType, data);
            });
            this.eventListeners.set(eventType, subscription);
        }

        // Listen to system events
        const systemEvents = ['system.startup', 'system.shutdown', 'system.error'];
        for (const eventType of systemEvents) {
            const subscription = eventBus.subscribe(eventType, (data) => {
                this.processEvent(eventType, data);
            });
            this.eventListeners.set(eventType, subscription);
        }

        if (this.debugMode) {
            logger.debug(`[Triggers] Event listeners setup: ${this.eventListeners.size} events`);
        }
    }

    /**
     * Start schedule monitor for cron triggers
     */
    startScheduleMonitor() {
        // Check schedules every minute
        setInterval(() => {
            if (!this.initialized) return;
            this.checkSchedules();
        }, 60000);
    }

    /**
     * Check and trigger scheduled events
     */
    async checkSchedules() {
        const now = new Date();
        const scheduleTriggers = triggerDefinitions.filter(t => 
            t.type === 'schedule' && 
            t.isActive &&
            t.cron
        );

        for (const trigger of scheduleTriggers) {
            // In production, this would check cron schedule
            // For MVP, trigger every hour
            if (now.getMinutes() === 0) {
                await this.processEvent('schedule', {
                    triggerId: trigger.id,
                    cron: trigger.cron,
                    timestamp: now.toISOString()
                });
            }
        }
    }

    /**
     * Register a new trigger
     * @param {object} definition - Trigger definition
     * @param {object} options - Additional options
     * @returns {object} Registered trigger
     */
    async registerTrigger(definition, options = {}) {
        if (!this.initialized) {
            throw new Error('Trigger system not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate definition
        this.validateTriggerDefinition(definition);

        // Check tenant limit
        const tenantTriggers = triggerDefinitions.filter(t => t.tenantId === tenantId);
        if (tenantTriggers.length >= this.config.maxTriggersPerTenant) {
            throw new Error(`Maximum triggers per tenant (${this.config.maxTriggersPerTenant}) reached`);
        }

        // Create trigger
        const trigger = {
            id: definition.id || this.generateId('trigger'),
            tenantId: tenantId,
            type: definition.type,
            name: definition.name,
            description: definition.description || '',
            category: definition.category || TRIGGER_CATEGORIES.CUSTOM,
            priority: definition.priority || 100,
            params: definition.params || [],
            conditions: definition.conditions || [],
            handler: definition.handler || null,
            isSystem: false,
            isActive: definition.isActive !== false,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            config: definition.config || {},
            metadata: definition.metadata || {}
        };

        // Store trigger
        triggerDefinitions.push(trigger);
        this.cache.triggers.set(trigger.id, trigger);
        this.cacheTimestamps.set(trigger.id, Date.now());

        if (trigger.isActive) {
            this.activeTriggers.set(trigger.id, trigger);
        }

        // Update stats
        this.stats.totalTriggers++;
        this.stats.byCategory[trigger.category] = (this.stats.byCategory[trigger.category] || 0) + 1;
        this.stats.byType[trigger.type] = (this.stats.byType[trigger.type] || 0) + 1;

        // Subscribe to event if not system
        if (!trigger.type.startsWith('system.')) {
            const subscription = eventBus.subscribe(trigger.type, (data) => {
                this.processEvent(trigger.type, data);
            });
            this.eventListeners.set(trigger.type, subscription);
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'trigger.registered',
            'automation',
            { triggerId: trigger.id, name: trigger.name, type: trigger.type }
        );

        // Emit event
        eventBus.publish('trigger.registered', {
            triggerId: trigger.id,
            name: trigger.name,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[Triggers] Trigger registered: ${trigger.id}`);
        }

        return { ...trigger };
    }

    /**
     * Unregister a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async unregisterTrigger(triggerId, options = {}) {
        const index = triggerDefinitions.findIndex(t => t.id === triggerId);
        if (index === -1) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        const trigger = triggerDefinitions[index];
        if (trigger.isSystem && !options.forceDelete) {
            throw new Error('Cannot unregister system trigger');
        }

        // Unsubscribe from event
        if (this.eventListeners.has(trigger.type)) {
            const subscription = this.eventListeners.get(trigger.type);
            if (typeof subscription === 'function') {
                subscription();
            }
            this.eventListeners.delete(trigger.type);
        }

        triggerDefinitions.splice(index, 1);
        this.cache.triggers.delete(triggerId);
        this.cacheTimestamps.delete(triggerId);
        this.activeTriggers.delete(triggerId);

        // Update stats
        this.stats.totalTriggers = Math.max(0, this.stats.totalTriggers - 1);
        this.stats.byCategory[trigger.category] = Math.max(0, (this.stats.byCategory[trigger.category] || 0) - 1);
        this.stats.byType[trigger.type] = Math.max(0, (this.stats.byType[trigger.type] || 0) - 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'trigger.unregistered',
            'automation',
            { triggerId: triggerId, name: trigger.name }
        );

        if (this.debugMode) {
            logger.debug(`[Triggers] Trigger unregistered: ${triggerId}`);
        }

        return true;
    }

    /**
     * Get trigger by ID
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {object} Trigger
     */
    async getTrigger(triggerId, options = {}) {
        // Check cache
        if (this.cache.triggers.has(triggerId)) {
            const cached = this.cache.triggers.get(triggerId);
            const timestamp = this.cacheTimestamps.get(triggerId) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.triggers.delete(triggerId);
            this.cacheTimestamps.delete(triggerId);
        }

        const trigger = triggerDefinitions.find(t => t.id === triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (trigger.tenantId && trigger.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Cache the result
        this.cache.triggers.set(triggerId, trigger);
        this.cacheTimestamps.set(triggerId, Date.now());

        return { ...trigger };
    }

    /**
     * Get triggers with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of triggers
     */
    async getTriggers(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = triggerDefinitions.filter(t => 
            !t.tenantId || t.tenantId === tenantId
        );

        // Apply filters
        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
        }

        if (filters.type) {
            results = results.filter(t => t.type === filters.type);
        }

        if (filters.isActive !== undefined) {
            results = results.filter(t => t.isActive === filters.isActive);
        }

        if (filters.isSystem !== undefined) {
            results = results.filter(t => t.isSystem === filters.isSystem);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(t =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.description.toLowerCase().includes(searchTerm) ||
                t.type.toLowerCase().includes(searchTerm)
            );
        }

        // Sort by priority
        results.sort((a, b) => a.priority - b.priority);

        // Apply pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(t => ({ ...t }));
    }

    /**
     * Update a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} data - Updated trigger data
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async updateTrigger(triggerId, data, options = {}) {
        const index = triggerDefinitions.findIndex(t => t.id === triggerId);
        if (index === -1) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        const trigger = triggerDefinitions[index];
        if (trigger.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system trigger');
        }

        // Update fields
        const oldType = trigger.type;
        if (data.name) trigger.name = data.name;
        if (data.description) trigger.description = data.description;
        if (data.category) trigger.category = data.category;
        if (data.priority) trigger.priority = data.priority;
        if (data.params) trigger.params = data.params;
        if (data.conditions) trigger.conditions = data.conditions;
        if (data.handler) trigger.handler = data.handler;
        if (data.isActive !== undefined) trigger.isActive = data.isActive;
        if (data.config) trigger.config = { ...trigger.config, ...data.config };
        if (data.metadata) trigger.metadata = { ...trigger.metadata, ...data.metadata };

        // Handle type change (event subscription)
        if (data.type && data.type !== oldType) {
            // Unsubscribe from old event
            if (this.eventListeners.has(oldType)) {
                const subscription = this.eventListeners.get(oldType);
                if (typeof subscription === 'function') {
                    subscription();
                }
                this.eventListeners.delete(oldType);
            }

            trigger.type = data.type;

            // Subscribe to new event
            if (!trigger.type.startsWith('system.')) {
                const subscription = eventBus.subscribe(trigger.type, (eventData) => {
                    this.processEvent(trigger.type, eventData);
                });
                this.eventListeners.set(trigger.type, subscription);
            }
        }

        trigger.updatedAt = new Date().toISOString();
        triggerDefinitions[index] = trigger;

        // Update caches
        this.cache.triggers.set(triggerId, trigger);
        this.cacheTimestamps.set(triggerId, Date.now());

        if (trigger.isActive) {
            this.activeTriggers.set(triggerId, trigger);
        } else {
            this.activeTriggers.delete(triggerId);
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'trigger.updated',
            'automation',
            { triggerId: triggerId, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[Triggers] Trigger updated: ${triggerId}`);
        }

        return { ...trigger };
    }

    /**
     * Delete a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTrigger(triggerId, options = {}) {
        const index = triggerDefinitions.findIndex(t => t.id === triggerId);
        if (index === -1) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        const trigger = triggerDefinitions[index];
        if (trigger.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system trigger');
        }

        // Unsubscribe from event
        if (this.eventListeners.has(trigger.type)) {
            const subscription = this.eventListeners.get(trigger.type);
            if (typeof subscription === 'function') {
                subscription();
            }
            this.eventListeners.delete(trigger.type);
        }

        triggerDefinitions.splice(index, 1);
        this.cache.triggers.delete(triggerId);
        this.cacheTimestamps.delete(triggerId);
        this.activeTriggers.delete(triggerId);

        // Update stats
        this.stats.totalTriggers = Math.max(0, this.stats.totalTriggers - 1);
        this.stats.byCategory[trigger.category] = Math.max(0, (this.stats.byCategory[trigger.category] || 0) - 1);
        this.stats.byType[trigger.type] = Math.max(0, (this.stats.byType[trigger.type] || 0) - 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'trigger.deleted',
            'automation',
            { triggerId: triggerId, name: trigger.name }
        );

        if (this.debugMode) {
            logger.debug(`[Triggers] Trigger deleted: ${triggerId}`);
        }

        return true;
    }

    /**
     * Evaluate a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} context - Evaluation context
     * @param {object} options - Additional options
     * @returns {boolean} Evaluation result
     */
    async evaluateTrigger(triggerId, context = {}, options = {}) {
        const trigger = await this.getTrigger(triggerId);
        if (!trigger) {
            return false;
        }

        if (!trigger.isActive) {
            return false;
        }

        // Check conditions
        if (trigger.conditions && trigger.conditions.length > 0) {
            for (const condition of trigger.conditions) {
                if (!this.evaluateCondition(condition, context)) {
                    return false;
                }
            }
        }

        // Execute custom handler if exists
        if (trigger.handler) {
            try {
                return await trigger.handler(context);
            } catch (error) {
                logger.error(`[Triggers] Handler error for ${triggerId}:`, error);
                return false;
            }
        }

        // Default evaluation - just check if trigger type matches event
        return true;
    }

    /**
     * Evaluate a condition
     * @param {object} condition - Condition object
     * @param {object} context - Evaluation context
     * @returns {boolean} Condition result
     */
    evaluateCondition(condition, context) {
        const { field, operator, value } = condition;
        const contextValue = this.getNestedValue(context, field);

        switch (operator) {
            case '==':
                return contextValue == value;
            case '!=':
                return contextValue != value;
            case '>':
                return contextValue > value;
            case '>=':
                return contextValue >= value;
            case '<':
                return contextValue < value;
            case '<=':
                return contextValue <= value;
            case 'contains':
                return String(contextValue).includes(String(value));
            case 'startsWith':
                return String(contextValue).startsWith(String(value));
            case 'endsWith':
                return String(contextValue).endsWith(String(value));
            case 'in':
                return Array.isArray(value) ? value.includes(contextValue) : false;
            case 'notIn':
                return Array.isArray(value) ? !value.includes(contextValue) : true;
            default:
                return false;
        }
    }

    /**
     * Get nested value from object
     * @param {object} obj - Object to traverse
     * @param {string} path - Dot notation path
     * @returns {*} Value at path
     */
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    /**
     * Process an event
     * @param {string} eventType - Event type
     * @param {object} data - Event data
     * @param {object} options - Additional options
     * @returns {Array} Triggered results
     */
    async processEvent(eventType, data = {}, options = {}) {
        if (!this.initialized) {
            return [];
        }

        this.stats.totalEvents++;

        // Get active triggers for this event type
        const matchingTriggers = triggerDefinitions.filter(t =>
            t.type === eventType &&
            t.isActive &&
            (!t.tenantId || t.tenantId === data.tenantId)
        );

        if (matchingTriggers.length === 0) {
            return [];
        }

        if (this.debugMode) {
            logger.debug(`[Triggers] Processing event: ${eventType}, triggers: ${matchingTriggers.length}`);
        }

        const results = [];

        for (const trigger of matchingTriggers) {
            try {
                // Evaluate trigger
                const triggered = await this.evaluateTrigger(trigger.id, data, options);
                
                if (triggered) {
                    // Update stats
                    this.stats.processedEvents++;
                    this.stats.triggerHits[trigger.id] = (this.stats.triggerHits[trigger.id] || 0) + 1;

                    // Record history
                    if (this.config.enableTriggerHistory) {
                        await this.recordTriggerHistory(trigger.id, eventType, data);
                    }

                    // Emit trigger event
                    eventBus.publish('trigger.fired', {
                        triggerId: trigger.id,
                        triggerType: trigger.type,
                        eventType: eventType,
                        data: data
                    });

                    results.push({
                        triggerId: trigger.id,
                        triggered: true,
                        data: data
                    });

                    if (this.debugMode) {
                        logger.debug(`[Triggers] Trigger fired: ${trigger.id}`);
                    }
                }
            } catch (error) {
                this.stats.failedEvents++;
                logger.error(`[Triggers] Error processing trigger ${trigger.id}:`, error);
                results.push({
                    triggerId: trigger.id,
                    triggered: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Record trigger history
     * @param {string} triggerId - Trigger ID
     * @param {string} eventType - Event type
     * @param {object} data - Event data
     */
    async recordTriggerHistory(triggerId, eventType, data) {
        const entry = {
            id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            triggerId: triggerId,
            eventType: eventType,
            data: data,
            timestamp: new Date().toISOString(),
            tenantId: data.tenantId || tenantIsolation.getCurrentTenant()
        };

        triggerHistory.push(entry);

        // Limit history size
        const triggerEntries = triggerHistory.filter(h => h.triggerId === triggerId);
        if (triggerEntries.length > this.config.maxHistoryPerTrigger) {
            const toRemove = triggerEntries.length - this.config.maxHistoryPerTrigger;
            const ids = triggerEntries.slice(0, toRemove).map(h => h.id);
            triggerHistory = triggerHistory.filter(h => !ids.includes(h.id));
        }
    }

    /**
     * Get trigger definitions
     * @param {object} options - Additional options
     * @returns {Array} Trigger definitions
     */
    async getTriggerDefinitions(options = {}) {
        let results = [...triggerDefinitions];

        if (options.category) {
            results = results.filter(t => t.category === options.category);
        }

        if (options.isSystem !== undefined) {
            results = results.filter(t => t.isSystem === options.isSystem);
        }

        if (options.isActive !== undefined) {
            results = results.filter(t => t.isActive === options.isActive);
        }

        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            results = results.filter(t =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.description.toLowerCase().includes(searchTerm) ||
                t.type.toLowerCase().includes(searchTerm)
            );
        }

        results.sort((a, b) => a.priority - b.priority);

        return results.map(t => ({ ...t }));
    }

    /**
     * Get trigger categories
     * @param {object} options - Additional options
     * @returns {object} Trigger categories
     */
    async getTriggerCategories(options = {}) {
        return { ...TRIGGER_CATEGORIES };
    }

    /**
     * Enable a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async enableTrigger(triggerId, options = {}) {
        return await this.updateTrigger(triggerId, { isActive: true }, options);
    }

    /**
     * Disable a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async disableTrigger(triggerId, options = {}) {
        return await this.updateTrigger(triggerId, { isActive: false }, options);
    }

    /**
     * Get trigger statistics
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {object} Trigger statistics
     */
    async getTriggerStats(triggerId, options = {}) {
        const trigger = await this.getTrigger(triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        const history = triggerHistory.filter(h => h.triggerId === triggerId);
        const totalHits = history.length;
        const lastHit = history.length > 0 ? history[history.length - 1].timestamp : null;

        return {
            triggerId: triggerId,
            name: trigger.name,
            type: trigger.type,
            totalHits: totalHits,
            lastHit: lastHit,
            isActive: trigger.isActive,
            isSystem: trigger.isSystem,
            created: trigger.createdAt
        };
    }

    /**
     * Get trigger history
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {Array} Trigger history
     */
    async getTriggerHistory(triggerId, options = {}) {
        let results = triggerHistory.filter(h => h.triggerId === triggerId);

        if (options.startDate) {
            results = results.filter(h => new Date(h.timestamp) >= new Date(options.startDate));
        }

        if (options.endDate) {
            results = results.filter(h => new Date(h.timestamp) <= new Date(options.endDate));
        }

        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const limit = options.limit || 50;
        const offset = options.offset || 0;

        return results.slice(offset, offset + limit);
    }

    /**
     * Validate trigger data
     * @param {object} triggerData - Trigger data
     * @throws {Error} If validation fails
     */
    validateTriggerDefinition(triggerData) {
        if (!triggerData.type) {
            throw new Error('Trigger type is required');
        }
        if (!triggerData.name) {
            throw new Error('Trigger name is required');
        }
        if (triggerData.priority && triggerData.priority < 0) {
            throw new Error('Priority must be positive');
        }
        if (triggerData.conditions && triggerData.conditions.length > this.config.maxConditionsPerTrigger) {
            throw new Error(`Maximum conditions per trigger (${this.config.maxConditionsPerTrigger}) exceeded`);
        }
    }

    /**
     * Create a custom trigger
     * @param {object} data - Trigger data
     * @param {object} options - Additional options
     * @returns {object} Created trigger
     */
    async createCustomTrigger(data, options = {}) {
        if (!this.config.enableCustomTriggers) {
            throw new Error('Custom triggers are disabled');
        }

        return await this.registerTrigger(data, options);
    }

    /**
     * Get trigger conditions
     * @param {string} triggerId - Trigger ID
     * @param {object} options - Additional options
     * @returns {Array} Trigger conditions
     */
    async getTriggerConditions(triggerId, options = {}) {
        const trigger = await this.getTrigger(triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        return trigger.conditions || [];
    }

    /**
     * Add a condition to a trigger
     * @param {string} triggerId - Trigger ID
     * @param {object} condition - Condition to add
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async addTriggerCondition(triggerId, condition, options = {}) {
        const trigger = await this.getTrigger(triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        if (!condition.field || !condition.operator) {
            throw new Error('Condition requires field and operator');
        }

        const conditions = [...(trigger.conditions || []), condition];
        if (conditions.length > this.config.maxConditionsPerTrigger) {
            throw new Error(`Maximum conditions per trigger (${this.config.maxConditionsPerTrigger}) exceeded`);
        }

        return await this.updateTrigger(triggerId, { conditions }, options);
    }

    /**
     * Remove a condition from a trigger
     * @param {string} triggerId - Trigger ID
     * @param {string} conditionId - Condition ID
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async removeTriggerCondition(triggerId, conditionId, options = {}) {
        const trigger = await this.getTrigger(triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }

        if (!trigger.conditions) {
            return trigger;
        }

        const conditions = trigger.conditions.filter((_, index) => index !== parseInt(conditionId));
        return await this.updateTrigger(triggerId, { conditions }, options);
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = 'trigger') {
        idCounter++;
        return `${prefix}_${idCounter}`;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Triggers] Debug mode enabled');
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
     * Cleanup resources
     */
    cleanup() {
        // Unsubscribe from all events
        for (const [eventType, subscription] of this.eventListeners) {
            if (typeof subscription === 'function') {
                subscription();
            }
        }
        this.eventListeners.clear();

        this.initialized = false;
        this.activeTriggers.clear();
        this.handlerCache.clear();
        this.cache.triggers.clear();
        this.cacheTimestamps.clear();

        logger.info('Trigger system cleaned up');
    }
}

// Create and export singleton instance
export const triggers = new Triggers();

// Export class for testing
export default Triggers;
