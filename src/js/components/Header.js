/**
 * ==========================================
 * FILE: Header.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade header component for 11 Avatar CRM.
 * Provides a comprehensive header with navigation, search,
 * notifications, user menu, and more.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Responsive Navigation
 * - Search with Suggestions
 * - Notifications Dropdown
 * - User Profile Menu
 * - Theme Toggle
 * - Breadcrumb Navigation
 * - Mobile Hamburger Menu
 * - Dropdown Menus
 * - Notification Badges
 * - Keyboard Navigation
 * - Accessibility Ready
 * 
 * USAGE EXAMPLE:
 * import { Header } from './components/Header.js';
 * 
 * const header = new Header({
 *   container: '#header',
 *   logo: { text: '11 Avatar', icon: '🚀' },
 *   navItems: [
 *     { label: 'Dashboard', href: '/dashboard', active: true },
 *     { label: 'Leads', href: '/leads' },
 *     { label: 'Customers', href: '/customers' }
 *   ],
 *   user: {
 *     name: 'Rajesh Kumar',
 *     email: 'rajesh@11avatar.com',
 *     avatar: '',
 *     role: 'Platform Owner'
 *   },
 *   onSearch: (query) => { ... },
 *   onThemeToggle: (theme) => { ... },
 *   onLogout: () => { ... }
 * });
 * 
 * header.render();
 * ==========================================
 */

export class Header {
    /**
     * Header constructor
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        this.config = {
            container: options.container || '#header',
            logo: options.logo || { text: '11 Avatar', icon: '🚀' },
            logoUrl: options.logoUrl || '/',
            navItems: options.navItems || [],
            navPosition: options.navPosition || 'center', // left, center, right
            user: options.user || null,
            notifications: options.notifications || [],
            breadcrumbs: options.breadcrumbs || [],
            showSearch: options.showSearch !== undefined ? options.showSearch : true,
            showNotifications: options.showNotifications !== undefined ? options.showNotifications : true,
            showThemeToggle: options.showThemeToggle !== undefined ? options.showThemeToggle : true,
            showUserMenu: options.showUserMenu !== undefined ? options.showUserMenu : true,
            showBreadcrumbs: options.showBreadcrumbs !== undefined ? options.showBreadcrumbs : false,
            searchPlaceholder: options.searchPlaceholder || 'Search...',
            theme: options.theme || 'light',
            sticky: options.sticky !== undefined ? options.sticky : true,
            onSearch: options.onSearch || null,
            onThemeToggle: options.onThemeToggle || null,
            onLogout: options.onLogout || null,
            onNotificationClick: options.onNotificationClick || null,
            onNavItemClick: options.onNavItemClick || null,
            onUserMenuClick: options.onUserMenuClick || null,
            ...options
        };

        // Internal state
        this.state = {
            isMobile: window.innerWidth < 768,
            isMenuOpen: false,
            isSearchOpen: false,
            isNotificationsOpen: false,
            isUserMenuOpen: false,
            theme: this.config.theme,
            searchQuery: '',
            notifications: [...this.config.notifications],
            unreadCount: this.config.notifications.filter(n => !n.read).length
        };

        // DOM references
        this.element = null;
        this.container = null;
        this.navElement = null;
        this.searchElement = null;
        this.notificationsElement = null;
        this.userMenuElement = null;
        this.menuButton = null;

        // Event listeners
        this.eventListeners = [];
        this.clickOutsideListeners = [];

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
        this.toggleMenu = this.toggleMenu.bind(this);
        this.toggleSearch = this.toggleSearch.bind(this);
        this.toggleNotifications = this.toggleNotifications.bind(this);
        this.toggleUserMenu = this.toggleUserMenu.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.addNotification = this.addNotification.bind(this);
        this.markAsRead = this.markAsRead.bind(this);
        this.clearNotifications = this.clearNotifications.bind(this);
        this.setBreadcrumbs = this.setBreadcrumbs.bind(this);
        this.setActiveNav = this.setActiveNav.bind(this);
    }

    /**
     * Render the header
     * @returns {Header} this (for chaining)
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

            // Create header element
            this.element = document.createElement('header');
            this.element.className = `crm-header theme-${this.config.theme}`;
            this.element.dataset.sticky = this.config.sticky;

            if (this.config.sticky) {
                this.element.classList.add('sticky');
            }

            // Build header structure
            this.buildStructure();

            // Setup event listeners
            this.setupEventListeners();

            // Setup resize handler
            this.setupResizeHandler();

            return this;
        } catch (error) {
            console.error('[Header] Render error:', error);
            return this;
        }
    }

    /**
     * Build header structure
     */
    buildStructure() {
        const container = document.createElement('div');
        container.className = 'header-container';

        // Logo
        const logo = this.buildLogo();
        container.appendChild(logo);

        // Mobile menu button
        const menuButton = this.buildMenuButton();
        container.appendChild(menuButton);
        this.menuButton = menuButton;

        // Navigation
        const nav = this.buildNavigation();
        container.appendChild(nav);
        this.navElement = nav;

        // Right section
        const rightSection = document.createElement('div');
        rightSection.className = 'header-right';

        // Search
        if (this.config.showSearch) {
            const search = this.buildSearch();
            rightSection.appendChild(search);
            this.searchElement = search;
        }

        // Notifications
        if (this.config.showNotifications) {
            const notifications = this.buildNotifications();
            rightSection.appendChild(notifications);
            this.notificationsElement = notifications;
        }

        // Theme toggle
        if (this.config.showThemeToggle) {
            const themeToggle = this.buildThemeToggle();
            rightSection.appendChild(themeToggle);
        }

        // User menu
        if (this.config.showUserMenu && this.config.user) {
            const userMenu = this.buildUserMenu();
            rightSection.appendChild(userMenu);
            this.userMenuElement = userMenu;
        }

        container.appendChild(rightSection);

        // Breadcrumbs
        if (this.config.showBreadcrumbs && this.config.breadcrumbs.length > 0) {
            const breadcrumbs = this.buildBreadcrumbs();
            container.appendChild(breadcrumbs);
        }

        this.element.appendChild(container);

        // Mobile overlay
        const overlay = document.createElement('div');
        overlay.className = 'header-overlay';
        overlay.addEventListener('click', () => {
            this.toggleMenu(false);
        });
        this.element.appendChild(overlay);

        // Update active state
        this.setActiveNav();
    }

