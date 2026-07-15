/**
 * ==========================================
 * FILE: Sidebar.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade sidebar component for 11 Avatar CRM.
 * Provides navigation, user profile, notifications, and
 * collapsible menu with sub-navigation support.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Collapsible Navigation
 * - Nested Menu Items
 * - Active State Tracking
 * - User Profile Section
 * - Notification Badges
 * - Keyboard Navigation
 * - Accessibility Ready
 * - Theme Support (Light/Dark)
 * - Responsive Design
 * - Customizable Icons
 * - Search in Sidebar
 * - Quick Actions
 * - Collapse/Expand
 * - Mobile Support
 * 
 * USAGE EXAMPLE:
 * import { Sidebar } from './components/Sidebar.js';
 * 
 * const sidebar = new Sidebar({
 *   container: '#sidebar',
 *   logo: { text: '11 Avatar', icon: '🚀' },
 *   menuItems: [
 *     {
 *       id: 'dashboard',
 *       label: 'Dashboard',
 *       icon: 'fas fa-th-large',
 *       href: '/dashboard',
 *       active: true
 *     },
 *     {
 *       id: 'leads',
 *       label: 'Leads',
 *       icon: 'fas fa-users',
 *       href: '/leads',
 *       badge: '142'
 *     },
 *     {
 *       id: 'sales',
 *       label: 'Sales',
 *       icon: 'fas fa-chart-line',
 *       children: [
 *         { id: 'pipeline', label: 'Pipeline', href: '/pipeline' },
 *         { id: 'deals', label: 'Deals', href: '/deals' }
 *       ]
 *     }
 *   ],
 *   user: {
 *     name: 'Rajesh Kumar',
 *     email: 'rajesh@11avatar.com',
 *     role: 'Platform Owner',
 *     avatar: ''
 *   },
 *   onMenuItemClick: (item) => { ... },
 *   onLogout: () => { ... },
 *   onToggle: (collapsed) => { ... }
 * });
 * 
 * sidebar.render();
 * ==========================================
 */

