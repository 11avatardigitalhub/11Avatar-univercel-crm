/**
 * ==========================================
 * FILE: leadScoring.js
 * MODULE: AI Module
 * CODE: AI-3
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI-powered lead scoring service that evaluates leads based on
 * multiple factors including industry, budget, timeline, source,
 * engagement, and behavior. Provides scoring, qualification,
 * and prioritization capabilities.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize lead scoring
 * - scoreLead(leadData): Score a lead
 * - scoreLeads(leads): Score multiple leads
 * - qualifyLead(leadData): Qualify a lead
 * - qualifyLeads(leads): Qualify multiple leads
 * - getLeadCategory(score): Get lead category
 * - getLeadPriority(score): Get lead priority
 * - getNextBestAction(score): Get next best action
 * - getScoringBreakdown(leadData): Get scoring breakdown
 * - updateScoringModel(weights): Update scoring model
 * - getScoringModel(): Get current scoring model
 * - resetScoringModel(): Reset to default model
 * - getLeadStats(): Get lead statistics
 * - exportScores(filters): Export scores
 * 
 * USAGE EXAMPLE:
 * import { leadScoring } from './modules/ai/leadScoring.js';
 * 
 * // Initialize lead scoring
 * await leadScoring.initialize();
 * 
 * // Score a lead
 * const result = await leadScoring.scoreLead({
 *   name: 'John Doe',
 *   company: 'Tech Solutions',
 *   industry: 'IT',
 *   budget: 500000,
 *   timeline: 'immediate',
 *   source: 'website',
 *   engagement: 'high'
 * });
 * 
 * // Qualify a lead
 * const qualification = await leadScoring.qualifyLead(leadData);
 * 
 * // Get scoring breakdown
 * const breakdown = await leadScoring.getScoringBreakdown(leadData);
 * ==========================================
 */

import { aiService } from './aiService.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Default scoring weights
const DEFAULT_WEIGHTS = {
    industry: 20,
    budget: 25,
    timeline: 20,
    source: 15,
    engagement: 20
};

// Industry scores
const INDUSTRY_SCORES = {
    'IT': 20,
    'Finance': 20,
    'Healthcare': 18,
    'Education': 16,
    'Manufacturing': 14,
    'Retail': 12,
    'Real Estate': 15,
    'Insurance': 17,
    'SaaS': 20,
    'E-commerce': 14,
    'Media': 12,
    'Telecom': 16,
    'Pharma': 18,
    'Logistics': 13,
    'Automotive': 14
};

// Source scores
const SOURCE_SCORES = {
    'referral': 15,
    'website': 12,
    'whatsapp': 12,
    'facebook': 10,
    'google': 10,
    'linkedin': 12,
    'instagram': 8,
    'twitter': 8,
    'email': 10,
    'manual': 6,
    'api': 10,
    'import': 6
};

// Timeline scores
const TIMELINE_SCORES = {
    'immediate': 20,
    '1_month': 15,
    '3_months': 10,
    '6_months': 5,
    '12_months': 2,
    'unknown': 5
};

// Engagement scores
const ENGAGEMENT_SCORES = {
    'high': 20,
    'medium': 12,
    'low': 5,
    'none': 0
};

// Budget scores
const BUDGET_SCORES = {
    high: 25,    // > 10L
    medium: 18,   // 1L - 10L
    low: 10,      // < 1L
    unknown: 5
};

