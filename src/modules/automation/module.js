/**
 * ==========================================
 * FILE: module.js
 * MODULE: Automation Module
 * CODE: AUTO-1
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Main automation module that orchestrates workflows,
 * triggers, actions, and automation execution.
 * Provides unified interface for all automation operations.
 * 
 * DEPENDENCIES:
 * - workflowBuilder.js (for building workflows)
 * - workflowEngine.js (for executing workflows)
 * - triggers.js (for trigger definitions)
 * - actions.js (for action definitions)
 * - workflowLogs.js (for logging)
 * - workflowQueue.js (for queuing)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize automation module
 * - createWorkflow(data): Create a new workflow
 * - getWorkflow(id): Get workflow by ID
 * - updateWorkflow(id, data): Update a workflow
 * - deleteWorkflow(id): Delete a workflow
 * - getWorkflows(filters): Get workflows with filters
 * - executeWorkflow(id, context): Execute a workflow
 * - pauseWorkflow(id): Pause a workflow
 * - resumeWorkflow(id): Resume a workflow
 * - getWorkflowLogs(id): Get workflow execution logs
 * - getTriggerDefinitions(): Get all trigger definitions
 * - getActionDefinitions(): Get all action definitions
 * - createTrigger(data): Create a new trigger
 * - updateTrigger(id, data): Update a trigger
 * - deleteTrigger(id): Delete a trigger
 * - getTriggers(filters): Get triggers with filters
 * - getWorkflowStats(): Get workflow statistics
 * - getAutomationStats(): Get automation statistics
 * 
 * USAGE EXAMPLE:
 * import { automationModule } from './modules/automation/module.js';
 * 
 * // Initialize automation module
 * await automationModule.initialize();
 * 
 * // Create a workflow
 * const workflow = await automationModule.createWorkflow({
 *   name: 'Lead Follow-up',
 *   description: 'Auto follow-up for new leads',
 *   trigger: { type: 'lead.created' },
 *   actions: [
 *     { type: 'send_whatsapp', config: { template: 'welcome' } },
 *     { type: 'assign_lead', config: { team: 'sales' } },
 *     { type: 'create_task', config: { title: 'Follow up' } }
 *   ]
 * });
 * 
 * // Execute a workflow
 * await automationModule.executeWorkflow('wf_123', {
 *   leadId: 'lead_456',
 *   userId: 'user_789'
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { roleEngine } from '../../core/rbac/roleEngine.js';

// Service imports (will be implemented in subsequent files)
let workflowBuilder = null;
let workflowEngine = null;
let triggers = null;
let actions = null;
let workflowLogs = null;
let workflowQueue = null;

// In-memory storage (for MVP)
// In production, this would be Firestore
let workflows = [];
let workflowDefinitions = [];
let triggerDefinitions = [];
let actionDefinitions = [];
let idCounter = 1000;

class AutomationModule {
    constructor() {
        // Module state
        this.initialized = false;
        this.isProcessing = false;
        this.processingQueue = [];
        
        // Configuration
        this.config = {
            maxConcurrentWorkflows: 10,
            maxWorkflowsPerTenant: 100,
            maxActionsPerWorkflow: 20,
            executionTimeout: 300000, // 5 minutes
            retryOnFailure: true,
            maxRetries: 3,
            retryDelay: 5000,
            enableLogging: true,
            enableMetrics: true,
            defaultTrigger: 'event',
            defaultAction: 'send_whatsapp'
        };
        
        // Statistics
        this.stats = {
            totalWorkflows: 0,
            activeWorkflows: 0,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalTriggers: 0,
            totalActions: 0,
            byTrigger: {},
            byAction: {},
            executionTime: {
                avg: 0,
                min: 0,
                max: 0
            }
        };
        
        // Cache
        this.cache = {
            workflows: new Map(),
            triggers: new Map(),
            actions: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = {
            workflows: new Map(),
            triggers: new Map(),
            actions: new Map()
        };
        
        // Event subscriptions
        this.subscriptions = [];
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with default trigger and action definitions
        this.initDefaultDefinitions();
    }

    /**
     * Initialize default trigger and action definitions
     */
    initDefaultDefinitions() {
        // Default trigger definitions
        this.triggerDefinitions = [
            {
                id: 'trigger_lead_created',
                type: 'lead.created',
                name: 'Lead Created',
                description: 'Triggered when a new lead is created',
                category: 'lead',
                priority: 1,
                params: [
                    { name: 'source', type: 'string', required: false },
                    { name: 'status', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_lead_updated',
                type: 'lead.updated',
                name: 'Lead Updated',
                description: 'Triggered when a lead is updated',
                category: 'lead',
                priority: 2,
                params: [
                    { name: 'field', type: 'string', required: false },
                    { name: 'oldValue', type: 'string', required: false },
                    { name: 'newValue', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_lead_converted',
                type: 'lead.converted',
                name: 'Lead Converted',
                description: 'Triggered when a lead is converted to customer',
                category: 'lead',
                priority: 3,
                params: [],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_deal_won',
                type: 'deal.won',
                name: 'Deal Won',
                description: 'Triggered when a deal is marked as won',
                category: 'deal',
                priority: 4,
                params: [
                    { name: 'value', type: 'number', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_deal_lost',
                type: 'deal.lost',
                name: 'Deal Lost',
                description: 'Triggered when a deal is marked as lost',
                category: 'deal',
                priority: 5,
                params: [
                    { name: 'reason', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_task_due',
                type: 'task.due',
                name: 'Task Due',
                description: 'Triggered when a task is due',
                category: 'task',
                priority: 6,
                params: [
                    { name: 'daysBefore', type: 'number', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_invoice_created',
                type: 'invoice.created',
                name: 'Invoice Created',
                description: 'Triggered when a new invoice is created',
                category: 'invoice',
                priority: 7,
                params: [
                    { name: 'amount', type: 'number', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_invoice_paid',
                type: 'invoice.paid',
                name: 'Invoice Paid',
                description: 'Triggered when an invoice is paid',
                category: 'invoice',
                priority: 8,
                params: [
                    { name: 'amount', type: 'number', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_whatsapp_received',
                type: 'whatsapp.received',
                name: 'WhatsApp Message Received',
                description: 'Triggered when a WhatsApp message is received',
                category: 'whatsapp',
                priority: 9,
                params: [
                    { name: 'keyword', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_customer_created',
                type: 'customer.created',
                name: 'Customer Created',
                description: 'Triggered when a new customer is created',
                category: 'customer',
                priority: 10,
                params: [],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'trigger_schedule',
                type: 'schedule',
                name: 'Schedule',
                description: 'Triggered on a schedule (cron)',
                category: 'system',
                priority: 11,
                params: [
                    { name: 'cron', type: 'string', required: true }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            }
        ];

        // Default action definitions
        this.actionDefinitions = [
            {
                id: 'action_send_whatsapp',
                type: 'send_whatsapp',
                name: 'Send WhatsApp Message',
                description: 'Send a WhatsApp message to a contact',
                category: 'whatsapp',
                priority: 1,
                params: [
                    { name: 'to', type: 'string', required: true },
                    { name: 'message', type: 'string', required: false },
                    { name: 'template', type: 'string', required: false },
                    { name: 'variables', type: 'object', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_assign_lead',
                type: 'assign_lead',
                name: 'Assign Lead',
                description: 'Assign a lead to a user or team',
                category: 'lead',
                priority: 2,
                params: [
                    { name: 'leadId', type: 'string', required: true },
                    { name: 'userId', type: 'string', required: false },
                    { name: 'teamId', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_create_task',
                type: 'create_task',
                name: 'Create Task',
                description: 'Create a new task',
                category: 'task',
                priority: 3,
                params: [
                    { name: 'title', type: 'string', required: true },
                    { name: 'description', type: 'string', required: false },
                    { name: 'assignedTo', type: 'string', required: false },
                    { name: 'priority', type: 'string', required: false },
                    { name: 'dueDate', type: 'date', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_send_email',
                type: 'send_email',
                name: 'Send Email',
                description: 'Send an email to a contact',
                category: 'email',
                priority: 4,
                params: [
                    { name: 'to', type: 'string', required: true },
                    { name: 'subject', type: 'string', required: true },
                    { name: 'body', type: 'string', required: true },
                    { name: 'template', type: 'string', required: false },
                    { name: 'variables', type: 'object', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_update_lead',
                type: 'update_lead',
                name: 'Update Lead',
                description: 'Update a lead\'s properties',
                category: 'lead',
                priority: 5,
                params: [
                    { name: 'leadId', type: 'string', required: true },
                    { name: 'status', type: 'string', required: false },
                    { name: 'score', type: 'number', required: false },
                    { name: 'assignedTo', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_create_note',
                type: 'create_note',
                name: 'Create Note',
                description: 'Create a note on a lead or customer',
                category: 'note',
                priority: 6,
                params: [
                    { name: 'entityId', type: 'string', required: true },
                    { name: 'entityType', type: 'string', required: true },
                    { name: 'content', type: 'string', required: true }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_send_sms',
                type: 'send_sms',
                name: 'Send SMS',
                description: 'Send an SMS to a contact',
                category: 'sms',
                priority: 7,
                params: [
                    { name: 'to', type: 'string', required: true },
                    { name: 'message', type: 'string', required: true }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_webhook',
                type: 'webhook',
                name: 'Webhook',
                description: 'Call an external webhook',
                category: 'integration',
                priority: 8,
                params: [
                    { name: 'url', type: 'string', required: true },
                    { name: 'method', type: 'string', required: false },
                    { name: 'headers', type: 'object', required: false },
                    { name: 'body', type: 'object', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_create_deal',
                type: 'create_deal',
                name: 'Create Deal',
                description: 'Create a new deal',
                category: 'deal',
                priority: 9,
                params: [
                    { name: 'customerId', type: 'string', required: true },
                    { name: 'title', type: 'string', required: true },
                    { name: 'value', type: 'number', required: false },
                    { name: 'stageId', type: 'string', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            },
            {
                id: 'action_generate_invoice',
                type: 'generate_invoice',
                name: 'Generate Invoice',
                description: 'Generate a new invoice',
                category: 'invoice',
                priority: 10,
                params: [
                    { name: 'customerId', type: 'string', required: true },
                    { name: 'items', type: 'array', required: true },
                    { name: 'dueDate', type: 'date', required: false }
                ],
                isActive: true,
                isSystem: true,
                createdAt: new Date().toISOString()
            }
        ];

        // Build cache
        this.buildCache();
    }

    /**
     * Build cache for trigger and action definitions
     */
    buildCache() {
        for (const trigger of this.triggerDefinitions) {
            this.cache.triggers.set(trigger.id, trigger);
        }
        for (const action of this.actionDefinitions) {
            this.cache.actions.set(action.id, action);
        }
    }

    /**
     * Initialize automation module
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

            // Initialize services
            // In production, import and initialize actual services
            // For MVP, use placeholder

            // Setup event listeners
            this.setupEventListeners();

            // Start processing queue
            this.startQueueProcessor();

            // Log initialization
            logger.info('Automation module initialized', {
                version: '1.0.0',
                triggers: this.triggerDefinitions.length,
                actions: this.actionDefinitions.length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Automation module initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for triggers
     */
    setupEventListeners() {
        // Listen to all events that have triggers
        const eventTypes = this.triggerDefinitions.map(t => t.type);
        
        for (const eventType of eventTypes) {
            const sub = eventBus.subscribe(eventType, async (data) => {
                await this.handleEvent(eventType, data);
            });
            this.subscriptions.push(sub);
        }

        // Schedule trigger handler
        const scheduleSub = eventBus.subscribe('schedule.trigger', async (data) => {
            await this.handleScheduledTrigger(data);
        });
        this.subscriptions.push(scheduleSub);
    }

    /**
     * Handle an event and trigger matching workflows
     * @param {string} eventType - Event type
     * @param {object} data - Event data
     */
    async handleEvent(eventType, data) {
        if (!this.initialized) return;

        try {
            // Find workflows matching this trigger
            const matchingWorkflows = workflows.filter(w => 
                w.triggerType === eventType && 
                w.isActive &&
                w.status === 'active'
            );

            if (matchingWorkflows.length === 0) return;

            if (this.debugMode) {
                logger.debug(`[Automation] Handling event: ${eventType}, matching workflows: ${matchingWorkflows.length}`);
            }

            // Execute each matching workflow
            for (const workflow of matchingWorkflows) {
                await this.executeWorkflow(workflow.id, {
                    event: eventType,
                    data: data,
                    triggeredBy: 'event'
                });
            }
        } catch (error) {
            logger.error(`[Automation] Error handling event ${eventType}:`, error);
        }
    }

    /**
     * Handle scheduled trigger
     * @param {object} data - Schedule data
     */
    async handleScheduledTrigger(data) {
        if (!this.initialized) return;

        try {
            // Find workflows with schedule trigger
            const scheduledWorkflows = workflows.filter(w => 
                w.triggerType === 'schedule' && 
                w.isActive &&
                w.status === 'active' &&
                w.scheduleCron === data.cron
            );

            if (scheduledWorkflows.length === 0) return;

            if (this.debugMode) {
                logger.debug(`[Automation] Handling schedule: ${data.cron}, matching workflows: ${scheduledWorkflows.length}`);
            }

            for (const workflow of scheduledWorkflows) {
                await this.executeWorkflow(workflow.id, {
                    event: 'schedule',
                    data: data,
                    triggeredBy: 'schedule'
                });
            }
        } catch (error) {
            logger.error(`[Automation] Error handling schedule:`, error);
        }
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.isProcessing) return;
            this.processQueue();
        }, 1000);
    }

    /**
     * Process execution queue
     */
    async processQueue() {
        if (this.processingQueue.length === 0) return;

        this.isProcessing = true;

        try {
            const batch = this.processingQueue.splice(0, this.config.maxConcurrentWorkflows);
            
            for (const item of batch) {
                try {
                    await this.executeWorkflow(item.workflowId, item.context);
                } catch (error) {
                    logger.error(`[Automation] Queue execution failed:`, error);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Create a new workflow
     * @param {object} data - Workflow data
     * @param {object} options - Additional options
     * @returns {object} Created workflow
     */
    async createWorkflow(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Automation module not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate data
        this.validateWorkflowData(data);

        // Check tenant limit
        const tenantWorkflows = workflows.filter(w => w.tenantId === tenantId);
        if (tenantWorkflows.length >= this.config.maxWorkflowsPerTenant) {
            throw new Error(`Maximum workflows per tenant (${this.config.maxWorkflowsPerTenant}) reached`);
        }

        // Validate trigger exists
        const trigger = this.triggerDefinitions.find(t => t.type === data.triggerType);
        if (!trigger) {
            throw new Error(`Trigger type ${data.triggerType} not found`);
        }

        // Validate actions
        if (data.actions && data.actions.length > 0) {
            for (const actionData of data.actions) {
                const actionDef = this.actionDefinitions.find(a => a.type === actionData.type);
                if (!actionDef) {
                    throw new Error(`Action type ${actionData.type} not found`);
                }
                if (data.actions.length > this.config.maxActionsPerWorkflow) {
                    throw new Error(`Maximum actions per workflow (${this.config.maxActionsPerWorkflow}) exceeded`);
                }
            }
        }

        // Create workflow
        const workflow = {
            id: this.generateId('wf'),
            tenantId: tenantId,
            name: data.name,
            description: data.description || '',
            triggerType: data.triggerType,
            triggerConfig: data.triggerConfig || {},
            actions: data.actions || [],
            conditions: data.conditions || [],
            priority: data.priority || 1,
            isActive: data.isActive !== false,
            status: 'active',
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastExecutedAt: null,
            executionCount: 0,
            successCount: 0,
            failureCount: 0
        };

        // Store workflow
        workflows.push(workflow);
        this.cache.workflows.set(workflow.id, workflow);
        this.cacheTimestamps.workflows.set(workflow.id, Date.now());

        // Update stats
        this.stats.totalWorkflows++;
        this.stats.activeWorkflows++;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.created',
            'automation',
            { workflowId: workflow.id, name: workflow.name }
        );

        // Emit event
        eventBus.publish('workflow.created', {
            workflowId: workflow.id,
            name: workflow.name,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[Automation] Workflow created: ${workflow.id}`);
        }

        return { ...workflow };
    }

    /**
     * Get workflow by ID
     * @param {string} id - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Workflow
     */
    async getWorkflow(id, options = {}) {
        // Check cache
        if (this.cache.workflows.has(id)) {
            const cached = this.cache.workflows.get(id);
            const timestamp = this.cacheTimestamps.workflows.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.workflows.delete(id);
            this.cacheTimestamps.workflows.delete(id);
        }

        const workflow = workflows.find(w => w.id === id);
        if (!workflow) {
            throw new Error(`Workflow ${id} not found`);
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (workflow.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Cache the result
        this.cache.workflows.set(id, workflow);
        this.cacheTimestamps.workflows.set(id, Date.now());

        return { ...workflow };
    }

    /**
     * Update a workflow
     * @param {string} id - Workflow ID
     * @param {object} data - Updated workflow data
     * @param {object} options - Additional options
     * @returns {object} Updated workflow
     */
    async updateWorkflow(id, data, options = {}) {
        const index = workflows.findIndex(w => w.id === id);
        if (index === -1) {
            throw new Error(`Workflow ${id} not found`);
        }

        const workflow = workflows[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (workflow.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Update fields
        const oldWorkflow = { ...workflow };

        if (data.name) workflow.name = data.name;
        if (data.description) workflow.description = data.description;
        if (data.triggerType) {
            const trigger = this.triggerDefinitions.find(t => t.type === data.triggerType);
            if (!trigger) {
                throw new Error(`Trigger type ${data.triggerType} not found`);
            }
            workflow.triggerType = data.triggerType;
        }
        if (data.triggerConfig) workflow.triggerConfig = data.triggerConfig;
        if (data.actions) {
            for (const actionData of data.actions) {
                const actionDef = this.actionDefinitions.find(a => a.type === actionData.type);
                if (!actionDef) {
                    throw new Error(`Action type ${actionData.type} not found`);
                }
            }
            workflow.actions = data.actions;
        }
        if (data.conditions) workflow.conditions = data.conditions;
        if (data.priority) workflow.priority = data.priority;
        if (data.isActive !== undefined) workflow.isActive = data.isActive;

        workflow.updatedAt = new Date().toISOString();
        workflows[index] = workflow;

        // Update cache
        this.cache.workflows.set(id, workflow);
        this.cacheTimestamps.workflows.set(id, Date.now());

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.updated',
            'automation',
            { workflowId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[Automation] Workflow updated: ${id}`);
        }

        return { ...workflow };
    }

    /**
     * Delete a workflow
     * @param {string} id - Workflow ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteWorkflow(id, options = {}) {
        const index = workflows.findIndex(w => w.id === id);
        if (index === -1) {
            throw new Error(`Workflow ${id} not found`);
        }

        const workflow = workflows[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (workflow.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        workflows.splice(index, 1);
        this.cache.workflows.delete(id);
        this.cacheTimestamps.workflows.delete(id);

        // Update stats
        this.stats.totalWorkflows = Math.max(0, this.stats.totalWorkflows - 1);
        if (workflow.status === 'active') {
            this.stats.activeWorkflows = Math.max(0, this.stats.activeWorkflows - 1);
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.deleted',
            'automation',
            { workflowId: id, name: workflow.name }
        );

        if (this.debugMode) {
            logger.debug(`[Automation] Workflow deleted: ${id}`);
        }

        return true;
    }

    /**
     * Get workflows with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of workflows
     */
    async getWorkflows(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = workflows.filter(w => w.tenantId === tenantId);

        // Apply filters
        if (filters.triggerType) {
            results = results.filter(w => w.triggerType === filters.triggerType);
        }

        if (filters.isActive !== undefined) {
            results = results.filter(w => w.isActive === filters.isActive);
        }

        if (filters.status) {
            results = results.filter(w => w.status === filters.status);
        }

        if (filters.name) {
            results = results.filter(w => w.name.toLowerCase().includes(filters.name.toLowerCase()));
        }

        if (filters.startDate) {
            results = results.filter(w => new Date(w.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(w => new Date(w.createdAt) <= new Date(filters.endDate));
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
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
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(w => ({ ...w }));
    }

    /**
     * Execute a workflow
     * @param {string} id - Workflow ID
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {object} Execution result
     */
    async executeWorkflow(id, context = {}, options = {}) {
        const workflow = await this.getWorkflow(id);
        if (!workflow) {
            throw new Error(`Workflow ${id} not found`);
        }

        if (!workflow.isActive) {
            throw new Error(`Workflow ${id} is not active`);
        }

        // Check execution timeout
        if (workflow.lastExecutedAt) {
            const lastExecuted = new Date(workflow.lastExecutedAt).getTime();
            if (Date.now() - lastExecuted < 1000) {
                // Rate limiting: allow at least 1 second between executions
                if (this.debugMode) {
                    logger.debug(`[Automation] Workflow ${id} rate limited`);
                }
                return { success: false, error: 'Rate limited' };
            }
        }

        // Update workflow stats
        workflow.executionCount++;
        workflow.lastExecutedAt = new Date().toISOString();

        // In production, this would use workflowEngine
        // For MVP, simulate execution
        const result = await this.simulateExecution(workflow, context);

        // Update stats
        this.stats.totalExecutions++;
        if (result.success) {
            this.stats.successfulExecutions++;
            workflow.successCount++;
        } else {
            this.stats.failedExecutions++;
            workflow.failureCount++;
        }

        // Update workflow in storage
        const index = workflows.findIndex(w => w.id === id);
        if (index !== -1) {
            workflows[index] = workflow;
        }

        // Log execution
        if (this.config.enableLogging) {
            await auditLogger.log(
                context.userId || 'system',
                'workflow.executed',
                'automation',
                { workflowId: id, success: result.success, context: context }
            );
        }

        // Emit event
        eventBus.publish('workflow.executed', {
            workflowId: id,
            success: result.success,
            result: result,
            userId: context.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[Automation] Workflow executed: ${id}, success: ${result.success}`);
        }

        return result;
    }

    /**
     * Simulate workflow execution (for MVP)
     * @param {object} workflow - Workflow object
     * @param {object} context - Execution context
     * @returns {object} Execution result
     */
    async simulateExecution(workflow, context) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        
        const success = Math.random() > 0.1; // 90% success rate
        
        return {
            success: success,
            workflowId: workflow.id,
            executedAt: new Date().toISOString(),
            actionsExecuted: workflow.actions.length,
            error: success ? null : 'Simulated execution failure',
            context: context
        };
    }

    /**
     * Pause a workflow
     * @param {string} id - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Paused workflow
     */
    async pauseWorkflow(id, options = {}) {
        return await this.updateWorkflow(id, { isActive: false, status: 'paused' }, options);
    }

    /**
     * Resume a workflow
     * @param {string} id - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Resumed workflow
     */
    async resumeWorkflow(id, options = {}) {
        return await this.updateWorkflow(id, { isActive: true, status: 'active' }, options);
    }

    /**
     * Get workflow execution logs
     * @param {string} id - Workflow ID
     * @param {object} options - Additional options
     * @returns {Array} Execution logs
     */
    async getWorkflowLogs(id, options = {}) {
        // In production, this would fetch from workflowLogs
        // For MVP, return sample logs
        return [
            {
                id: 'log_1',
                workflowId: id,
                status: 'success',
                executedAt: new Date(Date.now() - 3600000).toISOString(),
                duration: 1200,
                actions: [
                    { type: 'send_whatsapp', status: 'success' },
                    { type: 'create_task', status: 'success' }
                ]
            },
            {
                id: 'log_2',
                workflowId: id,
                status: 'failed',
                executedAt: new Date(Date.now() - 7200000).toISOString(),
                duration: 800,
                actions: [
                    { type: 'send_whatsapp', status: 'failed', error: 'Invalid phone number' }
                ]
            }
        ];
    }

    /**
     * Get all trigger definitions
     * @param {object} options - Additional options
     * @returns {Array} Trigger definitions
     */
    async getTriggerDefinitions(options = {}) {
        let results = [...this.triggerDefinitions];

        if (options.category) {
            results = results.filter(t => t.category === options.category);
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
     * Get all action definitions
     * @param {object} options - Additional options
     * @returns {Array} Action definitions
     */
    async getActionDefinitions(options = {}) {
        let results = [...this.actionDefinitions];

        if (options.category) {
            results = results.filter(a => a.category === options.category);
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
     * Create a new trigger
     * @param {object} data - Trigger data
     * @param {object} options - Additional options
     * @returns {object} Created trigger
     */
    async createTrigger(data, options = {}) {
        // In production, this would store in database
        // For MVP, return created trigger
        const trigger = {
            id: 'trigger_' + Date.now(),
            type: data.type,
            name: data.name,
            description: data.description || '',
            category: data.category || 'custom',
            priority: data.priority || 100,
            params: data.params || [],
            isActive: data.isActive !== false,
            isSystem: false,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.triggerDefinitions.push(trigger);
        this.cache.triggers.set(trigger.id, trigger);

        this.stats.totalTriggers++;

        return { ...trigger };
    }

    /**
     * Update a trigger
     * @param {string} id - Trigger ID
     * @param {object} data - Updated trigger data
     * @param {object} options - Additional options
     * @returns {object} Updated trigger
     */
    async updateTrigger(id, data, options = {}) {
        const index = this.triggerDefinitions.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Trigger ${id} not found`);
        }

        const trigger = this.triggerDefinitions[index];
        if (trigger.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system trigger');
        }

        Object.assign(trigger, data);
        trigger.updatedAt = new Date().toISOString();
        this.triggerDefinitions[index] = trigger;
        this.cache.triggers.set(id, trigger);

        return { ...trigger };
    }

    /**
     * Delete a trigger
     * @param {string} id - Trigger ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTrigger(id, options = {}) {
        const index = this.triggerDefinitions.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Trigger ${id} not found`);
        }

        const trigger = this.triggerDefinitions[index];
        if (trigger.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system trigger');
        }

        this.triggerDefinitions.splice(index, 1);
        this.cache.triggers.delete(id);
        this.stats.totalTriggers = Math.max(0, this.stats.totalTriggers - 1);

        return true;
    }

    /**
     * Get triggers with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of triggers
     */
    async getTriggers(filters = {}, options = {}) {
        let results = [...this.triggerDefinitions];

        if (filters.category) {
            results = results.filter(t => t.category === filters.category);
        }

        if (filters.isActive !== undefined) {
            results = results.filter(t => t.isActive === filters.isActive);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(t =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.type.toLowerCase().includes(searchTerm)
            );
        }

        results.sort((a, b) => a.priority - b.priority);

        return results.map(t => ({ ...t }));
    }

    /**
     * Get workflow statistics
     * @param {object} options - Additional options
     * @returns {object} Workflow statistics
     */
    async getWorkflowStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantWorkflows = workflows.filter(w => w.tenantId === tenantId);

        const stats = {
            total: tenantWorkflows.length,
            active: tenantWorkflows.filter(w => w.status === 'active' && w.isActive).length,
            paused: tenantWorkflows.filter(w => w.status === 'paused').length,
            byTrigger: {},
            totalExecutions: 0,
            successRate: 0
        };

        let totalExecutions = 0;
        let successCount = 0;

        for (const workflow of tenantWorkflows) {
            stats.byTrigger[workflow.triggerType] = (stats.byTrigger[workflow.triggerType] || 0) + 1;
            totalExecutions += workflow.executionCount || 0;
            successCount += workflow.successCount || 0;
        }

        stats.totalExecutions = totalExecutions;
        stats.successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;

        return stats;
    }

    /**
     * Get automation statistics
     * @param {object} options - Additional options
     * @returns {object} Automation statistics
     */
    async getAutomationStats(options = {}) {
        return {
            ...this.stats,
            triggers: this.triggerDefinitions.length,
            actions: this.actionDefinitions.length,
            config: this.config,
            cache: {
                workflows: this.cache.workflows.size,
                triggers: this.cache.triggers.size,
                actions: this.cache.actions.size
            },
            queue: {
                size: this.processingQueue.length,
                isProcessing: this.isProcessing
            }
        };
    }

    /**
     * Validate workflow data
     * @param {object} data - Workflow data
     * @throws {Error} If validation fails
     */
    validateWorkflowData(data) {
        if (!data.name) {
            throw new Error('Workflow name is required');
        }
        if (!data.triggerType) {
            throw new Error('Trigger type is required');
        }
        if (data.actions && data.actions.length === 0) {
            throw new Error('At least one action is required');
        }
        if (data.actions && data.actions.length > this.config.maxActionsPerWorkflow) {
            throw new Error(`Maximum actions per workflow (${this.config.maxActionsPerWorkflow}) exceeded`);
        }
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = 'id') {
        idCounter++;
        return `${prefix}_${idCounter}`;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Automation] Debug mode enabled');
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
        logger.info('Automation module cleaned up');
    }
}

// Create and export singleton instance
export const automationModule = new AutomationModule();

// Export class for testing
export default AutomationModule;
