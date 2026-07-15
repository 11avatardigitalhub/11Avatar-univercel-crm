/**
 * ==========================================
 * FILE: Cards.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade card component system for 11 Avatar CRM.
 * Provides a comprehensive set of card components for data display,
 * including Stat Cards, Lead Cards, Deal Cards, Customer Cards,
 * Task Cards, Activity Cards, and more.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Multiple Card Types (Stat, Lead, Deal, Customer, Task, Activity)
 * - Consistent Design System
 * - Theme Support (Light/Dark)
 * - Responsive Design
 * - Hover & Interactive States
 * - Loading & Empty States
 * - Customizable Actions
 * - Badge & Status Support
 * - Progress Indicators
 * - Animated Transitions
 * - Accessibility Ready
 * 
 * USAGE EXAMPLE:
 * import { CardFactory } from './components/Cards.js';
 * 
 * // Create a Stat Card
 * const statCard = CardFactory.createStatCard({
 *   title: 'Total Leads',
 *   value: '1,284',
 *   icon: 'fas fa-users',
 *   change: '+12.5%',
 *   changeType: 'up',
 *   color: 'gold'
 * });
 * 
 * // Create a Lead Card
 * const leadCard = CardFactory.createLeadCard({
 *   id: 'lead_123',
 *   name: 'Rahul Sharma',
 *   company: 'Tech Solutions',
 *   status: 'New',
 *   score: 85,
 *   phone: '+91 98765 43210',
 *   email: 'rahul@techsolutions.com'
 * });
 * 
 * // Render to container
 * document.getElementById('container').appendChild(statCard.render());
 * ==========================================
 */

export class CardFactory {
    /**
     * Create a Stat Card
     * @param {object} data - Stat card data
     * @param {object} options - Additional options
     * @returns {StatCard} Stat card instance
     */
    static createStatCard(data, options = {}) {
        return new StatCard(data, options);
    }

    /**
     * Create a Lead Card
     * @param {object} data - Lead card data
     * @param {object} options - Additional options
     * @returns {LeadCard} Lead card instance
     */
    static createLeadCard(data, options = {}) {
        return new LeadCard(data, options);
    }

    /**
     * Create a Deal Card
     * @param {object} data - Deal card data
     * @param {object} options - Additional options
     * @returns {DealCard} Deal card instance
     */
    static createDealCard(data, options = {}) {
        return new DealCard(data, options);
    }

    /**
     * Create a Customer Card
     * @param {object} data - Customer card data
     * @param {object} options - Additional options
     * @returns {CustomerCard} Customer card instance
     */
    static createCustomerCard(data, options = {}) {
        return new CustomerCard(data, options);
    }

    /**
     * Create a Task Card
     * @param {object} data - Task card data
     * @param {object} options - Additional options
     * @returns {TaskCard} Task card instance
     */
    static createTaskCard(data, options = {}) {
        return new TaskCard(data, options);
    }

    /**
     * Create an Activity Card
     * @param {object} data - Activity card data
     * @param {object} options - Additional options
     * @returns {ActivityCard} Activity card instance
     */
    static createActivityCard(data, options = {}) {
        return new ActivityCard(data, options);
    }

    /**
     * Create a Metric Card
     * @param {object} data - Metric card data
     * @param {object} options - Additional options
     * @returns {MetricCard} Metric card instance
     */
    static createMetricCard(data, options = {}) {
        return new MetricCard(data, options);
    }

    /**
     * Create a Timeline Card
     * @param {object} data - Timeline card data
     * @param {object} options - Additional options
     * @returns {TimelineCard} Timeline card instance
     */
    static createTimelineCard(data, options = {}) {
        return new TimelineCard(data, options);
    }

    /**
     * Create a Notification Card
     * @param {object} data - Notification card data
     * @param {object} options - Additional options
     * @returns {NotificationCard} Notification card instance
     */
    static createNotificationCard(data, options = {}) {
        return new NotificationCard(data, options);
    }

    /**
     * Create a Profile Card
     * @param {object} data - Profile card data
     * @param {object} options - Additional options
     * @returns {ProfileCard} Profile card instance
     */
    static createProfileCard(data, options = {}) {
        return new ProfileCard(data, options);
    }

    /**
     * Create a Summary Card
     * @param {object} data - Summary card data
     * @param {object} options - Additional options
     * @returns {SummaryCard} Summary card instance
     */
    static createSummaryCard(data, options = {}) {
        return new SummaryCard(data, options);
    }
}

/**
 * Base Card Class
 */
class BaseCard {
    constructor(data = {}, options = {}) {
        this.data = data;
        this.options = {
            className: options.className || '',
            theme: options.theme || 'light',
            animated: options.animated !== undefined ? options.animated : true,
            hoverable: options.hoverable !== undefined ? options.hoverable : true,
            clickable: options.clickable !== undefined ? options.clickable : false,
            onClick: options.onClick || null,
            onAction: options.onAction || null,
            ...options
        };
        this.element = null;
        this.eventListeners = [];
    }

    /**
     * Render the card
     * @returns {HTMLElement} Card element
     */
    render() {
        throw new Error('render() must be implemented by subclass');
    }

    /**
     * Update card data
     * @param {object} data - New data
     */
    update(data) {
        this.data = { ...this.data, ...data };
        this.render();
    }

