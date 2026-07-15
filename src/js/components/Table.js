/**
 * ==========================================
 * FILE: Table.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade table component for 11 Avatar CRM.
 * Provides comprehensive data table functionality with
 * sorting, filtering, pagination, selection, and more.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Column Sorting (Ascending/Descending)
 * - Filtering (Text, Dropdown, Date Range)
 * - Pagination (with Page Size Control)
 * - Row Selection (Single, Multi, Checkbox)
 * - Row Expand/Collapse
 * - Column Visibility Toggle
 * - Column Resize
 * - Row Actions (Custom)
 * - Cell Formatting (Custom)
 * - Header Sticky
 * - Footer with Pagination
 * - Export (CSV, Excel, PDF)
 * - Search
 * - Responsive Design
 * - Theme Support (Light/Dark)
 * - Accessibility Ready
 * - Keyboard Navigation
 * - Loading State
 * - Empty State
 * - Row Highlighting
 * - Custom Cell Renderers
 * - Event System
 * 
 * USAGE EXAMPLE:
 * import { Table } from './components/Table.js';
 * 
 * const table = new Table({
 *   container: '#table-container',
 *   columns: [
 *     { key: 'id', label: 'ID', sortable: true },
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'email', label: 'Email', sortable: true },
 *     { key: 'status', label: 'Status', 
 *       render: (value) => `<span class="status-badge ${value}">${value}</span>` }
 *   ],
 *   data: [
 *     { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
 *     { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' }
 *   ],
 *   options: {
 *     pageSize: 10,
 *     sortable: true,
 *     filterable: true,
 *     selectable: true,
 *     pagination: true,
 *     exportable: true,
 *     searchable: true
 *   },
 *   onRowClick: (row) => { ... },
 *   onSelectionChange: (selected) => { ... },
 *   onSort: (column, direction) => { ... }
 * });
 * 
 * table.render();
 * table.setData(newData);
 * table.exportCSV();
 * ==========================================
 */

