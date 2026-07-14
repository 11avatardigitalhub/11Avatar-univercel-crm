/**
 * ==========================================
 * FILE: pipelineManager.js
 * MODULE: CRM Module
 * CODE: CRM-5
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Pipeline management operations for the CRM module.
 * Handles pipeline configuration, stage management,
 * and pipeline analytics.
 * 
 * DEPENDENCIES:
 * - dealRepository.js (for deal operations)
 * - eventBus.js (for events)
 * 
 * FUNCTIONS:
 * - createPipeline(data): Create a new pipeline
 * - updatePipeline(id, data): Update a pipeline
 * - deletePipeline(id): Delete a pipeline
 * - getPipeline(id): Get pipeline by ID
 * - getPipelines(): Get all pipelines
 * - addStage(pipelineId, stageData): Add a stage
 * - updateStage(pipelineId, stageId, data): Update a stage
 * - deleteStage(pipelineId, stageId): Delete a stage
 * - reorderStages(pipelineId, stageOrder): Reorder stages
 * - setDefaultPipeline(id): Set default pipeline
 * - clonePipeline(id, newName): Clone a pipeline
 * - getPipelineAnalytics(id): Get pipeline analytics
 * - getPipelineHealth(id): Get pipeline health
 * - getStageAnalytics(pipelineId, stageId): Get stage analytics
 * - getConversionRates(pipelineId): Get conversion rates
 * - getPipelineVelocity(pipelineId): Get pipeline velocity
 * - getPipelineForecast(pipelineId): Get pipeline forecast
 * - getPipelineInsights(pipelineId): Get pipeline insights
 * 
 * USAGE EXAMPLE:
 * import { pipelineManager } from './modules/crm/pipelineManager.js';
 * 
 * // Create a new pipeline
 * const pipeline = await pipelineManager.createPipeline({
 *   name: 'Real Estate Pipeline',
 *   description: 'Pipeline for real estate deals',
 *   stages: [
 *     { name: 'New Lead', probability: 10 },
 *     { name: 'Site Visit', probability: 30 },
 *     { name: 'Negotiation', probability: 60 },
 *     { name: 'Booking', probability: 80 },
 *     { name: 'Registration', probability: 100 }
 *   ]
 * });
 * 
 * // Get pipeline analytics
 * const analytics = await pipelineManager.getPipelineAnalytics('pipe_123');
 * ==========================================
 */

import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

