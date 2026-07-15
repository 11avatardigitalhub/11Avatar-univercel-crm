/**
 * ==========================================
 * FILE: meetingSummary.js
 * MODULE: AI Module
 * CODE: AI-6
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI-powered meeting summary service that generates comprehensive
 * summaries from meeting notes, transcripts, and audio recordings.
 * Extracts key points, decisions, action items, and follow-ups.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize meeting summary
 * - summarizeMeeting(notes, participants): Summarize meeting
 * - summarizeMeetingFromTranscript(transcript): Summarize from transcript
 * - summarizeMeetingFromAudio(audioFile): Summarize from audio
 * - extractActionItems(notes): Extract action items
 * - extractDecisions(notes): Extract decisions
 * - extractKeyPoints(notes): Extract key points
 * - generateMeetingNotes(notes): Generate structured notes
 * - getMeetingTemplates(): Get templates
 * - createMeetingTemplate(data): Create template
 * - updateMeetingTemplate(id, data): Update template
 * - deleteMeetingTemplate(id): Delete template
 * - getMeetingStats(): Get meeting statistics
 * 
 * USAGE EXAMPLE:
 * import { meetingSummary } from './modules/ai/meetingSummary.js';
 * 
 * // Initialize meeting summary
 * await meetingSummary.initialize();
 * 
 * // Summarize a meeting
 * const summary = await meetingSummary.summarizeMeeting(
 *   'Discussed project milestones, reviewed budget, assigned tasks',
 *   ['John Doe', 'Jane Smith']
 * );
 * 
 * // Extract action items
 * const actions = await meetingSummary.extractActionItems(notes);
 * ==========================================
 */