class LeadScoring {
    constructor() {
        // Service state
        this.initialized = false;
        this.scoringModel = {
            weights: { ...DEFAULT_WEIGHTS },
            industryScores: { ...INDUSTRY_SCORES },
            sourceScores: { ...SOURCE_SCORES },
            timelineScores: { ...TIMELINE_SCORES },
            engagementScores: { ...ENGAGEMENT_SCORES },
            budgetScores: { ...BUDGET_SCORES }
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalScored: 0,
            averageScore: 0,
            byCategory: {
                hot: 0,
                warm: 0,
                cold: 0,
                notQualified: 0
            },
            byIndustry: {},
            bySource: {},
            byTimeline: {},
            totalScore: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize lead scoring
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            // Update model if provided
            if (options.model) {
                this.scoringModel = { ...this.scoringModel, ...options.model };
            }

            // Setup event listeners
            this.setupEventListeners();

            // Warm up cache
            this.warmUpCache();

            logger.info('Lead scoring initialized', {
                weights: this.scoringModel.weights,
                industries: Object.keys(this.scoringModel.industryScores).length
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Lead scoring initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-score leads when created
        const leadCreatedSub = eventBus.subscribe('lead.created', async (data) => {
            if (data.lead) {
                try {
                    await this.scoreLead(data.lead);
                } catch (error) {
                    logger.error('[LeadScoring] Auto-scoring failed:', error);
                }
            }
        });
        this.subscriptions.push(leadCreatedSub);

        // Auto-score leads when updated
        const leadUpdatedSub = eventBus.subscribe('lead.updated', async (data) => {
            if (data.lead) {
                try {
                    await this.scoreLead(data.lead);
                } catch (error) {
                    logger.error('[LeadScoring] Auto-scoring failed:', error);
                }
            }
        });
        this.subscriptions.push(leadUpdatedSub);
    }

    /**
     * Warm up cache
     */
    warmUpCache() {
        // Pre-compute common scores
        if (this.debugMode) {
            logger.debug('[LeadScoring] Cache warmed up');
        }
    }

    /**
     * Score a single lead
     * @param {object} leadData - Lead data
     * @param {object} options - Additional options
     * @returns {object} Scoring result
     */
    async scoreLead(leadData, options = {}) {
        if (!this.initialized) {
            throw new Error('Lead scoring not initialized');
        }

        // Check cache
        const cacheKey = this.getCacheKey(leadData);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        // Calculate scores
        const result = this.calculateScore(leadData);

        // Use AI for enhanced scoring if available
        if (options.useAI !== false) {
            try {
                const aiScore = await this.getAIScore(leadData);
                result.aiScore = aiScore;
                result.finalScore = Math.round((result.score + aiScore) / 2);
                result.aiEnhanced = true;
            } catch (error) {
                logger.warn('[LeadScoring] AI scoring failed, using rule-based:', error);
                result.finalScore = result.score;
                result.aiEnhanced = false;
            }
        } else {
            result.finalScore = result.score;
            result.aiEnhanced = false;
        }

        // Determine category and priority
        result.category = this.getLeadCategory(result.finalScore);
        result.priority = this.getLeadPriority(result.finalScore);
        result.nextAction = this.getNextBestAction(result.finalScore);

        // Add metadata
        result.timestamp = new Date().toISOString();
        result.version = '2.0';

        // Cache the result
        this.cache.set(cacheKey, result);
        this.cacheTimestamps.set(cacheKey, Date.now());

        // Update statistics
        this.updateStats(result);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'lead.scored',
            'ai',
            { leadId: leadData.id, score: result.finalScore, category: result.category }
        );

        // Emit event
        eventBus.publish('lead.scored', {
            leadId: leadData.id,
            score: result.finalScore,
            category: result.category
        });

        if (this.debugMode) {
            logger.debug(`[LeadScoring] Lead scored: ${result.finalScore} (${result.category})`);
        }

        return result;
    }

    /**
     * Calculate lead score based on rules
     * @param {object} leadData - Lead data
     * @returns {object} Score breakdown
     */
    calculateScore(leadData) {
        const weights = this.scoringModel.weights;

        // Industry score
        const industryScore = this.getIndustryScore(leadData.industry);

        // Budget score
        const budgetScore = this.getBudgetScore(leadData.budget);

        // Timeline score
        const timelineScore = this.getTimelineScore(leadData.timeline);

        // Source score
        const sourceScore = this.getSourceScore(leadData.source);

        // Engagement score
        const engagementScore = this.getEngagementScore(leadData.engagement);

        // Calculate weighted score
        const weightedScore = 
            (industryScore * weights.industry / 100) +
            (budgetScore * weights.budget / 100) +
            (timelineScore * weights.timeline / 100) +
            (sourceScore * weights.source / 100) +
            (engagementScore * weights.engagement / 100);

        // Normalize to 0-100
        const normalizedScore = Math.min(100, Math.max(0, weightedScore));

        return {
            score: Math.round(normalizedScore),
            breakdown: {
                industry: { score: industryScore, weight: weights.industry, contribution: Math.round(industryScore * weights.industry / 100) },
                budget: { score: budgetScore, weight: weights.budget, contribution: Math.round(budgetScore * weights.budget / 100) },
                timeline: { score: timelineScore, weight: weights.timeline, contribution: Math.round(timelineScore * weights.timeline / 100) },
                source: { score: sourceScore, weight: weights.source, contribution: Math.round(sourceScore * weights.source / 100) },
                engagement: { score: engagementScore, weight: weights.engagement, contribution: Math.round(engagementScore * weights.engagement / 100) }
            },
            factors: {
                industry: leadData.industry || 'unknown',
                budget: leadData.budget || 'unknown',
                timeline: leadData.timeline || 'unknown',
                source: leadData.source || 'unknown',
                engagement: leadData.engagement || 'unknown'
            }
        };
    }

    /**
     * Get industry score
     * @param {string} industry - Industry name
     * @returns {number} Industry score
     */
    getIndustryScore(industry) {
        if (!industry) return 10;
        const normalized = industry.charAt(0).toUpperCase() + industry.slice(1).toLowerCase();
        return this.scoringModel.industryScores[normalized] || 10;
    }

    /**
     * Get budget score
     * @param {number|string} budget - Budget amount
     * @returns {number} Budget score
     */
    getBudgetScore(budget) {
        if (!budget) return 5;
        
        if (typeof budget === 'number') {
            if (budget > 1000000) return 25;
            if (budget > 500000) return 20;
            if (budget > 100000) return 15;
            if (budget > 50000) return 10;
            return 5;
        }

        // If budget is string description
        const budgetStr = String(budget).toLowerCase();
        if (budgetStr.includes('high') || budgetStr.includes('large')) return 25;
        if (budgetStr.includes('medium') || budgetStr.includes('moderate')) return 18;
        if (budgetStr.includes('low') || budgetStr.includes('small')) return 10;
        return 5;
    }

    /**
     * Get timeline score
     * @param {string} timeline - Timeline value
     * @returns {number} Timeline score
     */
    getTimelineScore(timeline) {
        if (!timeline) return 5;
        const normalized = timeline.toLowerCase();
        return this.scoringModel.timelineScores[normalized] || 5;
    }

    /**
     * Get source score
     * @param {string} source - Lead source
     * @returns {number} Source score
     */
    getSourceScore(source) {
        if (!source) return 6;
        const normalized = source.toLowerCase();
        return this.scoringModel.sourceScores[normalized] || 6;
    }

    /**
     * Get engagement score
     * @param {string} engagement - Engagement level
     * @returns {number} Engagement score
     */
    getEngagementScore(engagement) {
        if (!engagement) return 0;
        const normalized = engagement.toLowerCase();
        return this.scoringModel.engagementScores[normalized] || 0;
    }

    /**
     * Get AI-enhanced score
     * @param {object} leadData - Lead data
     * @returns {number} AI score
     */
    async getAIScore(leadData) {
        try {
            const prompt = this.buildScoringPrompt(leadData);
            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 10
            });

            // Extract score from response
            const score = parseInt(response.match(/\d+/)?.[0] || '50');
            return Math.min(100, Math.max(0, score));
        } catch (error) {
            logger.error('[LeadScoring] AI scoring error:', error);
            throw error;
        }
    }

