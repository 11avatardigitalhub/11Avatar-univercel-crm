/**
 * ==========================================
 * FILE: Forms.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade form component system for 11 Avatar CRM.
 * Provides a comprehensive set of form components including
 * Input, Textarea, Select, Checkbox, Radio, Toggle, DatePicker,
 * TimePicker, FileUpload, and more.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS)
 * 
 * FEATURES:
 * - Multiple Form Components (Input, Select, Checkbox, Radio, Toggle, Date, Time, File)
 * - Built-in Validation
 * - Error States
 * - Required Field Indicators
 * - Tooltips & Help Text
 * - Prefix/Suffix Support
 * - Custom Styling
 * - Theme Support (Light/Dark)
 * - Accessibility Ready
 * - Keyboard Navigation
 * - Focus Management
 * - Form Group Support
 * - Dynamic Forms
 * - Event System
 * 
 * USAGE EXAMPLE:
 * import { FormFactory } from './components/Forms.js';
 * 
 * // Create an input field
 * const input = FormFactory.createInput({
 *   name: 'email',
 *   label: 'Email Address',
 *   placeholder: 'you@example.com',
 *   type: 'email',
 *   required: true,
 *   value: 'user@example.com'
 * });
 * 
 * // Create a select dropdown
 * const select = FormFactory.createSelect({
 *   name: 'country',
 *   label: 'Country',
 *   options: [
 *     { value: 'IN', label: 'India' },
 *     { value: 'US', label: 'United States' }
 *   ],
 *   value: 'IN'
 * });
 * 
 * // Create a form group
 * const form = FormFactory.createFormGroup({
 *   fields: [input, select],
 *   onSubmit: (data) => { ... }
 * });
 * 
 * // Render to container
 * document.getElementById('form-container').appendChild(form.render());
 * ==========================================
 */

export class FormFactory {
    /**
     * Create an Input component
     * @param {object} config - Input configuration
     * @returns {Input} Input instance
     */
    static createInput(config) {
        return new Input(config);
    }

    /**
     * Create a Textarea component
     * @param {object} config - Textarea configuration
     * @returns {Textarea} Textarea instance
     */
    static createTextarea(config) {
        return new Textarea(config);
    }

    /**
     * Create a Select component
     * @param {object} config - Select configuration
     * @returns {Select} Select instance
     */
    static createSelect(config) {
        return new Select(config);
    }

    /**
     * Create a Checkbox component
     * @param {object} config - Checkbox configuration
     * @returns {Checkbox} Checkbox instance
     */
    static createCheckbox(config) {
        return new Checkbox(config);
    }

    /**
     * Create a Radio component
     * @param {object} config - Radio configuration
     * @returns {Radio} Radio instance
     */
    static createRadio(config) {
        return new Radio(config);
    }

    /**
     * Create a Toggle component
     * @param {object} config - Toggle configuration
     * @returns {Toggle} Toggle instance
     */
    static createToggle(config) {
        return new Toggle(config);
    }

    /**
     * Create a DatePicker component
     * @param {object} config - DatePicker configuration
     * @returns {DatePicker} DatePicker instance
     */
    static createDatePicker(config) {
        return new DatePicker(config);
    }

    /**
     * Create a TimePicker component
     * @param {object} config - TimePicker configuration
     * @returns {TimePicker} TimePicker instance
     */
    static createTimePicker(config) {
        return new TimePicker(config);
    }

    /**
     * Create a FileUpload component
     * @param {object} config - FileUpload configuration
     * @returns {FileUpload} FileUpload instance
     */
    static createFileUpload(config) {
        return new FileUpload(config);
    }

    /**
     * Create a Form Group
     * @param {object} config - Form configuration
     * @returns {FormGroup} FormGroup instance
     */
    static createFormGroup(config) {
        return new FormGroup(config);
    }

    /**
     * Create a SearchInput component
     * @param {object} config - Search configuration
     * @returns {SearchInput} SearchInput instance
     */
    static createSearchInput(config) {
        return new SearchInput(config);
    }

    /**
     * Create a PhoneInput component
     * @param {object} config - Phone configuration
     * @returns {PhoneInput} PhoneInput instance
     */
    static createPhoneInput(config) {
        return new PhoneInput(config);
    }

    /**
     * Create a PasswordInput component
     * @param {object} config - Password configuration
     * @returns {PasswordInput} PasswordInput instance
     */
    static createPasswordInput(config) {
        return new PasswordInput(config);
    }

    /**
     * Create a NumberInput component
     * @param {object} config - Number configuration
     * @returns {NumberInput} NumberInput instance
     */
    static createNumberInput(config) {
        return new NumberInput(config);
    }
}

/**
 * Base Form Component
 */
class BaseFormComponent {
    constructor(config = {}) {
        this.config = {
            name: config.name || '',
            id: config.id || config.name || 'field_' + Date.now(),
            label: config.label || '',
            value: config.value || '',
            placeholder: config.placeholder || '',
            required: config.required || false,
            disabled: config.disabled || false,
            readonly: config.readonly || false,
            hidden: config.hidden || false,
            className: config.className || '',
            helpText: config.helpText || '',
            errorText: config.errorText || '',
            tooltip: config.tooltip || '',
            theme: config.theme || 'light',
            onChange: config.onChange || null,
            onBlur: config.onBlur || null,
            onFocus: config.onFocus || null,
            onError: config.onError || null,
            ...config
        };

        this.element = null;
        this.value = this.config.value;
        this.error = null;
        this.touched = false;
        this.focused = false;
        this.eventListeners = [];
        this.children = [];
        this.parent = null;

        // Bind methods
        this.bindMethods();
    }

    bindMethods() {
        this.render = this.render.bind(this);
        this.getValue = this.getValue.bind(this);
        this.setValue = this.setValue.bind(this);
        this.reset = this.reset.bind(this);
        this.validate = this.validate.bind(this);
        this.focus = this.focus.bind(this);
        this.blur = this.blur.bind(this);
        this.setError = this.setError.bind(this);
        this.clearError = this.clearError.bind(this);
        this.destroy = this.destroy.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
    }

    /**
     * Render the component
     * @returns {HTMLElement} Component element
     */
    render() {
        throw new Error('render() must be implemented by subclass');
    }

    /**
     * Get the value
     * @returns {*} Current value
     */
    getValue() {
        return this.value;
    }

    /**
     * Set the value
     * @param {*} value - New value
     */
    setValue(value) {
        this.value = value;
        this.updateValue();
        if (this.config.onChange) {
            this.config.onChange(value);
        }
        this.dispatchEvent('change', { value });
    }