    /**
     * Get card element
     * @returns {HTMLElement} Card element
     */
    getElement() {
        return this.element;
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    addEventListener(event, handler) {
        if (this.element) {
            this.element.addEventListener(event, handler);
            this.eventListeners.push({ event, handler });
        }
    }

    /**
     * Remove all event listeners
     */
    removeEventListeners() {
        this.eventListeners.forEach(({ event, handler }) => {
            if (this.element) {
                this.element.removeEventListener(event, handler);
            }
        });
        this.eventListeners = [];
    }

    /**
     * Destroy the card
     */
    destroy() {
        this.removeEventListeners();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    /**
     * Create card container
     * @param {string} className - Additional classes
     * @returns {HTMLElement} Card container
     */
    createContainer(className = '') {
        const container = document.createElement('div');
        container.className = `card ${className} ${this.options.className}`;
        container.dataset.theme = this.options.theme;
        container.dataset.hoverable = this.options.hoverable;
        container.dataset.clickable = this.options.clickable;

        if (this.options.animated) {
            container.classList.add('card-animated');
        }

        if (this.options.clickable && this.options.onClick) {
            container.style.cursor = 'pointer';
            container.addEventListener('click', this.options.onClick);
        }

        return container;
    }

    /**
     * Create card header
     * @param {string} title - Card title
     * @param {string} subtitle - Card subtitle
     * @param {HTMLElement} actions - Actions element
     * @returns {HTMLElement} Card header
     */
    createHeader(title, subtitle = '', actions = null) {
        const header = document.createElement('div');
        header.className = 'card-header';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'card-title-container';

        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'card-title';
            titleEl.textContent = title;
            titleContainer.appendChild(titleEl);
        }

        if (subtitle) {
            const subtitleEl = document.createElement('p');
            subtitleEl.className = 'card-subtitle';
            subtitleEl.textContent = subtitle;
            titleContainer.appendChild(subtitleEl);
        }

        header.appendChild(titleContainer);

        if (actions) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'card-actions';
            actionsContainer.appendChild(actions);
            header.appendChild(actionsContainer);
        }

        return header;
    }

    /**
     * Create card body
     * @param {HTMLElement} content - Card content
     * @returns {HTMLElement} Card body
     */
    createBody(content) {
        const body = document.createElement('div');
        body.className = 'card-body';
        if (content) {
            body.appendChild(content);
        }
        return body;
    }

    /**
     * Create card footer
     * @param {HTMLElement} content - Footer content
     * @returns {HTMLElement} Card footer
     */
    createFooter(content) {
        const footer = document.createElement('div');
        footer.className = 'card-footer';
        if (content) {
            footer.appendChild(content);
        }
        return footer;
    }

    /**
     * Create status badge
     * @param {string} status - Status text
     * @param {string} type - Status type (new, contacted, qualified, etc.)
     * @returns {HTMLElement} Status badge
     */
    createStatusBadge(status, type = '') {
        const badge = document.createElement('span');
        badge.className = `status-badge ${type}`;
        badge.textContent = status;
        return badge;
    }

    /**
     * Create avatar
     * @param {string} name - Person name
     * @param {string} image - Image URL
     * @param {string} size - Avatar size (sm, md, lg)
     * @returns {HTMLElement} Avatar element
     */
    createAvatar(name, image = '', size = 'md') {
        const avatar = document.createElement('div');
        avatar.className = `avatar ${size}`;

        if (image) {
            const img = document.createElement('img');
            img.src = image;
            img.alt = name;
            avatar.appendChild(img);
        } else {
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            avatar.textContent = initials;
            avatar.style.backgroundColor = this.getColorFromName(name);
        }

        return avatar;
    }