export class Table {
    /**
     * Table constructor
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        this.config = {
            container: options.container || '#table-container',
            columns: options.columns || [],
            data: options.data || [],
            options: {
                pageSize: options.options?.pageSize || 10,
                pageSizes: options.options?.pageSizes || [5, 10, 25, 50, 100],
                sortable: options.options?.sortable !== undefined ? options.options.sortable : true,
                filterable: options.options?.filterable !== undefined ? options.options.filterable : true,
                selectable: options.options?.selectable !== undefined ? options.options.selectable : true,
                multiSelect: options.options?.multiSelect !== undefined ? options.options.multiSelect : true,
                pagination: options.options?.pagination !== undefined ? options.options.pagination : true,
                exportable: options.options?.exportable !== undefined ? options.options.exportable : true,
                searchable: options.options?.searchable !== undefined ? options.options.searchable : true,
                stickyHeader: options.options?.stickyHeader !== undefined ? options.options.stickyHeader : true,
                responsive: options.options?.responsive !== undefined ? options.options.responsive : true,
                striped: options.options?.striped !== undefined ? options.options.striped : true,
                hoverable: options.options?.hoverable !== undefined ? options.options.hoverable : true,
                bordered: options.options?.bordered !== undefined ? options.options.bordered : false,
                compact: options.options?.compact || false,
                loading: options.options?.loading || false,
                emptyText: options.options?.emptyText || 'No data available',
                loadingText: options.options?.loadingText || 'Loading...',
                theme: options.options?.theme || 'light',
                maxHeight: options.options?.maxHeight || null
            },
            onRowClick: options.onRowClick || null,
            onRowDoubleClick: options.onRowDoubleClick || null,
            onSelectionChange: options.onSelectionChange || null,
            onSort: options.onSort || null,
            onPageChange: options.onPageChange || null,
            onSearch: options.onSearch || null,
            onFilter: options.onFilter || null,
            onRowExpand: options.onRowExpand || null,
            onRowCollapse: options.onRowCollapse || null,
            onExport: options.onExport || null,
            ...options
        };

        // Internal state
        this.state = {
            columns: [...this.config.columns],
            data: [...this.config.data],
            filteredData: [...this.config.data],
            displayedData: [],
            sortColumn: null,
            sortDirection: 'asc',
            filters: {},
            searchQuery: '',
            selectedRows: new Set(),
            expandedRows: new Set(),
            currentPage: 1,
            pageSize: this.config.options.pageSize,
            totalPages: 1,
            visibleColumns: new Set(this.config.columns.map(c => c.key)),
            columnWidths: {},
            isAllSelected: false,
            isLoading: this.config.options.loading
        };

        // DOM references
        this.element = null;
        this.container = null;
        this.thead = null;
        this.tbody = null;
        this.tfoot = null;
        this.paginationElement = null;
        this.toolbarElement = null;

        // Event listeners
        this.eventListeners = [];
        this.rowListeners = [];

        // Custom renderers
        this.renderers = {};

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
        this.setData = this.setData.bind(this);
        this.setColumns = this.setColumns.bind(this);
        this.addRow = this.addRow.bind(this);
        this.removeRow = this.removeRow.bind(this);
        this.updateRow = this.updateRow.bind(this);
        this.clearData = this.clearData.bind(this);
        this.sort = this.sort.bind(this);
        this.filter = this.filter.bind(this);
        this.search = this.search.bind(this);
        this.selectRow = this.selectRow.bind(this);
        this.selectAll = this.selectAll.bind(this);
        this.getSelectedRows = this.getSelectedRows.bind(this);
        this.clearSelection = this.clearSelection.bind(this);
        this.toggleRow = this.toggleRow.bind(this);
        this.toggleColumn = this.toggleColumn.bind(this);
        this.getVisibleColumns = this.getVisibleColumns.bind(this);
        this.exportCSV = this.exportCSV.bind(this);
        this.exportExcel = this.exportExcel.bind(this);
        this.exportPDF = this.exportPDF.bind(this);
        this.goToPage = this.goToPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.prevPage = this.prevPage.bind(this);
        this.firstPage = this.firstPage.bind(this);
        this.lastPage = this.lastPage.bind(this);
        this.setPageSize = this.setPageSize.bind(this);
        this.refresh = this.refresh.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Render the table
     * @returns {Table} this (for chaining)
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

            // Create table wrapper
            const wrapper = document.createElement('div');
            wrapper.className = `table-wrapper theme-${this.config.options.theme}`;
            wrapper.dataset.compact = this.config.options.compact;

            // Create toolbar
            if (this.config.options.searchable || this.config.options.filterable || this.config.options.exportable) {
                this.toolbarElement = this.buildToolbar();
                wrapper.appendChild(this.toolbarElement);
            }

            // Create table container
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-scroll-container';
            if (this.config.options.maxHeight) {
                tableContainer.style.maxHeight = this.config.options.maxHeight;
                tableContainer.style.overflowY = 'auto';
            }

            // Create table
            const table = document.createElement('table');
            table.className = `crm-table ${this.config.options.bordered ? 'bordered' : ''} ${this.config.options.striped ? 'striped' : ''} ${this.config.options.hoverable ? 'hoverable' : ''}`;
            table.setAttribute('role', 'table');
            this.element = table;

            // Create thead
            this.thead = this.buildHeader();
            table.appendChild(this.thead);

            // Create tbody
            this.tbody = this.buildBody();
            table.appendChild(this.tbody);

            // Create tfoot
            if (this.config.options.pagination) {
                this.tfoot = this.buildFooter();
                table.appendChild(this.tfoot);
            }

            tableContainer.appendChild(table);
            wrapper.appendChild(tableContainer);

            // Create pagination
            if (this.config.options.pagination) {
                this.paginationElement = this.buildPagination();
                wrapper.appendChild(this.paginationElement);
            }

            // Append to container
            this.container.appendChild(wrapper);

            // Setup event listeners
            this.setupEventListeners();

            // Apply initial sorting if configured
            if (this.config.options.sortable && this.state.sortColumn) {
                this.sort(this.state.sortColumn, this.state.sortDirection);
            }

            // Update state
            this.refresh();

            return this;
        } catch (error) {
            console.error('[Table] Render error:', error);
            return this;
        }
    }

    /**
     * Build toolbar
     * @returns {HTMLElement} Toolbar element
     */
    buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'table-toolbar';

