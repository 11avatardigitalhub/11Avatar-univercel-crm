/**
 * ==========================================
 * FILE: workflowBuilder.js
 * MODULE: Automation Module
 * CODE: AUTO-2
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Workflow builder for creating and managing automation workflows.
 * Provides drag-drop interface, validation, and workflow configuration.
 * 
 * DEPENDENCIES:
 * - automationModule.js (for workflow operations)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - createWorkflow(data): Create a new workflow from builder
 * - updateWorkflow(id, data): Update a workflow
 * - validateWorkflow(workflowData): Validate workflow configuration
 * - getWorkflowTemplate(type): Get workflow template
 * - getWorkflowTemplates(): Get all templates
 * - saveTemplate(data): Save a custom template
 * - deleteTemplate(id): Delete a template
 * - getWorkflowPreview(id): Get workflow preview
 * - testWorkflow(id, testData): Test a workflow
 * - duplicateWorkflow(id): Duplicate an existing workflow
 * - exportWorkflow(id): Export workflow as JSON
 * - importWorkflow(data): Import workflow from JSON
 * - getWorkflowDiagram(id): Get workflow diagram data
 * - validateConnections(nodes, edges): Validate workflow connections
 * - getAvailableTriggers(): Get available triggers
 * - getAvailableActions(): Get available actions
 * - getAvailableConditions(): Get available conditions
 * 
 * USAGE EXAMPLE:
 * import { workflowBuilder } from './modules/automation/workflowBuilder.js';
 * 
 * // Create a workflow from builder
 * const workflow = await workflowBuilder.createWorkflow({
 *   name: 'Lead Follow-up',
 *   description: 'Auto follow-up for new leads',
 *   nodes: [
 *     { id: 'trigger_1', type: 'trigger', config: { event: 'lead.created' } },
 *     { id: 'action_1', type: 'action', config: { type: 'send_whatsapp', template: 'welcome' } },
 *     { id: 'action_2', type: 'action', config: { type: 'create_task', title: 'Follow up' } }
 *   ],
 *   edges: [
 *     { source: 'trigger_1', target: 'action_1' },
 *     { source: 'action_1', target: 'action_2' }
 *   ]
 * });
 * 
 * // Test a workflow
 * const result = await workflowBuilder.testWorkflow('wf_123', {
 *   leadId: 'lead_456',
 *   userId: 'user_789'
 * });
 * ==========================================
 */

import { automationModule } from './module.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let workflowTemplates = [];
let workflowDiagrams = new Map();
let idCounter = 1000;

// Available node types
const NODE_TYPES = {
    TRIGGER: 'trigger',
    ACTION: 'action',
    CONDITION: 'condition',
    DELAY: 'delay',
    BRANCH: 'branch',
    MERGE: 'merge',
    LOOP: 'loop',
    END: 'end'
};