    /**
     * Get color from name
     * @param {string} name - Name
     * @returns {string} Color
     */
    getColorFromName(name) {
        const colors = [
            '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
            '#F59E0B', '#10B981', '#3B82F6', '#06B6D4'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Create progress bar
     * @param {number} value - Progress value (0-100)
     * @param {string} label - Progress label
     * @returns {HTMLElement} Progress element
     */
    createProgress(value, label = '') {
        const container = document.createElement('div');
        container.className = 'progress-container';

        if (label) {
            const labelEl = document.createElement('span');
            labelEl.className = 'progress-label';
            labelEl.textContent = label;
            container.appendChild(labelEl);
        }

        const progress = document.createElement('div');
        progress.className = 'progress';
        container.appendChild(progress);

        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.style.width = `${Math.min(100, Math.max(0, value))}%`;
        bar.style.backgroundColor = this.getProgressColor(value);
        progress.appendChild(bar);

        return container;
    }

    /**
     * Get progress color based on value
     * @param {number} value - Progress value
     * @returns {string} Color
     */
    getProgressColor(value) {
        if (value >= 80) return '#10B981';
        if (value >= 60) return '#F59E0B';
        if (value >= 40) return '#8B5CF6';
        return '#EF4444';
    }

    /**
     * Create icon element
     * @param {string} iconClass - Icon class (Font Awesome)
     * @param {string} size - Icon size
     * @returns {HTMLElement} Icon element
     */
    createIcon(iconClass, size = 'md') {
        const icon = document.createElement('i');
        icon.className = `${iconClass} icon-${size}`;
        return icon;
    }

    /**
     * Create action button
     * @param {string} label - Button label
     * @param {string} icon - Icon class
     * @param {string} variant - Button variant
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} Button element
     */
    createActionButton(label, icon = '', variant = 'secondary', onClick = null) {
        const button = document.createElement('button');
        button.className = `btn btn-${variant} btn-sm`;

        if (icon) {
            const iconEl = this.createIcon(icon);
            button.appendChild(iconEl);
        }

        if (label) {
            const text = document.createTextNode(` ${label}`);
            button.appendChild(text);
        }

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * Create empty state
     * @param {string} message - Empty state message
     * @param {string} icon - Icon class
     * @param {string} action - Action label
     * @param {Function} onAction - Action handler
     * @returns {HTMLElement} Empty state element
     */
    createEmptyState(message = 'No items found', icon = 'fas fa-inbox', action = '', onAction = null) {
        const container = document.createElement('div');
        container.className = 'empty-state';

        const iconEl = this.createIcon(icon, 'lg');
        container.appendChild(iconEl);

        const messageEl = document.createElement('p');
        messageEl.className = 'empty-message';
        messageEl.textContent = message;
        container.appendChild(messageEl);

        if (action && onAction) {
            const button = this.createActionButton(action, '', 'primary', onAction);
            container.appendChild(button);
        }

        return container;
    }
}

/**
 * Stat Card
 */
class StatCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            title: data.title || 'Stat',
            value: data.value || '0',
            icon: data.icon || 'fas fa-chart-bar',
            change: data.change || null,
            changeType: data.changeType || 'up',
            color: data.color || 'gold',
            subtitle: data.subtitle || '',
            target: data.target || null,
            ...data
        };
    }

    render() {
        this.element = this.createContainer('stat-card');
        this.element.dataset.color = this.data.color;

        // Icon
        const iconContainer = document.createElement('div');
        iconContainer.className = 'stat-icon';
        const icon = this.createIcon(this.data.icon, 'lg');
        iconContainer.appendChild(icon);
        this.element.appendChild(iconContainer);

        // Content
        const content = document.createElement('div');
        content.className = 'stat-content';

        const title = document.createElement('div');
        title.className = 'stat-title';
        title.textContent = this.data.title;
        content.appendChild(title);

        const value = document.createElement('div');
        value.className = 'stat-value';
        value.textContent = this.data.value;
        content.appendChild(value);

        if (this.data.subtitle) {
            const subtitle = document.createElement('div');
            subtitle.className = 'stat-subtitle';
            subtitle.textContent = this.data.subtitle;
            content.appendChild(subtitle);
        }

        if (this.data.change) {
            const change = document.createElement('div');
            change.className = `stat-change ${this.data.changeType}`;
            const arrow = this.data.changeType === 'up' ? '↑' : '↓';
            change.textContent = `${arrow} ${this.data.change}`;
            content.appendChild(change);
        }

        if (this.data.target) {
            const target = document.createElement('div');
            target.className = 'stat-target';
            target.textContent = `Target: ${this.data.target}`;
            content.appendChild(target);
        }

        this.element.appendChild(content);

        return this.element;
    }
}

/**
 * Lead Card
 */
class LeadCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            name: data.name || 'Unknown',
            company: data.company || '',
            status: data.status || 'New',
            score: data.score || 0,
            phone: data.phone || '',
            email: data.email || '',
            source: data.source || '',
            assignedTo: data.assignedTo || '',
            avatar: data.avatar || '',
            tags: data.tags || [],
            createdAt: data.createdAt || new Date().toISOString(),
            ...data
        };
    }

    render() {
        this.element = this.createContainer('lead-card');

        // Header
        const header = document.createElement('div');
        header.className = 'lead-card-header';

        // Avatar and Name
        const info = document.createElement('div');
        info.className = 'lead-info';

        const avatar = this.createAvatar(this.data.name, this.data.avatar);
        info.appendChild(avatar);

        const details = document.createElement('div');
        details.className = 'lead-details';

        const name = document.createElement('div');
        name.className = 'lead-name';
        name.textContent = this.data.name;
        details.appendChild(name);

        if (this.data.company) {
            const company = document.createElement('div');
            company.className = 'lead-company';
            company.textContent = this.data.company;
            details.appendChild(company);
        }

        info.appendChild(details);
        header.appendChild(info);

        // Status and Score
        const meta = document.createElement('div');
        meta.className = 'lead-meta';

        const status = this.createStatusBadge(this.data.status, this.data.status.toLowerCase());
        meta.appendChild(status);

        if (this.data.score) {
            const score = document.createElement('span');
            score.className = `lead-score ${this.getScoreClass(this.data.score)}`;
            score.textContent = `${this.data.score}%`;
            meta.appendChild(score);
        }

        header.appendChild(meta);
        this.element.appendChild(header);

        // Contact Info
        const contact = document.createElement('div');
        contact.className = 'lead-contact';

        if (this.data.phone) {
            const phone = document.createElement('div');
            phone.className = 'lead-phone';
            const icon = this.createIcon('fas fa-phone');
            phone.appendChild(icon);
            phone.appendChild(document.createTextNode(` ${this.data.phone}`));
            contact.appendChild(phone);
        }

        if (this.data.email) {
            const email = document.createElement('div');
            email.className = 'lead-email';
            const icon = this.createIcon('fas fa-envelope');
            email.appendChild(icon);
            email.appendChild(document.createTextNode(` ${this.data.email}`));
            contact.appendChild(email);
        }

        if (this.data.source) {
            const source = document.createElement('div');
            source.className = 'lead-source';
            const icon = this.createIcon('fas fa-tag');
            source.appendChild(icon);
            source.appendChild(document.createTextNode(` ${this.data.source}`));
            contact.appendChild(source);
        }

        this.element.appendChild(contact);

        // Tags
        if (this.data.tags && this.data.tags.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'lead-tags';
            this.data.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;
                tags.appendChild(tagEl);
            });
            this.element.appendChild(tags);
        }

        // Footer Actions
        const footer = this.createFooter();
        const actions = document.createElement('div');
        actions.className = 'lead-actions';

        const viewBtn = this.createActionButton('View', 'fas fa-eye', 'secondary');
        const editBtn = this.createActionButton('Edit', 'fas fa-edit', 'secondary');
        const whatsappBtn = this.createActionButton('WhatsApp', 'fab fa-whatsapp', 'secondary');

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(whatsappBtn);
        footer.appendChild(actions);

        this.element.appendChild(footer);

        return this.element;
    }

    getScoreClass(score) {
        if (score >= 80) return 'high';
        if (score >= 60) return 'medium';
        return 'low';
    }
}

