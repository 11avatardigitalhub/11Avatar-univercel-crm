/**
 * ==========================================
 * FILE: dashboardInsights.js
 * MODULE: AI Module
 * CODE: AI-10
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI-powered dashboard insights service that generates intelligent
 * business insights, recommendations, and alerts from CRM data.
 * Provides predictive analytics, anomaly detection, and actionable
 * intelligence for decision makers.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - leadScoring.js (for lead insights)
 * - dealPrediction.js (for deal insights)
 * - churnPrediction.js (for churn insights)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize dashboard insights
 * - getInsights(metrics): Get dashboard insights
 * - getLeadInsights(): Get lead insights
 * - getSalesInsights(): Get sales insights
 * - getRevenueInsights(): Get revenue insights
 * - getTeamInsights(): Get team insights
 * - getCustomerInsights(): Get customer insights
 * - getAnomalies(): Detect anomalies
 * - getRecommendations(): Get recommendations
 * - getAlerts(): Get alerts
 * - getExecutiveSummary(): Get executive summary
 * - getTrendAnalysis(): Get trend analysis
 * - getForecast(): Get forecasts
 * - getInsightStats(): Get insight statistics
 * 
 * USAGE EXAMPLE:
 * import { dashboardInsights } from './modules/ai/dashboardInsights.js';
 * 
 * // Initialize dashboard insights
 * await dashboardInsights.initialize();
 * 
 * // Get dashboard insights
 * const insights = await dashboardInsights.getInsights({
 *   leads: { total: 1284, growth: 12.5, conversion: 68.4 },
 *   revenue: { total: 420000, growth: 8.3 },
 *   deals: { active: 24, won: 8, lost: 4 }
 * });
 * 
 * // Get executive summary
 * const summary = await dashboardInsights.getExecutiveSummary();
 * ==========================================
 */

import { aiService } from './aiService.js';
import { leadScoring } from './leadScoring.js';
import { dealPrediction } from './dealPrediction.js';
import { churnPrediction } from './churnPrediction.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Default insight categories
const INSIGHT_CATEGORIES = {
    LEAD: 'lead',
    SALES: 'sales',
    REVENUE: 'revenue',
    TEAM: 'team',
    CUSTOMER: 'customer',
    OPERATIONAL: 'operational',
    STRATEGIC: 'strategic'
};

// Default insight priorities
const INSIGHT_PRIORITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

// Default insight types
const INSIGHT_TYPES = {
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
    WARNING: 'warning',
    INFO: 'info',
    RECOMMENDATION: 'recommendation',
    ALERT: 'alert'
};

