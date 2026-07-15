/**
 * ==========================================
 * FILE: actions.js
 * MODULE: Automation Module
 * CODE: AUTO-5
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Action management system for automation workflows.
 * Handles action definitions, registration, execution,
 * and result handling.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - tenantIsolation.js (for tenant context)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize action system
 * - registerAction(definition): Register a new action
 * - unregisterAction(actionId): Unregister an action
 * - getAction(actionId): Get action by ID
 * - getActions(filters): Get actions with filters
 * - updateAction(actionId, data): Update an action
 * - deleteAction(actionId): Delete an action
 * - executeAction(actionId, context): Execute an action
 * - executeActions(actions, context): Execute multiple actions
 * - getActionDefinitions(): Get all action definitions
 * - getActionCategories(): Get action categories
 * - enableAction(actionId): Enable an action
 * - disableAction(actionId): Disable an action
 * - getActionStats(actionId): Get action statistics
 * - getActionHistory(actionId): Get action history
 * - validateAction(actionData): Validate action data
 * - createCustomAction(data): Create a custom action
 * - getActionParameters(actionId): Get action parameters
 * - validateActionParameters(actionId, params): Validate parameters
 * - getActionResults(executionId): Get action results
 * 
 * USAGE EXAMPLE:
 * import { actions } from './modules/automation/actions.js';
 * 
 * // Initialize action system
 * await actions.initialize();
 * 
 * // Register a custom action
 * await actions.registerAction({
 *   id: 'custom_action',
 *   type: 'custom',
 *   name: 'Custom Action',
 *   description: 'Execute custom logic',
 *   category: 'custom',
 *   params: [
 *     { name: 'parameter1', type: 'string', required: true }
 *   ],
 *   handler: async (context) => {
 *     console.log('Custom action executed:', context);
 *     return { success: true, data: context };
 *   }
 * });
 * 
 * // Execute an action
 * const result = await actions.executeAction('action_123', {
 *   leadId: 'lead_456',
 *   userId: 'user_789'
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let actionDefinitions = [];
let actionHistory = [];
let actionStats = new Map();
let customActions = [];
let idCounter = 1000;

// Action categories
const ACTION_CATEGORIES = {
    WHATSAPP: 'whatsapp',
    EMAIL: 'email',
    SMS: 'sms',
    LEAD: 'lead',
    DEAL: 'deal',
    TASK: 'task',
    INVOICE: 'invoice',
    NOTE: 'note',
    CUSTOMER: 'customer',
    INTEGRATION: 'integration',
    CUSTOM: 'custom',
    SYSTEM: 'system'
};

// System action definitions
const SYSTEM_ACTIONS = [
    {
        id: 'action_send_whatsapp',
        type: 'send_whatsapp',
        name: 'Send WhatsApp Message',
        description: 'Send a WhatsApp message to a contact',
        category: ACTION_CATEGORIES.WHATSAPP,
        priority: 1,
        params: [
            { name: 'to', type: 'string', required: true, description: 'Phone number with country code' },
            { name: 'message', type: 'string', required: false, description: 'Message text' },
            { name: 'template', type: 'string', required: false, description: 'Template name' },
            { name: 'variables', type: 'object', required: false, description: 'Template variables' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_send_email',
        type: 'send_email',
        name: 'Send Email',
        description: 'Send an email to a contact',
        category: ACTION_CATEGORIES.EMAIL,
        priority: 2,
        params: [
            { name: 'to', type: 'string', required: true, description: 'Email address' },
            { name: 'subject', type: 'string', required: true, description: 'Email subject' },
            { name: 'body', type: 'string', required: true, description: 'Email body' },
            { name: 'template', type: 'string', required: false, description: 'Template name' },
            { name: 'variables', type: 'object', required: false, description: 'Template variables' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_send_sms',
        type: 'send_sms',
        name: 'Send SMS',
        description: 'Send an SMS to a contact',
        category: ACTION_CATEGORIES.SMS,
        priority: 3,
        params: [
            { name: 'to', type: 'string', required: true, description: 'Phone number' },
            { name: 'message', type: 'string', required: true, description: 'SMS message' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_assign_lead',
        type: 'assign_lead',
        name: 'Assign Lead',
        description: 'Assign a lead to a user or team',
        category: ACTION_CATEGORIES.LEAD,
        priority: 4,
        params: [
            { name: 'leadId', type: 'string', required: true, description: 'Lead ID' },
            { name: 'userId', type: 'string', required: false, description: 'User ID' },
            { name: 'teamId', type: 'string', required: false, description: 'Team ID' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_update_lead',
        type: 'update_lead',
        name: 'Update Lead',
        description: 'Update a lead\'s properties',
        category: ACTION_CATEGORIES.LEAD,
        priority: 5,
        params: [
            { name: 'leadId', type: 'string', required: true, description: 'Lead ID' },
            { name: 'status', type: 'string', required: false, description: 'Lead status' },
            { name: 'score', type: 'number', required: false, description: 'Lead score' },
            { name: 'assignedTo', type: 'string', required: false, description: 'Assigned user' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_convert_lead',
        type: 'convert_lead',
        name: 'Convert Lead to Customer',
        description: 'Convert a lead to a customer',
        category: ACTION_CATEGORIES.LEAD,
        priority: 6,
        params: [
            { name: 'leadId', type: 'string', required: true, description: 'Lead ID' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_create_task',
        type: 'create_task',
        name: 'Create Task',
        description: 'Create a new task',
        category: ACTION_CATEGORIES.TASK,
        priority: 7,
        params: [
            { name: 'title', type: 'string', required: true, description: 'Task title' },
            { name: 'description', type: 'string', required: false, description: 'Task description' },
            { name: 'assignedTo', type: 'string', required: false, description: 'Assigned user' },
            { name: 'priority', type: 'string', required: false, description: 'Priority (high, medium, low)' },
            { name: 'dueDate', type: 'date', required: false, description: 'Due date' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_create_note',
        type: 'create_note',
        name: 'Create Note',
        description: 'Create a note on a lead or customer',
        category: ACTION_CATEGORIES.NOTE,
        priority: 8,
        params: [
            { name: 'entityId', type: 'string', required: true, description: 'Entity ID' },
            { name: 'entityType', type: 'string', required: true, description: 'Entity type (lead, customer)' },
            { name: 'content', type: 'string', required: true, description: 'Note content' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_create_deal',
        type: 'create_deal',
        name: 'Create Deal',
        description: 'Create a new deal',
        category: ACTION_CATEGORIES.DEAL,
        priority: 9,
        params: [
            { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
            { name: 'title', type: 'string', required: true, description: 'Deal title' },
            { name: 'value', type: 'number', required: false, description: 'Deal value' },
            { name: 'stageId', type: 'string', required: false, description: 'Pipeline stage' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_update_deal',
        type: 'update_deal',
        name: 'Update Deal',
        description: 'Update a deal\'s properties',
        category: ACTION_CATEGORIES.DEAL,
        priority: 10,
        params: [
            { name: 'dealId', type: 'string', required: true, description: 'Deal ID' },
            { name: 'stageId', type: 'string', required: false, description: 'Pipeline stage' },
            { name: 'value', type: 'number', required: false, description: 'Deal value' },
            { name: 'probability', type: 'number', required: false, description: 'Win probability' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_generate_invoice',
        type: 'generate_invoice',
        name: 'Generate Invoice',
        description: 'Generate a new invoice',
        category: ACTION_CATEGORIES.INVOICE,
        priority: 11,
        params: [
            { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
            { name: 'items', type: 'array', required: true, description: 'Invoice items' },
            { name: 'dueDate', type: 'date', required: false, description: 'Due date' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_send_invoice',
        type: 'send_invoice',
        name: 'Send Invoice',
        description: 'Send an invoice to customer',
        category: ACTION_CATEGORIES.INVOICE,
        priority: 12,
        params: [
            { name: 'invoiceId', type: 'string', required: true, description: 'Invoice ID' },
            { name: 'method', type: 'string', required: false, description: 'Send method (email, whatsapp)' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_webhook',
        type: 'webhook',
        name: 'Webhook',
        description: 'Call an external webhook',
        category: ACTION_CATEGORIES.INTEGRATION,
        priority: 13,
        params: [
            { name: 'url', type: 'string', required: true, description: 'Webhook URL' },
            { name: 'method', type: 'string', required: false, description: 'HTTP method (GET, POST, PUT, DELETE)' },
            { name: 'headers', type: 'object', required: false, description: 'HTTP headers' },
            { name: 'body', type: 'object', required: false, description: 'Request body' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_update_customer',
        type: 'update_customer',
        name: 'Update Customer',
        description: 'Update a customer\'s properties',
        category: ACTION_CATEGORIES.CUSTOMER,
        priority: 14,
        params: [
            { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
            { name: 'category', type: 'string', required: false, description: 'Customer category' },
            { name: 'tags', type: 'array', required: false, description: 'Customer tags' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_add_tag',
        type: 'add_tag',
        name: 'Add Tag',
        description: 'Add a tag to an entity',
        category: ACTION_CATEGORIES.CUSTOMER,
        priority: 15,
        params: [
            { name: 'entityId', type: 'string', required: true, description: 'Entity ID' },
            { name: 'entityType', type: 'string', required: true, description: 'Entity type' },
            { name: 'tag', type: 'string', required: true, description: 'Tag name' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    },
    {
        id: 'action_remove_tag',
        type: 'remove_tag',
        name: 'Remove Tag',
        description: 'Remove a tag from an entity',
        category: ACTION_CATEGORIES.CUSTOMER,
        priority: 16,
        params: [
            { name: 'entityId', type: 'string', required: true, description: 'Entity ID' },
            { name: 'entityType', type: 'string', required: true, description: 'Entity type' },
            { name: 'tag', type: 'string', required: true, description: 'Tag name' }
        ],
        isSystem: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        handler: null
    }
];

class Actions {
    constructor() {
        // Service state
        this.initialized = false;
        this.activeActions = new Map();
        this.handlerCache = new Map();
        this.executionQueue = [];
        this.isProcessing = false;
        
        // Configuration
        this.config = {
            maxActionsPerTenant: 50,
            maxConcurrentExecutions: 20,
            defaultTimeout: 60000, // 60 seconds
            enableCustomActions: true,
            enableActionHistory: true,
            maxHistoryPerAction: 100,
            enableAsyncExecution: true,
            retryOnFailure: true,
            maxRetries: 3,
            retryDelay: 5000
        };
        
        // Cache
        this.cache = {
            actions: new Map(),
            categories: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalActions: 0,
            activeActions: 0,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            byCategory: {},
            byType: {},
            executionTimes: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with system actions
        this.initSystemActions();
    }

    /**
     * Initialize system actions
     */
    initSystemActions() {
        for (const action of SYSTEM_ACTIONS) {
            actionDefinitions.push(action);
            this.cache.actions.set(action.id, action);
            this.cacheTimestamps.set(action.id, Date.now());
            this.activeActions.set(action.id, action);
        }
    }

    /**
     * Initialize action system
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

            // Start execution processor
            this.startExecutionProcessor();

            // Load custom actions
            await this.loadCustomActions();

            logger.info('Action system initialized', {
                totalActions: actionDefinitions.length,
                systemActions: SYSTEM_ACTIONS.length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Action system initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start execution processor
     */
    startExecutionProcessor() {
        setInterval(() => {
            if (!this.initialized) return;
            if (this.isProcessing) return;
            this.processExecutionQueue();
        }, 1000);
    }

    /**
     * Process execution queue
     */
    async processExecutionQueue() {
        if (this.executionQueue.length === 0) return;

        this.isProcessing = true;

        try {
            const batch = this.executionQueue.splice(0, this.config.maxConcurrentExecutions);
            
            for (const item of batch) {
                try {
                    await this.executeAction(item.actionId, item.context, item.options);
                } catch (error) {
                    logger.error('[Actions] Queue execution failed:', error);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Load custom actions from storage
     */
    async loadCustomActions() {
        // In production, this would load from Firestore
        // For MVP, custom actions are already in memory
        if (this.debugMode) {
            logger.debug('[Actions] Custom actions loaded');
        }
    }

    /**
     * Register a new action
     * @param {object} definition - Action definition
     * @param {object} options - Additional options
     * @returns {object} Registered action
     */
    async registerAction(definition, options = {}) {
        if (!this.initialized) {
            throw new Error('Action system not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate definition
        this.validateActionDefinition(definition);

        // Check tenant limit
        const tenantActions = actionDefinitions.filter(a => a.tenantId === tenantId);
        if (tenantActions.length >= this.config.maxActionsPerTenant) {
            throw new Error(`Maximum actions per tenant (${this.config.maxActionsPerTenant}) reached`);
        }

        // Create action
        const action = {
            id: definition.id || this.generateId('action'),
            tenantId: tenantId,
            type: definition.type,
            name: definition.name,
            description: definition.description || '',
            category: definition.category || ACTION_CATEGORIES.CUSTOM,
            priority: definition.priority || 100,
            params: definition.params || [],
            handler: definition.handler || null,
            isSystem: false,
            isActive: definition.isActive !== false,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            config: definition.config || {},
            metadata: definition.metadata || {},
            timeout: definition.timeout || this.config.defaultTimeout
        };

        // Store action
        actionDefinitions.push(action);
        this.cache.actions.set(action.id, action);
        this.cacheTimestamps.set(action.id, Date.now());

        if (action.isActive) {
            this.activeActions.set(action.id, action);
        }

        // Update stats
        this.stats.totalActions++;
        this.stats.byCategory[action.category] = (this.stats.byCategory[action.category] || 0) + 1;
        this.stats.byType[action.type] = (this.stats.byType[action.type] || 0) + 1;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'action.registered',
            'automation',
            { actionId: action.id, name: action.name, type: action.type }
        );

        // Emit event
        eventBus.publish('action.registered', {
            actionId: action.id,
            name: action.name,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[Actions] Action registered: ${action.id}`);
        }

        return { ...action };
    }

    /**
     * Unregister an action
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async unregisterAction(actionId, options = {}) {
        const index = actionDefinitions.findIndex(a => a.id === actionId);
        if (index === -1) {
            throw new Error(`Action ${actionId} not found`);
        }

        const action = actionDefinitions[index];
        if (action.isSystem && !options.forceDelete) {
            throw new Error('Cannot unregister system action');
        }

        actionDefinitions.splice(index, 1);
        this.cache.actions.delete(actionId);
        this.cacheTimestamps.delete(actionId);
        this.activeActions.delete(actionId);

        // Update stats
        this.stats.totalActions = Math.max(0, this.stats.totalActions - 1);
        this.stats.byCategory[action.category] = Math.max(0, (this.stats.byCategory[action.category] || 0) - 1);
        this.stats.byType[action.type] = Math.max(0, (this.stats.byType[action.type] || 0) - 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'action.unregistered',
            'automation',
            { actionId: actionId, name: action.name }
        );

        if (this.debugMode) {
            logger.debug(`[Actions] Action unregistered: ${actionId}`);
        }

        return true;
    }

    /**
     * Get action by ID
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {object} Action
     */
    async getAction(actionId, options = {}) {
        // Check cache
        if (this.cache.actions.has(actionId)) {
            const cached = this.cache.actions.get(actionId);
            const timestamp = this.cacheTimestamps.get(actionId) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.actions.delete(actionId);
            this.cacheTimestamps.delete(actionId);
        }

        const action = actionDefinitions.find(a => a.id === actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (action.tenantId && action.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Cache the result
        this.cache.actions.set(actionId, action);
        this.cacheTimestamps.set(actionId, Date.now());

        return { ...action };
    }

    /**
     * Get actions with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of actions
     */
    async getActions(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = actionDefinitions.filter(a => 
            !a.tenantId || a.tenantId === tenantId
        );

        // Apply filters
        if (filters.category) {
            results = results.filter(a => a.category === filters.category);
        }

        if (filters.type) {
            results = results.filter(a => a.type === filters.type);
        }

        if (filters.isActive !== undefined) {
            results = results.filter(a => a.isActive === filters.isActive);
        }

        if (filters.isSystem !== undefined) {
            results = results.filter(a => a.isSystem === filters.isSystem);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(a =>
                a.name.toLowerCase().includes(searchTerm) ||
                a.description.toLowerCase().includes(searchTerm) ||
                a.type.toLowerCase().includes(searchTerm)
            );
        }

        // Sort by priority
        results.sort((a, b) => a.priority - b.priority);

        // Apply pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(a => ({ ...a }));
    }

    /**
     * Update an action
     * @param {string} actionId - Action ID
     * @param {object} data - Updated action data
     * @param {object} options - Additional options
     * @returns {object} Updated action
     */
    async updateAction(actionId, data, options = {}) {
        const index = actionDefinitions.findIndex(a => a.id === actionId);
        if (index === -1) {
            throw new Error(`Action ${actionId} not found`);
        }

        const action = actionDefinitions[index];
        if (action.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system action');
        }

        // Update fields
        if (data.name) action.name = data.name;
        if (data.description) action.description = data.description;
        if (data.category) action.category = data.category;
        if (data.priority) action.priority = data.priority;
        if (data.params) action.params = data.params;
        if (data.handler) action.handler = data.handler;
        if (data.isActive !== undefined) action.isActive = data.isActive;
        if (data.config) action.config = { ...action.config, ...data.config };
        if (data.metadata) action.metadata = { ...action.metadata, ...data.metadata };
        if (data.timeout) action.timeout = data.timeout;

        action.updatedAt = new Date().toISOString();
        actionDefinitions[index] = action;

        // Update caches
        this.cache.actions.set(actionId, action);
        this.cacheTimestamps.set(actionId, Date.now());

        if (action.isActive) {
            this.activeActions.set(actionId, action);
        } else {
            this.activeActions.delete(actionId);
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'action.updated',
            'automation',
            { actionId: actionId, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[Actions] Action updated: ${actionId}`);
        }

        return { ...action };
    }

    /**
     * Delete an action
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteAction(actionId, options = {}) {
        const index = actionDefinitions.findIndex(a => a.id === actionId);
        if (index === -1) {
            throw new Error(`Action ${actionId} not found`);
        }

        const action = actionDefinitions[index];
        if (action.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system action');
        }

        actionDefinitions.splice(index, 1);
        this.cache.actions.delete(actionId);
        this.cacheTimestamps.delete(actionId);
        this.activeActions.delete(actionId);

        // Update stats
        this.stats.totalActions = Math.max(0, this.stats.totalActions - 1);
        this.stats.byCategory[action.category] = Math.max(0, (this.stats.byCategory[action.category] || 0) - 1);
        this.stats.byType[action.type] = Math.max(0, (this.stats.byType[action.type] || 0) - 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'action.deleted',
            'automation',
            { actionId: actionId, name: action.name }
        );

        if (this.debugMode) {
            logger.debug(`[Actions] Action deleted: ${actionId}`);
        }

        return true;
    }

    /**
     * Execute an action
     * @param {string} actionId - Action ID
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {object} Execution result
     */
    async executeAction(actionId, context = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Action system not initialized');
        }

        const action = await this.getAction(actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }

        if (!action.isActive) {
            throw new Error(`Action ${actionId} is not active`);
        }

        // Validate parameters
        const validationResult = this.validateActionParameters(action, context);
        if (!validationResult.valid) {
            throw new Error(`Invalid parameters: ${validationResult.errors.join(', ')}`);
        }

        // Check if async execution is requested
        if (options.async && this.config.enableAsyncExecution) {
            this.executionQueue.push({
                actionId: actionId,
                context: context,
                options: options
            });
            return { 
                queued: true, 
                actionId: actionId,
                message: 'Action queued for execution'
            };
        }

        // Execute action
        return await this.executeActionSync(action, context, options);
    }

    /**
     * Execute an action synchronously
     * @param {object} action - Action object
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {object} Execution result
     */
    async executeActionSync(action, context = {}, options = {}) {
        const startTime = Date.now();
        const executionId = 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        try {
            // Update stats
            this.stats.totalExecutions++;

            // Set timeout
            const timeout = action.timeout || this.config.defaultTimeout;
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Action execution timeout (${timeout}ms)`));
                }, timeout);
            });

            // Execute handler if exists
            let result;
            if (action.handler) {
                const handlerPromise = action.handler(context);
                result = await Promise.race([handlerPromise, timeoutPromise]);
            } else {
                // Default execution based on action type
                result = await this.executeDefaultAction(action, context);
            }

            // Record success
            this.stats.successfulExecutions++;
            const duration = Date.now() - startTime;
            this.stats.executionTimes[action.id] = duration;

            // Record history
            if (this.config.enableActionHistory) {
                await this.recordActionHistory(action.id, context, result, true);
            }

            // Emit event
            eventBus.publish('action.executed', {
                actionId: action.id,
                name: action.name,
                success: true,
                result: result,
                duration: duration
            });

            if (this.debugMode) {
                logger.debug(`[Actions] Action executed: ${action.id} (${duration}ms)`);
            }

            return {
                success: true,
                actionId: action.id,
                result: result,
                duration: duration,
                executionId: executionId
            };

        } catch (error) {
            // Record failure
            this.stats.failedExecutions++;
            const duration = Date.now() - startTime;

            // Record history
            if (this.config.enableActionHistory) {
                await this.recordActionHistory(action.id, context, { error: error.message }, false);
            }

            // Emit event
            eventBus.publish('action.failed', {
                actionId: action.id,
                name: action.name,
                error: error.message,
                duration: duration
            });

            // Retry if configured
            if (this.config.retryOnFailure && options.retryCount < this.config.maxRetries) {
                const retryCount = (options.retryCount || 0) + 1;
                if (this.debugMode) {
                    logger.debug(`[Actions] Retrying action ${action.id} (attempt ${retryCount})`);
                }
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                return await this.executeActionSync(action, context, {
                    ...options,
                    retryCount: retryCount
                });
            }

            logger.error(`[Actions] Action execution failed: ${action.id}`, error);

            return {
                success: false,
                actionId: action.id,
                error: error.message,
                duration: duration,
                executionId: executionId
            };
        }
    }

    /**
     * Execute default action based on type
     * @param {object} action - Action object
     * @param {object} context - Execution context
     * @returns {object} Execution result
     */
    async executeDefaultAction(action, context) {
        // Simulate execution based on action type
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        // 95% success rate for system actions
        const success = Math.random() > 0.05;

        if (success) {
            return {
                executed: true,
                actionType: action.type,
                data: context,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error(`Action ${action.type} failed during execution`);
        }
    }

    /**
     * Execute multiple actions
     * @param {Array} actionsList - List of actions to execute
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {Array} Execution results
     */
    async executeActions(actionsList, context = {}, options = {}) {
        const results = [];

        for (const action of actionsList) {
            try {
                const result = await this.executeAction(action.id || action, context, options);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    actionId: action.id || action,
                    error: error.message
                });
                if (options.stopOnError) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Validate action parameters
     * @param {object} action - Action object
     * @param {object} context - Execution context
     * @returns {object} Validation result
     */
    validateActionParameters(action, context) {
        const errors = [];

        if (!action.params || action.params.length === 0) {
            return { valid: true, errors: [] };
        }

        for (const param of action.params) {
            if (param.required && !context[param.name]) {
                errors.push(`Required parameter "${param.name}" is missing`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Record action history
     * @param {string} actionId - Action ID
     * @param {object} context - Execution context
     * @param {object} result - Execution result
     * @param {boolean} success - Whether execution was successful
     */
    async recordActionHistory(actionId, context, result, success) {
        const entry = {
            id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            actionId: actionId,
            context: context,
            result: result,
            success: success,
            timestamp: new Date().toISOString(),
            tenantId: context.tenantId || tenantIsolation.getCurrentTenant()
        };

        actionHistory.push(entry);

        // Limit history size
        const actionEntries = actionHistory.filter(h => h.actionId === actionId);
        if (actionEntries.length > this.config.maxHistoryPerAction) {
            const toRemove = actionEntries.length - this.config.maxHistoryPerAction;
            const ids = actionEntries.slice(0, toRemove).map(h => h.id);
            actionHistory = actionHistory.filter(h => !ids.includes(h.id));
        }
    }

    /**
     * Validate action definition
     * @param {object} actionData - Action data
     * @throws {Error} If validation fails
     */
    validateActionDefinition(actionData) {
        if (!actionData.type) {
            throw new Error('Action type is required');
        }
        if (!actionData.name) {
            throw new Error('Action name is required');
        }
        if (actionData.priority && actionData.priority < 0) {
            throw new Error('Priority must be positive');
        }
        if (actionData.params) {
            for (const param of actionData.params) {
                if (!param.name) {
                    throw new Error('Parameter name is required');
                }
                if (!param.type) {
                    throw new Error('Parameter type is required');
                }
            }
        }
    }

    /**
     * Get action definitions
     * @param {object} options - Additional options
     * @returns {Array} Action definitions
     */
    async getActionDefinitions(options = {}) {
        let results = [...actionDefinitions];

        if (options.category) {
            results = results.filter(a => a.category === options.category);
        }

        if (options.isSystem !== undefined) {
            results = results.filter(a => a.isSystem === options.isSystem);
        }

        if (options.isActive !== undefined) {
            results = results.filter(a => a.isActive === options.isActive);
        }

        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            results = results.filter(a =>
                a.name.toLowerCase().includes(searchTerm) ||
                a.description.toLowerCase().includes(searchTerm) ||
                a.type.toLowerCase().includes(searchTerm)
            );
        }

        results.sort((a, b) => a.priority - b.priority);

        return results.map(a => ({ ...a }));
    }

    /**
     * Get action categories
     * @param {object} options - Additional options
     * @returns {object} Action categories
     */
    async getActionCategories(options = {}) {
        return { ...ACTION_CATEGORIES };
    }

    /**
     * Enable an action
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {object} Updated action
     */
    async enableAction(actionId, options = {}) {
        return await this.updateAction(actionId, { isActive: true }, options);
    }

    /**
     * Disable an action
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {object} Updated action
     */
    async disableAction(actionId, options = {}) {
        return await this.updateAction(actionId, { isActive: false }, options);
    }

    /**
     * Get action statistics
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {object} Action statistics
     */
    async getActionStats(actionId, options = {}) {
        const action = await this.getAction(actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }

        const history = actionHistory.filter(h => h.actionId === actionId);
        const totalExecutions = history.length;
        const successful = history.filter(h => h.success).length;
        const failed = history.filter(h => !h.success).length;
        const lastExecuted = history.length > 0 ? history[history.length - 1].timestamp : null;
        const avgExecutionTime = history.length > 0 ? 
            history.reduce((sum, h) => sum + (h.duration || 0), 0) / history.length : 0;

        return {
            actionId: actionId,
            name: action.name,
            type: action.type,
            totalExecutions: totalExecutions,
            successful: successful,
            failed: failed,
            successRate: totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0,
            lastExecuted: lastExecuted,
            averageExecutionTime: Math.round(avgExecutionTime),
            isActive: action.isActive,
            isSystem: action.isSystem,
            createdAt: action.createdAt
        };
    }

    /**
     * Get action history
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {Array} Action history
     */
    async getActionHistory(actionId, options = {}) {
        let results = actionHistory.filter(h => h.actionId === actionId);

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
     * Create a custom action
     * @param {object} data - Action data
     * @param {object} options - Additional options
     * @returns {object} Created action
     */
    async createCustomAction(data, options = {}) {
        if (!this.config.enableCustomActions) {
            throw new Error('Custom actions are disabled');
        }

        return await this.registerAction(data, options);
    }

    /**
     * Get action parameters
     * @param {string} actionId - Action ID
     * @param {object} options - Additional options
     * @returns {Array} Action parameters
     */
    async getActionParameters(actionId, options = {}) {
        const action = await this.getAction(actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }

        return action.params || [];
    }

    /**
     * Get action results for an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {object} Action results
     */
    async getActionResults(executionId, options = {}) {
        const results = actionHistory.filter(h => h.id === executionId);
        if (results.length === 0) {
            return null;
        }

        return results[0].result || null;
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = 'action') {
        idCounter++;
        return `${prefix}_${idCounter}`;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Actions] Debug mode enabled');
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
        this.initialized = false;
        this.activeActions.clear();
        this.handlerCache.clear();
        this.cache.actions.clear();
        this.cacheTimestamps.clear();
        this.executionQueue = [];
        this.isProcessing = false;

        logger.info('Action system cleaned up');
    }
}

// Create and export singleton instance
export const actions = new Actions();

// Export class for testing
export default Actions;
