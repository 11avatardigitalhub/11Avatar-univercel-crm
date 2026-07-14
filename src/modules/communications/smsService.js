/**
 * ==========================================
 * FILE: smsService.js
 * MODULE: Communications Module
 * CODE: COMM-4
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * SMS service for the CRM.
 * Handles sending SMS messages, templates, and SMS campaigns.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize SMS service
 * - sendSMS(to, message, options): Send an SMS
 * - sendTemplate(to, templateName, variables, options): Send a template SMS
 * - sendBulk(recipients, message, options): Send bulk SMS
 * - sendCampaign(campaignData): Send an SMS campaign
 * - getTemplates(): Get all templates
 * - createTemplate(data): Create a new template
 * - updateTemplate(id, data): Update a template
 * - deleteTemplate(id): Delete a template
 * - getStats(): Get SMS statistics
 * - getAnalytics(): Get SMS analytics
 * - getDeliveryStatus(messageId): Get delivery status
 * 
 * USAGE EXAMPLE:
 * import { smsService } from './modules/communications/smsService.js';
 * 
 * // Initialize service
 * await smsService.initialize();
 * 
 * // Send an SMS
 * await smsService.sendSMS('+919876543210', 'Hello John! Welcome to 11 Avatar CRM.');
 * 
 * // Send a template SMS
 * await smsService.sendTemplate('+919876543210', 'welcome', {
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
let smsMessages = [];
let smsTemplates = [];
let smsStats = {
    sent: 0,
    delivered: 0,
    failed: 0,
    templatesUsed: {}
};

class SMSService {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            provider: process.env.SMS_PROVIDER || 'twilio',
            accountSid: process.env.SMS_ACCOUNT_SID || '',
            authToken: process.env.SMS_AUTH_TOKEN || '',
            fromNumber: process.env.SMS_FROM_NUMBER || '+1234567890',
            defaultLanguage: 'en',
            maxRetries: 3,
            retryDelay: 1000,
            maxLength: 160
        };
        
        // Rate limiting
        this.rateLimit = {
            count: 0,
            reset: Date.now(),
            max: 50 // SMS per minute
        };
        
        // Cache
        this.templateCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            sent: 0,
            delivered: 0,
            failed: 0,
            templatesUsed: {},
            lastMessage: null
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize sample templates
        this.initSampleTemplates();
    }

    /**
     * Initialize SMS service
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
            if (!this.config.fromNumber) {
                throw new Error('From number is required');
            }

            logger.info('SMS service initialized', {
                provider: this.config.provider,
                fromNumber: this.config.fromNumber
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('SMS service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize sample templates for testing
     */
    initSampleTemplates() {
        smsTemplates = [
            {
                id: 'sms_welcome',
                name: 'welcome',
                body: 'Welcome {customer_name} to {company_name}! Thank you for joining us.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_followup',
                name: 'followup',
                body: 'Hi {customer_name}, this is a follow-up from {company_name}. We would like to connect with you. Reply YES to confirm.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_thankyou',
                name: 'thankyou',
                body: 'Thank you {customer_name}! We appreciate your interest in {company_name}.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_otp',
                name: 'otp',
                body: 'Your OTP for {company_name} is {otp_code}. It will expire in 10 minutes.',
                variables: ['company_name', 'otp_code'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sms_reminder',
                name: 'reminder',
                body: 'Reminder: Your appointment with {company_name} is scheduled for {date_time}. Please be on time.',
                variables: ['company_name', 'date_time'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        for (const template of smsTemplates) {
            this.templateCache.set(template.name, template);
        }
    }

    /**
     * Send an SMS
     * @param {string} to - Recipient phone number
     * @param {string} message - SMS message
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendSMS(to, message, options = {}) {
        if (!this.initialized) {
            throw new Error('SMS service not initialized');
        }

        // Format phone number
        const formattedTo = this.formatPhoneNumber(to);

        // Check rate limit
        this.checkRateLimit();

        // Split message if too long
        const messages = this.splitMessage(message);

        // Prepare SMS data
        const sms = {
            id: 'sms_' + Date.now(),
            from: this.config.fromNumber,
            to: formattedTo,
            message: message,
            messages: messages,
            status: 'sending',
            timestamp: new Date().toISOString(),
            metadata: options.metadata || {},
            delivered: false,
            deliveredAt: null,
            failed: false,
            error: null
        };

        // Send SMS
        try {
            const result = await this.sendViaProvider(sms);
            sms.status = result.status;
            sms.messageId = result.messageId;
            
            if (result.status === 'delivered') {
                sms.delivered = true;
                sms.deliveredAt = new Date().toISOString();
            }
            
            // Store SMS
            smsMessages.push(sms);
            this.updateStats(sms);

            // Emit event
            eventBus.publish('sms.sent', {
                smsId: sms.id,
                to: formattedTo,
                message: message
            });

            if (this.debugMode) {
                logger.debug(`[SMS] SMS sent to ${formattedTo}`);
            }

            return sms;
        } catch (error) {
            logger.error(`[SMS] Failed to send to ${formattedTo}:`, error);
            sms.status = 'failed';
            sms.failed = true;
            sms.error = error.message;
            smsMessages.push(sms);
            this.stats.failed++;
            throw error;
        }
    }

    /**
     * Send a template SMS
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name
     * @param {object} variables - Template variables
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendTemplate(to, templateName, variables = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('SMS service not initialized');
        }

        // Get template
        const template = await this.getTemplate(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        // Render template
        const message = this.renderTemplate(template, variables);

        // Send SMS
        const sms = await this.sendSMS(to, message, {
            ...options,
            metadata: {
                ...options.metadata,
                templateName: templateName,
                variables: variables
            }
        });

        // Update template stats
        this.stats.templatesUsed[templateName] = (this.stats.templatesUsed[templateName] || 0) + 1;

        // Emit event
        eventBus.publish('sms.template_sent', {
            smsId: sms.id,
            to: to,
            templateName: templateName
        });

        return sms;
    }

    /**
     * Send bulk SMS
     * @param {Array} recipients - Array of phone numbers
     * @param {string} message - SMS message
     * @param {object} options - Additional options
     * @returns {object} Bulk send results
     */
    async sendBulk(recipients, message, options = {}) {
        if (!this.initialized) {
            throw new Error('SMS service not initialized');
        }

        const results = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        // Process in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            const promises = batch.map(recipient => 
                this.sendSMS(recipient, message, options).then(() => {
                    results.sent++;
                }).catch((error) => {
                    results.failed++;
                    results.errors.push({ recipient, error: error.message });
                })
            );
            await Promise.all(promises);
            
            if (i + batchSize < recipients.length) {
                await this.delay(1000);
            }
        }

        return results;
    }

    /**
     * Send an SMS campaign
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

        eventBus.publish('sms.campaign_completed', {
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
        return [...smsTemplates];
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

        const template = smsTemplates.find(t => t.name === name);
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
        if (!data.body) throw new Error('Template body is required');

        // Extract variables from template
        const variables = this.extractVariables(data.body);

        // Validate length
        if (data.body.length > 160) {
            throw new Error('Template body exceeds 160 characters. Please shorten.');
        }

        const template = {
            id: 'sms_template_' + Date.now(),
            name: data.name,
            body: data.body,
            variables: variables,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        smsTemplates.push(template);
        this.templateCache.set(template.name, template);
        this.cacheTimestamps.set(template.name, Date.now());

        await auditLogger.log(
            options.userId || 'system',
            'sms.template.created',
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
        const index = smsTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = smsTemplates[index];
        
        if (data.name) template.name = data.name;
        if (data.body) {
            if (data.body.length > 160) {
                throw new Error('Template body exceeds 160 characters.');
            }
            template.body = data.body;
            template.variables = this.extractVariables(data.body);
        }

        template.updatedAt = new Date().toISOString();
        smsTemplates[index] = template;
        
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
        const index = smsTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = smsTemplates[index];
        smsTemplates.splice(index, 1);
        this.templateCache.delete(template.name);
        this.cacheTimestamps.delete(template.name);

        return true;
    }

    /**
     * Get SMS analytics
     * @param {object} options - Additional options
     * @returns {object} SMS analytics
     */
    async getAnalytics(options = {}) {
        const total = smsMessages.length;
        const sent = smsMessages.filter(s => s.status === 'sent' || s.status === 'delivered').length;
        const delivered = smsMessages.filter(s => s.delivered).length;
        const failed = smsMessages.filter(s => s.failed).length;

        return {
            total,
            sent,
            delivered,
            failed,
            deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
            templatesUsed: this.stats.templatesUsed,
            lastMessage: this.stats.lastMessage
        };
    }

    /**
     * Get SMS statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    async getStats(options = {}) {
        return {
            ...this.stats,
            totalSMS: smsMessages.length,
            rateLimit: this.rateLimit
        };
    }

    /**
     * Get delivery status of an SMS
     * @param {string} messageId - Message ID
     * @param {object} options - Additional options
     * @returns {object} Delivery status
     */
    async getDeliveryStatus(messageId, options = {}) {
        const sms = smsMessages.find(s => s.id === messageId);
        if (!sms) {
            throw new Error(`SMS ${messageId} not found`);
        }

        return {
            id: sms.id,
            to: sms.to,
            status: sms.status,
            delivered: sms.delivered,
            deliveredAt: sms.deliveredAt,
            failed: sms.failed,
            error: sms.error
        };
    }

    /**
     * Render template with variables
     * @param {object} template - Template object
     * @param {object} variables - Variables
     * @returns {string} Rendered message
     */
    renderTemplate(template, variables) {
        let message = template.body;
        for (const [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }
        return message;
    }

    /**
     * Extract variables from template body
     * @param {string} body - Template body
     * @returns {Array} Variable names
     */
    extractVariables(body) {
        const matches = body.match(/{([^}]+)}/g) || [];
        return [...new Set(matches.map(m => m.slice(1, -1)))];
    }

    /**
     * Split message if too long
     * @param {string} message - Message to split
     * @returns {Array} Split messages
     */
    splitMessage(message) {
        if (message.length <= this.config.maxLength) {
            return [message];
        }

        const parts = [];
        let remaining = message;
        while (remaining.length > 0) {
            parts.push(remaining.substring(0, this.config.maxLength));
            remaining = remaining.substring(this.config.maxLength);
        }
        return parts;
    }

    /**
     * Send SMS via provider
     * @param {object} sms - SMS data
     * @returns {object} Send result
     */
    async sendViaProvider(sms) {
        // In production, this would use Twilio or similar
        // For MVP, simulate sending
        await this.delay(300);
        return {
            status: 'delivered',
            messageId: 'msg_' + Date.now()
        };
    }

    /**
     * Format phone number
     * @param {string} phone - Phone number
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        return cleaned;
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
            throw new Error(`Rate limit exceeded. Maximum ${this.rateLimit.max} SMS per minute.`);
        }

        this.rateLimit.count++;
    }

    /**
     * Update statistics
     * @param {object} sms - SMS object
     */
    updateStats(sms) {
        this.stats.sent++;
        if (sms.delivered) this.stats.delivered++;
        this.stats.lastMessage = sms;
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
        logger.debug('[SMSService] Debug mode enabled');
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
        logger.info('SMS service cleaned up');
    }
}

// Create and export singleton instance
export const smsService = new SMSService();

// Export class for testing
export default SMSService;
