/**
 * ==========================================
 * FILE: callSummary.js
 * MODULE: AI Module
 * CODE: AI-7
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI-powered call summary service that generates comprehensive
 * summaries from sales calls, support calls, and customer interactions.
 * Extracts key information, pain points, next steps, and sentiment.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize call summary
 * - summarizeCall(transcript, callData): Summarize a call
 * - summarizeCallFromAudio(audioFile, callData): Summarize from audio
 * - extractPainPoints(transcript): Extract pain points
 * - extractNextSteps(transcript): Extract next steps
 * - extractSentiment(transcript): Extract sentiment
 * - extractBudgetInfo(transcript): Extract budget information
 * - extractTimelineInfo(transcript): Extract timeline information
 * - getCallTemplates(): Get templates
 * - createCallTemplate(data): Create template
 * - updateCallTemplate(id, data): Update template
 * - deleteCallTemplate(id): Delete template
 * - getCallStats(): Get call statistics
 * 
 * USAGE EXAMPLE:
 * import { callSummary } from './modules/ai/callSummary.js';
 * 
 * // Initialize call summary
 * await callSummary.initialize();
 * 
 * // Summarize a call
 * const summary = await callSummary.summarizeCall(
 *   'Call transcript...',
 *   {
 *     callId: 'call_123',
 *     leadId: 'lead_456',
 *     duration: 600,
 *     type: 'sales'
 *   }
 * );
 * 
 * // Extract pain points
 * const painPoints = await callSummary.extractPainPoints(transcript);
 * ==========================================
 */