    /**
     * Build scoring prompt for AI
     * @param {object} leadData - Lead data
     * @returns {string} Prompt
     */
    buildScoringPrompt(leadData) {
        return `
Score this lead from 0-100 for an Indian B2B CRM.

Lead Details:
Name: ${leadData.name || 'Unknown'}
Company: ${leadData.company || 'Unknown'}
Industry: ${leadData.industry || 'Unknown'}
Budget: ${leadData.budget || 'Not specified'}
Timeline: ${leadData.timeline || 'Not specified'}
Source: ${leadData.source || 'Unknown'}
Engagement: ${leadData.engagement || 'Low'}

Scoring Criteria:
1. Industry Value (max 20 points):
   - IT/Software/Finance: 20
   - Healthcare/SaaS: 18
   - Education/Insurance: 16
   - Real Estate/Manufacturing: 14
   - Retail/Other: 12

2. Budget (max 25 points):
   - > ₹10 Lakh: 25
   - ₹5-10 Lakh: 20
   - ₹1-5 Lakh: 15
   - < ₹1 Lakh: 10
   - Not specified: 5

3. Timeline (max 20 points):
   - Immediate (< 1 week): 20
   - Short term (1-4 weeks): 15
   - Medium term (1-3 months): 10
   - Long term (> 3 months): 5

4. Source Quality (max 15 points):
   - Referral: 15
   - Website/WhatsApp: 12
   - LinkedIn/Google: 10
   - Facebook/Other: 8

5. Engagement (max 20 points):
   - High (replied, visited, asked questions): 20
   - Medium (replied once): 12
   - Low (no response): 5

Return ONLY a number between 0-100. No explanation.
`;
    }

    /**
     * Score multiple leads
     * @param {Array} leads - List of leads
     * @param {object} options - Additional options
     * @returns {Array} Scoring results
     */
    async scoreLeads(leads, options = {}) {
        const results = [];
        for (const lead of leads) {
            try {
                const result = await this.scoreLead(lead, options);
                results.push({ lead, result, success: true });
            } catch (error) {
                results.push({ lead, error: error.message, success: false });
            }
        }
        return results;
    }

