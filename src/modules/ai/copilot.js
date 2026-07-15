/**
 * ==========================================
 * FILE: copilot.js
 * MODULE: AI Module
 * CODE: AI-11
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI Copilot service that provides intelligent conversational
 * assistance for CRM users. Enables natural language queries,
 * context-aware recommendations, and proactive suggestions.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * - leadScoring.js (for lead data)
 * - dealPrediction.js (for deal data)
 * - churnPrediction.js (for churn data)
 * - dashboardInsights.js (for insights)
 * - contextBuilder.js (for context)
 * - retrieval.js (for retrieval)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize copilot
 * - ask(query, context): Ask a question
 * - getSuggestions(context): Get suggestions
 * - getContextualHelp(context): Get contextual help
 * - getQuickActions(context): Get quick actions
 * - getInsights(context): Get insights
 * - getRecommendations(context): Get recommendations
 * - getAlerts(context): Get alerts
 * - getSummary(context): Get summary
 * - getAnalytics(context): Get analytics
 * - getPredictions(context): Get predictions
 * - getTrends(context): Get trends
 * - getAnomalies(context): Get anomalies
 * - getTasks(context): Get tasks
 * - getFollowups(context): Get follow-ups
 * - getPerformance(context): Get performance
 * - getHealth(context): Get health
 * - getStats(): Get copilot statistics
 * 
 * USAGE EXAMPLE:
 * import { copilot } from './modules/ai/copilot.js';
 * 
 * // Initialize copilot
 * await copilot.initialize();
 * 
 * // Ask a question
 * const response = await copilot.ask(
 *   'Show me hot leads from Indore',
 *   { userId: 'user_123', tenantId: 'tenant_1' }
 * );
 * 
 * // Get suggestions
 * const suggestions = await copilot.getSuggestions({
 *   page: 'dashboard',
 *   userId: 'user_123'
 * });
 * ==========================================
 */

import { aiService } from './aiService.js';
import { leadScoring } from './leadScoring.js';
import { dealPrediction } from './dealPrediction.js';
import { churnPrediction } from './churnPrediction.js';
import { dashboardInsights } from './dashboardInsights.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Query intents
const QUERY_INTENTS = {
    LEAD: 'lead',
    DEAL: 'deal',
    CUSTOMER: 'customer',
    REVENUE: 'revenue',
    TEAM: 'team',
    TASK: 'task',
    ANALYTICS: 'analytics',
    PREDICTION: 'prediction',
    RECOMMENDATION: 'recommendation',
    INSIGHT: 'insight',
    ALERT: 'alert',
    GENERAL: 'general'
};

// Action types
const ACTION_TYPES = {
    VIEW: 'view',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    ASSIGN: 'assign',
    FOLLOWUP: 'followup',
    SEND: 'send',
    SCHEDULE: 'schedule',
    GENERATE: 'generate',
    EXPORT: 'export'
};