    /**
     * Update the value in the DOM
     */
    updateValue() {
        // To be implemented by subclasses
    }

    /**
     * Reset the component
     */
    reset() {
        this.setValue(this.config.value || '');
        this.clearError();
        this.touched = false;
        this.focused = false;
        this.dispatchEvent('reset', {});
    }

    /**
     * Validate the component
     * @returns {boolean} Whether valid
     */
    validate() {
        if (this.config.required && !this.getValue()) {
            this.setError('This field is required');
            return false;
        }
        this.clearError();
        return true;
    }

    /**
     * Focus the component
     */
    focus() {
        if (this.element) {
            this.element.focus();
        }
    }

    /**
     * Blur the component
     */
    blur() {
        if (this.element) {
            this.element.blur();
        }
    }

    /**
     * Set error state
     * @param {string} message - Error message
     */
    setError(message) {
        this.error = message;
        if (this.element) {
            this.element.classList.add('has-error');
            const errorEl = this.element.querySelector('.field-error');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            }
        }
        if (this.config.onError) {
            this.config.onError(message);
        }
        this.dispatchEvent('error', { message });
    }

    /**
     * Clear error state
     */
    clearError() {
        this.error = null;
        if (this.element) {
            this.element.classList.remove('has-error');
            const errorEl = this.element.querySelector('.field-error');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        }
        this.dispatchEvent('clearerror', {});
    }

    /**
     * Handle change event
     * @param {Event} e - Event
     */
    handleChange(e) {
        this.value = e.target.value;
        this.touched = true;
        this.clearError();
        this.dispatchEvent('change', { value: this.value });
        if (this.config.onChange) {
            this.config.onChange(this.value);
        }
    }

    /**
     * Handle blur event
     * @param {Event} e - Event
     */
    handleBlur(e) {
        this.touched = true;
        this.focused = false;
        this.dispatchEvent('blur', {});
        if (this.config.onBlur) {
            this.config.onBlur();
        }
        // Auto-validate on blur
        if (this.config.required) {
            this.validate();
        }
    }

    /**
     * Handle focus event
     * @param {Event} e - Event
     */
    handleFocus(e) {
        this.focused = true;
        this.dispatchEvent('focus', {});
        if (this.config.onFocus) {
            this.config.onFocus();
        }
    }

    /**
     * Dispatch a custom event
     * @param {string} eventName - Event name
     * @param {object} detail - Event detail
     */
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(`form:${eventName}`, {
            detail: { ...detail, component: this },
            bubbles: true,
            cancelable: true
        });
        if (this.element) {
            this.element.dispatchEvent(event);
        }
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
     * Destroy the component
     */
    destroy() {
        this.removeEventListeners();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    /**
     * Create container
     * @param {string} className - Additional classes
     * @returns {HTMLElement} Container
     */
    createContainer(className = '') {
        const container = document.createElement('div');
        container.className = `form-field ${className}`;
        container.dataset.theme = this.config.theme;
        container.dataset.required = this.config.required;
        container.dataset.disabled = this.config.disabled;
        container.dataset.hidden = this.config.hidden;

        if (this.config.hidden) {
            container.style.display = 'none';
        }

        return container;
    }

    /**
     * Create label
     * @param {string} text - Label text
     * @param {string} forId - For attribute
     * @returns {HTMLElement} Label element
     */
    createLabel(text, forId) {
        const label = document.createElement('label');
        label.className = 'field-label';
        label.htmlFor = forId || this.config.id;

        const labelText = document.createElement('span');
        labelText.textContent = text || this.config.label;
        label.appendChild(labelText);

        if (this.config.required) {
            const required = document.createElement('span');
            required.className = 'field-required';
            required.textContent = '*';
            label.appendChild(required);
        }

        // Tooltip
        if (this.config.tooltip) {
            const tooltip = document.createElement('span');
            tooltip.className = 'field-tooltip';
            tooltip.textContent = 'ⓘ';
            tooltip.title = this.config.tooltip;
            label.appendChild(tooltip);
        }

        return label;
    }

    /**
     * Create help text
     * @param {string} text - Help text
     * @returns {HTMLElement} Help text element
     */
    createHelpText(text) {
        const help = document.createElement('div');
        help.className = 'field-help';
        help.textContent = text || this.config.helpText;
        return help;
    }

    /**
     * Create error text
     * @param {string} text - Error text
     * @returns {HTMLElement} Error text element
     */
    createErrorText(text) {
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = text || this.config.errorText;
        if (!text && !this.config.errorText) {
            error.style.display = 'none';
        }
        return error;
    }

    /**
     * Get color based on theme
     * @param {string} opacity - Opacity
     * @returns {string} Color
     */
    getTextColor(opacity = 1) {
        if (this.config.theme === 'dark') {
            return `rgba(255, 255, 255, ${opacity})`;
        }
        return `rgba(10, 10, 10, ${opacity})`;
    }

    /**
     * Get border color based on theme
     * @returns {string} Border color
     */
    getBorderColor() {
        if (this.config.theme === 'dark') {
            return 'rgba(255, 255, 255, 0.1)';
        }
        return 'rgba(0, 0, 0, 0.1)';
    }
}

/**
 * Input Component
 */