// Default workflow templates
const DEFAULT_TEMPLATES = [
    {
        id: 'template_lead_followup',
        name: 'Lead Follow-up',
        description: 'Auto follow-up for new leads',
        category: 'lead',
        nodes: [
            { id: 'trigger_1', type: 'trigger', config: { event: 'lead.created' } },
            { id: 'action_1', type: 'action', config: { type: 'send_whatsapp', template: 'welcome' } },
            { id: 'delay_1', type: 'delay', config: { duration: 3600 } },
            { id: 'action_2', type: 'action', config: { type: 'create_task', title: 'Follow up', priority: 'high' } }
        ],
        edges: [
            { source: 'trigger_1', target: 'action_1' },
            { source: 'action_1', target: 'delay_1' },
            { source: 'delay_1', target: 'action_2' }
        ],
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_lead_conversion',
        name: 'Lead Conversion',
        description: 'Convert qualified leads to customers',
        category: 'lead',
        nodes: [
            { id: 'trigger_1', type: 'trigger', config: { event: 'lead.updated', field: 'status', value: 'qualified' } },
            { id: 'condition_1', type: 'condition', config: { field: 'score', operator: '>=', value: 70 } },
            { id: 'action_1', type: 'action', config: { type: 'convert_lead' } },
            { id: 'action_2', type: 'action', config: { type: 'send_email', template: 'welcome_customer' } },
            { id: 'action_3', type: 'action', config: { type: 'create_deal' } }
        ],
        edges: [
            { source: 'trigger_1', target: 'condition_1' },
            { source: 'condition_1', target: 'action_1' },
            { source: 'action_1', target: 'action_2' },
            { source: 'action_2', target: 'action_3' }
        ],
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_deal_won',
        name: 'Deal Won',
        description: 'Actions when a deal is won',
        category: 'deal',
        nodes: [
            { id: 'trigger_1', type: 'trigger', config: { event: 'deal.won' } },
            { id: 'action_1', type: 'action', config: { type: 'generate_invoice' } },
            { id: 'action_2', type: 'action', config: { type: 'send_email', template: 'deal_won' } },
            { id: 'action_3', type: 'action', config: { type: 'create_task', title: 'Implementation Kickoff', priority: 'high' } }
        ],
        edges: [
            { source: 'trigger_1', target: 'action_1' },
            { source: 'action_1', target: 'action_2' },
            { source: 'action_2', target: 'action_3' }
        ],
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_task_reminder',
        name: 'Task Reminder',
        description: 'Send reminders for due tasks',
        category: 'task',
        nodes: [
            { id: 'trigger_1', type: 'trigger', config: { event: 'task.due', daysBefore: 1 } },
            { id: 'action_1', type: 'action', config: { type: 'send_email', template: 'task_reminder' } },
            { id: 'action_2', type: 'action', config: { type: 'send_whatsapp', message: 'Task due tomorrow!' } }
        ],
        edges: [
            { source: 'trigger_1', target: 'action_1' },
            { source: 'action_1', target: 'action_2' }
        ],
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_invoice_payment',
        name: 'Invoice Payment',
        description: 'Actions when invoice is paid',
        category: 'invoice',
        nodes: [
            { id: 'trigger_1', type: 'trigger', config: { event: 'invoice.paid' } },
            { id: 'action_1', type: 'action', config: { type: 'send_email', template: 'payment_receipt' } },
            { id: 'action_2', type: 'action', config: { type: 'create_note', content: 'Invoice paid successfully' } }
        ],
        edges: [
            { source: 'trigger_1', target: 'action_1' },
            { source: 'action_1', target: 'action_2' }
        ],
        isSystem: true,
        createdAt: new Date().toISOString()
    }
];

