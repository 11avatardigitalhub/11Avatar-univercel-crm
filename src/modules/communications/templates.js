/**
 * ==========================================
 * FILE: templates.js
 * MODULE: Communications Module
 * CODE: COMM-5
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Central template management for all communication channels.
 * Handles templates for WhatsApp, Email, and SMS with variable support.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize template system
 * - getTemplate(channel, name): Get a template
 * - getAllTemplates(channel): Get all templates for a channel
 * - createTemplate(channel, data): Create a new template
 * - updateTemplate(channel, id, data): Update a template
 * - deleteTemplate(channel, id): Delete a template
 * - renderTemplate(template, variables): Render template with variables
 * - getTemplateVariables(template): Get template variables
 * - validateTemplate(template): Validate template
 * - cloneTemplate(channel, id, newName): Clone a template
 * - getTemplateStats(channel): Get template statistics
 * - getTemplateCategories(): Get template categories
 * - importTemplates(channel, templates): Import templates
 * - exportTemplates(channel): Export templates
 * 
 * USAGE EXAMPLE:
 * import { templates } from './modules/communications/templates.js';
 * 
 * // Initialize template system
 * await templates.initialize();
 * 
 * // Create a WhatsApp template
 * await templates.createTemplate('whatsapp', {
 *   name: 'welcome',
 *   body: 'Welcome {customer_name} to {company_name}!',
 *   variables: ['customer_name', 'company_name']
 * });
 * 
 * // Render a template
 * const rendered = templates.renderTemplate(template, {
 *   customer_name: 'John',
 *   company_name: '11 Avatar'
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let templateStore = {
    whatsapp: [],
    email: [],
    sms: []
};

class Templates {
    constructor() {
        // Service state
        this.initialized = false;
        this.cache = {
            whatsapp: new Map(),
            email: new Map(),
            sms: new Map()
        };
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = {
            whatsapp: new Map(),
            email: new Map(),
            sms: new Map()
        };
        
        // Template categories
        this.categories = {
            marketing: 'Marketing',
            utility: 'Utility',
            transactional: 'Transactional',
            otp: 'OTP / Verification',
            reminder: 'Reminder',
            welcome: 'Welcome',
            followup: 'Follow-up',
            thank_you: 'Thank You'
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample templates
        this.initSampleTemplates();
    }

    /**
     * Initialize template system
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            logger.info('Template system initialized', {
                channels: Object.keys(templateStore)
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Template system initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize sample templates
     */
    initSampleTemplates() {
        // WhatsApp templates
        templateStore.whatsapp = [
            {
                id: 'wapp_welcome',
                channel: 'whatsapp',
                name: 'welcome',
                category: 'welcome',
                language: 'en',
                body: 'Welcome {customer_name} to {company_name}! We are excited to have you on board.',
                variables: ['customer_name', 'company_name'],
                header: null,
                footer: null,
                buttons: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'wapp_followup',
                channel: 'whatsapp',
                name: 'followup',
                category: 'followup',
                language: 'en',
                body: 'Hi {customer_name}, this is a follow-up from {company_name}. We would like to connect with you.',
                variables: ['customer_name', 'company_name'],
                header: null,
                footer: null,
                buttons: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'wapp_thankyou',
                channel: 'whatsapp',
                name: 'thankyou',
                category: 'thank_you',
                language: 'en',
                body: 'Thank you {customer_name}! We appreciate your interest in {company_name}.',
                variables: ['customer_name', 'company_name'],
                header: null,
                footer: null,
                buttons: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // Email templates
        templateStore.email = [
            {
                id: 'email_welcome',
                channel: 'email',
                name: 'welcome',
                category: 'welcome',
                subject: 'Welcome to {company_name}!',
                body: `<h1>Welcome {customer_name}!</h1>
                       <p>We are excited to have you on board at {company_name}.</p>
                       <p>Get started by exploring our platform.</p>
                       <a href="{login_link}">Login Now</a>`,
                variables: ['customer_name', 'company_name', 'login_link'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'email_followup',
                channel: 'email',
                name: 'followup',
                category: 'followup',
                subject: 'Follow-up from {company_name}',
                body: `<h1>Hi {customer_name},</h1>
                       <p>This is a follow-up from {company_name}. We would like to connect with you.</p>
                       <p>Please reply to this email or call us at {phone}.</p>`,
                variables: ['customer_name', 'company_name', 'phone'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'email_quotation',
                channel: 'email',
                name: 'quotation',
                category: 'transactional',
                subject: 'Quotation from {company_name}',
                body: `<h1>Quotation</h1>
                       <p>Dear {customer_name},</p>
                       <p>Please find attached the quotation for {product_name}.</p>
                       <p>Total Amount: {amount}</p>
                       <p>Valid until: {valid_until}</p>`,
                variables: ['customer_name', 'company_name', 'product_name', 'amount', 'valid_until'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // SMS templates
        templateStore.sms = [
            {
                id: 'sms_welcome',
                channel: 'sms',
                name: 'welcome',
                category: 'welcome',
                body: 'Welcome {customer_name} to {company_name}! Thank you for joining us.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_otp',
                channel: 'sms',
                name: 'otp',
                category: 'otp',
                body: 'Your OTP for {company_name} is {otp_code}. It will expire in 10 minutes.',
                variables: ['company_name', 'otp_code'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_reminder',
                channel: 'sms',
                name: 'reminder',
                category: 'reminder',
                body: 'Reminder: Your appointment with {company_name} is scheduled for {date_time}. Please be on time.',
                variables: ['company_name', 'date_time'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // Build cache
        this.buildCache();
    }

    /**
     * Build cache for all templates
     */
    buildCache() {
        for (const channel of ['whatsapp', 'email', 'sms']) {
            const templates = templateStore[channel] || [];
            for (const template of templates) {
                this.cache[channel].set(template.name, template);
                this.cacheTimestamps[channel].set(template.name, Date.now());
            }
        }
    }

    /**
     * Get a template
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {string} name - Template name
     * @param {object} options - Additional options
     * @returns {object|null} Template or null
     */
    async getTemplate(channel, name, options = {}) {
        if (!this.initialized) {
            throw new Error('Template system not initialized');
        }

        // Check cache
        if (this.cache[channel] && this.cache[channel].has(name)) {
            const cached = this.cache[channel].get(name);
            const timestamp = this.cacheTimestamps[channel].get(name) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache[channel].delete(name);
            this.cacheTimestamps[channel].delete(name);
        }

        const templates = templateStore[channel] || [];
        const template = templates.find(t => t.name === name);
        
        if (template) {
            this.cache[channel].set(name, template);
            this.cacheTimestamps[channel].set(name, Date.now());
            return { ...template };
        }

        return null;
    }

    /**
     * Get all templates for a channel
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getAllTemplates(channel, options = {}) {
        if (!this.initialized) {
            throw new Error('Template system not initialized');
        }

        let templates = templateStore[channel] || [];

        // Apply filters
        if (options.category) {
            templates = templates.filter(t => t.category === options.category);
        }

        if (options.language) {
            templates = templates.filter(t => t.language === options.language);
        }

        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            templates = templates.filter(t =>
                t.name.toLowerCase().includes(searchTerm) ||
                t.body.toLowerCase().includes(searchTerm) ||
                (t.subject && t.subject.toLowerCase().includes(searchTerm))
            );
        }

        // Sort by name
        templates.sort((a, b) => a.name.localeCompare(b.name));

        return templates.map(t => ({ ...t }));
    }

    /**
     * Create a new template
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Created template
     */
    async createTemplate(channel, data, options = {}) {
        if (!this.initialized) {
            throw new Error('Template system not initialized');
        }

        // Validate channel
        if (!templateStore[channel]) {
            throw new Error(`Channel ${channel} not supported`);
        }

        // Validate data
        this.validateTemplate(channel, data);

        // Extract variables
        const variables = this.extractVariables(channel, data);

        // Create template
        const template = {
            id: `${channel}_${Date.now()}`,
            channel: channel,
            name: data.name,
            category: data.category || 'utility',
            language: data.language || 'en',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            variables: variables
        };

        // Channel-specific fields
        if (channel === 'whatsapp') {
            template.body = data.body;
            template.header = data.header || null;
            template.footer = data.footer || null;
            template.buttons = data.buttons || null;
        } else if (channel === 'email') {
            template.subject = data.subject;
            template.body = data.body;
        } else if (channel === 'sms') {
            template.body = data.body;
        }

        // Validate template
        this.validateTemplateContent(channel, template);

        // Store template
        templateStore[channel].push(template);
        this.cache[channel].set(template.name, template);
        this.cacheTimestamps[channel].set(template.name, Date.now());

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'template.created',
            'communication',
            { channel, templateId: template.id, name: template.name }
        );

        // Emit event
        eventBus.publish('template.created', {
            channel: channel,
            templateId: template.id,
            name: template.name
        });

        if (this.debugMode) {
            logger.debug(`[Templates] Template created: ${channel}/${template.name}`);
        }

        return { ...template };
    }

    /**
     * Update a template
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {string} id - Template ID
     * @param {object} data - Updated template data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateTemplate(channel, id, data, options = {}) {
        if (!this.initialized) {
            throw new Error('Template system not initialized');
        }

        const templates = templateStore[channel];
        const index = templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found in ${channel}`);
        }

        const template = templates[index];
        const oldName = template.name;

        // Update fields
        if (data.name) template.name = data.name;
        if (data.category) template.category = data.category;
        if (data.language) template.language = data.language;

        // Channel-specific updates
        if (channel === 'whatsapp') {
            if (data.body) template.body = data.body;
            if (data.header) template.header = data.header;
            if (data.footer) template.footer = data.footer;
            if (data.buttons) template.buttons = data.buttons;
        } else if (channel === 'email') {
            if (data.subject) template.subject = data.subject;
            if (data.body) template.body = data.body;
        } else if (channel === 'sms') {
            if (data.body) template.body = data.body;
        }

        // Update variables
        template.variables = this.extractVariables(channel, template);
        template.updatedAt = new Date().toISOString();

        templates[index] = template;

        // Update cache
        this.cache[channel].delete(oldName);
        this.cacheTimestamps[channel].delete(oldName);
        this.cache[channel].set(template.name, template);
        this.cacheTimestamps[channel].set(template.name, Date.now());

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'template.updated',
            'communication',
            { channel, templateId: id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[Templates] Template updated: ${channel}/${template.name}`);
        }

        return { ...template };
    }

    /**
     * Delete a template
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTemplate(channel, id, options = {}) {
        if (!this.initialized) {
            throw new Error('Template system not initialized');
        }

        const templates = templateStore[channel];
        const index = templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found in ${channel}`);
        }

        const template = templates[index];
        templates.splice(index, 1);
        
        this.cache[channel].delete(template.name);
        this.cacheTimestamps[channel].delete(template.name);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'template.deleted',
            'communication',
            { channel, templateId: id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[Templates] Template deleted: ${channel}/${template.name}`);
        }

        return true;
    }

    /**
     * Render a template with variables
     * @param {object} template - Template object
     * @param {object} variables - Variables
     * @returns {object} Rendered template
     */
    renderTemplate(template, variables) {
        const rendered = { ...template };
        const channel = template.channel;

        // Render based on channel
        if (channel === 'whatsapp') {
            rendered.body = this.renderText(template.body, variables);
            if (template.header) rendered.header = this.renderText(template.header, variables);
            if (template.footer) rendered.footer = this.renderText(template.footer, variables);
        } else if (channel === 'email') {
            rendered.subject = this.renderText(template.subject, variables);
            rendered.body = this.renderText(template.body, variables);
        } else if (channel === 'sms') {
            rendered.body = this.renderText(template.body, variables);
        }

        return rendered;
    }

    /**
     * Render text with variables
     * @param {string} text - Text with variables
     * @param {object} variables - Variables
     * @returns {string} Rendered text
     */
    renderText(text, variables) {
        if (!text) return text;
        let rendered = text;
        for (const [key, value] of Object.entries(variables)) {
            rendered = rendered.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }
        return rendered;
    }

    /**
     * Get template variables
     * @param {object} template - Template object
     * @returns {Array} Variable names
     */
    getTemplateVariables(template) {
        return template.variables || [];
    }

    /**
     * Validate template
     * @param {string} channel - Channel
     * @param {object} data - Template data
     * @throws {Error} If validation fails
     */
    validateTemplate(channel, data) {
        if (!data.name) {
            throw new Error('Template name is required');
        }

        // Check for duplicate name
        const templates = templateStore[channel] || [];
        if (templates.some(t => t.name === data.name)) {
            throw new Error(`Template ${data.name} already exists in ${channel}`);
        }

        // Channel-specific validation
        if (channel === 'whatsapp') {
            if (!data.body) throw new Error('Template body is required');
        } else if (channel === 'email') {
            if (!data.subject) throw new Error('Template subject is required');
            if (!data.body) throw new Error('Template body is required');
        } else if (channel === 'sms') {
            if (!data.body) throw new Error('Template body is required');
            if (data.body.length > 160) {
                throw new Error('SMS template body cannot exceed 160 characters');
            }
        }
    }

    /**
     * Validate template content
     * @param {string} channel - Channel
     * @param {object} template - Template object
     * @throws {Error} If validation fails
     */
    validateTemplateContent(channel, template) {
        // Additional content validation
        if (channel === 'whatsapp' && template.body) {
            // Check for required WhatsApp template format
            const hasVariables = template.body.includes('{');
            if (!hasVariables && template.variables && template.variables.length > 0) {
                // Template has variables defined but body doesn't use them
                // This is okay, but we'll warn in debug mode
                if (this.debugMode) {
                    logger.warn(`Template ${template.name} has variables but body doesn't use them`);
                }
            }
        }
    }

    /**
     * Extract variables from template
     * @param {string} channel - Channel
     * @param {object} data - Template data
     * @returns {Array} Variable names
     */
    extractVariables(channel, data) {
        let text = '';
        
        if (channel === 'whatsapp') {
            text = data.body || '';
            if (data.header) text += data.header;
            if (data.footer) text += data.footer;
        } else if (channel === 'email') {
            text = (data.subject || '') + ' ' + (data.body || '');
        } else if (channel === 'sms') {
            text = data.body || '';
        }

        const matches = text.match(/{([^}]+)}/g) || [];
        return [...new Set(matches.map(m => m.slice(1, -1)))];
    }

    /**
     * Clone a template
     * @param {string} channel - Channel
     * @param {string} id - Template ID
     * @param {string} newName - New template name
     * @param {object} options - Additional options
     * @returns {object} Cloned template
     */
    async cloneTemplate(channel, id, newName, options = {}) {
        const template = await this.getTemplate(channel, id);
        if (!template) {
            throw new Error(`Template ${id} not found in ${channel}`);
        }

        // Check if new name already exists
        const existing = await this.getTemplate(channel, newName);
        if (existing) {
            throw new Error(`Template ${newName} already exists in ${channel}`);
        }

        // Create clone
        const cloneData = {
            ...template,
            name: newName,
            variables: [...template.variables]
        };
        delete cloneData.id;
        delete cloneData.createdAt;
        delete cloneData.updatedAt;

        return await this.createTemplate(channel, cloneData, options);
    }

    /**
     * Get template statistics
     * @param {string} channel - Channel
     * @param {object} options - Additional options
     * @returns {object} Template statistics
     */
    async getTemplateStats(channel, options = {}) {
        const templates = templateStore[channel] || [];
        
        const stats = {
            total: templates.length,
            byCategory: {},
            byLanguage: {},
            latest: null,
            oldest: null
        };

        for (const template of templates) {
            stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
            stats.byLanguage[template.language] = (stats.byLanguage[template.language] || 0) + 1;
        }

        if (templates.length > 0) {
            const sorted = [...templates].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
            );
            stats.oldest = sorted[0];
            stats.latest = sorted[sorted.length - 1];
        }

        return stats;
    }

    /**
     * Get template categories
     * @param {object} options - Additional options
     * @returns {object} Template categories
     */
    async getTemplateCategories(options = {}) {
        return { ...this.categories };
    }

    /**
     * Import templates
     * @param {string} channel - Channel
     * @param {Array} templatesData - Templates to import
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async importTemplates(channel, templatesData, options = {}) {
        const results = {
            total: templatesData.length,
            imported: 0,
            failed: 0,
            errors: []
        };

        for (const data of templatesData) {
            try {
                if (options.overwrite) {
                    // Check if template exists
                    const existing = await this.getTemplate(channel, data.name);
                    if (existing) {
                        await this.updateTemplate(channel, existing.id, data, options);
                        results.imported++;
                        continue;
                    }
                }
                await this.createTemplate(channel, data, options);
                results.imported++;
            } catch (error) {
                results.failed++;
                results.errors.push({ data, error: error.message });
            }
        }

        return results;
    }

    /**
     * Export templates
     * @param {string} channel - Channel
     * @param {object} options - Additional options
     * @returns {Array} Exported templates
     */
    async exportTemplates(channel, options = {}) {
        const templates = await this.getAllTemplates(channel, options);
        return templates.map(t => {
            const exportData = { ...t };
            delete exportData.id;
            delete exportData.createdAt;
            delete exportData.updatedAt;
            return exportData;
        });
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[Templates] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.initialized = false;
        this.cache = {
            whatsapp: new Map(),
            email: new Map(),
            sms: new Map()
        };
        this.cacheTimestamps = {
            whatsapp: new Map(),
            email: new Map(),
            sms: new Map()
        };
        logger.info('Template system cleaned up');
    }
}

// Create and export singleton instance
export const templates = new Templates();

// Export class for testing
export default Templates;