/**
 * Deal Card
 */
class DealCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            title: data.title || 'Deal',
            customer: data.customer || '',
            value: data.value || 0,
            stage: data.stage || 'New',
            probability: data.probability || 0,
            expectedClose: data.expectedClose || '',
            assignedTo: data.assignedTo || '',
            tags: data.tags || [],
            ...data
        };
    }

    render() {
        this.element = this.createContainer('deal-card');

        // Header
        const header = document.createElement('div');
        header.className = 'deal-card-header';

        const title = document.createElement('div');
        title.className = 'deal-title';
        title.textContent = this.data.title;
        header.appendChild(title);

        const value = document.createElement('div');
        value.className = 'deal-value';
        value.textContent = `₹${this.data.value.toLocaleString()}`;
        header.appendChild(value);

        this.element.appendChild(header);

        // Customer
        if (this.data.customer) {
            const customer = document.createElement('div');
            customer.className = 'deal-customer';
            const icon = this.createIcon('fas fa-user');
            customer.appendChild(icon);
            customer.appendChild(document.createTextNode(` ${this.data.customer}`));
            this.element.appendChild(customer);
        }

        // Progress
        const progress = this.createProgress(this.data.probability, `Probability: ${this.data.probability}%`);
        this.element.appendChild(progress);

        // Meta
        const meta = document.createElement('div');
        meta.className = 'deal-meta';

        const stage = this.createStatusBadge(this.data.stage, this.data.stage.toLowerCase());
        meta.appendChild(stage);

        if (this.data.expectedClose) {
            const close = document.createElement('span');
            close.className = 'deal-close';
            const icon = this.createIcon('fas fa-calendar');
            close.appendChild(icon);
            close.appendChild(document.createTextNode(` ${this.formatDate(this.data.expectedClose)}`));
            meta.appendChild(close);
        }

        this.element.appendChild(meta);

        // Tags
        if (this.data.tags && this.data.tags.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'deal-tags';
            this.data.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;
                tags.appendChild(tagEl);
            });
            this.element.appendChild(tags);
        }

        // Footer Actions
        const footer = this.createFooter();
        const actions = document.createElement('div');
        actions.className = 'deal-actions';

        const viewBtn = this.createActionButton('View', 'fas fa-eye', 'secondary');
        const editBtn = this.createActionButton('Edit', 'fas fa-edit', 'secondary');
        const moveBtn = this.createActionButton('Move', 'fas fa-arrow-right', 'secondary');

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(moveBtn);
        footer.appendChild(actions);

        this.element.appendChild(footer);

        return this.element;
    }

    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

/**
 * Customer Card
 */
class CustomerCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            name: data.name || 'Unknown',
            company: data.company || '',
            email: data.email || '',
            phone: data.phone || '',
            category: data.category || 'Standard',
            totalRevenue: data.totalRevenue || 0,
            lastPurchase: data.lastPurchase || '',
            avatar: data.avatar || '',
            tags: data.tags || [],
            status: data.status || 'Active',
            ...data
        };
    }

    render() {
        this.element = this.createContainer('customer-card');

        // Header
        const header = document.createElement('div');
        header.className = 'customer-card-header';

        const avatar = this.createAvatar(this.data.name, this.data.avatar, 'lg');
        header.appendChild(avatar);

        const info = document.createElement('div');
        info.className = 'customer-info';

        const name = document.createElement('div');
        name.className = 'customer-name';
        name.textContent = this.data.name;
        info.appendChild(name);

        if (this.data.company) {
            const company = document.createElement('div');
            company.className = 'customer-company';
            company.textContent = this.data.company;
            info.appendChild(company);
        }

        header.appendChild(info);

        const status = this.createStatusBadge(this.data.status, this.data.status.toLowerCase());
        header.appendChild(status);

        this.element.appendChild(header);

        // Contact
        const contact = document.createElement('div');
        contact.className = 'customer-contact';

        if (this.data.email) {
            const email = document.createElement('div');
            email.className = 'customer-email';
            const icon = this.createIcon('fas fa-envelope');
            email.appendChild(icon);
            email.appendChild(document.createTextNode(` ${this.data.email}`));
            contact.appendChild(email);
        }

        if (this.data.phone) {
            const phone = document.createElement('div');
            phone.className = 'customer-phone';
            const icon = this.createIcon('fas fa-phone');
            phone.appendChild(icon);
            phone.appendChild(document.createTextNode(` ${this.data.phone}`));
            contact.appendChild(phone);
        }

        this.element.appendChild(contact);

        // Stats
        const stats = document.createElement('div');
        stats.className = 'customer-stats';

        const revenue = document.createElement('div');
        revenue.className = 'customer-stat';
        const revenueLabel = document.createElement('span');
        revenueLabel.className = 'stat-label';
        revenueLabel.textContent = 'Revenue';
        revenue.appendChild(revenueLabel);
        const revenueValue = document.createElement('span');
        revenueValue.className = 'stat-value';
        revenueValue.textContent = `₹${this.data.totalRevenue.toLocaleString()}`;
        revenue.appendChild(revenueValue);
        stats.appendChild(revenue);

        if (this.data.lastPurchase) {
            const purchase = document.createElement('div');
            purchase.className = 'customer-stat';
            const purchaseLabel = document.createElement('span');
            purchaseLabel.className = 'stat-label';
            purchaseLabel.textContent = 'Last Purchase';
            purchase.appendChild(purchaseLabel);
            const purchaseValue = document.createElement('span');
            purchaseValue.className = 'stat-value';
            purchaseValue.textContent = this.formatDate(this.data.lastPurchase);
            purchase.appendChild(purchaseValue);
            stats.appendChild(purchase);
        }

        const category = document.createElement('div');
        category.className = 'customer-stat';
        const categoryLabel = document.createElement('span');
        categoryLabel.className = 'stat-label';
        categoryLabel.textContent = 'Category';
        category.appendChild(categoryLabel);
        const categoryValue = document.createElement('span');
        categoryValue.className = 'stat-value';
        categoryValue.textContent = this.data.category;
        category.appendChild(categoryValue);
        stats.appendChild(category);

        this.element.appendChild(stats);

        // Tags
        if (this.data.tags && this.data.tags.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'customer-tags';
            this.data.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;
                tags.appendChild(tagEl);
            });
            this.element.appendChild(tags);
        }

        // Footer Actions
        const footer = this.createFooter();
        const actions = document.createElement('div');
        actions.className = 'customer-actions';

        const viewBtn = this.createActionButton('View', 'fas fa-eye', 'secondary');
        const editBtn = this.createActionButton('Edit', 'fas fa-edit', 'secondary');
        const invoiceBtn = this.createActionButton('Invoice', 'fas fa-file-invoice', 'secondary');

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(invoiceBtn);
        footer.appendChild(actions);

        this.element.appendChild(footer);

        return this.element;
    }

    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

/**
 * Task Card
 */
class TaskCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            title: data.title || 'Task',
            description: data.description || '',
            status: data.status || 'Pending',
            priority: data.priority || 'Medium',
            dueDate: data.dueDate || '',
            assignedTo: data.assignedTo || '',
            assignedBy: data.assignedBy || '',
            relatedTo: data.relatedTo || '',
            checklist: data.checklist || [],
            completed: data.completed || false,
            ...data
        };
    }

    render() {
        this.element = this.createContainer(`task-card ${this.data.completed ? 'completed' : ''}`);

        // Checkbox
        const checkbox = document.createElement('div');
        checkbox.className = 'task-checkbox';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.data.completed;
        input.addEventListener('change', () => {
            this.data.completed = input.checked;
            this.element.classList.toggle('completed', this.data.completed);
            if (this.options.onAction) {
                this.options.onAction('toggle', this.data);
            }
        });
        checkbox.appendChild(input);
        this.element.appendChild(checkbox);

        // Content
        const content = document.createElement('div');
        content.className = 'task-content';

        const title = document.createElement('div');
        title.className = `task-title ${this.data.completed ? 'completed' : ''}`;
        title.textContent = this.data.title;
        content.appendChild(title);

        if (this.data.description) {
            const description = document.createElement('div');
            description.className = 'task-description';
            description.textContent = this.data.description;
            content.appendChild(description);
        }

        // Meta
        const meta = document.createElement('div');
        meta.className = 'task-meta';

        if (this.data.priority) {
            const priority = document.createElement('span');
            priority.className = `task-priority ${this.data.priority.toLowerCase()}`;
            priority.textContent = this.data.priority;
            meta.appendChild(priority);
        }

        if (this.data.dueDate) {
            const due = document.createElement('span');
            due.className = 'task-due';
            const icon = this.createIcon('fas fa-calendar');
            due.appendChild(icon);
            due.appendChild(document.createTextNode(` Due: ${this.formatDate(this.data.dueDate)}`));
            meta.appendChild(due);
        }

        if (this.data.assignedTo) {
            const assigned = document.createElement('span');
            assigned.className = 'task-assigned';
            const icon = this.createIcon('fas fa-user');
            assigned.appendChild(icon);
            assigned.appendChild(document.createTextNode(` ${this.data.assignedTo}`));
            meta.appendChild(assigned);
        }

        content.appendChild(meta);

        // Checklist
        if (this.data.checklist && this.data.checklist.length > 0) {
            const checklist = document.createElement('div');
            checklist.className = 'task-checklist';
            this.data.checklist.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'checklist-item';
                const itemCheck = document.createElement('input');
                itemCheck.type = 'checkbox';
                itemCheck.checked = item.completed;
                itemCheck.addEventListener('change', () => {
                    item.completed = itemCheck.checked;
                    if (this.options.onAction) {
                        this.options.onAction('checklist', { item, task: this.data });
                    }
                });
                itemEl.appendChild(itemCheck);
                const label = document.createElement('span');
                label.className = item.completed ? 'completed' : '';
                label.textContent = item.text;
                itemEl.appendChild(label);
                checklist.appendChild(itemEl);
            });
            content.appendChild(checklist);
        }

        this.element.appendChild(content);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const editBtn = this.createActionButton('', 'fas fa-edit', 'ghost');
        const deleteBtn = this.createActionButton('', 'fas fa-trash', 'ghost');
        const commentBtn = this.createActionButton('', 'fas fa-comment', 'ghost');

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        actions.appendChild(commentBtn);
        this.element.appendChild(actions);

        return this.element;
    }

    formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) return `${Math.abs(days)} days overdue`;
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        return `In ${days} days`;
    }
}

