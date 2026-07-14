/**
 * ==========================================
 * FILE: taskRepository.js
 * MODULE: Data/Repositories
 * CODE: DAT-4
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Data access layer for Task entities.
 * Handles CRUD operations, assignments, reminders, and follow-ups.
 * Implements tenant isolation and caching.
 * 
 * DEPENDENCIES:
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * - changeTracker.js (for tracking changes)
 * 
 * FUNCTIONS:
 * - create(taskData): Create a new task
 * - findById(id): Find task by ID
 * - findAll(filters): Find all tasks with filters
 * - update(id, taskData): Update a task
 * - delete(id): Delete a task
 * - assign(id, userId): Assign task to user
 * - complete(id, data): Mark task as complete
 * - getTasksByAssignedTo(userId): Get tasks by assigned user
 * - getTasksByStatus(status): Get tasks by status
 * - getTasksByPriority(priority): Get tasks by priority
 * - getTasksByDueDate(date): Get tasks by due date
 * - getOverdueTasks(): Get overdue tasks
 * - getTasksForToday(): Get today's tasks
 * - getTaskStats(): Get task statistics
 * - addComment(id, comment): Add comment to task
 * - addChecklistItem(id, item): Add checklist item
 * - updateChecklistItem(id, itemId, status): Update checklist item
 * - getTaskTimeline(id): Get task timeline
 * 
 * USAGE EXAMPLE:
 * import { taskRepository } from './data/repositories/taskRepository.js';
 * 
 * // Create a new task
 * const task = await taskRepository.create({
 *   title: 'Follow up with client',
 *   description: 'Call to discuss proposal',
 *   assignedTo: 'user_123',
 *   priority: 'high',
 *   dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
 * });
 * 
 * // Complete a task
 * await taskRepository.complete('task_456', {
 *   notes: 'Client agreed to proceed',
 *   completedAt: new Date().toISOString()
 * });
 * ==========================================
 */

import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { changeTracker } from '../../core/audit/changeTracker.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let tasks = [];
let idCounter = 1000;

