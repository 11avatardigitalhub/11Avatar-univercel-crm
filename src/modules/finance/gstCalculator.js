/**
 * ==========================================
 * FILE: gstCalculator.js
 * MODULE: Finance Module
 * CODE: FIN-3
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * GST (Goods and Services Tax) calculation service for Indian businesses.
 * Supports multiple GST rates, HSN/SAC codes, and IGST/CGST/SGST breakdown.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * 
 * FUNCTIONS:
 * - calculate(amount, gstRate, options): Calculate GST on amount
 * - calculateWithBreakdown(amount, gstRate, options): Calculate with detailed breakdown
 * - getGSTRates(): Get all valid GST rates
 * - validateGSTIN(gstin): Validate GSTIN format
 * - getHSNCode(description): Get HSN/SAC code for product/service
 * - calculateReverseCharge(amount, rate): Calculate reverse charge GST
 * - calculateCompositionScheme(amount, rate): Calculate composition scheme GST
 * - getGSTReport(filters): Get GST report
 * - generateGSTSummary(startDate, endDate): Generate GST summary
 * - validateInvoiceForGST(invoiceData): Validate invoice for GST compliance
 * - getGSTBreakdown(amount, gstRate): Get CGST/SGST breakdown
 * - calculateInterState(amount, gstRate): Calculate IGST for inter-state transactions
 * - calculateIntraState(amount, gstRate): Calculate CGST+SGST for intra-state transactions
 * 
 * USAGE EXAMPLE:
 * import { gstCalculator } from './modules/finance/gstCalculator.js';
 * 
 * // Calculate GST on an amount
 * const result = gstCalculator.calculate(100000, 18);
 * // { amount: 100000, gstAmount: 18000, total: 118000 }
 * 
 * // Calculate with breakdown
 * const breakdown = gstCalculator.calculateWithBreakdown(100000, 18);
 * // { amount: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000 }
 * 
 * // Validate GSTIN
 * const isValid = gstCalculator.validateGSTIN('22AAAAA0000A1Z5');
 * ==========================================
 */

import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// GST configuration
const GST_CONFIG = {
    // Valid GST rates in India
    rates: [0, 0.25, 3, 5, 12, 18, 28],
    
    // HSN code mappings (simplified)
    hsnCodes: {
        // Electronics
        '85': 'Electronics & Electrical Equipment',
        '85.28': 'Telecommunication Equipment',
        '90': 'Optical, Photographic, Measuring Equipment',
        
        // Software
        '99.01': 'Software Development Services',
        '99.02': 'Software Support Services',
        '99.03': 'Cloud Services',
        
        // Consulting
        '99.04': 'Management Consulting',
        '99.05': 'IT Consulting',
        '99.06': 'Financial Consulting',
        
        // Education
        '99.07': 'Education Services',
        '99.08': 'Training Services',
        
        // Healthcare
        '99.09': 'Healthcare Services',
        '99.10': 'Medical Equipment',
        
        // Manufacturing
        '84': 'Industrial Machinery',
        '87': 'Automotive Products',
        '30': 'Pharmaceutical Products',
        
        // Real Estate
        '99.11': 'Real Estate Services',
        '99.12': 'Construction Services',
        
        // Professional Services
        '99.13': 'Legal Services',
        '99.14': 'Accounting Services',
        '99.15': 'Architectural Services'
    },
    
    // SAC codes for services (simplified)
    sacCodes: {
        '9983': 'Software Publishing',
        '9984': 'Database & Hosting Services',
        '9985': 'IT Consulting & Support',
        '9986': 'Business Consulting',
        '9987': 'Financial Services',
        '9988': 'Educational Services',
        '9989': 'Healthcare Services',
        '9991': 'Real Estate Services',
        '9992': 'Legal Services',
        '9993': 'Accounting Services'
    },
    
    // GST rates by category (simplified)
    categoryRates: {
        'electronics': 18,
        'software': 18,
        'it_services': 18,
        'consulting': 18,
        'education': 5,
        'healthcare': 5,
        'manufacturing': 18,
        'real_estate': 12,
        'professional_services': 18,
        'food': 5,
        'essential': 0,
        'luxury': 28,
        'auto': 28,
        'pharma': 12
    }
};

