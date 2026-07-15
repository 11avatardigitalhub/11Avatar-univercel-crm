/**
 * ==========================================
 * FILE: workflowEngine.js
 * MODULE: Automation Module
 * CODE: AUTO-3
 * PRIORITY: P0
 * PHASE: 2
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Workflow execution engine that processes workflows,
 * manages state, handles errors, and ensures reliable execution.
 * 
 * DEPENDENCIES:
 * - automationModule.js (for workflow data)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - workflowQueue.js (for queuing)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize workflow engine
 * - execute(workflowId, context): Execute a workflow
 * - executeAsync(workflowId, context): Execute asynchronously
 * - cancelExecution(executionId): Cancel a running execution
 * - getExecutionStatus(executionId): Get execution status
 * - getExecutionHistory(workflowId): Get execution history
 * - pauseExecution(executionId): Pause execution
 * - resumeExecution(executionId): Resume execution
 * - retryExecution(executionId): Retry failed execution
 * - getNodeExecutionResult(executionId, nodeId): Get node result
 * - getExecutionMetrics(): Get execution metrics
 * - validateWorkflow(workflowId): Validate workflow before execution
 * - getExecutionContext(executionId): Get execution context
 * - updateExecutionContext(executionId, data): Update execution context
 * - getExecutionStats(workflowId): Get execution statistics
 * 
 * USAGE EXAMPLE:
 * import { workflowEngine } from './modules/automation/workflowEngine.js';
 * 
 * // Execute a workflow
 * const execution = await workflowEngine.execute('wf_123', {
 *   leadId: 'lead_456',
 *   userId: 'user_789',
 *   data: { score: 85 }
 * });
 * 
 * // Check execution status
 * const status = await workflowEngine.getExecutionStatus(execution.id);
 * 
 * // Cancel execution
 * await workflowEngine.cancelExecution(execution.id);
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let executions = [];
let executionContexts = new Map();
let nodeResults = new Map();
let executionIdCounter = 1000;

// Execution status constants
const EXECUTION_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout',
    RETRYING: 'retrying'
};

// Node execution status
const NODE_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    TIMEOUT: 'timeout'
};

class WorkflowEngine {
    constructor() {
        // Service state
        this.initialized = false;
        this.isProcessing = false;
        this.activeExecutions = new Map();
        this.executionTimeouts = new Map();
        
        // Configuration
        this.config = {
            maxConcurrentExecutions: 50,
            maxExecutionTime: 3600000, // 1 hour
            maxRetries: 3,
            retryDelay: 5000,
            nodeTimeout: 60000, // 1 minute per node
            enableCaching: true,
            enableMetrics: true,
            enableAuditLogging: true,
            enableStatePersistence: true,
            defaultTimeout: 300000 // 5 minutes
        };
        
        // Cache
        this.cache = {
            workflows: new Map(),
            executions: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Metrics
        this.metrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            cancelledExecutions: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0,
            activeExecutions: 0,
            pendingExecutions: 0,
            byWorkflow: {},
            byStatus: {},
            nodeExecutionTime: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize
        this.initSampleData();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const now = new Date();
        const sampleExecutions = [
            {
                id: 'exec_1001',
                workflowId: 'wf_1',
                tenantId: 'tenant_1',
                status: 'completed',
                startedAt: new Date(now.getTime() - 3600000).toISOString(),
                completedAt: new Date(now.getTime() - 3550000).toISOString(),
                duration: 5000,
                context: { leadId: 'lead_123', userId: 'user_456' },
                nodes: [
                    { id: 'trigger_1', status: 'completed', duration: 100, result: 'triggered' },
                    { id: 'action_1', status: 'completed', duration: 200, result: 'success' },
                    { id: 'action_2', status: 'completed', duration: 150, result: 'success' }
                ],
                error: null,
                createdBy: 'system',
                createdAt: new Date(now.getTime() - 3600000).toISOString()
            },
            {
                id: 'exec_1002',
                workflowId: 'wf_1',
                tenantId: 'tenant_1',
                status: 'failed',
                startedAt: new Date(now.getTime() - 1800000).toISOString(),
                completedAt: new Date(now.getTime() - 1790000).toISOString(),
                duration: 1000,
                context: { leadId: 'lead_456', userId: 'user_789' },
                nodes: [
                    { id: 'trigger_1', status: 'completed', duration: 100, result: 'triggered' },
                    { id: 'action_1', status: 'failed', duration: 200, result: 'error', error: 'Invalid phone number' }
                ],
                error: 'Action failed: Invalid phone number',
                createdBy: 'system',
                createdAt: new Date(now.getTime() - 1800000).toISOString()
            }
        ];

        for (const exec of sampleExecutions) {
            executions.push(exec);
            this.cache.executions.set(exec.id, exec);
            this.updateMetrics(exec);
        }
    }

    /**
     * Initialize workflow engine
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
            this.startProcessor();

            logger.info('Workflow engine initialized', {
                maxConcurrent: this.config.maxConcurrentExecutions,
                maxExecutionTime: this.config.maxExecutionTime,
                nodeTimeout: this.config.nodeTimeout
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Workflow engine initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start the execution processor
     */
    startProcessor() {
        // Process pending executions every 5 seconds
        setInterval(() => {
            if (!this.initialized) return;
            if (this.isProcessing) return;
            this.processPendingExecutions();
        }, 5000);

        // Cleanup stale executions every minute
        setInterval(() => {
            if (!this.initialized) return;
            this.cleanupStaleExecutions();
        }, 60000);
    }

    /**
     * Process pending executions
     */
    async processPendingExecutions() {
        if (this.isProcessing) return;

        this.isProcessing = true;

        try {
            // Get pending executions
            const pending = executions.filter(e => e.status === 'pending' || e.status === 'retrying');
            
            // Sort by priority (createdAt)
            pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            // Process up to max concurrent
            const toProcess = pending.slice(0, this.config.maxConcurrentExecutions - this.activeExecutions.size);

            for (const execution of toProcess) {
                if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) break;
                await this.executeWorkflow(execution.id);
            }
        } catch (error) {
            logger.error('[WorkflowEngine] Error processing pending executions:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Cleanup stale executions
     */
    cleanupStaleExecutions() {
        const now = Date.now();

        for (const [executionId, startTime] of this.executionTimeouts) {
            if (now - startTime > this.config.maxExecutionTime) {
                this.cancelExecution(executionId, { reason: 'Execution timeout' });
            }
        }

        // Cleanup completed executions from active map
        for (const [executionId, execution] of this.activeExecutions) {
            if (execution.status === 'completed' || 
                execution.status === 'failed' || 
                execution.status === 'cancelled') {
                this.activeExecutions.delete(executionId);
                this.executionTimeouts.delete(executionId);
            }
        }
    }

    /**
     * Execute a workflow
     * @param {string} workflowId - Workflow ID
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {object} Execution result
     */
    async execute(workflowId, context = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Workflow engine not initialized');
        }

        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate workflow
        const workflow = await this.validateWorkflow(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found or invalid`);
        }

        // Create execution record
        const execution = {
            id: this.generateExecutionId(),
            workflowId: workflowId,
            tenantId: tenantId,
            status: 'pending',
            startedAt: new Date().toISOString(),
            completedAt: null,
            duration: 0,
            context: context,
            nodes: [],
            error: null,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            retryCount: 0,
            priority: options.priority || 1
        };

        // Store execution
        executions.push(execution);
        this.cache.executions.set(execution.id, execution);
        this.activeExecutions.set(execution.id, execution);
        this.executionTimeouts.set(execution.id, Date.now());

        // Update metrics
        this.metrics.totalExecutions++;
        this.metrics.pendingExecutions++;
        this.metrics.byStatus.pending = (this.metrics.byStatus.pending || 0) + 1;

        // Log to audit
        if (this.config.enableAuditLogging) {
            await auditLogger.log(
                options.userId || 'system',
                'workflow.execution.started',
                'automation',
                { executionId: execution.id, workflowId: workflowId }
            );
        }

        // Emit event
        eventBus.publish('workflow.execution.started', {
            executionId: execution.id,
            workflowId: workflowId,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[WorkflowEngine] Execution started: ${execution.id}`);
        }

        // Start execution
        this.executeWorkflow(execution.id).catch(error => {
            logger.error(`[WorkflowEngine] Execution failed: ${execution.id}`, error);
        });

        return { ...execution };
    }

    /**
     * Execute workflow asynchronously (non-blocking)
     * @param {string} workflowId - Workflow ID
     * @param {object} context - Execution context
     * @param {object} options - Additional options
     * @returns {string} Execution ID
     */
    async executeAsync(workflowId, context = {}, options = {}) {
        const execution = await this.execute(workflowId, context, options);
        return execution.id;
    }

    /**
     * Execute a workflow (internal)
     * @param {string} executionId - Execution ID
     */
    async executeWorkflow(executionId) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        // Check if already running or completed
        if (execution.status === 'running') {
            return;
        }

        // Update status
        execution.status = 'running';
        execution.updatedAt = new Date().toISOString();
        this.activeExecutions.set(executionId, execution);
        this.metrics.byStatus.running = (this.metrics.byStatus.running || 0) + 1;
        this.metrics.pendingExecutions = Math.max(0, this.metrics.pendingExecutions - 1);
        this.metrics.activeExecutions++;

        try {
            // Get workflow
            const workflow = await this.getWorkflow(execution.workflowId);
            if (!workflow) {
                throw new Error(`Workflow ${execution.workflowId} not found`);
            }

            // Build execution plan
            const plan = await this.buildExecutionPlan(workflow, execution);
            execution.nodes = plan;

            // Execute nodes
            const result = await this.executeNodes(plan, execution, workflow);

            // Complete execution
            execution.status = 'completed';
            execution.completedAt = new Date().toISOString();
            execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
            execution.result = result;

            this.metrics.successfulExecutions++;
            this.metrics.byStatus.completed = (this.metrics.byStatus.completed || 0) + 1;
            this.metrics.byWorkflow[execution.workflowId] = (this.metrics.byWorkflow[execution.workflowId] || 0) + 1;

            // Emit event
            eventBus.publish('workflow.execution.completed', {
                executionId: execution.id,
                workflowId: execution.workflowId,
                duration: execution.duration
            });

            if (this.debugMode) {
                logger.debug(`[WorkflowEngine] Execution completed: ${execution.id}`);
            }

        } catch (error) {
            // Handle failure
            execution.status = 'failed';
            execution.completedAt = new Date().toISOString();
            execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
            execution.error = error.message;

            this.metrics.failedExecutions++;
            this.metrics.byStatus.failed = (this.metrics.byStatus.failed || 0) + 1;

            // Emit event
            eventBus.publish('workflow.execution.failed', {
                executionId: execution.id,
                workflowId: execution.workflowId,
                error: error.message
            });

            logger.error(`[WorkflowEngine] Execution failed: ${execution.id}`, error);

            // Retry if configured
            if (this.config.maxRetries > 0 && execution.retryCount < this.config.maxRetries) {
                execution.retryCount++;
                execution.status = 'retrying';
                setTimeout(() => {
                    this.executeWorkflow(executionId).catch(e => {
                        logger.error(`[WorkflowEngine] Retry failed: ${executionId}`, e);
                    });
                }, this.config.retryDelay);
            }

        } finally {
            // Update execution
            this.cache.executions.set(executionId, execution);
            this.activeExecutions.delete(executionId);
            this.executionTimeouts.delete(executionId);
            this.metrics.activeExecutions = Math.max(0, this.metrics.activeExecutions - 1);
        }
    }

    /**
     * Build execution plan from workflow
     * @param {object} workflow - Workflow object
     * @param {object} execution - Execution object
     * @returns {Array} Execution plan
     */
    async buildExecutionPlan(workflow, execution) {
        // In production, this would use workflow builder diagram
        // For MVP, create a simple plan from workflow actions
        const plan = [];

        // Add trigger node
        plan.push({
            id: 'trigger_1',
            type: 'trigger',
            status: 'pending',
            config: {
                event: workflow.triggerType,
                ...workflow.triggerConfig
            }
        });

        // Add action nodes
        if (workflow.actions && workflow.actions.length > 0) {
            for (let i = 0; i < workflow.actions.length; i++) {
                const action = workflow.actions[i];
                plan.push({
                    id: `action_${i + 1}`,
                    type: 'action',
                    status: 'pending',
                    config: {
                        type: action.type,
                        ...action.config
                    }
                });
            }
        }

        // Add end node
        plan.push({
            id: 'end_1',
            type: 'end',
            status: 'pending',
            config: {}
        });

        return plan;
    }

    /**
     * Execute nodes in plan
     * @param {Array} plan - Execution plan
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Execution result
     */
    async executeNodes(plan, execution, workflow) {
        const result = {
            success: true,
            nodes: [],
            data: { ...execution.context }
        };

        for (const node of plan) {
            // Check if execution was cancelled
            if (execution.status === 'cancelled') {
                result.success = false;
                result.error = 'Execution cancelled';
                break;
            }

            // Execute node
            const nodeResult = await this.executeNode(node, execution, workflow);
            result.nodes.push(nodeResult);
            node.status = nodeResult.status;

            // Update data
            if (nodeResult.data) {
                result.data = { ...result.data, ...nodeResult.data };
            }

            // Check if failed
            if (nodeResult.status === 'failed') {
                result.success = false;
                result.error = nodeResult.error || 'Node execution failed';
                break;
            }

            // Check if skipped
            if (nodeResult.status === 'skipped') {
                // Continue to next node
                continue;
            }
        }

        return result;
    }

    /**
     * Execute a single node
     * @param {object} node - Node to execute
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Node result
     */
    async executeNode(node, execution, workflow) {
        const startTime = Date.now();
        node.status = 'running';
        node.startedAt = new Date().toISOString();

        try {
            // Set timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Node execution timeout (${this.config.nodeTimeout}ms)`));
                }, this.config.nodeTimeout);
            });

            // Execute based on node type
            let result;
            switch (node.type) {
                case 'trigger':
                    result = await this.executeTrigger(node, execution, workflow);
                    break;
                case 'action':
                    result = await this.executeAction(node, execution, workflow);
                    break;
                case 'condition':
                    result = await this.executeCondition(node, execution, workflow);
                    break;
                case 'delay':
                    result = await this.executeDelay(node, execution, workflow);
                    break;
                case 'end':
                    result = await this.executeEnd(node, execution, workflow);
                    break;
                default:
                    result = { success: true, data: {} };
            }

            // Wait for timeout or result
            await Promise.race([timeoutPromise, Promise.resolve(result)]);

            node.status = 'completed';
            node.completedAt = new Date().toISOString();
            node.duration = Date.now() - startTime;
            node.result = result;

            return node;

        } catch (error) {
            node.status = 'failed';
            node.completedAt = new Date().toISOString();
            node.duration = Date.now() - startTime;
            node.error = error.message;
            node.result = { success: false, error: error.message };

            return node;
        }
    }

    /**
     * Execute a trigger node
     * @param {object} node - Trigger node
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Trigger result
     */
    async executeTrigger(node, execution, workflow) {
        // Simulate trigger execution
        await new Promise(resolve => setTimeout(resolve, 50));
        return { 
            success: true, 
            data: { 
                triggered: true, 
                event: node.config.event || 'unknown',
                timestamp: new Date().toISOString()
            } 
        };
    }

    /**
     * Execute an action node
     * @param {object} node - Action node
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Action result
     */
    async executeAction(node, execution, workflow) {
        // In production, this would call actual action handlers
        // For MVP, simulate action execution
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
            return { 
                success: true, 
                data: { 
                    actionType: node.config.type || 'unknown',
                    executed: true,
                    timestamp: new Date().toISOString()
                } 
            };
        } else {
            throw new Error(`Action failed: ${node.config.type || 'unknown'}`);
        }
    }

    /**
     * Execute a condition node
     * @param {object} node - Condition node
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Condition result
     */
    async executeCondition(node, execution, workflow) {
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const field = node.config.field || 'score';
        const operator = node.config.operator || '>=';
        const value = node.config.value || 50;
        const contextValue = execution.context[field] || 0;

        // Evaluate condition
        let result = false;
        switch (operator) {
            case '==':
                result = contextValue == value;
                break;
            case '!=':
                result = contextValue != value;
                break;
            case '>':
                result = contextValue > value;
                break;
            case '>=':
                result = contextValue >= value;
                break;
            case '<':
                result = contextValue < value;
                break;
            case '<=':
                result = contextValue <= value;
                break;
        }

        return { 
            success: true, 
            data: { 
                conditionMet: result,
                field: field,
                operator: operator,
                value: value,
                actualValue: contextValue
            } 
        };
    }

    /**
     * Execute a delay node
     * @param {object} node - Delay node
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} Delay result
     */
    async executeDelay(node, execution, workflow) {
        const duration = (node.config.duration || 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, duration));
        return { 
            success: true, 
            data: { 
                delayed: true,
                duration: duration,
                timestamp: new Date().toISOString()
            } 
        };
    }

    /**
     * Execute an end node
     * @param {object} node - End node
     * @param {object} execution - Execution object
     * @param {object} workflow - Workflow object
     * @returns {object} End result
     */
    async executeEnd(node, execution, workflow) {
        return { 
            success: true, 
            data: { 
                completed: true,
                timestamp: new Date().toISOString()
            } 
        };
    }

    /**
     * Cancel an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async cancelExecution(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        if (execution.status === 'completed' || 
            execution.status === 'failed' || 
            execution.status === 'cancelled') {
            return false;
        }

        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
        execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
        execution.cancelledReason = options.reason || 'Cancelled by user';
        execution.updatedAt = new Date().toISOString();

        this.cache.executions.set(executionId, execution);
        this.activeExecutions.delete(executionId);
        this.executionTimeouts.delete(executionId);

        this.metrics.cancelledExecutions++;
        this.metrics.byStatus.cancelled = (this.metrics.byStatus.cancelled || 0) + 1;
        this.metrics.activeExecutions = Math.max(0, this.metrics.activeExecutions - 1);

        // Emit event
        eventBus.publish('workflow.execution.cancelled', {
            executionId: execution.id,
            workflowId: execution.workflowId,
            reason: options.reason
        });

        if (this.debugMode) {
            logger.debug(`[WorkflowEngine] Execution cancelled: ${executionId}`);
        }

        return true;
    }

    /**
     * Get execution status
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {object} Execution status
     */
    async getExecutionStatus(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        return {
            id: execution.id,
            workflowId: execution.workflowId,
            status: execution.status,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            duration: execution.duration,
            progress: this.calculateProgress(execution),
            error: execution.error,
            nodes: execution.nodes ? execution.nodes.map(n => ({
                id: n.id,
                type: n.type,
                status: n.status,
                duration: n.duration,
                result: n.result,
                error: n.error
            })) : []
        };
    }

    /**
     * Calculate execution progress
     * @param {object} execution - Execution object
     * @returns {number} Progress percentage
     */
    calculateProgress(execution) {
        if (!execution.nodes || execution.nodes.length === 0) {
            return 0;
        }

        const total = execution.nodes.length;
        const completed = execution.nodes.filter(n => 
            n.status === 'completed' || n.status === 'failed'
        ).length;

        return Math.round((completed / total) * 100);
    }

    /**
     * Get execution history
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {Array} Execution history
     */
    async getExecutionHistory(workflowId, options = {}) {
        let results = executions.filter(e => e.workflowId === workflowId);

        if (options.status) {
            results = results.filter(e => e.status === options.status);
        }

        if (options.startDate) {
            results = results.filter(e => new Date(e.startedAt) >= new Date(options.startDate));
        }

        if (options.endDate) {
            results = results.filter(e => new Date(e.startedAt) <= new Date(options.endDate));
        }

        results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

        const limit = options.limit || 50;
        const offset = options.offset || 0;

        return results.slice(offset, offset + limit).map(e => ({
            id: e.id,
            workflowId: e.workflowId,
            status: e.status,
            startedAt: e.startedAt,
            completedAt: e.completedAt,
            duration: e.duration,
            error: e.error,
            retryCount: e.retryCount
        }));
    }

    /**
     * Pause an execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async pauseExecution(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        if (execution.status !== 'running') {
            return false;
        }

        execution.status = 'paused';
        execution.pausedAt = new Date().toISOString();
        execution.updatedAt = new Date().toISOString();

        this.cache.executions.set(executionId, execution);

        this.metrics.byStatus.paused = (this.metrics.byStatus.paused || 0) + 1;
        this.metrics.byStatus.running = Math.max(0, this.metrics.byStatus.running - 1);
        this.metrics.activeExecutions = Math.max(0, this.metrics.activeExecutions - 1);

        if (this.debugMode) {
            logger.debug(`[WorkflowEngine] Execution paused: ${executionId}`);
        }

        return true;
    }

    /**
     * Resume a paused execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async resumeExecution(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        if (execution.status !== 'paused') {
            return false;
        }

        execution.status = 'running';
        execution.resumedAt = new Date().toISOString();
        execution.updatedAt = new Date().toISOString();

        this.cache.executions.set(executionId, execution);
        this.activeExecutions.set(executionId, execution);

        this.metrics.byStatus.running = (this.metrics.byStatus.running || 0) + 1;
        this.metrics.byStatus.paused = Math.max(0, this.metrics.byStatus.paused - 1);
        this.metrics.activeExecutions++;

        // Resume execution
        this.executeWorkflow(executionId).catch(error => {
            logger.error(`[WorkflowEngine] Resume failed: ${executionId}`, error);
        });

        if (this.debugMode) {
            logger.debug(`[WorkflowEngine] Execution resumed: ${executionId}`);
        }

        return true;
    }

    /**
     * Retry a failed execution
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async retryExecution(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        if (execution.status !== 'failed') {
            return false;
        }

        execution.status = 'retrying';
        execution.retryCount++;
        execution.updatedAt = new Date().toISOString();

        this.cache.executions.set(executionId, execution);

        // Re-execute
        this.executeWorkflow(executionId).catch(error => {
            logger.error(`[WorkflowEngine] Retry failed: ${executionId}`, error);
        });

        if (this.debugMode) {
            logger.debug(`[WorkflowEngine] Execution retry: ${executionId}`);
        }

        return true;
    }

    /**
     * Get node execution result
     * @param {string} executionId - Execution ID
     * @param {string} nodeId - Node ID
     * @param {object} options - Additional options
     * @returns {object} Node result
     */
    async getNodeExecutionResult(executionId, nodeId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const node = execution.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found in execution`);
        }

        return {
            nodeId: node.id,
            type: node.type,
            status: node.status,
            duration: node.duration,
            result: node.result,
            error: node.error,
            startedAt: node.startedAt,
            completedAt: node.completedAt
        };
    }

    /**
     * Get execution metrics
     * @param {object} options - Additional options
     * @returns {object} Execution metrics
     */
    async getExecutionMetrics(options = {}) {
        // Calculate average execution time
        const completedExecutions = executions.filter(e => e.status === 'completed' || e.status === 'failed');
        let totalTime = 0;
        for (const e of completedExecutions) {
            totalTime += e.duration || 0;
        }
        this.metrics.averageExecutionTime = completedExecutions.length > 0 ? 
            totalTime / completedExecutions.length : 0;

        return {
            ...this.metrics,
            totalExecutions: executions.length,
            completedExecutions: completedExecutions.length,
            pendingExecutions: executions.filter(e => e.status === 'pending').length,
            activeExecutions: this.activeExecutions.size,
            averageExecutionTime: Math.round(this.metrics.averageExecutionTime),
            byStatus: this.metrics.byStatus,
            byWorkflow: this.metrics.byWorkflow,
            nodeExecutionTime: this.metrics.nodeExecutionTime
        };
    }

    /**
     * Validate workflow before execution
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Workflow validation result
     */
    async validateWorkflow(workflowId, options = {}) {
        // In production, this would fetch from automation module
        // For MVP, return mock workflow
        const workflow = {
            id: workflowId,
            name: 'Sample Workflow',
            triggerType: 'lead.created',
            actions: [
                { type: 'send_whatsapp', config: { template: 'welcome' } },
                { type: 'create_task', config: { title: 'Follow up' } }
            ],
            isActive: true
        };

        // Check if active
        if (!workflow.isActive) {
            throw new Error('Workflow is not active');
        }

        // Check if has actions
        if (!workflow.actions || workflow.actions.length === 0) {
            throw new Error('Workflow has no actions');
        }

        return workflow;
    }

    /**
     * Get execution context
     * @param {string} executionId - Execution ID
     * @param {object} options - Additional options
     * @returns {object} Execution context
     */
    async getExecutionContext(executionId, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        return { ...execution.context };
    }

    /**
     * Update execution context
     * @param {string} executionId - Execution ID
     * @param {object} data - Data to update
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async updateExecutionContext(executionId, data, options = {}) {
        const execution = executions.find(e => e.id === executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        execution.context = { ...execution.context, ...data };
        execution.updatedAt = new Date().toISOString();

        this.cache.executions.set(executionId, execution);

        return true;
    }

    /**
     * Get execution statistics for a workflow
     * @param {string} workflowId - Workflow ID
     * @param {object} options - Additional options
     * @returns {object} Execution statistics
     */
    async getExecutionStats(workflowId, options = {}) {
        const workflowExecutions = executions.filter(e => e.workflowId === workflowId);

        const stats = {
            total: workflowExecutions.length,
            successful: workflowExecutions.filter(e => e.status === 'completed').length,
            failed: workflowExecutions.filter(e => e.status === 'failed').length,
            cancelled: workflowExecutions.filter(e => e.status === 'cancelled').length,
            pending: workflowExecutions.filter(e => e.status === 'pending').length,
            running: workflowExecutions.filter(e => e.status === 'running').length,
            averageDuration: 0,
            successRate: 0
        };

        const completed = workflowExecutions.filter(e => e.status === 'completed' || e.status === 'failed');
        let totalDuration = 0;
        for (const e of completed) {
            totalDuration += e.duration || 0;
        }
        stats.averageDuration = completed.length > 0 ? totalDuration / completed.length : 0;
        stats.successRate = workflowExecutions.length > 0 ? 
            (stats.successful / workflowExecutions.length) * 100 : 0;

        return stats;
    }

    /**
     * Get workflow (internal)
     * @param {string} workflowId - Workflow ID
     * @returns {object} Workflow
     */
    async getWorkflow(workflowId) {
        // In production, this would fetch from automation module
        // For MVP, return mock workflow
        return {
            id: workflowId,
            name: 'Sample Workflow',
            triggerType: 'lead.created',
            triggerConfig: {},
            actions: [
                { type: 'send_whatsapp', config: { template: 'welcome' } },
                { type: 'create_task', config: { title: 'Follow up' } }
            ],
            conditions: [],
            isActive: true
        };
    }

    /**
     * Generate execution ID
     * @returns {string} Execution ID
     */
    generateExecutionId() {
        executionIdCounter++;
        return 'exec_' + executionIdCounter;
    }

    /**
     * Update metrics
     * @param {object} execution - Execution object
     */
    updateMetrics(execution) {
        this.metrics.totalExecutions++;
        if (execution.status === 'completed') {
            this.metrics.successfulExecutions++;
        } else if (execution.status === 'failed') {
            this.metrics.failedExecutions++;
        }
        this.metrics.byWorkflow[execution.workflowId] = (this.metrics.byWorkflow[execution.workflowId] || 0) + 1;
        this.metrics.byStatus[execution.status] = (this.metrics.byStatus[execution.status] || 0) + 1;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[WorkflowEngine] Debug mode enabled');
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
        this.activeExecutions.clear();
        this.executionTimeouts.clear();
        this.cache.executions.clear();
        this.cache.workflows.clear();
        this.cacheTimestamps.clear();
        logger.info('Workflow engine cleaned up');
    }
}

// Create and export singleton instance
export const workflowEngine = new WorkflowEngine();

// Export class for testing
export default WorkflowEngine;