class WorkflowBuilder {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            maxNodesPerWorkflow: 50,
            maxEdgesPerWorkflow: 100,
            maxTemplatesPerTenant: 50,
            enableValidation: true,
            enableTesting: true,
            enableExport: true,
            enableImport: true,
            autoSaveInterval: 30000,
            maxDiagramHistory: 10
        };
        
        // Cache
        this.cache = {
            templates: new Map(),
            diagrams: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Diagram history for undo/redo
        this.diagramHistory = new Map();
        this.historyIndex = new Map();
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with default templates
        this.initDefaultTemplates();
    }

    /**
     * Initialize default templates
     */
    initDefaultTemplates() {
        for (const template of DEFAULT_TEMPLATES) {
            workflowTemplates.push(template);
            this.cache.templates.set(template.id, template);
        }
    }

    /**
     * Initialize workflow builder
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

            logger.info('Workflow builder initialized', {
                templates: workflowTemplates.length,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Workflow builder initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create a new workflow from builder
     * @param {object} data - Workflow data from builder
     * @param {object} options - Additional options
     * @returns {object} Created workflow
     */
    async createWorkflow(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Workflow builder not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate workflow data
        this.validateWorkflowData(data);

        // Convert builder format to workflow format
        const workflowData = this.convertBuilderToWorkflow(data);

        // Create workflow via automation module
        const workflow = await automationModule.createWorkflow(workflowData, {
            userId: options.userId || 'system'
        });

        // Save diagram for future editing
        await this.saveDiagram(workflow.id, {
            nodes: data.nodes || [],
            edges: data.edges || [],
            metadata: data.metadata || {}
        });

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.builder.created',
            'automation',
            { workflowId: workflow.id, name: workflow.name }
        );

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Workflow created: ${workflow.id}`);
        }

        return workflow;
    }

    /**
     * Update a workflow from builder
     * @param {string} id - Workflow ID
     * @param {object} data - Updated workflow data
     * @param {object} options - Additional options
     * @returns {object} Updated workflow
     */
    async updateWorkflow(id, data, options = {}) {
        if (!this.initialized) {
            throw new Error('Workflow builder not initialized');
        }

        // Validate workflow data
        this.validateWorkflowData(data);

        // Convert builder format to workflow format
        const workflowData = this.convertBuilderToWorkflow(data);

        // Update workflow via automation module
        const workflow = await automationModule.updateWorkflow(id, workflowData, {
            userId: options.userId || 'system'
        });

        // Update diagram
        await this.saveDiagram(id, {
            nodes: data.nodes || [],
            edges: data.edges || [],
            metadata: data.metadata || {}
        });

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.builder.updated',
            'automation',
            { workflowId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Workflow updated: ${id}`);
        }

        return workflow;
    }

    /**
     * Validate workflow configuration
     * @param {object} workflowData - Workflow data to validate
     * @returns {object} Validation result
     */
    validateWorkflow(workflowData) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        if (!workflowData.name) {
            result.valid = false;
            result.errors.push('Workflow name is required');
        }

        // Check nodes
        if (!workflowData.nodes || workflowData.nodes.length === 0) {
            result.valid = false;
            result.errors.push('At least one node is required');
        }

        if (workflowData.nodes && workflowData.nodes.length > this.config.maxNodesPerWorkflow) {
            result.valid = false;
            result.errors.push(`Maximum nodes per workflow (${this.config.maxNodesPerWorkflow}) exceeded`);
        }

        // Check edges
        if (workflowData.edges && workflowData.edges.length > this.config.maxEdgesPerWorkflow) {
            result.valid = false;
            result.errors.push(`Maximum edges per workflow (${this.config.maxEdgesPerWorkflow}) exceeded`);
        }

        // Check each node
        if (workflowData.nodes) {
            const nodeIds = new Set();
            const triggerCount = workflowData.nodes.filter(n => n.type === 'trigger').length;
            const endCount = workflowData.nodes.filter(n => n.type === 'end').length;

            for (const node of workflowData.nodes) {
                // Check duplicate IDs
                if (nodeIds.has(node.id)) {
                    result.valid = false;
                    result.errors.push(`Duplicate node ID: ${node.id}`);
                }
                nodeIds.add(node.id);

                // Check node type
                if (!Object.values(NODE_TYPES).includes(node.type)) {
                    result.valid = false;
                    result.errors.push(`Invalid node type: ${node.type}`);
                }

                // Check trigger count
                if (node.type === 'trigger' && triggerCount > 1) {
                    result.warnings.push('Multiple triggers found. Only the first trigger will be used.');
                }

                // Check end node
                if (node.type === 'end' && endCount > 1) {
                    result.warnings.push('Multiple end nodes found. All paths will terminate.');
                }

                // Validate node config
                const nodeValidation = this.validateNodeConfig(node);
                if (!nodeValidation.valid) {
                    result.valid = false;
                    result.errors.push(...nodeValidation.errors);
                }
                if (nodeValidation.warnings) {
                    result.warnings.push(...nodeValidation.warnings);
                }
            }
        }

        // Check edges
        if (workflowData.edges) {
            const nodeIds = new Set((workflowData.nodes || []).map(n => n.id));
            for (const edge of workflowData.edges) {
                // Check source and target exist
                if (!nodeIds.has(edge.source)) {
                    result.valid = false;
                    result.errors.push(`Source node not found: ${edge.source}`);
                }
                if (!nodeIds.has(edge.target)) {
                    result.valid = false;
                    result.errors.push(`Target node not found: ${edge.target}`);
                }
            }

            // Check for orphan nodes
            const connectedNodes = new Set();
            for (const edge of workflowData.edges) {
                connectedNodes.add(edge.source);
                connectedNodes.add(edge.target);
            }
            for (const nodeId of nodeIds) {
                if (!connectedNodes.has(nodeId)) {
                    result.warnings.push(`Orphan node: ${nodeId}`);
                }
            }
        }

        return result;
    }

    /**
     * Validate node configuration
     * @param {object} node - Node to validate
     * @returns {object} Validation result
     */
    validateNodeConfig(node) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        switch (node.type) {
            case 'trigger':
                if (!node.config || !node.config.event) {
                    result.valid = false;
                    result.errors.push('Trigger requires an event');
                }
                break;
            case 'action':
                if (!node.config || !node.config.type) {
                    result.valid = false;
                    result.errors.push('Action requires a type');
                }
                break;
            case 'condition':
                if (!node.config || !node.config.field || !node.config.operator) {
                    result.valid = false;
                    result.errors.push('Condition requires field and operator');
                }
                break;
            case 'delay':
                if (!node.config || !node.config.duration) {
                    result.valid = false;
                    result.errors.push('Delay requires duration');
                }
                if (node.config.duration && node.config.duration < 0) {
                    result.valid = false;
                    result.errors.push('Delay duration must be positive');
                }
                break;
            case 'branch':
                if (!node.config || !node.config.conditions || node.config.conditions.length < 2) {
                    result.valid = false;
                    result.errors.push('Branch requires at least 2 conditions');
                }
                break;
            case 'loop':
                if (!node.config || !node.config.maxIterations) {
                    result.valid = false;
                    result.errors.push('Loop requires max iterations');
                }
                if (node.config.maxIterations && node.config.maxIterations > 100) {
                    result.warnings.push('Loop iterations exceed 100, may impact performance');
                }
                break;
            case 'merge':
                // Merge nodes don't require specific config
                break;
            case 'end':
                // End nodes don't require specific config
                break;
            default:
                result.valid = false;
                result.errors.push(`Unknown node type: ${node.type}`);
        }

        return result;
    }

    /**
     * Validate workflow connections
     * @param {Array} nodes - Workflow nodes
     * @param {Array} edges - Workflow edges
     * @returns {object} Validation result
     */
    validateConnections(nodes, edges) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Build graph
        const graph = new Map();
        const nodeIds = new Set(nodes.map(n => n.id));

        for (const edge of edges) {
            if (!graph.has(edge.source)) {
                graph.set(edge.source, []);
            }
            graph.get(edge.source).push(edge.target);
        }

        // Check for cycles
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (nodeId) => {
            if (recursionStack.has(nodeId)) {
                return true;
            }
            if (visited.has(nodeId)) {
                return false;
            }
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = graph.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (hasCycle(neighbor)) {
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of nodeIds) {
            if (!visited.has(nodeId)) {
                if (hasCycle(nodeId)) {
                    result.valid = false;
                    result.errors.push('Workflow contains cycles');
                    break;
                }
            }
        }

        // Check for trigger node
        const triggerNodes = nodes.filter(n => n.type === 'trigger');
        if (triggerNodes.length === 0) {
            result.valid = false;
            result.errors.push('Workflow must have at least one trigger node');
        }

        // Check for reachable nodes
        const reachable = new Set();
        const queue = [];

        // Start from trigger nodes
        for (const node of triggerNodes) {
            queue.push(node.id);
        }

        while (queue.length > 0) {
            const current = queue.shift();
            if (reachable.has(current)) continue;
            reachable.add(current);

            const neighbors = graph.get(current) || [];
            for (const neighbor of neighbors) {
                if (!reachable.has(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }

        // Check for unreachable nodes
        for (const nodeId of nodeIds) {
            if (!reachable.has(nodeId) && nodes.find(n => n.id === nodeId).type !== 'trigger') {
                result.warnings.push(`Unreachable node: ${nodeId}`);
            }
        }

        return result;
    }

    /**
     * Convert builder format to workflow format
     * @param {object} builderData - Builder data
     * @returns {object} Workflow data
     */
    convertBuilderToWorkflow(builderData) {
        const workflowData = {
            name: builderData.name,
            description: builderData.description || '',
            triggerType: 'event',
            triggerConfig: {},
            actions: [],
            conditions: []
        };

        // Find trigger node
        const triggerNode = (builderData.nodes || []).find(n => n.type === 'trigger');
        if (triggerNode) {
            workflowData.triggerType = triggerNode.config.event || 'event';
            workflowData.triggerConfig = triggerNode.config;
        }

        // Find action nodes
        const actionNodes = (builderData.nodes || []).filter(n => n.type === 'action');
        for (const node of actionNodes) {
            workflowData.actions.push({
                type: node.config.type,
                config: node.config
            });
        }

        // Find condition nodes
        const conditionNodes = (builderData.nodes || []).filter(n => n.type === 'condition');
        for (const node of conditionNodes) {
            workflowData.conditions.push({
                field: node.config.field,
                operator: node.config.operator,
                value: node.config.value
            });
        }

        return workflowData;
    }

    /**
     * Save workflow diagram
     * @param {string} workflowId - Workflow ID
     * @param {object} diagram - Diagram data
     * @returns {boolean} Success status
     */
    async saveDiagram(workflowId, diagram) {
        this.cache.diagrams.set(workflowId, diagram);
        this.cacheTimestamps.set(workflowId, Date.now());

        // Save to history
        if (!this.diagramHistory.has(workflowId)) {
            this.diagramHistory.set(workflowId, []);
            this.historyIndex.set(workflowId, -1);
        }

        const history = this.diagramHistory.get(workflowId);
        const index = this.historyIndex.get(workflowId);

        // Remove any future history if we're not at the end
        if (index < history.length - 1) {
            history.splice(index + 1);
        }

        history.push(JSON.parse(JSON.stringify(diagram)));
        this.historyIndex.set(workflowId, history.length - 1);

        // Limit history size
        if (history.length > this.config.maxDiagramHistory) {
            history.shift();
            this.historyIndex.set(workflowId, history.length - 1);
        }

        return true;
    }

    /**
     * Get workflow diagram
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Diagram data
     */
    async getWorkflowDiagram(workflowId, options = {}) {
        // Check cache
        if (this.cache.diagrams.has(workflowId)) {
            const cached = this.cache.diagrams.get(workflowId);
            const timestamp = this.cacheTimestamps.get(workflowId) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.diagrams.delete(workflowId);
            this.cacheTimestamps.delete(workflowId);
        }

        // In production, this would fetch from storage
        // For MVP, return empty diagram
        return {
            nodes: [],
            edges: [],
            metadata: {}
        };
    }

    /**
     * Get workflow preview
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Workflow preview
     */
    async getWorkflowPreview(workflowId, options = {}) {
        const workflow = await automationModule.getWorkflow(workflowId);
        const diagram = await this.getWorkflowDiagram(workflowId);

        return {
            workflow: workflow,
            diagram: diagram,
            preview: {
                trigger: workflow.triggerType,
                actions: workflow.actions.length,
                conditions: workflow.conditions.length,
                nodes: diagram.nodes ? diagram.nodes.length : 0,
                edges: diagram.edges ? diagram.edges.length : 0
            }
        };
    }

    /**
     * Test a workflow
     * @param {string} workflowId - Workflow ID
     * @param {object} testData - Test data
     * @param {object} options - Additional options
     * @returns {object} Test results
     */
    async testWorkflow(workflowId, testData = {}, options = {}) {
        if (!this.config.enableTesting) {
            throw new Error('Workflow testing is disabled');
        }

        const workflow = await automationModule.getWorkflow(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        // Simulate workflow execution with test data
        const result = {
            workflowId: workflowId,
            testData: testData,
            startedAt: new Date().toISOString(),
            completedAt: null,
            success: false,
            steps: [],
            errors: [],
            warnings: []
        };

        try {
            // Get diagram
            const diagram = await this.getWorkflowDiagram(workflowId);
            const nodes = diagram.nodes || [];
            const edges = diagram.edges || [];

            // Find trigger node
            const triggerNode = nodes.find(n => n.type === 'trigger');
            if (!triggerNode) {
                result.errors.push('No trigger node found');
                return result;
            }

            // Build execution path
            const path = this.buildExecutionPath(nodes, edges, triggerNode.id);
            result.steps = path;

            // Simulate execution
            let currentData = { ...testData };
            for (const step of path) {
                const node = nodes.find(n => n.id === step);
                if (!node) continue;

                try {
                    const stepResult = await this.simulateNodeExecution(node, currentData);
                    currentData = { ...currentData, ...stepResult.data };
                    step.result = stepResult;
                } catch (error) {
                    step.error = error.message;
                    result.errors.push(`Node ${node.id} failed: ${error.message}`);
                    break;
                }
            }

            result.success = result.errors.length === 0;
            result.completedAt = new Date().toISOString();

        } catch (error) {
            result.success = false;
            result.errors.push(error.message);
            result.completedAt = new Date().toISOString();
        }

        return result;
    }

    /**
     * Build execution path from nodes and edges
     * @param {Array} nodes - Workflow nodes
     * @param {Array} edges - Workflow edges
     * @param {string} startNodeId - Starting node ID
     * @returns {Array} Execution path
     */
    buildExecutionPath(nodes, edges, startNodeId) {
        const path = [];
        const visited = new Set();
        const queue = [startNodeId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            path.push(current);

            const outgoingEdges = edges.filter(e => e.source === current);
            for (const edge of outgoingEdges) {
                if (!visited.has(edge.target)) {
                    queue.push(edge.target);
                }
            }
        }

        return path;
    }

    /**
     * Simulate node execution
     * @param {object} node - Node to execute
     * @param {object} data - Current data
     * @returns {object} Execution result
     */
    async simulateNodeExecution(node, data) {
        // Simulate node execution based on type
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = {
            nodeId: node.id,
            type: node.type,
            success: true,
            data: { ...data }
        };

        switch (node.type) {
            case 'trigger':
                result.message = `Triggered by ${node.config.event || 'event'}`;
                break;
            case 'action':
                result.message = `Executed action: ${node.config.type || 'unknown'}`;
                break;
            case 'condition':
                const fieldValue = data[node.config.field] || 0;
                const conditionMet = this.evaluateCondition(fieldValue, node.config.operator, node.config.value);
                result.message = `Condition ${conditionMet ? 'met' : 'not met'}`;
                result.conditionMet = conditionMet;
                break;
            case 'delay':
                result.message = `Delayed for ${node.config.duration || 0} seconds`;
                break;
            case 'branch':
                result.message = `Branch executed`;
                break;
            case 'loop':
                result.message = `Loop iteration ${data.iteration || 1}`;
                break;
            case 'merge':
                result.message = `Merged paths`;
                break;
            case 'end':
                result.message = `Workflow completed`;
                break;
            default:
                result.message = `Unknown node type: ${node.type}`;
        }

        return result;
    }

    /**
     * Evaluate condition
     * @param {*} value - Value to evaluate
     * @param {string} operator - Comparison operator
     * @param {*} compareValue - Value to compare against
     * @returns {boolean} Condition result
     */
    evaluateCondition(value, operator, compareValue) {
        switch (operator) {
            case '==':
            case '=':
                return value == compareValue;
            case '!=':
            case '<>':
                return value != compareValue;
            case '>':
                return value > compareValue;
            case '>=':
                return value >= compareValue;
            case '<':
                return value < compareValue;
            case '<=':
                return value <= compareValue;
            case 'contains':
                return String(value).includes(String(compareValue));
            case 'startsWith':
                return String(value).startsWith(String(compareValue));
            case 'endsWith':
                return String(value).endsWith(String(compareValue));
            case 'in':
                return Array.isArray(compareValue) ? compareValue.includes(value) : false;
            case 'notIn':
                return Array.isArray(compareValue) ? !compareValue.includes(value) : true;
            default:
                return false;
        }
    }

    /**
     * Duplicate a workflow
     * @param {string} workflowId - Workflow ID to duplicate
     * @param {object} options - Additional options
     * @returns {object} Duplicated workflow
     */
    async duplicateWorkflow(workflowId, options = {}) {
        const workflow = await automationModule.getWorkflow(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        const diagram = await this.getWorkflowDiagram(workflowId);

        // Create new workflow with duplicated data
        const newWorkflow = await this.createWorkflow({
            name: `${workflow.name} (Copy)`,
            description: workflow.description,
            nodes: diagram.nodes || [],
            edges: diagram.edges || [],
            metadata: { originalId: workflowId, duplicatedAt: new Date().toISOString() }
        }, { userId: options.userId || 'system' });

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Workflow duplicated: ${workflowId} -> ${newWorkflow.id}`);
        }

        return newWorkflow;
    }

    /**
     * Export workflow as JSON
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {string} JSON export
     */
    async exportWorkflow(workflowId, options = {}) {
        if (!this.config.enableExport) {
            throw new Error('Workflow export is disabled');
        }

        const workflow = await automationModule.getWorkflow(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        const diagram = await this.getWorkflowDiagram(workflowId);

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            workflow: {
                name: workflow.name,
                description: workflow.description,
                triggerType: workflow.triggerType,
                triggerConfig: workflow.triggerConfig,
                actions: workflow.actions,
                conditions: workflow.conditions,
                priority: workflow.priority
            },
            diagram: diagram,
            metadata: {
                exportedBy: options.userId || 'system',
                sourceId: workflowId
            }
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import workflow from JSON
     * @param {string} data - JSON data
     * @param {object} options - Additional options
     * @returns {object} Imported workflow
     */
    async importWorkflow(data, options = {}) {
        if (!this.config.enableImport) {
            throw new Error('Workflow import is disabled');
        }

        let importData;
        try {
            importData = JSON.parse(data);
        } catch (error) {
            throw new Error('Invalid JSON data');
        }

        if (!importData.workflow || !importData.diagram) {
            throw new Error('Invalid import data structure');
        }

        // Create workflow from imported data
        const workflow = await this.createWorkflow({
            name: importData.workflow.name,
            description: importData.workflow.description || '',
            nodes: importData.diagram.nodes || [],
            edges: importData.diagram.edges || [],
            metadata: {
                importedFrom: importData.metadata?.sourceId || null,
                importedAt: new Date().toISOString()
            }
        }, { userId: options.userId || 'system' });

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Workflow imported: ${workflow.id}`);
        }

        return workflow;
    }

    /**
     * Get workflow templates
     * @param {object} options - Additional options
     * @returns {Array} List of templates
     */
    async getWorkflowTemplates(options = {}) {
        let results = [...workflowTemplates];

        if (options.category) {
            results = results.filter(t => t.category === options.category);
        }

        if (options.isSystem !== undefined) {
            results = results.filter(t => t.isSystem === options.isSystem);
        }

        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            results = results.filter(t =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.description.toLowerCase().includes(searchTerm)
            );
        }

        return results.map(t => ({ ...t }));
    }

    /**
     * Get a workflow template by ID
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {object} Template
     */
    async getWorkflowTemplate(id, options = {}) {
        // Check cache
        if (this.cache.templates.has(id)) {
            return { ...this.cache.templates.get(id) };
        }

        const template = workflowTemplates.find(t => t.id === id);
        if (!template) {
            throw new Error(`Template ${id} not found`);
        }

        this.cache.templates.set(id, template);
        return { ...template };
    }

    /**
     * Save a custom template
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Saved template
     */
    async saveTemplate(data, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate template data
        if (!data.name) {
            throw new Error('Template name is required');
        }
        if (!data.nodes || data.nodes.length === 0) {
            throw new Error('Template must have at least one node');
        }

        // Check tenant limit
        const tenantTemplates = workflowTemplates.filter(t => t.tenantId === tenantId);
        if (tenantTemplates.length >= this.config.maxTemplatesPerTenant) {
            throw new Error(`Maximum templates per tenant (${this.config.maxTemplatesPerTenant}) reached`);
        }

        // Create template
        const template = {
            id: 'template_' + Date.now(),
            tenantId: tenantId,
            name: data.name,
            description: data.description || '',
            category: data.category || 'custom',
            nodes: data.nodes || [],
            edges: data.edges || [],
            isSystem: false,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        workflowTemplates.push(template);
        this.cache.templates.set(template.id, template);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.template.saved',
            'automation',
            { templateId: template.id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Template saved: ${template.id}`);
        }

        return { ...template };
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTemplate(id, options = {}) {
        const index = workflowTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = workflowTemplates[index];
        if (template.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system template');
        }

        workflowTemplates.splice(index, 1);
        this.cache.templates.delete(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'workflow.template.deleted',
            'automation',
            { templateId: id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[WorkflowBuilder] Template deleted: ${id}`);
        }

        return true;
    }

    /**
     * Get available triggers for builder
     * @param {object} options - Additional options
     * @returns {Array} Available triggers
     */
    async getAvailableTriggers(options = {}) {
        const triggers = await automationModule.getTriggerDefinitions(options);
        return triggers.map(t => ({
            id: t.id,
            type: t.type,
            name: t.name,
            description: t.description,
            category: t.category,
            params: t.params
        }));
    }

    /**
     * Get available actions for builder
     * @param {object} options - Additional options
     * @returns {Array} Available actions
     */
    async getAvailableActions(options = {}) {
        const actions = await automationModule.getActionDefinitions(options);
        return actions.map(a => ({
            id: a.id,
            type: a.type,
            name: a.name,
            description: a.description,
            category: a.category,
            params: a.params
        }));
    }

    /**
     * Get available conditions for builder
     * @param {object} options - Additional options
     * @returns {Array} Available conditions
     */
    async getAvailableConditions(options = {}) {
        // Define available conditions
        const conditions = [
            { id: 'cond_lead_score', name: 'Lead Score', description: 'Check lead score', field: 'score', operators: ['>=', '<=', '>', '<', '=='] },
            { id: 'cond_lead_status', name: 'Lead Status', description: 'Check lead status', field: 'status', operators: ['==', '!='] },
            { id: 'cond_lead_source', name: 'Lead Source', description: 'Check lead source', field: 'source', operators: ['==', '!='] },
            { id: 'cond_deal_value', name: 'Deal Value', description: 'Check deal value', field: 'value', operators: ['>=', '<=', '>', '<', '=='] },
            { id: 'cond_deal_stage', name: 'Deal Stage', description: 'Check deal stage', field: 'stage', operators: ['==', '!='] },
            { id: 'cond_task_priority', name: 'Task Priority', description: 'Check task priority', field: 'priority', operators: ['==', '!='] },
            { id: 'cond_invoice_amount', name: 'Invoice Amount', description: 'Check invoice amount', field: 'amount', operators: ['>=', '<=', '>', '<', '=='] },
            { id: 'cond_customer_industry', name: 'Customer Industry', description: 'Check customer industry', field: 'industry', operators: ['==', '!='] },
            { id: 'cond_custom_field', name: 'Custom Field', description: 'Check custom field value', field: 'custom', operators: ['==', '!=', 'contains', 'startsWith', 'endsWith'] }
        ];

        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            return conditions.filter(c =>
                c.name.toLowerCase().includes(searchTerm) ||
                c.description.toLowerCase().includes(searchTerm)
            );
        }

        return conditions;
    }

    /**
     * Undo diagram change
     * @param {string} workflowId - Workflow ID
     * @returns {object} Previous diagram state
     */
    async undoDiagram(workflowId) {
        if (!this.diagramHistory.has(workflowId)) {
            return null;
        }

        const history = this.diagramHistory.get(workflowId);
        const index = this.historyIndex.get(workflowId);

        if (index <= 0) {
            return null;
        }

        this.historyIndex.set(workflowId, index - 1);
        const diagram = history[index - 1];
        await this.saveDiagram(workflowId, diagram);

        return { ...diagram };
    }

    /**
     * Redo diagram change
     * @param {string} workflowId - Workflow ID
     * @returns {object} Next diagram state
     */
    async redoDiagram(workflowId) {
        if (!this.diagramHistory.has(workflowId)) {
            return null;
        }

        const history = this.diagramHistory.get(workflowId);
        const index = this.historyIndex.get(workflowId);

        if (index >= history.length - 1) {
            return null;
        }

        this.historyIndex.set(workflowId, index + 1);
        const diagram = history[index + 1];
        await this.saveDiagram(workflowId, diagram);

        return { ...diagram };
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[WorkflowBuilder] Debug mode enabled');
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
        this.cache.templates.clear();
        this.cache.diagrams.clear();
        this.cacheTimestamps.clear();
        this.diagramHistory.clear();
        this.historyIndex.clear();
        logger.info('Workflow builder cleaned up');
    }
}

// Create and export singleton instance
export const workflowBuilder = new WorkflowBuilder();

// Export class for testing
export default WorkflowBuilder;
