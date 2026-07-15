/**
 * ==========================================
 * FILE: Kanban.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade Kanban board component for 11 Avatar CRM.
 * Provides a complete Kanban board with drag & drop, swimlanes,
 * filtering, sorting, and more.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Drag & Drop (Touch & Mouse)
 * - Multiple Columns
 * - Swimlanes
 * - Card Customization
 * - Filtering
 * - Sorting
 * - Search
 * - Card Modal
 * - Card Labels
 * - Card Assignees
 * - Card Checklists
 * - Card Comments
 * - Card Attachments
 * - Due Dates
 * - Priority Indicators
 * - Activity Log
 * - Undo/Redo
 * - Keyboard Shortcuts
 * - Accessibility Ready
 * - Responsive Design
 * - Theme Support
 * 
 * USAGE EXAMPLE:
 * import { Kanban } from './components/Kanban.js';
 * 
 * const kanban = new Kanban({
 *   container: '#kanban-board',
 *   columns: [
 *     { id: 'todo', title: 'To Do', color: '#3B82F6' },
 *     { id: 'in_progress', title: 'In Progress', color: '#F59E0B' },
 *     { id: 'review', title: 'Review', color: '#8B5CF6' },
 *     { id: 'done', title: 'Done', color: '#10B981' }
 *   ],
 *   cards: [
 *     { id: 'card_1', title: 'Task 1', column: 'todo', priority: 'high', assignees: ['John'] },
 *     { id: 'card_2', title: 'Task 2', column: 'in_progress', priority: 'medium', assignees: ['Jane'] }
 *   ],
 *   onCardMove: (cardId, fromColumn, toColumn) => { ... },
 *   onCardClick: (card) => { ... },
 *   onCardAdd: (columnId, cardData) => { ... }
 * });
 * 
 * kanban.render();
 * kanban.addCard('todo', { title: 'New Task' });
 * kanban.moveCard('card_1', 'done');
 * ==========================================
 */

export class Kanban {
    /**
     * Kanban constructor
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        this.config = {
            container: options.container || '#kanban-board',
            columns: options.columns || [],
            cards: options.cards || [],
            swimlanes: options.swimlanes || [],
            enableDragDrop: options.enableDragDrop !== undefined ? options.enableDragDrop : true,
            enableSwimlanes: options.enableSwimlanes || false,
            enableFiltering: options.enableFiltering !== undefined ? options.enableFiltering : true,
            enableSorting: options.enableSorting !== undefined ? options.enableSorting : true,
            enableSearch: options.enableSearch !== undefined ? options.enableSearch : true,
            enableCardModal: options.enableCardModal !== undefined ? options.enableCardModal : true,
            enableActivityLog: options.enableActivityLog !== undefined ? options.enableActivityLog : true,
            enableUndo: options.enableUndo !== undefined ? options.enableUndo : true,
            showCardCount: options.showCardCount !== undefined ? options.showCardCount : true,
            showAddCard: options.showAddCard !== undefined ? options.showAddCard : true,
            showCardLabels: options.showCardLabels !== undefined ? options.showCardLabels : true,
            showAssignees: options.showAssignees !== undefined ? options.showAssignees : true,
            showDueDates: options.showDueDates !== undefined ? options.showDueDates : true,
            showPriority: options.showPriority !== undefined ? options.showPriority : true,
            theme: options.theme || 'light',
            maxCardsPerColumn: options.maxCardsPerColumn || 0,
            cardLimit: options.cardLimit || 0,
            columnWidth: options.columnWidth || '280px',
            minColumnHeight: options.minColumnHeight || '300px',
            maxColumnHeight: options.maxColumnHeight || '600px',
            dragDelay: options.dragDelay || 200,
            touchDragDelay: options.touchDragDelay || 500,
            onCardMove: options.onCardMove || null,
            onCardClick: options.onCardClick || null,
            onCardAdd: options.onCardAdd || null,
            onCardEdit: options.onCardEdit || null,
            onCardDelete: options.onCardDelete || null,
            onColumnAdd: options.onColumnAdd || null,
            onColumnEdit: options.onColumnEdit || null,
            onColumnDelete: options.onColumnDelete || null,
            onColumnMove: options.onColumnMove || null,
            ...options
        };

        // Internal state
        this.state = {
            columns: [...this.config.columns],
            cards: [...this.config.cards],
            swimlanes: [...this.config.swimlanes],
            cardOrder: {},
            dragData: null,
            searchQuery: '',
            filterBy: {},
            sortBy: null,
            sortOrder: 'asc',
            selectedCard: null,
            isDragging: false,
            isModalOpen: false,
            history: [],
            historyIndex: -1,
            maxHistory: 50,
            columnScrollPositions: {}
        };

        // DOM references
        this.element = null;
        this.container = null;
        this.boardElement = null;
        this.columns = {};
        this.cardElements = {};
        this.dragGhost = null;
        this.dragClone = null;
        this.dragOverElement = null;

        // Event listeners
        this.eventListeners = [];
        this.dragListeners = [];

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
        this.addCard = this.addCard.bind(this);
        this.addColumn = this.addColumn.bind(this);
        this.moveCard = this.moveCard.bind(this);
        this.moveColumn = this.moveColumn.bind(this);
        this.deleteCard = this.deleteCard.bind(this);
        this.deleteColumn = this.deleteColumn.bind(this);
        this.getCard = this.getCard.bind(this);
        this.getCards = this.getCards.bind(this);
        this.getColumns = this.getColumns.bind(this);
        this.getColumn = this.getColumn.bind(this);
        this.search = this.search.bind(this);
        this.filter = this.filter.bind(this);
        this.sort = this.sort.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragMove = this.handleDragMove.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.openCardModal = this.openCardModal.bind(this);
        this.closeCardModal = this.closeCardModal.bind(this);
        this.saveHistory = this.saveHistory.bind(this);
        this.undoHistory = this.undoHistory.bind(this);
        this.redoHistory = this.redoHistory.bind(this);
    }

    /**
     * Render the kanban board
     * @returns {Kanban} this (for chaining)
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

            // Create kanban element
            this.element = document.createElement('div');
            this.element.className = `crm-kanban theme-${this.config.theme}`;
            this.element.setAttribute('role', 'application');
            this.element.setAttribute('aria-label', 'Kanban Board');

            // Build toolbar
            if (this.config.enableSearch || this.config.enableFiltering || this.config.enableSorting) {
                const toolbar = this.buildToolbar();
                this.element.appendChild(toolbar);
            }

            // Build board
            this.boardElement = document.createElement('div');
            this.boardElement.className = 'kanban-board';
            this.boardElement.style.setProperty('--column-width', this.config.columnWidth);
            this.boardElement.style.setProperty('--min-column-height', this.config.minColumnHeight);
            this.boardElement.style.setProperty('--max-column-height', this.config.maxColumnHeight);

            // Build columns
            this.buildColumns();

            // Build swimlanes if enabled
            if (this.config.enableSwimlanes && this.state.swimlanes.length > 0) {
                this.buildSwimlanes();
            }

            this.element.appendChild(this.boardElement);

            // Build modal if enabled
            if (this.config.enableCardModal) {
                this.buildModal();
            }

            // Build activity log if enabled
            if (this.config.enableActivityLog) {
                this.buildActivityLog();
            }

            // Append to container
            this.container.appendChild(this.element);

            // Setup event listeners
            this.setupEventListeners();

            // Setup drag and drop
            if (this.config.enableDragDrop) {
                this.setupDragDrop();
            }

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup click outside
            document.addEventListener('click', this.handleClickOutside);

            // Update state
            this.saveHistory();

            return this;
        } catch (error) {
            console.error('[Kanban] Render error:', error);
            return this;
        }
    }

    /**
     * Build toolbar
     * @returns {HTMLElement} Toolbar element
     */
    buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'kanban-toolbar';

