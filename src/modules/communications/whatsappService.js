/**
 * ==========================================
 * FILE: whatsappService.js
 * MODULE: Communications Module
 * CODE: COMM-2
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * WhatsApp integration service for the CRM.
 * Handles sending and receiving WhatsApp messages via Meta Business API.
 * Supports templates, media, and webhook handling.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - templates.js (for template management)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize WhatsApp service
 * - sendMessage(to, text, options): Send a text message
 * - sendTemplate(to, templateName, variables, options): Send a template message
 * - sendMedia(to, mediaUrl, caption, options): Send media message
 * - sendInteractive(to, interactiveData, options): Send interactive message
 * - receiveMessage(message): Process incoming message
 * - markAsRead(messageId): Mark message as read
 * - getMessages(filters): Get message history
 * - getConversation(contactId): Get conversation with contact
 * - getTemplates(): Get all templates
 * - createTemplate(data): Create a new template
 * - updateTemplate(id, data): Update a template
 * - deleteTemplate(id): Delete a template
 * - sendBroadcast(recipients, content, options): Send broadcast
 * - sendCampaign(campaignData): Send a campaign
 * - getAnalytics(): Get WhatsApp analytics
 * - handleWebhook(payload): Handle incoming webhook
 * - setWebhook(url): Set webhook URL
 * - getWebhookStatus(): Get webhook status
 * 
 * USAGE EXAMPLE:
 * import { whatsappService } from './modules/communications/whatsappService.js';
 * 
 * // Initialize service
 * await whatsappService.initialize();
 * 
 * // Send a text message
 * await whatsappService.sendMessage('+919876543210', 'Hello!');
 * 
 * // Send a template message
 * await whatsappService.sendTemplate('+919876543210', 'welcome', {
 *   customer_name: 'John'
 * });
 * 
 * // Handle incoming webhook
 * await whatsappService.handleWebhook(req.body);
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let messages = [];
let contacts = new Map();
let templates = [];

// WhatsApp configuration
const config = {
    phoneNumberId: process.env.WHATSAPP_PHONE_ID || '123456789',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'dummy_token',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_TOKEN || 'dummy_verify',
    baseUrl: 'https://graph.facebook.com/v18.0',
    defaultLanguage: 'en',
    maxRetries: 3,
    retryDelay: 1000
};

class WhatsAppService {
    constructor() {
        // Service state
        this.initialized = false;
        this.webhookUrl = null;
        this.webhookActive = false;
        this.rateLimit = {
            count: 0,
            reset: Date.now(),
            max: 80 // messages per minute
        };
        
        // Cache
        this.templateCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        
        // Statistics
        this.stats = {
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
            templatesUsed: {},
            lastMessage: null
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample templates
        this.initSampleTemplates();
    }

    /**
     * Initialize WhatsApp service
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            // Validate configuration
            if (!config.phoneNumberId || !config.accessToken) {
                throw new Error('WhatsApp configuration missing');
            }

            // In production, validate credentials with Meta API
            // For MVP, skip validation

            logger.info('WhatsApp service initialized', {
                phoneNumberId: config.phoneNumberId,
                version: '1.0.0'
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('WhatsApp service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize sample templates for testing
     */
    initSampleTemplates() {
        templates = [
            {
                id: 'template_welcome',
                name: 'welcome',
                category: 'marketing',
                language: 'en',
                body: 'Welcome {customer_name}! We are excited to have you on board at {company_name}.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'template_followup',
                name: 'followup',
                category: 'utility',
                language: 'en',
                body: 'Hi {customer_name}, this is a follow-up from {company_name}. We would like to connect with you.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'template_thankyou',
                name: 'thankyou',
                category: 'utility',
                language: 'en',
                body: 'Thank you {customer_name}! We appreciate your interest in {company_name}.',
                variables: ['customer_name', 'company_name'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        for (const template of templates) {
            this.templateCache.set(template.name, template);
        }
    }

    /**
     * Send a text message
     * @param {string} to - Recipient phone number
     * @param {string} text - Message text
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendMessage(to, text, options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        // Format phone number
        const formattedTo = this.formatPhoneNumber(to);

        // Check rate limit
        this.checkRateLimit();

        // Prepare payload
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedTo,
            type: 'text',
            text: { body: text }
        };

        // Send message
        try {
            const result = await this.callWhatsAppAPI(payload);
            
            // Store message
            const message = {
                id: result.messages[0].id,
                from: config.phoneNumberId,
                to: formattedTo,
                text: text,
                type: 'text',
                status: 'sent',
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            };
            messages.push(message);
            this.updateStats(message);

            // Emit event
            eventBus.publish('whatsapp.sent', {
                messageId: message.id,
                to: formattedTo,
                text: text
            });

            if (this.debugMode) {
                logger.debug(`[WhatsApp] Message sent to ${formattedTo}`);
            }

            return message;
        } catch (error) {
            logger.error(`[WhatsApp] Failed to send message to ${formattedTo}:`, error);
            throw error;
        }
    }

    /**
     * Send a template message
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name
     * @param {object} variables - Template variables
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendTemplate(to, templateName, variables = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        // Get template
        const template = await this.getTemplate(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        // Format phone number
        const formattedTo = this.formatPhoneNumber(to);

        // Check rate limit
        this.checkRateLimit();

        // Prepare template components
        const components = this.buildTemplateComponents(template, variables);

        // Prepare payload
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedTo,
            type: 'template',
            template: {
                name: templateName,
                language: { code: template.language || config.defaultLanguage },
                components: components
            }
        };

        // Send message
        try {
            const result = await this.callWhatsAppAPI(payload);
            
            // Store message
            const message = {
                id: result.messages[0].id,
                from: config.phoneNumberId,
                to: formattedTo,
                templateName: templateName,
                variables: variables,
                type: 'template',
                status: 'sent',
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            };
            messages.push(message);
            this.updateStats(message);

            // Update template stats
            this.stats.templatesUsed[templateName] = (this.stats.templatesUsed[templateName] || 0) + 1;

            // Emit event
            eventBus.publish('whatsapp.template_sent', {
                messageId: message.id,
                to: formattedTo,
                templateName: templateName
            });

            if (this.debugMode) {
                logger.debug(`[WhatsApp] Template sent to ${formattedTo}: ${templateName}`);
            }

            return message;
        } catch (error) {
            logger.error(`[WhatsApp] Failed to send template to ${formattedTo}:`, error);
            throw error;
        }
    }

    /**
     * Send a media message
     * @param {string} to - Recipient phone number
     * @param {string} mediaUrl - Media URL
     * @param {string} caption - Media caption
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendMedia(to, mediaUrl, caption = '', options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        // Format phone number
        const formattedTo = this.formatPhoneNumber(to);

        // Check rate limit
        this.checkRateLimit();

        // Determine media type
        const mediaType = this.getMediaType(mediaUrl);

        // Prepare payload
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedTo,
            type: mediaType,
            [mediaType]: {
                link: mediaUrl,
                caption: caption
            }
        };

        // Send message
        try {
            const result = await this.callWhatsAppAPI(payload);
            
            // Store message
            const message = {
                id: result.messages[0].id,
                from: config.phoneNumberId,
                to: formattedTo,
                mediaUrl: mediaUrl,
                caption: caption,
                type: mediaType,
                status: 'sent',
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            };
            messages.push(message);
            this.updateStats(message);

            if (this.debugMode) {
                logger.debug(`[WhatsApp] Media sent to ${formattedTo}`);
            }

            return message;
        } catch (error) {
            logger.error(`[WhatsApp] Failed to send media to ${formattedTo}:`, error);
            throw error;
        }
    }

    /**
     * Send an interactive message
     * @param {string} to - Recipient phone number
     * @param {object} interactiveData - Interactive data
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendInteractive(to, interactiveData, options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        // Format phone number
        const formattedTo = this.formatPhoneNumber(to);

        // Check rate limit
        this.checkRateLimit();

        // Prepare payload
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedTo,
            type: 'interactive',
            interactive: interactiveData
        };

        // Send message
        try {
            const result = await this.callWhatsAppAPI(payload);
            
            // Store message
            const message = {
                id: result.messages[0].id,
                from: config.phoneNumberId,
                to: formattedTo,
                interactive: interactiveData,
                type: 'interactive',
                status: 'sent',
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            };
            messages.push(message);
            this.updateStats(message);

            if (this.debugMode) {
                logger.debug(`[WhatsApp] Interactive sent to ${formattedTo}`);
            }

            return message;
        } catch (error) {
            logger.error(`[WhatsApp] Failed to send interactive to ${formattedTo}:`, error);
            throw error;
        }
    }

    /**
     * Process incoming message
     * @param {object} message - Incoming message
     * @param {object} options - Additional options
     * @returns {object} Processed message
     */
    async receiveMessage(message, options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        // Parse incoming message
        const parsedMessage = {
            id: message.id || 'msg_' + Date.now(),
            from: message.from || message.contact?.wa_id,
            to: message.to || config.phoneNumberId,
            text: message.text?.body || '',
            type: message.type || 'text',
            timestamp: new Date().toISOString(),
            status: 'received',
            metadata: options.metadata || {}
        };

        // Store message
        messages.push(parsedMessage);

        // Update contact
        if (parsedMessage.from) {
            if (!contacts.has(parsedMessage.from)) {
                contacts.set(parsedMessage.from, {
                    phone: parsedMessage.from,
                    name: message.contact?.profile?.name || null,
                    firstSeen: new Date().toISOString(),
                    lastMessageAt: new Date().toISOString(),
                    messageCount: 0
                });
            }
            const contact = contacts.get(parsedMessage.from);
            contact.lastMessageAt = new Date().toISOString();
            contact.messageCount++;
            contacts.set(parsedMessage.from, contact);
        }

        // Emit event
        eventBus.publish('whatsapp.received', {
            messageId: parsedMessage.id,
            from: parsedMessage.from,
            text: parsedMessage.text,
            type: parsedMessage.type
        });

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Message received from ${parsedMessage.from}`);
        }

        return parsedMessage;
    }

    /**
     * Mark message as read
     * @param {string} messageId - Message ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async markAsRead(messageId, options = {}) {
        if (!this.initialized) {
            throw new Error('WhatsApp service not initialized');
        }

        const message = messages.find(m => m.id === messageId);
        if (message) {
            message.status = 'read';
            message.readAt = new Date().toISOString();
            this.updateStats(message);
            return true;
        }

        return false;
    }

    /**
     * Get message history
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Messages
     */
    async getMessages(filters = {}, options = {}) {
        let results = [...messages];

        if (filters.from) {
            results = results.filter(m => m.from === filters.from);
        }

        if (filters.to) {
            results = results.filter(m => m.to === filters.to);
        }

        if (filters.type) {
            results = results.filter(m => m.type === filters.type);
        }

        if (filters.status) {
            results = results.filter(m => m.status === filters.status);
        }

        if (filters.startDate) {
            results = results.filter(m => new Date(m.timestamp) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(m => new Date(m.timestamp) <= new Date(filters.endDate));
        }

        // Sort by timestamp
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated;
    }

    /**
     * Get conversation with a contact
     * @param {string} contactId - Contact ID (phone number)
     * @param {object} options - Additional options
     * @returns {Array} Conversation messages
     */
    async getConversation(contactId, options = {}) {
        const formattedContact = this.formatPhoneNumber(contactId);
        const conversation = messages.filter(m => 
            m.from === formattedContact || m.to === formattedContact
        );
        conversation.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return conversation;
    }

    /**
     * Get all templates
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getTemplates(options = {}) {
        return [...templates];
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
            const timestamp = this.cacheTimestamps?.get(name) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.templateCache.delete(name);
        }

        const template = templates.find(t => t.name === name);
        if (template) {
            this.templateCache.set(name, template);
            if (!this.cacheTimestamps) this.cacheTimestamps = new Map();
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
        if (!data.name) {
            throw new Error('Template name is required');
        }
        if (!data.body) {
            throw new Error('Template body is required');
        }

        // Extract variables from body
        const variables = this.extractVariables(data.body);

        const template = {
            id: 'template_' + Date.now(),
            name: data.name,
            category: data.category || 'utility',
            language: data.language || config.defaultLanguage,
            body: data.body,
            variables: variables,
            header: data.header || null,
            footer: data.footer || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        templates.push(template);
        this.templateCache.set(template.name, template);
        if (!this.cacheTimestamps) this.cacheTimestamps = new Map();
        this.cacheTimestamps.set(template.name, Date.now());

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'whatsapp.template.created',
            'communication',
            { templateId: template.id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Template created: ${template.name}`);
        }

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
        const index = templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = templates[index];
        
        if (data.name) template.name = data.name;
        if (data.body) {
            template.body = data.body;
            template.variables = this.extractVariables(data.body);
        }
        if (data.category) template.category = data.category;
        if (data.language) template.language = data.language;
        if (data.header) template.header = data.header;
        if (data.footer) template.footer = data.footer;

        template.updatedAt = new Date().toISOString();
        templates[index] = template;
        this.templateCache.delete(template.name);
        this.templateCache.set(template.name, template);
        if (!this.cacheTimestamps) this.cacheTimestamps = new Map();
        this.cacheTimestamps.set(template.name, Date.now());

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Template updated: ${template.name}`);
        }

        return template;
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteTemplate(id, options = {}) {
        const index = templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = templates[index];
        templates.splice(index, 1);
        this.templateCache.delete(template.name);

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Template deleted: ${template.name}`);
        }

        return true;
    }

    /**
     * Send a broadcast
     * @param {Array} recipients - Array of phone numbers
     * @param {string|object} content - Message content or template data
     * @param {object} options - Additional options
     * @returns {object} Broadcast results
     */
    async sendBroadcast(recipients, content, options = {}) {
        const results = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        for (const recipient of recipients) {
            try {
                let result;
                if (typeof content === 'string') {
                    result = await this.sendMessage(recipient, content, options);
                } else {
                    result = await this.sendTemplate(recipient, content.name, content.variables, options);
                }
                results.sent++;
            } catch (error) {
                results.failed++;
                results.errors.push({ recipient, error: error.message });
            }
        }

        return results;
    }

    /**
     * Send a campaign
     * @param {object} campaignData - Campaign data
     * @param {object} options - Additional options
     * @returns {object} Campaign results
     */
    async sendCampaign(campaignData, options = {}) {
        // Validate campaign data
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
            
            // Delay between batches
            if (i + batchSize < campaignData.recipients.length) {
                await this.delay(1000);
            }
        }

        results.completedAt = new Date().toISOString();

        // Emit event
        eventBus.publish('whatsapp.campaign_completed', {
            campaignId: results.campaignId,
            results: results
        });

        return results;
    }

    /**
     * Get WhatsApp analytics
     * @param {object} options - Additional options
     * @returns {object} Analytics
     */
    async getAnalytics(options = {}) {
        const totalMessages = messages.length;
        const sentMessages = messages.filter(m => m.status === 'sent' || m.status === 'received');
        const deliveredMessages = messages.filter(m => m.status === 'delivered');
        const readMessages = messages.filter(m => m.status === 'read');
        const failedMessages = messages.filter(m => m.status === 'failed');

        return {
            ...this.stats,
            totalMessages,
            sent: sentMessages.length,
            delivered: deliveredMessages.length,
            read: readMessages.length,
            failed: failedMessages.length,
            uniqueContacts: contacts.size,
            templatesUsed: this.stats.templatesUsed,
            lastMessage: this.stats.lastMessage,
            rateLimit: this.rateLimit
        };
    }

    /**
     * Handle incoming webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     * @returns {object} Webhook handling result
     */
    async handleWebhook(payload, options = {}) {
        if (!payload) {
            throw new Error('Webhook payload is required');
        }

        // Verify webhook signature (in production)
        // For MVP, skip verification

        const results = {
            processed: 0,
            errors: 0
        };

        // Process each entry
        if (payload.entry) {
            for (const entry of payload.entry) {
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.value && change.value.messages) {
                            for (const message of change.value.messages) {
                                try {
                                    await this.receiveMessage(message, options);
                                    results.processed++;
                                } catch (error) {
                                    results.errors++;
                                    logger.error('[WhatsApp] Error processing webhook message:', error);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Webhook processed ${results.processed} messages`);
        }

        return results;
    }

    /**
     * Set webhook URL
     * @param {string} url - Webhook URL
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async setWebhook(url, options = {}) {
        this.webhookUrl = url;
        this.webhookActive = true;

        // In production, this would register with Meta API
        // For MVP, just store locally

        if (this.debugMode) {
            logger.debug(`[WhatsApp] Webhook set to ${url}`);
        }

        return true;
    }

    /**
     * Get webhook status
     * @param {object} options - Additional options
     * @returns {object} Webhook status
     */
    async getWebhookStatus(options = {}) {
        return {
            url: this.webhookUrl,
            active: this.webhookActive,
            configured: this.webhookUrl !== null
        };
    }

    /**
     * Call WhatsApp API
     * @param {object} payload - API payload
     * @returns {object} API response
     */
    async callWhatsAppAPI(payload) {
        // In production, this would call Meta API
        // For MVP, simulate API call
        await this.delay(500);
        
        // Simulate API response
        return {
            messaging_product: 'whatsapp',
            contacts: [
                { input: payload.to, wa_id: payload.to }
            ],
            messages: [
                { id: 'wam_' + Date.now() }
            ]
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
     * Get media type from URL
     * @param {string} url - Media URL
     * @returns {string} Media type
     */
    getMediaType(url) {
        const extension = url.split('.').pop().toLowerCase();
        const mediaTypes = {
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'mp4': 'video',
            'mov': 'video',
            'pdf': 'document',
            'doc': 'document',
            'docx': 'document'
        };
        return mediaTypes[extension] || 'document';
    }

    /**
     * Extract variables from template body
     * @param {string} body - Template body
     * @returns {Array} Variable names
     */
    extractVariables(body) {
        const matches = body.match(/{([^}]+)}/g) || [];
        return matches.map(m => m.slice(1, -1));
    }

    /**
     * Build template components
     * @param {object} template - Template object
     * @param {object} variables - Variables
     * @returns {Array} Components
     */
    buildTemplateComponents(template, variables) {
        const components = [];

        // Body component
        const bodyText = template.body;
        const bodyParameters = [];
        for (const variable of template.variables) {
            bodyParameters.push({
                type: 'text',
                text: variables[variable] || ''
            });
        }

        components.push({
            type: 'body',
            parameters: bodyParameters
        });

        // Header component (if exists)
        if (template.header) {
            components.push({
                type: 'header',
                parameters: [
                    {
                        type: 'text',
                        text: template.header
                    }
                ]
            });
        }

        // Footer component (if exists)
        if (template.footer) {
            components.push({
                type: 'footer',
                parameters: [
                    {
                        type: 'text',
                        text: template.footer
                    }
                ]
            });
        }

        return components;
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
            throw new Error(`Rate limit exceeded. Maximum ${this.rateLimit.max} messages per minute.`);
        }

        this.rateLimit.count++;
    }

    /**
     * Update statistics
     * @param {object} message - Message object
     */
    updateStats(message) {
        if (message.status === 'sent') this.stats.sent++;
        if (message.status === 'delivered') this.stats.delivered++;
        if (message.status === 'read') this.stats.read++;
        if (message.status === 'failed') this.stats.failed++;
        this.stats.lastMessage = message;
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
        logger.debug('[WhatsAppService] Debug mode enabled');
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
        return { ...config };
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        Object.assign(config, newConfig);
    }

    /**
     * Get statistics
     * @returns {object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        this.initialized = false;
        this.templateCache.clear();
        if (this.cacheTimestamps) this.cacheTimestamps.clear();
        logger.info('WhatsApp service cleaned up');
    }
}

// Create and export singleton instance
export const whatsappService = new WhatsAppService();

// Export class for testing
export default WhatsAppService;