class TaskRepository {
    constructor() {
        // In-memory cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Indexes for faster lookups
        this.indexes = {
            byAssignedTo: new Map(),
            byStatus: new Map(),
            byPriority: new Map(),
            byDueDate: new Map(),
            byEntity: new Map(),
            byTenant: new Map()
        };
        
        // Configuration
        this.config = {
            enableCache: true,
            enableIndexes: true,
            defaultLimit: 100,
            maxLimit: 1000
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample data
        this.initSampleData();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const sampleTasks = [
            {
                id: 'task_1001',
                tenantId: 'tenant_1',
                title: 'Call Rahul Sharma',
                description: 'Follow up on ERP proposal. Discuss pricing and timeline.',
                type: 'call',
                priority: 'high',
                status: 'pending',
                assignedTo: 'user_123',
                assignedBy: 'user_456',
                dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                reminderAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                relatedTo: {
                    type: 'lead',
                    id: 'lead_1001'
                },
                checklist: [
                    { id: 'check_1', text: 'Confirm meeting time', completed: false },
                    { id: 'check_2', text: 'Prepare proposal summary', completed: true }
                ],
                comments: [
                    { id: 'comment_1', userId: 'user_456', content: 'Client is interested', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
                ],
                attachments: [],
                notes: 'Use the updated proposal template',
                completedAt: null,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'task_1002',
                tenantId: 'tenant_1',
                title: 'Send quotation to Priya Patel',
                description: 'Prepare and send quotation for healthcare management suite',
                type: 'email',
                priority: 'medium',
                status: 'pending',
                assignedTo: 'user_456',
                assignedBy: 'user_123',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                reminderAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                relatedTo: {
                    type: 'customer',
                    id: 'cust_1002'
                },
                checklist: [
                    { id: 'check_3', text: 'Get approval from manager', completed: false }
                ],
                comments: [],
                attachments: [],
                notes: 'Include volume discount',
                completedAt: null,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'task_1003',
                tenantId: 'tenant_1',
                title: 'Prepare monthly report',
                description: 'Compile sales data for monthly review meeting',
                type: 'task',
                priority: 'medium',
                status: 'in_progress',
                assignedTo: 'user_789',
                assignedBy: 'user_123',
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                reminderAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
                relatedTo: {
                    type: null,
                    id: null
                },
                checklist: [
                    { id: 'check_4', text: 'Collect data from all sources', completed: true },
                    { id: 'check_5', text: 'Create charts', completed: false },
                    { id: 'check_6', text: 'Write summary', completed: false }
                ],
                comments: [],
                attachments: [],
                notes: 'Include Q4 projections',
                completedAt: null,
                createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const task of sampleTasks) {
            tasks.push(task);
            this.updateIndexes(task);
        }
    }

    /**
     * Create a new task
     * @param {object} taskData - Task data
     * @param {object} options - Additional options
     * @returns {object} Created task
     */
    async create(taskData, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate task data
        this.validateTask(taskData);

        // Create task object
        const task = {
            id: this.generateId(),
            tenantId: tenantId,
            title: taskData.title,
            description: taskData.description || '',
            type: taskData.type || 'task',
            priority: taskData.priority || 'medium',
            status: 'pending',
            assignedTo: taskData.assignedTo || null,
            assignedBy: options.userId || 'system',
            dueDate: taskData.dueDate || null,
            reminderAt: taskData.reminderAt || null,
            relatedTo: taskData.relatedTo || { type: null, id: null },
            checklist: taskData.checklist || [],
            comments: [],
            attachments: [],
            notes: taskData.notes || '',
            completedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        tasks.push(task);
        this.updateIndexes(task);
        this.invalidateCache(task.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'task.created',
            'task',
            { taskId: task.id, title: task.title }
        );

        if (this.debugMode) {
            console.log('[TaskRepository] Created task:', task.id);
        }

        return { ...task };
    }

    /**
     * Find task by ID
     * @param {string} id - Task ID
     * @param {object} options - Additional options
     * @returns {object|null} Task or null
     */
    async findById(id, options = {}) {
        // Check cache first
        if (this.config.enableCache && this.cache.has(id)) {
            const cached = this.cache.get(id);
            const timestamp = this.cacheTimestamps.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(id);
            this.cacheTimestamps.delete(id);
        }

        const task = tasks.find(t => t.id === id);
        
        if (!task) {
            return null;
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (task.tenantId !== tenantId) {
            return null;
        }

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(id, task);
            this.cacheTimestamps.set(id, Date.now());
        }

        return { ...task };
    }

    /**
     * Find all tasks with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of tasks
     */
    async findAll(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = tasks.filter(task => task.tenantId === tenantId);

        // Apply filters
        if (filters.status) {
            results = results.filter(task => task.status === filters.status);
        }

        if (filters.priority) {
            results = results.filter(task => task.priority === filters.priority);
        }

        if (filters.type) {
            results = results.filter(task => task.type === filters.type);
        }

        if (filters.assignedTo) {
            results = results.filter(task => task.assignedTo === filters.assignedTo);
        }

        if (filters.assignedBy) {
            results = results.filter(task => task.assignedBy === filters.assignedBy);
        }

        if (filters.relatedType) {
            results = results.filter(task => task.relatedTo.type === filters.relatedType);
        }

        if (filters.relatedId) {
            results = results.filter(task => task.relatedTo.id === filters.relatedId);
        }

        if (filters.startDate) {
            results = results.filter(task => new Date(task.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(task => new Date(task.createdAt) <= new Date(filters.endDate));
        }

        if (filters.dueBefore) {
            results = results.filter(task => task.dueDate && new Date(task.dueDate) <= new Date(filters.dueBefore));
        }

        if (filters.dueAfter) {
            results = results.filter(task => task.dueDate && new Date(task.dueDate) >= new Date(filters.dueAfter));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(task =>
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.notes && task.notes.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'dueDate';
        const sortOrder = options.sortOrder || 'asc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'dueDate' || sortBy === 'reminderAt') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }
            
            if (sortOrder === 'asc') {
                return valA < valB ? -1 : 1;
            } else {
                return valA > valB ? -1 : 1;
            }
        });

        // Apply pagination
        const limit = Math.min(options.limit || this.config.defaultLimit, this.config.maxLimit);
        const offset = options.offset || 0;
        
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(task => ({ ...task }));
    }

    /**
     * Update a task
     * @param {string} id - Task ID
     * @param {object} taskData - Updated task data
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async update(id, taskData, options = {}) {
        const index = tasks.findIndex(t => t.id === id);
        
        if (index === -1) {
            throw new Error(`Task ${id} not found`);
        }

        const oldTask = { ...tasks[index] };
        const task = tasks[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (task.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Track changes
        const changedFields = {};
        for (const [key, value] of Object.entries(taskData)) {
            if (value !== undefined && task[key] !== value) {
                changedFields[key] = { old: task[key], new: value };
                task[key] = value;
            }
        }

        task.updatedAt = new Date().toISOString();

        // Update indexes
        this.updateIndexes(task);
        this.invalidateCache(id);

        // Track change
        await changeTracker.trackChange(
            'task',
            id,
            oldTask,
            task,
            options.userId || 'system'
        );

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'task.updated',
            'task',
            { taskId: id, changes: changedFields }
        );

        if (this.debugMode) {
            console.log('[TaskRepository] Updated task:', id);
        }

        return { ...task };
    }

    /**
     * Delete a task
     * @param {string} id - Task ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async delete(id, options = {}) {
        const index = tasks.findIndex(t => t.id === id);
        
        if (index === -1) {
            throw new Error(`Task ${id} not found`);
        }

        const task = tasks[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (task.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Remove from storage
        tasks.splice(index, 1);

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'task.deleted',
            'task',
            { taskId: id, title: task.title }
        );

        if (this.debugMode) {
            console.log('[TaskRepository] Deleted task:', id);
        }

        return true;
    }

    /**
     * Assign task to a user
     * @param {string} id - Task ID
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async assign(id, userId, options = {}) {
        return await this.update(id, { assignedTo: userId }, options);
    }

    /**
     * Mark task as complete
     * @param {string} id - Task ID
     * @param {object} data - Completion data
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async complete(id, data = {}, options = {}) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }

        // Check if already completed
        if (task.status === 'completed') {
            return task;
        }

        const updateData = {
            status: 'completed',
            completedAt: data.completedAt || new Date().toISOString(),
            notes: data.notes ? `${task.notes}\n\nCompletion notes: ${data.notes}` : task.notes
        };

        // Update all checklist items to completed
        if (task.checklist && task.checklist.length > 0) {
            const checklist = task.checklist.map(item => ({
                ...item,
                completed: true
            }));
            updateData.checklist = checklist;
        }

        const updated = await this.update(id, updateData, options);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'task.completed',
            'task',
            { taskId: id, title: task.title }
        );

        return updated;
    }

    /**
     * Get tasks by assigned user
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} List of tasks
     */
    async getTasksByAssignedTo(userId, options = {}) {
        return await this.findAll({ assignedTo: userId }, options);
    }

    /**
     * Get tasks by status
     * @param {string} status - Task status
     * @param {object} options - Additional options
     * @returns {Array} List of tasks
     */
    async getTasksByStatus(status, options = {}) {
        return await this.findAll({ status }, options);
    }

    /**
     * Get tasks by priority
     * @param {string} priority - Task priority
     * @param {object} options - Additional options
     * @returns {Array} List of tasks
     */
    async getTasksByPriority(priority, options = {}) {
        return await this.findAll({ priority }, options);
    }

    /**
     * Get tasks by due date
     * @param {string} date - Due date (ISO string)
     * @param {object} options - Additional options
     * @returns {Array} List of tasks
     */
    async getTasksByDueDate(date, options = {}) {
        const dueDate = new Date(date);
        const startOfDay = new Date(dueDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dueDate);
        endOfDay.setHours(23, 59, 59, 999);

        return await this.findAll({
            dueAfter: startOfDay.toISOString(),
            dueBefore: endOfDay.toISOString()
        }, options);
    }

    /**
     * Get overdue tasks
     * @param {object} options - Additional options
     * @returns {Array} List of overdue tasks
     */
    async getOverdueTasks(options = {}) {
        const now = new Date().toISOString();
        return await this.findAll({
            status: { $ne: 'completed' },
            dueBefore: now
        }, options);
    }

    /**
     * Get today's tasks
     * @param {object} options - Additional options
     * @returns {Array} List of today's tasks
     */
    async getTasksForToday(options = {}) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        return await this.findAll({
            status: { $ne: 'completed' },
            dueAfter: startOfDay.toISOString(),
            dueBefore: endOfDay.toISOString()
        }, options);
    }

    /**
     * Get task statistics
     * @param {object} options - Additional options
     * @returns {object} Task statistics
     */
    async getTaskStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantTasks = tasks.filter(t => t.tenantId === tenantId);

        const stats = {
            total: tenantTasks.length,
            byStatus: {},
            byPriority: {},
            byType: {},
            byAssignedTo: {},
            completed: 0,
            pending: 0,
            inProgress: 0,
            overdue: 0,
            dueToday: 0,
            completionRate: 0
        };

        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        for (const task of tenantTasks) {
            // Count by status
            stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
            
            // Count by priority
            stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
            
            // Count by type
            stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
            
            // Count by assigned user
            if (task.assignedTo) {
                stats.byAssignedTo[task.assignedTo] = (stats.byAssignedTo[task.assignedTo] || 0) + 1;
            }

            // Status counts
            if (task.status === 'completed') {
                stats.completed++;
            } else if (task.status === 'pending') {
                stats.pending++;
            } else if (task.status === 'in_progress') {
                stats.inProgress++;
            }

            // Overdue check
            if (task.status !== 'completed' && task.dueDate) {
                const dueDate = new Date(task.dueDate);
                if (dueDate < now) {
                    stats.overdue++;
                }
                if (dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
                    stats.dueToday++;
                }
            }
        }

        // Calculate completion rate
        const total = stats.total;
        stats.completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

        return stats;
    }

    /**
     * Add comment to task
     * @param {string} id - Task ID
     * @param {object} comment - Comment data
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async addComment(id, comment, options = {}) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }

        const comments = [...task.comments];
        comments.push({
            id: 'comment_' + Date.now(),
            userId: options.userId || 'system',
            content: comment.content || comment,
            createdAt: new Date().toISOString()
        });

        return await this.update(id, { comments }, options);
    }

    /**
     * Add checklist item to task
     * @param {string} id - Task ID
     * @param {string} item - Checklist item text
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async addChecklistItem(id, item, options = {}) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }

        const checklist = [...task.checklist];
        checklist.push({
            id: 'check_' + Date.now(),
            text: item,
            completed: false
        });

        return await this.update(id, { checklist }, options);
    }

    /**
     * Update checklist item status
     * @param {string} id - Task ID
     * @param {string} itemId - Checklist item ID
     * @param {boolean} status - Completed status
     * @param {object} options - Additional options
     * @returns {object} Updated task
     */
    async updateChecklistItem(id, itemId, status, options = {}) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }

        const checklist = task.checklist.map(item => {
            if (item.id === itemId) {
                return { ...item, completed: status };
            }
            return item;
        });

        return await this.update(id, { checklist }, options);
    }

    /**
     * Get task timeline
     * @param {string} id - Task ID
     * @param {object} options - Additional options
     * @returns {Array} Task timeline
     */
    async getTaskTimeline(id, options = {}) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }

        // In production, this would fetch from activity service
        // For MVP, return task history from change tracker
        const history = await changeTracker.getChangeHistory('task', id);
        return history;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'task_' + idCounter;
    }