    /**
     * Qualify a lead
     * @param {object} leadData - Lead data
     * @param {object} options - Additional options
     * @returns {object} Qualification result
     */
    async qualifyLead(leadData, options = {}) {
        const scoreResult = await this.scoreLead(leadData, options);
        
        const minScore = options.minScore || 70;
        const isQualified = scoreResult.finalScore >= minScore;

        return {
            qualified: isQualified,
            score: scoreResult.finalScore,
            category: scoreResult.category,
            priority: scoreResult.priority,
            nextAction: scoreResult.nextAction,
            breakdown: scoreResult.breakdown,
            reason: isQualified ? 'Score meets qualification threshold' : 'Score below qualification threshold',
            threshold: minScore
        };
    }

    /**
     * Qualify multiple leads
     * @param {Array} leads - List of leads
     * @param {object} options - Additional options
     * @returns {Array} Qualification results
     */
    async qualifyLeads(leads, options = {}) {
        const results = [];
        for (const lead of leads) {
            try {
                const result = await this.qualifyLead(lead, options);
                results.push({ lead, result, success: true });
            } catch (error) {
                results.push({ lead, error: error.message, success: false });
            }
        }
        return results;
    }

    /**
     * Get lead category based on score
     * @param {number} score - Lead score
     * @returns {string} Category
     */
    getLeadCategory(score) {
        if (score >= 80) return 'Hot';
        if (score >= 60) return 'Warm';
        if (score >= 40) return 'Cold';
        return 'Not Qualified';
    }

    /**
     * Get lead priority based on score
     * @param {number} score - Lead score
     * @returns {string} Priority
     */
    getLeadPriority(score) {
        if (score >= 80) return 'High';
        if (score >= 60) return 'Medium';
        if (score >= 40) return 'Low';
        return 'Minimal';
    }

    /**
     * Get next best action based on score
     * @param {number} score - Lead score
     * @returns {string} Next action
     */
    getNextBestAction(score) {
        if (score >= 80) {
            return 'Schedule discovery call within 24 hours';
        }
        if (score >= 60) {
            return 'Send personalized email with case studies';
        }
        if (score >= 40) {
            return 'Send introductory content and nurture';
        }
        return 'Add to long-term nurture campaign';
    }

    /**
     * Get scoring breakdown for a lead
     * @param {object} leadData - Lead data
     * @param {object} options - Additional options
     * @returns {object} Scoring breakdown
     */
    async getScoringBreakdown(leadData, options = {}) {
        const result = await this.scoreLead(leadData, options);
        return {
            totalScore: result.finalScore,
            category: result.category,
            priority: result.priority,
            breakdown: result.breakdown,
            factors: result.factors,
            aiEnhanced: result.aiEnhanced,
            aiScore: result.aiScore
        };
    }

    /**
     * Update scoring model
     * @param {object} weights - New weights
     * @param {object} options - Additional options
     * @returns {object} Updated model
     */
    async updateScoringModel(weights, options = {}) {
        // Validate weights sum to 100
        const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 0.01) {
            throw new Error('Weights must sum to 100');
        }

        // Update weights
        this.scoringModel.weights = { ...this.scoringModel.weights, ...weights };

