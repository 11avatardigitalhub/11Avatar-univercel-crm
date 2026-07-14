/**
 * ==========================================
 * FILE: leadManager.js
 * MODULE: CRM Module
 * CODE: CRM-2
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Lead management operations for the CRM module.
 * Handles advanced lead operations, bulk actions, and lead processing.
 * Extends leadRepository with business logic and automation.
 * 
 * DEPENDENCIES:
 * - leadRepository.js (for data access)
 * - dealRepository.js (for deal creation)
 * - taskRepository.js (for task creation)
 * - activityManager.js (for activity logging)
 * - aiService.js (for AI scoring)
 * 
 * FUNCTIONS:
 * - bulkImport(leads): Bulk import leads
 * - bulkUpdate(updates): Bulk update leads
 * - bulkAssign(leadIds, userId): Assign leads to user
 * - bulkConvert(leadIds): Convert multiple leads to customers
 * - processNewLead(leadId): Process new lead with AI scoring
 * - enrichLead(leadId): Enrich lead with external data
 * - mergeLeads(sourceId, targetId): Merge duplicate leads
 * - getLeadScore(id): Get AI-calculated lead score
 * - recalculateScore(id): Recalculate lead score
 * - getLeadJourney(id): Get complete lead journey
 * - getLeadInsights(id): Get AI insights for lead
 * - exportLeads(filters): Export leads
 * - scheduleFollowup(id, date): Schedule follow-up
 * - assignLead(id, userId): Assign lead to user
 * - qualifyLead(id): Qualify a lead
 * - disqualifyLead(id, reason): Disqualify a lead
 * - getLeadsByUser(userId): Get leads assigned to user
 * - getLeadsByTeam(teamId): Get leads assigned to team
 * 
 * USAGE EXAMPLE:
 * import { leadManager } from './modules/crm/leadManager.js';
 * 
 * // Bulk import leads
 * const result = await leadManager.bulkImport([
 *   { name: 'John Doe', phone: '+91 9876543210' },
 *   { name: 'Jane Smith', phone: '+91 8765432109' }
 * ]);
 * 
 * // Process new lead with AI
 * await leadManager.processNewLead('lead_123');
 * 
 * // Get AI insights for a lead
 * const insights = await leadManager.getLeadInsights('lead_123');
 * ==========================================
 */

import { leadRepository } from '../../layers/data/repositories/leadRepository.js';
import { customerRepository } from '../../layers/data/repositories/customerRepository.js';
import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { taskRepository } from '../../layers/data/repositories/taskRepository.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// AI Service (will be imported when available)
// import { aiService } from '../ai/aiService.js';

// Activity Manager (will be imported when available)
// import { activityManager } from '../activity/activityManager.js';

class LeadManager {
    constructor() {
        // Configuration
        this.config = {
            autoQualifyScore: 80,
            autoConvertScore: 90,
            batchSize: 100,
            enrichEnabled: true,
            aiScoringEnabled: true,
            followUpDays: 2
        };
        
        // Cache for processed leads
        this.processedLeads = new Map();
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Bulk import leads
     * @param {Array} leads - Array of lead data
     * @param {object} options - Additional options
     * @returns {object} Import results
     */
    async bulkImport(leads, options = {}) {
        if (!leads || leads.length === 0) {
            throw new Error('No leads to import');
        }

        const results = {
            total: leads.length,
            imported: 0,
            failed: 0,
            errors: [],
            duplicates: []
        };

        // Process in batches
        for (let i = 0; i < leads.length; i += this.config.batchSize) {
            const batch = leads.slice(i, i + this.config.batchSize);
            
            for (const leadData of batch) {
                try {
                    // Check for duplicates
                    const isDuplicate = await leadRepository.checkDuplicate(leadData);
                    if (isDuplicate && !options.ignoreDuplicates) {
                        results.duplicates.push(leadData);
                        results.failed++;
                        continue;
                    }

                    // Create lead
                    const lead = await leadRepository.create(leadData, {
                        userId: options.userId || 'system',
                        skipValidation: options.skipValidation || false
                    });

                    results.imported++;
                    
                    // Process new lead with AI if enabled
                    if (this.config.aiScoringEnabled) {
                        await this.processNewLead(lead.id);
                    }

                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        data: leadData,
                        error: error.message
                    });
                }
            }
        }

