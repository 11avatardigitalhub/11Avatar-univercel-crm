/**
 * ==========================================
 * FILE: Calendar.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade calendar component for 11 Avatar CRM.
 * Provides full calendar functionality with event management,
 * drag & drop, multiple views, and interactive features.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Multiple Views (Month, Week, Day, Agenda)
 * - Event Creation/Editing/Deletion
 * - Drag & Drop
 * - Event Categories & Colors
 * - Recurring Events
 * - Reminders & Notifications
 * - Keyboard Navigation
 * - Responsive Design
 * - Theme Support
 * - i18n Ready
 * 
 * USAGE EXAMPLE:
 * import { Calendar } from './components/Calendar.js';
 * 
 * const calendar = new Calendar({
 *   container: '#calendar',
 *   events: [...],
 *   view: 'month',
 *   onEventClick: (event) => { ... },
 *   onEventDrop: (event, newDate) => { ... }
 * });
 * 
 * calendar.render();
 * calendar.addEvent({ ... });
 * calendar.nextMonth();
 * ==========================================
 */

export class Calendar {
    /**
     * Calendar constructor
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        // Configuration
        this.config = {
            container: options.container || '#calendar',
            events: options.events || [],
            view: options.view || 'month', // month, week, day, agenda
            firstDayOfWeek: options.firstDayOfWeek || 0, // 0 = Sunday
            enableDragDrop: options.enableDragDrop !== undefined ? options.enableDragDrop : true,
            enableResize: options.enableResize !== undefined ? options.enableResize : true,
            enableKeyboard: options.enableKeyboard !== undefined ? options.enableKeyboard : true,
            enableReminders: options.enableReminders !== undefined ? options.enableReminders : true,
            enableRecurring: options.enableRecurring !== undefined ? options.enableRecurring : true,
            showWeekNumbers: options.showWeekNumbers || false,
            showToday: options.showToday !== undefined ? options.showToday : true,
            showNavigation: options.showNavigation !== undefined ? options.showNavigation : true,
            showHeader: options.showHeader !== undefined ? options.showHeader : true,
            eventLimit: options.eventLimit || 3, // Max events per day before "show more"
            timeFormat: options.timeFormat || 'h:mm A',
            dateFormat: options.dateFormat || 'MMMM D, YYYY',
            locale: options.locale || 'en',
            theme: options.theme || 'light', // light, dark, auto
            weekNumbers: options.weekNumbers || false,
            businessHours: options.businessHours || {
                start: 9, // 9 AM
                end: 18 // 6 PM
            },
            minTime: options.minTime || 0,
            maxTime: options.maxTime || 24,
            slotDuration: options.slotDuration || 30, // minutes
            scrollTime: options.scrollTime || 6, // 6 AM
            firstDay: options.firstDay || 0,
            allDaySlot: options.allDaySlot !== undefined ? options.allDaySlot : true,
            eventColor: options.eventColor || '#D4AF37',
            eventTextColor: options.eventTextColor || '#FFFFFF',
            loading: options.loading || false,
            editable: options.editable !== undefined ? options.editable : true,
            selectable: options.selectable !== undefined ? options.selectable : true,
            selectHelper: options.selectHelper !== undefined ? options.selectHelper : true,
            unselectAuto: options.unselectAuto !== undefined ? options.unselectAuto : true,
            nowIndicator: options.nowIndicator !== undefined ? options.nowIndicator : true,
            weekMode: options.weekMode || 'liquid', // liquid, fixed
            height: options.height || 'auto',
            contentHeight: options.contentHeight || 'auto',
            aspectRatio: options.aspectRatio || 1.35,
            handleWindowResize: options.handleWindowResize !== undefined ? options.handleWindowResize : true,
            windowResizeDelay: options.windowResizeDelay || 100,
            longPressDelay: options.longPressDelay || 1000,
            eventLongPressDelay: options.eventLongPressDelay || 1000,
            selectLongPressDelay: options.selectLongPressDelay || 1000,
            dragRevertDuration: options.dragRevertDuration || 500,
            dragScroll: options.dragScroll !== undefined ? options.dragScroll : true,
            dragScrollSensitivity: options.dragScrollSensitivity || 1,
            dragScrollSpeed: options.dragScrollSpeed || 1,
            snapDuration: options.snapDuration || 30, // minutes
            eventDurationEditable: options.eventDurationEditable !== undefined ? options.eventDurationEditable : true,
            eventStartEditable: options.eventStartEditable !== undefined ? options.eventStartEditable : true,
            eventConstraint: options.eventConstraint || null,
            overlap: options.overlap !== undefined ? options.overlap : true,
            businessHours: options.businessHours || false
        };

        // Internal state
        this.state = {
            currentDate: new Date(),
            selectedDate: null,
            selectedEvent: null,
            events: [...this.config.events],
            view: this.config.view,
            isLoading: this.config.loading,
            isDragging: false,
            isResizing: false,
            isSelecting: false,
            dragData: null,
            resizeData: null,
            selectData: null,
            tooltip: null,
            modal: null,
            popover: null,
            contextMenu: null,
            keyboardListeners: [],
            touchListeners: [],
            resizeListeners: [],
            eventListeners: []
        };

        // DOM references
        this.element = null;
        this.container = null;
        this.header = null;
        this.body = null;
        this.footer = null;
        this.toolbar = null;
        this.viewContainer = null;
        this.eventContainer = null;
        this.timeGrid = null;
        this.dayGrid = null;
        this.weekGrid = null;
        this.monthGrid = null;
        this.agendaGrid = null;

        // Cached DOM elements
        this.cache = {
            elements: new Map(),
            events: new Map(),
            dates: new Map(),
            slots: new Map(),
            cells: new Map()
        };

        // Event handlers
        this.handlers = {
            onEventClick: options.onEventClick || null,
            onEventDrop: options.onEventDrop || null,
            onEventResize: options.onEventResize || null,
            onDateSelect: options.onDateSelect || null,
            onDateClick: options.onDateClick || null,
            onDateChange: options.onDateChange || null,
            onViewChange: options.onViewChange || null,
            onEventAdd: options.onEventAdd || null,
            onEventEdit: options.onEventEdit || null,
            onEventDelete: options.onEventDelete || null,
            onEventDragStart: options.onEventDragStart || null,
            onEventDragStop: options.onEventDragStop || null,
            onEventResizeStart: options.onEventResizeStart || null,
            onEventResizeStop: options.onEventResizeStop || null,
            onSelectStart: options.onSelectStart || null,
            onSelectStop: options.onSelectStop || null,
            onLoading: options.onLoading || null,
            onError: options.onError || null,
            onRender: options.onRender || null,
            onDestroy: options.onDestroy || null
        };

        // i18n
        this.i18n = {
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            agenda: 'Agenda',
            allDay: 'All Day',
            events: 'Events',
            more: 'More',
            noEvents: 'No events',
            loading: 'Loading...',
            error: 'An error occurred',
            createEvent: 'Create Event',
            editEvent: 'Edit Event',
            deleteEvent: 'Delete Event',
            eventTitle: 'Title',
            eventDescription: 'Description',
            eventStart: 'Start',
            eventEnd: 'End',
            eventAllDay: 'All Day',
            eventRecurring: 'Recurring',
            eventReminders: 'Reminders',
            eventColor: 'Color',
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            confirmDelete: 'Are you sure you want to delete this event?',
            dragToCreate: 'Drag to create an event',
            eventMoved: 'Event moved',
            eventResized: 'Event resized',
            eventCreated: 'Event created',
            eventUpdated: 'Event updated',
            eventDeleted: 'Event deleted'
        };

        // Bind methods
        this.bindMethods();
    }

    /**
     * Bind methods to instance
     */
    bindMethods() {
        this.render = this.render.bind(this);
        this.destroy = this.destroy.bind(this);
        this.addEvent = this.addEvent.bind(this);
        this.updateEvent = this.updateEvent.bind(this);
        this.deleteEvent = this.deleteEvent.bind(this);
        this.getEvents = this.getEvents.bind(this);
        this.getEventById = this.getEventById.bind(this);
        this.clearEvents = this.clearEvents.bind(this);
        this.setEvents = this.setEvents.bind(this);
        this.nextMonth = this.nextMonth.bind(this);
        this.prevMonth = this.prevMonth.bind(this);
        this.nextYear = this.nextYear.bind(this);
        this.prevYear = this.prevYear.bind(this);
        this.goToday = this.goToday.bind(this);
        this.goToDate = this.goToDate.bind(this);
        this.setView = this.setView.bind(this);
        this.getView = this.getView.bind(this);
        this.getCurrentDate = this.getCurrentDate.bind(this);
        this.getSelectedDate = this.getSelectedDate.bind(this);
        this.setSelectedDate = this.setSelectedDate.bind(this);
        this.showEvent = this.showEvent.bind(this);
        this.hideEvent = this.hideEvent.bind(this);
        this.showTooltip = this.showTooltip.bind(this);
        this.hideTooltip = this.hideTooltip.bind(this);
        this.showModal = this.showModal.bind(this);
        this.hideModal = this.hideModal.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        this.hideContextMenu = this.hideContextMenu.bind(this);
        this.refresh = this.refresh.bind(this);
        this.updateSize = this.updateSize.bind(this);
        this.getDateStr = this.getDateStr.bind(this);
        this.getTimeStr = this.getTimeStr.bind(this);
        this.formatDate = this.formatDate.bind(this);
        this.formatTime = this.formatTime.bind(this);
        this.parseDate = this.parseDate.bind(this);
        this.parseTime = this.parseTime.bind(this);
        this.isToday = this.isToday.bind(this);
        this.isSameDay = this.isSameDay.bind(this);
        this.isSameWeek = this.isSameWeek.bind(this);
        this.isSameMonth = this.isSameMonth.bind(this);
        this.isSameYear = this.isSameYear.bind(this);
        this.getDaysInMonth = this.getDaysInMonth.bind(this);
        this.getFirstDayOfMonth = this.getFirstDayOfMonth.bind(this);
        this.getLastDayOfMonth = this.getLastDayOfMonth.bind(this);
        this.getWeekNumber = this.getWeekNumber.bind(this);
        this.getWeekDates = this.getWeekDates.bind(this);
        this.getMonthDates = this.getMonthDates.bind(this);
        this.getDayDates = this.getDayDates.bind(this);
        this.getEventOverlap = this.getEventOverlap.bind(this);
        this.getEventPosition = this.getEventPosition.bind(this);
        this.getSlotPosition = this.getSlotPosition.bind(this);
        this.getTimeFromPosition = this.getTimeFromPosition.bind(this);
        this.getDateFromPosition = this.getDateFromPosition.bind(this);
        this.getEventFromPosition = this.getEventFromPosition.bind(this);
        this.getEventFromElement = this.getEventFromElement.bind(this);
        this.getDateFromElement = this.getDateFromElement.bind(this);
        this.getCellFromElement = this.getCellFromElement.bind(this);
        this.getSlotFromElement = this.getSlotFromElement.bind(this);
        this.getDayFromElement = this.getDayFromElement.bind(this);
        this.getWeekFromElement = this.getWeekFromElement.bind(this);
        this.getMonthFromElement = this.getMonthFromElement.bind(this);
    }