class Input extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.type = config.type || 'text';
        this.config.prefix = config.prefix || '';
        this.config.suffix = config.suffix || '';
        this.config.autocomplete = config.autocomplete || 'off';
        this.config.min = config.min || null;
        this.config.max = config.max || null;
        this.config.step = config.step || null;
        this.config.pattern = config.pattern || null;
    }

    render() {
        this.element = this.createContainer('input-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Input wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';

        // Prefix
        if (this.config.prefix) {
            const prefix = document.createElement('span');
            prefix.className = 'input-prefix';
            prefix.textContent = this.config.prefix;
            wrapper.appendChild(prefix);
        }

        // Input
        const input = document.createElement('input');
        input.id = this.config.id;
        input.name = this.config.name;
        input.type = this.config.type;
        input.value = this.value;
        input.placeholder = this.config.placeholder;
        input.required = this.config.required;
        input.disabled = this.config.disabled;
        input.readOnly = this.config.readonly;
        input.autocomplete = this.config.autocomplete;
        input.className = 'form-input';
        input.setAttribute('aria-label', this.config.label || this.config.name);

        if (this.config.min !== null) input.min = this.config.min;
        if (this.config.max !== null) input.max = this.config.max;
        if (this.config.step !== null) input.step = this.config.step;
        if (this.config.pattern) input.pattern = this.config.pattern;

        input.addEventListener('change', this.handleChange);
        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('focus', this.handleFocus);
        input.addEventListener('input', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('input', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });

        wrapper.appendChild(input);

        // Suffix
        if (this.config.suffix) {
            const suffix = document.createElement('span');
            suffix.className = 'input-suffix';
            suffix.textContent = this.config.suffix;
            wrapper.appendChild(suffix);
        }

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    updateValue() {
        const input = this.element?.querySelector('.form-input');
        if (input) {
            input.value = this.value;
        }
    }

    validate() {
        const input = this.element?.querySelector('.form-input');
        if (!input) return true;

        // Required check
        if (this.config.required && !input.value) {
            this.setError('This field is required');
            return false;
        }

        // Pattern check
        if (this.config.pattern && input.value) {
            const regex = new RegExp(this.config.pattern);
            if (!regex.test(input.value)) {
                this.setError('Invalid format');
                return false;
            }
        }

        // Min/Max for number
        if (this.config.type === 'number' && input.value) {
            const val = parseFloat(input.value);
            if (this.config.min !== null && val < this.config.min) {
                this.setError(`Value must be at least ${this.config.min}`);
                return false;
            }
            if (this.config.max !== null && val > this.config.max) {
                this.setError(`Value must be at most ${this.config.max}`);
                return false;
            }
        }

        this.clearError();
        return true;
    }
}

/**
 * Textarea Component
 */
class Textarea extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.rows = config.rows || 4;
        this.config.cols = config.cols || 50;
        this.config.maxLength = config.maxLength || null;
        this.config.autoResize = config.autoResize || false;
    }

    render() {
        this.element = this.createContainer('textarea-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.id = this.config.id;
        textarea.name = this.config.name;
        textarea.value = this.value;
        textarea.placeholder = this.config.placeholder;
        textarea.required = this.config.required;
        textarea.disabled = this.config.disabled;
        textarea.readOnly = this.config.readonly;
        textarea.rows = this.config.rows;
        textarea.cols = this.config.cols;
        textarea.className = 'form-textarea';
        textarea.setAttribute('aria-label', this.config.label || this.config.name);

        if (this.config.maxLength) {
            textarea.maxLength = this.config.maxLength;
        }

        textarea.addEventListener('change', this.handleChange);
        textarea.addEventListener('blur', this.handleBlur);
        textarea.addEventListener('focus', this.handleFocus);
        textarea.addEventListener('input', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('input', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }

            // Auto-resize
            if (this.config.autoResize) {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        });

        this.element.appendChild(textarea);

        // Character counter
        if (this.config.maxLength) {
            const counter = document.createElement('div');
            counter.className = 'field-counter';
            counter.textContent = `0 / ${this.config.maxLength}`;
            textarea.addEventListener('input', () => {
                counter.textContent = `${textarea.value.length} / ${this.config.maxLength}`;
            });
            this.element.appendChild(counter);
        }

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    updateValue() {
        const textarea = this.element?.querySelector('.form-textarea');
        if (textarea) {
            textarea.value = this.value;
        }
    }

    validate() {
        const textarea = this.element?.querySelector('.form-textarea');
        if (!textarea) return true;

        if (this.config.required && !textarea.value.trim()) {
            this.setError('This field is required');
            return false;
        }

        if (this.config.maxLength && textarea.value.length > this.config.maxLength) {
            this.setError(`Maximum ${this.config.maxLength} characters allowed`);
            return false;
        }

        this.clearError();
        return true;
    }
}

/**
 * Select Component
 */
class Select extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.options = config.options || [];
        this.config.multiple = config.multiple || false;
        this.config.placeholder = config.placeholder || 'Select an option';
        this.config.searchable = config.searchable || false;
        this.config.groupBy = config.groupBy || null;
    }

    render() {
        this.element = this.createContainer('select-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Select wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';

        // Select
        const select = document.createElement('select');
        select.id = this.config.id;
        select.name = this.config.name;
        select.required = this.config.required;
        select.disabled = this.config.disabled;
        select.multiple = this.config.multiple;
        select.className = 'form-select';
        select.setAttribute('aria-label', this.config.label || this.config.name);

        if (this.config.placeholder && !this.config.multiple) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = this.config.placeholder;
            option.disabled = true;
            if (!this.value) option.selected = true;
            select.appendChild(option);
        }

        // Options
        this.renderOptions(select, this.config.options);

        select.addEventListener('change', (e) => {
            if (this.config.multiple) {
                this.value = Array.from(e.target.selectedOptions).map(o => o.value);
            } else {
                this.value = e.target.value;
            }
            this.clearError();
            this.dispatchEvent('change', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });
        select.addEventListener('blur', this.handleBlur);
        select.addEventListener('focus', this.handleFocus);

        wrapper.appendChild(select);

        // Arrow icon
        if (!this.config.multiple) {
            const arrow = document.createElement('span');
            arrow.className = 'select-arrow';
            arrow.innerHTML = '▼';
            wrapper.appendChild(arrow);
        }

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    renderOptions(select, options, level = 0) {
        options.forEach(option => {
            if (option.options) {
                // Group
                const group = document.createElement('optgroup');
                group.label = option.label;
                this.renderOptions(group, option.options, level + 1);
                select.appendChild(group);
            } else {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.label;
                opt.disabled = option.disabled || false;
                if (this.config.multiple) {
                    if (Array.isArray(this.value) && this.value.includes(option.value)) {
                        opt.selected = true;
                    }
                } else {
                    if (this.value == option.value) {
                        opt.selected = true;
                    }
                }
                select.appendChild(opt);
            }
        });
    }

    updateValue() {
        const select = this.element?.querySelector('.form-select');
        if (!select) return;

        if (this.config.multiple) {
            Array.from(select.options).forEach(opt => {
                opt.selected = Array.isArray(this.value) && this.value.includes(opt.value);
            });
        } else {
            select.value = this.value;
        }
    }

    validate() {
        const select = this.element?.querySelector('.form-select');
        if (!select) return true;

        if (this.config.required) {
            if (this.config.multiple) {
                if (!this.value || this.value.length === 0) {
                    this.setError('Please select at least one option');
                    return false;
                }
            } else {
                if (!select.value || select.value === '') {
                    this.setError('Please select an option');
                    return false;
                }
            }
        }

        this.clearError();
        return true;
    }
}

/**
 * Checkbox Component
 */
class Checkbox extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.checked = config.checked || false;
        this.config.labelPosition = config.labelPosition || 'right';
    }

    render() {
        this.element = this.createContainer('checkbox-field');

        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-wrapper';

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.id = this.config.id;
        checkbox.name = this.config.name;
        checkbox.type = 'checkbox';
        checkbox.checked = this.config.checked;
        checkbox.required = this.config.required;
        checkbox.disabled = this.config.disabled;
        checkbox.className = 'form-checkbox';
        checkbox.setAttribute('aria-label', this.config.label || this.config.name);

        checkbox.addEventListener('change', (e) => {
            this.value = e.target.checked;
            this.config.checked = e.target.checked;
            this.clearError();
            this.dispatchEvent('change', { value: this.value, checked: e.target.checked });
            if (this.config.onChange) {
                this.config.onChange(e.target.checked);
            }
        });
        checkbox.addEventListener('blur', this.handleBlur);
        checkbox.addEventListener('focus', this.handleFocus);

        // Custom checkbox
        const custom = document.createElement('span');
        custom.className = 'checkbox-custom';

        // Label
        const label = document.createElement('label');
        label.htmlFor = this.config.id;
        label.className = 'checkbox-label';

        if (this.config.labelPosition === 'left') {
            label.appendChild(document.createTextNode(this.config.label || ''));
            label.appendChild(checkbox);
            label.appendChild(custom);
        } else {
            label.appendChild(checkbox);
            label.appendChild(custom);
            label.appendChild(document.createTextNode(this.config.label || ''));
        }

        wrapper.appendChild(label);

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    updateValue() {
        const checkbox = this.element?.querySelector('.form-checkbox');
        if (checkbox) {
            checkbox.checked = this.value;
        }
    }

    validate() {
        if (this.config.required && !this.value) {
            this.setError('This field is required');
            return false;
        }
        this.clearError();
        return true;
    }
}

