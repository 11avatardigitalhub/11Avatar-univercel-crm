/**
 * ==========================================
 * FILE: autoBackup.js
 * MODULE: Core/Backup
 * CODE: BACK-2
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Automated backup scheduler for the CRM.
 * Handles daily, weekly, monthly, and custom scheduled backups.
 * Works with backupManager for actual backup execution.
 * 
 * DEPENDENCIES:
 * - backupManager.js (for backup execution)
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * 
 * FUNCTIONS:
 * - startDailyBackup(time): Start daily backup schedule
 * - startWeeklyBackup(day, time): Start weekly backup schedule
 * - startMonthlyBackup(day, time): Start monthly backup schedule
 * - startCustomSchedule(cronExpression, options): Start custom schedule
 * - stopSchedule(scheduleId): Stop a backup schedule
 * - getSchedules(): Get all active schedules
 * - getScheduleStatus(scheduleId): Get schedule status
 * - updateSchedule(scheduleId, options): Update schedule
 * - runNow(scheduleId): Run schedule immediately
 * - getLastBackup(scheduleId): Get last backup details
 * - getNextBackup(scheduleId): Get next backup time
 * - pauseSchedule(scheduleId): Pause schedule
 * - resumeSchedule(scheduleId): Resume schedule
 * 
 * USAGE EXAMPLE:
 * import { autoBackup } from './core/backup/autoBackup.js';
 * 
 * // Start daily backup at midnight
 * autoBackup.startDailyBackup('00:00');
 * 
 * // Start weekly backup on Sunday at 2 AM
 * autoBackup.startWeeklyBackup('sunday', '02:00');
 * 
 * // Start monthly backup on 1st at 3 AM
 * autoBackup.startMonthlyBackup('1', '03:00');
 * ==========================================
 */

import { backupManager } from './backupManager.js';
import { tenantIsolation } from '../multitenancy/tenantIsolation.js';
import { auditLogger } from '../audit/auditLogger.js';

