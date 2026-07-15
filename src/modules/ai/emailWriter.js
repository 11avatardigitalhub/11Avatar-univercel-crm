/**
 * ==========================================
 * FILE: emailWriter.js
 * MODULE: AI Module
 * CODE: AI-5
 * PRIORITY: P0
 * PHASE: 3
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * AI-powered email writing service for generating professional
 * emails for various use cases including sales, follow-ups,
 * proposals, quotations, and customer communication.
 * 
 * DEPENDENCIES:
 * - aiService.js (for AI capabilities)
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - logger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize email writer
 * - writeEmail(context, style): Write an email
 * - writeSalesEmail(leadData): Write sales email
 * - writeFollowUpEmail(context): Write follow-up email
 * - writeProposalEmail(context): Write proposal email
 * - writeQuotationEmail(context): Write quotation email
 * - writeThankYouEmail(context): Write thank you email
 * - writeWelcomeEmail(context): Write welcome email
 * - writeNewsletterEmail(context): Write newsletter email
 * - writeBulkEmail(template, recipients): Write bulk email
 * - getEmailTemplates(): Get templates
 * - createEmailTemplate(data): Create template
 * - updateEmailTemplate(id, data): Update template
 * - deleteEmailTemplate(id): Delete template
 * - getEmailStats(): Get email statistics
 * 
 * USAGE EXAMPLE:
 * import { emailWriter } from './modules/ai/emailWriter.js';
 * 
 * // Initialize email writer
 * await emailWriter.initialize();
 * 
 * // Write a sales email
 * const email = await emailWriter.writeSalesEmail({
 *   leadName: 'John Doe',
 *   company: 'Tech Solutions',
 *   product: 'ERP Software',
 *   painPoints: ['manual processes', 'data silos']
 * });
 * 
 * // Write a follow-up email
 * const followUp = await emailWriter.writeFollowUpEmail({
 *   recipient: 'jane@example.com',
 *   previousEmail: 'Proposal sent on Jan 15',
 *   nextSteps: 'Schedule demo'
 * });
 * ==========================================
 */

import { aiService } from './aiService.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';