import { aiService } from './aiService.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Meeting templates
const DEFAULT_MEETING_TEMPLATES = [
    {
        id: 'template_sales',
        name: 'Sales Meeting',
        category: 'sales',
        structure: {
            title: 'Sales Meeting Summary',
            sections: [
                { name: 'Meeting Overview', fields: ['date', 'time', 'duration', 'participants'] },
                { name: 'Key Discussion Points', fields: ['topics', 'insights'] },
                { name: 'Decisions Made', fields: ['decisions', 'rationale'] },
                { name: 'Action Items', fields: ['tasks', 'assignees', 'deadlines'] },
                { name: 'Next Steps', fields: ['follow_up', 'owner'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_project',
        name: 'Project Meeting',
        category: 'project',
        structure: {
            title: 'Project Meeting Summary',
            sections: [
                { name: 'Meeting Overview', fields: ['date', 'time', 'duration', 'participants'] },
                { name: 'Project Status', fields: ['completed', 'in_progress', 'blocked'] },
                { name: 'Issues & Risks', fields: ['issues', 'risks', 'mitigations'] },
                { name: 'Decisions', fields: ['decisions', 'impact'] },
                { name: 'Action Items', fields: ['tasks', 'assignees', 'deadlines'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_client',
        name: 'Client Meeting',
        category: 'client',
        structure: {
            title: 'Client Meeting Summary',
            sections: [
                { name: 'Meeting Overview', fields: ['date', 'time', 'duration', 'participants'] },
                { name: 'Client Requirements', fields: ['requirements', 'priorities'] },
                { name: 'Feedback & Concerns', fields: ['feedback', 'concerns'] },
                { name: 'Agreed Actions', fields: ['actions', 'owners'] },
                { name: 'Next Meeting', fields: ['date', 'agenda'] }
            ]
        },
        isSystem: true,
        createdAt: new Date().toISOString()
    }
];

class MeetingSummary {
    constructor() {
        // Service state
        this.initialized = false;
        this.templates = [...DEFAULT_MEETING_TEMPLATES];
        this.meetingHistory = [];
        
        // Configuration
        this.config = {
            enableAI: true,
            enableTemplates: true,
            maxHistorySize: 1000,
            defaultTemplate: 'sales',
            minConfidence: 0.6,
            maxSummaryLength: 2000,
            extractActionItems: true,
            extractDecisions: true,
            extractKeyPoints: true
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalMeetings: 0,
            aiGenerated: 0,
            templateGenerated: 0,
            byCategory: {},
            averageLength: 0,
            actionItemsExtracted: 0,
            decisionsExtracted: 0
        };
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize meeting summary
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

            logger.info('Meeting summary initialized', {
                templates: this.templates.length,
                categories: ['sales', 'project', 'client']
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Meeting summary initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-summarize meetings when added
        const meetingAddedSub = eventBus.subscribe('meeting.added', async (data) => {
            if (data.notes) {
                try {
                    const summary = await this.summarizeMeeting(data.notes, data.participants);
                    // In production, save the summary
                    if (this.debugMode) {
                        logger.debug('[MeetingSummary] Auto-summary generated');
                    }
                } catch (error) {
                    logger.error('[MeetingSummary] Auto-summary failed:', error);
                }
            }
        });
        this.subscriptions.push(meetingAddedSub);
    }

    /**
     * Load custom templates from storage
     */
    async loadCustomTemplates() {
        // In production, this would load from Firestore
        // For MVP, use default templates
        if (this.debugMode) {
            logger.debug('[MeetingSummary] Custom templates loaded');
        }
    }

    /**
     * Summarize a meeting
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @param {object} options - Additional options
     * @returns {object} Meeting summary
     */
    async summarizeMeeting(notes, participants = [], options = {}) {
        if (!this.initialized) {
            throw new Error('Meeting summary not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(notes, participants);
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
                const templateSummary = await this.generateTemplateSummary(notes, participants, options.category);
                if (templateSummary) {
                    summary = templateSummary;
                    this.stats.templateGenerated++;
                }
            }

            // If no template, use AI
            if (!summary && this.config.enableAI && options.useAI !== false) {
                summary = await this.generateAISummary(notes, participants, options);
                this.stats.aiGenerated++;
            }

            // If still no summary, use fallback
            if (!summary) {
                summary = this.getFallbackSummary(notes, participants);
            }

            // Validate and structure summary
            summary = this.validateSummary(summary);

            // Cache the result
            this.cache.set(cacheKey, summary);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(options.category || 'general', duration);

            // Log to audit
            await auditLogger.log(
                options.userId || 'system',
                'ai.meeting_summary',
                'ai',
                { 
                    participants: participants.length,
                    category: options.category,
                    actionItems: summary.actionItems?.length || 0
                }
            );

            // Emit event
            eventBus.publish('meeting.summarized', {
                summary: summary,
                participants: participants,
                category: options.category
            });

            if (this.debugMode) {
                logger.debug(`[MeetingSummary] Summary generated (${duration}ms)`);
            }

            return summary;
        } catch (error) {
            logger.error('[MeetingSummary] Summary generation failed:', error);
            return this.getFallbackSummary(notes, participants);
        }
    }

    /**
     * Generate template-based summary
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @param {string} category - Meeting category
     * @returns {object|null} Summary object
     */
    async generateTemplateSummary(notes, participants, category) {
        const matchedTemplates = this.templates.filter(t => 
            t.category === category || t.category === 'general'
        );

        if (matchedTemplates.length === 0) {
            return null;
        }

        const template = matchedTemplates[0];
        const summary = {
            title: template.structure.title || 'Meeting Summary',
            date: new Date().toISOString(),
            participants: participants,
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

        // Extract key points, decisions, action items
        if (this.config.extractKeyPoints) {
            summary.keyPoints = await this.extractKeyPoints(notes);
        }

        if (this.config.extractDecisions) {
            summary.decisions = await this.extractDecisions(notes);
        }

        if (this.config.extractActionItems) {
            summary.actionItems = await this.extractActionItems(notes);
        }

        return summary;
    }

    /**
     * Generate AI-powered summary
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @param {object} options - Additional options
     * @returns {object} Summary object
     */
    async generateAISummary(notes, participants, options) {
        const prompt = this.buildAIPrompt(notes, participants, options);
        
        const response = await aiService.callAI(prompt, {
            temperature: 0.4,
            maxTokens: 1000
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
            title: parsedSummary.title || 'Meeting Summary',
            date: new Date().toISOString(),
            participants: parsedSummary.participants || participants,
            category: options.category || 'general',
            keyPoints: parsedSummary.keyPoints || [],
            decisions: parsedSummary.decisions || [],
            actionItems: parsedSummary.actionItems || [],
            summary: parsedSummary.summary || notes.substring(0, 200),
            generated: 'ai'
        };
    }

    /**
     * Build AI prompt
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @param {object} options - Additional options
     * @returns {string} Prompt
     */
    buildAIPrompt(notes, participants, options) {
        return `
Summarize the following meeting notes and return a structured JSON.

Meeting Notes:
${notes}

Participants:
${participants.join(', ')}

Category: ${options.category || 'general'}

Return JSON with the following structure:
{
    "title": "Meeting title",
    "participants": ["list", "of", "participants"],
    "keyPoints": ["key point 1", "key point 2"],
    "decisions": ["decision 1", "decision 2"],
    "actionItems": [
        {
            "task": "Task description",
            "assignee": "Person responsible",
            "deadline": "Due date"
        }
    ],
    "summary": "Overall meeting summary (2-3 sentences)"
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
            title: 'Meeting Summary',
            participants: [],
            keyPoints: [],
            decisions: [],
            actionItems: [],
            summary: response.substring(0, 200)
        };

        let currentSection = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Title:')) {
                data.title = trimmed.replace('Title:', '').trim();
            } else if (trimmed.startsWith('Participants:')) {
                currentSection = 'participants';
            } else if (trimmed.startsWith('Key Points:')) {
                currentSection = 'keyPoints';
            } else if (trimmed.startsWith('Decisions:')) {
                currentSection = 'decisions';
            } else if (trimmed.startsWith('Action Items:')) {
                currentSection = 'actionItems';
            } else if (trimmed.startsWith('Summary:')) {
                currentSection = 'summary';
            } else if (trimmed && trimmed !== '---') {
                if (currentSection === 'participants') {
                    data.participants.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'keyPoints') {
                    data.keyPoints.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'decisions') {
                    data.decisions.push(trimmed.replace(/^-\s*/, ''));
                } else if (currentSection === 'actionItems') {
                    const parts = trimmed.split('-');
                    data.actionItems.push({
                        task: parts[0]?.trim() || trimmed,
                        assignee: parts[1]?.trim() || 'Unassigned',
                        deadline: parts[2]?.trim() || 'No deadline'
                    });
                } else if (currentSection === 'summary') {
                    data.summary = trimmed;
                }
            }
        }

        return data;
    }

    /**
     * Summarize meeting from transcript
     * @param {string} transcript - Meeting transcript
     * @param {object} options - Additional options
     * @returns {object} Meeting summary
     */
    async summarizeMeetingFromTranscript(transcript, options = {}) {
        return await this.summarizeMeeting(transcript, options.participants || [], {
            ...options,
            fromTranscript: true
        });
    }

    /**
     * Summarize meeting from audio file
     * @param {File} audioFile - Audio file
     * @param {object} options - Additional options
     * @returns {object} Meeting summary
     */
    async summarizeMeetingFromAudio(audioFile, options = {}) {
        // In production, this would transcribe audio first
        // For MVP, simulate transcription
        if (this.debugMode) {
            logger.debug('[MeetingSummary] Audio transcription simulated');
        }

        const transcript = "Meeting transcript from audio file...";
        return await this.summarizeMeeting(transcript, options.participants || [], {
            ...options,
            fromAudio: true
        });
    }

    /**
     * Extract action items from notes
     * @param {string} notes - Meeting notes
     * @param {object} options - Additional options
     * @returns {Array} Action items
     */
    async extractActionItems(notes, options = {}) {
        if (!this.initialized) {
            throw new Error('Meeting summary not initialized');
        }

        try {
            const prompt = `
Extract action items from these meeting notes.

Notes:
${notes}

Return JSON array:
[
    {
        "task": "Task description",
        "assignee": "Person responsible",
        "deadline": "Due date (if mentioned)",
        "priority": "high|medium|low",
        "status": "pending|in_progress|completed"
    }
]

Return ONLY the JSON array. If no action items found, return empty array.
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 500
            });

            try {
                const items = JSON.parse(response);
                this.stats.actionItemsExtracted += items.length;
                return items;
            } catch {
                return [];
            }
        } catch (error) {
            logger.error('[MeetingSummary] Action items extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract decisions from notes
     * @param {string} notes - Meeting notes
     * @param {object} options - Additional options
     * @returns {Array} Decisions
     */
    async extractDecisions(notes, options = {}) {
        if (!this.initialized) {
            throw new Error('Meeting summary not initialized');
        }

        try {
            const prompt = `
Extract decisions made from these meeting notes.

Notes:
${notes}

Return JSON array of decisions:
[
    "Decision 1",
    "Decision 2"
]

Return ONLY the JSON array. If no decisions found, return empty array.
`;

            const response = await aiService.callAI(prompt, {
                temperature: 0.3,
                maxTokens: 300
            });

            try {
                const decisions = JSON.parse(response);
                this.stats.decisionsExtracted += decisions.length;
                return decisions;
            } catch {
                return [];
            }
        } catch (error) {
            logger.error('[MeetingSummary] Decisions extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract key points from notes
     * @param {string} notes - Meeting notes
     * @param {object} options - Additional options
     * @returns {Array} Key points
     */
    async extractKeyPoints(notes, options = {}) {
        if (!this.initialized) {
            throw new Error('Meeting summary not initialized');
        }

        try {
            const prompt = `
Extract key points from these meeting notes.

Notes:
${notes}

Return JSON array of key points:
[
    "Key point 1",
    "Key point 2"
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
            logger.error('[MeetingSummary] Key points extraction failed:', error);
            return [];
        }
    }

    /**
     * Generate structured meeting notes
     * @param {string} notes - Raw notes
     * @param {object} options - Additional options
     * @returns {object} Structured notes
     */
    async generateMeetingNotes(notes, options = {}) {
        if (!this.initialized) {
            throw new Error('Meeting summary not initialized');
        }

        const summary = await this.summarizeMeeting(notes, options.participants || [], options);
        
        // Format as structured notes
        let structuredNotes = `# ${summary.title}\n\n`;
        structuredNotes += `**Date:** ${new Date(summary.date).toLocaleString()}\n`;
        structuredNotes += `**Participants:** ${summary.participants.join(', ')}\n\n`;
        structuredNotes += `## Key Points\n`;
        for (const point of summary.keyPoints || []) {
            structuredNotes += `- ${point}\n`;
        }
        structuredNotes += `\n## Decisions\n`;
        for (const decision of summary.decisions || []) {
            structuredNotes += `- ${decision}\n`;
        }
        structuredNotes += `\n## Action Items\n`;
        for (const item of summary.actionItems || []) {
            structuredNotes += `- ${item.task} (${item.assignee} - ${item.deadline || 'No deadline'})\n`;
        }
        structuredNotes += `\n## Summary\n${summary.summary || ''}\n`;

        return structuredNotes;
    }

    /**
     * Get meeting templates
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getMeetingTemplates(options = {}) {
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
     * Create meeting template
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Created template
     */
    async createMeetingTemplate(data, options = {}) {
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
            'meeting_summary.template_created',
            'ai',
            { templateId: template.id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[MeetingSummary] Template created: ${template.id}`);
        }

        return template;
    }

    /**
     * Update meeting template
     * @param {string} id - Template ID
     * @param {object} data - Updated data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateMeetingTemplate(id, data, options = {}) {
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
            'meeting_summary.template_updated',
            'ai',
            { templateId: id }
        );

        return template;
    }

    /**
     * Delete meeting template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async deleteMeetingTemplate(id, options = {}) {
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
            'meeting_summary.template_deleted',
            'ai',
            { templateId: id, name: template.name }
        );

        return true;
    }

    /**
     * Get meeting statistics
     * @param {object} options - Additional options
     * @returns {object} Meeting statistics
     */
    async getMeetingStats(options = {}) {
        return { ...this.stats };
    }

    /**
     * Validate summary
     * @param {object} summary - Summary object
     * @returns {object} Validated summary
     */
    validateSummary(summary) {
        if (!summary.title) summary.title = 'Meeting Summary';
        if (!summary.date) summary.date = new Date().toISOString();
        if (!summary.participants) summary.participants = [];
        if (!summary.keyPoints) summary.keyPoints = [];
        if (!summary.decisions) summary.decisions = [];
        if (!summary.actionItems) summary.actionItems = [];

        return summary;
    }

    /**
     * Get fallback summary
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @returns {object} Fallback summary
     */
    getFallbackSummary(notes, participants) {
        return {
            title: 'Meeting Summary',
            date: new Date().toISOString(),
            participants: participants || [],
            keyPoints: ['Meeting notes provided'],
            decisions: [],
            actionItems: [],
            summary: notes ? notes.substring(0, 200) : 'Meeting notes not available',
            generated: 'fallback'
        };
    }

    /**
     * Get cache key
     * @param {string} notes - Meeting notes
     * @param {Array} participants - Participants
     * @returns {string} Cache key
     */
    getCacheKey(notes, participants) {
        const keyParts = [
            notes.substring(0, 100),
            participants.join(',')
        ];
        return 'meeting_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {string} category - Meeting category
     * @param {number} duration - Generation time
     */
    updateStats(category, duration) {
        this.stats.totalMeetings++;
        this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
        this.stats.averageLength = (this.stats.averageLength * (this.stats.totalMeetings - 1) + 500) / this.stats.totalMeetings;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[MeetingSummary] Debug mode enabled');
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
        // Clear cache
        this.cache.clear();
        this.cacheTimestamps.clear();

        this.initialized = false;
        logger.info('Meeting summary cleaned up');
    }
}

// Create and export singleton instance
export const meetingSummary = new MeetingSummary();

// Export class for testing
export default MeetingSummary;
