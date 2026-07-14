/**
 * ==========================================
 * FILE: eventBus.js
 * MODULE: Core/Events
 * CODE: EVT-1
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * ==========================================
 * 
 * DESCRIPTION:
 * Central event bus for decoupled communication between modules.
 * Implements publish-subscribe pattern with async support.
 * 
 * DEPENDENCIES:
 * - None (standalone)
 * 
 * FUNCTIONS:
 * - subscribe(event, handler): Register event handler
 * - unsubscribe(event, handler): Remove event handler
 * - publish(event, data): Emit event synchronously
 * - publishAsync(event, data): Emit event asynchronously
 * - once(event, handler): One-time subscription
 * - getSubscribers(event): List all subscribers
 * - clear(): Remove all subscriptions
 * 
 * USAGE EXAMPLE:
 * import { eventBus } from './core/events/eventBus.js';
 * 
 * eventBus.subscribe('lead.created', (data) => {
 *   console.log('New lead:', data);
 * });
 * 
 * eventBus.publish('lead.created', { id: '123', name: 'John' });
 * ==========================================
 */

class EventBus {
    constructor() {
        // Map of event names to arrays of subscriber functions
        this.subscribers = new Map();
        
        // Map for once-only subscribers
        this.onceSubscribers = new Map();
        
        // Queue for async events
        this.asyncQueue = [];
        
        // Processing flag for async queue
        this.isProcessing = false;
        
        // Maximum queue size to prevent memory issues
        this.maxQueueSize = 1000;
        
        // Debug mode flag
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, handler) {
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }
        
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }

        this.subscribers.get(event).push(handler);

        if (this.debugMode) {
            console.log(`[EventBus] Subscribed to: ${event}`);
        }

        // Return unsubscribe function
        return () => this.unsubscribe(event, handler);
    }

    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    once(event, handler) {
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }
        
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        if (!this.onceSubscribers.has(event)) {
            this.onceSubscribers.set(event, []);
        }

        this.onceSubscribers.get(event).push(handler);

        if (this.debugMode) {
            console.log(`[EventBus] Subscribed once to: ${event}`);
        }

        return () => this.unsubscribeOnce(event, handler);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     * @returns {boolean} Whether handler was removed
     */
    unsubscribe(event, handler) {
        if (!this.subscribers.has(event)) {
            return false;
        }

        const handlers = this.subscribers.get(event);
        const index = handlers.indexOf(handler);
        
        if (index === -1) {
            return false;
        }

        handlers.splice(index, 1);

        if (handlers.length === 0) {
            this.subscribers.delete(event);
        }

        if (this.debugMode) {
            console.log(`[EventBus] Unsubscribed from: ${event}`);
        }

        return true;
    }

    /**
     * Unsubscribe from a once-only event
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     * @returns {boolean} Whether handler was removed
     */
    unsubscribeOnce(event, handler) {
        if (!this.onceSubscribers.has(event)) {
            return false;
        }

        const handlers = this.onceSubscribers.get(event);
        const index = handlers.indexOf(handler);
        
        if (index === -1) {
            return false;
        }

        handlers.splice(index, 1);

        if (handlers.length === 0) {
            this.onceSubscribers.delete(event);
        }

        return true;
    }

    /**
     * Publish an event synchronously
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @returns {Array} Results from all handlers
     */
    publish(event, data = null) {
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }

        if (this.debugMode) {
            console.log(`[EventBus] Publishing: ${event}`, data);
        }

        const results = [];

        // Process regular subscribers
        if (this.subscribers.has(event)) {
            const handlers = this.subscribers.get(event);
            for (const handler of handlers) {
                try {
                    const result = handler(data, event);
                    results.push(result);
                } catch (error) {
                    console.error(`[EventBus] Error in handler for ${event}:`, error);
                    results.push({ error: error.message });
                }
            }
        }

        // Process once-only subscribers
        if (this.onceSubscribers.has(event)) {
            const handlers = this.onceSubscribers.get(event);
            for (const handler of handlers) {
                try {
                    const result = handler(data, event);
                    results.push(result);
                } catch (error) {
                    console.error(`[EventBus] Error in once-handler for ${event}:`, error);
                    results.push({ error: error.message });
                }
            }
            // Remove all once handlers after execution
            this.onceSubscribers.delete(event);
        }

        return results;
    }

    /**
     * Publish an event asynchronously
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @returns {Promise<void>}
     */
    async publishAsync(event, data = null) {
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }

        // Add to queue
        this.asyncQueue.push({ event, data });

        if (this.debugMode) {
            console.log(`[EventBus] Queued async: ${event}`);
        }

        // Process queue if not already processing
        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    /**
     * Process the async event queue
     * @returns {Promise<void>}
     */
    async processQueue() {
        if (this.isProcessing) {
            return;
        }

        if (this.asyncQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.asyncQueue.length > 0) {
                const { event, data } = this.asyncQueue.shift();
                
                if (this.debugMode) {
                    console.log(`[EventBus] Processing async: ${event}`);
                }

                // Process regular subscribers
                if (this.subscribers.has(event)) {
                    const handlers = this.subscribers.get(event);
                    const promises = handlers.map(handler => 
                        Promise.resolve(handler(data, event)).catch(error => {
                            console.error(`[EventBus] Error in async handler for ${event}:`, error);
                        })
                    );
                    await Promise.all(promises);
                }

                // Process once-only subscribers
                if (this.onceSubscribers.has(event)) {
                    const handlers = this.onceSubscribers.get(event);
                    const promises = handlers.map(handler => 
                        Promise.resolve(handler(data, event)).catch(error => {
                            console.error(`[EventBus] Error in async once-handler for ${event}:`, error);
                        })
                    );
                    await Promise.all(promises);
                    this.onceSubscribers.delete(event);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get all subscribers for an event
     * @param {string} event - Event name
     * @returns {Array} List of handlers
     */
    getSubscribers(event) {
        const regular = this.subscribers.get(event) || [];
        const once = this.onceSubscribers.get(event) || [];
        return [...regular, ...once];
    }

    /**
     * Get count of subscribers for an event
     * @param {string} event - Event name
     * @returns {number} Number of subscribers
     */
    subscriberCount(event) {
        return this.getSubscribers(event).length;
    }

    /**
     * Check if an event has subscribers
     * @param {string} event - Event name
     * @returns {boolean} Whether event has subscribers
     */
    hasSubscribers(event) {
        return this.subscribers.has(event) || this.onceSubscribers.has(event);
    }

    /**
     * Get all registered events
     * @returns {Array} List of event names
     */
    getEvents() {
        const events = new Set([
            ...this.subscribers.keys(),
            ...this.onceSubscribers.keys()
        ]);
        return Array.from(events);
    }

    /**
     * Clear all subscriptions
     */
    clear() {
        this.subscribers.clear();
        this.onceSubscribers.clear();
        this.asyncQueue = [];
        this.isProcessing = false;

        if (this.debugMode) {
            console.log('[EventBus] All subscriptions cleared');
        }
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[EventBus] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Get queue size
     * @returns {number} Number of queued events
     */
    getQueueSize() {
        return this.asyncQueue.length;
    }

    /**
     * Flush the async queue
     * @returns {Promise<void>}
     */
    async flushQueue() {
        await this.processQueue();
    }

    /**
     * Clear the async queue
     */
    clearQueue() {
        this.asyncQueue = [];
        if (this.debugMode) {
            console.log('[EventBus] Queue cleared');
        }
    }

    /**
     * Wait for all events to be processed
     * @param {string} event - Optional event name
     * @returns {Promise<void>}
     */
    async waitFor(event = null) {
        if (event) {
            // Wait for specific event to be processed
            return new Promise((resolve) => {
                const handler = () => {
                    resolve();
                };
                this.once(event, handler);
            });
        } else {
            // Wait for all pending events
            if (this.asyncQueue.length === 0 && !this.isProcessing) {
                return;
            }
            return new Promise((resolve) => {
                const checkQueue = () => {
                    if (this.asyncQueue.length === 0 && !this.isProcessing) {
                        resolve();
                    } else {
                        setTimeout(checkQueue, 100);
                    }
                };
                checkQueue();
            });
        }
    }
}

// Create and export singleton instance
export const eventBus = new EventBus();

// Export class for testing
export default EventBus;
