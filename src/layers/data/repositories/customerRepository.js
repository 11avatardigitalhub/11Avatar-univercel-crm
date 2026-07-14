/**
 * ==========================================
 * FILE: customerRepository.js
 * MODULE: Data/Repositories
 * CODE: DAT-2
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Data access layer for Customer entities.
 * Handles CRUD operations, queries, and data persistence.
 * Implements tenant isolation and caching.
 * 
 * DEPENDENCIES:
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * - changeTracker.js (for tracking changes)
 * - leadRepository.js (for lead conversion)
 * 
 * FUNCTIONS:
 * - create(customerData): Create a new customer
 * - findById(id): Find customer by ID
 * - findAll(filters): Find all customers with filters
 * - update(id, customerData): Update a customer
 * - delete(id): Delete a customer
 * - findByPhone(phone): Find customer by phone
 * - findByEmail(email): Find customer by email
 * - findByCompany(company): Find customers by company
 * - getCustomersByCategory(category): Get customers by category
 * - getCustomersByTag(tag): Get customers by tag
 * - getCustomerStats(): Get customer statistics
 * - convertFromLead(leadId): Convert lead to customer
 * - getCustomer360(id): Get complete customer view
 * - addNote(id, note): Add a note to customer
 * - addTag(id, tag): Add a tag to customer
 * - removeTag(id, tag): Remove a tag from customer
 * - getCustomerDocuments(id): Get customer documents
 * - addDocument(id, document): Add a document to customer
 * 
 * USAGE EXAMPLE:
 * import { customerRepository } from './data/repositories/customerRepository.js';
 * 
 * // Create a new customer
 * const customer = await customerRepository.create({
 *   name: 'John Doe',
 *   phone: '+91 9876543210',
 *   email: 'john@example.com',
 *   company: 'Tech Solutions',
 *   gstin: '22AAAAA0000A1Z5'
 * });
 * 
 * // Get customer 360 view
 * const customer360 = await customerRepository.getCustomer360('cust_123');
 * ==========================================
 */

import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { changeTracker } from '../../core/audit/changeTracker.js';
import { leadRepository } from './leadRepository.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let customers = [];
let idCounter = 1000;

