/**
 * ==========================================
 * FILE: dealManager.js
 * MODULE: CRM Module
 * CODE: CRM-4
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Deal management operations for the CRM module.
 * Handles advanced deal operations, pipeline management,
 * forecasting, and analytics.
 * 
 * DEPENDENCIES:
 * - dealRepository.js (for data access)
 * - customerRepository.js (for customer operations)
 * - taskRepository.js (for task creation)
 * - eventBus.js (for events)
 * 
 * FUNCTIONS:
 * - bulkImport(deals): Bulk import deals
 * - bulkUpdate(updates): Bulk update deals
 * - moveDeal(id, stageId): Move deal to stage
 * - getDealForecast(options): Get deal forecast
 * - getPipelineAnalytics(options): Get pipeline analytics
 * - getDealVelocity(options): Get deal velocity
 * - getWinRateAnalysis(options): Get win rate analysis
 * - getLostReasonAnalysis(options): Get lost reason analysis
 * - getDealTimeline(id): Get deal timeline
 * - getDealInsights(id): Get AI insights
 * - getDealHealth(id): Get deal health score
 * - getNextBestAction(id): Get next best action
 * - getDealProbability(id): Get deal probability
 * - updateProbability(id, probability): Update probability
 * - getDealValue(id): Get deal value
 * - updateValue(id, value): Update value
 * - getProductsForDeal(id): Get products for deal
 * - addProduct(id, product): Add product to deal
 * - removeProduct(id, productId): Remove product from deal
 * - getRevenueForecast(options): Get revenue forecast
 * 
 * USAGE EXAMPLE:
 * import { dealManager } from './modules/crm/dealManager.js';
 * 
 * // Move deal to next stage
 * await dealManager.moveDeal('deal_123', 'stage_proposal');
 * 
 * // Get deal forecast
 * const forecast = await dealManager.getDealForecast({ months: 3 });
 * 
 * // Get deal insights
 * const insights = await dealManager.getDealInsights('deal_123');
 * ==========================================
 */

import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { customerRepository } from '../../layers/data/repositories/customerRepository.js';
import { taskRepository } from '../../layers/data/repositories/taskRepository.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

