/**
 * ==========================================
 * FILE: emailService.js
 * MODULE: Communications Module
 * CODE: COMM-3
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Email service for the CRM.
 * Handles sending emails, templates, and email tracking.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - templates.js (for template management)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize email service
 * - sendEmail(to, subject, body, options): Send an email
 * - sendTemplate(to, templateName, variables, options): Send a template email
 * - sendBulk(recipients, subject, body, options): Send bulk emails
 * - sendCampaign(campaignData): Send an email campaign
 * - getTemplates(): Get all templates
 * - createTemplate(data): Create a new template
 * - updateTemplate(id, data): Update a template
 * - deleteTemplate(id): Delete a template
 * - getStats(): Get email statistics
 * - trackOpen(messageId): Track email open
 * - trackClick(messageId, link): Track email click
 * - getAnalytics(): Get email analytics
 * 
 * USAGE EXAMPLE:
 * import { emailService } from './modules/communications/emailService.js';
 * 
 * // Initialize service
 * await emailService.initialize();
 * 
 * // Send an email
 * await emailService.sendEmail(
 *   'john@example.com',
 *   'Welcome to 11 Avatar CRM',
 *   'Hello John, welcome to our platform!'
 * );
 * 
 * // Send a template email
 * await emailService.sendTemplate(
 *   'john@example.com',
 *   'welcome',
 *   { customer_name: 'John', company_name: '11 Avatar' }
 * );
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let emails = [];
let emailTemplates = [];
let emailStats = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0
};

class EmailService {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@11avatar.com',
            fromName: process.env.SMTP_FROM_NAME || '11 Avatar CRM',
            smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
            smtpPort: process.env.SMTP_PORT || 587,
            smtpSecure: process.env.SMTP_SECURE === 'true',
            smtpUser: process.env.SMTP_USER || '',
            smtpPass: process.env.SMTP_PASS || '',
            defaultLanguage: 'en',
            maxRetries: 3,
            retryDelay: 1000
        };
        
        // Rate limiting
        this.rateLimit = {
            count: 0,
            reset: Date.now(),
            max: 60 // emails per minute
        };
        
        // Cache
        this.templateCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            failed: 0,
            templatesUsed: {},
            lastEmail: null
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize sample templates
        this.initSampleTemplates();
    }

    /**
     * Initialize email service
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

            // Validate configuration
            if (!this.config.fromEmail) {
                throw new Error('From email is required');
            }

            logger.info('Email service initialized', {
                fromEmail: this.config.fromEmail,
                smtpHost: this.config.smtpHost
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Email service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize sample templates for testing
     */
    initSampleTemplates() {
        emailTemplates = [
            {
                id: 'email_welcome',
                name: 'welcome',
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
                name: 'followup',
                subject: 'Follow-up from {company_name}',
                body: `<h1>Hi {customer_name},</h1>
                       <p>This is a follow-up from {company_name}. We would like to connect with you.</p>
                       <p>Please reply to this email or call us at {phone}.</p>`,
                variables: ['customer_name', 'company_name', 'phone'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'email_thankyou',
                name: 'thankyou',
                subject: 'Thank you from {company_name}',
                body: `<h1>Thank you {customer_name}!</h1>
                       <p>We appreciate your interest in {company_name}.</p>
                       <p>We will get back to you shortly.</p>`,
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'email_quotation',
                name: 'quotation',
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

        for (const template of emailTemplates) {
            this.templateCache.set(template.name, template);
        }
    }

    /**
     * Send an email
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} body - Email body (HTML)
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendEmail(to, subject, body, options = {}) {
        if (!this.initialized) {
            throw new Error('Email service not initialized');
        }

        // Validate email
        if (!this.validateEmail(to)) {
            throw new Error(`Invalid email: ${to}`);
        }

        // Check rate limit
        this.checkRateLimit();

        // Prepare email data
        const email = {
            id: 'email_' + Date.now(),
            from: options.from || this.config.fromEmail,
            fromName: options.fromName || this.config.fromName,
            to: to,
            subject: subject,
            body: body,
            html: options.isHtml !== false,
            status: 'sent',
            timestamp: new Date().toISOString(),
            metadata: options.metadata || {},
            opened: false,
            openedAt: null,
            clicked: false,
            clickedAt: null,
            clickedLinks: []
        };

        // Send email
        try {
            const result = await this.sendViaSMTP(email);
            email.status = result.status;
            email.messageId = result.messageId;
            
            // Store email
            emails.push(email);
            this.updateStats(email);

            // Emit event
            eventBus.publish('email.sent', {
                emailId: email.id,
                to: to,
                subject: subject
            });

            if (this.debugMode) {
                logger.debug(`[Email] Email sent to ${to}`);
            }

            return email;
        } catch (error) {
            logger.error(`[Email] Failed to send to ${to}:`, error);
            email.status = 'failed';
            email.error = error.message;
            emails.push(email);
            this.stats.failed++;
            throw error;
        }
    }

    /**
     * Send a template email
     * @param {string} to - Recipient email
     * @param {string} templateName - Template name
     * @param {object} variables - Template variables
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendTemplate(to, templateName, variables = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Email service not initialized');
        }

        // Get template
        const template = await this.getTemplate(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        // Render template
        const rendered = this.renderTemplate(template, variables);

        // Send email
        const email = await this.sendEmail(
            to,
            rendered.subject,
            rendered.body,
            {
                ...options,
                metadata: {
                    ...options.metadata,
                    templateName: templateName,
                    variables: variables
                }
            }
        );

        // Update template stats
        this.stats.templatesUsed[templateName] = (this.stats.templatesUsed[templateName] || 0) + 1;

        // Emit event
        eventBus.publish('email.template_sent', {
            emailId: email.id,
            to: to,
            templateName: templateName
        });

        return email;
    }

    /**
     * Send bulk emails
     * @param {Array} recipients - Array of email addresses
     * @param {string} subject - Email subject
     * @param {string} body - Email body
     * @param {object} options - Additional options
     * @returns {object} Bulk send results
     */
    async sendBulk(recipients, subject, body, options = {}) {
        if (!this.initialized) {
            throw new Error('Email service not initialized');
        }

        const results = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        for (const recipient of recipients) {
            try {
                await this.sendEmail(recipient, subject, body, options);
                results.sent++;
            } catch (error) {
                results.failed++;
                results.errors.push({ recipient, error: error.message });
            }
        }

        return results;
    }

    /**
     * Send an email campaign
     * @param {object} campaignData - Campaign data
     * @param {object} options - Additional options
     * @returns {object} Campaign results
     */
    async sendCampaign(campaignData, options = {}) {
        if (!campaignData.recipients || !campaignData.templateName) {
            throw new Error('Campaign requires recipients and templateName');
        }

        const results = {
            campaignId: 'camp_' + Date.now(),
            total: campaignData.recipients.length,
            sent: 0,
            failed: 0,
            errors: [],
            startedAt: new Date().toISOString()
        };

        // Process in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < campaignData.recipients.length; i += batchSize) {
            const batch = campaignData.recipients.slice(i, i + batchSize);
            const promises = batch.map(recipient => 
                this.sendTemplate(recipient, campaignData.templateName, campaignData.variables || {}, {
                    metadata: { campaignId: results.campaignId }
                }).then(() => {
                    results.sent++;
                }).catch((error) => {
                    results.failed++;
                    results.errors.push({ recipient, error: error.message });
                })
            );
            await Promise.all(promises);
            
            if (i + batchSize < campaignData.recipients.length) {
                await this.delay(1000);
            }
        }

        results.completedAt = new Date().toISOString();

        eventBus.publish('email.campaign_completed', {
            campaignId: results.campaignId,
            results: results
        });

        return results;
    }

    /**
     * Get all templates
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getTemplates(options = {}) {
        return [...emailTemplates];
    }

    /**
     * Get a template by name
     * @param {string} name - Template name
     * @param {object} options - Additional options
     * @returns {object|null} Template or null
     */
    async getTemplate(name, options = {}) {
        // Check cache
        if (this.templateCache.has(name)) {
            const cached = this.templateCache.get(name);
            const timestamp = this.cacheTimestamps.get(name) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.templateCache.delete(name);
            this.cacheTimestamps.delete(name);
        }

        const template = emailTemplates.find(t => t.name === name);
        if (template) {
            this.templateCache.set(name, template);
            this.cacheTimestamps.set(name, Date.now());
            return { ...template };
        }

        return null;
    }

    /**
     * Create a new template
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Created template
     */
    async createTemplate(data, options = {}) {
        if (!data.name) throw new Error('Template name is required');
        if (!data.subject) throw new Error('Template subject is required');
        if (!data.body) throw new Error('Template body is required');

        // Extract variables from template
        const variables = this.extractVariables(data);

        const template = {
            id: 'email_template_' + Date.now(),
            name: data.name,
            subject: data.subject,
            body: data.body,
            variables: variables,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        emailTemplates.push(template);
        this.templateCache.set(template.name, template);
        this.cacheTimestamps.set(template.name, Date.now());

        await auditLogger.log(
            options.userId || 'system',
            'email.template.created',
            'communication',
            { templateId: template.id, name: template.name }
        );

        return template;
    }

    /**
     * Update a template
     * @param {string} id - Template ID
     * @param {object} data - Updated template data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateTemplate(id, data, options = {}) {
        const index = emailTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = emailTemplates[index];
        
        if (data.name) template.name = data.name;
        if (data.subject) template.subject = data.subject;
        if (data.body) {
            template.body = data.body;
            template.variables = this.extractVariables(data);
        }

        template.updatedAt = new Date().toISOString();
        emailTemplates[index] = template;
        
        this.templateCache.delete(template.name);
        this.templateCache.set(template.name, template);
        this.cacheTimestamps.set(template.name, Date.now());

        return template;
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTemplate(id, options = {}) {
        const index = emailTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = emailTemplates[index];
        emailTemplates.splice(index, 1);
        this.templateCache.delete(template.name);
        this.cacheTimestamps.delete(template.name);

        return true;
    }

    /**
     * Track email open
     * @param {string} messageId - Message ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async trackOpen(messageId, options = {}) {
        const email = emails.find(e => e.id === messageId);
        if (email && !email.opened) {
            email.opened = true;
            email.openedAt = new Date().toISOString();
            this.stats.opened++;
            return true;
        }
        return false;
    }

    /**
     * Track email click
     * @param {string} messageId - Message ID
     * @param {string} link - Clicked link
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async trackClick(messageId, link, options = {}) {
        const email = emails.find(e => e.id === messageId);
        if (email) {
            email.clicked = true;
            email.clickedAt = new Date().toISOString();
            if (!email.clickedLinks) email.clickedLinks = [];
            email.clickedLinks.push({ link, timestamp: new Date().toISOString() });
            this.stats.clicked++;
            return true;
        }
        return false;
    }

    /**
     * Get email analytics
     * @param {object} options - Additional options
     * @returns {object} Email analytics
     */
    async getAnalytics(options = {}) {
        const total = emails.length;
        const sent = emails.filter(e => e.status === 'sent').length;
        const delivered = emails.filter(e => e.status === 'delivered').length;
        const opened = emails.filter(e => e.opened).length;
        const clicked = emails.filter(e => e.clicked).length;
        const failed = emails.filter(e => e.status === 'failed').length;
        const bounced = emails.filter(e => e.status === 'bounced').length;

        // Calculate rates
        const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
        const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
        const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

        return {
            total,
            sent,
            delivered,
            opened,
            clicked,
            failed,
            bounced,
            deliveryRate: Math.round(deliveryRate),
            openRate: Math.round(openRate),
            clickRate: Math.round(clickRate),
            templatesUsed: this.stats.templatesUsed,
            lastEmail: this.stats.lastEmail
        };
    }

    /**
     * Get email statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            totalEmails: emails.length,
            rateLimit: this.rateLimit
        };
    }

    /**
     * Render template with variables
     * @param {object} template - Template object
     * @param {object} variables - Variables
     * @returns {object} Rendered template
     */
    renderTemplate(template, variables) {
        let subject = template.subject;
        let body = template.body;

        for (const [key, value] of Object.entries(variables)) {
            subject = subject.replace(new RegExp(`{${key}}`, 'g'), value || '');
            body = body.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }

        return { subject, body };
    }

    /**
     * Extract variables from template
     * @param {object} data - Template data
     * @returns {Array} Variable names
     */
    extractVariables(data) {
        const allText = data.subject + ' ' + data.body;
        const matches = allText.match(/{([^}]+)}/g) || [];
        return [...new Set(matches.map(m => m.slice(1, -1)))];
    }

    /**
     * Send email via SMTP
     * @param {object} email - Email data
     * @returns {object} Send result
     */
    async sendViaSMTP(email) {
        // In production, this would use Nodemailer or similar
        // For MVP, simulate sending
        await this.delay(500);
        return {
            status: 'sent',
            messageId: 'msg_' + Date.now()
        };
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Check rate limit
     */
    checkRateLimit() {
        const now = Date.now();
        if (now - this.rateLimit.reset > 60000) {
            this.rateLimit.count = 0;
            this.rateLimit.reset = now;
        }

        if (this.rateLimit.count >= this.rateLimit.max) {
            throw new Error(`Rate limit exceeded. Maximum ${this.rateLimit.max} emails per minute.`);
        }

        this.rateLimit.count++;
    }

    /**
     * Update statistics
     * @param {object} email - Email object
     */
    updateStats(email) {
        this.stats.sent++;
        if (email.status === 'delivered') this.stats.delivered++;
        this.stats.lastEmail = email;
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[EmailService] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        this.initialized = false;
        this.templateCache.clear();
        this.cacheTimestamps.clear();
        logger.info('Email service cleaned up');
    }
}

// Create and export singleton instance
export const emailService = new EmailService();

// Export class for testing
export default EmailService;