/**
 * Radio Component
 */
class Radio extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.options = config.options || [];
        this.config.inline = config.inline || false;
    }

    render() {
        this.element = this.createContainer('radio-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        const wrapper = document.createElement('div');
        wrapper.className = `radio-group ${this.config.inline ? 'radio-inline' : ''}`;

        this.config.options.forEach(option => {
            const radioWrapper = document.createElement('div');
            radioWrapper.className = 'radio-option';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = this.config.name;
            radio.value = option.value;
            radio.checked = this.value === option.value;
            radio.disabled = this.config.disabled || option.disabled || false;
            radio.className = 'form-radio';
            radio.setAttribute('aria-label', option.label);

            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.value = option.value;
                    this.clearError();
                    this.dispatchEvent('change', { value: this.value });
                    if (this.config.onChange) {
                        this.config.onChange(this.value);
                    }
                }
            });

            const custom = document.createElement('span');
            custom.className = 'radio-custom';

            const label = document.createElement('label');
            label.className = 'radio-label';
            label.appendChild(radio);
            label.appendChild(custom);
            label.appendChild(document.createTextNode(option.label));

            radioWrapper.appendChild(label);
            wrapper.appendChild(radioWrapper);
        });

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    updateValue() {
        const radios = this.element?.querySelectorAll('.form-radio');
        if (radios) {
            radios.forEach(radio => {
                radio.checked = radio.value === this.value;
            });
        }
    }

    validate() {
        if (this.config.required && !this.value) {
            this.setError('Please select an option');
            return false;
        }
        this.clearError();
        return true;
    }
}

/**
 * Toggle Component
 */
class Toggle extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.checked = config.checked || false;
        this.config.labelOn = config.labelOn || 'On';
        this.config.labelOff = config.labelOff || 'Off';
        this.config.size = config.size || 'md'; // sm, md, lg
    }

    render() {
        this.element = this.createContainer('toggle-field');

        const wrapper = document.createElement('div');
        wrapper.className = 'toggle-wrapper';

        // Toggle
        const toggle = document.createElement('div');
        toggle.className = `toggle ${this.config.checked ? 'active' : ''} toggle-${this.config.size}`;
        toggle.role = 'switch';
        toggle.setAttribute('aria-checked', this.config.checked);
        toggle.setAttribute('aria-label', this.config.label || this.config.name);
        toggle.tabIndex = 0;

        const knob = document.createElement('span');
        knob.className = 'toggle-knob';
        toggle.appendChild(knob);

        toggle.addEventListener('click', () => {
            this.toggle();
        });

        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        wrapper.appendChild(toggle);

        // Label
        if (this.config.label) {
            const label = document.createElement('span');
            label.className = 'toggle-label';
            label.textContent = this.config.label;
            wrapper.appendChild(label);
        }

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    toggle() {
        this.value = !this.value;
        this.config.checked = this.value;
        const toggle = this.element?.querySelector('.toggle');
        if (toggle) {
            toggle.classList.toggle('active');
            toggle.setAttribute('aria-checked', this.value);
        }
        this.clearError();
        this.dispatchEvent('change', { value: this.value, checked: this.value });
        if (this.config.onChange) {
            this.config.onChange(this.value);
        }
    }

    updateValue() {
        const toggle = this.element?.querySelector('.toggle');
        if (toggle) {
            toggle.classList.toggle('active', this.value);
            toggle.setAttribute('aria-checked', this.value);
        }
    }

    validate() {
        if (this.config.required && !this.value) {
            this.setError('This field is required');
            return false;
        }
        this.clearError();
        return true;
    }
}

/**
 * DatePicker Component
 */