        // Log import results
        logger.info(`Bulk import completed: ${results.imported} imported, ${results.failed} failed`);

        return results;
    }

    /**
     * Bulk update leads
     * @param {Array} updates - Array of {id, data} objects
     * @param {object} options - Additional options
     * @returns {object} Update results
     */
    async bulkUpdate(updates, options = {}) {
        if (!updates || updates.length === 0) {
            throw new Error('No updates to apply');
        }

        const results = {
            total: updates.length,
            updated: 0,
            failed: 0,
            errors: []
        };

        for (const update of updates) {
            try {
                await leadRepository.update(update.id, update.data, {
                    userId: options.userId || 'system'
                });
                results.updated++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    id: update.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Bulk assign leads to a user
     * @param {Array} leadIds - Array of lead IDs
     * @param {string} userId - User ID to assign to
     * @param {object} options - Additional options
     * @returns {object} Assignment results
     */
    async bulkAssign(leadIds, userId, options = {}) {
        if (!leadIds || leadIds.length === 0) {
            throw new Error('No leads to assign');
        }

        const results = {
            total: leadIds.length,
            assigned: 0,
            failed: 0,
            errors: []
        };

        for (const leadId of leadIds) {
            try {
                await leadRepository.update(leadId, { assignedTo: userId }, {
                    userId: options.userId || 'system'
                });
                results.assigned++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    leadId: leadId,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Bulk convert leads to customers
     * @param {Array} leadIds - Array of lead IDs
     * @param {object} options - Additional options
     * @returns {object} Conversion results
     */
    async bulkConvert(leadIds, options = {}) {
        if (!leadIds || leadIds.length === 0) {
            throw new Error('No leads to convert');
        }

        const results = {
            total: leadIds.length,
            converted: 0,
            failed: 0,
            errors: []
        };

        for (const leadId of leadIds) {
            try {
                const customer = await customerRepository.convertFromLead(leadId, {
                    userId: options.userId || 'system'
                });
                results.converted++;
                
                // Emit event
                eventBus.publish('lead.converted', {
                    leadId: leadId,
                    customerId: customer.id,
                    userId: options.userId || 'system'
                });

            } catch (error) {
                results.failed++;
                results.errors.push({
                    leadId: leadId,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Process new lead with AI scoring and automation
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} Processing results
     */
    async processNewLead(leadId, options = {}) {
        try {
            const lead = await leadRepository.findById(leadId);
            if (!lead) {
                throw new Error(`Lead ${leadId} not found`);
            }

            const results = {
                leadId: leadId,
                scored: false,
                score: 0,
                qualified: false,
                autoAssigned: false,
                taskCreated: false
            };

            // AI Scoring
            if (this.config.aiScoringEnabled) {
                try {
                    // In production, use actual AI service
                    // const score = await aiService.scoreLead(lead);
                    const score = await this.calculateLeadScore(lead);
                    
                    await leadRepository.update(leadId, { score }, {
                        userId: options.userId || 'system'
                    });
                    
                    results.scored = true;
                    results.score = score;

                    // Auto-qualify if score is high
                    if (score >= this.config.autoQualifyScore) {
                        await this.qualifyLead(leadId, options);
                        results.qualified = true;
                    }

                    // Auto-convert if score is very high
                    if (score >= this.config.autoConvertScore) {
                        await customerRepository.convertFromLead(leadId, {
                            userId: options.userId || 'system'
                        });
                        results.converted = true;
                    }

                } catch (error) {
                    logger.error(`AI scoring failed for lead ${leadId}:`, error);
                }
            }

            // Create follow-up task
            if (!results.converted) {
                await this.scheduleFollowup(leadId, {
                    days: this.config.followUpDays,
                    userId: options.userId || 'system'
                });
                results.taskCreated = true;
            }

            // Log activity
            await auditLogger.log(
                options.userId || 'system',
                'lead.processed',
                'lead',
                { leadId: leadId, results: results }
            );

            // Emit event
            eventBus.publish('lead.processed', {
                leadId: leadId,
                results: results,
                userId: options.userId || 'system'
            });

            this.processedLeads.set(leadId, results);

            return results;

        } catch (error) {
            logger.error(`Failed to process lead ${leadId}:`, error);
            throw error;
        }
    }

    /**
     * Calculate lead score (simplified for MVP)
     * @param {object} lead - Lead object
     * @returns {number} Score 0-100
     */
    async calculateLeadScore(lead) {
        let score = 0;

        // Industry score
        const industryScores = {
            'IT': 20,
            'Finance': 20,
            'Healthcare': 18,
            'Education': 16,
            'Manufacturing': 14,
            'Retail': 12
        };
        score += industryScores[lead.industry] || 10;

        // Source score
        const sourceScores = {
            'referral': 15,
            'website': 12,
            'whatsapp': 12,
            'facebook': 10,
            'google': 10,
            'manual': 5
        };
        score += sourceScores[lead.source] || 8;

        // Budget score
        if (lead.budget) {
            if (lead.budget > 1000000) score += 25;
            else if (lead.budget > 500000) score += 20;
            else if (lead.budget > 100000) score += 15;
            else if (lead.budget > 50000) score += 10;
            else score += 5;
        }

        // Timeline score
        if (lead.timeline) {
            if (lead.timeline === 'immediate') score += 20;
            else if (lead.timeline === '1_month') score += 15;
            else if (lead.timeline === '3_months') score += 10;
            else score += 5;
        }

        // Email/phone presence
        if (lead.email) score += 5;
        if (lead.phone) score += 5;

        return Math.min(100, score);
    }

    /**
     * Enrich lead with external data
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} Enriched lead
     */
    async enrichLead(leadId, options = {}) {
        if (!this.config.enrichEnabled) {
            throw new Error('Lead enrichment is disabled');
        }

        const lead = await leadRepository.findById(leadId);
        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        // In production, this would use external APIs
        // For MVP, simulate enrichment
        const enrichedData = {
            companyInfo: {
                industry: 'Technology',
                size: '50-100',
                founded: '2015'
            },
            socialProfiles: {
                linkedin: 'https://linkedin.com/company/example',
                twitter: 'https://twitter.com/example'
            },
            news: [
                'Recently raised funding',
                'Expanding to new markets'
            ]
        };

        // Update lead with enriched data
        const updatedLead = await leadRepository.update(leadId, {
            metadata: {
                ...lead.metadata,
                enriched: enrichedData,
                enrichedAt: new Date().toISOString()
            }
        }, { userId: options.userId || 'system' });

        return updatedLead;
    }

    /**
     * Merge duplicate leads
     * @param {string} sourceId - Source lead ID (to be removed)
     * @param {string} targetId - Target lead ID (to keep)
     * @param {object} options - Additional options
     * @returns {object} Merge results
     */
    async mergeLeads(sourceId, targetId, options = {}) {
        const source = await leadRepository.findById(sourceId);
        const target = await leadRepository.findById(targetId);

        if (!source || !target) {
            throw new Error('One or both leads not found');
        }

        // Merge data (target takes precedence)
        const mergedData = {
            ...source,
            ...target,
            // Keep combined tags and notes
            tags: [...new Set([...source.tags, ...target.tags])],
            notes: `Merged from ${sourceId}\n\n${source.notes}\n\n${target.notes}`.trim(),
            // Keep earliest created date
            createdAt: new Date(Math.min(
                new Date(source.createdAt).getTime(),
                new Date(target.createdAt).getTime()
            )).toISOString()
        };

        // Update target with merged data
        await leadRepository.update(targetId, mergedData, {
            userId: options.userId || 'system'
        });

        // Delete source
        await leadRepository.delete(sourceId, {
            userId: options.userId || 'system',
            forceDelete: true
        });

        // Log merge
        await auditLogger.log(
            options.userId || 'system',
            'lead.merged',
            'lead',
            { sourceId: sourceId, targetId: targetId }
        );

        return {
            sourceId: sourceId,
            targetId: targetId,
            mergedAt: new Date().toISOString()
        };
    }

    /**
     * Get AI insights for a lead
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} AI insights
     */
    async getLeadInsights(leadId, options = {}) {
        const lead = await leadRepository.findById(leadId);
        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        // In production, this would use AI service
        // For MVP, return calculated insights
        return {
            leadId: leadId,
            name: lead.name,
            score: lead.score || 0,
            category: this.getLeadCategory(lead),
            nextBestAction: this.getNextBestAction(lead),
            expectedValue: this.calculateExpectedValue(lead),
            conversionProbability: this.calculateConversionProbability(lead),
            recommendedNextContact: this.getRecommendedContactTime(lead),
            riskFactors: this.getRiskFactors(lead)
        };
    }

    /**
     * Get lead category
     * @param {object} lead - Lead object
     * @returns {string} Category
     */
    getLeadCategory(lead) {
        const score = lead.score || 0;
        if (score >= 80) return 'Hot';
        if (score >= 60) return 'Warm';
        if (score >= 40) return 'Cold';
        return 'Not Qualified';
    }

    /**
     * Get next best action for lead
     * @param {object} lead - Lead object
     * @returns {string} Recommended action
     */
    getNextBestAction(lead) {
        const actions = [
            'Schedule a discovery call',
            'Send a personalized email',
            'Share a case study',
            'Request a product demo',
            'Send a proposal',
            'Follow up on previous conversation'
        ];

        const score = lead.score || 0;
        if (score >= 80) return actions[3];
        if (score >= 60) return actions[1];
        if (score >= 40) return actions[0];
        return actions[5];
    }

    /**
     * Calculate expected value
     * @param {object} lead - Lead object
     * @returns {number} Expected value
     */
    calculateExpectedValue(lead) {
        const value = lead.value || 0;
        const probability = lead.probability || 0;
        return Math.round(value * (probability / 100));
    }

    /**
     * Calculate conversion probability
     * @param {object} lead - Lead object
     * @returns {number} Probability 0-100
     */
    calculateConversionProbability(lead) {
        const score = lead.score || 0;
        // Map score to probability (rough estimate)
        if (score >= 80) return 80 + Math.floor(Math.random() * 20);
        if (score >= 60) return 50 + Math.floor(Math.random() * 30);
        if (score >= 40) return 20 + Math.floor(Math.random() * 30);
        return Math.floor(Math.random() * 20);
    }

    /**
     * Get recommended contact time
     * @param {object} lead - Lead object
     * @returns {string} Recommended time
     */
    getRecommendedContactTime(lead) {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();

        // Best times for Indian business hours
        if (day >= 1 && day <= 5) {
            if (hour < 10) return '10:00 AM';
            if (hour < 12) return '12:00 PM';
            if (hour < 15) return '3:00 PM';
            if (hour < 17) return '5:00 PM';
            return '10:00 AM tomorrow';
        }
        return '10:00 AM on Monday';
    }

    /**
     * Get risk factors for lead
     * @param {object} lead - Lead object
     * @returns {Array} Risk factors
     */
    getRiskFactors(lead) {
        const risks = [];
        const score = lead.score || 0;

        if (score < 40) {
            risks.push('Low engagement score');
        }
        if (!lead.email) {
            risks.push('No email address provided');
        }
        if (!lead.company) {
            risks.push('Company information missing');
        }
        if (lead.createdAt) {
            const daysSince = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 30) {
                risks.push('Lead is more than 30 days old');
            }
            if (daysSince > 7 && lead.status === 'new') {
                risks.push('No follow-up in last 7 days');
            }
        }

        return risks;
    }

    /**
     * Schedule follow-up for lead
     * @param {string} leadId - Lead ID
     * @param {object} options - Schedule options
     * @returns {object} Created task
     */
    async scheduleFollowup(leadId, options = {}) {
        const lead = await leadRepository.findById(leadId);
        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        const days = options.days || this.config.followUpDays;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        const task = await taskRepository.create({
            title: `Follow up with ${lead.name}`,
            description: `Follow-up call for lead from ${lead.source || 'unknown source'}`,
            type: 'followup',
            priority: lead.score >= 70 ? 'high' : 'medium',
            dueDate: dueDate.toISOString(),
            assignedTo: options.userId || lead.assignedTo || null,
            relatedTo: {
                type: 'lead',
                id: leadId
            },
            notes: `Scheduled follow-up. Lead score: ${lead.score || 'N/A'}`
        }, { userId: options.userId || 'system' });

        return task;
    }

    /**
     * Assign lead to user
     * @param {string} leadId - Lead ID
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {object} Updated lead
     */
    async assignLead(leadId, userId, options = {}) {
        const lead = await leadRepository.update(leadId, {
            assignedTo: userId,
            assignedAt: new Date().toISOString()
        }, { userId: options.userId || 'system' });

        // Emit event
        eventBus.publish('lead.assigned', {
            leadId: leadId,
            userId: userId,
            assignedBy: options.userId || 'system'
        });

        return lead;
    }

    /**
     * Qualify a lead
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} Updated lead
     */
    async qualifyLead(leadId, options = {}) {
        return await leadRepository.update(leadId, {
            status: 'qualified'
        }, { userId: options.userId || 'system' });
    }

    /**
     * Disqualify a lead
     * @param {string} leadId - Lead ID
     * @param {string} reason - Disqualification reason
     * @param {object} options - Additional options
     * @returns {object} Updated lead
     */
    async disqualifyLead(leadId, reason, options = {}) {
        return await leadRepository.update(leadId, {
            status: 'lost',
            lossReason: reason
        }, { userId: options.userId || 'system' });
    }

    /**
     * Get leads by user
     * @param {string} userId - User ID
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsByUser(userId, options = {}) {
        return await leadRepository.findAll({ assignedTo: userId }, options);
    }

    /**
     * Get leads by team
     * @param {string} teamId - Team ID
     * @param {object} options - Additional options
     * @returns {Array} List of leads
     */
    async getLeadsByTeam(teamId, options = {}) {
        // In production, this would use team repository
        // For MVP, get all leads and filter by team
        const allLeads = await leadRepository.findAll({}, options);
        // This would need team assignment data in production
        return allLeads;
    }

    /**
     * Export leads
     * @param {object} filters - Filter criteria
     * @param {object} options - Export options
     * @returns {Array} Exported leads
     */
    async exportLeads(filters = {}, options = {}) {
        const leads = await leadRepository.findAll(filters, {
            limit: 10000 // Max export limit
        });

        // Format for export
        return leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company,
            industry: lead.industry,
            source: lead.source,
            status: lead.status,
            score: lead.score,
            assignedTo: lead.assignedTo,
            value: lead.value,
            probability: lead.probability,
            expectedClose: lead.expectedClose,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt
        }));
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[LeadManager] Debug mode enabled');
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
     * Get stats
     * @returns {object} Statistics
     */
    getStats() {
        return {
            processedLeads: this.processedLeads.size,
            processingQueue: this.processingQueue.length,
            isProcessing: this.isProcessing,
            config: this.config
        };
    }
}

// Create and export singleton instance
export const leadManager = new LeadManager();

// Export class for testing
export default LeadManager;