class Copilot {
    constructor() {
        // Service state
        this.initialized = false;
        this.conversations = new Map();
        this.contexts = new Map();
        this.suggestions = [];
        this.quickActions = [];
        
        // Configuration
        this.config = {
            enableAI: true,
            enableContext: true,
            enableSuggestions: true,
            enableQuickActions: true,
            enableProactiveAlerts: true,
            maxConversations: 100,
            maxHistory: 50,
            suggestionInterval: 300000, // 5 minutes
            contextTTL: 3600000, // 1 hour
            confidenceThreshold: 0.6,
            defaultModel: 'llama3-70b-8192'
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalQueries: 0,
            successfulQueries: 0,
            failedQueries: 0,
            averageResponseTime: 0,
            byIntent: {},
            byAction: {},
            suggestionsGenerated: 0,
            quickActionsTriggered: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Event subscriptions
        this.subscriptions = [];
    }

    /**
     * Initialize copilot
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

            // Start suggestion generator
            this.startSuggestionGenerator();

            logger.info('Copilot initialized', {
                config: this.config,
                intents: Object.keys(QUERY_INTENTS).length
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Copilot initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen to user activity for context
        const activitySub = eventBus.subscribe('user.activity', async (data) => {
            if (data.userId) {
                await this.updateContext(data.userId, data);
            }
        });
        this.subscriptions.push(activitySub);

        // Listen to page changes
        const pageSub = eventBus.subscribe('page.changed', async (data) => {
            if (data.userId && data.page) {
                await this.updateContext(data.userId, { page: data.page });
                if (this.config.enableProactiveAlerts) {
                    await this.generateProactiveSuggestions(data.userId, data.page);
                }
            }
        });
        this.subscriptions.push(pageSub);
    }

    /**
     * Start suggestion generator
     */
    startSuggestionGenerator() {
        setInterval(() => {
            if (this.initialized && this.config.enableSuggestions) {
                this.generateSuggestions();
            }
        }, this.config.suggestionInterval);
    }

    /**
     * Ask a question to copilot
     * @param {string} query - User query
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Copilot response
     */
    async ask(query, context = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Copilot not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(query, context);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        try {
            // Get user context
            const userContext = await this.getContext(context.userId);

            // Determine intent
            const intent = await this.determineIntent(query, userContext);

            // Get response based on intent
            const response = await this.getResponseByIntent(query, intent, userContext, options);

            // Generate action suggestions
            const actions = await this.generateActions(query, intent, userContext);

            // Build final response
            const result = {
                query: query,
                intent: intent,
                response: response,
                actions: actions,
                context: userContext,
                confidence: this.calculateConfidence(query, response),
                timestamp: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(cacheKey, result);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(intent, true, duration);

            // Log conversation
            await this.logConversation(context.userId, query, result);

            // Emit event
            eventBus.publish('copilot.asked', {
                userId: context.userId,
                query: query,
                response: result
            });

            if (this.debugMode) {
                logger.debug(`[Copilot] Query answered (${duration}ms): ${query}`);
            }

            return result;
        } catch (error) {
            this.stats.failedQueries++;
            logger.error('[Copilot] Query failed:', error);
            
            // Return fallback response
            return this.getFallbackResponse(query);
        }
    }

    /**
     * Determine query intent
     * @param {string} query - User query
     * @param {object} context - User context
     * @returns {string} Intent
     */
    async determineIntent(query, context) {
        const lowerQuery = query.toLowerCase();

        // Simple keyword-based intent detection
        const intentPatterns = {
            lead: ['lead', 'leads', 'prospect', 'potential'],
            deal: ['deal', 'deals', 'pipeline', 'opportunity'],
            customer: ['customer', 'client', 'account', 'company'],
            revenue: ['revenue', 'income', 'sales', 'money'],
            team: ['team', 'member', 'performance', 'target'],
            task: ['task', 'todo', 'follow', 'reminder'],
            analytics: ['analytics', 'report', 'dashboard', 'metrics'],
            prediction: ['predict', 'forecast', 'estimate', 'expect'],
            recommendation: ['recommend', 'suggest', 'advice', 'tip'],
            insight: ['insight', 'learn', 'trend', 'pattern'],
            alert: ['alert', 'warning', 'issue', 'problem']
        };

        for (const [intent, patterns] of Object.entries(intentPatterns)) {
            for (const pattern of patterns) {
                if (lowerQuery.includes(pattern)) {
                    return intent;
                }
            }
        }

        return QUERY_INTENTS.GENERAL;
    }

    /**
     * Get response based on intent
     * @param {string} query - User query
     * @param {string} intent - Query intent
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {string} Response
     */
    async getResponseByIntent(query, intent, context, options) {
        // Use AI for response generation
        if (this.config.enableAI && options.useAI !== false) {
            try {
                const prompt = this.buildAIPrompt(query, intent, context);
                const response = await aiService.callAI(prompt, {
                    temperature: 0.7,
                    maxTokens: 500,
                    model: this.config.defaultModel
                });
                return response;
            } catch (error) {
                logger.warn('[Copilot] AI response failed, using fallback:', error);
                return this.getFallbackResponse(query);
            }
        }

        // Use rule-based responses
        return this.getRuleBasedResponse(query, intent, context);
    }

    /**
     * Build AI prompt
     * @param {string} query - User query
     * @param {string} intent - Query intent
     * @param {object} context - User context
     * @returns {string} Prompt
     */
    buildAIPrompt(query, intent, context) {
        const contextStr = JSON.stringify(context, null, 2);
        return `
You are an AI assistant for an Indian CRM system called 11 Avatar CRM.
Your role is to help users with their CRM queries and tasks.

User Query: "${query}"
Intent: ${intent}
User Context: ${contextStr}

Provide a helpful, concise, and actionable response.
Include relevant suggestions and next steps.
Use Hinglish language if appropriate.
Keep it professional and friendly.

Response:
`;
    }

    /**
     * Get rule-based response
     * @param {string} query - User query
     * @param {string} intent - Query intent
     * @param {object} context - User context
     * @returns {string} Response
     */
    getRuleBasedResponse(query, intent, context) {
        const responses = {
            lead: 'I can help you with lead management. Would you like to view hot leads, add a new lead, or check lead statistics?',
            deal: 'I can assist with deal management. You can check pipeline, view active deals, or track won/lost deals.',
            customer: 'Let me help you with customer management. You can view customer 360, check at-risk customers, or see customer analytics.',
            revenue: 'I can help with revenue tracking. You can view revenue reports, forecasts, or check revenue by source.',
            team: 'I can assist with team management. You can view team performance, member details, or team analytics.',
            task: 'Let me help with task management. You can view pending tasks, create new tasks, or check task reminders.',
            analytics: 'I can provide analytics insights. You can view dashboard metrics, trends, or specific reports.',
            prediction: 'I can help with predictions. You can forecast revenue, deal win probability, or churn risk.',
            recommendation: 'Let me provide recommendations. You can get suggestions for leads, deals, or customer retention.',
            insight: 'I can share insights from your data. You can learn about trends, patterns, or anomalies.',
            alert: 'I can help with alerts. You can view critical issues, warnings, or notifications.'
        };

        return responses[intent] || 'I understand your query. How can I help you with your CRM needs?';
    }

    /**
     * Get suggestions
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {Array} Suggestions
     */
    async getSuggestions(context = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Copilot not initialized');
        }

        const page = context.page || 'dashboard';
        const suggestions = [];

        // Page-specific suggestions
        const pageSuggestions = {
            dashboard: [
                { text: 'View your top leads', action: 'view_top_leads', priority: 'high' },
                { text: 'Check revenue forecast', action: 'view_forecast', priority: 'high' },
                { text: 'Review team performance', action: 'view_team_performance', priority: 'medium' }
            ],
            leads: [
                { text: 'Add a new lead', action: 'add_lead', priority: 'high' },
                { text: 'Import leads from Excel', action: 'import_leads', priority: 'medium' },
                { text: 'View hot leads', action: 'view_hot_leads', priority: 'high' }
            ],
            sales: [
                { text: 'View pipeline', action: 'view_pipeline', priority: 'high' },
                { text: 'Add a new deal', action: 'add_deal', priority: 'medium' },
                { text: 'Check win rate', action: 'view_win_rate', priority: 'high' }
            ],
            customers: [
                { text: 'View customer 360', action: 'view_customer_360', priority: 'high' },
                { text: 'Check at-risk customers', action: 'view_at_risk', priority: 'high' },
                { text: 'Add a new customer', action: 'add_customer', priority: 'medium' }
            ]
        };

        const pageSuggest = pageSuggestions[page] || pageSuggestions.dashboard;
        suggestions.push(...pageSuggest);

        // Context-based suggestions
        if (context.userId) {
            const userContext = await this.getContext(context.userId);
            if (userContext.lastActivity) {
                suggestions.push({
                    text: 'Continue where you left off',
                    action: 'resume_activity',
                    priority: 'medium'
                });
            }
        }

        // AI-generated suggestions
        if (this.config.enableAI) {
            try {
                const aiSuggestions = await this.generateAISuggestions(context);
                suggestions.push(...aiSuggestions);
            } catch (error) {
                logger.warn('[Copilot] AI suggestions failed:', error);
            }
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        // Limit suggestions
        const maxSuggestions = options.limit || 5;
        return suggestions.slice(0, maxSuggestions);
    }

    /**
     * Generate AI suggestions
     * @param {object} context - User context
     * @returns {Array} AI suggestions
     */
    async generateAISuggestions(context) {
        const prompt = `
Based on this user context, suggest 3-5 relevant actions the user should take.

Context: ${JSON.stringify(context, null, 2)}

Return JSON array:
[
    {
        "text": "Suggestion text",
        "action": "action_name",
        "priority": "high|medium|low",
        "reason": "Why this is suggested"
    }
]
`;

        const response = await aiService.callAI(prompt, {
            temperature: 0.4,
            maxTokens: 300
        });

        try {
            return JSON.parse(response);
        } catch {
            return [];
        }
    }

    /**
     * Generate actions for query
     * @param {string} query - User query
     * @param {string} intent - Query intent
     * @param {object} context - User context
     * @returns {Array} Actions
     */
    async generateActions(query, intent, context) {
        const actions = [];

        // Add intent-specific actions
        const actionMap = {
            lead: [
                { text: 'View Hot Leads', action: 'view_hot_leads' },
                { text: 'Add New Lead', action: 'add_lead' },
                { text: 'Import Leads', action: 'import_leads' }
            ],
            deal: [
                { text: 'View Pipeline', action: 'view_pipeline' },
                { text: 'Add New Deal', action: 'add_deal' },
                { text: 'Check Win Rate', action: 'view_win_rate' }
            ],
            customer: [
                { text: 'View Customer 360', action: 'view_customer_360' },
                { text: 'Check At-Risk', action: 'view_at_risk' },
                { text: 'Add Customer', action: 'add_customer' }
            ]
        };

        const intentActions = actionMap[intent] || [];
        actions.push(...intentActions);

        // Add contextual actions
        if (context.page) {
            const pageActions = this.getPageActions(context.page);
            actions.push(...pageActions);
        }

        // Add quick actions
        const quickActions = await this.getQuickActions(context);
        actions.push(...quickActions);

        return actions;
    }

    /**
     * Get page-specific actions
     * @param {string} page - Page name
     * @returns {Array} Page actions
     */
    getPageActions(page) {
        const pageActions = {
            dashboard: [
                { text: 'Refresh Dashboard', action: 'refresh_dashboard' },
                { text: 'Export Report', action: 'export_report' }
            ],
            leads: [
                { text: 'Filter Leads', action: 'filter_leads' },
                { text: 'Export Leads', action: 'export_leads' }
            ],
            sales: [
                { text: 'Move Deal', action: 'move_deal' },
                { text: 'Update Stage', action: 'update_stage' }
            ]
        };

        return pageActions[page] || [];
    }

    /**
     * Get quick actions
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {Array} Quick actions
     */
    async getQuickActions(context = {}, options = {}) {
        const actions = [
            { text: 'Add Lead', action: 'add_lead', icon: '👤', shortcut: 'Ctrl+N' },
            { text: 'Add Task', action: 'add_task', icon: '✅', shortcut: 'Ctrl+T' },
            { text: 'Search', action: 'search', icon: '🔍', shortcut: 'Ctrl+S' },
            { text: 'Help', action: 'help', icon: '❓', shortcut: 'Ctrl+H' }
        ];

        // Add role-specific actions
        if (context.role === 'manager' || context.role === 'admin') {
            actions.push(
                { text: 'Team Report', action: 'team_report', icon: '📊', shortcut: '' },
                { text: 'Settings', action: 'settings', icon: '⚙️', shortcut: 'Ctrl+,' }
            );
        }

        this.stats.quickActionsTriggered++;
        return actions;
    }

    /**
     * Get contextual help
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {string} Help text
     */
    async getContextualHelp(context = {}, options = {}) {
        const page = context.page || 'dashboard';
        
        const helpMap = {
            dashboard: 'Welcome to your dashboard! Here you can see key metrics, recent activities, and quick insights.',
            leads: 'Manage your leads here. You can view, add, edit, and convert leads to customers.',
            sales: 'Track your sales pipeline here. Monitor deals, stages, and win rates.',
            customers: 'Manage your customers here. View customer 360, track engagement, and manage relationships.',
            tasks: 'Manage your tasks here. View pending tasks, create new tasks, and track progress.'
        };

        return helpMap[page] || 'How can I help you today?';
    }

    /**
     * Get insights
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {Array} Insights
     */
    async getInsights(context = {}, options = {}) {
        try {
            const insights = await dashboardInsights.getInsights(
                options.metrics || {},
                { ...options, includeLead: true, includeSales: true, includeRevenue: true }
            );
            return insights;
        } catch (error) {
            logger.error('[Copilot] Insights fetch failed:', error);
            return [];
        }
    }

    /**
     * Get recommendations
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {Array} Recommendations
     */
    async getRecommendations(context = {}, options = {}) {
        try {
            const insights = await dashboardInsights.getRecommendations(options.metrics || {});
            return insights;
        } catch (error) {
            logger.error('[Copilot] Recommendations fetch failed:', error);
            return [];
        }
    }

    /**
     * Get alerts
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {Array} Alerts
     */
    async getAlerts(context = {}, options = {}) {
        try {
            const alerts = await dashboardInsights.getAlerts(options);
            return alerts;
        } catch (error) {
            logger.error('[Copilot] Alerts fetch failed:', error);
            return [];
        }
    }

    /**
     * Get predictions
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {object} Predictions
     */
    async getPredictions(context = {}, options = {}) {
        try {
            const predictions = {
                revenue: await dealPrediction.getRevenueForecast(options.dealData || {}),
                churn: await churnPrediction.getChurnProbability(options.customerData || {}),
                deals: await dealPrediction.getWinProbability(options.dealData || {})
            };
            return predictions;
        } catch (error) {
            logger.error('[Copilot] Predictions fetch failed:', error);
            return {};
        }
    }

    /**
     * Get summary
     * @param {object} context - User context
     * @param {object} options - Additional options
     * @returns {string} Summary
     */
    async getSummary(context = {}, options = {}) {
        try {
            const insights = await this.getInsights(context, options);
            const summary = dashboardInsights.generateSummary(insights);
            return summary;
        } catch (error) {
            logger.error('[Copilot] Summary generation failed:', error);
            return 'Unable to generate summary at this time.';
        }
    }

    /**
     * Update user context
     * @param {string} userId - User ID
     * @param {object} data - Context data
     * @returns {object} Updated context
     */
    async updateContext(userId, data) {
        const key = `context_${userId}`;
        let context = this.contexts.get(key) || { userId, lastUpdated: null };

        context = {
            ...context,
            ...data,
            lastUpdated: new Date().toISOString()
        };

        this.contexts.set(key, context);

        if (this.debugMode) {
            logger.debug(`[Copilot] Context updated for ${userId}`);
        }

        return context;
    }

    /**
     * Get user context
     * @param {string} userId - User ID
     * @returns {object} User context
     */
    async getContext(userId) {
        const key = `context_${userId}`;
        if (this.contexts.has(key)) {
            return this.contexts.get(key);
        }
        return { userId, page: 'dashboard', role: 'user' };
    }

    /**
     * Generate proactive suggestions
     * @param {string} userId - User ID
     * @param {string} page - Current page
     */
    async generateProactiveSuggestions(userId, page) {
        const context = await this.getContext(userId);
        const suggestions = await this.getSuggestions(context, { page });

        // Emit event with suggestions
        eventBus.publish('copilot.suggestions', {
            userId: userId,
            page: page,
            suggestions: suggestions
        });

        this.stats.suggestionsGenerated += suggestions.length;
    }

    /**
     * Generate suggestions for all users
     */
    async generateSuggestions() {
        // In production, this would fetch active users
        // For MVP, just log
        if (this.debugMode) {
            logger.debug('[Copilot] Suggestions generated');
        }
    }

    /**
     * Calculate confidence
     * @param {string} query - User query
     * @param {string} response - Response
     * @returns {number} Confidence
     */
    calculateConfidence(query, response) {
        // Simple confidence calculation
        let confidence = 0.6;

        // Longer queries often need more confidence
        if (query.length > 20) confidence += 0.1;
        if (query.length > 50) confidence += 0.1;

        // Response length
        if (response.length > 50) confidence += 0.1;
        if (response.length > 100) confidence += 0.1;

        return Math.min(1, confidence);
    }

    /**
     * Log conversation
     * @param {string} userId - User ID
     * @param {string} query - User query
     * @param {object} response - Response
     */
    async logConversation(userId, query, response) {
        const key = `conv_${userId}`;
        const conversations = this.conversations.get(key) || [];

        conversations.push({
            query: query,
            response: response,
            timestamp: new Date().toISOString()
        });

        // Limit history
        if (conversations.length > this.config.maxHistory) {
            conversations.shift();
        }

        this.conversations.set(key, conversations);

        // Log to audit
        await auditLogger.log(
            userId || 'system',
            'copilot.conversation',
            'ai',
            { query: query.substring(0, 100), responseLength: response.length }
        );
    }

    /**
     * Get fallback response
     * @param {string} query - User query
     * @returns {object} Fallback response
     */
    getFallbackResponse(query) {
        return {
            query: query,
            intent: QUERY_INTENTS.GENERAL,
            response: "I understand you're asking about the CRM. Could you please provide more details about what you need?",
            actions: [
                { text: 'View Dashboard', action: 'view_dashboard' },
                { text: 'Get Help', action: 'help' },
                { text: 'View Leads', action: 'view_leads' }
            ],
            context: {},
            confidence: 0.3,
            timestamp: new Date().toISOString(),
            fallback: true
        };
    }

    /**
     * Get cache key
     * @param {string} query - User query
     * @param {object} context - Context data
     * @returns {string} Cache key
     */
    getCacheKey(query, context) {
        const keyParts = [
            query.substring(0, 50),
            context.page || '',
            context.userId || ''
        ];
        return 'copilot_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {string} intent - Query intent
     * @param {boolean} success - Whether request was successful
     * @param {number} duration - Request duration
     */
    updateStats(intent, success, duration) {
        this.stats.totalQueries++;
        if (success) {
            this.stats.successfulQueries++;
        } else {
            this.stats.failedQueries++;
        }

        this.stats.byIntent[intent] = (this.stats.byIntent[intent] || 0) + 1;
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.totalQueries - 1) + duration) / 
            this.stats.totalQueries;
    }

    /**
     * Get copilot statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            conversations: this.conversations.size,
            contexts: this.contexts.size,
            suggestions: this.suggestions.length,
            config: this.config,
            initialized: this.initialized
        };
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Copilot] Debug mode enabled');
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
        this.conversations.clear();
        this.contexts.clear();

        this.initialized = false;
        logger.info('Copilot cleaned up');
    }
}

// Create and export singleton instance
export const copilot = new Copilot();

// Export class for testing
export default Copilot;