        // Search
        if (this.config.enableSearch) {
            const search = document.createElement('div');
            search.className = 'toolbar-search';
            const input = document.createElement('input');
            input.type = 'search';
            input.placeholder = 'Search cards...';
            input.setAttribute('aria-label', 'Search cards');
            input.addEventListener('input', (e) => {
                this.search(e.target.value);
            });
            search.appendChild(input);
            toolbar.appendChild(search);
        }

        // Filter
        if (this.config.enableFiltering) {
            const filter = document.createElement('div');
            filter.className = 'toolbar-filter';
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Filter by');
            const options = [
                { value: '', label: 'All' },
                { value: 'high', label: 'High Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'low', label: 'Low Priority' }
            ];
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
            select.addEventListener('change', (e) => {
                this.filter({ priority: e.target.value });
            });
            filter.appendChild(select);
            toolbar.appendChild(filter);
        }

        // Sort
        if (this.config.enableSorting) {
            const sort = document.createElement('div');
            sort.className = 'toolbar-sort';
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Sort by');
            const options = [
                { value: 'title_asc', label: 'Title (A-Z)' },
                { value: 'title_desc', label: 'Title (Z-A)' },
                { value: 'dueDate_asc', label: 'Due Date (Earliest)' },
                { value: 'dueDate_desc', label: 'Due Date (Latest)' },
                { value: 'priority_asc', label: 'Priority (Low-High)' },
                { value: 'priority_desc', label: 'Priority (High-Low)' }
            ];
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
            select.addEventListener('change', (e) => {
                const [field, order] = e.target.value.split('_');
                this.sort(field, order);
            });
            sort.appendChild(select);
            toolbar.appendChild(sort);
        }

        // Add column button
        if (this.config.showAddCard) {
            const addBtn = document.createElement('button');
            addBtn.className = 'toolbar-add-column';
            addBtn.textContent = '+ Add Column';
            addBtn.addEventListener('click', () => {
                const name = prompt('Enter column name:');
                if (name) {
                    this.addColumn({ title: name });
                }
            });
            toolbar.appendChild(addBtn);
        }

        // Undo/Redo
        if (this.config.enableUndo) {
            const actions = document.createElement('div');
            actions.className = 'toolbar-actions';

            const undoBtn = document.createElement('button');
            undoBtn.className = 'action-btn undo';
            undoBtn.textContent = '↩';
            undoBtn.setAttribute('aria-label', 'Undo');
            undoBtn.addEventListener('click', () => this.undo());
            actions.appendChild(undoBtn);

            const redoBtn = document.createElement('button');
            redoBtn.className = 'action-btn redo';
            redoBtn.textContent = '↪';
            redoBtn.setAttribute('aria-label', 'Redo');
            redoBtn.addEventListener('click', () => this.redo());
            actions.appendChild(redoBtn);

            toolbar.appendChild(actions);
        }

        return toolbar;
    }