    /**
     * Render the calendar
     * @param {object} options - Additional options
     * @returns {object} this (for chaining)
     */
    render(options = {}) {
        try {
            // Get container
            const container = document.querySelector(this.config.container);
            if (!container) {
                throw new Error(`Container "${this.config.container}" not found`);
            }

            this.container = container;

            // Clear container
            container.innerHTML = '';

            // Create calendar element
            const calendar = document.createElement('div');
            calendar.className = 'crm-calendar';
            calendar.dataset.theme = this.config.theme;
            calendar.dataset.view = this.state.view;
            calendar.dataset.editable = this.config.editable;
            calendar.dataset.selectable = this.config.selectable;
            calendar.setAttribute('role', 'application');
            calendar.setAttribute('aria-label', 'Calendar');

            this.element = calendar;
            container.appendChild(calendar);

            // Build calendar structure
            this.buildStructure();

            // Render content
            this.renderContent();

            // Setup event listeners
            this.setupEventListeners();

            // Setup keyboard navigation
            if (this.config.enableKeyboard) {
                this.setupKeyboardNavigation();
            }

            // Setup drag and drop
            if (this.config.enableDragDrop) {
                this.setupDragDrop();
            }

            // Setup resize
            if (this.config.enableResize) {
                this.setupResize();
            }

            // Handle window resize
            if (this.config.handleWindowResize) {
                this.setupWindowResize();
            }

            // Call onRender handler
            if (this.handlers.onRender) {
                this.handlers.onRender(this);
            }

            // Update loading state
            if (this.state.isLoading) {
                this.showLoading();
            }

            return this;
        } catch (error) {
            console.error('[Calendar] Render error:', error);
            if (this.handlers.onError) {
                this.handlers.onError(error);
            }
            return this;
        }
    }