class CustomerRepository {
    constructor() {
        // In-memory cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Indexes for faster lookups
        this.indexes = {
            byPhone: new Map(),
            byEmail: new Map(),
            byCompany: new Map(),
            byCategory: new Map(),
            byTag: new Map(),
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
        const sampleCustomers = [
            {
                id: 'cust_1001',
                tenantId: 'tenant_1',
                leadId: 'lead_1003',
                name: 'Amit Kumar',
                phone: '+91 7654321098',
                email: 'amit@example.com',
                company: 'EduWorld',
                industry: 'Education',
                gstin: '22AAAAA0000A1Z5',
                pan: 'AAAAA0000A',
                address: {
                    line1: '123, Main Road',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    pincode: '400001',
                    country: 'India'
                },
                category: 'enterprise',
                tags: ['high_value', 'decision_maker', 'recurring'],
                notes: 'Very satisfied with our services. Looking for annual contract.',
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false,
                totalPurchases: 250000,
                lastPurchaseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cust_1002',
                tenantId: 'tenant_1',
                leadId: null,
                name: 'Priya Patel',
                phone: '+91 8765432109',
                email: 'priya@example.com',
                company: 'HealthCare Plus',
                industry: 'Healthcare',
                gstin: '22BBBBB0000B1Z5',
                pan: 'BBBBB0000B',
                address: {
                    line1: '456, Park Street',
                    city: 'Delhi',
                    state: 'Delhi',
                    pincode: '110001',
                    country: 'India'
                },
                category: 'medium',
                tags: ['urgent', 'fast_track'],
                notes: 'Wants immediate implementation. Demo scheduled for next week.',
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false,
                totalPurchases: 75000,
                lastPurchaseDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'cust_1003',
                tenantId: 'tenant_1',
                leadId: null,
                name: 'Rahul Sharma',
                phone: '+91 9876543210',
                email: 'rahul@example.com',
                company: 'Tech Solutions',
                industry: 'IT',
                gstin: '22CCCCC0000C1Z5',
                pan: 'CCCCC0000C',
                address: {
                    line1: '789, IT Park',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560001',
                    country: 'India'
                },
                category: 'small',
                tags: ['startup', 'growth'],
                notes: 'Growing company, potential for expansion.',
                createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                isArchived: false,
                totalPurchases: 150000,
                lastPurchaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const customer of sampleCustomers) {
            customers.push(customer);
            this.updateIndexes(customer);
        }
    }

    /**
     * Create a new customer
     * @param {object} customerData - Customer data
     * @param {object} options - Additional options
     * @returns {object} Created customer
     */
    async create(customerData, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate customer data
        this.validateCustomer(customerData);

        // Create customer object
        const customer = {
            id: this.generateId(),
            tenantId: tenantId,
            leadId: customerData.leadId || null,
            name: customerData.name,
            phone: customerData.phone || null,
            email: customerData.email || null,
            company: customerData.company || null,
            industry: customerData.industry || null,
            gstin: customerData.gstin || null,
            pan: customerData.pan || null,
            address: customerData.address || {},
            category: customerData.category || 'standard',
            tags: customerData.tags || [],
            notes: customerData.notes || '',
            isActive: true,
            isArchived: false,
            totalPurchases: 0,
            lastPurchaseDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        customers.push(customer);
        this.updateIndexes(customer);
        this.invalidateCache(customer.id);

        // If converted from lead, update lead
        if (customer.leadId) {
            await leadRepository.update(customer.leadId, {
                status: 'converted',
                customerId: customer.id
            }, { userId: options.userId || 'system' });
        }

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'customer.created',
            'customer',
            { customerId: customer.id, name: customer.name }
        );

        if (this.debugMode) {
            console.log('[CustomerRepository] Created customer:', customer.id);
        }

        return { ...customer };
    }

    /**
     * Find customer by ID
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object|null} Customer or null
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

        const customer = customers.find(c => c.id === id && c.isActive && !c.isArchived);
        
        if (!customer) {
            return null;
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (customer.tenantId !== tenantId) {
            return null;
        }

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(id, customer);
            this.cacheTimestamps.set(id, Date.now());
        }

        return { ...customer };
    }

    /**
     * Find all customers with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async findAll(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = customers.filter(customer => 
            customer.tenantId === tenantId && 
            customer.isActive && 
            !customer.isArchived
        );

        // Apply filters
        if (filters.category) {
            results = results.filter(customer => customer.category === filters.category);
        }

        if (filters.industry) {
            results = results.filter(customer => customer.industry === filters.industry);
        }

        if (filters.tags) {
            const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
            results = results.filter(customer => 
                tags.some(tag => customer.tags.includes(tag))
            );
        }

        if (filters.hasGstin) {
            results = results.filter(customer => customer.gstin !== null);
        }

        if (filters.hasPan) {
            results = results.filter(customer => customer.pan !== null);
        }

        if (filters.minPurchase) {
            results = results.filter(customer => customer.totalPurchases >= filters.minPurchase);
        }

        if (filters.maxPurchase) {
            results = results.filter(customer => customer.totalPurchases <= filters.maxPurchase);
        }

        if (filters.startDate) {
            results = results.filter(customer => new Date(customer.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(customer => new Date(customer.createdAt) <= new Date(filters.endDate));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(customer =>
                customer.name.toLowerCase().includes(searchTerm) ||
                (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
                (customer.phone && customer.phone.includes(searchTerm)) ||
                (customer.company && customer.company.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'lastPurchaseDate') {
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

        return paginated.map(customer => ({ ...customer }));
    }

    /**
     * Update a customer
     * @param {string} id - Customer ID
     * @param {object} customerData - Updated customer data
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async update(id, customerData, options = {}) {
        const index = customers.findIndex(c => c.id === id && c.isActive && !c.isArchived);
        
        if (index === -1) {
            throw new Error(`Customer ${id} not found`);
        }

        const oldCustomer = { ...customers[index] };
        const customer = customers[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (customer.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Track changes
        const changedFields = {};
        for (const [key, value] of Object.entries(customerData)) {
            if (value !== undefined && customer[key] !== value) {
                changedFields[key] = { old: customer[key], new: value };
                customer[key] = value;
            }
        }

        customer.updatedAt = new Date().toISOString();

        // Update indexes
        this.updateIndexes(customer);
        this.invalidateCache(id);

        // Track change
        await changeTracker.trackChange(
            'customer',
            id,
            oldCustomer,
            customer,
            options.userId || 'system'
        );

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'customer.updated',
            'customer',
            { customerId: id, changes: changedFields }
        );

        if (this.debugMode) {
            console.log('[CustomerRepository] Updated customer:', id);
        }

        return { ...customer };
    }

    /**
     * Delete a customer (soft delete)
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async delete(id, options = {}) {
        const index = customers.findIndex(c => c.id === id && c.isActive && !c.isArchived);
        
        if (index === -1) {
            throw new Error(`Customer ${id} not found`);
        }

        const customer = customers[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (customer.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Soft delete
        customer.isActive = false;
        customer.isArchived = true;
        customer.updatedAt = new Date().toISOString();
        customer.deletedAt = new Date().toISOString();
        customer.deletedBy = options.userId || 'system';

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'customer.deleted',
            'customer',
            { customerId: id, name: customer.name }
        );

        if (this.debugMode) {
            console.log('[CustomerRepository] Deleted customer:', id);
        }

        return true;
    }

    /**
     * Find customer by phone
     * @param {string} phone - Phone number
     * @param {object} options - Additional options
     * @returns {object|null} Customer or null
     */
    async findByPhone(phone, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const normalizedPhone = this.normalizePhone(phone);
        
        // Check index first
        if (this.indexes.byPhone.has(normalizedPhone)) {
            const customerId = this.indexes.byPhone.get(normalizedPhone);
            return await this.findById(customerId);
        }

        // Fallback to search
        const customer = customers.find(c => 
            c.tenantId === tenantId && 
            c.isActive && 
            !c.isArchived &&
            c.phone && 
            this.normalizePhone(c.phone) === normalizedPhone
        );

        return customer ? { ...customer } : null;
    }

    /**
     * Find customer by email
     * @param {string} email - Email address
     * @param {object} options - Additional options
     * @returns {object|null} Customer or null
     */
    async findByEmail(email, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const normalizedEmail = email.toLowerCase().trim();
        
        // Check index first
        if (this.indexes.byEmail.has(normalizedEmail)) {
            const customerId = this.indexes.byEmail.get(normalizedEmail);
            return await this.findById(customerId);
        }

        // Fallback to search
        const customer = customers.find(c => 
            c.tenantId === tenantId && 
            c.isActive && 
            !c.isArchived &&
            c.email && 
            c.email.toLowerCase().trim() === normalizedEmail
        );

        return customer ? { ...customer } : null;
    }

    /**
     * Find customers by company
     * @param {string} company - Company name
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async findByCompany(company, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const normalizedCompany = company.toLowerCase().trim();
        
        let results = customers.filter(c => 
            c.tenantId === tenantId && 
            c.isActive && 
            !c.isArchived &&
            c.company && 
            c.company.toLowerCase().trim() === normalizedCompany
        );

        return results.map(customer => ({ ...customer }));
    }

    /**
     * Get customers by category
     * @param {string} category - Customer category
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async getCustomersByCategory(category, options = {}) {
        return await this.findAll({ category }, options);
    }

    /**
     * Get customers by tag
     * @param {string} tag - Tag name
     * @param {object} options - Additional options
     * @returns {Array} List of customers
     */
    async getCustomersByTag(tag, options = {}) {
        return await this.findAll({ tags: [tag] }, options);
    }

    /**
     * Get customer statistics
     * @param {object} options - Additional options
     * @returns {object} Customer statistics
     */
    async getCustomerStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantCustomers = customers.filter(c => 
            c.tenantId === tenantId && 
            c.isActive && 
            !c.isArchived
        );

        const stats = {
            total: tenantCustomers.length,
            byCategory: {},
            byIndustry: {},
            totalRevenue: 0,
            averageRevenue: 0,
            activeCustomers: 0,
            newCustomers: 0
        };

        let totalRevenue = 0;
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        for (const customer of tenantCustomers) {
            stats.byCategory[customer.category] = (stats.byCategory[customer.category] || 0) + 1;
            
            if (customer.industry) {
                stats.byIndustry[customer.industry] = (stats.byIndustry[customer.industry] || 0) + 1;
            }

            totalRevenue += customer.totalPurchases || 0;

            // Check if active (purchase in last 90 days)
            if (customer.lastPurchaseDate) {
                const lastPurchase = new Date(customer.lastPurchaseDate);
                const daysSincePurchase = (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSincePurchase <= 90) {
                    stats.activeCustomers++;
                }
            }

            // Check if new (created in last 30 days)
            const createdAt = new Date(customer.createdAt);
            if (createdAt >= monthAgo) {
                stats.newCustomers++;
            }
        }

        stats.totalRevenue = totalRevenue;
        stats.averageRevenue = tenantCustomers.length > 0 ? Math.round(totalRevenue / tenantCustomers.length) : 0;

        return stats;
    }

    /**
     * Convert a lead to a customer
     * @param {string} leadId - Lead ID
     * @param {object} options - Additional options
     * @returns {object} Created customer
     */
    async convertFromLead(leadId, options = {}) {
        // Get lead data
        const lead = await leadRepository.findById(leadId);
        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        // Check if already converted
        if (lead.status === 'converted' && lead.customerId) {
            return await this.findById(lead.customerId);
        }

        // Create customer from lead
        const customerData = {
            leadId: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            company: lead.company || null,
            industry: lead.industry || null,
            tags: lead.tags || [],
            notes: `Converted from lead ${lead.id}\n${lead.notes || ''}`.trim()
        };

        const customer = await this.create(customerData, options);

        if (this.debugMode) {
            console.log('[CustomerRepository] Converted lead to customer:', leadId, customer.id);
        }

        return customer;
    }

    /**
     * Get complete customer 360 view
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {object} Customer 360 data
     */
    async getCustomer360(id, options = {}) {
        const customer = await this.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        // In production, this would fetch related data from multiple sources
        // For MVP, return customer with related data placeholders
        const customer360 = {
            customer: customer,
            timeline: [], // Would fetch from activity service
            communications: [], // Would fetch from communication service
            deals: [], // Would fetch from deal repository
            invoices: [], // Would fetch from invoice repository
            tickets: [], // Would fetch from ticket service
            visits: [], // Would fetch from field force service
            notes: customer.notes ? [{
                id: 'note_1',
                content: customer.notes,
                createdAt: customer.createdAt
            }] : [],
            documents: [] // Would fetch from DMS
        };

        return customer360;
    }

    /**
     * Add a note to customer
     * @param {string} id - Customer ID
     * @param {string} note - Note content
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async addNote(id, note, options = {}) {
        const customer = await this.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const noteEntry = {
            id: 'note_' + Date.now(),
            content: note,
            userId: options.userId || 'system',
            createdAt: new Date().toISOString()
        };

        // In production, this would store notes in a separate collection
        // For MVP, append to notes field
        const updatedNotes = customer.notes ? 
            customer.notes + '\n\n---\n[' + noteEntry.createdAt + '] ' + noteEntry.content : 
            noteEntry.content;

        return await this.update(id, { notes: updatedNotes }, options);
    }

    /**
     * Add a tag to customer
     * @param {string} id - Customer ID
     * @param {string} tag - Tag name
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async addTag(id, tag, options = {}) {
        const customer = await this.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        if (!customer.tags.includes(tag)) {
            const tags = [...customer.tags, tag];
            return await this.update(id, { tags }, options);
        }

        return customer;
    }

    /**
     * Remove a tag from customer
     * @param {string} id - Customer ID
     * @param {string} tag - Tag name
     * @param {object} options - Additional options
     * @returns {object} Updated customer
     */
    async removeTag(id, tag, options = {}) {
        const customer = await this.findById(id);
        if (!customer) {
            throw new Error(`Customer ${id} not found`);
        }

        const tags = customer.tags.filter(t => t !== tag);
        if (tags.length !== customer.tags.length) {
            return await this.update(id, { tags }, options);
        }

        return customer;
    }

    /**
     * Get customer documents (placeholder)
     * @param {string} id - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} List of documents
     */
    async getCustomerDocuments(id, options = {}) {
        // In production, this would fetch from DMS
        return [];
    }

    /**
     * Add a document to customer (placeholder)
     * @param {string} id - Customer ID
     * @param {object} document - Document data
     * @param {object} options - Additional options
     * @returns {object} Added document
     */
    async addDocument(id, document, options = {}) {
        // In production, this would save to DMS
        return { id: 'doc_' + Date.now(), ...document };
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'cust_' + idCounter;
    }

    /**
     * Validate customer data
     * @param {object} customerData - Customer data to validate
     * @throws {Error} If validation fails
     */
    validateCustomer(customerData) {
        if (!customerData.name) {
            throw new Error('Name is required');
        }

        if (customerData.email && !this.isValidEmail(customerData.email)) {
            throw new Error('Invalid email format');
        }

        if (customerData.gstin && !this.isValidGstin(customerData.gstin)) {
            throw new Error('Invalid GSTIN format');
        }

        if (customerData.pan && !this.isValidPan(customerData.pan)) {
            throw new Error('Invalid PAN format');
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate GSTIN format (Indian GST)
     * @param {string} gstin - GSTIN to validate
     * @returns {boolean} Whether GSTIN is valid
     */
    isValidGstin(gstin) {
        // Basic format validation: 15 characters, alphanumeric
        return gstin.length === 15 && /^[0-9A-Z]{15}$/.test(gstin);
    }

    /**
     * Validate PAN format (Indian PAN)
     * @param {string} pan - PAN to validate
     * @returns {boolean} Whether PAN is valid
     */
    isValidPan(pan) {
        // Basic format validation: 10 characters, uppercase
        return pan.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
    }

    /**
     * Normalize phone number
     * @param {string} phone - Phone number
     * @returns {string} Normalized phone
     */
    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }

    /**
     * Update indexes for a customer
     * @param {object} customer - Customer object
     */
    updateIndexes(customer) {
        // Phone index
        if (customer.phone) {
            const normalizedPhone = this.normalizePhone(customer.phone);
            this.indexes.byPhone.set(normalizedPhone, customer.id);
        }

        // Email index
        if (customer.email) {
            const normalizedEmail = customer.email.toLowerCase().trim();
            this.indexes.byEmail.set(normalizedEmail, customer.id);
        }

        // Company index
        if (customer.company) {
            const normalizedCompany = customer.company.toLowerCase().trim();
            if (!this.indexes.byCompany.has(normalizedCompany)) {
                this.indexes.byCompany.set(normalizedCompany, new Set());
            }
            this.indexes.byCompany.get(normalizedCompany).add(customer.id);
        }

        // Category index
        if (customer.category) {
            if (!this.indexes.byCategory.has(customer.category)) {
                this.indexes.byCategory.set(customer.category, new Set());
            }
            this.indexes.byCategory.get(customer.category).add(customer.id);
        }

        // Tag index
        for (const tag of customer.tags) {
            if (!this.indexes.byTag.has(tag)) {
                this.indexes.byTag.set(tag, new Set());
            }
            this.indexes.byTag.get(tag).add(customer.id);
        }

        // Tenant index
        if (customer.tenantId) {
            if (!this.indexes.byTenant.has(customer.tenantId)) {
                this.indexes.byTenant.set(customer.tenantId, new Set());
            }
            this.indexes.byTenant.get(customer.tenantId).add(customer.id);
        }
    }

    /**
     * Invalidate cache for a customer
     * @param {string} id - Customer ID
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
        console.log('[CustomerRepository] Debug mode enabled');
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
export const customerRepository = new CustomerRepository();

// Export class for testing
export default CustomerRepository;