class AutoBackup {
    constructor() {
        // Schedule storage
        this.schedules = new Map();
        this.scheduleIdCounter = 1000;
        
        // Running timers
        this.timers = new Map();
        
        // Configuration
        this.config = {
            defaultTime: '00:00',
            timezone: 'Asia/Kolkata',
            retryOnFailure: true,
            maxRetries: 3,
            notifyOnCompletion: true,
            notifyOnFailure: true
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize default schedules
        this.initDefaultSchedules();
    }

    /**
     * Initialize default backup schedules
     */
    initDefaultSchedules() {
        // Daily backup at midnight
        this.startDailyBackup('00:00', {
            id: 'daily_backup',
            enabled: true,
            description: 'Daily automatic backup'
        });

        // Weekly backup on Sunday at 2 AM
        this.startWeeklyBackup('sunday', '02:00', {
            id: 'weekly_backup',
            enabled: true,
            description: 'Weekly automatic backup'
        });

        // Monthly backup on 1st at 3 AM
        this.startMonthlyBackup('1', '03:00', {
            id: 'monthly_backup',
            enabled: true,
            description: 'Monthly automatic backup'
        });

        if (this.debugMode) {
            console.log('[AutoBackup] Default schedules initialized');
        }
    }

    /**
     * Start daily backup schedule
     * @param {string} time - Time in HH:MM format (24-hour)
     * @param {object} options - Additional options
     * @returns {string} Schedule ID
     */
    startDailyBackup(time = this.config.defaultTime, options = {}) {
        const scheduleId = options.id || this.generateScheduleId();
        
        const schedule = {
            id: scheduleId,
            type: 'daily',
            time: time,
            enabled: options.enabled !== undefined ? options.enabled : true,
            description: options.description || `Daily backup at ${time}`,
            backupOptions: options.backupOptions || { type: 'full' },
            lastRun: null,
            nextRun: this.calculateNextDailyRun(time),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.schedules.set(scheduleId, schedule);
        this.scheduleTimer(scheduleId);

        if (this.debugMode) {
            console.log(`[AutoBackup] Started daily backup schedule: ${scheduleId}`);
        }

        return scheduleId;
    }

    /**
     * Start weekly backup schedule
     * @param {string} day - Day of week (monday, tuesday, etc.)
     * @param {string} time - Time in HH:MM format
     * @param {object} options - Additional options
     * @returns {string} Schedule ID
     */
    startWeeklyBackup(day, time = this.config.defaultTime, options = {}) {
        const scheduleId = options.id || this.generateScheduleId();
        
        const schedule = {
            id: scheduleId,
            type: 'weekly',
            day: day.toLowerCase(),
            time: time,
            enabled: options.enabled !== undefined ? options.enabled : true,
            description: options.description || `Weekly backup on ${day} at ${time}`,
            backupOptions: options.backupOptions || { type: 'full' },
            lastRun: null,
            nextRun: this.calculateNextWeeklyRun(day, time),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.schedules.set(scheduleId, schedule);
        this.scheduleTimer(scheduleId);

        if (this.debugMode) {
            console.log(`[AutoBackup] Started weekly backup schedule: ${scheduleId}`);
        }

        return scheduleId;
    }

    /**
     * Start monthly backup schedule
     * @param {string} day - Day of month (1-31)
     * @param {string} time - Time in HH:MM format
     * @param {object} options - Additional options
     * @returns {string} Schedule ID
     */
    startMonthlyBackup(day, time = this.config.defaultTime, options = {}) {
        const scheduleId = options.id || this.generateScheduleId();
        
        const schedule = {
            id: scheduleId,
            type: 'monthly',
            day: parseInt(day),
            time: time,
            enabled: options.enabled !== undefined ? options.enabled : true,
            description: options.description || `Monthly backup on ${day} at ${time}`,
            backupOptions: options.backupOptions || { type: 'full' },
            lastRun: null,
            nextRun: this.calculateNextMonthlyRun(day, time),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.schedules.set(scheduleId, schedule);
        this.scheduleTimer(scheduleId);

        if (this.debugMode) {
            console.log(`[AutoBackup] Started monthly backup schedule: ${scheduleId}`);
        }

        return scheduleId;
    }

    /**
     * Start custom schedule with cron expression
     * @param {string} cronExpression - Cron expression
     * @param {object} options - Additional options
     * @returns {string} Schedule ID
     */
    startCustomSchedule(cronExpression, options = {}) {
        const scheduleId = options.id || this.generateScheduleId();
        
        const schedule = {
            id: scheduleId,
            type: 'custom',
            cron: cronExpression,
            enabled: options.enabled !== undefined ? options.enabled : true,
            description: options.description || `Custom backup schedule: ${cronExpression}`,
            backupOptions: options.backupOptions || { type: 'full' },
            lastRun: null,
            nextRun: this.calculateNextCustomRun(cronExpression),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.schedules.set(scheduleId, schedule);
        this.scheduleTimer(scheduleId);

        if (this.debugMode) {
            console.log(`[AutoBackup] Started custom backup schedule: ${scheduleId}`);
        }

        return scheduleId;
    }

    /**
     * Stop a backup schedule
     * @param {string} scheduleId - Schedule ID
     * @returns {boolean} Success status
     */
    stopSchedule(scheduleId) {
        if (!this.schedules.has(scheduleId)) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        const schedule = this.schedules.get(scheduleId);
        schedule.enabled = false;
        schedule.updatedAt = new Date().toISOString();
        this.schedules.set(scheduleId, schedule);

        // Clear timer
        if (this.timers.has(scheduleId)) {
            clearInterval(this.timers.get(scheduleId));
            this.timers.delete(scheduleId);
        }

        if (this.debugMode) {
            console.log(`[AutoBackup] Stopped schedule: ${scheduleId}`);
        }

        return true;
    }

    /**
     * Schedule timer for a backup
     * @param {string} scheduleId - Schedule ID
     */
    scheduleTimer(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule || !schedule.enabled) {
            return;
        }

        // Clear existing timer if any
        if (this.timers.has(scheduleId)) {
            clearInterval(this.timers.get(scheduleId));
            this.timers.delete(scheduleId);
        }

        // Check every minute
        const timer = setInterval(() => {
            this.checkSchedule(scheduleId);
        }, 60000);

        this.timers.set(scheduleId, timer);
    }

    /**
     * Check if a schedule should run
     * @param {string} scheduleId - Schedule ID
     */
    async checkSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule || !schedule.enabled) {
            return;
        }

        const now = new Date();
        const nextRun = new Date(schedule.nextRun);

        if (now >= nextRun) {
            await this.executeBackup(scheduleId);
            
            // Update next run
            schedule.lastRun = now.toISOString();
            schedule.nextRun = this.calculateNextRun(schedule);
            schedule.updatedAt = new Date().toISOString();
            this.schedules.set(scheduleId, schedule);
        }
    }

    /**
     * Execute a backup for a schedule
     * @param {string} scheduleId - Schedule ID
     * @returns {object} Backup result
     */
    async executeBackup(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        try {
            if (this.debugMode) {
                console.log(`[AutoBackup] Executing backup for schedule: ${scheduleId}`);
            }

            // Create backup
            const backup = await backupManager.createBackup({
                type: schedule.backupOptions.type || 'full',
                createdBy: 'system_auto_backup',
                include: schedule.backupOptions.include || ['all'],
                metadata: {
                    scheduleId: scheduleId,
                    scheduleType: schedule.type,
                    scheduledTime: schedule.nextRun
                }
            });

            // Log to audit
            await auditLogger.log(
                'system',
                'auto_backup.executed',
                'backup',
                { 
                    scheduleId: scheduleId, 
                    backupId: backup.id,
                    type: schedule.type
                }
            );

            return backup;
        } catch (error) {
            console.error(`[AutoBackup] Backup failed for schedule ${scheduleId}:`, error);

            // Retry logic
            if (this.config.retryOnFailure) {
                let retries = 0;
                while (retries < this.config.maxRetries) {
                    retries++;
                    if (this.debugMode) {
                        console.log(`[AutoBackup] Retry ${retries}/${this.config.maxRetries} for schedule ${scheduleId}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
                    try {
                        const backup = await backupManager.createBackup({
                            type: schedule.backupOptions.type || 'full',
                            createdBy: 'system_auto_backup_retry',
                            include: schedule.backupOptions.include || ['all'],
                            metadata: {
                                scheduleId: scheduleId,
                                scheduleType: schedule.type,
                                retryCount: retries,
                                originalScheduledTime: schedule.nextRun
                            }
                        });
                        return backup;
                    } catch (retryError) {
                        // Continue retrying
                    }
                }
            }

            // Log failure
            await auditLogger.log(
                'system',
                'auto_backup.failed',
                'backup',
                { 
                    scheduleId: scheduleId, 
                    error: error.message,
                    type: schedule.type
                }
            );

            throw error;
        }
    }

    /**
     * Get all schedules
     * @param {object} options - Additional options
     * @returns {Array} List of schedules
     */
    getSchedules(options = {}) {
        const results = [];
        for (const [id, schedule] of this.schedules) {
            if (options.includeDisabled || schedule.enabled) {
                results.push({ ...schedule });
            }
        }
        return results;
    }

    /**
     * Get schedule status
     * @param {string} scheduleId - Schedule ID
     * @returns {object} Schedule status
     */
    getScheduleStatus(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        return {
            id: schedule.id,
            enabled: schedule.enabled,
            type: schedule.type,
            lastRun: schedule.lastRun,
            nextRun: schedule.nextRun,
            status: schedule.enabled ? 'active' : 'paused',
            timerExists: this.timers.has(scheduleId)
        };
    }

    /**
     * Update schedule
     * @param {string} scheduleId - Schedule ID
     * @param {object} options - Updated options
     * @returns {object} Updated schedule
     */
    updateSchedule(scheduleId, options = {}) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        // Update fields
        if (options.time) schedule.time = options.time;
        if (options.day) schedule.day = options.day;
        if (options.cron) schedule.cron = options.cron;
        if (options.description) schedule.description = options.description;
        if (options.backupOptions) schedule.backupOptions = options.backupOptions;
        if (options.enabled !== undefined) schedule.enabled = options.enabled;

        // Recalculate next run if schedule changed
        if (options.time || options.day || options.cron) {
            schedule.nextRun = this.calculateNextRun(schedule);
        }

        schedule.updatedAt = new Date().toISOString();
        this.schedules.set(scheduleId, schedule);

        // Restart timer if enabled
        if (schedule.enabled) {
            this.scheduleTimer(scheduleId);
        }

        if (this.debugMode) {
            console.log(`[AutoBackup] Updated schedule: ${scheduleId}`);
        }

        return { ...schedule };
    }

    /**
     * Run schedule immediately
     * @param {string} scheduleId - Schedule ID
     * @returns {object} Backup result
     */
    async runNow(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        if (this.debugMode) {
            console.log(`[AutoBackup] Running schedule immediately: ${scheduleId}`);
        }

        return await this.executeBackup(scheduleId);
    }

    /**
     * Get last backup details
     * @param {string} scheduleId - Schedule ID
     * @returns {object|null} Last backup details
     */
    getLastBackup(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        if (!schedule.lastRun) {
            return null;
        }

        return {
            scheduleId: schedule.id,
            lastRun: schedule.lastRun,
            type: schedule.type
        };
    }

    /**
     * Get next backup time
     * @param {string} scheduleId - Schedule ID
     * @returns {string|null} Next backup time
     */
    getNextBackup(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        return schedule.nextRun;
    }

    /**
     * Pause schedule
     * @param {string} scheduleId - Schedule ID
     * @returns {boolean} Success status
     */
    pauseSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        schedule.enabled = false;
        schedule.updatedAt = new Date().toISOString();
        this.schedules.set(scheduleId, schedule);

        // Clear timer
        if (this.timers.has(scheduleId)) {
            clearInterval(this.timers.get(scheduleId));
            this.timers.delete(scheduleId);
        }

        if (this.debugMode) {
            console.log(`[AutoBackup] Paused schedule: ${scheduleId}`);
        }

        return true;
    }

    /**
     * Resume schedule
     * @param {string} scheduleId - Schedule ID
     * @returns {boolean} Success status
     */
    resumeSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        schedule.enabled = true;
        schedule.updatedAt = new Date().toISOString();
        // Recalculate next run
        schedule.nextRun = this.calculateNextRun(schedule);
        this.schedules.set(scheduleId, schedule);

        // Restart timer
        this.scheduleTimer(scheduleId);

        if (this.debugMode) {
            console.log(`[AutoBackup] Resumed schedule: ${scheduleId}`);
        }

        return true;
    }

    /**
     * Calculate next daily run time
     * @param {string} time - Time in HH:MM format
     * @returns {string} Next run time (ISO string)
     */
    calculateNextDailyRun(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        return next.toISOString();
    }

    /**
     * Calculate next weekly run time
     * @param {string} day - Day of week
     * @param {string} time - Time in HH:MM format
     * @returns {string} Next run time (ISO string)
     */
    calculateNextWeeklyRun(day, time) {
        const dayMap = {
            sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
            thursday: 4, friday: 5, saturday: 6
        };
        
        const targetDay = dayMap[day.toLowerCase()];
        if (targetDay === undefined) {
            throw new Error(`Invalid day: ${day}`);
        }

        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || (daysToAdd === 0 && next <= now)) {
            daysToAdd += 7;
        }
        
        next.setDate(next.getDate() + daysToAdd);
        return next.toISOString();
    }

    /**
     * Calculate next monthly run time
     * @param {number} day - Day of month (1-31)
     * @param {string} time - Time in HH:MM format
     * @returns {string} Next run time (ISO string)
     */
    calculateNextMonthlyRun(day, time) {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        
        const targetDay = Math.min(day, this.getDaysInMonth(now.getFullYear(), now.getMonth()));
        
        if (now.getDate() < targetDay || (now.getDate() === targetDay && now < next)) {
            next.setDate(targetDay);
        } else {
            next.setMonth(next.getMonth() + 1);
            const daysInMonth = this.getDaysInMonth(next.getFullYear(), next.getMonth());
            next.setDate(Math.min(targetDay, daysInMonth));
        }
        
        return next.toISOString();
    }

    /**
     * Calculate next custom run time
     * @param {string} cronExpression - Cron expression
     * @returns {string} Next run time (ISO string)
     */
    calculateNextCustomRun(cronExpression) {
        // For MVP, simple implementation
        // In production, use cron-parser library
        const now = new Date();
        const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return next.toISOString();
    }

    /**
     * Calculate next run time based on schedule type
     * @param {object} schedule - Schedule object
     * @returns {string} Next run time (ISO string)
     */
    calculateNextRun(schedule) {
        switch (schedule.type) {
            case 'daily':
                return this.calculateNextDailyRun(schedule.time);
            case 'weekly':
                return this.calculateNextWeeklyRun(schedule.day, schedule.time);
            case 'monthly':
                return this.calculateNextMonthlyRun(schedule.day, schedule.time);
            case 'custom':
                return this.calculateNextCustomRun(schedule.cron);
            default:
                throw new Error(`Unknown schedule type: ${schedule.type}`);
        }
    }

    /**
     * Get days in month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @returns {number} Days in month
     */
    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    /**
     * Generate unique schedule ID
     * @returns {string} Unique ID
     */
    generateScheduleId() {
        this.scheduleIdCounter++;
        return 'schedule_' + this.scheduleIdCounter;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[AutoBackup] Debug mode enabled');
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
     * Get all running timers
     * @returns {Array} List of timer IDs
     */
    getActiveTimers() {
        return Array.from(this.timers.keys());
    }

    /**
     * Clean up all timers
     */
    cleanup() {
        for (const [id, timer] of this.timers) {
            clearInterval(timer);
        }
        this.timers.clear();
    }
}

// Create and export singleton instance
export const autoBackup = new AutoBackup();

// Export class for testing
export default AutoBackup;