class GSTCalculator {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            defaultGSTRate: 18,
            enableReverseCharge: true,
            enableCompositionScheme: true,
            interstateIGST: true,
            gstinValidation: true,
            eWayBillEnabled: true
        };
        
        // Cache
        this.cache = {
            hsnCodes: new Map(),
            sacCodes: new Map(),
            gstinCache: new Map()
        };
        
        // Statistics
        this.stats = {
            totalCalculations: 0,
            totalAmount: 0,
            totalGST: 0,
            byRate: {}
        };
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize GST calculator
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

            // Pre-populate cache
            this.buildCache();

            logger.info('GST calculator initialized', {
                defaultRate: this.config.defaultGSTRate,
                rates: GST_CONFIG.rates
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('GST calculator initialization failed:', error);
            throw error;
        }
    }

    /**
     * Build cache for HSN and SAC codes
     */
    buildCache() {
        for (const [code, description] of Object.entries(GST_CONFIG.hsnCodes)) {
            this.cache.hsnCodes.set(code, description);
        }
        for (const [code, description] of Object.entries(GST_CONFIG.sacCodes)) {
            this.cache.sacCodes.set(code, description);
        }
    }

    /**
     * Calculate GST on an amount
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate (0, 5, 12, 18, 28)
     * @param {object} options - Additional options
     * @returns {object} Calculation result
     */
    calculate(amount, gstRate = null, options = {}) {
        if (!this.initialized) {
            throw new Error('GST calculator not initialized');
        }

        const rate = gstRate || this.config.defaultGSTRate;
        
        // Validate rate
        if (!GST_CONFIG.rates.includes(rate)) {
            throw new Error(`Invalid GST rate: ${rate}. Valid rates: ${GST_CONFIG.rates.join(', ')}`);
        }

        const gstAmount = (amount * rate) / 100;
        const total = amount + gstAmount;

        // Update stats
        this.updateStats(amount, gstAmount, rate);

        const result = {
            amount: amount,
            gstRate: rate,
            gstAmount: Math.round(gstAmount),
            total: Math.round(total),
            currency: options.currency || 'INR',
            timestamp: new Date().toISOString()
        };

        if (this.debugMode) {
            logger.debug(`[GSTCalculator] Calculated GST: ${result.gstAmount} on ${result.amount} at ${rate}%`);
        }

        return result;
    }

    /**
     * Calculate GST with detailed breakdown
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate
     * @param {object} options - Additional options
     * @returns {object} Calculation with breakdown
     */
    calculateWithBreakdown(amount, gstRate = null, options = {}) {
        const rate = gstRate || this.config.defaultGSTRate;
        const isInterState = options.isInterState || false;

        const baseResult = this.calculate(amount, rate, options);
        
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isInterState) {
            // Inter-state: IGST applies
            igst = baseResult.gstAmount;
        } else {
            // Intra-state: CGST + SGST
            cgst = baseResult.gstAmount / 2;
            sgst = baseResult.gstAmount / 2;
        }

        const result = {
            amount: amount,
            gstRate: rate,
            gstAmount: baseResult.gstAmount,
            cgst: Math.round(cgst),
            sgst: Math.round(sgst),
            igst: Math.round(igst),
            total: baseResult.total,
            isInterState: isInterState,
            currency: options.currency || 'INR',
            timestamp: new Date().toISOString()
        };

        // Round values
        result.cgst = Math.round(result.cgst);
        result.sgst = Math.round(result.sgst);
        result.igst = Math.round(result.igst);

        return result;
    }

    /**
     * Get all valid GST rates
     * @param {object} options - Additional options
     * @returns {Array} List of GST rates
     */
    getGSTRates(options = {}) {
        return [...GST_CONFIG.rates];
    }

    /**
     * Validate GSTIN format (Indian GST Identification Number)
     * @param {string} gstin - GSTIN to validate
     * @param {object} options - Additional options
     * @returns {object} Validation result
     */
    validateGSTIN(gstin, options = {}) {
        if (!gstin) {
            return { valid: false, reason: 'GSTIN is required' };
        }

        // Check cache
        if (this.cache.gstinCache.has(gstin)) {
            return this.cache.gstinCache.get(gstin);
        }

        // GSTIN format: 15 characters
        // 2 digits state code + 10 digits PAN + 1 digit entity number + 1 digit 'Z' + 1 digit checksum
        const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

        let result = { valid: false, reason: 'Invalid format' };

        if (pattern.test(gstin)) {
            result = { valid: true, stateCode: gstin.substring(0, 2), pan: gstin.substring(2, 12) };
        }

        // Cache result
        this.cache.gstinCache.set(gstin, result);

        return result;
    }

    /**
     * Get HSN/SAC code for product/service
     * @param {string} description - Product/service description
     * @param {object} options - Additional options
     * @returns {object} HSN/SAC code details
     */
    getHSNCode(description, options = {}) {
        if (!description) {
            return { code: null, description: null };
        }

        const lowerDesc = description.toLowerCase();
        
        // Search in HSN codes
        for (const [code, desc] of this.cache.hsnCodes) {
            if (desc.toLowerCase().includes(lowerDesc) || lowerDesc.includes(code)) {
                return { code: code, description: desc, type: 'HSN' };
            }
        }

        // Search in SAC codes
        for (const [code, desc] of this.cache.sacCodes) {
            if (desc.toLowerCase().includes(lowerDesc) || lowerDesc.includes(code)) {
                return { code: code, description: desc, type: 'SAC' };
            }
        }

        return { code: null, description: 'Unknown' };
    }

    /**
     * Calculate reverse charge GST
     * @param {number} amount - Base amount
     * @param {number} rate - GST rate
     * @param {object} options - Additional options
     * @returns {object} Reverse charge calculation
     */
    calculateReverseCharge(amount, rate = null, options = {}) {
        if (!this.config.enableReverseCharge) {
            throw new Error('Reverse charge is disabled');
        }

        const gstRate = rate || this.config.defaultGSTRate;
        const baseResult = this.calculate(amount, gstRate, options);

        return {
            ...baseResult,
            type: 'reverse_charge',
            liability: 'recipient', // Recipient is liable to pay GST
            applicable: true
        };
    }

    /**
     * Calculate composition scheme GST
     * @param {number} amount - Base amount
     * @param {number} rate - Composition rate (1% or 5%)
     * @param {object} options - Additional options
     * @returns {object} Composition scheme calculation
     */
    calculateCompositionScheme(amount, rate = null, options = {}) {
        if (!this.config.enableCompositionScheme) {
            throw new Error('Composition scheme is disabled');
        }

        // Composition scheme rates: 1% for manufacturers, 5% for others
        const compositionRate = rate || (options.type === 'manufacturing' ? 1 : 5);
        
        const gstAmount = (amount * compositionRate) / 100;
        const total = amount + gstAmount;

        return {
            amount: amount,
            gstRate: compositionRate,
            gstAmount: Math.round(gstAmount),
            total: Math.round(total),
            type: 'composition_scheme',
            eligibility: amount < 1500000, // Threshold for composition scheme
            currency: options.currency || 'INR',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get GST report
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {object} GST report
     */
    async getGSTReport(filters = {}, options = {}) {
        // In production, this would fetch from invoice data
        // For MVP, return sample report
        return {
            period: {
                start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: filters.endDate || new Date().toISOString()
            },
            summary: {
                totalSales: 0,
                totalGST: 0,
                cgst: 0,
                sgst: 0,
                igst: 0
            },
            rateWise: {},
            invoices: []
        };
    }

    /**
     * Generate GST summary
     * @param {string} startDate - Start date (ISO string)
     * @param {string} endDate - End date (ISO string)
     * @param {object} options - Additional options
     * @returns {object} GST summary
     */
    async generateGSTSummary(startDate, endDate, options = {}) {
        // In production, this would aggregate from invoice data
        // For MVP, return sample summary
        return {
            period: { start: startDate, end: endDate },
            totalAmount: 0,
            totalGST: 0,
            byRate: {},
            byState: {},
            interstateTotal: 0,
            intrastateTotal: 0,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Validate invoice for GST compliance
     * @param {object} invoiceData - Invoice data
     * @param {object} options - Additional options
     * @returns {object} Validation result
     */
    validateInvoiceForGST(invoiceData, options = {}) {
        const errors = [];
        const warnings = [];

        // Check if GSTIN is present
        if (!invoiceData.gstin && !options.allowWithoutGSTIN) {
            errors.push('GSTIN is required for GST invoice');
        }

        // Validate GSTIN format
        if (invoiceData.gstin) {
            const validation = this.validateGSTIN(invoiceData.gstin);
            if (!validation.valid) {
                errors.push(`Invalid GSTIN: ${validation.reason}`);
            }
        }

        // Check HSN/SAC code
        if (!invoiceData.hsnCode && !invoiceData.sacCode) {
            warnings.push('HSN/SAC code is recommended');
        }

        // Check GST rate
        if (invoiceData.gstRate && !GST_CONFIG.rates.includes(invoiceData.gstRate)) {
            errors.push(`Invalid GST rate: ${invoiceData.gstRate}`);
        }

        // Check item details
        if (invoiceData.items) {
            for (const item of invoiceData.items) {
                if (!item.hsnCode && !item.sacCode) {
                    warnings.push(`HSN/SAC code missing for item: ${item.description}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            recommendations: this.generateRecommendations(errors, warnings)
        };
    }

    /**
     * Get CGST/SGST breakdown
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate
     * @param {object} options - Additional options
     * @returns {object} CGST/SGST breakdown
     */
    getGSTBreakdown(amount, gstRate = null, options = {}) {
        const rate = gstRate || this.config.defaultGSTRate;
        const gstAmount = (amount * rate) / 100;
        
        return {
            amount: amount,
            gstRate: rate,
            gstAmount: Math.round(gstAmount),
            cgst: Math.round(gstAmount / 2),
            sgst: Math.round(gstAmount / 2),
            total: Math.round(amount + gstAmount)
        };
    }

    /**
     * Calculate IGST for inter-state transactions
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate
     * @param {object} options - Additional options
     * @returns {object} IGST calculation
     */
    calculateInterState(amount, gstRate = null, options = {}) {
        const rate = gstRate || this.config.defaultGSTRate;
        const gstAmount = (amount * rate) / 100;
        
        return {
            amount: amount,
            gstRate: rate,
            igst: Math.round(gstAmount),
            total: Math.round(amount + gstAmount),
            isInterState: true
        };
    }

    /**
     * Calculate CGST+SGST for intra-state transactions
     * @param {number} amount - Base amount
     * @param {number} gstRate - GST rate
     * @param {object} options - Additional options
     * @returns {object} CGST+SGST calculation
     */
    calculateIntraState(amount, gstRate = null, options = {}) {
        const rate = gstRate || this.config.defaultGSTRate;
        const gstAmount = (amount * rate) / 100;
        
        return {
            amount: amount,
            gstRate: rate,
            cgst: Math.round(gstAmount / 2),
            sgst: Math.round(gstAmount / 2),
            total: Math.round(amount + gstAmount),
            isInterState: false
        };
    }

    /**
     * Generate recommendations for GST validation
     * @param {Array} errors - Validation errors
     * @param {Array} warnings - Validation warnings
     * @returns {Array} Recommendations
     */
    generateRecommendations(errors, warnings) {
        const recommendations = [];

        if (errors.length > 0) {
            recommendations.push({
                priority: 'High',
                action: 'Fix validation errors before proceeding',
                details: errors
            });
        }

        if (warnings.length > 0) {
            recommendations.push({
                priority: 'Medium',
                action: 'Address warnings for better compliance',
                details: warnings
            });
        }

        if (errors.length === 0 && warnings.length === 0) {
            recommendations.push({
                priority: 'Low',
                action: 'Invoice is GST compliant',
                details: 'No issues found'
            });
        }

        return recommendations;
    }

    /**
     * Update statistics
     * @param {number} amount - Base amount
     * @param {number} gstAmount - GST amount
     * @param {number} rate - GST rate
     */
    updateStats(amount, gstAmount, rate) {
        this.stats.totalCalculations++;
        this.stats.totalAmount += amount;
        this.stats.totalGST += gstAmount;
        this.stats.byRate[rate] = (this.stats.byRate[rate] || 0) + 1;
    }

    /**
     * Get statistics
     * @param {object} options - Additional options
     * @returns {object} Statistics
     */
    getStats(options = {}) {
        return { ...this.stats };
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[GSTCalculator] Debug mode enabled');
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
        this.initialized = false;
        this.cache.gstinCache.clear();
        logger.info('GST calculator cleaned up');
    }
}

// Create and export singleton instance
export const gstCalculator = new GSTCalculator();

// Export class for testing
export default GSTCalculator;