class DatePicker extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.format = config.format || 'YYYY-MM-DD';
        this.config.minDate = config.minDate || null;
        this.config.maxDate = config.maxDate || null;
        this.config.showTime = config.showTime || false;
        this.config.calendar = null;
    }

    render() {
        this.element = this.createContainer('datepicker-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Input wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper datepicker-wrapper';

        // Input
        const input = document.createElement('input');
        input.id = this.config.id;
        input.name = this.config.name;
        input.type = 'text';
        input.value = this.formatDate(this.value);
        input.placeholder = this.config.placeholder || this.config.format;
        input.required = this.config.required;
        input.disabled = this.config.disabled;
        input.readOnly = true;
        input.className = 'form-input';
        input.setAttribute('aria-label', this.config.label || this.config.name);

        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('focus', this.handleFocus);
        input.addEventListener('click', () => {
            this.toggleCalendar();
        });

        wrapper.appendChild(input);

        // Calendar icon
        const icon = document.createElement('span');
        icon.className = 'input-suffix datepicker-icon';
        icon.textContent = '📅';
        icon.addEventListener('click', () => {
            this.toggleCalendar();
        });
        wrapper.appendChild(icon);

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    toggleCalendar() {
        if (this.calendar) {
            this.hideCalendar();
        } else {
            this.showCalendar();
        }
    }

    showCalendar() {
        if (this.calendar) return;

        this.calendar = document.createElement('div');
        this.calendar.className = 'datepicker-calendar';
        this.calendar.style.position = 'absolute';
        this.calendar.style.zIndex = '1000';
        this.calendar.style.background = this.config.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        this.calendar.style.border = `1px solid ${this.getBorderColor()}`;
        this.calendar.style.borderRadius = '8px';
        this.calendar.style.padding = '12px';
        this.calendar.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
        this.calendar.style.width = '280px';

        // Build calendar
        const currentDate = this.value ? new Date(this.value) : new Date();
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();

        this.renderCalendar(month, year);

        const rect = this.element.getBoundingClientRect();
        this.calendar.style.top = `${rect.bottom + 4}px`;
        this.calendar.style.left = `${rect.left}px`;

        document.body.appendChild(this.calendar);

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 10);
    }

    renderCalendar(month, year) {
        if (!this.calendar) return;

        const currentDate = this.value ? new Date(this.value) : new Date();

        // Header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '12px';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '‹';
        prevBtn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;';
        prevBtn.addEventListener('click', () => {
            this.renderCalendar(month - 1, year);
        });

        const title = document.createElement('span');
        title.style.fontWeight = '600';
        title.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '›';
        nextBtn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;';
        nextBtn.addEventListener('click', () => {
            this.renderCalendar(month + 1, year);
        });

        header.appendChild(prevBtn);
        header.appendChild(title);
        header.appendChild(nextBtn);
        this.calendar.appendChild(header);

        // Weekdays
        const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const weekdayRow = document.createElement('div');
        weekdayRow.style.display = 'grid';
        weekdayRow.style.gridTemplateColumns = 'repeat(7, 1fr)';
        weekdayRow.style.gap = '4px';
        weekdayRow.style.marginBottom = '4px';

        weekdays.forEach(day => {
            const cell = document.createElement('div');
            cell.style.textAlign = 'center';
            cell.style.fontSize = '11px';
            cell.style.color = this.getTextColor(0.4);
            cell.style.fontWeight = '500';
            cell.textContent = day;
            weekdayRow.appendChild(cell);
        });

        this.calendar.appendChild(weekdayRow);

        // Days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        const daysGrid = document.createElement('div');
        daysGrid.style.display = 'grid';
        daysGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        daysGrid.style.gap = '4px';

        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            daysGrid.appendChild(cell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.style.textAlign = 'center';
            cell.style.padding = '6px 0';
            cell.style.borderRadius = '4px';
            cell.style.cursor = 'pointer';
            cell.style.fontSize = '13px';
            cell.textContent = day;

            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const isSelected = this.value && year === currentDate.getFullYear() && month === currentDate.getMonth() && day === currentDate.getDate();

            if (isToday) {
                cell.style.fontWeight = '600';
                cell.style.color = this.config.theme === 'dark' ? '#D4AF37' : '#D4AF37';
            }

            if (isSelected) {
                cell.style.background = '#D4AF37';
                cell.style.color = '#0A0A0A';
            }

            cell.addEventListener('click', () => {
                const selectedDate = new Date(year, month, day);
                this.value = selectedDate.toISOString();
                this.updateValue();
                this.hideCalendar();
                this.clearError();
                this.dispatchEvent('change', { value: this.value });
                if (this.config.onChange) {
                    this.config.onChange(this.value);
                }
            });

            daysGrid.appendChild(cell);
        }

        this.calendar.appendChild(daysGrid);
    }

    hideCalendar() {
        if (this.calendar) {
            this.calendar.remove();
            this.calendar = null;
            document.removeEventListener('click', this.handleOutsideClick);
        }
    }

    handleOutsideClick = (e) => {
        if (this.calendar && !this.calendar.contains(e.target) && !this.element.contains(e.target)) {
            this.hideCalendar();
        }
    }

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    updateValue() {
        const input = this.element?.querySelector('.form-input');
        if (input) {
            input.value = this.formatDate(this.value);
        }
    }

    validate() {
        if (this.config.required && !this.value) {
            this.setError('Please select a date');
            return false;
        }
        this.clearError();
        return true;
    }

    destroy() {
        this.hideCalendar();
        super.destroy();
    }
}

/**
 * TimePicker Component
 */