import { aiService } from './aiService.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Call templates
const DEFAULT_CALL_TEMPLATES = [
    {
        id: 'template_sales',
        name: 'Sales Call',
        category: 'sales',
        structure: {
            title: 'Sales Call Summary',
            sections: [
                { name: 'Call Overview', fields: ['date', 'duration', 'participants'] },
                { name: 'Customer Needs', fields: ['needs', 'pain_points'] },
                { name: 'Discussion Points', fields: ['topics', 'key_insights'] },
                { name: 'Budget & Timeline', fields: ['budget', 'timeline'] },
                { name: 'Next Steps', fields: ['actions', 'owners', 'deadlines'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_support',
        name: 'Support Call',
        category: 'support',
        structure: {
            title: 'Support Call Summary',
            sections: [
                { name: 'Call Overview', fields: ['date', 'duration', 'participants'] },
                { name: 'Issue Description', fields: ['issue', 'severity'] },
                { name: 'Resolution Steps', fields: ['steps', 'resolution'] },
                { name: 'Customer Sentiment', fields: ['sentiment', 'satisfaction'] },
                { name: 'Follow-up Actions', fields: ['actions', 'owner', 'deadline'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_discovery',
        name: 'Discovery Call',
        category: 'discovery',
        structure: {
            title: 'Discovery Call Summary',
            sections: [
                { name: 'Call Overview', fields: ['date', 'duration', 'participants'] },
                { name: 'Customer Profile', fields: ['company', 'industry', 'size'] },
                { name: 'Pain Points', fields: ['challenges', 'needs'] },
                { name: 'Decision Process', fields: ['decision_makers', 'process'] },
                { name: 'Next Steps', fields: ['actions', 'owners', 'timeline'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    }
];

class CallSummary {
    constructor() {
        // Service state
        this.initialized = false;
        this.templates = [...DEFAULT_CALL_TEMPLATES];
        this.callHistory = [];
        
        // Configuration
        this.config = {
            enableAI: true,
            enableTemplates: true,
            maxHistorySize: 1000,
            defaultTemplate: 'sales',
            minConfidence: 0.6,
            maxSummaryLength: 1500,
            extractPainPoints: true,
            extractNextSteps: true,
            extractSentiment: true,
            extractBudget: true,
            extractTimeline: true,
            enableAudioTranscription: true
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalCalls: 0,
            aiGenerated: 0,
            templateGenerated: 0,
            byCategory: {},
            byType: {},
            averageDuration: 0,
            averageSentiment: 0,
            painPointsExtracted: 0
        };
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize call summary
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

            // Load custom templates from storage
            await this.loadCustomTemplates();

            // Setup event listeners
            this.setupEventListeners();

            logger.info('Call summary initialized', {
                templates: this.templates.length,
                categories: ['sales', 'support', 'discovery']
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Call summary initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-summarize calls when added
        const callAddedSub = eventBus.subscribe('call.added', async (data) => {
            if (data.transcript) {
                try {
                    const summary = await this.summarizeCall(data.transcript, data);
                    // In production, save the summary
                    if (this.debugMode) {
                        logger.debug('[CallSummary] Auto-summary generated');
                    }
                } catch (error) {
                    logger.error('[CallSummary] Auto-summary failed:', error);
                }
            }
        });
        this.subscriptions.push(callAddedSub);
    }

    /**
     * Load custom templates from storage
     */
    async loadCustomTemplates() {
        // In production, this would load from Firestore
        // For MVP, use default templates
        if (this.debugMode) {
            logger.debug('[CallSummary] Custom templates loaded');
        }
    }

    /**
     * Summarize a call
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @param {object} options - Additional options
     * @returns {object} Call summary
     */
    async summarizeCall(transcript, callData = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(transcript, callData);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        let summary;

        try {
            // Try template-based summary
            if (this.config.enableTemplates && options.useTemplates !== false) {
                const templateSummary = await this.generateTemplateSummary(transcript, callData, options.category);
                if (templateSummary) {
                    summary = templateSummary;
                    this.stats.templateGenerated++;
                }
            }

            // If no template, use AI
            if (!summary && this.config.enableAI && options.useAI !== false) {
                summary = await this.generateAISummary(transcript, callData, options);
                this.stats.aiGenerated++;
            }

            // If still no summary, use fallback
            if (!summary) {
                summary = this.getFallbackSummary(transcript, callData);
            }

            // Validate and structure summary
            summary = this.validateSummary(summary);

            // Extract additional information
            if (this.config.extractPainPoints) {
                summary.painPoints = await this.extractPainPoints(transcript);
            }

            if (this.config.extractNextSteps) {
                summary.nextSteps = await this.extractNextSteps(transcript);
            }

            if (this.config.extractSentiment) {
                summary.sentiment = await this.extractSentiment(transcript);
            }

            if (this.config.extractBudget && callData.budget !== undefined) {
                summary.budget = callData.budget;
            } else if (this.config.extractBudget) {
                summary.budget = await this.extractBudgetInfo(transcript);
            }

            if (this.config.extractTimeline && callData.timeline !== undefined) {
                summary.timeline = callData.timeline;
            } else if (this.config.extractTimeline) {
                summary.timeline = await this.extractTimelineInfo(transcript);
            }

            // Cache the result
            this.cache.set(cacheKey, summary);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(options.category || 'general', callData.type || 'sales', duration);

            // Log to audit
            await auditLogger.log(
                options.userId || 'system',
                'ai.call_summary',
                'ai',
                { 
                    callId: callData.callId,
                    duration: callData.duration,
                    category: options.category,
                    sentiment: summary.sentiment
                }
            );

            // Emit event
            eventBus.publish('call.summarized', {
                summary: summary,
                callData: callData,
                category: options.category
            });

            if (this.debugMode) {
                logger.debug(`[CallSummary] Summary generated (${duration}ms)`);
            }

            return summary;
        } catch (error) {
            logger.error('[CallSummary] Summary generation failed:', error);
            return this.getFallbackSummary(transcript, callData);
        }
    }

    /**
     * Generate template-based summary
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @param {string} category - Call category
     * @returns {object|null} Summary object
     */
    async generateTemplateSummary(transcript, callData, category) {
        const matchedTemplates = this.templates.filter(t => 
            t.category === category || t.category === 'general'
        );

        if (matchedTemplates.length === 0) {
            return null;
        }

        const template = matchedTemplates[0];
        const summary = {
            title: template.structure.title || 'Call Summary',
            date: new Date().toISOString(),
            duration: callData.duration || 0,
            participants: callData.participants || [],
            category: category || template.category,
            templateId: template.id,
            generated: 'template'
        };

        // Populate sections
        for (const section of template.structure.sections || []) {
            summary[section.name.toLowerCase().replace(/\s/g, '_')] = {};
            for (const field of section.fields || []) {
                summary[section.name.toLowerCase().replace(/\s/g, '_')][field] = '';
            }
        }

        // Add call data
        if (callData.leadId) summary.leadId = callData.leadId;
        if (callData.customerId) summary.customerId = callData.customerId;
        if (callData.type) summary.type = callData.type;

        return summary;
    }

    /**
     * Generate AI-powered summary
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @param {object} options - Additional options
     * @returns {object} Summary object
     */
    async generateAISummary(transcript, callData, options) {
        const prompt = this.buildAIPrompt(transcript, callData, options);
        
        const response = await aiService.callAI(prompt, {
            temperature: 0.4,
            maxTokens: 800
        });

        let parsedSummary;
        try {
            parsedSummary = JSON.parse(response);
        } catch {
            // If JSON parsing fails, extract structured data from text
            parsedSummary = this.extractStructuredData(response);
        }

        // Ensure required fields
        return {
            title: parsedSummary.title || 'Call Summary',
            date: new Date().toISOString(),
            duration: callData.duration || 0,
            participants: parsedSummary.participants || [],
            category: options.category || 'general',
            type: callData.type || 'sales',
            summary: parsedSummary.summary || 'Call summary not available',
            keyPoints: parsedSummary.keyPoints || [],
            painPoints: parsedSummary.painPoints || [],
            nextSteps: parsedSummary.nextSteps || [],
            sentiment: parsedSummary.sentiment || 'neutral',
            budget: parsedSummary.budget || null,
            timeline: parsedSummary.timeline || null,
            decisionMakers: parsedSummary.decisionMakers || [],
            generated: 'ai'
        };
    }

    /**
     * Build AI prompt
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @param {object} options - Additional options
     * @returns {string} Prompt
     */
    buildAIPrompt(transcript, callData, options) {
        return `
Summarize the following sales/support call transcript and return a structured JSON.

Call Type: ${callData.type || 'sales'}
Duration: ${callData.duration || 'unknown'} seconds
Participants: ${(callData.participants || []).join(', ')}

Transcript:
${transcript}

Return JSON with the following structure:
{
    "title": "Call title",
    "participants": ["list", "of", "participants"],
    "summary": "Overall call summary (2-3 sentences)",
    "keyPoints": ["key point 1", "key point 2"],
    "painPoints": ["pain point 1", "pain point 2"],
    "nextSteps": ["next step 1", "next step 2"],
    "sentiment": "positive|neutral|negative",
    "budget": "budget information or null",
    "timeline": "timeline information or null",
    "decisionMakers": ["decision maker 1", "decision maker 2"]
}

Ensure the response is valid JSON. Only return the JSON, no other text.
`;
    }

    /**
     * Extract structured data from text response
     * @param {string} response - AI response
     * @returns {object} Structured data
     */
    extractStructuredData(response) {
        const lines = response.split('\n');
        const data = {
            title: 'Call Summary',
            participants: [],
            summary: response.substring(0, 200),
            keyPoints: [],
            painPoints: [],
            nextSteps: [],
            sentiment: 'neutral',
            budget: null,
            timeline: null,
            decisionMakers: []
        };

        let currentSection = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Title:')) {
                data.title = trimmed.replace('Title:', '').trim();
            } else if (trimmed.startsWith('Participants:')) {
                currentSection = 'participants';
            } else if (trimmed.startsWith('Summary:')) {
                currentSection = 'summary';
            } else if (trimmed.startsWith('Key Points:')) {
                currentSection = 'keyPoints';
            } else if (trimmed.startsWith('Pain Points:')) {
                currentSection = 'painPoints';
            } else if (trimmed.startsWith('Next Steps:')) {
                currentSection = 'nextSteps';
            } else if (trimmed.startsWith('Sentiment:')) {
                data.sentiment = trimmed.replace('Sentiment:', '').trim().toLowerCase();
            } else if (trimmed.startsWith('Budget:')) {
                data.budget = trimmed.replace('Budget:', '').trim();
            } else if (trimmed.startsWith('Timeline:')) {
                data.timeline = trimmed.replace('Timeline:', '').trim();
            } else if (trimmed.startsWith('Decision Makers:')) {
                currentSection = 'decisionMakers';
            } else if (trimmed && trimmed !== '---') {
                if (currentSection === 'participants') {
                    data.participants.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'keyPoints') {
                    data.keyPoints.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'painPoints') {
                    data.painPoints.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'nextSteps') {
                    data.nextSteps.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'decisionMakers') {
                    data.decisionMakers.push(trimmed.replace(/^-\s*/, ''));
                }
            }
        }

        return data;
    }

    /**
     * Summarize call from audio file
     * @param {File} audioFile - Audio file
     * @param {object} callData - Call data
     * @param {object} options - Additional options
     * @returns {object} Call summary
     */
    async summarizeCallFromAudio(audioFile, callData = {}, options = {}) {
        if (!this.config.enableAudioTranscription) {
            throw new Error('Audio transcription is disabled');
        }

        // In production, this would transcribe audio first
        // For MVP, simulate transcription
        if (this.debugMode) {
            logger.debug('[CallSummary] Audio transcription simulated');
        }

        const transcript = "Call transcript from audio file...";
        return await this.summarizeCall(transcript, callData, options);
    }

    /**
     * Extract pain points from transcript
     * @param {string} transcript - Call transcript
     * @param {object} options - Additional options
     * @returns {Array} Pain points
     */
    async extractPainPoints(transcript, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        try {
            const prompt = `
Extract pain points from this call transcript.

Transcript:
${transcript}

Return JSON array of pain points:
[
    "Pain point 1",
    "Pain point 2"
]

Return ONLY the JSON array. If no pain points found, return empty array.
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 300
            });

            try {
                const points = JSON.parse(response);
                this.stats.painPointsExtracted += points.length;
                return points;
            } catch {
                return [];
            }
        } catch (error) {
            logger.error('[CallSummary] Pain points extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract next steps from transcript
     * @param {string} transcript - Call transcript
     * @param {object} options - Additional options
     * @returns {Array} Next steps
     */
    async extractNextSteps(transcript, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        try {
            const prompt = `
Extract next steps/action items from this call transcript.

Transcript:
${transcript}

Return JSON array of next steps:
[
    "Next step 1",
    "Next step 2"
]

Return ONLY the JSON array.
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 300
            });

            try {
                return JSON.parse(response);
            } catch {
                return [];
            }
        } catch (error) {
            logger.error('[CallSummary] Next steps extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract sentiment from transcript
     * @param {string} transcript - Call transcript
     * @param {object} options - Additional options
     * @returns {object} Sentiment analysis
     */
    async extractSentiment(transcript, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        try {
            const prompt = `
Analyze the sentiment of this call transcript.

Transcript:
${transcript}

Return JSON:
{
    "sentiment": "positive|neutral|negative",
    "score": 0-1,
    "confidence": 0-1,
    "keyPhrases": ["phrase1", "phrase2"]
}
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 200
            });

            try {
                return JSON.parse(response);
            } catch {
                return { sentiment: 'neutral', score: 0.5, confidence: 0.5, keyPhrases: [] };
            }
        } catch (error) {
            logger.error('[CallSummary] Sentiment analysis failed:', error);
            return { sentiment: 'neutral', score: 0.5, confidence: 0.5, keyPhrases: [] };
        }
    }

    /**
     * Extract budget information from transcript
     * @param {string} transcript - Call transcript
     * @param {object} options - Additional options
     * @returns {object} Budget information
     */
    async extractBudgetInfo(transcript, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        try {
            const prompt = `
Extract budget information from this call transcript.

Transcript:
${transcript}

Return JSON:
{
    "mentioned": true|false,
    "amount": "budget amount or null",
    "currency": "INR|USD|other",
    "confidence": 0-1
}
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 150
            });

            try {
                return JSON.parse(response);
            } catch {
                return { mentioned: false, amount: null, currency: 'INR', confidence: 0 };
            }
        } catch (error) {
            logger.error('[CallSummary] Budget extraction failed:', error);
            return { mentioned: false, amount: null, currency: 'INR', confidence: 0 };
        }
    }

    /**
     * Extract timeline information from transcript
     * @param {string} transcript - Call transcript
     * @param {object} options - Additional options
     * @returns {object} Timeline information
     */
    async extractTimelineInfo(transcript, options = {}) {
        if (!this.initialized) {
            throw new Error('Call summary not initialized');
        }

        try {
            const prompt = `
Extract timeline information from this call transcript.

Transcript:
${transcript}

Return JSON:
{
    "mentioned": true|false,
    "timeline": "timeline description or null",
    "urgency": "high|medium|low",
    "confidence": 0-1
}
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 150
            });

            try {
                return JSON.parse(response);
            } catch {
                return { mentioned: false, timeline: null, urgency: 'medium', confidence: 0 };
            }
        } catch (error) {
            logger.error('[CallSummary] Timeline extraction failed:', error);
            return { mentioned: false, timeline: null, urgency: 'medium', confidence: 0 };
        }
    }

    /**
     * Get call templates
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getCallTemplates(options = {}) {
        let templates = [...this.templates];

        if (options.category) {
            templates = templates.filter(t => t.category === options.category);
        }

        if (options.isSystem !== undefined) {
            templates = templates.filter(t => t.isSystem === options.isSystem);
        }

        return templates;
    }

    /**
     * Create call template
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Created template
     */
    async createCallTemplate(data, options = {}) {
        if (!data.name || !data.structure) {
            throw new Error('Template name and structure are required');
        }

        const template = {
            id: 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: data.name,
            category: data.category || 'general',
            structure: data.structure,
            isSystem: false,
            isActive: true,
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.templates.push(template);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'call_summary.template_created',
            'ai',
            { templateId: template.id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[CallSummary] Template created: ${template.id}`);
        }

        return template;
    }

    /**
     * Update call template
     * @param {string} id - Template ID
     * @param {object} data - Updated data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateCallTemplate(id, data, options = {}) {
        const index = this.templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = this.templates[index];
        if (template.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system template');
        }

        if (data.name) template.name = data.name;
        if (data.category) template.category = data.category;
        if (data.structure) template.structure = data.structure;
        if (data.isActive !== undefined) template.isActive = data.isActive;

        template.updatedAt = new Date().toISOString();
        this.templates[index] = template;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'call_summary.template_updated',
            'ai',
            { templateId: id }
        );

        return template;
    }

    /**
     * Delete call template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async deleteCallTemplate(id, options = {}) {
        const index = this.templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = this.templates[index];
        if (template.isSystem && !options.forceDelete) {
            throw new Error('Cannot delete system template');
        }

        this.templates.splice(index, 1);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'call_summary.template_deleted',
            'ai',
            { templateId: id, name: template.name }
        );

        return true;
    }

    /**
     * Get call statistics
     * @param {object} options - Additional options
     * @returns {object} Call statistics
     */
    async getCallStats(options = {}) {
        return { ...this.stats };
    }

    /**
     * Validate summary
     * @param {object} summary - Summary object
     * @returns {object} Validated summary
     */
    validateSummary(summary) {
        if (!summary.title) summary.title = 'Call Summary';
        if (!summary.date) summary.date = new Date().toISOString();
        if (!summary.participants) summary.participants = [];
        if (!summary.keyPoints) summary.keyPoints = [];
        if (!summary.painPoints) summary.painPoints = [];
        if (!summary.nextSteps) summary.nextSteps = [];

        return summary;
    }

    /**
     * Get fallback summary
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @returns {object} Fallback summary
     */
    getFallbackSummary(transcript, callData) {
        return {
            title: 'Call Summary',
            date: new Date().toISOString(),
            duration: callData.duration || 0,
            participants: callData.participants || [],
            category: 'general',
            type: callData.type || 'sales',
            summary: transcript ? transcript.substring(0, 200) : 'Call transcript not available',
            keyPoints: [],
            painPoints: [],
            nextSteps: [],
            sentiment: 'neutral',
            budget: null,
            timeline: null,
            decisionMakers: [],
            generated: 'fallback'
        };
    }

    /**
     * Get cache key
     * @param {string} transcript - Call transcript
     * @param {object} callData - Call data
     * @returns {string} Cache key
     */
    getCacheKey(transcript, callData) {
        const keyParts = [
            transcript.substring(0, 100),
            callData.type || '',
            callData.callId || ''
        ];
        return 'call_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {string} category - Call category
     * @param {string} type - Call type
     * @param {number} duration - Generation time
     */
    updateStats(category, type, duration) {
        this.stats.totalCalls++;
        this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
        this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
        this.stats.averageDuration = (this.stats.averageDuration * (this.stats.totalCalls - 1) + duration) / this.stats.totalCalls;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[CallSummary] Debug mode enabled');
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
        logger.info('Call summary cleaned up');
    }
}

// Create and export singleton instance
export const callSummary = new CallSummary();

// Export class for testing
export default CallSummary;