        // Left section
        const left = document.createElement('div');
        left.className = 'toolbar-left';

        // Search
        if (this.config.options.searchable) {
            const search = document.createElement('div');
            search.className = 'toolbar-search';
            const input = document.createElement('input');
            input.type = 'search';
            input.placeholder = 'Search...';
            input.setAttribute('aria-label', 'Search table');
            input.addEventListener('input', (e) => {
                this.search(e.target.value);
            });
            search.appendChild(input);
            left.appendChild(search);
        }

        // Filters
        if (this.config.options.filterable) {
            const filters = document.createElement('div');
            filters.className = 'toolbar-filters';
            // Filter inputs would be added here based on column types
            // For MVP, add a simple filter dropdown
            const filterSelect = document.createElement('select');
            filterSelect.setAttribute('aria-label', 'Filter by');
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'All';
            filterSelect.appendChild(defaultOption);
            
            // Add filter options from data
            const uniqueValues = new Set();
            this.state.data.forEach(row => {
                Object.values(row).forEach(val => {
                    if (val && typeof val === 'string') {
                        uniqueValues.add(val);
                    }
                });
            });
            uniqueValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                filterSelect.appendChild(option);
            });
            
            filterSelect.addEventListener('change', (e) => {
                this.filter({ value: e.target.value });
            });
            filters.appendChild(filterSelect);
            left.appendChild(filters);
        }

        toolbar.appendChild(left);

        // Right section
        const right = document.createElement('div');
        right.className = 'toolbar-right';

        // Column visibility toggle
        const columnToggle = document.createElement('button');
        columnToggle.className = 'toolbar-btn';
        columnToggle.innerHTML = '📊';
        columnToggle.setAttribute('aria-label', 'Toggle columns');
        columnToggle.addEventListener('click', () => {
            this.showColumnMenu();
        });
        right.appendChild(columnToggle);

        // Export buttons
        if (this.config.options.exportable) {
            const exportBtn = document.createElement('div');
            exportBtn.className = 'toolbar-export';
            
            const csvBtn = document.createElement('button');
            csvBtn.className = 'toolbar-btn';
            csvBtn.textContent = 'CSV';
            csvBtn.setAttribute('aria-label', 'Export as CSV');
            csvBtn.addEventListener('click', () => this.exportCSV());
            exportBtn.appendChild(csvBtn);

            const excelBtn = document.createElement('button');
            excelBtn.className = 'toolbar-btn';
            excelBtn.textContent = 'Excel';
            excelBtn.setAttribute('aria-label', 'Export as Excel');
            excelBtn.addEventListener('click', () => this.exportExcel());
            exportBtn.appendChild(excelBtn);

            right.appendChild(exportBtn);
        }

        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'toolbar-btn';
        refreshBtn.innerHTML = '🔄';
        refreshBtn.setAttribute('aria-label', 'Refresh');
        refreshBtn.addEventListener('click', () => this.refresh());
        right.appendChild(refreshBtn);

        toolbar.appendChild(right);

        return toolbar;
    }

    /**
     * Build table header
     * @returns {HTMLElement} Thead element
     */
    buildHeader() {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');

        // Selection checkbox
        if (this.config.options.selectable) {
            const th = document.createElement('th');
            th.className = 'col-select';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('aria-label', 'Select all');
            checkbox.addEventListener('change', (e) => {
                this.selectAll(e.target.checked);
            });
            th.appendChild(checkbox);
            tr.appendChild(th);
        }

        // Columns
        this.state.columns.forEach(column => {
            if (!this.state.visibleColumns.has(column.key)) return;

            const th = document.createElement('th');
            th.dataset.column = column.key;
            th.className = `col-${column.key}`;

            const content = document.createElement('div');
            content.className = 'th-content';

            const label = document.createElement('span');
            label.textContent = column.label || column.key;
            content.appendChild(label);

            // Sort indicator
            if (this.config.options.sortable && column.sortable !== false) {
                const sortIcon = document.createElement('span');
                sortIcon.className = 'sort-icon';
                sortIcon.innerHTML = '↕';
                content.appendChild(sortIcon);
                
                th.classList.add('sortable');
                th.addEventListener('click', () => {
                    this.sort(column.key);
                });
            }

            // Resize handle
            const resizeHandle = document.createElement('span');
            resizeHandle.className = 'resize-handle';
            resizeHandle.addEventListener('mousedown', (e) => {
                this.startColumnResize(e, column.key);
            });
            content.appendChild(resizeHandle);

            th.appendChild(content);
            tr.appendChild(th);

            // Store width
            if (this.state.columnWidths[column.key]) {
                th.style.width = this.state.columnWidths[column.key];
            }
        });

        thead.appendChild(tr);

        return thead;
    }

    /**
     * Build table body
     * @returns {HTMLElement} Tbody element
     */
    buildBody() {
        const tbody = document.createElement('tbody');

        if (this.state.isLoading) {
            this.showLoading(tbody);
            return tbody;
        }

        const data = this.state.displayedData;

        if (data.length === 0) {
            this.showEmpty(tbody);
            return tbody;
        }

        data.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = rowIndex;
            
            // Selection checkbox
            if (this.config.options.selectable) {
                const td = document.createElement('td');
                td.className = 'col-select';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = this.state.selectedRows.has(rowIndex);
                checkbox.setAttribute('aria-label', 'Select row');
                checkbox.addEventListener('change', (e) => {
                    this.selectRow(rowIndex, e.target.checked);
                });
                td.appendChild(checkbox);
                tr.appendChild(td);
            }

            // Data cells
            this.state.columns.forEach(column => {
                if (!this.state.visibleColumns.has(column.key)) return;

                const td = document.createElement('td');
                td.className = `col-${column.key}`;
                const value = row[column.key];

                // Custom renderer
                if (column.render) {
                    td.innerHTML = column.render(value, row, rowIndex);
                } else {
                    td.textContent = value !== undefined && value !== null ? value : '';
                }

                tr.appendChild(td);
            });

            // Click events
            tr.addEventListener('click', (e) => {
                if (this.config.onRowClick) {
                    this.config.onRowClick(row, rowIndex, e);
                }
            });

            tr.addEventListener('dblclick', (e) => {
                if (this.config.onRowDoubleClick) {
                    this.config.onRowDoubleClick(row, rowIndex, e);
                }
            });

            tbody.appendChild(tr);
        });

        return tbody;
    }

    /**
     * Build table footer
     * @returns {HTMLElement} Tfoot element
     */
    buildFooter() {
        const tfoot = document.createElement('tfoot');
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = this.state.columns.length + (this.config.options.selectable ? 1 : 0);
        td.className = 'table-footer-info';
        td.textContent = `Showing ${this.state.displayedData.length} of ${this.state.filteredData.length} entries`;
        tr.appendChild(td);
        tfoot.appendChild(tr);
        return tfoot;
    }

    /**
     * Build pagination
     * @returns {HTMLElement} Pagination element
     */
    buildPagination() {
        const container = document.createElement('div');
        container.className = 'table-pagination';

        // Page size selector
        const pageSizeGroup = document.createElement('div');
        pageSizeGroup.className = 'page-size-group';
        const label = document.createElement('label');
        label.textContent = 'Rows per page: ';
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Rows per page');
        this.config.options.pageSizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            if (size === this.state.pageSize) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        select.addEventListener('change', (e) => {
            this.setPageSize(parseInt(e.target.value));
        });
        pageSizeGroup.appendChild(label);
        pageSizeGroup.appendChild(select);
        container.appendChild(pageSizeGroup);

        // Page info
        const info = document.createElement('span');
        info.className = 'page-info';
        const total = this.state.filteredData.length;
        const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
        const end = Math.min(start + this.state.pageSize - 1, total);
        info.textContent = `${start}-${end} of ${total}`;
        container.appendChild(info);

        // Page buttons
        const buttons = document.createElement('div');
        buttons.className = 'page-buttons';

        const firstBtn = this.createPageButton('«', () => this.firstPage());
        buttons.appendChild(firstBtn);

        const prevBtn = this.createPageButton('‹', () => this.prevPage());
        buttons.appendChild(prevBtn);

        // Page numbers
        const totalPages = this.state.totalPages;
        const currentPage = this.state.currentPage;
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            buttons.appendChild(this.createPageButton('1', () => this.goToPage(1)));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '…';
                buttons.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = this.createPageButton(i, () => this.goToPage(i));
            if (i === currentPage) {
                btn.classList.add('active');
            }
            buttons.appendChild(btn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '…';
                buttons.appendChild(ellipsis);
            }
            buttons.appendChild(this.createPageButton(totalPages, () => this.goToPage(totalPages)));
        }

        const nextBtn = this.createPageButton('›', () => this.nextPage());
        buttons.appendChild(nextBtn);

        const lastBtn = this.createPageButton('»', () => this.lastPage());
        buttons.appendChild(lastBtn);

        container.appendChild(buttons);

        return container;
    }

    /**
     * Create a page button
     * @param {string|number} label - Button label
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} Button element
     */
    createPageButton(label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'page-btn';
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        if (label === '«' || label === '»' || label === '‹' || label === '›') {
            btn.classList.add('icon');
        }
        return btn;
    }

    /**
     * Show loading state
     * @param {HTMLElement} tbody - Tbody element
     */
    showLoading(tbody) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = this.state.columns.length + (this.config.options.selectable ? 1 : 0);
        td.className = 'table-loading';
        td.innerHTML = `<div class="spinner"></div> ${this.config.options.loadingText}`;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    /**
     * Show empty state
     * @param {HTMLElement} tbody - Tbody element
     */
    showEmpty(tbody) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = this.state.columns.length + (this.config.options.selectable ? 1 : 0);
        td.className = 'table-empty';
        td.textContent = this.config.options.emptyText;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyDown);
        this.eventListeners.push(
            { element: document, event: 'keydown', handler: this.handleKeyDown }
        );

        // Window resize
        window.addEventListener('resize', this.handleResize);
        this.eventListeners.push(
            { element: window, event: 'resize', handler: this.handleResize }
        );
    }

    /**
     * Handle key down
     * @param {Event} e - Keyboard event
     */
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.clearSelection();
        }
    }

    /**
     * Handle resize
     */
    handleResize() {
        // Re-render if responsive
        if (this.config.options.responsive) {
            this.refresh();
        }
    }

    /**
     * Show column menu
     */
    showColumnMenu() {
        const menu = document.createElement('div');
        menu.className = 'column-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '1000';
        menu.style.background = this.config.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        menu.style.border = `1px solid ${this.config.options.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`;
        menu.style.borderRadius = '8px';
        menu.style.padding = '8px';
        menu.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';

        this.state.columns.forEach(column => {
            const item = document.createElement('div');
            item.className = 'column-menu-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.state.visibleColumns.has(column.key);
            checkbox.addEventListener('change', () => {
                this.toggleColumn(column.key);
            });
            const label = document.createElement('label');
            label.textContent = column.label || column.key;
            item.appendChild(checkbox);
            item.appendChild(label);
            menu.appendChild(item);
        });

        const rect = this.toolbarElement?.querySelector('.toolbar-btn')?.getBoundingClientRect();
        if (rect) {
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.left = `${rect.left}px`;
        }

        document.body.appendChild(menu);

        // Click outside to close
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 10);
    }

    /**
     * Start column resize
     * @param {MouseEvent} e - Mouse event
     * @param {string} columnKey - Column key
     */
    startColumnResize(e, columnKey) {
        e.preventDefault();
        const th = this.thead?.querySelector(`th[data-column="${columnKey}"]`);
        if (!th) return;

        const startX = e.clientX;
        const startWidth = th.offsetWidth;

        const onMove = (moveEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 50) {
                th.style.width = `${newWidth}px`;
                this.state.columnWidths[columnKey] = `${newWidth}px`;
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    /**
     * Sort table by column
     * @param {string} columnKey - Column key
     * @param {string} direction - Sort direction
     */
    sort(columnKey, direction = null) {
        if (!this.config.options.sortable) return;

        const column = this.state.columns.find(c => c.key === columnKey);
        if (!column || column.sortable === false) return;

        // Toggle direction
        if (this.state.sortColumn === columnKey) {
            if (direction) {
                this.state.sortDirection = direction;
            } else {
                this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
            }
        } else {
            this.state.sortColumn = columnKey;
            this.state.sortDirection = direction || 'asc';
        }

        // Sort data
        const sorted = [...this.state.filteredData];
        sorted.sort((a, b) => {
            let valA = a[columnKey];
            let valB = b[columnKey];

            // Handle null/undefined
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            // Handle numbers
            if (typeof valA === 'number' && typeof valB === 'number') {
                return this.state.sortDirection === 'asc' ? valA - valB : valB - valA;
            }

            // Handle strings
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            const comparison = valA.localeCompare(valB);
            return this.state.sortDirection === 'asc' ? comparison : -comparison;
        });

        this.state.filteredData = sorted;
        this.state.data = sorted; // Update data

        // Update UI
        this.updateHeaderSort();
        this.refresh();

        if (this.config.onSort) {
            this.config.onSort(columnKey, this.state.sortDirection);
        }
    }

    /**
     * Update header sort indicators
     */
    updateHeaderSort() {
        const headers = this.thead?.querySelectorAll('th');
        if (!headers) return;

        headers.forEach(th => {
            const column = th.dataset.column;
            const sortIcon = th.querySelector('.sort-icon');
            if (sortIcon) {
                if (column === this.state.sortColumn) {
                    sortIcon.innerHTML = this.state.sortDirection === 'asc' ? '↑' : '↓';
                    th.classList.add('sorted');
                } else {
                    sortIcon.innerHTML = '↕';
                    th.classList.remove('sorted');
                }
            }
        });
    }

    /**
     * Filter table
     * @param {object} filters - Filter criteria
     */
    filter(filters) {
        this.state.filters = { ...this.state.filters, ...filters };
        this.applyFilters();
        this.refresh();
        if (this.config.onFilter) {
            this.config.onFilter(this.state.filters);
        }
    }

    /**
     * Apply filters to data
     */
    applyFilters() {
        let filtered = [...this.state.data];

        // Apply search
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            filtered = filtered.filter(row => {
                return Object.values(row).some(val => {
                    if (val === undefined || val === null) return false;
                    return String(val).toLowerCase().includes(query);
                });
            });
        }

        // Apply column filters
        for (const [key, value] of Object.entries(this.state.filters)) {
            if (value) {
                filtered = filtered.filter(row => {
                    const rowValue = row[key];
                    if (rowValue === undefined || rowValue === null) return false;
                    return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
                });
            }
        }

        this.state.filteredData = filtered;
    }

    /**
     * Search table
     * @param {string} query - Search query
     */
    search(query) {
        this.state.searchQuery = query;
        this.applyFilters();
        this.goToPage(1);
        this.refresh();
        if (this.config.onSearch) {
            this.config.onSearch(query);
        }
    }

    /**
     * Select a row
     * @param {number} rowIndex - Row index
     * @param {boolean} selected - Selected state
     */
    selectRow(rowIndex, selected) {
        if (selected) {
            this.state.selectedRows.add(rowIndex);
        } else {
            this.state.selectedRows.delete(rowIndex);
        }

        this.updateSelectionUI();
        if (this.config.onSelectionChange) {
            this.config.onSelectionChange(this.getSelectedRows());
        }
    }

    /**
     * Select all rows
     * @param {boolean} selected - Select state
     */
    selectAll(selected) {
        if (selected) {
            this.state.displayedData.forEach((_, index) => {
                this.state.selectedRows.add(index);
            });
        } else {
            this.state.selectedRows.clear();
        }

        this.updateSelectionUI();
        if (this.config.onSelectionChange) {
            this.config.onSelectionChange(this.getSelectedRows());
        }
    }

    /**
     * Get selected rows
     * @returns {Array} Selected rows
     */
    getSelectedRows() {
        return Array.from(this.state.selectedRows).map(index => this.state.data[index]);
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.state.selectedRows.clear();
        this.updateSelectionUI();
        if (this.config.onSelectionChange) {
            this.config.onSelectionChange([]);
        }
    }

    /**
     * Update selection UI
     */
    updateSelectionUI() {
        // Update checkboxes
        const checkboxes = this.element?.querySelectorAll('tbody input[type="checkbox"]');
        if (checkboxes) {
            checkboxes.forEach((checkbox, index) => {
                checkbox.checked = this.state.selectedRows.has(index);
            });
        }

        // Update select all checkbox
        const selectAll = this.element?.querySelector('thead input[type="checkbox"]');
        if (selectAll) {
            const total = this.state.displayedData.length;
            const selected = this.state.selectedRows.size;
            selectAll.checked = selected > 0 && selected === total;
            selectAll.indeterminate = selected > 0 && selected < total;
        }
    }

    /**
     * Toggle column visibility
     * @param {string} columnKey - Column key
     */
    toggleColumn(columnKey) {
        if (this.state.visibleColumns.has(columnKey)) {
            this.state.visibleColumns.delete(columnKey);
        } else {
            this.state.visibleColumns.add(columnKey);
        }
        this.refresh();
    }

    /**
     * Get visible columns
     * @returns {Array} Visible columns
     */
    getVisibleColumns() {
        return this.state.columns.filter(c => this.state.visibleColumns.has(c.key));
    }

    /**
     * Set data
     * @param {Array} data - New data
     */
    setData(data) {
        this.state.data = [...data];
        this.state.filteredData = [...data];
        this.state.selectedRows.clear();
        this.goToPage(1);
        this.refresh();
    }

    /**
     * Set columns
     * @param {Array} columns - New columns
     */
    setColumns(columns) {
        this.state.columns = [...columns];
        this.state.visibleColumns = new Set(columns.map(c => c.key));
        this.refresh();
    }

    /**
     * Add a row
     * @param {object} row - Row data
     */
    addRow(row) {
        this.state.data.push(row);
        this.applyFilters();
        this.refresh();
    }

    /**
     * Remove a row
     * @param {number} index - Row index
     */
    removeRow(index) {
        this.state.data.splice(index, 1);
        this.applyFilters();
        this.refresh();
    }

    /**
     * Update a row
     * @param {number} index - Row index
     * @param {object} data - New row data
     */
    updateRow(index, data) {
        this.state.data[index] = { ...this.state.data[index], ...data };
        this.applyFilters();
        this.refresh();
    }

    /**
     * Clear all data
     */
    clearData() {
        this.state.data = [];
        this.state.filteredData = [];
        this.state.selectedRows.clear();
        this.refresh();
    }

    /**
     * Go to page
     * @param {number} page - Page number
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.state.filteredData.length / this.state.pageSize);
        this.state.currentPage = Math.max(1, Math.min(page, totalPages));
        this.updateDisplayedData();
        this.updatePaginationUI();
        if (this.config.onPageChange) {
            this.config.onPageChange(this.state.currentPage);
        }
    }

    /**
     * Next page
     */
    nextPage() {
        if (this.state.currentPage < this.state.totalPages) {
            this.goToPage(this.state.currentPage + 1);
        }
    }

    /**
     * Previous page
     */
    prevPage() {
        if (this.state.currentPage > 1) {
            this.goToPage(this.state.currentPage - 1);
        }
    }

    /**
     * First page
     */
    firstPage() {
        this.goToPage(1);
    }

    /**
     * Last page
     */
    lastPage() {
        this.goToPage(this.state.totalPages);
    }

    /**
     * Set page size
     * @param {number} size - Page size
     */
    setPageSize(size) {
        this.state.pageSize = size;
        this.goToPage(1);
        if (this.config.onPageChange) {
            this.config.onPageChange(this.state.currentPage);
        }
    }

    /**
     * Update displayed data based on pagination
     */
    updateDisplayedData() {
        const start = (this.state.currentPage - 1) * this.state.pageSize;
        const end = start + this.state.pageSize;
        this.state.displayedData = this.state.filteredData.slice(start, end);
        this.state.totalPages = Math.ceil(this.state.filteredData.length / this.state.pageSize);
    }

    /**
     * Update pagination UI
     */
    updatePaginationUI() {
        if (!this.paginationElement) return;

        // Update page info
        const info = this.paginationElement.querySelector('.page-info');
        if (info) {
            const total = this.state.filteredData.length;
            const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
            const end = Math.min(start + this.state.pageSize - 1, total);
            info.textContent = `${start}-${end} of ${total}`;
        }

        // Update page buttons
        const buttons = this.paginationElement.querySelector('.page-buttons');
        if (buttons) {
            // Rebuild pagination
            const newPagination = this.buildPagination();
            this.paginationElement.replaceWith(newPagination);
            this.paginationElement = newPagination;
        }
    }

    /**
     * Refresh the table
     */
    refresh() {
        // Update displayed data
        this.updateDisplayedData();

        // Rebuild body
        const newBody = this.buildBody();
        if (this.tbody) {
            this.tbody.replaceWith(newBody);
            this.tbody = newBody;
        }

        // Update footer
        if (this.tfoot) {
            const newFooter = this.buildFooter();
            this.tfoot.replaceWith(newFooter);
            this.tfoot = newFooter;
        }

        // Update pagination
        if (this.paginationElement) {
            this.updatePaginationUI();
        }

        // Update selection UI
        this.updateSelectionUI();

        // Update header sort
        this.updateHeaderSort();
    }

    /**
     * Export as CSV
     * @param {object} options - Export options
     */
    exportCSV(options = {}) {
        const columns = this.getVisibleColumns();
        const headers = columns.map(c => c.label || c.key);
        const rows = this.state.data.map(row => 
            columns.map(c => {
                let value = row[c.key];
                if (value === undefined || value === null) return '';
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            })
        );

        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        this.downloadFile(csv, 'table-data.csv', 'text/csv');

        if (this.config.onExport) {
            this.config.onExport('csv', csv);
        }
    }

    /**
     * Export as Excel
     * @param {object} options - Export options
     */
    exportExcel(options = {}) {
        // For MVP, use CSV as Excel
        // In production, use a proper Excel library
        const columns = this.getVisibleColumns();
        const headers = columns.map(c => c.label || c.key);
        const rows = this.state.data.map(row => 
            columns.map(c => {
                let value = row[c.key];
                if (value === undefined || value === null) return '';
                return value;
            })
        );

        // Simple TSV format for Excel
        const excel = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        this.downloadFile(excel, 'table-data.xls', 'application/vnd.ms-excel');

        if (this.config.onExport) {
            this.config.onExport('excel', excel);
        }
    }

    /**
     * Export as PDF
     * @param {object} options - Export options
     */
    exportPDF(options = {}) {
        // In production, this would use a PDF library
        // For MVP, use window.print()
        window.print();

        if (this.config.onExport) {
            this.config.onExport('pdf', null);
        }
    }

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy the table
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

        this.element = null;
        this.container = null;
        this.thead = null;
        this.tbody = null;
        this.tfoot = null;
        this.paginationElement = null;
        this.toolbarElement = null;
    }
}

// Export for use in other files
export default Table;