class TimePicker extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.format = config.format || 'HH:mm';
        this.config.step = config.step || 30;
        this.config.minTime = config.minTime || '00:00';
        this.config.maxTime = config.maxTime || '23:59';
    }

    render() {
        this.element = this.createContainer('timepicker-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Input wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper timepicker-wrapper';

        // Input
        const input = document.createElement('input');
        input.id = this.config.id;
        input.name = this.config.name;
        input.type = 'time';
        input.value = this.value;
        input.placeholder = this.config.placeholder || this.config.format;
        input.required = this.config.required;
        input.disabled = this.config.disabled;
        input.className = 'form-input';
        input.setAttribute('aria-label', this.config.label || this.config.name);
        input.step = this.config.step;

        if (this.config.minTime) input.min = this.config.minTime;
        if (this.config.maxTime) input.max = this.config.maxTime;

        input.addEventListener('change', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('change', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });
        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('focus', this.handleFocus);

        wrapper.appendChild(input);
        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    updateValue() {
        const input = this.element?.querySelector('.form-input');
        if (input) {
            input.value = this.value;
        }
    }

    validate() {
        if (this.config.required && !this.value) {
            this.setError('Please select a time');
            return false;
        }
        this.clearError();
        return true;
    }
}

/**
 * FileUpload Component
 */
class FileUpload extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.accept = config.accept || '*';
        this.config.multiple = config.multiple || false;
        this.config.maxSize = config.maxSize || 5 * 1024 * 1024; // 5MB
        this.config.maxFiles = config.maxFiles || 10;
        this.config.allowedExtensions = config.allowedExtensions || [];
        this.files = [];
    }

    render() {
        this.element = this.createContainer('fileupload-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Drop zone
        const dropZone = document.createElement('div');
        dropZone.className = 'file-drop-zone';
        dropZone.innerHTML = `
            <div class="file-drop-content">
                <span class="file-icon">📁</span>
                <p>Drag & drop files here or click to upload</p>
                <span class="file-hint">${this.getAllowedFormats()}</span>
            </div>
        `;

        // Hidden input
        const input = document.createElement('input');
        input.type = 'file';
        input.id = this.config.id;
        input.name = this.config.name;
        input.accept = this.config.accept;
        input.multiple = this.config.multiple;
        input.className = 'file-input';
        input.style.display = 'none';
        input.setAttribute('aria-label', this.config.label || this.config.name);

        input.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        dropZone.addEventListener('click', () => {
            input.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        this.element.appendChild(dropZone);
        this.element.appendChild(input);

        // File list
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        this.element.appendChild(fileList);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    handleFiles(files) {
        const validFiles = [];
        const errors = [];

        Array.from(files).forEach(file => {
            // Check size
            if (file.size > this.config.maxSize) {
                errors.push(`${file.name} exceeds ${this.config.maxSize / 1024 / 1024}MB`);
                return;
            }

            // Check extension
            if (this.config.allowedExtensions.length > 0) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (!this.config.allowedExtensions.includes(ext)) {
                    errors.push(`${file.name} has unsupported extension`);
                    return;
                }
            }

            validFiles.push(file);
        });

        if (errors.length > 0) {
            this.setError(errors.join(', '));
            return;
        }

        if (this.config.multiple) {
            this.files = [...this.files, ...validFiles];
        } else {
            this.files = validFiles.slice(0, 1);
        }

        this.value = this.files;
        this.updateFileList();
        this.clearError();
        this.dispatchEvent('change', { files: this.files });
        if (this.config.onChange) {
            this.config.onChange(this.files);
        }
    }

    updateFileList() {
        const fileList = this.element?.querySelector('.file-list');
        if (!fileList) return;

        fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';

            const info = document.createElement('span');
            info.className = 'file-info';
            const size = (file.size / 1024).toFixed(1);
            info.textContent = `${file.name} (${size} KB)`;

            const remove = document.createElement('button');
            remove.className = 'file-remove';
            remove.textContent = '×';
            remove.type = 'button';
            remove.addEventListener('click', () => {
                this.files.splice(index, 1);
                this.value = this.files;
                this.updateFileList();
                this.dispatchEvent('change', { files: this.files });
                if (this.config.onChange) {
                    this.config.onChange(this.files);
                }
            });

            item.appendChild(info);
            item.appendChild(remove);
            fileList.appendChild(item);
        });
    }

    getAllowedFormats() {
        if (this.config.allowedExtensions.length > 0) {
            return `Allowed: ${this.config.allowedExtensions.join(', ')}`;
        }
        if (this.config.accept !== '*') {
            return `Allowed: ${this.config.accept}`;
        }
        return 'All file types supported';
    }

    getValue() {
        return this.files;
    }

    setValue(value) {
        this.files = value || [];
        this.value = this.files;
        this.updateFileList();
    }

    reset() {
        this.files = [];
        this.value = [];
        this.updateFileList();
        this.clearError();
        const input = this.element?.querySelector('.file-input');
        if (input) {
            input.value = '';
        }
        this.dispatchEvent('reset', {});
    }

    validate() {
        if (this.config.required && this.files.length === 0) {
            this.setError('Please upload a file');
            return false;
        }
        if (this.config.maxFiles && this.files.length > this.config.maxFiles) {
            this.setError(`Maximum ${this.config.maxFiles} files allowed`);
            return false;
        }
        this.clearError();
        return true;
    }
}

/**
 * SearchInput Component
 */
class SearchInput extends Input {
    constructor(config) {
        super({
            ...config,
            type: 'search',
            className: 'search-input'
        });
        this.config.onSearch = config.onSearch || null;
        this.config.onClear = config.onClear || null;
        this.config.debounce = config.debounce || 300;
        this.config.suggestions = config.suggestions || [];
        this.debounceTimer = null;
        this.suggestionsContainer = null;
    }

    render() {
        super.render();

        // Add search icon
        const wrapper = this.element.querySelector('.input-wrapper');
        if (wrapper) {
            const searchIcon = document.createElement('span');
            searchIcon.className = 'input-prefix';
            searchIcon.textContent = '🔍';
            wrapper.prepend(searchIcon);

            // Clear button
            const clearBtn = document.createElement('button');
            clearBtn.className = 'input-suffix search-clear';
            clearBtn.textContent = '✕';
            clearBtn.style.display = 'none';
            clearBtn.type = 'button';
            clearBtn.addEventListener('click', () => {
                this.setValue('');
                clearBtn.style.display = 'none';
                if (this.config.onClear) {
                    this.config.onClear();
                }
            });
            wrapper.appendChild(clearBtn);

            // Input listener for search
            const input = wrapper.querySelector('.form-input');
            if (input) {
                input.addEventListener('input', (e) => {
                    const value = e.target.value;
                    clearBtn.style.display = value ? 'block' : 'none';
                    this.debounceSearch(value);
                });
            }
        }

        // Suggestions container
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'search-suggestions';
        this.suggestionsContainer.style.display = 'none';
        this.element.appendChild(this.suggestionsContainer);

        return this.element;
    }

    debounceSearch(value) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.performSearch(value);
        }, this.config.debounce);
    }

    performSearch(value) {
        if (this.config.onSearch) {
            this.config.onSearch(value);
        }

        // Show suggestions
        if (value && this.config.suggestions.length > 0) {
            const filtered = this.config.suggestions.filter(s => 
                s.toLowerCase().includes(value.toLowerCase())
            );
            this.showSuggestions(filtered);
        } else {
            this.hideSuggestions();
        }
    }

    showSuggestions(suggestions) {
        if (!this.suggestionsContainer) return;

        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.style.display = 'block';

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                this.setValue(suggestion);
                this.hideSuggestions();
                if (this.config.onSearch) {
                    this.config.onSearch(suggestion);
                }
            });
            this.suggestionsContainer.appendChild(item);
        });
    }

    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
            this.suggestionsContainer.innerHTML = '';
        }
    }

    destroy() {
        this.hideSuggestions();
        super.destroy();
    }
}

/**
 * PhoneInput Component
 */
class PhoneInput extends Input {
    constructor(config) {
        super({
            ...config,
            type: 'tel',
            className: 'phone-input'
        });
        this.config.countryCode = config.countryCode || '+91';
        this.config.defaultCountry = config.defaultCountry || 'IN';
        this.config.countryCodes = config.countryCodes || [
            { code: '+91', country: 'IN', label: 'India' },
            { code: '+1', country: 'US', label: 'USA' },
            { code: '+44', country: 'GB', label: 'UK' },
            { code: '+61', country: 'AU', label: 'Australia' },
            { code: '+81', country: 'JP', label: 'Japan' },
            { code: '+86', country: 'CN', label: 'China' }
        ];
    }

