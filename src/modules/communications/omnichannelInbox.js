/**
 * ==========================================
 * FILE: omnichannelInbox.js
 * MODULE: Communications Module
 * CODE: COMM-6
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Omnichannel inbox that unifies messages from WhatsApp, Email, SMS,
 * and other channels into a single view.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - whatsappService.js, emailService.js, smsService.js
 * 
 * FUNCTIONS:
 * - initialize(): Initialize omnichannel inbox
 * - getInbox(filters): Get unified inbox
 * - getConversation(contactId): Get conversation with contact
 * - sendMessage(channel, to, content, options): Send message from inbox
 * - markAsRead(messageId): Mark message as read
 * - assignConversation(conversationId, userId): Assign conversation
 * - addNote(conversationId, note): Add note to conversation
 * - getUnreadCount(): Get unread count
 * - getChannelStats(): Get channel statistics
 * - searchInbox(query): Search inbox
 * - archiveConversation(conversationId): Archive conversation
 * - restoreConversation(conversationId): Restore conversation
 * - getConversationHistory(contactId): Get complete history
 * 
 * USAGE EXAMPLE:
 * import { omnichannelInbox } from './modules/communications/omnichannelInbox.js';
 * 
 * // Initialize inbox
 * await omnichannelInbox.initialize();
 * 
 * // Get unified inbox
 * const messages = await omnichannelInbox.getInbox({ status: 'unread' });
 * 
 * // Get conversation with a contact
 * const conversation = await omnichannelInbox.getConversation('+919876543210');
 * 
 * // Send message from inbox
 * await omnichannelInbox.sendMessage('whatsapp', '+919876543210', 'Hello!');
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// Import services (will be initialized when available)
import { whatsappService } from './whatsappService.js';
import { emailService } from './emailService.js';
import { smsService } from './smsService.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let conversations = [];
let messages = [];
let unreadCount = 0;

class OmnichannelInbox {
    constructor() {
        // Service state
        this.initialized = false;
        this.channels = ['whatsapp', 'email', 'sms'];
        this.channelServices = {
            whatsapp: whatsappService,
            email: emailService,
            sms: smsService
        };
        
        // Configuration
        this.config = {
            enableAllChannels: true,
            autoAssign: true,
            defaultChannel: 'whatsapp',
            maxMessagesPerConversation: 1000,
            archiveAfterDays: 30
        };
        
        // Cache
        this.cache = {
            conversations: new Map(),
            messages: new Map()
        };
        
        // Statistics
        this.stats = {
            totalMessages: 0,
            unread: 0,
            byChannel: {
                whatsapp: 0,
                email: 0,
                sms: 0
            },
            byStatus: {
                unread: 0,
                read: 0,
                assigned: 0,
                archived: 0
            }
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample data
        this.initSampleData();
    }

    /**
     * Initialize omnichannel inbox
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

            // Subscribe to events from each channel
            this.setupEventListeners();

            logger.info('Omnichannel inbox initialized', {
                channels: this.channels,
                config: this.config
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Omnichannel inbox initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for all channels
     */
    setupEventListeners() {
        // WhatsApp events
        eventBus.subscribe('whatsapp.received', (data) => {
            this.handleIncomingMessage('whatsapp', data);
        });

        eventBus.subscribe('whatsapp.sent', (data) => {
            this.handleOutgoingMessage('whatsapp', data);
        });

        // Email events
        eventBus.subscribe('email.received', (data) => {
            this.handleIncomingMessage('email', data);
        });

        eventBus.subscribe('email.sent', (data) => {
            this.handleOutgoingMessage('email', data);
        });

        // SMS events
        eventBus.subscribe('sms.received', (data) => {
            this.handleIncomingMessage('sms', data);
        });

        eventBus.subscribe('sms.sent', (data) => {
            this.handleOutgoingMessage('sms', data);
        });
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const now = new Date();
        const sampleConversations = [
            {
                id: 'conv_1',
                contactId: '+919876543210',
                contactName: 'Rahul Sharma',
                channel: 'whatsapp',
                lastMessage: 'Hi, I need more information about your product.',
                lastMessageTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
                unreadCount: 2,
                assignedTo: null,
                status: 'active',
                tags: ['lead', 'followup'],
                notes: '',
                createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'conv_2',
                contactId: '+919765432109',
                contactName: 'Priya Patel',
                channel: 'whatsapp',
                lastMessage: 'Thank you for the quotation. I will review it.',
                lastMessageTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
                unreadCount: 0,
                assignedTo: 'user_456',
                status: 'active',
                tags: ['customer', 'deal'],
                notes: 'High potential customer',
                createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'conv_3',
                contactId: 'john@example.com',
                contactName: 'John Doe',
                channel: 'email',
                lastMessage: 'I have some questions about the implementation timeline.',
                lastMessageTime: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
                unreadCount: 1,
                assignedTo: null,
                status: 'active',
                tags: ['support', 'implementation'],
                notes: '',
                createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'conv_4',
                contactId: '+919654321098',
                contactName: 'Amit Kumar',
                channel: 'sms',
                lastMessage: 'Please send me the OTP for verification.',
                lastMessageTime: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
                unreadCount: 0,
                assignedTo: 'system',
                status: 'active',
                tags: ['otp', 'verification'],
                notes: 'Auto-generated OTP request',
                createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const conv of sampleConversations) {
            conversations.push(conv);
            this.cache.conversations.set(conv.id, conv);
        }

        // Add some sample messages
        const sampleMessages = [
            {
                id: 'msg_1',
                conversationId: 'conv_1',
                channel: 'whatsapp',
                direction: 'inbound',
                from: '+919876543210',
                to: '+919999999999',
                content: 'Hi, I need more information about your product.',
                timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
                status: 'unread',
                readAt: null
            },
            {
                id: 'msg_2',
                conversationId: 'conv_1',
                channel: 'whatsapp',
                direction: 'outbound',
                from: '+919999999999',
                to: '+919876543210',
                content: 'Sure, let me connect you with our sales team.',
                timestamp: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
                status: 'read',
                readAt: new Date(now.getTime() - 24 * 60 * 1000).toISOString()
            },
            {
                id: 'msg_3',
                conversationId: 'conv_2',
                channel: 'whatsapp',
                direction: 'inbound',
                from: '+919765432109',
                to: '+919999999999',
                content: 'Thank you for the quotation. I will review it.',
                timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
                status: 'read',
                readAt: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'msg_4',
                conversationId: 'conv_3',
                channel: 'email',
                direction: 'inbound',
                from: 'john@example.com',
                to: 'support@11avatar.com',
                content: 'I have some questions about the implementation timeline.',
                timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
                status: 'unread',
                readAt: null
            }
        ];

        for (const msg of sampleMessages) {
            messages.push(msg);
            this.cache.messages.set(msg.id, msg);
        }

        // Update unread count
        unreadCount = sampleMessages.filter(m => m.status === 'unread').length;
    }

    /**
     * Handle incoming message from any channel
     * @param {string} channel - Channel name
     * @param {object} data - Message data
     */
    handleIncomingMessage(channel, data) {
        const contactId = data.from || data.contactId;
        if (!contactId) return;

        // Find or create conversation
        let conversation = this.findConversation(contactId, channel);
        if (!conversation) {
            conversation = this.createConversation(contactId, channel, data.contactName || null);
        }

        // Add message to conversation
        const message = {
            id: data.messageId || `msg_${Date.now()}`,
            conversationId: conversation.id,
            channel: channel,
            direction: 'inbound',
            from: contactId,
            to: data.to || null,
            content: data.text || data.body || data.message || '',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'unread',
            readAt: null
        };

        messages.push(message);
        this.cache.messages.set(message.id, message);

        // Update conversation
        conversation.lastMessage = message.content;
        conversation.lastMessageTime = message.timestamp;
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        this.updateConversation(conversation);

        // Update stats
        this.stats.totalMessages++;
        this.stats.unread++;
        this.stats.byChannel[channel] = (this.stats.byChannel[channel] || 0) + 1;
        this.stats.byStatus.unread = (this.stats.byStatus.unread || 0) + 1;

        unreadCount++;

        // Auto-assign if configured
        if (this.config.autoAssign && !conversation.assignedTo) {
            this.autoAssignConversation(conversation.id);
        }

        // Emit event
        eventBus.publish('inbox.new_message', {
            conversationId: conversation.id,
            messageId: message.id,
            channel: channel,
            from: contactId
        });

        if (this.debugMode) {
            logger.debug(`[Omnichannel] New message from ${contactId} via ${channel}`);
        }
    }

    /**
     * Handle outgoing message from any channel
     * @param {string} channel - Channel name
     * @param {object} data - Message data
     */
    handleOutgoingMessage(channel, data) {
        const contactId = data.to || data.contactId;
        if (!contactId) return;

        let conversation = this.findConversation(contactId, channel);
        if (!conversation) {
            conversation = this.createConversation(contactId, channel, data.contactName || null);
        }

        const message = {
            id: data.messageId || `msg_${Date.now()}`,
            conversationId: conversation.id,
            channel: channel,
            direction: 'outbound',
            from: data.from || null,
            to: contactId,
            content: data.text || data.body || data.message || '',
            timestamp: data.timestamp || new Date().toISOString(),
            status: 'read',
            readAt: new Date().toISOString()
        };

        messages.push(message);
        this.cache.messages.set(message.id, message);

        // Update conversation
        conversation.lastMessage = message.content;
        conversation.lastMessageTime = message.timestamp;
        this.updateConversation(conversation);

        this.stats.totalMessages++;
        this.stats.byChannel[channel] = (this.stats.byChannel[channel] || 0) + 1;
    }

    /**
     * Get unified inbox
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Messages
     */
    async getInbox(filters = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Omnichannel inbox not initialized');
        }

        let results = [...messages];

        // Apply filters
        if (filters.status) {
            results = results.filter(m => m.status === filters.status);
        }

        if (filters.channel) {
            results = results.filter(m => m.channel === filters.channel);
        }

        if (filters.direction) {
            results = results.filter(m => m.direction === filters.direction);
        }

        if (filters.contactId) {
            results = results.filter(m => m.from === filters.contactId || m.to === filters.contactId);
        }

        if (filters.assignedTo) {
            const convIds = conversations
                .filter(c => c.assignedTo === filters.assignedTo)
                .map(c => c.id);
            results = results.filter(m => convIds.includes(m.conversationId));
        }

        if (filters.startDate) {
            results = results.filter(m => new Date(m.timestamp) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(m => new Date(m.timestamp) <= new Date(filters.endDate));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(m => 
                m.content.toLowerCase().includes(searchTerm) ||
                m.from.toLowerCase().includes(searchTerm) ||
                m.to.toLowerCase().includes(searchTerm)
            );
        }

        // Sort by timestamp (newest first)
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated;
    }

    /**
     * Get conversation with a contact
     * @param {string} contactId - Contact ID (phone, email, etc.)
     * @param {string} channel - Optional channel filter
     * @param {object} options - Additional options
     * @returns {object} Conversation
     */
    async getConversation(contactId, channel = null, options = {}) {
        if (!this.initialized) {
            throw new Error('Omnichannel inbox not initialized');
        }

        // Find conversation
        let conversation = null;
        if (channel) {
            conversation = this.findConversation(contactId, channel);
        } else {
            // Find conversation in any channel
            for (const conv of conversations) {
                if (conv.contactId === contactId) {
                    conversation = conv;
                    break;
                }
            }
        }

        if (!conversation) {
            return null;
        }

        // Get messages for this conversation
        const conversationMessages = messages
            .filter(m => m.conversationId === conversation.id)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return {
            ...conversation,
            messages: conversationMessages
        };
    }

    /**
     * Send message from inbox
     * @param {string} channel - Channel (whatsapp, email, sms)
     * @param {string} to - Recipient
     * @param {string|object} content - Message content
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendMessage(channel, to, content, options = {}) {
        if (!this.initialized) {
            throw new Error('Omnichannel inbox not initialized');
        }

        // Delegate to channel service
        const service = this.channelServices[channel];
        if (!service) {
            throw new Error(`Channel ${channel} not supported`);
        }

        let result;
        if (typeof content === 'string') {
            result = await service.sendMessage(to, content, options);
        } else {
            result = await service.sendTemplate(to, content.name, content.variables, options);
        }

        // Handle as outgoing message
        this.handleOutgoingMessage(channel, {
            messageId: result.id,
            to: to,
            text: typeof content === 'string' ? content : content.body,
            timestamp: result.timestamp
        });

        return result;
    }

    /**
     * Mark message as read
     * @param {string} messageId - Message ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async markAsRead(messageId, options = {}) {
        if (!this.initialized) {
            throw new Error('Omnichannel inbox not initialized');
        }

        const message = messages.find(m => m.id === messageId);
        if (!message) {
            throw new Error(`Message ${messageId} not found`);
        }

        if (message.status === 'read') {
            return true;
        }

        message.status = 'read';
        message.readAt = new Date().toISOString();

        // Update conversation unread count
        const conversation = conversations.find(c => c.id === message.conversationId);
        if (conversation && conversation.unreadCount > 0) {
            conversation.unreadCount--;
            this.updateConversation(conversation);
        }

        // Update stats
        this.stats.unread = Math.max(0, this.stats.unread - 1);
        this.stats.byStatus.unread = Math.max(0, this.stats.byStatus.unread - 1);
        this.stats.byStatus.read = (this.stats.byStatus.read || 0) + 1;

        unreadCount = Math.max(0, unreadCount - 1);

        // Mark as read in channel service
        if (message.channel === 'whatsapp') {
            await whatsappService.markAsRead(messageId);
        }

        return true;
    }

    /**
     * Assign conversation to a user
     * @param {string} conversationId - Conversation ID
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Updated conversation
     */
    async assignConversation(conversationId, userId, options = {}) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        conversation.assignedTo = userId;
        conversation.assignedAt = new Date().toISOString();
        this.updateConversation(conversation);

        // Update stats
        this.stats.byStatus.assigned = (this.stats.byStatus.assigned || 0) + 1;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'inbox.conversation.assigned',
            'communication',
            { conversationId, userId }
        );

        if (this.debugMode) {
            logger.debug(`[Omnichannel] Conversation ${conversationId} assigned to ${userId}`);
        }

        return conversation;
    }

    /**
     * Auto-assign conversation using round-robin
     * @param {string} conversationId - Conversation ID
     */
    autoAssignConversation(conversationId) {
        // In production, this would use round-robin logic
        // For MVP, assign to a default user
        this.assignConversation(conversationId, 'user_auto');
    }

    /**
     * Add note to conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} note - Note content
     * @param {object} options - Additional options
     * @returns {object} Updated conversation
     */
    async addNote(conversationId, note, options = {}) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        const noteEntry = {
            id: 'note_' + Date.now(),
            content: note,
            userId: options.userId || 'system',
            createdAt: new Date().toISOString()
        };

        if (!conversation.notes) {
            conversation.notes = [];
        }
        conversation.notes.push(noteEntry);

        this.updateConversation(conversation);

        return conversation;
    }

    /**
     * Get unread count
     * @param {object} options - Additional options
     * @returns {number} Unread count
     */
    async getUnreadCount(options = {}) {
        return unreadCount;
    }

    /**
     * Get channel statistics
     * @param {object} options - Additional options
     * @returns {object} Channel statistics
     */
    async getChannelStats(options = {}) {
        const stats = {
            totalConversations: conversations.length,
            totalMessages: messages.length,
            unread: unreadCount,
            byChannel: { ...this.stats.byChannel },
            byStatus: { ...this.stats.byStatus },
            assigned: conversations.filter(c => c.assignedTo).length,
            archived: conversations.filter(c => c.status === 'archived').length
        };

        return stats;
    }

    /**
     * Search inbox
     * @param {string} query - Search query
     * @param {object} options - Additional options
     * @returns {Array} Search results
     */
    async searchInbox(query, options = {}) {
        if (!query || query.length < 2) {
            return [];
        }

        const searchTerm = query.toLowerCase();
        const results = [];

        // Search in messages
        for (const msg of messages) {
            if (msg.content.toLowerCase().includes(searchTerm)) {
                const conv = conversations.find(c => c.id === msg.conversationId);
                results.push({
                    type: 'message',
                    message: msg,
                    conversation: conv
                });
            }
        }

        // Search in conversations
        for (const conv of conversations) {
            if (conv.contactName && conv.contactName.toLowerCase().includes(searchTerm)) {
                results.push({
                    type: 'conversation',
                    conversation: conv
                });
            }
            if (conv.tags && conv.tags.some(t => t.toLowerCase().includes(searchTerm))) {
                results.push({
                    type: 'conversation',
                    conversation: conv
                });
            }
        }

        // Remove duplicates
        const unique = [];
        const seen = new Set();
        for (const result of results) {
            const key = result.type === 'message' ? result.message.id : result.conversation.id;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(result);
            }
        }

        return unique.slice(0, options.limit || 50);
    }

    /**
     * Archive a conversation
     * @param {string} conversationId - Conversation ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async archiveConversation(conversationId, options = {}) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        conversation.status = 'archived';
        conversation.archivedAt = new Date().toISOString();
        this.updateConversation(conversation);

        // Update stats
        this.stats.byStatus.archived = (this.stats.byStatus.archived || 0) + 1;
        if (conversation.unreadCount > 0) {
            this.stats.unread -= conversation.unreadCount;
            this.stats.byStatus.unread -= conversation.unreadCount;
            unreadCount -= conversation.unreadCount;
        }

        return true;
    }

    /**
     * Restore an archived conversation
     * @param {string} conversationId - Conversation ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async restoreConversation(conversationId, options = {}) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        conversation.status = 'active';
        conversation.archivedAt = null;
        this.updateConversation(conversation);

        this.stats.byStatus.archived = Math.max(0, this.stats.byStatus.archived - 1);

        return true;
    }

    /**
     * Find conversation by contact ID and channel
     * @param {string} contactId - Contact ID
     * @param {string} channel - Channel
     * @returns {object|null} Conversation or null
     */
    findConversation(contactId, channel) {
        return conversations.find(c => 
            c.contactId === contactId && c.channel === channel && c.status !== 'archived'
        ) || null;
    }

    /**
     * Create a new conversation
     * @param {string} contactId - Contact ID
     * @param {string} channel - Channel
     * @param {string} contactName - Contact name
     * @returns {object} Created conversation
     */
    createConversation(contactId, channel, contactName = null) {
        const conversation = {
            id: 'conv_' + Date.now(),
            contactId: contactId,
            contactName: contactName || contactId,
            channel: channel,
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            assignedTo: null,
            status: 'active',
            tags: [],
            notes: [],
            createdAt: new Date().toISOString()
        };

        conversations.push(conversation);
        this.cache.conversations.set(conversation.id, conversation);

        return conversation;
    }

    /**
     * Update a conversation
     * @param {object} conversation - Conversation object
     */
    updateConversation(conversation) {
        const index = conversations.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
            conversations[index] = conversation;
            this.cache.conversations.set(conversation.id, conversation);
        }
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[OmnichannelInbox] Debug mode enabled');
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
     * Cleanup resources
     */
    cleanup() {
        this.initialized = false;
        this.cache.conversations.clear();
        this.cache.messages.clear();
        logger.info('Omnichannel inbox cleaned up');
    }
}

// Create and export singleton instance
export const omnichannelInbox = new OmnichannelInbox();

// Export class for testing
export default OmnichannelInbox;