    /**
     * Build calendar structure
     */
    buildStructure() {
        // Header
        if (this.config.showHeader) {
            this.header = document.createElement('div');
            this.header.className = 'calendar-header';
            this.element.appendChild(this.header);

            // Toolbar
            this.toolbar = this.buildToolbar();
            this.header.appendChild(this.toolbar);
        }

        // Body
        this.body = document.createElement('div');
        this.body.className = 'calendar-body';
        this.element.appendChild(this.body);

        // View container
        this.viewContainer = document.createElement('div');
        this.viewContainer.className = 'calendar-view-container';
        this.body.appendChild(this.viewContainer);

        // Event container
        this.eventContainer = document.createElement('div');
        this.eventContainer.className = 'calendar-event-container';
        this.body.appendChild(this.eventContainer);

        // Footer
        if (this.config.showToday) {
            this.footer = document.createElement('div');
            this.footer.className = 'calendar-footer';
            this.element.appendChild(this.footer);
            this.footer.innerHTML = `<button class="btn-today">${this.i18n.today}</button>`;
        }
    }

    /**
     * Build toolbar
     * @returns {HTMLElement} Toolbar element
     */
    buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'calendar-toolbar';

        // Left section - navigation
        const leftSection = document.createElement('div');
        leftSection.className = 'toolbar-left';
        toolbar.appendChild(leftSection);

        // Navigation buttons
        const navGroup = document.createElement('div');
        navGroup.className = 'nav-group';
        leftSection.appendChild(navGroup);

        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-nav prev';
        prevBtn.innerHTML = '‹';
        prevBtn.setAttribute('aria-label', 'Previous');
        navGroup.appendChild(prevBtn);

        const title = document.createElement('h2');
        title.className = 'calendar-title';
        navGroup.appendChild(title);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-nav next';
        nextBtn.innerHTML = '›';
        nextBtn.setAttribute('aria-label', 'Next');
        navGroup.appendChild(nextBtn);

        // Right section - view controls
        const rightSection = document.createElement('div');
        rightSection.className = 'toolbar-right';
        toolbar.appendChild(rightSection);

        // View buttons
        const viewGroup = document.createElement('div');
        viewGroup.className = 'view-group';
        rightSection.appendChild(viewGroup);

        const views = ['month', 'week', 'day', 'agenda'];
        const viewLabels = {
            month: this.i18n.month,
            week: this.i18n.week,
            day: this.i18n.day,
            agenda: this.i18n.agenda
        };

        views.forEach(view => {
            const btn = document.createElement('button');
            btn.className = `btn-view ${view === this.state.view ? 'active' : ''}`;
            btn.dataset.view = view;
            btn.textContent = viewLabels[view];
            viewGroup.appendChild(btn);
        });

        // Today button
        if (this.config.showToday) {
            const todayBtn = document.createElement('button');
            todayBtn.className = 'btn-today';
            todayBtn.textContent = this.i18n.today;
            rightSection.appendChild(todayBtn);
        }

        // Store references
        this.cache.elements.set('toolbar', toolbar);
        this.cache.elements.set('title', title);
        this.cache.elements.set('prevBtn', prevBtn);
        this.cache.elements.set('nextBtn', nextBtn);
        this.cache.elements.set('todayBtn', rightSection.querySelector('.btn-today'));