/**
 * Activity Card
 */
class ActivityCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            type: data.type || 'activity',
            title: data.title || 'Activity',
            description: data.description || '',
            timestamp: data.timestamp || new Date().toISOString(),
            user: data.user || '',
            icon: data.icon || 'fas fa-clock',
            color: data.color || 'gold',
            actions: data.actions || [],
            metadata: data.metadata || {},
            ...data
        };
    }

    render() {
        this.element = this.createContainer('activity-card');

        // Icon
        const iconContainer = document.createElement('div');
        iconContainer.className = `activity-icon ${this.data.color}`;
        const icon = this.createIcon(this.data.icon);
        iconContainer.appendChild(icon);
        this.element.appendChild(iconContainer);

        // Content
        const content = document.createElement('div');
        content.className = 'activity-content';

        const header = document.createElement('div');
        header.className = 'activity-header';

        const title = document.createElement('div');
        title.className = 'activity-title';
        title.textContent = this.data.title;
        header.appendChild(title);

        const time = document.createElement('span');
        time.className = 'activity-time';
        time.textContent = this.formatTimeAgo(this.data.timestamp);
        header.appendChild(time);

        content.appendChild(header);

        if (this.data.description) {
            const description = document.createElement('div');
            description.className = 'activity-description';
            description.textContent = this.data.description;
            content.appendChild(description);
        }

        if (this.data.user) {
            const user = document.createElement('div');
            user.className = 'activity-user';
            const avatar = this.createAvatar(this.data.user, '', 'sm');
            user.appendChild(avatar);
            user.appendChild(document.createTextNode(` ${this.data.user}`));
            content.appendChild(user);
        }

        // Metadata
        if (Object.keys(this.data.metadata).length > 0) {
            const meta = document.createElement('div');
            meta.className = 'activity-metadata';
            Object.entries(this.data.metadata).forEach(([key, value]) => {
                const item = document.createElement('span');
                item.className = 'meta-item';
                item.textContent = `${key}: ${value}`;
                meta.appendChild(item);
            });
            content.appendChild(meta);
        }

        // Actions
        if (this.data.actions && this.data.actions.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'activity-actions';
            this.data.actions.forEach(action => {
                const btn = this.createActionButton(
                    action.label,
                    action.icon || '',
                    action.variant || 'secondary',
                    action.onClick
                );
                actions.appendChild(btn);
            });
            content.appendChild(actions);
        }

        this.element.appendChild(content);

        return this.element;
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now.getTime() - then.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
}

/**
 * Metric Card
 */
class MetricCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            title: data.title || 'Metric',
            value: data.value || '0',
            unit: data.unit || '',
            trend: data.trend || null,
            trendData: data.trendData || [],
            description: data.description || '',
            color: data.color || 'gold',
            icon: data.icon || 'fas fa-chart-bar',
            ...data
        };
    }

    render() {
        this.element = this.createContainer('metric-card');

        // Header
        const header = document.createElement('div');
        header.className = 'metric-header';

        const title = document.createElement('div');
        title.className = 'metric-title';
        title.textContent = this.data.title;
        header.appendChild(title);

        const icon = this.createIcon(this.data.icon);
        icon.className += ` metric-icon-${this.data.color}`;
        header.appendChild(icon);

        this.element.appendChild(header);

        // Value
        const valueContainer = document.createElement('div');
        valueContainer.className = 'metric-value-container';

        const value = document.createElement('div');
        value.className = `metric-value ${this.data.color}`;
        value.textContent = this.data.value;
        valueContainer.appendChild(value);

        if (this.data.unit) {
            const unit = document.createElement('span');
            unit.className = 'metric-unit';
            unit.textContent = this.data.unit;
            valueContainer.appendChild(unit);
        }

        this.element.appendChild(valueContainer);

        // Trend
        if (this.data.trend) {
            const trend = document.createElement('div');
            trend.className = `metric-trend ${this.data.trend.type}`;
            const arrow = this.data.trend.type === 'up' ? '↑' : '↓';
            trend.textContent = `${arrow} ${this.data.trend.value}%`;
            this.element.appendChild(trend);
        }

        // Sparkline (trend data)
        if (this.data.trendData && this.data.trendData.length > 0) {
            const sparkline = this.createSparkline(this.data.trendData);
            this.element.appendChild(sparkline);
        }

        // Description
        if (this.data.description) {
            const description = document.createElement('div');
            description.className = 'metric-description';
            description.textContent = this.data.description;
            this.element.appendChild(description);
        }

        return this.element;
    }

    createSparkline(data) {
        const container = document.createElement('div');
        container.className = 'metric-sparkline';

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        data.forEach((value, index) => {
            const bar = document.createElement('div');
            bar.className = 'sparkline-bar';
            const height = ((value - min) / range) * 100;
            bar.style.height = `${Math.max(10, height)}%`;
            bar.style.animationDelay = `${index * 0.05}s`;
            container.appendChild(bar);
        });

        return container;
    }
}