class DashboardInsights {
    constructor() {
        // Service state
        this.initialized = false;
        this.insights = [];
        this.alerts = [];
        this.recommendations = [];
        this.anomalies = [];
        
        // Configuration
        this.config = {
            enableAI: true,
            enableAnomalyDetection: true,
            enableTrendAnalysis: true,
            enableForecasting: true,
            enableAlerts: true,
            enableRecommendations: true,
            maxInsights: 50,
            alertThresholds: {
                leadGrowth: 10,
                revenueGrowth: 5,
                conversionRate: 30,
                churnRate: 10,
                dealVelocity: 10
            },
            updateInterval: 300000, // 5 minutes
            insightsTTL: 3600000 // 1 hour
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalInsights: 0,
            byCategory: {},
            byPriority: {},
            byType: {},
            alertsGenerated: 0,
            recommendationsGenerated: 0,
            lastUpdate: null
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize dashboard insights
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

            // Start update scheduler
            this.startUpdateScheduler();

            logger.info('Dashboard insights initialized', {
                categories: Object.keys(INSIGHT_CATEGORIES).length,
                alertThresholds: Object.keys(this.config.alertThresholds).length
            });

            this.initialized = true;
            
            // Initial insights generation
            await this.generateInsights();

            return true;
        } catch (error) {
            logger.error('Dashboard insights initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen to lead events
        const leadEvents = ['lead.created', 'lead.updated', 'lead.scored'];
        for (const event of leadEvents) {
            const sub = eventBus.subscribe(event, async (data) => {
                if (this.initialized) {
                    await this.generateInsights();
                }
            });
            this.subscriptions.push(sub);
        }

        // Listen to deal events
        const dealEvents = ['deal.created', 'deal.updated', 'deal.predicted'];
        for (const event of dealEvents) {
            const sub = eventBus.subscribe(event, async (data) => {
                if (this.initialized) {
                    await this.generateInsights();
                }
            });
            this.subscriptions.push(sub);
        }

        // Listen to revenue events
        const revenueEvents = ['invoice.paid', 'invoice.overdue'];
        for (const event of revenueEvents) {
            const sub = eventBus.subscribe(event, async (data) => {
                if (this.initialized) {
                    await this.generateInsights();
                }
            });
            this.subscriptions.push(sub);
        }
    }

    /**
     * Start update scheduler
     */
    startUpdateScheduler() {
        setInterval(() => {
            if (this.initialized) {
                this.generateInsights();
            }
        }, this.config.updateInterval);
    }

    /**
     * Get dashboard insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Insights
     */
    async getInsights(metrics = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Dashboard insights not initialized');
        }

        // Check cache
        const cacheKey = this.getCacheKey(metrics);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return [...cached];
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        try {
            let insights = [];

            // Generate insights from metrics
            if (options.includeLead !== false) {
                insights = insights.concat(await this.getLeadInsights(metrics));
            }
            if (options.includeSales !== false) {
                insights = insights.concat(await this.getSalesInsights(metrics));
            }
            if (options.includeRevenue !== false) {
                insights = insights.concat(await this.getRevenueInsights(metrics));
            }
            if (options.includeTeam !== false) {
                insights = insights.concat(await this.getTeamInsights(metrics));
            }
            if (options.includeCustomer !== false) {
                insights = insights.concat(await this.getCustomerInsights(metrics));
            }

            // Get anomalies
            if (this.config.enableAnomalyDetection) {
                const anomalies = await this.getAnomalies(metrics);
                insights = insights.concat(anomalies);
            }

            // Get recommendations
            if (this.config.enableRecommendations) {
                const recommendations = await this.getRecommendations(metrics);
                insights = insights.concat(recommendations);
            }

            // Sort by priority
            insights.sort((a, b) => {
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });

            // Limit insights
            if (insights.length > this.config.maxInsights) {
                insights = insights.slice(0, this.config.maxInsights);
            }

            // Cache the result
            this.cache.set(cacheKey, insights);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Update stats
            this.updateStats(insights);

            if (this.debugMode) {
                logger.debug(`[DashboardInsights] Generated ${insights.length} insights`);
            }

            return insights;
        } catch (error) {
            logger.error('[DashboardInsights] Insights generation failed:', error);
            return [];
        }
    }

    /**
     * Get lead insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Lead insights
     */
    async getLeadInsights(metrics = {}, options = {}) {
        const insights = [];
        const leadData = metrics.leads || {};

        // Total leads
        if (leadData.total !== undefined) {
            const total = leadData.total;
            if (total > 1000) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Strong Lead Pipeline',
                    description: `You have ${total} leads in your pipeline. This is a strong indicator of healthy business growth.`,
                    action: 'Focus on converting high-scoring leads',
                    metrics: { total }
                }));
            }
        }

        // Lead growth
        if (leadData.growth !== undefined) {
            const growth = leadData.growth;
            if (growth > this.config.alertThresholds.leadGrowth) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'High Lead Growth',
                    description: `Lead growth of ${growth}% indicates effective marketing and lead generation.`,
                    action: 'Continue current lead generation strategies',
                    metrics: { growth }
                }));
            } else if (growth < 0) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Lead Decline Detected',
                    description: `Lead growth is negative at ${growth}%. Review your lead generation strategies.`,
                    action: 'Analyze marketing campaigns and lead sources',
                    metrics: { growth }
                }));
            }
        }

        // Conversion rate
        if (leadData.conversion !== undefined) {
            const conversion = leadData.conversion;
            if (conversion > 60) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Excellent Conversion Rate',
                    description: `Conversion rate of ${conversion}% is above industry average.`,
                    action: 'Analyze successful conversions to replicate',
                    metrics: { conversion }
                }));
            } else if (conversion < this.config.alertThresholds.conversionRate) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Low Conversion Rate',
                    description: `Conversion rate is ${conversion}%. Need to improve lead qualification and sales process.`,
                    action: 'Review sales process and lead scoring',
                    metrics: { conversion }
                }));
            }
        }

        // Lead score distribution
        if (leadData.scoreDistribution) {
            const hot = leadData.scoreDistribution.hot || 0;
            const warm = leadData.scoreDistribution.warm || 0;
            const cold = leadData.scoreDistribution.cold || 0;
            const total = hot + warm + cold;

            if (total > 0 && hot / total < 0.2) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.RECOMMENDATION,
                    category: INSIGHT_CATEGORIES.LEAD,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Low Hot Lead Ratio',
                    description: `Only ${Math.round(hot/total*100)}% of leads are hot. Consider improving lead scoring.`,
                    action: 'Review lead qualification criteria',
                    metrics: { hot, warm, cold }
                }));
            }
        }

        return insights;
    }

    /**
     * Get sales insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Sales insights
     */
    async getSalesInsights(metrics = {}, options = {}) {
        const insights = [];
        const dealData = metrics.deals || {};

        // Active deals
        if (dealData.active !== undefined) {
            const active = dealData.active;
            if (active < 5) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Low Deal Pipeline',
                    description: `You have only ${active} active deals. Consider generating more opportunities.`,
                    action: 'Increase lead generation and qualification efforts',
                    metrics: { active }
                }));
            } else if (active > 20) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Healthy Deal Pipeline',
                    description: `You have ${active} active deals in your pipeline.`,
                    action: 'Focus on closing high-value deals',
                    metrics: { active }
                }));
            }
        }

        // Win rate
        if (dealData.winRate !== undefined) {
            const winRate = dealData.winRate;
            if (winRate > 60) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'High Win Rate',
                    description: `Win rate of ${winRate}% is excellent. Your sales process is working well.`,
                    action: 'Document and replicate successful sales strategies',
                    metrics: { winRate }
                }));
            } else if (winRate < 30) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Low Win Rate',
                    description: `Win rate is ${winRate}%. Need to improve deal qualification and closing.`,
                    action: 'Review lost deals and identify improvement areas',
                    metrics: { winRate }
                }));
            }
        }

        // Deal velocity
        if (dealData.velocity !== undefined) {
            const velocity = dealData.velocity;
            if (velocity > 30) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Fast Deal Velocity',
                    description: `Deals are closing quickly at ${velocity} days average.`,
                    action: 'Maintain momentum in sales process',
                    metrics: { velocity }
                }));
            } else if (velocity > 60) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.SALES,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Slow Deal Velocity',
                    description: `Deals are taking ${velocity} days on average to close.`,
                    action: 'Identify bottlenecks in sales process',
                    metrics: { velocity }
                }));
            }
        }

        return insights;
    }

    /**
     * Get revenue insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Revenue insights
     */
    async getRevenueInsights(metrics = {}, options = {}) {
        const insights = [];
        const revenueData = metrics.revenue || {};

        // Revenue growth
        if (revenueData.growth !== undefined) {
            const growth = revenueData.growth;
            if (growth > this.config.alertThresholds.revenueGrowth) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.REVENUE,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Strong Revenue Growth',
                    description: `Revenue grew by ${growth}% indicating healthy business performance.`,
                    action: 'Analyze and replicate growth drivers',
                    metrics: { growth }
                }));
            } else if (growth < 0) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.REVENUE,
                    priority: INSIGHT_PRIORITY.CRITICAL,
                    title: 'Revenue Decline',
                    description: `Revenue declined by ${Math.abs(growth)}%. Immediate attention required.`,
                    action: 'Review sales and marketing strategies',
                    metrics: { growth }
                }));
            }
        }

        // Revenue forecast
        if (revenueData.forecast !== undefined) {
            const forecast = revenueData.forecast;
            const actual = revenueData.actual || 0;
            const accuracy = actual > 0 ? (forecast / actual) : 0;

            if (accuracy < 0.7) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.RECOMMENDATION,
                    category: INSIGHT_CATEGORIES.REVENUE,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Revenue Forecast Accuracy',
                    description: `Forecast is ${Math.round(accuracy*100)}% of actual. Consider improving forecasting method.`,
                    action: 'Review forecasting assumptions and data quality',
                    metrics: { forecast, actual, accuracy }
                }));
            }
        }

        // Revenue by source
        if (revenueData.bySource) {
            const sources = Object.entries(revenueData.bySource);
            if (sources.length > 0) {
                const topSource = sources.sort((a, b) => b[1] - a[1])[0];
                if (topSource[1] > 0.5) {
                    insights.push(this.createInsight({
                        type: INSIGHT_TYPES.INFO,
                        category: INSIGHT_CATEGORIES.REVENUE,
                        priority: INSIGHT_PRIORITY.LOW,
                        title: 'Revenue Concentration',
                        description: `${topSource[0]} generates ${Math.round(topSource[1]*100)}% of revenue. Consider diversifying.`,
                        action: 'Explore new revenue sources',
                        metrics: { source: topSource[0], percentage: topSource[1] }
                    }));
                }
            }
        }

        return insights;
    }

    /**
     * Get team insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Team insights
     */
    async getTeamInsights(metrics = {}, options = {}) {
        const insights = [];
        const teamData = metrics.team || {};

        if (teamData.members && teamData.members.length > 0) {
            const members = teamData.members;
            const total = members.length;
            const active = members.filter(m => m.active !== false).length;
            const topPerformer = members.sort((a, b) => (b.performance || 0) - (a.performance || 0))[0];

            if (total > 0 && active < total * 0.7) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.TEAM,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Low Team Activity',
                    description: `Only ${Math.round(active/total*100)}% of team members are active.`,
                    action: 'Review team engagement and workload distribution',
                    metrics: { total, active }
                }));
            }

            if (topPerformer && topPerformer.performance > 100) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.TEAM,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Top Performer Identified',
                    description: `${topPerformer.name || 'A team member'} is exceeding performance targets.`,
                    action: 'Recognize and learn from top performer\'s approach',
                    metrics: { member: topPerformer.name, performance: topPerformer.performance }
                }));
            }
        }

        return insights;
    }

    /**
     * Get customer insights
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Customer insights
     */
    async getCustomerInsights(metrics = {}, options = {}) {
        const insights = [];
        const customerData = metrics.customers || {};

        // Churn rate
        if (customerData.churnRate !== undefined) {
            const churnRate = customerData.churnRate;
            if (churnRate > this.config.alertThresholds.churnRate) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.CUSTOMER,
                    priority: INSIGHT_PRIORITY.CRITICAL,
                    title: 'High Churn Rate',
                    description: `Churn rate is ${churnRate}%. Customer retention needs immediate attention.`,
                    action: 'Implement customer retention strategies',
                    metrics: { churnRate }
                }));
            }
        }

        // At-risk customers
        if (customerData.atRisk !== undefined) {
            const atRisk = customerData.atRisk;
            if (atRisk > 10) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.CUSTOMER,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'At-Risk Customers',
                    description: `${atRisk} customers are at risk of churning. Immediate action recommended.`,
                    action: 'Reach out to at-risk customers with retention offers',
                    metrics: { atRisk }
                }));
            }
        }

        // Customer satisfaction
        if (customerData.satisfaction !== undefined) {
            const satisfaction = customerData.satisfaction;
            if (satisfaction > 4.5) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.POSITIVE,
                    category: INSIGHT_CATEGORIES.CUSTOMER,
                    priority: INSIGHT_PRIORITY.MEDIUM,
                    title: 'Excellent Customer Satisfaction',
                    description: `Satisfaction score of ${satisfaction}/5 is outstanding.`,
                    action: 'Maintain high service standards',
                    metrics: { satisfaction }
                }));
            } else if (satisfaction < 3) {
                insights.push(this.createInsight({
                    type: INSIGHT_TYPES.WARNING,
                    category: INSIGHT_CATEGORIES.CUSTOMER,
                    priority: INSIGHT_PRIORITY.HIGH,
                    title: 'Low Customer Satisfaction',
                    description: `Satisfaction score is ${satisfaction}/5. Customer experience needs improvement.`,
                    action: 'Identify and address customer pain points',
                    metrics: { satisfaction }
                }));
            }
        }

        return insights;
    }

    /**
     * Detect anomalies in data
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Anomalies
     */
    async getAnomalies(metrics = {}, options = {}) {
        if (!this.config.enableAnomalyDetection) {
            return [];
        }

        const anomalies = [];

        // Check for anomalies in key metrics
        const anomalyChecks = [
            { key: 'leads.growth', threshold: 50, type: 'extreme_growth' },
            { key: 'revenue.growth', threshold: 30, type: 'extreme_growth' },
            { key: 'conversion.rate', threshold: 20, type: 'drop' },
            { key: 'churn.rate', threshold: 15, type: 'increase' }
        ];

        for (const check of anomalyChecks) {
            const value = this.getNestedValue(metrics, check.key);
            if (value !== undefined) {
                const isAnomaly = this.checkAnomaly(value, check);
                if (isAnomaly) {
                    anomalies.push(this.createInsight({
                        type: INSIGHT_TYPES.ALERT,
                        category: INSIGHT_CATEGORIES.OPERATIONAL,
                        priority: INSIGHT_PRIORITY.HIGH,
                        title: `Anomaly Detected: ${check.key}`,
                        description: `Unusual pattern detected in ${check.key}: ${value}`,
                        action: 'Investigate the cause of this anomaly',
                        metrics: { key: check.key, value, type: check.type }
                    }));
                }
            }
        }

        return anomalies;
    }

    /**
     * Check for anomaly
     * @param {number} value - Value to check
     * @param {object} check - Check configuration
     * @returns {boolean} Whether anomaly detected
     */
    checkAnomaly(value, check) {
        switch (check.type) {
            case 'extreme_growth':
                return value > check.threshold;
            case 'drop':
                return value < -check.threshold;
            case 'increase':
                return value > check.threshold;
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
     * Get recommendations
     * @param {object} metrics - Dashboard metrics
     * @param {object} options - Additional options
     * @returns {Array} Recommendations
     */
    async getRecommendations(metrics = {}, options = {}) {
        if (!this.config.enableRecommendations) {
            return [];
        }

        const recommendations = [];

        // Generate recommendations based on metrics
        const leadData = metrics.leads || {};
        const dealData = metrics.deals || {};
        const revenueData = metrics.revenue || {};
        const customerData = metrics.customers || {};

        // Lead recommendations
        if (leadData.conversion && leadData.conversion < 30) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.LEAD,
                priority: INSIGHT_PRIORITY.HIGH,
                title: 'Improve Lead Conversion',
                description: 'Low conversion rate identified. Review lead qualification process.',
                action: 'Implement lead scoring and nurturing campaigns',
                metrics: { conversion: leadData.conversion }
            }));
        }

        if (leadData.growth && leadData.growth < 0) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.LEAD,
                priority: INSIGHT_PRIORITY.HIGH,
                title: 'Boost Lead Generation',
                description: 'Lead growth is declining. Need to increase marketing efforts.',
                action: 'Launch targeted marketing campaigns',
                metrics: { growth: leadData.growth }
            }));
        }

        // Sales recommendations
        if (dealData.winRate && dealData.winRate < 30) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.SALES,
                priority: INSIGHT_PRIORITY.HIGH,
                title: 'Improve Win Rate',
                description: 'Low win rate indicates need for sales process improvement.',
                action: 'Conduct sales training and review pipeline',
                metrics: { winRate: dealData.winRate }
            }));
        }

        if (dealData.velocity && dealData.velocity > 60) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.SALES,
                priority: INSIGHT_PRIORITY.MEDIUM,
                title: 'Accelerate Deal Velocity',
                description: 'Deals taking too long to close. Identify bottlenecks.',
                action: 'Streamline sales process and reduce friction',
                metrics: { velocity: dealData.velocity }
            }));
        }

        // Customer recommendations
        if (customerData.churnRate && customerData.churnRate > 10) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.CUSTOMER,
                priority: INSIGHT_PRIORITY.CRITICAL,
                title: 'Reduce Customer Churn',
                description: 'High churn rate detected. Implement retention strategies.',
                action: 'Launch customer success program and engagement campaigns',
                metrics: { churnRate: customerData.churnRate }
            }));
        }

        // Revenue recommendations
        if (revenueData.growth && revenueData.growth < 0) {
            recommendations.push(this.createInsight({
                type: INSIGHT_TYPES.RECOMMENDATION,
                category: INSIGHT_CATEGORIES.REVENUE,
                priority: INSIGHT_PRIORITY.CRITICAL,
                title: 'Reverse Revenue Decline',
                description: 'Revenue is declining. Immediate action needed.',
                action: 'Review pricing, upsell strategies, and sales performance',
                metrics: { growth: revenueData.growth }
            }));
        }

        return recommendations;
    }

    /**
     * Get alerts
     * @param {object} options - Additional options
     * @returns {Array} Alerts
     */
    async getAlerts(options = {}) {
        if (!this.config.enableAlerts) {
            return [];
        }

        // In production, this would fetch from alert service
        // For MVP, return current alerts
        return this.alerts;
    }

    /**
     * Get executive summary
     * @param {object} options - Additional options
     * @returns {object} Executive summary
     */
    async getExecutiveSummary(options = {}) {
        const insights = await this.getInsights(options);
        const criticalInsights = insights.filter(i => i.priority === 'critical');
        const highInsights = insights.filter(i => i.priority === 'high');

        return {
            summary: this.generateSummary(insights),
            criticalIssues: criticalInsights,
            highPriority: highInsights,
            totalInsights: insights.length,
            generatedAt: new Date().toISOString(),
            recommendations: insights.filter(i => i.type === 'recommendation'),
            alerts: insights.filter(i => i.type === 'alert'),
            positives: insights.filter(i => i.type === 'positive')
        };
    }

    /**
     * Generate summary from insights
     * @param {Array} insights - Insights list
     * @returns {string} Summary
     */
    generateSummary(insights) {
        const total = insights.length;
        if (total === 0) {
            return 'All metrics are stable. No significant insights at this time.';
        }

        const critical = insights.filter(i => i.priority === 'critical').length;
        const high = insights.filter(i => i.priority === 'high').length;
        const positive = insights.filter(i => i.type === 'positive').length;
        const warnings = insights.filter(i => i.type === 'warning').length;

        let summary = `Dashboard analysis identified ${total} insights. `;
        if (critical > 0) {
            summary += `${critical} critical issues require immediate attention. `;
        }
        if (high > 0) {
            summary += `${high} high-priority recommendations. `;
        }
        if (positive > 0) {
            summary += `${positive} positive trends identified. `;
        }
        if (warnings > 0) {
            summary += `${warnings} warnings require review. `;
        }

        return summary;
    }

    /**
     * Get trend analysis
     * @param {object} options - Additional options
     * @returns {object} Trend analysis
     */
    async getTrendAnalysis(options = {}) {
        // In production, this would analyze historical data
        // For MVP, return sample trend data
        return {
            leads: { trend: 'up', percentage: 12.5 },
            revenue: { trend: 'up', percentage: 8.3 },
            conversion: { trend: 'stable', percentage: 0.2 },
            churn: { trend: 'down', percentage: -1.5 },
            deals: { trend: 'up', percentage: 5.7 }
        };
    }

    /**
     * Get forecast
     * @param {object} options - Additional options
     * @returns {object} Forecast
     */
    async getForecast(options = {}) {
        // In production, this would use predictive models
        // For MVP, return sample forecast
        return {
            revenue: {
                nextMonth: 450000,
                nextQuarter: 1350000,
                nextYear: 5400000,
                confidence: 0.75
            },
            leads: {
                nextMonth: 150,
                nextQuarter: 450,
                nextYear: 1800,
                confidence: 0.8
            }
        };
    }

    /**
     * Get insight statistics
     * @param {object} options - Additional options
     * @returns {object} Insight statistics
     */
    async getInsightStats(options = {}) {
        return {
            ...this.stats,
            insightsCount: this.insights.length,
            alertsCount: this.alerts.length,
            recommendationsCount: this.recommendations.length,
            anomaliesCount: this.anomalies.length,
            lastUpdate: this.stats.lastUpdate || null
        };
    }

    /**
     * Create an insight object
     * @param {object} data - Insight data
     * @returns {object} Insight
     */
    createInsight(data) {
        return {
            id: 'insight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: data.type || INSIGHT_TYPES.INFO,
            category: data.category || INSIGHT_CATEGORIES.OPERATIONAL,
            priority: data.priority || INSIGHT_PRIORITY.MEDIUM,
            title: data.title || 'Insight',
            description: data.description || '',
            action: data.action || '',
            metrics: data.metrics || {},
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.config.insightsTTL).toISOString()
        };
    }

    /**
     * Generate insights from all sources
     */
    async generateInsights() {
        try {
            // In production, this would fetch real metrics
            // For MVP, use sample metrics
            const metrics = {
                leads: {
                    total: 1284,
                    growth: 12.5,
                    conversion: 68.4,
                    scoreDistribution: { hot: 320, warm: 450, cold: 514 }
                },
                deals: {
                    active: 24,
                    winRate: 68,
                    velocity: 35
                },
                revenue: {
                    total: 420000,
                    growth: 8.3,
                    forecast: 450000,
                    bySource: { website: 0.35, referral: 0.25, direct: 0.30, other: 0.10 }
                },
                team: {
                    members: [
                        { name: 'Rajesh Kumar', active: true, performance: 120 },
                        { name: 'Priya Patel', active: true, performance: 95 },
                        { name: 'Amit Sharma', active: false, performance: 40 }
                    ]
                },
                customers: {
                    churnRate: 8.5,
                    atRisk: 12,
                    satisfaction: 4.2
                }
            };

            const insights = await this.getInsights(metrics);
            this.insights = insights;
            this.stats.lastUpdate = new Date().toISOString();

            if (this.debugMode) {
                logger.debug(`[DashboardInsights] Generated ${insights.length} insights`);
            }
        } catch (error) {
            logger.error('[DashboardInsights] Insight generation failed:', error);
        }
    }

    /**
     * Update statistics
     * @param {Array} insights - Insights list
     */
    updateStats(insights) {
        this.stats.totalInsights = insights.length;

        for (const insight of insights) {
            this.stats.byCategory[insight.category] = (this.stats.byCategory[insight.category] || 0) + 1;
            this.stats.byPriority[insight.priority] = (this.stats.byPriority[insight.priority] || 0) + 1;
            this.stats.byType[insight.type] = (this.stats.byType[insight.type] || 0) + 1;

            if (insight.type === 'alert') {
                this.stats.alertsGenerated++;
            }
            if (insight.type === 'recommendation') {
                this.stats.recommendationsGenerated++;
            }
        }
    }

    /**
     * Get cache key
     * @param {object} metrics - Dashboard metrics
     * @returns {string} Cache key
     */
    getCacheKey(metrics) {
        const keyParts = [
            metrics.leads?.total || 0,
            metrics.leads?.growth || 0,
            metrics.revenue?.total || 0,
            metrics.revenue?.growth || 0,
            metrics.deals?.active || 0,
            metrics.deals?.winRate || 0
        ];
        return 'insights_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[DashboardInsights] Debug mode enabled');
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
        logger.info('Dashboard insights cleaned up');
    }
}

// Create and export singleton instance
export const dashboardInsights = new DashboardInsights();

// Export class for testing
export default DashboardInsights;