// Email templates
const DEFAULT_EMAIL_TEMPLATES = [
    {
        id: 'template_sales',
        name: 'Sales Email',
        category: 'sales',
        subject: 'How {product} can help {company} grow',
        body: `Dear {lead_name},

I hope this email finds you well.

I'm reaching out to share how {product} can help {company} solve {pain_points}.

{product} offers:
- Feature 1
- Feature 2
- Feature 3

I'd love to schedule a quick call to discuss this further.

Looking forward to hearing from you.

Best regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'company', 'product', 'pain_points', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'professional',
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_followup',
        name: 'Follow-up Email',
        category: 'followup',
        subject: 'Following up on my previous email',
        body: `Hi {lead_name},

I wanted to follow up on my previous email about {product}.

Have you had a chance to review it? I'd be happy to answer any questions or provide additional information.

{next_steps}

Looking forward to hearing from you.

Best regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'product', 'next_steps', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'professional',
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_proposal',
        name: 'Proposal Email',
        category: 'proposal',
        subject: 'Proposal for {company} - {product}',
        body: `Dear {lead_name},

Please find attached our proposal for {product}.

Our proposal includes:
- Detailed scope of work
- Timeline and milestones
- Pricing and payment terms

We believe this solution will help {company} achieve {benefits}.

I'm available to discuss any questions you may have.

Looking forward to working together.

Best regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'company', 'product', 'benefits', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'professional',
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_quotation',
        name: 'Quotation Email',
        category: 'quotation',
        subject: 'Quotation for {product} - {company}',
        body: `Dear {lead_name},

Thank you for your interest in {product}.

Please find attached our quotation for your review.

Quotation Details:
- Product/Services: {product}
- Total Amount: {amount}
- Validity: {validity}

Payment Terms:
- {payment_terms}

I'm available to discuss this quotation and answer any questions.

Looking forward to your positive response.

Best regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'company', 'product', 'amount', 'validity', 'payment_terms', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'professional',
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_thankyou',
        name: 'Thank You Email',
        category: 'thankyou',
        subject: 'Thank you for your interest',
        body: `Dear {lead_name},

Thank you for your interest in {product}.

We appreciate the time you took to learn about our solutions.

{next_steps}

If you have any questions, please don't hesitate to reach out.

Best regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'product', 'next_steps', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'friendly',
        createdAt: new Date().toISOString()
    },
    {
        id: 'template_welcome',
        name: 'Welcome Email',
        category: 'welcome',
        subject: 'Welcome to {company}',
        body: `Dear {lead_name},

Welcome to {company}!

We're excited to have you on board.

Here's what you can expect:
- {benefit_1}
- {benefit_2}
- {benefit_3}

{next_steps}

If you need any assistance, we're here to help.

Warm regards,
{sender_name}
{sender_title}
{sender_company}`,
        variables: ['lead_name', 'company', 'benefit_1', 'benefit_2', 'benefit_3', 'next_steps', 'sender_name', 'sender_title', 'sender_company'],
        isSystem: true,
        style: 'friendly',
        createdAt: new Date().toISOString()
    }
];

class EmailWriter {
    constructor() {
        // Service state
        this.initialized = false;
        this.templates = [...DEFAULT_EMAIL_TEMPLATES];
        
        // Configuration
        this.config = {
            enableAI: true,
            enableTemplates: true,
            defaultStyle: 'professional',
            maxEmailLength: 2000,
            minConfidence: 0.6,
            defaultSender: {
                name: '11 Avatar CRM',
                title: 'Sales Team',
                company: '11 Avatar CRM'
            }
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            totalEmails: 0,
            aiGenerated: 0,
            templateGenerated: 0,
            byCategory: {},
            byStyle: {},
            averageLength: 0
        };
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize email writer
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

            logger.info('Email writer initialized', {
                templates: this.templates.length,
                styles: ['professional', 'friendly', 'casual']
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Email writer initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load custom templates from storage
     */
    async loadCustomTemplates() {
        // In production, this would load from Firestore
        // For MVP, use default templates
        if (this.debugMode) {
            logger.debug('[EmailWriter] Custom templates loaded');
        }
    }

    /**
     * Write an email
     * @param {object} context - Email context
     * @param {string} style - Email style
     * @param {object} options - Additional options
     * @returns {object} Email object
     */
    async writeEmail(context, style = this.config.defaultStyle, options = {}) {
        if (!this.initialized) {
            throw new Error('Email writer not initialized');
        }

        const startTime = Date.now();

        // Check cache
        const cacheKey = this.getCacheKey(context, style);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
        }

        let email;

        try {
            // Try template-based email
            if (this.config.enableTemplates && options.useTemplates !== false) {
                const templateEmail = await this.generateTemplateEmail(context, style);
                if (templateEmail) {
                    email = templateEmail;
                    this.stats.templateGenerated++;
                }
            }

            // If no template, use AI
            if (!email && this.config.enableAI && options.useAI !== false) {
                email = await this.generateAIEmail(context, style);
                this.stats.aiGenerated++;
            }

            // If still no email, use fallback
            if (!email) {
                email = this.getFallbackEmail(context);
            }

            // Validate email
            email = this.validateEmail(email);

            // Cache the result
            this.cache.set(cacheKey, email);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Update stats
            const duration = Date.now() - startTime;
            this.updateStats(context.category || 'general', style, duration);

            // Log to audit
            await auditLogger.log(
                context.userId || 'system',
                'ai.email_written',
                'ai',
                { 
                    subject: email.subject,
                    style: style,
                    category: context.category
                }
            );

            if (this.debugMode) {
                logger.debug(`[EmailWriter] Email written (${duration}ms)`);
            }

            return email;
        } catch (error) {
            logger.error('[EmailWriter] Email writing failed:', error);
            return this.getFallbackEmail(context);
        }
    }

    /**
     * Write a sales email
     * @param {object} leadData - Lead data
     * @param {object} options - Additional options
     * @returns {object} Sales email
     */
    async writeSalesEmail(leadData, options = {}) {
        const context = {
            lead_name: leadData.name || 'Customer',
            company: leadData.company || 'your company',
            product: leadData.product || 'our solution',
            pain_points: leadData.painPoints || 'challenges',
            sender_name: leadData.senderName || this.config.defaultSender.name,
            sender_title: leadData.senderTitle || this.config.defaultSender.title,
            sender_company: leadData.senderCompany || this.config.defaultSender.company,
            category: 'sales'
        };

        return await this.writeEmail(context, 'professional', options);
    }

    /**
     * Write a follow-up email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Follow-up email
     */
    async writeFollowUpEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            product: context.product || 'our solution',
            next_steps: context.nextSteps || 'Let me know if you have any questions',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'followup'
        };

        return await this.writeEmail(emailContext, 'professional', options);
    }

    /**
     * Write a proposal email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Proposal email
     */
    async writeProposalEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            company: context.company || 'your company',
            product: context.product || 'our solution',
            benefits: context.benefits || 'your business goals',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'proposal'
        };

        return await this.writeEmail(emailContext, 'professional', options);
    }

    /**
     * Write a quotation email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Quotation email
     */
    async writeQuotationEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            company: context.company || 'your company',
            product: context.product || 'our product',
            amount: context.amount || 'the quoted amount',
            validity: context.validity || '30 days',
            payment_terms: context.paymentTerms || '50% advance, 50% on delivery',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'quotation'
        };

        return await this.writeEmail(emailContext, 'professional', options);
    }

    /**
     * Write a thank you email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Thank you email
     */
    async writeThankYouEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            product: context.product || 'our product',
            next_steps: context.nextSteps || 'We look forward to serving you',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'thankyou'
        };

        return await this.writeEmail(emailContext, 'friendly', options);
    }

    /**
     * Write a welcome email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Welcome email
     */
    async writeWelcomeEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            company: context.company || 'our company',
            benefit_1: context.benefits?.[0] || 'Access to our platform',
            benefit_2: context.benefits?.[1] || '24/7 support',
            benefit_3: context.benefits?.[2] || 'Regular updates',
            next_steps: context.nextSteps || 'Get started today',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'welcome'
        };

        return await this.writeEmail(emailContext, 'friendly', options);
    }

    /**
     * Write a newsletter email
     * @param {object} context - Context data
     * @param {object} options - Additional options
     * @returns {object} Newsletter email
     */
    async writeNewsletterEmail(context, options = {}) {
        const emailContext = {
            lead_name: context.recipient || 'Customer',
            company: context.company || 'our company',
            content: context.content || 'latest updates and news',
            cta: context.cta || 'Learn More',
            sender_name: context.senderName || this.config.defaultSender.name,
            sender_title: context.senderTitle || this.config.defaultSender.title,
            sender_company: context.senderCompany || this.config.defaultSender.company,
            category: 'newsletter'
        };

        return await this.writeEmail(emailContext, 'friendly', options);
    }

    /**
     * Write bulk email using template
     * @param {object} template - Email template
     * @param {Array} recipients - Recipients list
     * @param {object} options - Additional options
     * @returns {Array} Emails
     */
    async writeBulkEmail(template, recipients, options = {}) {
        const emails = [];

        for (const recipient of recipients) {
            try {
                const context = {
                    ...recipient,
                    sender_name: options.senderName || this.config.defaultSender.name,
                    sender_title: options.senderTitle || this.config.defaultSender.title,
                    sender_company: options.senderCompany || this.config.defaultSender.company
                };

                const email = await this.writeEmail(context, template.style || 'professional', {
                    useAI: false,
                    useTemplates: true
                });

                emails.push({
                    recipient: recipient,
                    email: email,
                    success: true
                });
            } catch (error) {
                emails.push({
                    recipient: recipient,
                    error: error.message,
                    success: false
                });
            }
        }

        return emails;
    }

    /**
     * Generate template-based email
     * @param {object} context - Email context
     * @param {string} style - Email style
     * @returns {object|null} Email object
     */
    async generateTemplateEmail(context, style) {
        const category = context.category || 'general';
        const matchedTemplates = this.templates.filter(t => 
            (t.category === category || t.category === 'general') &&
            (!t.style || t.style === style || t.style === 'any')
        );

        if (matchedTemplates.length === 0) {
            return null;
        }

        // Use the first matching template
        const template = matchedTemplates[0];
        const subject = this.renderTemplate(template.subject, context);
        const body = this.renderTemplate(template.body, context);

        return {
            subject: subject,
            body: body,
            style: style,
            category: category,
            templateId: template.id,
            generated: 'template'
        };
    }

    /**
     * Render template with variables
     * @param {string} template - Template text
     * @param {object} context - Context data
     * @returns {string} Rendered template
     */
    renderTemplate(template, context) {
        let rendered = template;
        const variables = template.match(/{([^}]+)}/g) || [];

        for (const variable of variables) {
            const key = variable.slice(1, -1);
            const value = context[key] || '';
            rendered = rendered.replace(variable, value);
        }

        return rendered;
    }

    /**
     * Generate AI-powered email
     * @param {object} context - Email context
     * @param {string} style - Email style
     * @returns {object} Email object
     */
    async generateAIEmail(context, style) {
        const prompt = this.buildAIPrompt(context, style);
        
        const response = await aiService.callAI(prompt, {
            temperature: 0.7,
            maxTokens: 800
        });

        // Parse response to extract subject and body
        const lines = response.split('\n');
        let subject = '';
        let body = '';

        for (const line of lines) {
            if (line.startsWith('Subject:')) {
                subject = line.replace('Subject:', '').trim();
            } else {
                body += line + '\n';
            }
        }

        if (!subject) {
            subject = `Re: ${context.product || 'our solution'}`;
        }

        return {
            subject: subject.trim(),
            body: body.trim(),
            style: style,
            category: context.category || 'general',
            generated: 'ai'
        };
    }

    /**
     * Build AI prompt
     * @param {object} context - Email context
     * @param {string} style - Email style
     * @returns {string} Prompt
     */
    buildAIPrompt(context, style) {
        const leadName = context.lead_name || context.recipient || 'Customer';
        const company = context.company || 'your company';
        const product = context.product || 'our solution';
        const senderName = context.sender_name || this.config.defaultSender.name;
        const senderTitle = context.sender_title || this.config.defaultSender.title;
        const senderCompany = context.sender_company || this.config.defaultSender.company;

        const styleGuide = {
            professional: 'Use a professional and formal tone. Include proper salutation and closing.',
            friendly: 'Use a friendly and warm tone. Be approachable but maintain professionalism.',
            casual: 'Use a casual and conversational tone. Be direct and personal.'
        };

        const styleDesc = styleGuide[style] || styleGuide.professional;

        return `
Write an email for an Indian business context.

Style: ${style}
${styleDesc}

Context:
- Recipient: ${leadName}
- Company: ${company}
- Product/Solution: ${product}
- Sender: ${senderName} (${senderTitle}, ${senderCompany})

Additional Context:
${JSON.stringify(context, null, 2)}

Requirements:
1. Subject line should be clear and compelling
2. Email body should be professional and engaging
3. Include a clear call-to-action
4. Keep it concise (max 200 words)
5. Include proper salutation and closing

Format:
Subject: [Your subject line]

[Email body]

Return ONLY the email with Subject: line and body.
`;
    }

    /**
     * Validate email
     * @param {object} email - Email object
     * @returns {object} Validated email
     */
    validateEmail(email) {
        if (!email.subject) {
            email.subject = 'Important Update';
        }

        if (!email.body) {
            email.body = 'This is a placeholder email body.';
        }

        // Trim length if needed
        if (email.body.length > this.config.maxEmailLength) {
            email.body = email.body.substring(0, this.config.maxEmailLength) + '...';
        }

        return email;
    }

    /**
     * Get fallback email
     * @param {object} context - Email context
     * @returns {object} Fallback email
     */
    getFallbackEmail(context) {
        const leadName = context.lead_name || context.recipient || 'Customer';
        const senderName = context.sender_name || this.config.defaultSender.name;
        const senderTitle = context.sender_title || this.config.defaultSender.title;
        const senderCompany = context.sender_company || this.config.defaultSender.company;

        return {
            subject: `Re: ${context.product || 'our solution'}`,
            body: `Dear ${leadName},

I hope this email finds you well.

I wanted to reach out to discuss how we can help you with your requirements.

I would appreciate the opportunity to connect and explore potential collaboration.

Looking forward to hearing from you.

Best regards,
${senderName}
${senderTitle}
${senderCompany}`,
            style: this.config.defaultStyle,
            category: context.category || 'general',
            generated: 'fallback'
        };
    }

    /**
     * Get email templates
     * @param {object} options - Additional options
     * @returns {Array} Templates
     */
    async getEmailTemplates(options = {}) {
        let templates = [...this.templates];

        if (options.category) {
            templates = templates.filter(t => t.category === options.category);
        }

        if (options.style) {
            templates = templates.filter(t => t.style === options.style || t.style === 'any');
        }

        if (options.isSystem !== undefined) {
            templates = templates.filter(t => t.isSystem === options.isSystem);
        }

        return templates;
    }

    /**
     * Create email template
     * @param {object} data - Template data
     * @param {object} options - Additional options
     * @returns {object} Created template
     */
    async createEmailTemplate(data, options = {}) {
        if (!data.name || !data.subject || !data.body) {
            throw new Error('Template name, subject, and body are required');
        }

        // Extract variables from body and subject
        const variables = [
            ...(data.subject.match(/{([^}]+)}/g) || []),
            ...(data.body.match(/{([^}]+)}/g) || [])
        ].map(m => m.slice(1, -1));

        const template = {
            id: 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: data.name,
            category: data.category || 'general',
            subject: data.subject,
            body: data.body,
            variables: [...new Set(variables)],
            style: data.style || 'professional',
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
            'email_writer.template_created',
            'ai',
            { templateId: template.id, name: template.name }
        );

        if (this.debugMode) {
            logger.debug(`[EmailWriter] Template created: ${template.id}`);
        }

        return template;
    }

    /**
     * Update email template
     * @param {string} id - Template ID
     * @param {object} data - Updated data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateEmailTemplate(id, data, options = {}) {
        const index = this.templates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error(`Template ${id} not found`);
        }

        const template = this.templates[index];
        if (template.isSystem && !options.forceUpdate) {
            throw new Error('Cannot update system template');
        }

        // Update fields
        if (data.name) template.name = data.name;
        if (data.category) template.category = data.category;
        if (data.subject) {
            template.subject = data.subject;
            const newVars = data.subject.match(/{([^}]+)}/g) || [];
            template.variables = [...new Set([...template.variables, ...newVars.map(m => m.slice(1, -1))])];
        }
        if (data.body) {
            template.body = data.body;
            const newVars = data.body.match(/{([^}]+)}/g) || [];
            template.variables = [...new Set([...template.variables, ...newVars.map(m => m.slice(1, -1))])];
        }
        if (data.style) template.style = data.style;
        if (data.isActive !== undefined) template.isActive = data.isActive;

        template.updatedAt = new Date().toISOString();
        this.templates[index] = template;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'email_writer.template_updated',
            'ai',
            { templateId: id }
        );

        return template;
    }

    /**
     * Delete email template
     * @param {string} id - Template ID
     * @param {object} options - Additional options
     * @returns {boolean} Success
     */
    async deleteEmailTemplate(id, options = {}) {
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
            'email_writer.template_deleted',
            'ai',
            { templateId: id, name: template.name }
        );

        return true;
    }

    /**
     * Get email statistics
     * @param {object} options - Additional options
     * @returns {object} Email statistics
     */
    async getEmailStats(options = {}) {
        return { ...this.stats };
    }

    /**
     * Get cache key
     * @param {object} context - Email context
     * @param {string} style - Email style
     * @returns {string} Cache key
     */
    getCacheKey(context, style) {
        const keyParts = [
            context.category || '',
            style || '',
            context.lead_name || '',
            context.company || '',
            context.product || ''
        ];
        return 'email_' + keyParts.join('_').replace(/\s/g, '_');
    }

    /**
     * Update statistics
     * @param {string} category - Email category
     * @param {string} style - Email style
     * @param {number} duration - Generation time
     */
    updateStats(category, style, duration) {
        this.stats.totalEmails++;
        this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
        this.stats.byStyle[style] = (this.stats.byStyle[style] || 0) + 1;
        this.stats.averageLength = (this.stats.averageLength * (this.stats.totalEmails - 1) + 200) / this.stats.totalEmails;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[EmailWriter] Debug mode enabled');
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
        logger.info('Email writer cleaned up');
    }
}

// Create and export singleton instance
export const emailWriter = new EmailWriter();

// Export class for testing
export default EmailWriter;