/**
 * Timeline Card
 */
class TimelineCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            title: data.title || 'Timeline',
            items: data.items || [],
            ...data
        };
    }

    render() {
        this.element = this.createContainer('timeline-card');

        // Header
        if (this.data.title) {
            const header = this.createHeader(this.data.title);
            this.element.appendChild(header);
        }

        // Timeline
        const timeline = document.createElement('div');
        timeline.className = 'timeline';

        if (this.data.items.length === 0) {
            const empty = this.createEmptyState('No timeline events');
            timeline.appendChild(empty);
        } else {
            this.data.items.forEach((item, index) => {
                const event = document.createElement('div');
                event.className = `timeline-event ${index === this.data.items.length - 1 ? 'last' : ''}`;

                const dot = document.createElement('div');
                dot.className = `timeline-dot ${item.color || 'gold'}`;
                event.appendChild(dot);

                const content = document.createElement('div');
                content.className = 'timeline-content';

                const header = document.createElement('div');
                header.className = 'timeline-header';

                const title = document.createElement('span');
                title.className = 'timeline-title';
                title.textContent = item.title;
                header.appendChild(title);

                const time = document.createElement('span');
                time.className = 'timeline-time';
                time.textContent = this.formatTimeAgo(item.timestamp);
                header.appendChild(time);

                content.appendChild(header);

                if (item.description) {
                    const description = document.createElement('div');
                    description.className = 'timeline-description';
                    description.textContent = item.description;
                    content.appendChild(description);
                }

                if (item.icon) {
                    const icon = this.createIcon(item.icon);
                    content.appendChild(icon);
                }

                event.appendChild(content);
                timeline.appendChild(event);
            });
        }

        this.element.appendChild(timeline);

        return this.element;
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now.getTime() - then.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
}

/**
 * Notification Card
 */
class NotificationCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            title: data.title || 'Notification',
            message: data.message || '',
            type: data.type || 'info', // info, success, warning, error
            timestamp: data.timestamp || new Date().toISOString(),
            read: data.read || false,
            actions: data.actions || [],
            icon: data.icon || null,
            ...data
        };
    }

    render() {
        this.element = this.createContainer(`notification-card ${this.data.read ? 'read' : 'unread'}`);
        this.element.dataset.type = this.data.type;

        // Icon
        const iconContainer = document.createElement('div');
        iconContainer.className = `notification-icon ${this.data.type}`;
        const icon = this.createIcon(this.getTypeIcon(this.data.type));
        iconContainer.appendChild(icon);
        this.element.appendChild(iconContainer);

        // Content
        const content = document.createElement('div');
        content.className = 'notification-content';

        const header = document.createElement('div');
        header.className = 'notification-header';

        const title = document.createElement('div');
        title.className = 'notification-title';
        title.textContent = this.data.title;
        header.appendChild(title);

        const time = document.createElement('span');
        time.className = 'notification-time';
        time.textContent = this.formatTimeAgo(this.data.timestamp);
        header.appendChild(time);

        content.appendChild(header);

        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = this.data.message;
        content.appendChild(message);

        // Actions
        if (this.data.actions && this.data.actions.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'notification-actions';
            this.data.actions.forEach(action => {
                const btn = this.createActionButton(
                    action.label,
                    action.icon || '',
                    action.variant || 'secondary',
                    action.onClick
                );
                actions.appendChild(btn);
            });
            content.appendChild(actions);
        }

        this.element.appendChild(content);

        // Mark as read button
        if (!this.data.read) {
            const markRead = document.createElement('button');
            markRead.className = 'notification-mark-read';
            markRead.innerHTML = '×';
            markRead.addEventListener('click', () => {
                this.data.read = true;
                this.element.classList.remove('unread');
                this.element.classList.add('read');
                if (this.options.onAction) {
                    this.options.onAction('read', this.data);
                }
            });
            this.element.appendChild(markRead);
        }

        return this.element;
    }

    getTypeIcon(type) {
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        return icons[type] || icons.info;
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now.getTime() - then.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
}

/**
 * Profile Card
 */
class ProfileCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            id: data.id || '',
            name: data.name || 'Unknown',
            title: data.title || '',
            company: data.company || '',
            email: data.email || '',
            phone: data.phone || '',
            avatar: data.avatar || '',
            bio: data.bio || '',
            stats: data.stats || [],
            social: data.social || [],
            ...data
        };
    }

    render() {
        this.element = this.createContainer('profile-card');

        // Profile Header
        const header = document.createElement('div');
        header.className = 'profile-header';

        const avatar = this.createAvatar(this.data.name, this.data.avatar, 'xl');
        header.appendChild(avatar);

        const info = document.createElement('div');
        info.className = 'profile-info';

        const name = document.createElement('div');
        name.className = 'profile-name';
        name.textContent = this.data.name;
        info.appendChild(name);

        if (this.data.title) {
            const title = document.createElement('div');
            title.className = 'profile-title';
            title.textContent = this.data.title;
            info.appendChild(title);
        }

        if (this.data.company) {
            const company = document.createElement('div');
            company.className = 'profile-company';
            company.textContent = this.data.company;
            info.appendChild(company);
        }

        header.appendChild(info);
        this.element.appendChild(header);

        // Contact
        const contact = document.createElement('div');
        contact.className = 'profile-contact';

        if (this.data.email) {
            const email = document.createElement('div');
            email.className = 'profile-email';
            const icon = this.createIcon('fas fa-envelope');
            email.appendChild(icon);
            email.appendChild(document.createTextNode(` ${this.data.email}`));
            contact.appendChild(email);
        }

        if (this.data.phone) {
            const phone = document.createElement('div');
            phone.className = 'profile-phone';
            const icon = this.createIcon('fas fa-phone');
            phone.appendChild(icon);
            phone.appendChild(document.createTextNode(` ${this.data.phone}`));
            contact.appendChild(phone);
        }

        this.element.appendChild(contact);

        // Bio
        if (this.data.bio) {
            const bio = document.createElement('div');
            bio.className = 'profile-bio';
            bio.textContent = this.data.bio;
            this.element.appendChild(bio);
        }

        // Stats
        if (this.data.stats && this.data.stats.length > 0) {
            const stats = document.createElement('div');
            stats.className = 'profile-stats';
            this.data.stats.forEach(stat => {
                const item = document.createElement('div');
                item.className = 'profile-stat';
                const value = document.createElement('span');
                value.className = 'stat-value';
                value.textContent = stat.value;
                item.appendChild(value);
                const label = document.createElement('span');
                label.className = 'stat-label';
                label.textContent = stat.label;
                item.appendChild(label);
                stats.appendChild(item);
            });
            this.element.appendChild(stats);
        }

        // Social
        if (this.data.social && this.data.social.length > 0) {
            const social = document.createElement('div');
            social.className = 'profile-social';
            this.data.social.forEach(item => {
                const link = document.createElement('a');
                link.href = item.url;
                link.target = '_blank';
                link.className = 'social-link';
                const icon = this.createIcon(item.icon);
                link.appendChild(icon);
                social.appendChild(link);
            });
            this.element.appendChild(social);
        }

        // Actions
        const footer = this.createFooter();
        const actions = document.createElement('div');
        actions.className = 'profile-actions';

        const editBtn = this.createActionButton('Edit Profile', 'fas fa-edit', 'primary');
        const messageBtn = this.createActionButton('Message', 'fas fa-comment', 'secondary');

        actions.appendChild(editBtn);
        actions.appendChild(messageBtn);
        footer.appendChild(actions);

        this.element.appendChild(footer);

        return this.element;
    }
}

/**
 * Summary Card
 */
class SummaryCard extends BaseCard {
    constructor(data, options = {}) {
        super(data, options);
        this.data = {
            title: data.title || 'Summary',
            items: data.items || [],
            columns: data.columns || 2,
            ...data
        };
    }

    render() {
        this.element = this.createContainer('summary-card');

        // Header
        if (this.data.title) {
            const header = this.createHeader(this.data.title);
            this.element.appendChild(header);
        }

        // Grid
        const grid = document.createElement('div');
        grid.className = `summary-grid columns-${this.data.columns}`;

        if (this.data.items.length === 0) {
            const empty = this.createEmptyState('No summary items');
            grid.appendChild(empty);
        } else {
            this.data.items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'summary-item';

                const label = document.createElement('div');
                label.className = 'summary-label';
                label.textContent = item.label;
                card.appendChild(label);

                const value = document.createElement('div');
                value.className = `summary-value ${item.color || ''}`;
                value.textContent = item.value;
                card.appendChild(value);

                if (item.change) {
                    const change = document.createElement('div');
                    change.className = `summary-change ${item.changeType || 'neutral'}`;
                    const arrow = item.changeType === 'up' ? '↑' : item.changeType === 'down' ? '↓' : '';
                    change.textContent = `${arrow} ${item.change}`;
                    card.appendChild(change);
                }

                if (item.icon) {
                    const icon = this.createIcon(item.icon);
                    icon.className += ' summary-icon';
                    card.prepend(icon);
                }

                grid.appendChild(card);
            });
        }

        this.element.appendChild(grid);

        return this.element;
    }
}

// Export all components
export {
    BaseCard,
    StatCard,
    LeadCard,
    DealCard,
    CustomerCard,
    TaskCard,
    ActivityCard,
    MetricCard,
    TimelineCard,
    NotificationCard,
    ProfileCard,
    SummaryCard
};