export class Sidebar {
    /**
     * Sidebar constructor
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        this.config = {
            container: options.container || '#sidebar',
            logo: options.logo || { text: '11 Avatar', icon: '🚀' },
            logoUrl: options.logoUrl || '/',
            menuItems: options.menuItems || [],
            user: options.user || null,
            notifications: options.notifications || [],
            showSearch: options.showSearch !== undefined ? options.showSearch : true,
            showUser: options.showUser !== undefined ? options.showUser : true,
            collapsible: options.collapsible !== undefined ? options.collapsible : true,
            collapsed: options.collapsed || false,
            theme: options.theme || 'light',
            sticky: options.sticky !== undefined ? options.sticky : true,
            width: options.width || '260px',
            collapsedWidth: options.collapsedWidth || '72px',
            onMenuItemClick: options.onMenuItemClick || null,
            onToggle: options.onToggle || null,
            onLogout: options.onLogout || null,
            onUserMenuClick: options.onUserMenuClick || null,
            onNotificationClick: options.onNotificationClick || null,
            ...options
        };

        // Internal state
        this.state = {
            collapsed: this.config.collapsed,
            expandedItems: new Set(),
            activeItem: null,
            isMobile: window.innerWidth < 768,
            isOpen: false
        };

        // DOM references
        this.element = null;
        this.container = null;
        this.menuElement = null;
        this.userElement = null;
        this.searchElement = null;
        this.toggleButton = null;
        this.overlay = null;

        // Event listeners
        this.eventListeners = [];
        this.menuItemListeners = [];

        // Bind methods
        this.bindMethods();

        // Auto-initialize if container exists
        if (document.querySelector(this.config.container)) {
            this.render();
        }
    }

    /**
     * Bind methods to instance
     */
    bindMethods() {
        this.render = this.render.bind(this);
        this.destroy = this.destroy.bind(this);
        this.update = this.update.bind(this);
        this.toggle = this.toggle.bind(this);
        this.collapse = this.collapse.bind(this);
        this.expand = this.expand.bind(this);
        this.toggleMenuItem = this.toggleMenuItem.bind(this);
        this.expandMenuItem = this.expandMenuItem.bind(this);
        this.collapseMenuItem = this.collapseMenuItem.bind(this);
        this.setActiveItem = this.setActiveItem.bind(this);
        this.getActiveItem = this.getActiveItem.bind(this);
        this.addMenuItem = this.addMenuItem.bind(this);
        this.removeMenuItem = this.removeMenuItem.bind(this);
        this.updateBadge = this.updateBadge.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Render the sidebar
     * @returns {Sidebar} this (for chaining)
     */
    render() {
        try {
            // Get container
            this.container = document.querySelector(this.config.container);
            if (!this.container) {
                throw new Error(`Container "${this.config.container}" not found`);
            }

            // Clear container
            this.container.innerHTML = '';

            // Create sidebar element
            this.element = document.createElement('aside');
            this.element.className = `crm-sidebar theme-${this.config.theme}`;
            this.element.dataset.collapsed = this.state.collapsed;
            this.element.dataset.sticky = this.config.sticky;
            this.element.style.setProperty('--sidebar-width', this.config.width);
            this.element.style.setProperty('--sidebar-collapsed-width', this.config.collapsedWidth);

            if (this.config.sticky) {
                this.element.classList.add('sticky');
            }

            // Build overlay (mobile)
            this.overlay = document.createElement('div');
            this.overlay.className = 'sidebar-overlay';
            this.overlay.addEventListener('click', () => this.close());

            // Build sidebar structure
            this.buildStructure();

            // Append to container
            this.container.appendChild(this.element);
            this.container.appendChild(this.overlay);

            // Setup event listeners
            this.setupEventListeners();

            // Setup resize handler
            this.setupResizeHandler();

            // Set active item
            this.setActiveItem();

            return this;
        } catch (error) {
            console.error('[Sidebar] Render error:', error);
            return this;
        }
    }

    /**
     * Build sidebar structure
     */
    buildStructure() {
        // Logo
        const logo = this.buildLogo();
        this.element.appendChild(logo);

        // Toggle button
        if (this.config.collapsible) {
            const toggle = this.buildToggleButton();
            this.element.appendChild(toggle);
            this.toggleButton = toggle;
        }

        // Search
        if (this.config.showSearch) {
            const search = this.buildSearch();
            this.element.appendChild(search);
            this.searchElement = search;
        }

        // Menu
        const menu = this.buildMenu();
        this.element.appendChild(menu);
        this.menuElement = menu;

        // User profile
        if (this.config.showUser && this.config.user) {
            const user = this.buildUser();
            this.element.appendChild(user);
            this.userElement = user;
        }

        // Bottom section
        const bottom = this.buildBottom();
        this.element.appendChild(bottom);
    }

    /**
     * Build logo
     * @returns {HTMLElement} Logo element
     */
    buildLogo() {
        const logo = document.createElement('div');
        logo.className = 'sidebar-logo';

        const link = document.createElement('a');
        link.href = this.config.logoUrl;
        link.className = 'logo-link';

        if (this.config.logo.icon) {
            const icon = document.createElement('span');
            icon.className = 'logo-icon';
            icon.textContent = this.config.logo.icon;
            link.appendChild(icon);
        }

        if (this.config.logo.image) {
            const img = document.createElement('img');
            img.src = this.config.logo.image;
            img.alt = this.config.logo.text || 'Logo';
            img.className = 'logo-image';
            link.appendChild(img);
        }

        if (this.config.logo.text) {
            const text = document.createElement('span');
            text.className = 'logo-text';
            const parts = this.config.logo.text.split(' ');
            text.innerHTML = parts.map((part, i) => 
                i === parts.length - 1 ? `<span class="gold">${part}</span>` : part
            ).join(' ');
            link.appendChild(text);
        }

        logo.appendChild(link);

        return logo;
    }

    /**
     * Build toggle button
     * @returns {HTMLElement} Toggle button
     */
    buildToggleButton() {
        const button = document.createElement('button');
        button.className = 'sidebar-toggle';
        button.setAttribute('aria-label', 'Toggle sidebar');
        button.setAttribute('title', 'Toggle sidebar');
        button.innerHTML = this.state.collapsed ? '→' : '←';
        button.addEventListener('click', () => this.toggle());

        return button;
    }

    /**
     * Build search
     * @returns {HTMLElement} Search element
     */
    buildSearch() {
        const container = document.createElement('div');
        container.className = 'sidebar-search';

        const input = document.createElement('input');
        input.type = 'search';
        input.placeholder = 'Search...';
        input.setAttribute('aria-label', 'Search in sidebar');
        input.className = 'search-input';

        const icon = document.createElement('span');
        icon.className = 'search-icon';
        icon.textContent = '🔍';

        container.appendChild(icon);
        container.appendChild(input);

        // Event listeners
        input.addEventListener('input', (e) => {
            this.filterMenu(e.target.value);
        });

        return container;
    }

    /**
     * Build menu
     * @returns {HTMLElement} Menu element
     */
    buildMenu() {
        const nav = document.createElement('nav');
        nav.className = 'sidebar-nav';
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', 'Main navigation');

        const list = document.createElement('ul');
        list.className = 'nav-list';

        this.config.menuItems.forEach((item) => {
            const li = this.buildMenuItem(item);
            list.appendChild(li);
        });

        nav.appendChild(list);

        return nav;
    }

    /**
     * Build a menu item
     * @param {object} item - Menu item data
     * @param {number} level - Nesting level
     * @returns {HTMLElement} Menu item element
     */
    buildMenuItem(item, level = 0) {
        const li = document.createElement('li');
        li.className = `nav-item level-${level}`;
        li.dataset.id = item.id;

        // Check if item has children
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = this.state.expandedItems.has(item.id);

        if (hasChildren) {
            li.classList.add('has-children');
            if (isExpanded) {
                li.classList.add('expanded');
            }
        }

        // Item link
        const link = document.createElement('a');
        link.className = `nav-link ${item.active ? 'active' : ''}`;
        link.href = item.href || '#';

        if (item.icon) {
            const icon = document.createElement('span');
            icon.className = `nav-icon ${item.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            link.appendChild(icon);
        }

        const label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = item.label;
        link.appendChild(label);

        if (item.badge) {
            const badge = document.createElement('span');
            badge.className = `nav-badge ${item.badgeType || ''}`;
            badge.textContent = item.badge;
            link.appendChild(badge);
        }

        if (hasChildren) {
            const arrow = document.createElement('span');
            arrow.className = `nav-arrow ${isExpanded ? 'expanded' : ''}`;
            arrow.textContent = '▾';
            link.appendChild(arrow);
        }

        // Click handler
        link.addEventListener('click', (e) => {
            if (hasChildren) {
                e.preventDefault();
                this.toggleMenuItem(item.id);
            } else {
                if (this.config.onMenuItemClick) {
                    e.preventDefault();
                    this.config.onMenuItemClick(item);
                }
                this.setActiveItem(item.id);
                this.close();
            }
        });

        li.appendChild(link);

        // Children
        if (hasChildren) {
            const childList = document.createElement('ul');
            childList.className = 'nav-children';
            childList.style.display = isExpanded ? 'block' : 'none';

            item.children.forEach((child) => {
                const childLi = this.buildMenuItem(child, level + 1);
                childList.appendChild(childLi);
            });

            li.appendChild(childList);
        }

        return li;
    }

    /**
     * Build user profile
     * @returns {HTMLElement} User element
     */
    buildUser() {
        const container = document.createElement('div');
        container.className = 'sidebar-user';

        const user = this.config.user;

        // User button
        const button = document.createElement('button');
        button.className = 'user-button';
        button.setAttribute('aria-label', 'User menu');
        button.setAttribute('aria-expanded', 'false');

        // Avatar
        if (user.avatar) {
            const avatar = document.createElement('img');
            avatar.src = user.avatar;
            avatar.alt = user.name || 'User';
            avatar.className = 'user-avatar';
            button.appendChild(avatar);
        } else {
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar placeholder';
            const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
            avatar.textContent = initials;
            button.appendChild(avatar);
        }

        // User info
        const info = document.createElement('div');
        info.className = 'user-info';

        const name = document.createElement('span');
        name.className = 'user-name';
        name.textContent = user.name || 'User';
        info.appendChild(name);

        if (user.role) {
            const role = document.createElement('span');
            role.className = 'user-role';
            role.textContent = user.role;
            info.appendChild(role);
        }

        button.appendChild(info);

        // Dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.style.display = 'none';

        // User email
        if (user.email) {
            const email = document.createElement('div');
            email.className = 'dropdown-email';
            email.textContent = user.email;
            dropdown.appendChild(email);
        }

        const divider = document.createElement('hr');
        divider.className = 'dropdown-divider';
        dropdown.appendChild(divider);

        // Menu items
        const menuItems = [
            { label: 'Profile', icon: '👤', action: 'profile' },
            { label: 'Settings', icon: '⚙️', action: 'settings' },
            { label: 'Help', icon: '❓', action: 'help' }
        ];

        if (user.menuItems) {
            menuItems.push(...user.menuItems);
        }

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'dropdown-item';
            menuItem.innerHTML = `<span class="dropdown-icon">${item.icon || ''}</span> ${item.label}`;
            menuItem.addEventListener('click', () => {
                if (item.action === 'logout') {
                    if (this.config.onLogout) {
                        this.config.onLogout();
                    }
                } else if (this.config.onUserMenuClick) {
                    this.config.onUserMenuClick(item);
                }
                dropdown.style.display = 'none';
                button.setAttribute('aria-expanded', 'false');
            });
            dropdown.appendChild(menuItem);
        });

        const divider2 = document.createElement('hr');
        divider2.className = 'dropdown-divider';
        dropdown.appendChild(divider2);

        // Logout
        const logout = document.createElement('div');
        logout.className = 'dropdown-item logout';
        logout.innerHTML = '🚪 Logout';
        logout.addEventListener('click', () => {
            if (this.config.onLogout) {
                this.config.onLogout();
            }
            dropdown.style.display = 'none';
            button.setAttribute('aria-expanded', 'false');
        });
        dropdown.appendChild(logout);

        // Click handlers
        button.addEventListener('click', () => {
            const isOpen = dropdown.style.display === 'block';
            dropdown.style.display = isOpen ? 'none' : 'block';
            button.setAttribute('aria-expanded', !isOpen);
        });

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    /**
     * Build bottom section
     * @returns {HTMLElement} Bottom element
     */
    buildBottom() {
        const bottom = document.createElement('div');
        bottom.className = 'sidebar-bottom';

        // Quick actions
        const actions = document.createElement('div');
        actions.className = 'quick-actions';
        actions.innerHTML = `
            <button class="quick-action" title="Add Lead" aria-label="Add Lead">➕</button>
            <button class="quick-action" title="Add Task" aria-label="Add Task">✅</button>
            <button class="quick-action" title="Settings" aria-label="Settings">⚙️</button>
        `;

        // Theme toggle
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = this.config.theme === 'dark' ? '☀️' : '🌙';
        themeToggle.setAttribute('aria-label', 'Toggle theme');
        themeToggle.addEventListener('click', () => {
            // Theme toggle handled by parent component
        });

        bottom.appendChild(actions);
        bottom.appendChild(themeToggle);

        return bottom;
    }

    /**
     * Filter menu items
     * @param {string} query - Search query
     */
    filterMenu(query) {
        const items = this.menuElement?.querySelectorAll('.nav-item');
        if (!items) return;

        const searchTerm = query.toLowerCase().trim();

        items.forEach(item => {
            const label = item.querySelector('.nav-label')?.textContent?.toLowerCase() || '';
            const shouldShow = !searchTerm || label.includes(searchTerm);
            item.style.display = shouldShow ? '' : 'none';
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Click outside to close
        document.addEventListener('click', this.handleClickOutside);

        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown);

        this.eventListeners.push(
            { element: document, event: 'click', handler: this.handleClickOutside },
            { element: document, event: 'keydown', handler: this.handleKeyDown }
        );
    }

    /**
     * Setup resize handler
     */
    setupResizeHandler() {
        const handler = () => {
            const isMobile = window.innerWidth < 768;
            if (isMobile !== this.state.isMobile) {
                this.state.isMobile = isMobile;
                if (!isMobile) {
                    this.close();
                }
            }
        };

        window.addEventListener('resize', handler);
        this.eventListeners.push({ element: window, event: 'resize', handler });
    }

    /**
     * Handle click outside
     * @param {Event} e - Click event
     */
    handleClickOutside(e) {
        if (this.state.isMobile && this.state.isOpen) {
            if (!this.element.contains(e.target)) {
                this.close();
            }
        }

        // User dropdown
        if (this.userElement) {
            const dropdown = this.userElement.querySelector('.user-dropdown');
            const button = this.userElement.querySelector('.user-button');
            if (dropdown && button) {
                if (!this.userElement.contains(e.target)) {
                    dropdown.style.display = 'none';
                    button.setAttribute('aria-expanded', 'false');
                }
            }
        }
    }

    /**
     * Handle key down
     * @param {Event} e - Keyboard event
     */
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
            // Close user dropdown
            if (this.userElement) {
                const dropdown = this.userElement.querySelector('.user-dropdown');
                const button = this.userElement.querySelector('.user-button');
                if (dropdown && dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                    button?.setAttribute('aria-expanded', 'false');
                }
            }
        }
    }

    /**
     * Toggle sidebar collapse
     */
    toggle() {
        if (this.state.isMobile) {
            this.state.isOpen = !this.state.isOpen;
            this.element.classList.toggle('open', this.state.isOpen);
            this.overlay.classList.toggle('show', this.state.isOpen);
            document.body.style.overflow = this.state.isOpen ? 'hidden' : '';
        } else {
            this.state.collapsed = !this.state.collapsed;
            this.element.dataset.collapsed = this.state.collapsed;
            if (this.toggleButton) {
                this.toggleButton.innerHTML = this.state.collapsed ? '→' : '←';
            }
            if (this.config.onToggle) {
                this.config.onToggle(this.state.collapsed);
            }
        }
    }

    /**
     * Collapse sidebar
     */
    collapse() {
        if (!this.state.collapsed) {
            this.toggle();
        }
    }

    /**
     * Expand sidebar
     */
    expand() {
        if (this.state.collapsed) {
            this.toggle();
        }
    }

    /**
     * Toggle menu item expansion
     * @param {string} itemId - Menu item ID
     */
    toggleMenuItem(itemId) {
        if (this.state.expandedItems.has(itemId)) {
            this.collapseMenuItem(itemId);
        } else {
            this.expandMenuItem(itemId);
        }
    }

    /**
     * Expand menu item
     * @param {string} itemId - Menu item ID
     */
    expandMenuItem(itemId) {
        this.state.expandedItems.add(itemId);
        const item = this.menuElement?.querySelector(`[data-id="${itemId}"]`);
        if (item) {
            item.classList.add('expanded');
            const children = item.querySelector('.nav-children');
            if (children) {
                children.style.display = 'block';
            }
        }
    }

    /**
     * Collapse menu item
     * @param {string} itemId - Menu item ID
     */
    collapseMenuItem(itemId) {
        this.state.expandedItems.delete(itemId);
        const item = this.menuElement?.querySelector(`[data-id="${itemId}"]`);
        if (item) {
            item.classList.remove('expanded');
            const children = item.querySelector('.nav-children');
            if (children) {
                children.style.display = 'none';
            }
        }
    }

    /**
     * Set active menu item
     * @param {string} itemId - Menu item ID
     */
    setActiveItem(itemId) {
        const activeId = itemId || this.state.activeItem;
        if (!activeId) return;

        // Remove active from all
        this.menuElement?.querySelectorAll('.nav-link.active').forEach(el => {
            el.classList.remove('active');
        });

        // Set active on target
        const item = this.menuElement?.querySelector(`[data-id="${activeId}"] .nav-link`);
        if (item) {
            item.classList.add('active');
            this.state.activeItem = activeId;
        }
    }

    /**
     * Get active menu item ID
     * @returns {string|null} Active item ID
     */
    getActiveItem() {
        return this.state.activeItem;
    }

    /**
     * Add menu item
     * @param {object} item - Menu item data
     * @param {string} parentId - Parent item ID (optional)
     */
    addMenuItem(item, parentId = null) {
        if (parentId) {
            const parent = this.menuElement?.querySelector(`[data-id="${parentId}"] .nav-children`);
            if (parent) {
                const li = this.buildMenuItem(item);
                parent.appendChild(li);
                return;
            }
        }

        // Add to root
        const list = this.menuElement?.querySelector('.nav-list');
        if (list) {
            const li = this.buildMenuItem(item);
            list.appendChild(li);
        }
    }

    /**
     * Remove menu item
     * @param {string} itemId - Menu item ID
     */
    removeMenuItem(itemId) {
        const item = this.menuElement?.querySelector(`[data-id="${itemId}"]`);
        if (item) {
            item.remove();
            this.state.expandedItems.delete(itemId);
        }
    }

    /**
     * Update badge on menu item
     * @param {string} itemId - Menu item ID
     * @param {string} badge - Badge text
     * @param {string} type - Badge type
     */
    updateBadge(itemId, badge, type = '') {
        const item = this.menuElement?.querySelector(`[data-id="${itemId}"] .nav-link`);
        if (item) {
            const existingBadge = item.querySelector('.nav-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = `nav-badge ${type}`;
                badgeEl.textContent = badge;
                item.appendChild(badgeEl);
            }
        }
    }

    /**
     * Close sidebar (mobile)
     */
    close() {
        if (this.state.isMobile && this.state.isOpen) {
            this.state.isOpen = false;
            this.element?.classList.remove('open');
            this.overlay?.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    /**
     * Update sidebar with new data
     * @param {object} data - Update data
     */
    update(data) {
        if (data.menuItems) {
            this.config.menuItems = data.menuItems;
            // Rebuild menu
            const existingMenu = this.menuElement;
            if (existingMenu) {
                const newMenu = this.buildMenu();
                existingMenu.replaceWith(newMenu);
                this.menuElement = newMenu;
                this.setActiveItem();
            }
        }

        if (data.user) {
            this.config.user = data.user;
            // Rebuild user section
            const existingUser = this.userElement;
            if (existingUser) {
                const newUser = this.buildUser();
                existingUser.replaceWith(newUser);
                this.userElement = newUser;
            }
        }

        if (data.notifications) {
            this.config.notifications = data.notifications;
            // Update notification badges
            // Implementation would go here
        }
    }

    /**
     * Destroy the sidebar
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        // Remove DOM element
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        this.element = null;
        this.container = null;
        this.menuElement = null;
        this.userElement = null;
        this.searchElement = null;
        this.toggleButton = null;
        this.overlay = null;
    }
}

// Export for use in other files
export default Sidebar;