    /**
     * Validate task data
     * @param {object} taskData - Task data to validate
     * @throws {Error} If validation fails
     */
    validateTask(taskData) {
        if (!taskData.title) {
            throw new Error('Task title is required');
        }

        if (taskData.dueDate && isNaN(new Date(taskData.dueDate).getTime())) {
            throw new Error('Invalid due date format');
        }

        if (taskData.reminderAt && isNaN(new Date(taskData.reminderAt).getTime())) {
            throw new Error('Invalid reminder date format');
        }
    }

    /**
     * Update indexes for a task
     * @param {object} task - Task object
     */
    updateIndexes(task) {
        // AssignedTo index
        if (task.assignedTo) {
            if (!this.indexes.byAssignedTo.has(task.assignedTo)) {
                this.indexes.byAssignedTo.set(task.assignedTo, new Set());
            }
            this.indexes.byAssignedTo.get(task.assignedTo).add(task.id);
        }

        // Status index
        if (task.status) {
            if (!this.indexes.byStatus.has(task.status)) {
                this.indexes.byStatus.set(task.status, new Set());
            }
            this.indexes.byStatus.get(task.status).add(task.id);
        }

        // Priority index
        if (task.priority) {
            if (!this.indexes.byPriority.has(task.priority)) {
                this.indexes.byPriority.set(task.priority, new Set());
            }
            this.indexes.byPriority.get(task.priority).add(task.id);
        }

        // DueDate index
        if (task.dueDate) {
            const dateKey = new Date(task.dueDate).toDateString();
            if (!this.indexes.byDueDate.has(dateKey)) {
                this.indexes.byDueDate.set(dateKey, new Set());
            }
            this.indexes.byDueDate.get(dateKey).add(task.id);
        }

        // Related entity index
        if (task.relatedTo && task.relatedTo.id) {
            const key = `${task.relatedTo.type}:${task.relatedTo.id}`;
            if (!this.indexes.byEntity.has(key)) {
                this.indexes.byEntity.set(key, new Set());
            }
            this.indexes.byEntity.get(key).add(task.id);
        }

        // Tenant index
        if (task.tenantId) {
            if (!this.indexes.byTenant.has(task.tenantId)) {
                this.indexes.byTenant.set(task.tenantId, new Set());
            }
            this.indexes.byTenant.get(task.tenantId).add(task.id);
        }
    }

    /**
     * Invalidate cache for a task
     * @param {string} id - Task ID
     */
    invalidateCache(id) {
        this.cache.delete(id);
        this.cacheTimestamps.delete(id);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[TaskRepository] Debug mode enabled');
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
}

// Create and export singleton instance
export const taskRepository = new TaskRepository();

// Export class for testing
export default TaskRepository;