        // Clear cache
        this.cache.clear();
        this.cacheTimestamps.clear();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'scoring.model.updated',
            'ai',
            { weights: this.scoringModel.weights }
        );

        if (this.debugMode) {
            logger.debug('[LeadScoring] Scoring model updated');
        }

        return { ...this.scoringModel };
    }

    /**
     * Get current scoring model
     * @returns {object} Scoring model
     */
    getScoringModel() {
        return { ...this.scoringModel };
    }

    /**
     * Reset scoring model to defaults
     * @param {object} options - Additional options
     * @returns {object} Reset model
     */
    async resetScoringModel(options = {}) {
        this.scoringModel.weights = { ...DEFAULT_WEIGHTS };
        this.scoringModel.industryScores = { ...INDUSTRY_SCORES };
        this.scoringModel.sourceScores = { ...SOURCE_SCORES };
        this.scoringModel.timelineScores = { ...TIMELINE_SCORES };
        this.scoringModel.engagementScores = { ...ENGAGEMENT_SCORES };
        this.scoringModel.budgetScores = { ...BUDGET_SCORES };

        // Clear cache
        this.cache.clear();
        this.cacheTimestamps.clear();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'scoring.model.reset',
            'ai',
            { message: 'Model reset to defaults' }
        );

        if (this.debugMode) {
            logger.debug('[LeadScoring] Scoring model reset');
        }

        return { ...this.scoringModel };
    }

    /**
     * Get lead statistics
     * @param {object} options - Additional options
     * @returns {object} Lead statistics
     */
    async getLeadStats(options = {}) {
        // Update average score
        if (this.stats.totalScored > 0) {
            this.stats.averageScore = Math.round(this.stats.totalScore / this.stats.totalScored);
        }

        return { ...this.stats };
    }

    /**
     * Export scores
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Exported scores
     */
    async exportScores(filters = {}, options = {}) {
        // In production, this would query the database
        // For MVP, return sample data
        return [
            {
                leadId: 'lead_1',
                name: 'John Doe',
                score: 85,
                category: 'Hot',
                breakdown: { industry: 18, budget: 22, timeline: 18, source: 12, engagement: 15 }
            },
            {
                leadId: 'lead_2',
                name: 'Jane Smith',
                score: 65,
                category: 'Warm',
                breakdown: { industry: 16, budget: 14, timeline: 12, source: 10, engagement: 13 }
            }
        ];
    }

    /**
     * Get cache key
     * @param {object} leadData - Lead data
     * @returns {string} Cache key
     */
    getCacheKey(leadData) {
        const keyParts = [
            leadData.industry || '',
            leadData.budget || '',
            leadData.timeline || '',
            leadData.source || '',
            leadData.engagement || ''
        ];
        return 'score_' + keyParts.join('_');
    }

    /**
     * Update statistics
     * @param {object} result - Scoring result
     */
    updateStats(result) {
        this.stats.totalScored++;
        this.stats.totalScore += result.finalScore;
        
        // Update category counts
        this.stats.byCategory[result.category.toLowerCase()] = 
            (this.stats.byCategory[result.category.toLowerCase()] || 0) + 1;

        // Update industry counts
        if (result.factors?.industry) {
            const industry = result.factors.industry;
            this.stats.byIndustry[industry] = (this.stats.byIndustry[industry] || 0) + 1;
        }

        // Update source counts
        if (result.factors?.source) {
            const source = result.factors.source;
            this.stats.bySource[source] = (this.stats.bySource[source] || 0) + 1;
        }

        // Update timeline counts
        if (result.factors?.timeline) {
            const timeline = result.factors.timeline;
            this.stats.byTimeline[timeline] = (this.stats.byTimeline[timeline] || 0) + 1;
        }
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[LeadScoring] Debug mode enabled');
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
        // Update weights if provided
        if (newConfig.weights) {
            const total = Object.values(newConfig.weights).reduce((sum, val) => sum + val, 0);
            if (Math.abs(total - 100) > 0.01) {
                throw new Error('Weights must sum to 100');
            }
            this.scoringModel.weights = { ...this.scoringModel.weights, ...newConfig.weights };
        }

        // Update scores if provided
        if (newConfig.industryScores) {
            this.scoringModel.industryScores = { ...this.scoringModel.industryScores, ...newConfig.industryScores };
        }
        if (newConfig.sourceScores) {
            this.scoringModel.sourceScores = { ...this.scoringModel.sourceScores, ...newConfig.sourceScores };
        }
        if (newConfig.timelineScores) {
            this.scoringModel.timelineScores = { ...this.scoringModel.timelineScores, ...newConfig.timelineScores };
        }
        if (newConfig.engagementScores) {
            this.scoringModel.engagementScores = { ...this.scoringModel.engagementScores, ...newConfig.engagementScores };
        }
        if (newConfig.budgetScores) {
            this.scoringModel.budgetScores = { ...this.scoringModel.budgetScores, ...newConfig.budgetScores };
        }

        // Clear cache
        this.cache.clear();
        this.cacheTimestamps.clear();

        if (this.debugMode) {
            logger.debug('[LeadScoring] Configuration updated');
        }
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return {
            weights: { ...this.scoringModel.weights },
            industryScores: { ...this.scoringModel.industryScores },
            sourceScores: { ...this.scoringModel.sourceScores },
            timelineScores: { ...this.scoringModel.timelineScores },
            engagementScores: { ...this.scoringModel.engagementScores },
            budgetScores: { ...this.scoringModel.budgetScores }
        };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        // Unsubscribe from events
        for (const subscription of this.subscriptions) {
            if (typeof subscription === 'function') {
                subscription();
            }
        }
        this.subscriptions = [];

        // Clear cache
        this.cache.clear();
        this.cacheTimestamps.clear();

        this.initialized = false;
        logger.info('Lead scoring cleaned up');
    }
}

// Create and export singleton instance
export const leadScoring = new LeadScoring();

// Export class for testing
export default LeadScoring;