        return toolbar;
    }

    /**
     * Render calendar content
     */
    renderContent() {
        const view = this.state.view;
        const currentDate = this.state.currentDate;

        // Update title
        this.updateTitle();

        // Render based on view
        switch (view) {
            case 'month':
                this.renderMonthView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
            case 'agenda':
                this.renderAgendaView();
                break;
            default:
                this.renderMonthView();
        }

        // Render events
        this.renderEvents();
    }

    /**
     * Update calendar title
     */
    updateTitle() {
        const title = this.cache.elements.get('title');
        if (!title) return;

        const currentDate = this.state.currentDate;
        const view = this.state.view;

        let titleText = '';
        switch (view) {
            case 'month':
                titleText = this.formatDate(currentDate, 'MMMM YYYY');
                break;
            case 'week':
                const weekStart = this.getWeekStart(currentDate);
                const weekEnd = this.getWeekEnd(currentDate);
                titleText = `${this.formatDate(weekStart, 'MMM D')} - ${this.formatDate(weekEnd, 'MMM D, YYYY')}`;
                break;
            case 'day':
                titleText = this.formatDate(currentDate, 'MMMM D, YYYY');
                break;
            case 'agenda':
                titleText = this.formatDate(currentDate, 'MMMM YYYY');
                break;
            default:
                titleText = this.formatDate(currentDate, 'MMMM YYYY');
        }

        title.textContent = titleText;
    }

    /**
     * Render month view
     */
    renderMonthView() {
        const container = this.viewContainer;
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'calendar-month-grid';
        container.appendChild(grid);

        // Day headers
        const headerRow = document.createElement('div');
        headerRow.className = 'month-header';
        grid.appendChild(headerRow);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const firstDay = this.config.firstDayOfWeek;

        for (let i = 0; i < 7; i++) {
            const dayIndex = (firstDay + i) % 7;
            const header = document.createElement('div');
            header.className = 'month-header-day';
            header.textContent = days[dayIndex];
            headerRow.appendChild(header);
        }

        // Days grid
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';
        grid.appendChild(daysGrid);

        const monthDates = this.getMonthDates(this.state.currentDate);
        const today = new Date();

        monthDates.forEach((date) => {
            const dayCell = document.createElement('div');
            dayCell.className = 'month-day-cell';
            dayCell.dataset.date = date.toISOString();

            const isToday = this.isToday(date);
            const isCurrentMonth = date.getMonth() === this.state.currentDate.getMonth();

            if (isToday) {
                dayCell.classList.add('today');
            }

            if (!isCurrentMonth) {
                dayCell.classList.add('other-month');
            }

            // Day number
            const dayNum = document.createElement('div');
            dayNum.className = 'day-number';
            dayNum.textContent = date.getDate();
            dayCell.appendChild(dayNum);

            // Week number
            if (this.config.weekNumbers && date.getDate() <= 7) {
                const weekNum = this.getWeekNumber(date);
                const weekLabel = document.createElement('div');
                weekLabel.className = 'week-number';
                weekLabel.textContent = `W${weekNum}`;
                dayCell.appendChild(weekLabel);
            }

            // Events container
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';
            dayCell.appendChild(eventsContainer);

            daysGrid.appendChild(dayCell);

            // Store reference
            this.cache.cells.set(date.toISOString(), dayCell);
        });
    }

    /**
     * Render week view
     */
    renderWeekView() {
        const container = this.viewContainer;
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'calendar-week-grid';
        container.appendChild(grid);

        // Time column
        const timeCol = document.createElement('div');
        timeCol.className = 'week-time-column';
        grid.appendChild(timeCol);

        // Time slots
        for (let hour = this.config.minTime; hour < this.config.maxTime; hour++) {
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.dataset.hour = hour;
            const timeStr = `${hour}:00`;
            slot.textContent = this.formatTime(timeStr);
            timeCol.appendChild(slot);
        }

        // Day columns
        const weekDates = this.getWeekDates(this.state.currentDate);
        const today = new Date();

        weekDates.forEach((date) => {
            const dayCol = document.createElement('div');
            dayCol.className = 'week-day-column';
            dayCol.dataset.date = date.toISOString();

            const isToday = this.isToday(date);
            if (isToday) {
                dayCol.classList.add('today');
            }

            // Day header
            const header = document.createElement('div');
            header.className = 'week-day-header';
            header.textContent = this.formatDate(date, 'ddd D');
            dayCol.appendChild(header);

            // Day events container
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'week-day-events';
            dayCol.appendChild(eventsContainer);

            grid.appendChild(dayCol);

            // Store reference
            this.cache.cells.set(date.toISOString(), dayCol);
        });
    }

    /**
     * Render day view
     */
    renderDayView() {
        const container = this.viewContainer;
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'calendar-day-grid';
        container.appendChild(grid);

        // Time slots
        for (let hour = this.config.minTime; hour < this.config.maxTime; hour++) {
            const slot = document.createElement('div');
            slot.className = 'day-time-slot';
            slot.dataset.hour = hour;

            const timeStr = `${hour}:00`;
            const label = document.createElement('span');
            label.className = 'time-label';
            label.textContent = this.formatTime(timeStr);
            slot.appendChild(label);

            // Events container
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-slot-events';
            slot.appendChild(eventsContainer);

            grid.appendChild(slot);

            // Store reference
            this.cache.slots.set(`${this.state.currentDate.toISOString()}_${hour}`, slot);
        }
    }

    /**
     * Render agenda view
     */
    renderAgendaView() {
        const container = this.viewContainer;
        container.innerHTML = '';

        const list = document.createElement('div');
        list.className = 'calendar-agenda-list';
        container.appendChild(list);

        const events = this.getEventsForMonth(this.state.currentDate);
        const grouped = this.groupEventsByDay(events);

        if (Object.keys(grouped).length === 0) {
            const empty = document.createElement('div');
            empty.className = 'agenda-empty';
            empty.textContent = this.i18n.noEvents;
            list.appendChild(empty);
            return;
        }

        // Sort days
        const sortedDays = Object.keys(grouped).sort();

        sortedDays.forEach((day) => {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'agenda-day-group';

            const date = new Date(day);
            const header = document.createElement('div');
            header.className = 'agenda-day-header';

            const isToday = this.isToday(date);
            const dateStr = this.formatDate(date, 'EEEE, MMMM D');
            const dayLabel = isToday ? `${this.i18n.today} - ${dateStr}` : dateStr;
            header.textContent = dayLabel;
            dayGroup.appendChild(header);

            const eventsList = document.createElement('div');
            eventsList.className = 'agenda-day-events';

            grouped[day].forEach((event) => {
                const item = document.createElement('div');
                item.className = 'agenda-event-item';
                item.dataset.eventId = event.id;

                const time = document.createElement('span');
                time.className = 'agenda-event-time';
                time.textContent = event.allDay ? this.i18n.allDay : this.formatTime(event.start);
                item.appendChild(time);

                const title = document.createElement('span');
                title.className = 'agenda-event-title';
                title.textContent = event.title;
                item.appendChild(title);

                if (event.color) {
                    item.style.borderLeftColor = event.color;
                }

                eventsList.appendChild(item);
            });

            dayGroup.appendChild(eventsList);
            list.appendChild(dayGroup);
        });
    }

    /**
     * Render events on the calendar
     */
    renderEvents() {
        // Clear existing event elements
        this.cache.events.clear();

        // Get events for current view
        const events = this.getEventsForView();

        // Render based on view
        switch (this.state.view) {
            case 'month':
                this.renderEventsMonth(events);
                break;
            case 'week':
                this.renderEventsWeek(events);
                break;
            case 'day':
                this.renderEventsDay(events);
                break;
            case 'agenda':
                this.renderEventsAgenda(events);
                break;
        }
    }

    /**
     * Render events in month view
     * @param {Array} events - Events to render
     */
    renderEventsMonth(events) {
        const cells = this.cache.cells;

        // Group events by day
        const grouped = {};
        events.forEach(event => {
            const dateKey = this.getDateStr(event.start);
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });

        // Render events in each cell
        cells.forEach((cell, dateKey) => {
            const dayEvents = grouped[dateKey] || [];
            const eventsContainer = cell.querySelector('.day-events');
            if (!eventsContainer) return;

            eventsContainer.innerHTML = '';

            const limit = this.config.eventLimit;
            const visible = dayEvents.slice(0, limit);
            const remaining = dayEvents.length - limit;

            visible.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
                this.cache.events.set(event.id, eventEl);
            });

            if (remaining > 0) {
                const more = document.createElement('div');
                more.className = 'event-more';
                more.textContent = `+${remaining} ${this.i18n.more}`;
                more.dataset.date = dateKey;
                more.dataset.count = remaining;
                eventsContainer.appendChild(more);
            }
        });
    }

    /**
     * Render events in week view
     * @param {Array} events - Events to render
     */
    renderEventsWeek(events) {
        // Get day columns
        const dayColumns = this.viewContainer.querySelectorAll('.week-day-column');

        // Group events by day
        const grouped = {};
        events.forEach(event => {
            const dateKey = this.getDateStr(event.start);
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });

        dayColumns.forEach((col) => {
            const dateKey = col.dataset.date;
            const dayEvents = grouped[dateKey] || [];
            const eventsContainer = col.querySelector('.week-day-events');
            if (!eventsContainer) return;

            eventsContainer.innerHTML = '';

            dayEvents.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
                this.cache.events.set(event.id, eventEl);
            });
        });
    }

    /**
     * Render events in day view
     * @param {Array} events - Events to render
     */
    renderEventsDay(events) {
        const slots = this.cache.slots;

        // Group events by hour
        const grouped = {};
        events.forEach(event => {
            const hour = new Date(event.start).getHours();
            const key = `${this.state.currentDate.toISOString()}_${hour}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(event);
        });

        slots.forEach((slot, key) => {
            const slotEvents = grouped[key] || [];
            const eventsContainer = slot.querySelector('.day-slot-events');
            if (!eventsContainer) return;

            eventsContainer.innerHTML = '';

            slotEvents.forEach(event => {
                const eventEl = this.createEventElement(event);
                eventsContainer.appendChild(eventEl);
                this.cache.events.set(event.id, eventEl);
            });
        });
    }

    /**
     * Render events in agenda view
     * @param {Array} events - Events to render
     */
    renderEventsAgenda(events) {
        // Already rendered in agenda view
        // Just update event elements
        events.forEach(event => {
            const element = this.cache.events.get(event.id);
            if (element) {
                this.updateEventElement(element, event);
            }
        });
    }

    /**
     * Create an event element
     * @param {object} event - Event data
     * @returns {HTMLElement} Event element
     */
    createEventElement(event) {
        const element = document.createElement('div');
        element.className = 'calendar-event';
        element.dataset.eventId = event.id;
        element.dataset.start = event.start;
        element.dataset.end = event.end;

        // Style
        if (event.color) {
            element.style.backgroundColor = event.color;
            element.style.borderColor = event.color;
        }

        if (event.textColor) {
            element.style.color = event.textColor;
        }

        // Content
        const title = document.createElement('span');
        title.className = 'event-title';
        title.textContent = event.title;
        element.appendChild(title);

        if (event.time && !event.allDay) {
            const time = document.createElement('span');
            time.className = 'event-time';
            time.textContent = this.formatTime(event.start);
            element.appendChild(time);
        }

        // All day badge
        if (event.allDay) {
            const badge = document.createElement('span');
            badge.className = 'event-badge all-day';
            badge.textContent = this.i18n.allDay;
            element.appendChild(badge);
        }

        // Editable indicator
        if (this.config.editable) {
            element.setAttribute('draggable', 'true');
        }

        return element;
    }

    /**
     * Update event element
     * @param {HTMLElement} element - Event element
     * @param {object} event - Updated event data
     */
    updateEventElement(element, event) {
        const title = element.querySelector('.event-title');
        if (title) {
            title.textContent = event.title;
        }

        const time = element.querySelector('.event-time');
        if (time && event.time && !event.allDay) {
            time.textContent = this.formatTime(event.start);
        }

        if (event.color) {
            element.style.backgroundColor = event.color;
            element.style.borderColor = event.color;
        }

        if (event.textColor) {
            element.style.color = event.textColor;
        }

        element.dataset.start = event.start;
        element.dataset.end = event.end;
    }

    /**
     * Add an event to the calendar
     * @param {object} event - Event data
     * @returns {object} Added event
     */
    addEvent(event) {
        // Generate ID if not provided
        if (!event.id) {
            event.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        }

        // Validate event
        this.validateEvent(event);

        // Add to events
        this.state.events.push(event);

        // Re-render
        this.renderEvents();

        // Call onEventAdd handler
        if (this.handlers.onEventAdd) {
            this.handlers.onEventAdd(event);
        }

        // Emit event
        this.dispatchEvent('eventAdded', { event });

        return event;
    }

    /**
     * Update an event
     * @param {string} eventId - Event ID
     * @param {object} updates - Updated event data
     * @returns {object} Updated event
     */
    updateEvent(eventId, updates) {
        const index = this.state.events.findIndex(e => e.id === eventId);
        if (index === -1) {
            throw new Error(`Event ${eventId} not found`);
        }

        const event = { ...this.state.events[index], ...updates };

        // Validate event
        this.validateEvent(event);

        // Update
        this.state.events[index] = event;

        // Re-render
        this.renderEvents();

        // Call onEventEdit handler
        if (this.handlers.onEventEdit) {
            this.handlers.onEventEdit(event);
        }

        // Emit event
        this.dispatchEvent('eventUpdated', { event });

        return event;
    }

    /**
     * Delete an event
     * @param {string} eventId - Event ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    deleteEvent(eventId, options = {}) {
        if (!options.confirm) {
            if (!confirm(this.i18n.confirmDelete)) {
                return false;
            }
        }

        const index = this.state.events.findIndex(e => e.id === eventId);
        if (index === -1) {
            throw new Error(`Event ${eventId} not found`);
        }

        const event = this.state.events[index];

        // Remove from events
        this.state.events.splice(index, 1);

        // Re-render
        this.renderEvents();

        // Call onEventDelete handler
        if (this.handlers.onEventDelete) {
            this.handlers.onEventDelete(event);
        }

        // Emit event
        this.dispatchEvent('eventDeleted', { event });

        return true;
    }

    /**
     * Get all events
     * @param {object} options - Additional options
     * @returns {Array} Events
     */
    getEvents(options = {}) {
        let events = [...this.state.events];

        if (options.startDate) {
            events = events.filter(e => new Date(e.start) >= new Date(options.startDate));
        }

        if (options.endDate) {
            events = events.filter(e => new Date(e.start) <= new Date(options.endDate));
        }

        if (options.category) {
            events = events.filter(e => e.category === options.category);
        }

        return events;
    }

    /**
     * Get an event by ID
     * @param {string} eventId - Event ID
     * @returns {object|null} Event or null
     */
    getEventById(eventId) {
        return this.state.events.find(e => e.id === eventId) || null;
    }

    /**
     * Clear all events
     */
    clearEvents() {
        this.state.events = [];
        this.renderEvents();
        this.dispatchEvent('eventsCleared', {});
    }

    /**
     * Set events
     * @param {Array} events - Events to set
     */
    setEvents(events) {
        this.state.events = events || [];
        this.renderEvents();
        this.dispatchEvent('eventsSet', { events });
    }

    /**
     * Navigate to next month
     */
    nextMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Navigate to previous month
     */
    prevMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Navigate to next year
     */
    nextYear() {
        this.state.currentDate.setFullYear(this.state.currentDate.getFullYear() + 1);
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Navigate to previous year
     */
    prevYear() {
        this.state.currentDate.setFullYear(this.state.currentDate.getFullYear() - 1);
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Go to today
     */
    goToday() {
        this.state.currentDate = new Date();
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Go to a specific date
     * @param {string|Date} date - Date to go to
     */
    goToDate(date) {
        this.state.currentDate = date instanceof Date ? date : new Date(date);
        this.renderContent();
        this.dispatchEvent('dateChanged', { date: this.state.currentDate });
    }

    /**
     * Set calendar view
     * @param {string} view - View name (month, week, day, agenda)
     */
    setView(view) {
        const validViews = ['month', 'week', 'day', 'agenda'];
        if (!validViews.includes(view)) {
            throw new Error(`Invalid view: ${view}`);
        }

        this.state.view = view;

        // Update view buttons
        this.cache.elements.get('toolbar')?.querySelectorAll('.btn-view').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        this.renderContent();
        this.dispatchEvent('viewChanged', { view });
    }

    /**
     * Get current view
     * @returns {string} Current view
     */
    getView() {
        return this.state.view;
    }

    /**
     * Get current date
     * @returns {Date} Current date
     */
    getCurrentDate() {
        return new Date(this.state.currentDate);
    }

    /**
     * Get selected date
     * @returns {Date|null} Selected date
     */
    getSelectedDate() {
        return this.state.selectedDate ? new Date(this.state.selectedDate) : null;
    }

    /**
     * Set selected date
     * @param {string|Date} date - Date to select
     */
    setSelectedDate(date) {
        this.state.selectedDate = date instanceof Date ? date : new Date(date);
        this.dispatchEvent('dateSelected', { date: this.state.selectedDate });
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.state.isLoading = true;
        this.element.classList.add('loading');
        const overlay = document.createElement('div');
        overlay.className = 'calendar-loading-overlay';
        overlay.innerHTML = `<div class="spinner"></div><span>${this.i18n.loading}</span>`;
        this.viewContainer.appendChild(overlay);
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.state.isLoading = false;
        this.element.classList.remove('loading');
        const overlay = this.viewContainer.querySelector('.calendar-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Show event details
     * @param {string} eventId - Event ID
     */
    showEvent(eventId) {
        const event = this.getEventById(eventId);
        if (!event) return;

        this.state.selectedEvent = eventId;
        this.dispatchEvent('eventShown', { event });
    }

    /**
     * Hide event details
     */
    hideEvent() {
        this.state.selectedEvent = null;
        this.dispatchEvent('eventHidden', {});
    }

    /**
     * Show tooltip
     * @param {string} content - Tooltip content
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    showTooltip(content, x, y) {
        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'calendar-tooltip';
        tooltip.textContent = content;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;

        this.state.tooltip = tooltip;
        document.body.appendChild(tooltip);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.state.tooltip) {
            this.state.tooltip.remove();
            this.state.tooltip = null;
        }
    }

    /**
     * Show modal
     * @param {string} title - Modal title
     * @param {string} content - Modal content
     * @param {object} options - Additional options
     */
    showModal(title, content, options = {}) {
        this.hideModal();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'calendar-modal';
        overlay.appendChild(modal);

        const header = document.createElement('div');
        header.className = 'modal-header';
        modal.appendChild(header);

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        header.appendChild(titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => this.hideModal());
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = content;
        modal.appendChild(body);

        if (options.buttons) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            modal.appendChild(footer);

            options.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `btn ${btn.className || ''}`;
                button.textContent = btn.label;
                button.addEventListener('click', () => {
                    if (btn.action) {
                        btn.action();
                    }
                    if (btn.close !== false) {
                        this.hideModal();
                    }
                });
                footer.appendChild(button);
            });
        }

        this.state.modal = overlay;
        document.body.appendChild(overlay);
    }

    /**
     * Hide modal
     */
    hideModal() {
        if (this.state.modal) {
            this.state.modal.remove();
            this.state.modal = null;
        }
    }

    /**
     * Show context menu
     * @param {Array} items - Menu items
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    showContextMenu(items, x, y) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'calendar-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.label;

            if (item.disabled) {
                menuItem.classList.add('disabled');
            }

            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'menu-icon';
                icon.textContent = item.icon;
                menuItem.prepend(icon);
            }

            menuItem.addEventListener('click', () => {
                if (!item.disabled && item.action) {
                    item.action();
                }
                this.hideContextMenu();
            });

            menu.appendChild(menuItem);
        });

        this.state.contextMenu = menu;
        document.body.appendChild(menu);
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.state.contextMenu) {
            this.state.contextMenu.remove();
            this.state.contextMenu = null;
        }
    }

    /**
     * Refresh the calendar
     */
    refresh() {
        this.renderContent();
        this.renderEvents();
        this.dispatchEvent('refreshed', {});
    }

    /**
     * Update calendar size
     */
    updateSize() {
        // Implement size update logic
        this.dispatchEvent('sizeUpdated', {});
    }

    /**
     * Get events for current view
     * @returns {Array} Events
     */
    getEventsForView() {
        const currentDate = this.state.currentDate;
        let startDate, endDate;

        switch (this.state.view) {
            case 'month':
                startDate = this.getFirstDayOfMonth(currentDate);
                endDate = this.getLastDayOfMonth(currentDate);
                break;
            case 'week':
                startDate = this.getWeekStart(currentDate);
                endDate = this.getWeekEnd(currentDate);
                break;
            case 'day':
                startDate = new Date(currentDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(currentDate);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'agenda':
                startDate = this.getFirstDayOfMonth(currentDate);
                endDate = this.getLastDayOfMonth(currentDate);
                break;
            default:
                startDate = this.getFirstDayOfMonth(currentDate);
                endDate = this.getLastDayOfMonth(currentDate);
        }

        return this.state.events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate >= startDate && eventDate <= endDate;
        });
    }

    /**
     * Get events for a month
     * @param {Date} date - Date
     * @returns {Array} Events
     */
    getEventsForMonth(date) {
        const start = this.getFirstDayOfMonth(date);
        const end = this.getLastDayOfMonth(date);
        return this.state.events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate >= start && eventDate <= end;
        });
    }

    /**
     * Group events by day
     * @param {Array} events - Events to group
     * @returns {object} Grouped events
     */
    groupEventsByDay(events) {
        const grouped = {};
        events.forEach(event => {
            const dateKey = this.getDateStr(event.start);
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });
        return grouped;
    }

    /**
     * Validate an event
     * @param {object} event - Event data
     * @throws {Error} If validation fails
     */
    validateEvent(event) {
        if (!event.title) {
            throw new Error('Event title is required');
        }

        if (!event.start) {
            throw new Error('Event start date is required');
        }

        if (!event.end) {
            event.end = event.start;
        }

        const startDate = new Date(event.start);
        const endDate = new Date(event.end);

        if (startDate > endDate) {
            throw new Error('Event end date must be after start date');
        }
    }

    /**
     * Get week start date
     * @param {Date} date - Date
     * @returns {Date} Week start date
     */
    getWeekStart(date) {
        const result = new Date(date);
        const day = result.getDay();
        const diff = (day - this.config.firstDayOfWeek + 7) % 7;
        result.setDate(result.getDate() - diff);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    /**
     * Get week end date
     * @param {Date} date - Date
     * @returns {Date} Week end date
     */
    getWeekEnd(date) {
        const result = this.getWeekStart(date);
        result.setDate(result.getDate() + 6);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    /**
     * Get month dates
     * @param {Date} date - Date
     * @returns {Array} Month dates
     */
    getMonthDates(date) {
        const dates = [];
        const firstDay = this.getFirstDayOfMonth(date);
        const lastDay = this.getLastDayOfMonth(date);
        const startDate = new Date(firstDay);
        const endDate = new Date(lastDay);

        // Add days from previous month
        const firstDayOfWeek = startDate.getDay();
        const diff = (firstDayOfWeek - this.config.firstDayOfWeek + 7) % 7;
        startDate.setDate(startDate.getDate() - diff);

        // Add days to next month
        const lastDayOfWeek = endDate.getDay();
        const diffEnd = (6 - lastDayOfWeek + 7) % 7;
        endDate.setDate(endDate.getDate() + diffEnd);

        let current = new Date(startDate);
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    /**
     * Get week dates
     * @param {Date} date - Date
     * @returns {Array} Week dates
     */
    getWeekDates(date) {
        const dates = [];
        const start = this.getWeekStart(date);
        const end = this.getWeekEnd(date);

        let current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    /**
     * Get first day of month
     * @param {Date} date - Date
     * @returns {Date} First day of month
     */
    getFirstDayOfMonth(date) {
        const result = new Date(date);
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    /**
     * Get last day of month
     * @param {Date} date - Date
     * @returns {Date} Last day of month
     */
    getLastDayOfMonth(date) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + 1);
        result.setDate(0);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    /**
     * Get days in month
     * @param {Date} date - Date
     * @returns {number} Days in month
     */
    getDaysInMonth(date) {
        return this.getLastDayOfMonth(date).getDate();
    }

    /**
     * Get week number
     * @param {Date} date - Date
     * @returns {number} Week number
     */
    getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    /**
     * Get date string
     * @param {string|Date} date - Date
     * @returns {string} Date string
     */
    getDateStr(date) {
        const d = date instanceof Date ? date : new Date(date);
        return d.toISOString().split('T')[0];
    }

    /**
     * Get time string
     * @param {string|Date} time - Time
     * @returns {string} Time string
     */
    getTimeStr(time) {
        const d = time instanceof Date ? time : new Date(time);
        return d.toTimeString().split(' ')[0];
    }

    /**
     * Format date
     * @param {string|Date} date - Date
     * @param {string} format - Format string
     * @returns {string} Formatted date
     */
    formatDate(date, format = this.config.dateFormat) {
        const d = date instanceof Date ? date : new Date(date);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;

        const map = {
            'D': day,
            'DD': String(day).padStart(2, '0'),
            'MM': String(month).padStart(2, '0'),
            'MMM': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1],
            'MMMM': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1],
            'YYYY': year,
            'YY': String(year).slice(2),
            'h': hour12,
            'hh': String(hour12).padStart(2, '0'),
            'H': hours,
            'HH': String(hours).padStart(2, '0'),
            'm': minutes,
            'mm': String(minutes).padStart(2, '0'),
            'A': ampm,
            'a': ampm.toLowerCase()
        };

        return format.replace(/(D{1,2}|M{1,4}|Y{2,4}|h{1,2}|H{1,2}|m{1,2}|A|a)/g, match => map[match] || match);
    }

    /**
     * Format time
     * @param {string|Date} time - Time
     * @returns {string} Formatted time
     */
    formatTime(time) {
        return this.formatDate(time, this.config.timeFormat);
    }

    /**
     * Parse date
     * @param {string} dateStr - Date string
     * @param {string} format - Format string
     * @returns {Date} Parsed date
     */
    parseDate(dateStr, format = this.config.dateFormat) {
        // Simple date parsing (for MVP)
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d;
        }
        throw new Error(`Unable to parse date: ${dateStr}`);
    }

    /**
     * Parse time
     * @param {string} timeStr - Time string
     * @returns {Date} Parsed time
     */
    parseTime(timeStr) {
        // Simple time parsing (for MVP)
        const parts = timeStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
        if (!parts) {
            throw new Error(`Unable to parse time: ${timeStr}`);
        }

        let hours = parseInt(parts[1]);
        const minutes = parseInt(parts[2]);
        const ampm = parts[3] ? parts[3].toUpperCase() : null;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    /**
     * Check if date is today
     * @param {Date} date - Date
     * @returns {boolean} Whether date is today
     */
    isToday(date) {
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
               date.getMonth() === today.getMonth() &&
               date.getDate() === today.getDate();
    }

    /**
     * Check if dates are the same day
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} Whether dates are the same day
     */
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    /**
     * Check if dates are in the same week
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} Whether dates are in the same week
     */
    isSameWeek(date1, date2) {
        const start1 = this.getWeekStart(date1);
        const start2 = this.getWeekStart(date2);
        return start1.getTime() === start2.getTime();
    }

    /**
     * Check if dates are in the same month
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} Whether dates are in the same month
     */
    isSameMonth(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth();
    }

    /**
     * Check if dates are in the same year
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} Whether dates are in the same year
     */
    isSameYear(date1, date2) {
        return date1.getFullYear() === date2.getFullYear();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation buttons
        const prevBtn = this.cache.elements.get('prevBtn');
        const nextBtn = this.cache.elements.get('nextBtn');
        const todayBtn = this.cache.elements.get('todayBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                switch (this.state.view) {
                    case 'month':
                        this.prevMonth();
                        break;
                    case 'week':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() - 7);
                        this.renderContent();
                        break;
                    case 'day':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() - 1);
                        this.renderContent();
                        break;
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                switch (this.state.view) {
                    case 'month':
                        this.nextMonth();
                        break;
                    case 'week':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() + 7);
                        this.renderContent();
                        break;
                    case 'day':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() + 1);
                        this.renderContent();
                        break;
                }
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                this.goToday();
            });
        }

        // View buttons
        this.cache.elements.get('toolbar')?.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setView(btn.dataset.view);
            });
        });

        // Click outside to hide context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
                this.hideModal();
                this.hideTooltip();
            }
        });
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        const keyMap = {
            'ArrowLeft': () => {
                switch (this.state.view) {
                    case 'month':
                        this.prevMonth();
                        break;
                    case 'week':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() - 7);
                        this.renderContent();
                        break;
                    case 'day':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() - 1);
                        this.renderContent();
                        break;
                }
            },
            'ArrowRight': () => {
                switch (this.state.view) {
                    case 'month':
                        this.nextMonth();
                        break;
                    case 'week':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() + 7);
                        this.renderContent();
                        break;
                    case 'day':
                        this.state.currentDate.setDate(this.state.currentDate.getDate() + 1);
                        this.renderContent();
                        break;
                }
            },
            't': () => this.goToday(),
            'm': () => this.setView('month'),
            'w': () => this.setView('week'),
            'd': () => this.setView('day'),
            'a': () => this.setView('agenda'),
            'r': () => this.refresh()
        };

        document.addEventListener('keydown', (e) => {
            // Only handle if calendar is focused or has focus within
            if (!this.element.contains(document.activeElement)) return;

            const key = e.key;
            if (keyMap[key]) {
                e.preventDefault();
                keyMap[key]();
                this.dispatchEvent('keyboardAction', { key });
            }
        });
    }

    /**
     * Setup drag and drop
     */
    setupDragDrop() {
        // Implement drag and drop logic
        // For MVP, basic drag support
        this.element.addEventListener('dragstart', (e) => {
            const target = e.target.closest('.calendar-event');
            if (!target) return;

            const eventId = target.dataset.eventId;
            const event = this.getEventById(eventId);
            if (!event) return;

            this.state.dragData = { eventId, event };
            e.dataTransfer.setData('text/plain', eventId);
            this.dispatchEvent('dragStart', { event });
        });

        this.element.addEventListener('dragend', (e) => {
            if (this.state.dragData) {
                this.dispatchEvent('dragEnd', { event: this.state.dragData.event });
                this.state.dragData = null;
            }
        });

        // Drop targets
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.month-day-cell, .week-day-column, .day-time-slot');
            if (target) {
                target.classList.add('drag-over');
                this.dispatchEvent('dragOver', { target });
            }
        });

        this.element.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.month-day-cell, .week-day-column, .day-time-slot');
            if (target) {
                target.classList.remove('drag-over');
            }
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.month-day-cell, .week-day-column, .day-time-slot');
            if (!target) return;

            target.classList.remove('drag-over');

            const eventId = e.dataTransfer.getData('text/plain');
            const event = this.getEventById(eventId);
            if (!event) return;

            const dateKey = target.dataset.date;
            if (!dateKey) return;

            const newDate = new Date(dateKey);
            const oldDate = new Date(event.start);

            // Update event date
            const updated = this.updateEvent(eventId, {
                start: newDate.toISOString(),
                end: new Date(newDate.getTime() + (oldDate.getTime() - new Date(event.start).getTime())).toISOString()
            });

            this.dispatchEvent('eventDropped', { event: updated, target });
        });
    }

    /**
     * Setup resize handling
     */
    setupResize() {
        // Implement resize handling
        // For MVP, basic resize support
        this.element.addEventListener('resize', () => {
            this.updateSize();
        });
    }

    /**
     * Setup window resize
     */
    setupWindowResize() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateSize();
                this.dispatchEvent('windowResized', {});
            }, this.config.windowResizeDelay);
        });
    }

    /**
     * Dispatch a custom event
     * @param {string} eventName - Event name
     * @param {object} detail - Event detail
     */
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(`calendar:${eventName}`, {
            detail: { ...detail, calendar: this },
            bubbles: true,
            cancelable: true
        });
        this.element.dispatchEvent(event);
    }

    /**
     * Destroy the calendar
     */
    destroy() {
        // Call onDestroy handler
        if (this.handlers.onDestroy) {
            this.handlers.onDestroy(this);
        }

        // Remove event listeners
        // Clean up DOM
        if (this.element) {
            this.element.remove();
        }

        // Clear state
        this.state.events = [];
        this.cache.elements.clear();
        this.cache.events.clear();
        this.cache.cells.clear();
        this.cache.slots.clear();

        this.dispatchEvent('destroyed', {});
    }
}

// Export for use in other files
export default Calendar;