class PipelineManager {
    constructor() {
        // Pipeline storage (in-memory for MVP)
        // In production, this would be in Firestore
        this.pipelines = new Map();
        this.pipelineIdCounter = 1000;
        
        // Default pipeline stages
        this.defaultStages = [
            { id: 'stage_new', name: 'New', probability: 10, order: 0 },
            { id: 'stage_contacted', name: 'Contacted', probability: 20, order: 1 },
            { id: 'stage_qualified', name: 'Qualified', probability: 30, order: 2 },
            { id: 'stage_negotiation', name: 'Negotiation', probability: 50, order: 3 },
            { id: 'stage_proposal', name: 'Proposal Sent', probability: 60, order: 4 },
            { id: 'stage_verbal_yes', name: 'Verbal Yes', probability: 80, order: 5 },
            { id: 'stage_invoice', name: 'Invoice Sent', probability: 85, order: 6 },
            { id: 'stage_won', name: 'Won', probability: 100, order: 7 },
            { id: 'stage_lost', name: 'Lost', probability: 0, order: 8 }
        ];
        
        // Configuration
        this.config = {
            defaultPipelineName: 'Default Pipeline',
            maxStages: 20,
            minStages: 2,
            allowDeletion: true,
            allowStageDeletion: true
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize default pipeline
        this.initDefaultPipeline();
    }

    /**
     * Initialize default pipeline
     */
    initDefaultPipeline() {
        const defaultPipeline = {
            id: 'pipeline_default',
            name: this.config.defaultPipelineName,
            description: 'Default sales pipeline for all deals',
            stages: this.defaultStages.map((stage, index) => ({
                ...stage,
                id: stage.id,
                order: index
            })),
            isDefault: true,
            isSystem: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.pipelines.set('pipeline_default', defaultPipeline);
        this.pipelineIdCounter++;

        if (this.debugMode) {
            logger.debug('[PipelineManager] Default pipeline initialized');
        }
    }

    /**
     * Create a new pipeline
     * @param {object} data - Pipeline data
     * @param {object} options - Additional options
     * @returns {object} Created pipeline
     */
    async createPipeline(data, options = {}) {
        // Validate data
        this.validatePipelineData(data);

        // Generate stages
        const stages = data.stages ? data.stages.map((stage, index) => ({
            id: this.generateStageId(),
            name: stage.name,
            probability: stage.probability || 10,
            order: index,
            description: stage.description || ''
        })) : [];

        // Validate stages
        if (stages.length < this.config.minStages) {
            throw new Error(`Pipeline must have at least ${this.config.minStages} stages`);
        }

        if (stages.length > this.config.maxStages) {
            throw new Error(`Pipeline cannot have more than ${this.config.maxStages} stages`);
        }

        // Check for duplicate stage names
        const stageNames = stages.map(s => s.name.toLowerCase());
        if (new Set(stageNames).size !== stageNames.length) {
            throw new Error('Duplicate stage names are not allowed');
        }

        // Create pipeline
        const pipeline = {
            id: this.generatePipelineId(),
            name: data.name,
            description: data.description || '',
            stages: stages,
            isDefault: data.isDefault || false,
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // If this is set as default, unset other defaults
        if (pipeline.isDefault) {
            for (const [id, existing] of this.pipelines) {
                if (existing.isDefault) {
                    existing.isDefault = false;
                    existing.updatedAt = new Date().toISOString();
                    this.pipelines.set(id, existing);
                }
            }
        }

        this.pipelines.set(pipeline.id, pipeline);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.created',
            'pipeline',
            { pipelineId: pipeline.id, name: pipeline.name }
        );

        // Emit event
        eventBus.publish('pipeline.created', {
            pipelineId: pipeline.id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Pipeline created: ${pipeline.id}`);
        }

        return { ...pipeline };
    }

    /**
     * Update a pipeline
     * @param {string} id - Pipeline ID
     * @param {object} data - Updated pipeline data
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async updatePipeline(id, data, options = {}) {
        if (!this.pipelines.has(id)) {
            throw new Error(`Pipeline ${id} not found`);
        }

        const pipeline = this.pipelines.get(id);

        // Don't allow updating system pipelines
        if (pipeline.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system pipeline');
        }

        // Update fields
        if (data.name) pipeline.name = data.name;
        if (data.description) pipeline.description = data.description;
        
        // Update stages if provided
        if (data.stages) {
            this.validateStages(data.stages);
            pipeline.stages = data.stages.map((stage, index) => ({
                ...stage,
                order: index
            }));
        }

        // Update default status
        if (data.isDefault && !pipeline.isDefault) {
            // Unset other defaults
            for (const [existingId, existing] of this.pipelines) {
                if (existing.isDefault) {
                    existing.isDefault = false;
                    existing.updatedAt = new Date().toISOString();
                    this.pipelines.set(existingId, existing);
                }
            }
            pipeline.isDefault = true;
        }

        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(id, pipeline);

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.updated',
            'pipeline',
            { pipelineId: id, changes: data }
        );

        // Emit event
        eventBus.publish('pipeline.updated', {
            pipelineId: id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Pipeline updated: ${id}`);
        }

        return { ...pipeline };
    }

    /**
     * Delete a pipeline
     * @param {string} id - Pipeline ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deletePipeline(id, options = {}) {
        if (!this.pipelines.has(id)) {
            throw new Error(`Pipeline ${id} not found`);
        }

        const pipeline = this.pipelines.get(id);

        // Don't allow deleting system pipelines
        if (pipeline.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system pipeline');
        }

        // Don't allow deleting default pipeline
        if (pipeline.isDefault && !options.forceDelete) {
            throw new Error('Cannot delete default pipeline');
        }

        // Check if pipeline has deals
        const deals = await dealRepository.getDealsByPipeline(id);
        if (deals.length > 0 && !options.forceDelete) {
            throw new Error(`Pipeline has ${deals.length} deals. Use forceDelete to override`);
        }

        // Delete pipeline
        this.pipelines.delete(id);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.deleted',
            'pipeline',
            { pipelineId: id, name: pipeline.name }
        );

        // Emit event
        eventBus.publish('pipeline.deleted', {
            pipelineId: id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Pipeline deleted: ${id}`);
        }

        return true;
    }

    /**
     * Get pipeline by ID
     * @param {string} id - Pipeline ID
     * @param {object} options - Additional options
     * @returns {object} Pipeline
     */
    async getPipeline(id, options = {}) {
        // Check cache
        if (this.cache.has(id)) {
            const cached = this.cache.get(id);
            const timestamp = this.cacheTimestamps.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(id);
            this.cacheTimestamps.delete(id);
        }

        if (!this.pipelines.has(id)) {
            throw new Error(`Pipeline ${id} not found`);
        }

        const pipeline = this.pipelines.get(id);

        // Cache the result
        this.cache.set(id, pipeline);
        this.cacheTimestamps.set(id, Date.now());

        return { ...pipeline };
    }

    /**
     * Get all pipelines
     * @param {object} options - Additional options
     * @returns {Array} List of pipelines
     */
    async getPipelines(options = {}) {
        const results = [];
        for (const [id, pipeline] of this.pipelines) {
            if (options.includeSystem !== false || !pipeline.isSystem) {
                results.push({ ...pipeline });
            }
        }
        return results;
    }

    /**
     * Add a stage to a pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {object} stageData - Stage data
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async addStage(pipelineId, stageData, options = {}) {
        const pipeline = await this.getPipeline(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }

        // Don't allow adding stages to system pipelines
        if (pipeline.isSystem && !options.forceUpdate) {
            throw new Error('Cannot modify system pipeline');
        }

        // Check stage count
        if (pipeline.stages.length >= this.config.maxStages) {
            throw new Error(`Maximum stages (${this.config.maxStages}) reached`);
        }

        // Validate stage
        if (!stageData.name) {
            throw new Error('Stage name is required');
        }

        // Check for duplicate names
        const existingNames = pipeline.stages.map(s => s.name.toLowerCase());
        if (existingNames.includes(stageData.name.toLowerCase())) {
            throw new Error('Stage name already exists');
        }

        // Create stage
        const newStage = {
            id: this.generateStageId(),
            name: stageData.name,
            probability: stageData.probability || 10,
            order: pipeline.stages.length,
            description: stageData.description || ''
        };

        pipeline.stages.push(newStage);
        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(pipelineId, pipeline);
        this.invalidateCache(pipelineId);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.stage_added',
            'pipeline',
            { pipelineId: pipelineId, stage: newStage.name }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Stage added: ${newStage.name} to pipeline ${pipelineId}`);
        }

        return { ...pipeline };
    }

    /**
     * Update a stage in a pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {string} stageId - Stage ID
     * @param {object} data - Updated stage data
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async updateStage(pipelineId, stageId, data, options = {}) {
        const pipeline = await this.getPipeline(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }

        // Don't allow modifying system pipelines
        if (pipeline.isSystem && !options.forceUpdate) {
            throw new Error('Cannot modify system pipeline');
        }

        const stageIndex = pipeline.stages.findIndex(s => s.id === stageId);
        if (stageIndex === -1) {
            throw new Error(`Stage ${stageId} not found in pipeline`);
        }

        // Don't allow modifying won/lost stages in system pipeline
        if (pipeline.isSystem && (stageId === 'stage_won' || stageId === 'stage_lost')) {
            throw new Error(`Cannot modify ${stageId} stage in system pipeline`);
        }

        // Update stage
        const stage = pipeline.stages[stageIndex];
        if (data.name) stage.name = data.name;
        if (data.probability !== undefined) stage.probability = data.probability;
        if (data.description) stage.description = data.description;

        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(pipelineId, pipeline);
        this.invalidateCache(pipelineId);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.stage_updated',
            'pipeline',
            { pipelineId: pipelineId, stageId: stageId, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Stage updated: ${stageId} in pipeline ${pipelineId}`);
        }

        return { ...pipeline };
    }

    /**
     * Delete a stage from a pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {string} stageId - Stage ID
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async deleteStage(pipelineId, stageId, options = {}) {
        const pipeline = await this.getPipeline(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }

        // Don't allow modifying system pipelines
        if (pipeline.isSystem && !options.forceDelete) {
            throw new Error('Cannot modify system pipeline');
        }

        const stageIndex = pipeline.stages.findIndex(s => s.id === stageId);
        if (stageIndex === -1) {
            throw new Error(`Stage ${stageId} not found in pipeline`);
        }

        // Don't allow deleting won/lost stages in system pipeline
        if (pipeline.isSystem && (stageId === 'stage_won' || stageId === 'stage_lost')) {
            throw new Error(`Cannot delete ${stageId} stage from system pipeline`);
        }

        // Don't allow if stage has deals
        const deals = await dealRepository.getDealsByStage(stageId);
        if (deals.length > 0 && !options.forceDelete) {
            throw new Error(`Stage has ${deals.length} deals. Use forceDelete to override`);
        }

        // Remove stage
        pipeline.stages.splice(stageIndex, 1);
        
        // Reorder remaining stages
        pipeline.stages.forEach((stage, index) => {
            stage.order = index;
        });

        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(pipelineId, pipeline);
        this.invalidateCache(pipelineId);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.stage_deleted',
            'pipeline',
            { pipelineId: pipelineId, stageId: stageId }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Stage deleted: ${stageId} from pipeline ${pipelineId}`);
        }

        return { ...pipeline };
    }

    /**
     * Reorder stages in a pipeline
     * @param {string} pipelineId - Pipeline ID
     * @param {Array} stageOrder - Array of stage IDs in desired order
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async reorderStages(pipelineId, stageOrder, options = {}) {
        const pipeline = await this.getPipeline(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }

        // Don't allow modifying system pipelines
        if (pipeline.isSystem && !options.forceUpdate) {
            throw new Error('Cannot modify system pipeline');
        }

        // Validate stage order
        const existingStageIds = pipeline.stages.map(s => s.id);
        if (stageOrder.length !== existingStageIds.length) {
            throw new Error('Stage order must include all stages');
        }

        // Check if all stages are included
        const missingStages = existingStageIds.filter(id => !stageOrder.includes(id));
        if (missingStages.length > 0) {
            throw new Error(`Missing stages: ${missingStages.join(', ')}`);
        }

        // Reorder stages
        pipeline.stages = stageOrder.map((stageId, index) => {
            const stage = pipeline.stages.find(s => s.id === stageId);
            if (!stage) {
                throw new Error(`Stage ${stageId} not found`);
            }
            return {
                ...stage,
                order: index
            };
        });

        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(pipelineId, pipeline);
        this.invalidateCache(pipelineId);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.stages_reordered',
            'pipeline',
            { pipelineId: pipelineId }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Stages reordered in pipeline ${pipelineId}`);
        }

        return { ...pipeline };
    }

    /**
     * Set default pipeline
     * @param {string} id - Pipeline ID
     * @param {object} options - Additional options
     * @returns {object} Updated pipeline
     */
    async setDefaultPipeline(id, options = {}) {
        if (!this.pipelines.has(id)) {
            throw new Error(`Pipeline ${id} not found`);
        }

        // Unset current default
        for (const [existingId, existing] of this.pipelines) {
            if (existing.isDefault) {
                existing.isDefault = false;
                existing.updatedAt = new Date().toISOString();
                this.pipelines.set(existingId, existing);
            }
        }

        // Set new default
        const pipeline = this.pipelines.get(id);
        pipeline.isDefault = true;
        pipeline.updatedAt = new Date().toISOString();
        this.pipelines.set(id, pipeline);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.set_default',
            'pipeline',
            { pipelineId: id }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Default pipeline set: ${id}`);
        }

        return { ...pipeline };
    }

    /**
     * Clone a pipeline
     * @param {string} id - Pipeline ID to clone
     * @param {string} newName - Name for the new pipeline
     * @param {object} options - Additional options
     * @returns {object} New pipeline
     */
    async clonePipeline(id, newName, options = {}) {
        if (!this.pipelines.has(id)) {
            throw new Error(`Pipeline ${id} not found`);
        }

        const source = this.pipelines.get(id);

        // Create new pipeline
        const newPipeline = {
            id: this.generatePipelineId(),
            name: newName || `${source.name} (Clone)`,
            description: source.description,
            stages: source.stages.map(stage => ({
                ...stage,
                id: this.generateStageId()
            })),
            isDefault: false,
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.pipelines.set(newPipeline.id, newPipeline);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'pipeline.cloned',
            'pipeline',
            { sourceId: id, newId: newPipeline.id }
        );

        if (this.debugMode) {
            logger.debug(`[PipelineManager] Pipeline cloned: ${id} → ${newPipeline.id}`);
        }

        return { ...newPipeline };
    }

    /**
     * Get pipeline analytics
     * @param {string} id - Pipeline ID
     * @param {object} options - Additional options
     * @returns {object} Pipeline analytics
     */
    async getPipelineAnalytics(id, options = {}) {
        const pipeline = await this.getPipeline(id);
        if (!pipeline) {
            throw new Error(`Pipeline ${id} not found`);
        }

        const deals = await dealRepository.getDealsByPipeline(id, options);
        const activeDeals = deals.filter(d => d.status === 'active');

        const analytics = {
            pipelineId: id,
            name: pipeline.name,
            stages: [],
            summary: {
                totalDeals: deals.length,
                activeDeals: activeDeals.length,
                wonDeals: deals.filter(d => d.status === 'won').length,
                lostDeals: deals.filter(d => d.status === 'lost').length,
                totalValue: deals.reduce((sum, d) => sum + d.value, 0),
                weightedValue: deals.reduce((sum, d) => sum + (d.value * (d.probability / 100)), 0)
            }
        };

        // Stage analytics
        for (const stage of pipeline.stages) {
            const stageDeals = deals.filter(d => d.stageId === stage.id);
            const stageActiveDeals = stageDeals.filter(d => d.status === 'active');
            
            analytics.stages.push({
                ...stage,
                deals: {
                    total: stageDeals.length,
                    active: stageActiveDeals.length,
                    value: stageDeals.reduce((sum, d) => sum + d.value, 0),
                    weightedValue: stageDeals.reduce((sum, d) => sum + (d.value * (d.probability / 100)), 0)
                },
                conversionRate: this.calculateStageConversion(deals, stage.id)
            });
        }

        // Calculate conversion rates
        analytics.conversionRates = this.calculatePipelineConversionRates(deals, pipeline.stages);

        return analytics;
    }

    /**
     * Calculate stage conversion rate
     * @param {Array} deals - Deals list
     * @param {string} stageId - Stage ID
     * @returns {number} Conversion rate percentage
     */
    calculateStageConversion(deals, stageId) {
        const stageDeals = deals.filter(d => d.stageId === stageId);
        if (stageDeals.length === 0) return 0;

        const completed = stageDeals.filter(d => 
            d.status === 'won' || d.status === 'lost'
        );
        
        return Math.round((completed.length / stageDeals.length) * 100);
    }

    /**
     * Calculate pipeline conversion rates
     * @param {Array} deals - Deals list
     * @param {Array} stages - Pipeline stages
     * @returns {object} Conversion rates
     */
    calculatePipelineConversionRates(deals, stages) {
        const rates = {};
        const wonDeals = deals.filter(d => d.status === 'won');

        for (let i = 0; i < stages.length; i++) {
            const stageId = stages[i].id;
            const stageDeals = deals.filter(d => d.stageId === stageId);
            const wonFromStage = stageDeals.filter(d => d.status === 'won');
            
            rates[stageId] = {
                stageName: stages[i].name,
                count: stageDeals.length,
                won: wonFromStage.length,
                conversionRate: stageDeals.length > 0 ? 
                    Math.round((wonFromStage.length / stageDeals.length) * 100) : 0,
                nextStage: i < stages.length - 1 ? stages[i + 1].id : null
            };
        }

        return rates;
    }

    /**
     * Validate pipeline data
     * @param {object} data - Pipeline data
     */
    validatePipelineData(data) {
        if (!data.name) {
            throw new Error('Pipeline name is required');
        }

        if (data.stages && data.stages.length > 0) {
            this.validateStages(data.stages);
        }
    }

    /**
     * Validate stages
     * @param {Array} stages - Stage data
     */
    validateStages(stages) {
        if (!stages || stages.length === 0) {
            return;
        }

        // Check for duplicate names
        const names = stages.map(s => s.name.toLowerCase());
        if (new Set(names).size !== names.length) {
            throw new Error('Duplicate stage names are not allowed');
        }

        // Validate each stage
        for (const stage of stages) {
            if (!stage.name) {
                throw new Error('Stage name is required');
            }
            if (stage.probability !== undefined && (stage.probability < 0 || stage.probability > 100)) {
                throw new Error('Probability must be between 0 and 100');
            }
        }
    }

    /**
     * Generate pipeline ID
     * @returns {string} Pipeline ID
     */
    generatePipelineId() {
        this.pipelineIdCounter++;
        return 'pipeline_' + this.pipelineIdCounter;
    }

    /**
     * Generate stage ID
     * @returns {string} Stage ID
     */
    generateStageId() {
        return 'stage_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Invalidate cache
     * @param {string} id - Pipeline ID
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
        logger.debug('[PipelineManager] Debug mode enabled');
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
     * Get pipeline statistics
     * @param {object} options - Additional options
     * @returns {object} Pipeline statistics
     */
    getStats(options = {}) {
        return {
            totalPipelines: this.pipelines.size,
            defaultPipeline: [...this.pipelines.values()].find(p => p.isDefault)?.id || null,
            totalStages: [...this.pipelines.values()].reduce((sum, p) => sum + p.stages.length, 0),
            systemPipelines: [...this.pipelines.values()].filter(p => p.isSystem).length
        };
    }
}

// Create and export singleton instance
export const pipelineManager = new PipelineManager();

// Export class for testing
export default PipelineManager;