    /**
     * Build logo
     * @returns {HTMLElement} Logo element
     */
    buildLogo() {
        const logo = document.createElement('div');
        logo.className = 'header-logo';

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
            text.textContent = this.config.logo.text;
            link.appendChild(text);
        }

        logo.appendChild(link);

        return logo;
    }

    /**
     * Build mobile menu button
     * @returns {HTMLElement} Menu button
     */
    buildMenuButton() {
        const button = document.createElement('button');
        button.className = 'header-menu-button';
        button.setAttribute('aria-label', 'Toggle menu');
        button.setAttribute('aria-expanded', 'false');

        const icon = document.createElement('span');
        icon.className = 'menu-icon';
        icon.innerHTML = '<span></span><span></span><span></span>';
        button.appendChild(icon);

        button.addEventListener('click', () => {
            this.toggleMenu();
        });

        return button;
    }

    /**
     * Build navigation
     * @returns {HTMLElement} Navigation element
     */
    buildNavigation() {
        const nav = document.createElement('nav');
        nav.className = `header-nav position-${this.config.navPosition}`;
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', 'Main navigation');

        const list = document.createElement('ul');
        list.className = 'nav-list';

        this.config.navItems.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'nav-item';

            const link = document.createElement('a');
            link.href = item.href || '#';
            link.textContent = item.label;
            link.className = `nav-link ${item.active ? 'active' : ''}`;
            link.setAttribute('aria-current', item.active ? 'page' : null);

            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'nav-icon';
                icon.textContent = item.icon;
                link.prepend(icon);
            }

            if (item.badge) {
                const badge = document.createElement('span');
                badge.className = `nav-badge ${item.badgeType || ''}`;
                badge.textContent = item.badge;
                link.appendChild(badge);
            }

            if (item.dropdown && item.dropdown.length > 0) {
                link.classList.add('has-dropdown');
                const dropdown = this.buildDropdown(item.dropdown);
                li.appendChild(dropdown);
            }

            link.addEventListener('click', (e) => {
                if (item.href && item.href !== '#') {
                    if (this.config.onNavItemClick) {
                        e.preventDefault();
                        this.config.onNavItemClick(item);
                    }
                } else {
                    e.preventDefault();
                    if (this.config.onNavItemClick) {
                        this.config.onNavItemClick(item);
                    }
                }
                this.toggleMenu(false);
            });

            li.appendChild(link);
            list.appendChild(li);

            // Store reference for active state
            li.dataset.href = item.href || '';
        });

        nav.appendChild(list);

        return nav;
    }

    /**
     * Build dropdown menu
     * @param {Array} items - Dropdown items
     * @returns {HTMLElement} Dropdown element
     */
    buildDropdown(items) {
        const dropdown = document.createElement('ul');
        dropdown.className = 'dropdown-menu';

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'dropdown-item';

            const link = document.createElement('a');
            link.href = item.href || '#';
            link.textContent = item.label;

            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'dropdown-icon';
                icon.textContent = item.icon;
                link.prepend(icon);
            }

            if (item.divider) {
                li.classList.add('divider');
            }

            link.addEventListener('click', (e) => {
                if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                }
                if (this.config.onNavItemClick) {
                    this.config.onNavItemClick(item);
                }
            });

            li.appendChild(link);
            dropdown.appendChild(li);
        });

        return dropdown;
    }

    /**
     * Build search component
     * @returns {HTMLElement} Search element
     */
    buildSearch() {
        const container = document.createElement('div');
        container.className = 'header-search';

        const form = document.createElement('form');
        form.className = 'search-form';
        form.setAttribute('role', 'search');

        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'search-input';
        input.placeholder = this.config.searchPlaceholder;
        input.setAttribute('aria-label', 'Search');
        input.autocomplete = 'off';

        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'search-button';
        button.innerHTML = '🔍';
        button.setAttribute('aria-label', 'Submit search');

        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'search-clear';
        clear.innerHTML = '✕';
        clear.style.display = 'none';
        clear.setAttribute('aria-label', 'Clear search');

        form.appendChild(input);
        form.appendChild(button);
        form.appendChild(clear);

        // Suggestions container
        const suggestions = document.createElement('div');
        suggestions.className = 'search-suggestions';
        suggestions.style.display = 'none';

        container.appendChild(form);
        container.appendChild(suggestions);

        // Event listeners
        let debounceTimer;

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            clear.style.display = value ? 'block' : 'none';
            this.state.searchQuery = value;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleSearch(value);
            }, 300);
        });

        input.addEventListener('focus', () => {
            form.classList.add('focused');
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                form.classList.remove('focused');
                suggestions.style.display = 'none';
            }, 200);
        });

        clear.addEventListener('click', () => {
            input.value = '';
            clear.style.display = 'none';
            this.state.searchQuery = '';
            suggestions.style.display = 'none';
            this.handleSearch('');
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.config.onSearch) {
                this.config.onSearch(this.state.searchQuery);
            }
            suggestions.style.display = 'none';
        });

        // Store refs
        this._searchInput = input;
        this._searchSuggestions = suggestions;
        this._searchClear = clear;

        return container;
    }

    /**
     * Build notifications dropdown
     * @returns {HTMLElement} Notifications element
     */
    buildNotifications() {
        const container = document.createElement('div');
        container.className = 'header-notifications';

        const button = document.createElement('button');
        button.className = 'notifications-button';
        button.setAttribute('aria-label', 'Notifications');
        button.innerHTML = '🔔';

        if (this.state.unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = this.state.unreadCount > 99 ? '99+' : this.state.unreadCount;
            button.appendChild(badge);
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'notifications-dropdown';
        dropdown.style.display = 'none';

        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.innerHTML = `
            <span>Notifications</span>
            <button class="mark-all-read">Mark all as read</button>
        `;

        const list = document.createElement('div');
        list.className = 'notifications-list';

        const footer = document.createElement('div');
        footer.className = 'dropdown-footer';
        footer.innerHTML = `<button class="view-all">View all notifications</button>`;

        dropdown.appendChild(header);
        dropdown.appendChild(list);
        dropdown.appendChild(footer);

        container.appendChild(button);
        container.appendChild(dropdown);

        // Event listeners
        button.addEventListener('click', () => {
            this.toggleNotifications();
        });

        header.querySelector('.mark-all-read')?.addEventListener('click', () => {
            this.clearNotifications();
        });

        footer.querySelector('.view-all')?.addEventListener('click', () => {
            if (this.config.onNotificationClick) {
                this.config.onNotificationClick('view-all');
            }
            this.toggleNotifications(false);
        });

        // Store refs
        this._notificationsList = list;
        this._notificationsDropdown = dropdown;
        this._notificationsButton = button;

        // Render initial notifications
        this.renderNotifications();

        return container;
    }

    /**
     * Render notifications in dropdown
     */
    renderNotifications() {
        const list = this._notificationsList;
        if (!list) return;

        list.innerHTML = '';

        if (this.state.notifications.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'notifications-empty';
            empty.textContent = 'No notifications';
            list.appendChild(empty);
            return;
        }

        this.state.notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.read ? 'read' : 'unread'}`;

            const content = document.createElement('div');
            content.className = 'notification-content';

            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = notification.title;

            const message = document.createElement('div');
            message.className = 'notification-message';
            message.textContent = notification.message;

            const time = document.createElement('span');
            time.className = 'notification-time';
            time.textContent = this.formatTimeAgo(notification.timestamp);

            content.appendChild(title);
            content.appendChild(message);
            content.appendChild(time);

            if (!notification.read) {
                const markRead = document.createElement('button');
                markRead.className = 'mark-read';
                markRead.innerHTML = '●';
                markRead.setAttribute('aria-label', 'Mark as read');
                markRead.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.markAsRead(notification.id);
                });
                content.appendChild(markRead);
            }

            item.appendChild(content);

            item.addEventListener('click', () => {
                if (this.config.onNotificationClick) {
                    this.config.onNotificationClick(notification);
                }
                if (!notification.read) {
                    this.markAsRead(notification.id);
                }
                this.toggleNotifications(false);
            });

            list.appendChild(item);
        });
    }

    /**
     * Build theme toggle
     * @returns {HTMLElement} Theme toggle element
     */
    buildThemeToggle() {
        const container = document.createElement('div');
        container.className = 'header-theme-toggle';

        const button = document.createElement('button');
        button.className = 'theme-toggle-button';
        button.setAttribute('aria-label', 'Toggle theme');

        const icon = document.createElement('span');
        icon.className = 'theme-icon';
        icon.textContent = this.config.theme === 'dark' ? '☀️' : '🌙';
        button.appendChild(icon);

        button.addEventListener('click', () => {
            this.toggleTheme();
        });

        container.appendChild(button);

        return container;
    }

    /**
     * Build user menu
     * @returns {HTMLElement} User menu element
     */
    buildUserMenu() {
        const container = document.createElement('div');
        container.className = 'header-user-menu';

        const button = document.createElement('button');
        button.className = 'user-menu-button';
        button.setAttribute('aria-label', 'User menu');
        button.setAttribute('aria-expanded', 'false');

        const user = this.config.user;

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

        const caret = document.createElement('span');
        caret.className = 'user-caret';
        caret.textContent = '▾';
        button.appendChild(caret);

        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.style.display = 'none';

        // Profile
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
                this.toggleUserMenu(false);
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
            this.toggleUserMenu(false);
        });
        dropdown.appendChild(logout);

        container.appendChild(button);
        container.appendChild(dropdown);

        // Event listeners
        button.addEventListener('click', () => {
            this.toggleUserMenu();
        });

        // Store refs
        this._userDropdown = dropdown;
        this._userButton = button;

        return container;
    }

    /**
     * Build breadcrumbs
     * @returns {HTMLElement} Breadcrumbs element
     */
    buildBreadcrumbs() {
        const container = document.createElement('div');
        container.className = 'header-breadcrumbs';

        const list = document.createElement('ol');
        list.className = 'breadcrumb-list';
        list.setAttribute('aria-label', 'Breadcrumbs');

        this.config.breadcrumbs.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'breadcrumb-item';

            if (index < this.config.breadcrumbs.length - 1) {
                const link = document.createElement('a');
                link.href = item.href || '#';
                link.textContent = item.label;
                link.addEventListener('click', (e) => {
                    if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                    }
                });
                li.appendChild(link);
            } else {
                li.textContent = item.label;
                li.setAttribute('aria-current', 'page');
            }

            // Separator
            if (index < this.config.breadcrumbs.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '/';
                li.appendChild(separator);
            }

            list.appendChild(li);
        });

        container.appendChild(list);

        return container;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Click outside to close dropdowns
        document.addEventListener('click', this.handleClickOutside);

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggleNotifications(false);
                this.toggleUserMenu(false);
                this.toggleMenu(false);
            }
        });

        this.eventListeners.push(
            { element: document, event: 'click', handler: this.handleClickOutside },
            { element: document, event: 'keydown', handler: (e) => {
                if (e.key === 'Escape') {
                    this.toggleNotifications(false);
                    this.toggleUserMenu(false);
                    this.toggleMenu(false);
                }
            }}
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
                    this.toggleMenu(false);
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
        // Notifications
        if (this.notificationsElement && !this.notificationsElement.contains(e.target)) {
            this.toggleNotifications(false);
        }

        // User menu
        if (this.userMenuElement && !this.userMenuElement.contains(e.target)) {
            this.toggleUserMenu(false);
        }
    }

    /**
     * Handle search
     * @param {string} query - Search query
     */
    handleSearch(query) {
        if (this.config.onSearch) {
            this.config.onSearch(query);
        }

        // Show suggestions if available
        if (query && this.config.suggestions) {
            const filtered = this.config.suggestions.filter(s => 
                s.toLowerCase().includes(query.toLowerCase())
            );
            this.showSearchSuggestions(filtered);
        } else {
            this.hideSearchSuggestions();
        }
    }

    /**
     * Show search suggestions
     * @param {Array} suggestions - Suggestions to show
     */
    showSearchSuggestions(suggestions) {
        const container = this._searchSuggestions;
        if (!container) return;

        if (suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        container.style.display = 'block';

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                this._searchInput.value = suggestion;
                this.state.searchQuery = suggestion;
                container.style.display = 'none';
                if (this.config.onSearch) {
                    this.config.onSearch(suggestion);
                }
            });
            container.appendChild(item);
        });
    }

    /**
     * Hide search suggestions
     */
    hideSearchSuggestions() {
        if (this._searchSuggestions) {
            this._searchSuggestions.style.display = 'none';
            this._searchSuggestions.innerHTML = '';
        }
    }

    /**
     * Toggle menu
     * @param {boolean} state - Force state
     */
    toggleMenu(state = null) {
        const newState = state !== null ? state : !this.state.isMenuOpen;
        this.state.isMenuOpen = newState;

        if (this.navElement) {
            this.navElement.classList.toggle('open', newState);
        }

        if (this.menuButton) {
            this.menuButton.setAttribute('aria-expanded', newState);
        }

        const overlay = this.element.querySelector('.header-overlay');
        if (overlay) {
            overlay.classList.toggle('active', newState);
        }

        document.body.style.overflow = newState && this.state.isMobile ? 'hidden' : '';
    }

    /**
     * Toggle search
     * @param {boolean} state - Force state
     */
    toggleSearch(state = null) {
        const newState = state !== null ? state : !this.state.isSearchOpen;
        this.state.isSearchOpen = newState;

        if (this.searchElement) {
            this.searchElement.classList.toggle('open', newState);
            if (newState) {
                const input = this.searchElement.querySelector('.search-input');
                if (input) {
                    setTimeout(() => input.focus(), 100);
                }
            }
        }
    }

    /**
     * Toggle notifications
     * @param {boolean} state - Force state
     */
    toggleNotifications(state = null) {
        const newState = state !== null ? state : !this.state.isNotificationsOpen;
        this.state.isNotificationsOpen = newState;

        if (this._notificationsDropdown) {
            this._notificationsDropdown.style.display = newState ? 'block' : 'none';
        }

        if (this._notificationsButton) {
            this._notificationsButton.setAttribute('aria-expanded', newState);
        }

        if (newState) {
            this.toggleUserMenu(false);
        }
    }

    /**
     * Toggle user menu
     * @param {boolean} state - Force state
     */
    toggleUserMenu(state = null) {
        const newState = state !== null ? state : !this.state.isUserMenuOpen;
        this.state.isUserMenuOpen = newState;

        if (this._userDropdown) {
            this._userDropdown.style.display = newState ? 'block' : 'none';
        }

        if (this._userButton) {
            this._userButton.setAttribute('aria-expanded', newState);
        }

        if (newState) {
            this.toggleNotifications(false);
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.state.theme = newTheme;
        this.config.theme = newTheme;

        // Update DOM
        if (this.element) {
            this.element.className = `crm-header theme-${newTheme}`;
        }

        // Update theme icon
        const icon = this.element?.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }

        // Dispatch event
        if (this.config.onThemeToggle) {
            this.config.onThemeToggle(newTheme);
        }

        // Update body class
        document.body.classList.toggle('dark-theme', newTheme === 'dark');
    }

    /**
     * Add notification
     * @param {object} notification - Notification data
     */
    addNotification(notification) {
        const newNotification = {
            id: notification.id || 'notif_' + Date.now(),
            title: notification.title,
            message: notification.message,
            timestamp: notification.timestamp || new Date().toISOString(),
            read: false,
            ...notification
        };

        this.state.notifications.unshift(newNotification);
        this.state.unreadCount++;

        // Update badge
        this.updateNotificationBadge();

        // Re-render notifications
        this.renderNotifications();

        // Auto-close after 5 seconds if not interacted
        setTimeout(() => {
            this.toggleNotifications(false);
        }, 5000);
    }

    /**
     * Mark notification as read
     * @param {string} id - Notification ID
     */
    markAsRead(id) {
        const notification = this.state.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.state.unreadCount = Math.max(0, this.state.unreadCount - 1);
            this.updateNotificationBadge();
            this.renderNotifications();
        }
    }

    /**
     * Mark all notifications as read
     */
    clearNotifications() {
        this.state.notifications.forEach(n => n.read = true);
        this.state.unreadCount = 0;
        this.updateNotificationBadge();
        this.renderNotifications();
    }

    /**
     * Update notification badge
     */
    updateNotificationBadge() {
        const button = this._notificationsButton;
        if (!button) return;

        const existingBadge = button.querySelector('.notification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        if (this.state.unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = this.state.unreadCount > 99 ? '99+' : this.state.unreadCount;
            button.appendChild(badge);
        }
    }

    /**
     * Set breadcrumbs
     * @param {Array} breadcrumbs - Breadcrumb items
     */
    setBreadcrumbs(breadcrumbs) {
        this.config.breadcrumbs = breadcrumbs;
        // Rebuild breadcrumbs
        const existing = this.element?.querySelector('.header-breadcrumbs');
        if (existing) {
            existing.remove();
        }
        if (this.config.showBreadcrumbs && breadcrumbs.length > 0) {
            const breadcrumbEl = this.buildBreadcrumbs();
            this.element?.querySelector('.header-container')?.appendChild(breadcrumbEl);
        }
    }

    /**
     * Set active navigation item
     * @param {string} href - Active href
     */
    setActiveNav(href) {
        const links = this.element?.querySelectorAll('.nav-link');
        if (!links) return;

        links.forEach(link => {
            const parent = link.closest('.nav-item');
            if (parent) {
                const itemHref = parent.dataset.href;
                link.classList.toggle('active', href ? itemHref === href : link.href === window.location.pathname);
            }
        });
    }

    /**
     * Format time ago
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Time ago string
     */
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

    /**
     * Update header with new data
     * @param {object} data - Update data
     */
    update(data) {
        if (data.user) {
            this.config.user = data.user;
            // Rebuild user menu
            const existing = this.userMenuElement;
            if (existing) {
                existing.replaceWith(this.buildUserMenu());
                this.userMenuElement = existing;
            }
        }

        if (data.notifications) {
            this.state.notifications = data.notifications;
            this.state.unreadCount = data.notifications.filter(n => !n.read).length;
            this.updateNotificationBadge();
            this.renderNotifications();
        }

        if (data.theme) {
            this.state.theme = data.theme;
            this.config.theme = data.theme;
            this.toggleTheme();
        }

        if (data.breadcrumbs) {
            this.setBreadcrumbs(data.breadcrumbs);
        }

        if (data.navItems) {
            this.config.navItems = data.navItems;
            // Rebuild navigation
            const existing = this.navElement;
            if (existing) {
                existing.replaceWith(this.buildNavigation());
                this.navElement = existing;
            }
        }
    }

    /**
     * Destroy the header
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        // Remove click outside listeners
        document.removeEventListener('click', this.handleClickOutside);

        // Remove DOM element
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.element = null;
        this.container = null;
        this.navElement = null;
        this.searchElement = null;
        this.notificationsElement = null;
        this.userMenuElement = null;
    }
}

// Export for use in other files
export default Header;