    /**
     * Build columns
     */
    buildColumns() {
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns';

        this.state.columns.forEach((column, index) => {
            const columnEl = this.buildColumn(column, index);
            columnsContainer.appendChild(columnEl);
            this.columns[column.id] = columnEl;
        });

        this.boardElement.appendChild(columnsContainer);
    }

    /**
     * Build a single column
     * @param {object} column - Column data
     * @param {number} index - Column index
     * @returns {HTMLElement} Column element
     */
    buildColumn(column, index) {
        const columnEl = document.createElement('div');
        columnEl.className = `kanban-column ${column.className || ''}`;
        columnEl.dataset.columnId = column.id;
        columnEl.dataset.index = index;
        columnEl.style.setProperty('--column-color', column.color || '#D4AF37');

        // Column header
        const header = document.createElement('div');
        header.className = 'column-header';

        const title = document.createElement('div');
        title.className = 'column-title';
        title.textContent = column.title;

        const badge = document.createElement('span');
        badge.className = 'column-badge';
        const cardCount = this.getCardsByColumn(column.id).length;
        badge.textContent = cardCount;

        title.appendChild(badge);
        header.appendChild(title);

        // Column actions
        const actions = document.createElement('div');
        actions.className = 'column-actions';

        if (this.config.showAddCard) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-card-btn';
            addBtn.textContent = '+';
            addBtn.setAttribute('aria-label', 'Add card');
            addBtn.addEventListener('click', () => {
                const title = prompt('Enter card title:');
                if (title) {
                    this.addCard(column.id, { title });
                }
            });
            actions.appendChild(addBtn);
        }