class DealManager {
    constructor() {
        // Configuration
        this.config = {
            autoCreateTasks: true,
            probabilityUpdateOnStageChange: true,
            forecastMonths: 3,
            pipelineStages: [
                { id: 'new', name: 'New', probability: 10, order: 0 },
                { id: 'contacted', name: 'Contacted', probability: 20, order: 1 },
                { id: 'qualified', name: 'Qualified', probability: 30, order: 2 },
                { id: 'negotiation', name: 'Negotiation', probability: 50, order: 3 },
                { id: 'proposal', name: 'Proposal Sent', probability: 60, order: 4 },
                { id: 'verbal_yes', name: 'Verbal Yes', probability: 80, order: 5 },
                { id: 'invoice', name: 'Invoice Sent', probability: 85, order: 6 },
                { id: 'won', name: 'Won', probability: 100, order: 7 },
                { id: 'lost', name: 'Lost', probability: 0, order: 8 }
            ]
        };
        
        // Cache
        this.dealCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Bulk import deals
     * @param {Array} deals - Array of deal data
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async bulkImport(deals, options = {}) {
        if (!deals || deals.length === 0) {
            throw new Error('No deals to import');
        }

        const results = {
            total: deals.length,
            imported: 0,
            failed: 0,
            errors: []
        };

        for (const dealData of deals) {
            try {
                // Validate customer exists
                if (dealData.customerId) {
                    const customer = await customerRepository.findById(dealData.customerId);
                    if (!customer && !options.skipValidation) {
                        results.failed++;
                        results.errors.push({
                            data: dealData,
                            error: `Customer ${dealData.customerId} not found`
                        });
                        continue;
                    }
                }

                await dealRepository.create(dealData, {
                    userId: options.userId || 'system',
                    skipValidation: options.skipValidation || false
                });
                results.imported++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    data: dealData,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk deal import: ${results.imported} imported, ${results.failed} failed`);
        return results;
    }

    /**
     * Bulk update deals
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
                await dealRepository.update(update.id, update.data, {
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
     * Move deal to a stage
     * @param {string} id - Deal ID
     * @param {string} stageId - Stage ID
     * @param {object} options - Additional options
     * @returns {object} Updated deal
     */
    async moveDeal(id, stageId, options = {}) {
        const deal = await dealRepository.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        // Get stage info
        const pipeline = dealRepository.getPipelines().find(p => p.id === deal.pipelineId);
        const stage = pipeline.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error(`Stage ${stageId} not found in pipeline`);
        }

        // Update deal
        const updateData = {
            stageId: stageId
        };

        // Update probability if configured
        if (this.config.probabilityUpdateOnStageChange) {
            updateData.probability = stage.probability;
        }

        const updatedDeal = await dealRepository.update(id, updateData, {
            userId: options.userId || 'system'
        });

        this.invalidateCache(id);

        // Create task if configured
        if (this.config.autoCreateTasks) {
            await this.createStageChangeTask(updatedDeal, stage, options);
        }

        // Emit event
        eventBus.publish('deal.stage_changed', {
            dealId: id,
            oldStage: deal.stageId,
            newStage: stageId,
            userId: options.userId || 'system'
        });

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'deal.stage_changed',
            'deal',
            { dealId: id, oldStage: deal.stageId, newStage: stageId }
        );

        return updatedDeal;
    }

    /**
     * Create task for stage change
     * @param {object} deal - Deal object
     * @param {object} stage - Stage object
     * @param {object} options - Additional options
     */
    async createStageChangeTask(deal, stage, options = {}) {
        const taskData = {
            title: `Complete ${stage.name} stage for ${deal.title}`,
            description: `Move deal "${deal.title}" through ${stage.name} stage`,
            type: 'deal',
            priority: 'medium',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            assignedTo: deal.assignedTo || options.userId || null,
            relatedTo: {
                type: 'deal',
                id: deal.id
            },
            notes: `Auto-created task for stage: ${stage.name}`
        };

        await taskRepository.create(taskData, {
            userId: options.userId || 'system'
        });
    }

    /**
     * Get deal forecast
     * @param {object} options - Forecast options
     * @returns {object} Forecast data
     */
    async getDealForecast(options = {}) {
        const months = options.months || this.config.forecastMonths;
        const forecast = await dealRepository.getRevenueForecast({
            months: months,
            ...options
        });

        // Add analysis
        return {
            ...forecast,
            analysis: {
                totalWeighted: forecast.weightedTotal,
                totalUngrouped: forecast.total,
                averageDealSize: forecast.dealsCount > 0 ? forecast.total / forecast.dealsCount : 0,
                confidence: this.calculateForecastConfidence(forecast),
                monthlyBreakdown: forecast.monthly.map(m => ({
                    ...m,
                    confidence: this.calculateMonthlyConfidence(m)
                }))
            }
        };
    }

    /**
     * Calculate forecast confidence
     * @param {object} forecast - Forecast data
     * @returns {number} Confidence percentage
     */
    calculateForecastConfidence(forecast) {
        if (!forecast.monthly || forecast.monthly.length === 0) {
            return 0;
        }

        // Higher confidence if there are more deals and higher weighted values
        const totalWeighted = forecast.weightedTotal || 0;
        const totalValue = forecast.total || 0;
        
        if (totalValue === 0) return 0;
        
        const ratio = totalWeighted / totalValue;
        const confidence = Math.min(95, Math.round(ratio * 100));
        
        return confidence;
    }

    /**
     * Calculate monthly confidence
     * @param {object} month - Monthly data
     * @returns {number} Confidence percentage
     */
    calculateMonthlyConfidence(month) {
        if (!month.dealsCount || month.dealsCount === 0) {
            return 0;
        }

        const ratio = month.weightedValue / month.totalValue;
        const baseConfidence = Math.min(90, Math.round(ratio * 100));
        
        // Adjust based on deal count
        const countBonus = Math.min(10, month.dealsCount * 2);
        return Math.min(95, baseConfidence + countBonus);
    }

    /**
     * Get pipeline analytics
     * @param {object} options - Additional options
     * @returns {object} Pipeline analytics
     */
    async getPipelineAnalytics(options = {}) {
        const stats = await dealRepository.getPipelineStats(options);
        const deals = await dealRepository.findAll({ status: 'active' }, options);
        const wonDeals = await dealRepository.findAll({ status: 'won' }, options);
        const lostDeals = await dealRepository.findAll({ status: 'lost' }, options);

        // Calculate pipeline metrics
        const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
        const weightedValue = deals.reduce((sum, d) => sum + (d.value * (d.probability / 100)), 0);
        
        // Stage distribution
        const stageDistribution = {};
        for (const deal of deals) {
            stageDistribution[deal.stageId] = (stageDistribution[deal.stageId] || 0) + 1;
        }

        // Average deal age
        const avgAge = deals.reduce((sum, d) => {
            const age = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return sum + age;
        }, 0) / (deals.length || 1);

        // Velocity (deals closed per month)
        const velocity = this.calculateDealVelocity(deals);

        return {
            pipeline: {
                totalDeals: deals.length,
                totalValue: totalValue,
                weightedValue: Math.round(weightedValue),
                averageDealSize: deals.length > 0 ? totalValue / deals.length : 0,
                averageAge: Math.round(avgAge),
                velocity: velocity,
                stageDistribution: stageDistribution
            },
            conversion: {
                winRate: this.calculateWinRate(wonDeals, lostDeals),
                lossRate: this.calculateLossRate(wonDeals, lostDeals),
                conversionFunnel: this.calculateConversionFunnel(deals)
            },
            trends: {
                dealsCreated: deals.length,
                dealsWon: wonDeals.length,
                dealsLost: lostDeals.length,
                monthOverMonth: this.calculateMonthOverMonth(deals)
            }
        };
    }

    /**
     * Calculate deal velocity
     * @param {Array} deals - Deals list
     * @returns {number} Velocity
     */
    calculateDealVelocity(deals) {
        if (deals.length === 0) return 0;

        const now = Date.now();
        const oldest = deals.reduce((min, d) => {
            const created = new Date(d.createdAt).getTime();
            return created < min ? created : min;
        }, now);

        const daysSpan = (now - oldest) / (1000 * 60 * 60 * 24);
        if (daysSpan === 0) return deals.length;
        
        return Math.round((deals.length / daysSpan) * 30); // Deals per month
    }

    /**
     * Calculate win rate
     * @param {Array} wonDeals - Won deals
     * @param {Array} lostDeals - Lost deals
     * @returns {number} Win rate percentage
     */
    calculateWinRate(wonDeals, lostDeals) {
        const total = wonDeals.length + lostDeals.length;
        if (total === 0) return 0;
        return Math.round((wonDeals.length / total) * 100);
    }

    /**
     * Calculate loss rate
     * @param {Array} wonDeals - Won deals
     * @param {Array} lostDeals - Lost deals
     * @returns {number} Loss rate percentage
     */
    calculateLossRate(wonDeals, lostDeals) {
        const total = wonDeals.length + lostDeals.length;
        if (total === 0) return 0;
        return Math.round((lostDeals.length / total) * 100);
    }

    /**
     * Calculate conversion funnel
     * @param {Array} deals - Deals list
     * @returns {object} Conversion funnel
     */
    calculateConversionFunnel(deals) {
        const stages = this.config.pipelineStages;
        const funnel = {};

        for (const stage of stages) {
            const count = deals.filter(d => d.stageId === stage.id).length;
            funnel[stage.id] = {
                name: stage.name,
                count: count,
                percentage: deals.length > 0 ? Math.round((count / deals.length) * 100) : 0
            };
        }

        return funnel;
    }

    /**
     * Calculate month-over-month trends
     * @param {Array} deals - Deals list
     * @returns {object} Month-over-month trends
     */
    calculateMonthOverMonth(deals) {
        const monthlyData = {};
        const now = new Date();

        for (let i = 0; i < 6; i++) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            const monthDeals = deals.filter(d => {
                const created = new Date(d.createdAt);
                return created.getFullYear() === date.getFullYear() &&
                       created.getMonth() === date.getMonth();
            });

            monthlyData[key] = {
                created: monthDeals.length,
                value: monthDeals.reduce((sum, d) => sum + d.value, 0),
                won: monthDeals.filter(d => d.status === 'won').length
            };
        }

        return monthlyData;
    }

    /**
     * Get deal velocity analysis
     * @param {object} options - Additional options
     * @returns {object} Velocity analysis
     */
    async getDealVelocity(options = {}) {
        const deals = await dealRepository.findAll({ status: 'active' }, options);
        const wonDeals = await dealRepository.findAll({ status: 'won' }, options);
        const lostDeals = await dealRepository.findAll({ status: 'lost' }, options);

        return {
            averageTimeToWon: this.calculateAverageTimeToClose(wonDeals),
            averageTimeToLost: this.calculateAverageTimeToClose(lostDeals),
            averageTimePerStage: this.calculateAverageTimePerStage(deals),
            bottlenecks: this.identifyBottlenecks(deals),
            recommendations: this.generateVelocityRecommendations(deals)
        };
    }

    /**
     * Calculate average time to close
     * @param {Array} deals - Deals list
     * @returns {number} Average days to close
     */
    calculateAverageTimeToClose(deals) {
        if (deals.length === 0) return 0;

        const totalDays = deals.reduce((sum, d) => {
            if (!d.actualClose) return sum;
            const days = (new Date(d.actualClose).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0);

        return Math.round(totalDays / deals.length);
    }

    /**
     * Calculate average time per stage
     * @param {Array} deals - Deals list
     * @returns {object} Average time per stage
     */
    calculateAverageTimePerStage(deals) {
        const stageTimes = {};

        for (const deal of deals) {
            // This would require stage change tracking
            // For MVP, estimate based on current stage
            const age = (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            const stageOrder = this.config.pipelineStages.find(s => s.id === deal.stageId)?.order || 0;
            
            if (stageOrder > 0) {
                const avgTimePerStage = age / stageOrder;
                stageTimes[deal.stageId] = (stageTimes[deal.stageId] || 0) + avgTimePerStage;
            }
        }

        // Average per stage
        for (const stageId of Object.keys(stageTimes)) {
            const dealsInStage = deals.filter(d => d.stageId === stageId).length;
            if (dealsInStage > 0) {
                stageTimes[stageId] = Math.round(stageTimes[stageId] / dealsInStage);
            }
        }

        return stageTimes;
    }

    /**
     * Identify bottlenecks in pipeline
     * @param {Array} deals - Deals list
     * @returns {Array} Bottleneck stages
     */
    identifyBottlenecks(deals) {
        const bottlenecks = [];
        const stageCounts = {};

        for (const deal of deals) {
            stageCounts[deal.stageId] = (stageCounts[deal.stageId] || 0) + 1;
        }

        const total = deals.length;
        for (const [stageId, count] of Object.entries(stageCounts)) {
            const percentage = (count / total) * 100;
            if (percentage > 30) {
                const stage = this.config.pipelineStages.find(s => s.id === stageId);
                bottlenecks.push({
                    stageId: stageId,
                    stageName: stage?.name || stageId,
                    count: count,
                    percentage: Math.round(percentage),
                    severity: percentage > 50 ? 'High' : 'Medium'
                });
            }
        }

        return bottlenecks;
    }

    /**
     * Generate velocity recommendations
     * @param {Array} deals - Deals list
     * @returns {Array} Recommendations
     */
    generateVelocityRecommendations(deals) {
        const recommendations = [];
        const bottlenecks = this.identifyBottlenecks(deals);

        for (const bottleneck of bottlenecks) {
            if (bottleneck.severity === 'High') {
                recommendations.push({
                    stage: bottleneck.stageName,
                    action: `Focus on moving deals out of ${bottleneck.stageName} stage`,
                    priority: 'High',
                    expectedImpact: '30% faster pipeline movement'
                });
            }
        }

        return recommendations;
    }

    /**
     * Get win rate analysis
     * @param {object} options - Additional options
     * @returns {object} Win rate analysis
     */
    async getWinRateAnalysis(options = {}) {
        const deals = await dealRepository.findAll({}, options);
        const wonDeals = deals.filter(d => d.status === 'won');
        const lostDeals = deals.filter(d => d.status === 'lost');

        // Analysis by various dimensions
        return {
            overall: {
                winRate: this.calculateWinRate(wonDeals, lostDeals),
                totalWon: wonDeals.length,
                totalLost: lostDeals.length,
                totalValueWon: wonDeals.reduce((sum, d) => sum + d.value, 0)
            },
            byIndustry: this.analyzeByDimension(deals, 'industry'),
            bySource: this.analyzeByDimension(deals, 'source'),
            byDealSize: this.analyzeByDealSize(deals),
            trends: this.calculateWinRateTrend(deals),
            recommendations: this.generateWinRateRecommendations(deals)
        };
    }

    /**
     * Analyze by dimension
     * @param {Array} deals - Deals list
     * @param {string} dimension - Dimension to analyze
     * @returns {object} Analysis by dimension
     */
    analyzeByDimension(deals, dimension) {
        const analysis = {};
        const grouped = {};

        for (const deal of deals) {
            const key = deal[dimension] || 'Unknown';
            if (!grouped[key]) {
                grouped[key] = { won: 0, lost: 0 };
            }
            if (deal.status === 'won') {
                grouped[key].won++;
            } else if (deal.status === 'lost') {
                grouped[key].lost++;
            }
        }

        for (const [key, data] of Object.entries(grouped)) {
            const total = data.won + data.lost;
            analysis[key] = {
                winRate: total > 0 ? Math.round((data.won / total) * 100) : 0,
                won: data.won,
                lost: data.lost,
                total: total
            };
        }

        return analysis;
    }

    /**
     * Analyze by deal size
     * @param {Array} deals - Deals list
     * @returns {object} Analysis by deal size
     */
    analyzeByDealSize(deals) {
        const sizeRanges = {
            'Small (< ₹50K)': { min: 0, max: 50000 },
            'Medium (₹50K-₹2L)': { min: 50000, max: 200000 },
            'Large (₹2L-₹10L)': { min: 200000, max: 1000000 },
            'Enterprise (> ₹10L)': { min: 1000000, max: Infinity }
        };

        const analysis = {};

        for (const [rangeName, range] of Object.entries(sizeRanges)) {
            const rangeDeals = deals.filter(d => 
                d.value >= range.min && d.value < range.max
            );
            const won = rangeDeals.filter(d => d.status === 'won').length;
            const lost = rangeDeals.filter(d => d.status === 'lost').length;
            const total = won + lost;

            analysis[rangeName] = {
                winRate: total > 0 ? Math.round((won / total) * 100) : 0,
                won: won,
                lost: lost,
                total: total,
                averageValue: total > 0 ? Math.round(rangeDeals.reduce((sum, d) => sum + d.value, 0) / total) : 0
            };
        }

        return analysis;
    }

    /**
     * Calculate win rate trend
     * @param {Array} deals - Deals list
     * @returns {object} Win rate trend
     */
    calculateWinRateTrend(deals) {
        const trend = {};
        const now = new Date();

        for (let i = 0; i < 6; i++) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const monthDeals = deals.filter(d => {
                const closed = new Date(d.actualClose || d.updatedAt);
                return closed.getFullYear() === date.getFullYear() &&
                       closed.getMonth() === date.getMonth() &&
                       (d.status === 'won' || d.status === 'lost');
            });

            const won = monthDeals.filter(d => d.status === 'won').length;
            const total = monthDeals.length;

            trend[key] = {
                winRate: total > 0 ? Math.round((won / total) * 100) : 0,
                won: won,
                total: total
            };
        }

        return trend;
    }

    /**
     * Generate win rate recommendations
     * @param {Array} deals - Deals list
     * @returns {Array} Recommendations
     */
    generateWinRateRecommendations(deals) {
        const recommendations = [];
        const analysis = this.analyzeByDimension(deals, 'industry');

        // Find industries with low win rates
        for (const [industry, data] of Object.entries(analysis)) {
            if (data.winRate < 30 && data.total > 5) {
                recommendations.push({
                    industry: industry,
                    action: `Consider specialized approach for ${industry} industry`,
                    currentWinRate: data.winRate,
                    potentialImprovement: '20-30%'
                });
            }
        }

        // Analyze deal size
        const sizeAnalysis = this.analyzeByDealSize(deals);
        if (sizeAnalysis['Enterprise (> ₹10L)']?.winRate < 30) {
            recommendations.push({
                action: 'Review approach for enterprise deals',
                currentWinRate: sizeAnalysis['Enterprise (> ₹10L)'].winRate,
                potentialImprovement: '25-35%'
            });
        }

        return recommendations;
    }

    /**
     * Get lost reason analysis
     * @param {object} options - Additional options
     * @returns {object} Lost reason analysis
     */
    async getLostReasonAnalysis(options = {}) {
        const lostDeals = await dealRepository.findAll({ status: 'lost' }, options);
        
        const reasons = {};
        for (const deal of lostDeals) {
            const reason = deal.lossReason || 'Unknown';
            reasons[reason] = (reasons[reason] || 0) + 1;
        }

        const total = lostDeals.length;
        const analysis = {
            totalLost: total,
            reasons: Object.entries(reasons).map(([reason, count]) => ({
                reason: reason,
                count: count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0
            })),
            topReasons: Object.entries(reasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([reason, count]) => ({
                    reason: reason,
                    count: count,
                    percentage: total > 0 ? Math.round((count / total) * 100) : 0
                })),
            insights: this.generateLostReasonInsights(reasons)
        };

        return analysis;
    }

    /**
     * Generate lost reason insights
     * @param {object} reasons - Lost reasons
     * @returns {Array} Insights
     */
    generateLostReasonInsights(reasons) {
        const insights = [];
        const total = Object.values(reasons).reduce((sum, count) => sum + count, 0);

        for (const [reason, count] of Object.entries(reasons)) {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            if (percentage > 20) {
                insights.push({
                    reason: reason,
                    percentage: percentage,
                    action: `Address ${reason} to reduce losses`,
                    impact: 'High'
                });
            }
        }

        return insights;
    }

    /**
     * Get deal timeline
     * @param {string} id - Deal ID
     * @param {object} options - Additional options
     * @returns {Array} Deal timeline
     */
    async getDealTimeline(id, options = {}) {
        const deal = await dealRepository.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        // In production, this would fetch from activity service
        // For MVP, return basic timeline
        const timeline = [
            {
                type: 'created',
                date: deal.createdAt,
                description: `Deal "${deal.title}" was created`
            }
        ];

        if (deal.status === 'won') {
            timeline.push({
                type: 'won',
                date: deal.actualClose || deal.updatedAt,
                description: `Deal "${deal.title}" was won`
            });
        }

        if (deal.status === 'lost') {
            timeline.push({
                type: 'lost',
                date: deal.actualClose || deal.updatedAt,
                description: `Deal "${deal.title}" was lost`
            });
        }

        return timeline;
    }

    /**
     * Get deal insights
     * @param {string} id - Deal ID
     * @param {object} options - Additional options
     * @returns {object} Deal insights
     */
    async getDealInsights(id, options = {}) {
        const deal = await dealRepository.findById(id);
        if (!deal) {
            throw new Error(`Deal ${id} not found`);
        }

        return {
            dealId: id,
            title: deal.title,
            value: deal.value,
            probability: deal.probability,
            stage: deal.stageId,
            health: this.calculateDealHealth(deal),
            nextBestAction: this.getNextBestAction(deal),
            riskFactors: this.getDealRiskFactors(deal),
            recommendations: this.generateDealRecommendations(deal)
        };
    }

    /**
     * Calculate deal health score
     * @param {object} deal - Deal object
     * @returns {object} Health score
     */
    calculateDealHealth(deal) {
        let score = 0;
        const factors = [];

        // Probability score
        if (deal.probability >= 70) {
            score += 30;
            factors.push('High probability');
        } else if (deal.probability >= 40) {
            score += 20;
            factors.push('Medium probability');
        } else {
            score += 10;
            factors.push('Low probability');
        }

        // Age score (younger deals are healthier)
        const age = (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (age < 30) {
            score += 20;
            factors.push('Recent deal');
        } else if (age < 60) {
            score += 15;
            factors.push('Moderate age');
        } else {
            score += 5;
            factors.push('Stale deal');
        }

        // Customer engagement
        if (deal.tags && deal.tags.length > 0) {
            score += 10;
            factors.push('Has tags');
        }

        if (deal.products && deal.products.length > 0) {
            score += 10;
            factors.push('Has products');
        }

        // Value score
        if (deal.value > 500000) {
            score += 10;
            factors.push('High value');
        }

        return {
            score: Math.min(100, score),
            factors: factors,
            status: score >= 70 ? 'Healthy' : score >= 40 ? 'At Risk' : 'Critical'
        };
    }

    /**
     * Get next best action for deal
     * @param {object} deal - Deal object
     * @returns {string} Recommended action
     */
    getNextBestAction(deal) {
        const stage = deal.stageId;
        const actions = {
            'new': 'Schedule discovery call',
            'contacted': 'Send follow-up email',
            'qualified': 'Prepare proposal',
            'negotiation': 'Review pricing and terms',
            'proposal': 'Follow up on proposal',
            'verbal_yes': 'Send contract for signature',
            'invoice': 'Follow up on payment',
            'won': 'Schedule implementation kickoff'
        };

        return actions[stage] || 'Schedule follow-up activity';
    }

    /**
     * Get deal risk factors
     * @param {object} deal - Deal object
     * @returns {Array} Risk factors
     */
    getDealRiskFactors(deal) {
        const risks = [];

        const age = (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (age > 60 && deal.status === 'active') {
            risks.push('Deal is over 60 days old');
        }

        if (deal.probability < 30) {
            risks.push('Low conversion probability');
        }

        if (!deal.products || deal.products.length === 0) {
            risks.push('No products specified');
        }

        if (!deal.assignedTo) {
            risks.push('No owner assigned');
        }

        return risks;
    }

    /**
     * Generate deal recommendations
     * @param {object} deal - Deal object
     * @returns {Array} Recommendations
     */
    generateDealRecommendations(deal) {
        const recommendations = [];
        const health = this.calculateDealHealth(deal);

        if (health.status === 'Critical') {
            recommendations.push({
                priority: 'High',
                action: 'Schedule urgent review meeting',
                description: 'Deal is at critical health status'
            });
        }

        if (deal.probability < 40) {
            recommendations.push({
                priority: 'High',
                action: 'Re-evaluate deal probability',
                description: 'Consider if deal should be moved to lost or re-scoped'
            });
        }

        if (!deal.assignedTo) {
            recommendations.push({
                priority: 'Medium',
                action: 'Assign deal owner',
                description: 'Deal needs an owner to drive it forward'
            });
        }

        const age = (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (age > 30 && deal.status === 'active') {
            recommendations.push({
                priority: 'Medium',
                action: 'Review deal progress',
                description: 'Deal has been active for over 30 days'
            });
        }

        return recommendations;
    }

    /**
     * Invalidate cache
     * @param {string} id - Deal ID
     */
    invalidateCache(id) {
        this.dealCache.delete(id);
        this.cacheTimestamps.delete(id);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.dealCache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[DealManager] Debug mode enabled');
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
export const dealManager = new DealManager();

// Export class for testing
export default DealManager;