    render() {
        this.element = this.createContainer('phone-input-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Input wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper phone-wrapper';

        // Country code select
        const select = document.createElement('select');
        select.className = 'phone-country-select';
        select.setAttribute('aria-label', 'Country code');

        this.config.countryCodes.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = `${country.label} (${country.code})`;
            if (country.code === this.config.countryCode) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            this.config.countryCode = e.target.value;
            this.dispatchEvent('countrychange', { countryCode: this.config.countryCode });
        });

        wrapper.appendChild(select);

        // Input
        const input = document.createElement('input');
        input.id = this.config.id;
        input.name = this.config.name;
        input.type = 'tel';
        input.value = this.value;
        input.placeholder = this.config.placeholder || '98765 43210';
        input.required = this.config.required;
        input.disabled = this.config.disabled;
        input.className = 'form-input phone-input';
        input.setAttribute('aria-label', this.config.label || this.config.name);

        input.addEventListener('change', this.handleChange);
        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('focus', this.handleFocus);
        input.addEventListener('input', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('input', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });

        wrapper.appendChild(input);
        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.value = value;
        this.updateValue();
        if (this.config.onChange) {
            this.config.onChange(this.value);
        }
        this.dispatchEvent('change', { value: this.value });
    }

    updateValue() {
        const input = this.element?.querySelector('.phone-input');
        if (input) {
            input.value = this.value;
        }
    }

    getFullNumber() {
        return this.config.countryCode + this.value;
    }
}

/**
 * PasswordInput Component
 */
class PasswordInput extends Input {
    constructor(config) {
        super({
            ...config,
            type: 'password',
            className: 'password-input'
        });
        this.config.showStrength = config.showStrength || true;
        this.config.showToggle = config.showToggle !== undefined ? config.showToggle : true;
    }

    render() {
        super.render();

        // Add toggle button
        if (this.config.showToggle) {
            const wrapper = this.element.querySelector('.input-wrapper');
            if (wrapper) {
                const toggle = document.createElement('button');
                toggle.className = 'input-suffix password-toggle';
                toggle.textContent = '👁';
                toggle.type = 'button';
                toggle.setAttribute('aria-label', 'Toggle password visibility');
                toggle.addEventListener('click', () => {
                    const input = wrapper.querySelector('.form-input');
                    if (input) {
                        if (input.type === 'password') {
                            input.type = 'text';
                            toggle.textContent = '🙈';
                        } else {
                            input.type = 'password';
                            toggle.textContent = '👁';
                        }
                    }
                });
                wrapper.appendChild(toggle);
            }
        }

        // Add strength indicator
        if (this.config.showStrength) {
            const strengthContainer = document.createElement('div');
            strengthContainer.className = 'password-strength';

            const bar = document.createElement('div');
            bar.className = 'password-strength-bar';
            strengthContainer.appendChild(bar);

            const label = document.createElement('span');
            label.className = 'password-strength-label';
            label.textContent = 'Weak';
            strengthContainer.appendChild(label);

            this.element.appendChild(strengthContainer);

            // Listen to input for strength check
            const input = this.element.querySelector('.form-input');
            if (input) {
                input.addEventListener('input', () => {
                    this.checkStrength(input.value, bar, label);
                });
            }
        }

        return this.element;
    }

    checkStrength(password, bar, label) {
        let score = 0;
        let text = 'Weak';
        let color = '#EF4444';

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score >= 5) {
            text = 'Strong';
            color = '#10B981';
        } else if (score >= 3) {
            text = 'Medium';
            color = '#F59E0B';
        } else if (score >= 1) {
            text = 'Weak';
            color = '#EF4444';
        }

        const width = (score / 6) * 100;
        bar.style.width = `${Math.min(width, 100)}%`;
        bar.style.background = color;
        label.textContent = text;
        label.style.color = color;
    }
}

/**
 * NumberInput Component
 */
class NumberInput extends Input {
    constructor(config) {
        super({
            ...config,
            type: 'number',
            className: 'number-input'
        });
        this.config.min = config.min || null;
        this.config.max = config.max || null;
        this.config.step = config.step || 1;
        this.config.format = config.format || false;
        this.config.prefix = config.prefix || '';
        this.config.suffix = config.suffix || '';
        this.config.thousandsSeparator = config.thousandsSeparator || ',';
        this.config.decimalPlaces = config.decimalPlaces || 0;
    }

    render() {
        this.element = this.createContainer('number-input-field');

        // Label
        if (this.config.label) {
            const label = this.createLabel(this.config.label);
            this.element.appendChild(label);
        }

        // Input wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper number-wrapper';

        // Stepper buttons
        const decrement = document.createElement('button');
        decrement.className = 'number-stepper decrement';
        decrement.textContent = '−';
        decrement.type = 'button';
        decrement.addEventListener('click', () => {
            const input = wrapper.querySelector('.form-input');
            if (input) {
                const current = parseFloat(input.value) || 0;
                const newVal = current - this.config.step;
                if (this.config.min === null || newVal >= this.config.min) {
                    input.value = this.formatNumber(newVal);
                    this.value = input.value;
                    this.dispatchEvent('change', { value: this.value });
                    if (this.config.onChange) {
                        this.config.onChange(this.value);
                    }
                }
            }
        });

        const increment = document.createElement('button');
        increment.className = 'number-stepper increment';
        increment.textContent = '+';
        increment.type = 'button';
        increment.addEventListener('click', () => {
            const input = wrapper.querySelector('.form-input');
            if (input) {
                const current = parseFloat(input.value) || 0;
                const newVal = current + this.config.step;
                if (this.config.max === null || newVal <= this.config.max) {
                    input.value = this.formatNumber(newVal);
                    this.value = input.value;
                    this.dispatchEvent('change', { value: this.value });
                    if (this.config.onChange) {
                        this.config.onChange(this.value);
                    }
                }
            }
        });

        wrapper.appendChild(decrement);

        // Input
        const input = document.createElement('input');
        input.id = this.config.id;
        input.name = this.config.name;
        input.type = 'number';
        input.value = this.value;
        input.placeholder = this.config.placeholder || '0';
        input.required = this.config.required;
        input.disabled = this.config.disabled;
        input.readOnly = this.config.readonly;
        input.min = this.config.min;
        input.max = this.config.max;
        input.step = this.config.step;
        input.className = 'form-input number-input';
        input.setAttribute('aria-label', this.config.label || this.config.name);

        input.addEventListener('change', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('change', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });
        input.addEventListener('blur', this.handleBlur);
        input.addEventListener('focus', this.handleFocus);
        input.addEventListener('input', (e) => {
            this.value = e.target.value;
            this.clearError();
            this.dispatchEvent('input', { value: this.value });
            if (this.config.onChange) {
                this.config.onChange(this.value);
            }
        });

        wrapper.appendChild(input);
        wrapper.appendChild(increment);

        this.element.appendChild(wrapper);

        // Help text
        if (this.config.helpText) {
            const help = this.createHelpText();
            this.element.appendChild(help);
        }

        // Error text
        const error = this.createErrorText();
        this.element.appendChild(error);

        return this.element;
    }