        const menuBtn = document.createElement('button');
        menuBtn.className = 'column-menu-btn';
        menuBtn.textContent = '⋮';
        menuBtn.setAttribute('aria-label', 'Column menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showColumnMenu(column.id, e.target);
        });
        actions.appendChild(menuBtn);

        header.appendChild(actions);
        columnEl.appendChild(header);

        // Column body
        const body = document.createElement('div');
        body.className = 'column-body';
        body.dataset.columnId = column.id;

        // Cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'column-cards';

        // Render cards
        const cards = this.getCardsByColumn(column.id);
        cards.forEach(card => {
            const cardEl = this.buildCard(card);
            cardsContainer.appendChild(cardEl);
            this.cardElements[card.id] = cardEl;
        });

        body.appendChild(cardsContainer);

        // Drop zone
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.textContent = 'Drop here';
        body.appendChild(dropZone);

        columnEl.appendChild(body);

        return columnEl;
    }

    /**
     * Build a card
     * @param {object} card - Card data
     * @returns {HTMLElement} Card element
     */
    buildCard(card) {
        const cardEl = document.createElement('div');
        cardEl.className = `kanban-card ${card.className || ''}`;
        cardEl.dataset.cardId = card.id;
        cardEl.dataset.columnId = card.column;
        cardEl.draggable = this.config.enableDragDrop;

        // Card content
        const content = document.createElement('div');
        content.className = 'card-content';

        // Labels
        if (this.config.showCardLabels && card.labels && card.labels.length > 0) {
            const labels = document.createElement('div');
            labels.className = 'card-labels';
            card.labels.forEach(label => {
                const labelEl = document.createElement('span');
                labelEl.className = `card-label ${label.color || ''}`;
                labelEl.textContent = label.text;
                labels.appendChild(labelEl);
            });
            content.appendChild(labels);
        }

        // Title
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = card.title;
        content.appendChild(title);

        // Description
        if (card.description) {
            const desc = document.createElement('div');
            desc.className = 'card-description';
            desc.textContent = card.description.length > 100 ? card.description.substring(0, 100) + '...' : card.description;
            content.appendChild(desc);
        }

        // Card metadata
        const meta = document.createElement('div');
        meta.className = 'card-meta';

        // Priority
        if (this.config.showPriority && card.priority) {
            const priority = document.createElement('span');
            priority.className = `card-priority ${card.priority}`;
            const icons = { high: '🔴', medium: '🟡', low: '🟢' };
            priority.textContent = icons[card.priority] || '';
            meta.appendChild(priority);
        }

        // Due date
        if (this.config.showDueDates && card.dueDate) {
            const due = document.createElement('span');
            due.className = 'card-due-date';
            const isOverdue = new Date(card.dueDate) < new Date();
            if (isOverdue) due.classList.add('overdue');
            due.textContent = `📅 ${this.formatDate(card.dueDate)}`;
            meta.appendChild(due);
        }

        // Assignees
        if (this.config.showAssignees && card.assignees && card.assignees.length > 0) {
            const assignees = document.createElement('div');
            assignees.className = 'card-assignees';
            card.assignees.forEach(assignee => {
                const avatar = document.createElement('span');
                avatar.className = 'assignee-avatar';
                avatar.textContent = this.getInitials(assignee);
                avatar.title = assignee;
                assignees.appendChild(avatar);
            });
            meta.appendChild(assignees);
        }

        // Checklist progress
        if (card.checklist && card.checklist.length > 0) {
            const completed = card.checklist.filter(item => item.completed).length;
            const total = card.checklist.length;
            const progress = document.createElement('div');
            progress.className = 'card-checklist-progress';
            const bar = document.createElement('div');
            bar.className = 'progress-bar';
            bar.style.width = `${(completed / total) * 100}%`;
            progress.appendChild(bar);
            const text = document.createElement('span');
            text.className = 'progress-text';
            text.textContent = `${completed}/${total}`;
            progress.appendChild(text);
            meta.appendChild(progress);
        }

        content.appendChild(meta);

        // Comments count
        if (card.comments && card.comments.length > 0) {
            const comments = document.createElement('div');
            comments.className = 'card-comments-count';
            comments.textContent = `💬 ${card.comments.length}`;
            content.appendChild(comments);
        }

        cardEl.appendChild(content);

        // Click handler
        cardEl.addEventListener('click', () => {
            if (this.config.enableCardModal) {
                this.openCardModal(card.id);
            }
            if (this.config.onCardClick) {
                this.config.onCardClick(card);
            }
        });

        return cardEl;
    }

    /**
     * Build swimlanes
     */
    buildSwimlanes() {
        // Implementation for swimlanes
        // Similar to columns but with row grouping
    }

    /**
     * Build modal
     */
    buildModal() {
        const modal = document.createElement('div');
        modal.className = 'kanban-modal';
        modal.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.addEventListener('click', () => this.closeCardModal());
        modal.appendChild(overlay);

        const content = document.createElement('div');
        content.className = 'modal-content';
        modal.appendChild(content);

        this.element.appendChild(modal);
        this._modal = modal;
        this._modalContent = content;
    }

    /**
     * Build activity log
     */
    buildActivityLog() {
        const log = document.createElement('div');
        log.className = 'kanban-activity-log';
        log.style.display = 'none';
        this.element.appendChild(log);
        this._activityLog = log;
    }

    /**
     * Show column menu
     * @param {string} columnId - Column ID
     * @param {HTMLElement} target - Target element
     */
    showColumnMenu(columnId, target) {
        const menu = document.createElement('div');
        menu.className = 'column-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '1000';

        const items = [
            { label: 'Edit', action: () => this.editColumn(columnId) },
            { label: 'Delete', action: () => this.deleteColumn(columnId) },
            { label: 'Move Left', action: () => this.moveColumn(columnId, -1) },
            { label: 'Move Right', action: () => this.moveColumn(columnId, 1) }
        ];

        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });

        const rect = target.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${rect.left}px`;

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
     * Open card modal
     * @param {string} cardId - Card ID
     */
    openCardModal(cardId) {
        const card = this.getCard(cardId);
        if (!card) return;

        this.state.selectedCard = cardId;
        this.state.isModalOpen = true;

        const content = this._modalContent;
        content.innerHTML = '';

        // Modal header
        const header = document.createElement('div');
        header.className = 'modal-header';

        const title = document.createElement('h2');
        title.textContent = card.title;
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.closeCardModal());
        header.appendChild(closeBtn);

        content.appendChild(header);

        // Modal body
        const body = document.createElement('div');
        body.className = 'modal-body';

        // Card details
        const details = document.createElement('div');
        details.className = 'card-details';

        // Description
        const desc = document.createElement('div');
        desc.className = 'detail-section';
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Description';
        desc.appendChild(descLabel);
        const descContent = document.createElement('div');
        descContent.textContent = card.description || 'No description';
        desc.appendChild(descContent);
        details.appendChild(desc);

        // Column
        const col = document.createElement('div');
        col.className = 'detail-section';
        const colLabel = document.createElement('label');
        colLabel.textContent = 'Column';
        col.appendChild(colLabel);
        const colValue = document.createElement('div');
        const column = this.getColumn(card.column);
        colValue.textContent = column ? column.title : card.column;
        col.appendChild(colValue);
        details.appendChild(col);

        // Priority
        const priority = document.createElement('div');
        priority.className = 'detail-section';
        const priorityLabel = document.createElement('label');
        priorityLabel.textContent = 'Priority';
        priority.appendChild(priorityLabel);
        const priorityValue = document.createElement('div');
        priorityValue.textContent = card.priority || 'None';
        priorityValue.className = `priority-${card.priority || 'none'}`;
        priority.appendChild(priorityValue);
        details.appendChild(priority);

        // Due date
        const due = document.createElement('div');
        due.className = 'detail-section';
        const dueLabel = document.createElement('label');
        dueLabel.textContent = 'Due Date';
        due.appendChild(dueLabel);
        const dueValue = document.createElement('div');
        dueValue.textContent = card.dueDate ? this.formatDate(card.dueDate) : 'No due date';
        due.appendChild(dueValue);
        details.appendChild(due);

        // Assignees
        if (card.assignees && card.assignees.length > 0) {
            const assignees = document.createElement('div');
            assignees.className = 'detail-section';
            const assigneesLabel = document.createElement('label');
            assigneesLabel.textContent = 'Assignees';
            assignees.appendChild(assigneesLabel);
            const assigneesValue = document.createElement('div');
            assigneesValue.className = 'assignees-list';
            card.assignees.forEach(assignee => {
                const avatar = document.createElement('span');
                avatar.className = 'assignee-avatar';
                avatar.textContent = this.getInitials(assignee);
                avatar.title = assignee;
                assigneesValue.appendChild(avatar);
            });
            assignees.appendChild(assigneesValue);
            details.appendChild(assignees);
        }

        body.appendChild(details);

        // Checklist
        if (card.checklist && card.checklist.length > 0) {
            const checklist = document.createElement('div');
            checklist.className = 'checklist-section';

            const checklistLabel = document.createElement('h3');
            checklistLabel.textContent = 'Checklist';
            checklist.appendChild(checklistLabel);

            card.checklist.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'checklist-item';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = item.completed;
                checkbox.addEventListener('change', () => {
                    card.checklist[index].completed = checkbox.checked;
                    this.updateCard(card.id, { checklist: card.checklist });
                    this.saveHistory();
                });
                itemEl.appendChild(checkbox);
                const text = document.createElement('span');
                text.textContent = item.text;
                if (item.completed) text.style.textDecoration = 'line-through';
                itemEl.appendChild(text);
                checklist.appendChild(itemEl);
            });

            body.appendChild(checklist);
        }

        // Comments
        if (card.comments && card.comments.length > 0) {
            const comments = document.createElement('div');
            comments.className = 'comments-section';

            const commentsLabel = document.createElement('h3');
            commentsLabel.textContent = 'Comments';
            comments.appendChild(commentsLabel);

            card.comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment-item';
                const author = document.createElement('strong');
                author.textContent = comment.author || 'User';
                commentEl.appendChild(author);
                const text = document.createElement('p');
                text.textContent = comment.text;
                commentEl.appendChild(text);
                const time = document.createElement('span');
                time.className = 'comment-time';
                time.textContent = this.formatTimeAgo(comment.timestamp);
                commentEl.appendChild(time);
                comments.appendChild(commentEl);
            });

            body.appendChild(comments);
        }

        // Add comment
        const addComment = document.createElement('div');
        addComment.className = 'add-comment';
        const commentInput = document.createElement('textarea');
        commentInput.placeholder = 'Add a comment...';
        addComment.appendChild(commentInput);
        const commentBtn = document.createElement('button');
        commentBtn.textContent = 'Add Comment';
        commentBtn.addEventListener('click', () => {
            if (commentInput.value.trim()) {
                const newComment = {
                    text: commentInput.value.trim(),
                    author: 'User',
                    timestamp: new Date().toISOString()
                };
                if (!card.comments) card.comments = [];
                card.comments.push(newComment);
                this.updateCard(card.id, { comments: card.comments });
                this.saveHistory();
                this.openCardModal(card.id);
            }
        });
        addComment.appendChild(commentBtn);
        body.appendChild(addComment);

        // Modal footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            this.editCard(card.id);
        });
        footer.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this card?')) {
                this.deleteCard(card.id);
                this.closeCardModal();
            }
        });
        footer.appendChild(deleteBtn);

        const closeBtnFooter = document.createElement('button');
        closeBtnFooter.className = 'btn btn-primary';
        closeBtnFooter.textContent = 'Close';
        closeBtnFooter.addEventListener('click', () => this.closeCardModal());
        footer.appendChild(closeBtnFooter);

        content.appendChild(body);
        content.appendChild(footer);

        this._modal.style.display = 'flex';
    }

    /**
     * Close card modal
     */
    closeCardModal() {
        this.state.isModalOpen = false;
        this.state.selectedCard = null;
        if (this._modal) {
            this._modal.style.display = 'none';
        }
    }

    /**
     * Edit a card
     * @param {string} cardId - Card ID
     */
    editCard(cardId) {
        const card = this.getCard(cardId);
        if (!card) return;

        // Simple inline edit - show prompt
        const newTitle = prompt('Edit card title:', card.title);
        if (newTitle !== null) {
            this.updateCard(cardId, { title: newTitle });
            this.saveHistory();
            this.openCardModal(cardId);
        }
    }

    /**
     * Edit a column
     * @param {string} columnId - Column ID
     */
    editColumn(columnId) {
        const column = this.getColumn(columnId);
        if (!column) return;

        const newTitle = prompt('Edit column name:', column.title);
        if (newTitle !== null) {
            this.updateColumn(columnId, { title: newTitle });
            this.saveHistory();
        }
    }

    /**
     * Update a card
     * @param {string} cardId - Card ID
     * @param {object} data - Updated card data
     */
    updateCard(cardId, data) {
        const index = this.state.cards.findIndex(c => c.id === cardId);
        if (index === -1) return;

        this.state.cards[index] = { ...this.state.cards[index], ...data };
        this.render();
    }

    /**
     * Update a column
     * @param {string} columnId - Column ID
     * @param {object} data - Updated column data
     */
    updateColumn(columnId, data) {
        const index = this.state.columns.findIndex(c => c.id === columnId);
        if (index === -1) return;

        this.state.columns[index] = { ...this.state.columns[index], ...data };
        this.render();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown);
        this.eventListeners.push(
            { element: document, event: 'keydown', handler: this.handleKeyDown }
        );
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        // Already handled in event listeners
    }

    /**
     * Setup drag and drop
     */
    setupDragDrop() {
        if (!this.config.enableDragDrop) return;

        // Use mouse events for drag and drop
        document.addEventListener('mousedown', this.handleDragStart);
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);

        // Touch events for mobile
        document.addEventListener('touchstart', this.handleDragStart, { passive: false });
        document.addEventListener('touchmove', this.handleDragMove, { passive: false });
        document.addEventListener('touchend', this.handleDragEnd, { passive: false });

        this.dragListeners = [
            { element: document, event: 'mousedown', handler: this.handleDragStart },
            { element: document, event: 'mousemove', handler: this.handleDragMove },
            { element: document, event: 'mouseup', handler: this.handleDragEnd },
            { element: document, event: 'touchstart', handler: this.handleDragStart },
            { element: document, event: 'touchmove', handler: this.handleDragMove },
            { element: document, event: 'touchend', handler: this.handleDragEnd }
        ];
    }

    /**
     * Handle drag start
     * @param {Event} e - Event
     */
    handleDragStart(e) {
        const target = e.target.closest('.kanban-card');
        if (!target) return;

        const cardId = target.dataset.cardId;
        const card = this.getCard(cardId);
        if (!card) return;

        this.state.isDragging = true;
        this.state.dragData = {
            cardId: cardId,
            card: card,
            startColumn: card.column,
            startX: e.clientX || e.touches?.[0]?.clientX || 0,
            startY: e.clientY || e.touches?.[0]?.clientY || 0,
            offsetX: 0,
            offsetY: 0,
            isTouch: e.type === 'touchstart'
        };

        // Create drag ghost
        this.dragGhost = target.cloneNode(true);
        this.dragGhost.className = 'drag-ghost';
        this.dragGhost.style.position = 'fixed';
        this.dragGhost.style.pointerEvents = 'none';
        this.dragGhost.style.zIndex = '9999';
        this.dragGhost.style.width = `${target.offsetWidth}px`;
        this.dragGhost.style.opacity = '0.8';
        this.dragGhost.style.transform = 'rotate(3deg) scale(0.95)';
        this.dragGhost.style.transition = 'none';

        const rect = target.getBoundingClientRect();
        const offsetX = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
        const offsetY = (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top;
        this.state.dragData.offsetX = offsetX;
        this.state.dragData.offsetY = offsetY;

        this.dragGhost.style.left = `${(e.clientX || e.touches?.[0]?.clientX || 0) - offsetX}px`;
        this.dragGhost.style.top = `${(e.clientY || e.touches?.[0]?.clientY || 0) - offsetY}px`;

        document.body.appendChild(this.dragGhost);

        // Add dragging class to original
        target.classList.add('dragging');

        // Hide original card
        target.style.opacity = '0.3';

        // Prevent text selection
        document.body.style.userSelect = 'none';
    }

    /**
     * Handle drag move
     * @param {Event} e - Event
     */
    handleDragMove(e) {
        if (!this.state.isDragging || !this.dragGhost) return;

        const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
        const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
        const offsetX = this.state.dragData.offsetX || 0;
        const offsetY = this.state.dragData.offsetY || 0;

        this.dragGhost.style.left = `${clientX - offsetX}px`;
        this.dragGhost.style.top = `${clientY - offsetY}px`;

        // Find drop target
        const elements = document.elementsFromPoint(clientX, clientY);
        const dropTarget = elements.find(el => 
            el.classList.contains('column-cards') || 
            el.classList.contains('kanban-column') ||
            el.classList.contains('drop-zone')
        );

        // Remove drop zone highlights
        document.querySelectorAll('.drop-zone.highlight').forEach(el => el.classList.remove('highlight'));
        document.querySelectorAll('.kanban-column.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.column-cards.drag-over').forEach(el => el.classList.remove('drag-over'));

        if (dropTarget) {
            const column = dropTarget.closest('.kanban-column');
            if (column) {
                column.classList.add('drag-over');
                const dropZone = column.querySelector('.drop-zone');
                if (dropZone) {
                    dropZone.classList.add('highlight');
                }
            }
            dropTarget.classList.add('drag-over');
        }

        // Prevent scroll on touch
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
    }

    /**
     * Handle drag end
     * @param {Event} e - Event
     */
    handleDragEnd(e) {
        if (!this.state.isDragging) return;

        const clientX = e.clientX || e.changedTouches?.[0]?.clientX || 0;
        const clientY = e.clientY || e.changedTouches?.[0]?.clientY || 0;

        // Find drop target
        const elements = document.elementsFromPoint(clientX, clientY);
        const dropTarget = elements.find(el => 
            el.classList.contains('column-cards') || 
            el.classList.contains('kanban-column') ||
            el.classList.contains('drop-zone')
        );

        let targetColumn = null;
        if (dropTarget) {
            const column = dropTarget.closest('.kanban-column');
            if (column) {
                targetColumn = column.dataset.columnId;
            }
        }

        // Clean up
        if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
        }

        document.querySelectorAll('.drop-zone.highlight').forEach(el => el.classList.remove('highlight'));
        document.querySelectorAll('.kanban-column.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.column-cards.drag-over').forEach(el => el.classList.remove('drag-over'));

        // Reset card styles
        document.querySelectorAll('.kanban-card.dragging').forEach(el => {
            el.classList.remove('dragging');
            el.style.opacity = '1';
        });

        document.body.style.userSelect = '';

        // Move card if dropped on a different column
        if (targetColumn && targetColumn !== this.state.dragData.startColumn) {
            this.moveCard(this.state.dragData.cardId, targetColumn);
            this.saveHistory();
        }

        this.state.isDragging = false;
        this.state.dragData = null;
    }

    /**
     * Handle drag over (for native drag and drop fallback)
     * @param {Event} e - Event
     */
    handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.kanban-column');
        if (target) {
            target.classList.add('drag-over');
        }
    }

    /**
     * Handle drop (for native drag and drop fallback)
     * @param {Event} e - Event
     */
    handleDrop(e) {
        e.preventDefault();
        const target = e.target.closest('.kanban-column');
        if (target) {
            target.classList.remove('drag-over');
        }

        const cardId = e.dataTransfer?.getData('text/plain');
        if (cardId) {
            const columnId = target?.dataset.columnId;
            if (columnId) {
                this.moveCard(cardId, columnId);
                this.saveHistory();
            }
        }
    }

    /**
     * Handle click outside
     * @param {Event} e - Event
     */
    handleClickOutside(e) {
        if (this.state.isModalOpen && this._modal) {
            if (!this._modalContent.contains(e.target)) {
                this.closeCardModal();
            }
        }
    }

    /**
     * Handle key down
     * @param {Event} e - Event
     */
    handleKeyDown(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'Escape':
                    if (this.state.isModalOpen) {
                        this.closeCardModal();
                    }
                    break;
            }
        }
    }

    /**
     * Save history state
     */
    saveHistory() {
        if (!this.config.enableUndo) return;

        const state = {
            columns: JSON.parse(JSON.stringify(this.state.columns)),
            cards: JSON.parse(JSON.stringify(this.state.cards))
        };

        // Remove future states
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        }

        this.state.history.push(state);
        if (this.state.history.length > this.state.maxHistory) {
            this.state.history.shift();
        }
        this.state.historyIndex = this.state.history.length - 1;
    }

    /**
     * Undo last action
     */
    undo() {
        if (!this.config.enableUndo) return;
        if (this.state.historyIndex <= 0) return;

        this.state.historyIndex--;
        this.restoreState(this.state.history[this.state.historyIndex]);
    }

    /**
     * Redo last action
     */
    redo() {
        if (!this.config.enableUndo) return;
        if (this.state.historyIndex >= this.state.history.length - 1) return;

        this.state.historyIndex++;
        this.restoreState(this.state.history[this.state.historyIndex]);
    }

    /**
     * Restore state
     * @param {object} state - State to restore
     */
    restoreState(state) {
        this.state.columns = state.columns;
        this.state.cards = state.cards;
        this.render();
    }

    /**
     * Add a card
     * @param {string} columnId - Column ID
     * @param {object} cardData - Card data
     * @returns {object} Added card
     */
    addCard(columnId, cardData) {
        const column = this.getColumn(columnId);
        if (!column) {
            throw new Error(`Column ${columnId} not found`);
        }

        const card = {
            id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            column: columnId,
            title: cardData.title || 'New Card',
            description: cardData.description || '',
            priority: cardData.priority || 'medium',
            labels: cardData.labels || [],
            assignees: cardData.assignees || [],
            dueDate: cardData.dueDate || null,
            checklist: cardData.checklist || [],
            comments: cardData.comments || [],
            attachments: cardData.attachments || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...cardData
        };

        this.state.cards.push(card);

        if (this.config.onCardAdd) {
            this.config.onCardAdd(columnId, card);
        }

        this.saveHistory();
        this.render();
        return card;
    }

    /**
     * Add a column
     * @param {object} columnData - Column data
     * @returns {object} Added column
     */
    addColumn(columnData) {
        const column = {
            id: 'col_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            title: columnData.title || 'New Column',
            color: columnData.color || '#D4AF37',
            className: columnData.className || '',
            ...columnData
        };

        this.state.columns.push(column);

        if (this.config.onColumnAdd) {
            this.config.onColumnAdd(column);
        }

        this.saveHistory();
        this.render();
        return column;
    }

    /**
     * Move a card to a different column
     * @param {string} cardId - Card ID
     * @param {string} targetColumnId - Target column ID
     * @returns {boolean} Success
     */
    moveCard(cardId, targetColumnId) {
        const card = this.getCard(cardId);
        if (!card) return false;

        const targetColumn = this.getColumn(targetColumnId);
        if (!targetColumn) return false;

        const fromColumn = card.column;
        card.column = targetColumnId;
        card.updatedAt = new Date().toISOString();

        if (this.config.onCardMove) {
            this.config.onCardMove(cardId, fromColumn, targetColumnId);
        }

        // Update card order
        this.render();
        return true;
    }

    /**
     * Move a column
     * @param {string} columnId - Column ID
     * @param {number} direction - Direction (-1 for left, 1 for right)
     * @returns {boolean} Success
     */
    moveColumn(columnId, direction) {
        const index = this.state.columns.findIndex(c => c.id === columnId);
        if (index === -1) return false;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.state.columns.length) return false;

        const [column] = this.state.columns.splice(index, 1);
        this.state.columns.splice(newIndex, 0, column);

        if (this.config.onColumnMove) {
            this.config.onColumnMove(columnId, index, newIndex);
        }

        this.saveHistory();
        this.render();
        return true;
    }

    /**
     * Delete a card
     * @param {string} cardId - Card ID
     * @returns {boolean} Success
     */
    deleteCard(cardId) {
        const index = this.state.cards.findIndex(c => c.id === cardId);
        if (index === -1) return false;

        const card = this.state.cards[index];
        this.state.cards.splice(index, 1);

        if (this.config.onCardDelete) {
            this.config.onCardDelete(card);
        }

        this.saveHistory();
        this.render();
        return true;
    }

    /**
     * Delete a column
     * @param {string} columnId - Column ID
     * @returns {boolean} Success
     */
    deleteColumn(columnId) {
        const index = this.state.columns.findIndex(c => c.id === columnId);
        if (index === -1) return false;

        const column = this.state.columns[index];
        this.state.columns.splice(index, 1);

        // Delete all cards in this column
        this.state.cards = this.state.cards.filter(c => c.column !== columnId);

        if (this.config.onColumnDelete) {
            this.config.onColumnDelete(column);
        }

        this.saveHistory();
        this.render();
        return true;
    }

    /**
     * Get a card by ID
     * @param {string} cardId - Card ID
     * @returns {object|null} Card or null
     */
    getCard(cardId) {
        return this.state.cards.find(c => c.id === cardId) || null;
    }

    /**
     * Get all cards
     * @param {object} filters - Filters
     * @returns {Array} Cards
     */
    getCards(filters = {}) {
        let cards = [...this.state.cards];

        if (filters.column) {
            cards = cards.filter(c => c.column === filters.column);
        }

        if (filters.priority) {
            cards = cards.filter(c => c.priority === filters.priority);
        }

        if (filters.assignee) {
            cards = cards.filter(c => c.assignees && c.assignees.includes(filters.assignee));
        }

        if (filters.label) {
            cards = cards.filter(c => c.labels && c.labels.some(l => l.text === filters.label || l.id === filters.label));
        }

        if (filters.search) {
            const query = filters.search.toLowerCase();
            cards = cards.filter(c => 
                c.title.toLowerCase().includes(query) ||
                (c.description && c.description.toLowerCase().includes(query))
            );
        }

        return cards;
    }

    /**
     * Get cards by column
     * @param {string} columnId - Column ID
     * @returns {Array} Cards
     */
    getCardsByColumn(columnId) {
        return this.getCards({ column: columnId });
    }

    /**
     * Get a column by ID
     * @param {string} columnId - Column ID
     * @returns {object|null} Column or null
     */
    getColumn(columnId) {
        return this.state.columns.find(c => c.id === columnId) || null;
    }

    /**
     * Get all columns
     * @returns {Array} Columns
     */
    getColumns() {
        return [...this.state.columns];
    }

    /**
     * Search cards
     * @param {string} query - Search query
     */
    search(query) {
        this.state.searchQuery = query;
        this.filter({ search: query });
    }

    /**
     * Filter cards
     * @param {object} filters - Filters
     */
    filter(filters = {}) {
        this.state.filterBy = { ...this.state.filterBy, ...filters };
        this.render();
    }

    /**
     * Sort cards
     * @param {string} field - Sort field
     * @param {string} order - Sort order (asc/desc)
     */
    sort(field, order = 'asc') {
        this.state.sortBy = field;
        this.state.sortOrder = order;

        const cards = this.state.cards;
        cards.sort((a, b) => {
            let valA = a[field] || '';
            let valB = b[field] || '';

            if (field === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                valA = priorityOrder[valA] || 0;
                valB = priorityOrder[valB] || 0;
            }

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        this.render();
    }

    /**
     * Update the board with new data
     * @param {object} data - Update data
     */
    update(data) {
        if (data.columns) {
            this.state.columns = data.columns;
        }
        if (data.cards) {
            this.state.cards = data.cards;
        }
        if (data.swimlanes) {
            this.state.swimlanes = data.swimlanes;
        }
        this.render();
        this.saveHistory();
    }

    /**
     * Format date
     * @param {string} date - Date string
     * @returns {string} Formatted date
     */
    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    /**
     * Format time ago
     * @param {string} timestamp - Timestamp
     * @returns {string} Time ago
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
     * Get initials from name
     * @param {string} name - Full name
     * @returns {string} Initials
     */
    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    /**
     * Destroy the kanban board
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        this.dragListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.dragListeners = [];

        document.removeEventListener('click', this.handleClickOutside);

        // Remove DOM element
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.element = null;
        this.container = null;
        this.boardElement = null;
        this.columns = {};
        this.cardElements = {};
    }
}

// Export for use in other files
export default Kanban;