    formatNumber(value) {
        if (!this.config.format) return value;
        
        const num = parseFloat(value);
        if (isNaN(num)) return value;

        const formatted = num.toFixed(this.config.decimalPlaces);
        if (this.config.thousandsSeparator) {
            const parts = formatted.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.config.thousandsSeparator);
            return parts.join('.');
        }
        return formatted;
    }

    updateValue() {
        const input = this.element?.querySelector('.form-input');
        if (input) {
            input.value = this.value;
        }
    }

    validate() {
        const input = this.element?.querySelector('.form-input');
        if (!input) return true;

        if (this.config.required && input.value === '') {
            this.setError('This field is required');
            return false;
        }

        if (input.value !== '') {
            const val = parseFloat(input.value);
            if (isNaN(val)) {
                this.setError('Please enter a valid number');
                return false;
            }
            if (this.config.min !== null && val < this.config.min) {
                this.setError(`Value must be at least ${this.config.min}`);
                return false;
            }
            if (this.config.max !== null && val > this.config.max) {
                this.setError(`Value must be at most ${this.config.max}`);
                return false;
            }
        }

        this.clearError();
        return true;
    }
}

/**
 * Form Group Component
 */
class FormGroup extends BaseFormComponent {
    constructor(config) {
        super(config);
        this.config.fields = config.fields || [];
        this.config.layout = config.layout || 'vertical'; // vertical, horizontal, inline
        this.config.columns = config.columns || 1;
        this.config.submitLabel = config.submitLabel || 'Submit';
        this.config.cancelLabel = config.cancelLabel || 'Cancel';
        this.config.onSubmit = config.onSubmit || null;
        this.config.onCancel = config.onCancel || null;
        this.fields = [];
    }

    render() {
        this.element = this.createContainer(`form-group layout-${this.config.layout} columns-${this.config.columns}`);

        // Form
        const form = document.createElement('form');
        form.className = 'form';
        form.setAttribute('novalidate', '');

        // Fields
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'form-fields';

        this.config.fields.forEach((fieldConfig, index) => {
            let field;
            if (fieldConfig.type === 'input' || fieldConfig.type === 'text') {
                field = FormFactory.createInput(fieldConfig);
            } else if (fieldConfig.type === 'textarea') {
                field = FormFactory.createTextarea(fieldConfig);
            } else if (fieldConfig.type === 'select') {
                field = FormFactory.createSelect(fieldConfig);
            } else if (fieldConfig.type === 'checkbox') {
                field = FormFactory.createCheckbox(fieldConfig);
            } else if (fieldConfig.type === 'radio') {
                field = FormFactory.createRadio(fieldConfig);
            } else if (fieldConfig.type === 'toggle') {
                field = FormFactory.createToggle(fieldConfig);
            } else if (fieldConfig.type === 'date') {
                field = FormFactory.createDatePicker(fieldConfig);
            } else if (fieldConfig.type === 'time') {
                field = FormFactory.createTimePicker(fieldConfig);
            } else if (fieldConfig.type === 'file') {
                field = FormFactory.createFileUpload(fieldConfig);
            } else if (fieldConfig.type === 'search') {
                field = FormFactory.createSearchInput(fieldConfig);
            } else if (fieldConfig.type === 'phone') {
                field = FormFactory.createPhoneInput(fieldConfig);
            } else if (fieldConfig.type === 'password') {
                field = FormFactory.createPasswordInput(fieldConfig);
            } else if (fieldConfig.type === 'number') {
                field = FormFactory.createNumberInput(fieldConfig);
            } else {
                field = FormFactory.createInput(fieldConfig);
            }

            this.fields.push(field);
            fieldsContainer.appendChild(field.render());

            // Field spacing
            if (index < this.config.fields.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'field-separator';
                fieldsContainer.appendChild(separator);
            }
        });

        form.appendChild(fieldsContainer);

        // Form actions
        const actions = document.createElement('div');
        actions.className = 'form-actions';

        if (this.config.onCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = this.config.cancelLabel;
            cancelBtn.addEventListener('click', () => {
                if (this.config.onCancel) {
                    this.config.onCancel();
                }
            });
            actions.appendChild(cancelBtn);
        }

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = this.config.submitLabel;
        actions.appendChild(submitBtn);

        form.appendChild(actions);

        // Form submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });

        this.element.appendChild(form);

        return this.element;
    }

    submit() {
        // Validate all fields
        let valid = true;
        const data = {};

        this.fields.forEach(field => {
            const fieldValid = field.validate();
            if (!fieldValid) valid = false;
            data[field.config.name] = field.getValue();
        });

        if (!valid) {
            this.dispatchEvent('invalid', { data });
            return;
        }

        this.dispatchEvent('submit', { data });
        if (this.config.onSubmit) {
            this.config.onSubmit(data);
        }
    }

    getValue() {
        const data = {};
        this.fields.forEach(field => {
            data[field.config.name] = field.getValue();
        });
        return data;
    }

    setValue(data) {
        this.fields.forEach(field => {
            if (data[field.config.name] !== undefined) {
                field.setValue(data[field.config.name]);
            }
        });
    }

    reset() {
        this.fields.forEach(field => {
            field.reset();
        });
    }

    validate() {
        let valid = true;
        this.fields.forEach(field => {
            if (!field.validate()) valid = false;
        });
        return valid;
    }

    destroy() {
        this.fields.forEach(field => {
            field.destroy();
        });
        super.destroy();
    }
}

// Export all components
export {
    BaseFormComponent,
    Input,
    Textarea,
    Select,
    Checkbox,
    Radio,
    Toggle,
    DatePicker,
    TimePicker,
    FileUpload,
    SearchInput,
    PhoneInput,
    PasswordInput,
    NumberInput,
    FormGroup
};
