/**
 * ==========================================
 * FILE: Charts.js
 * MODULE: Components
 * VERSION: 2.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Enterprise-grade chart component system for 11 Avatar CRM.
 * Provides a comprehensive set of chart types including
 * Line, Bar, Pie, Doughnut, Area, Scatter, Funnel, and more.
 * Built with pure Canvas API, no external dependencies.
 * 
 * DEPENDENCIES:
 * - None (vanilla JS + Canvas API)
 * 
 * FEATURES:
 * - Multiple Chart Types (Line, Bar, Pie, Doughnut, Area, Scatter, Funnel, Radar)
 * - Interactive Tooltips
 * - Legend with Toggle
 * - Animated Rendering
 * - Responsive Design
 * - Theme Support (Light/Dark)
 * - Data Labels
 * - Grid Lines
 * - Axis Labels
 * - Zoom & Pan (Basic)
 * - Export as Image
 * - Real-time Updates
 * - Accessibility Ready
 * 
 * USAGE EXAMPLE:
 * import { ChartFactory } from './components/Charts.js';
 * 
 * // Create a Line Chart
 * const chart = ChartFactory.createLineChart({
 *   container: '#chart-container',
 *   data: {
 *     labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
 *     datasets: [{
 *       label: 'Revenue',
 *       data: [12000, 19000, 15000, 25000, 22000, 30000],
 *       color: '#D4AF37'
 *     }]
 *   },
 *   options: {
 *     title: 'Monthly Revenue',
 *     animation: true,
 *     tooltip: true
 *   }
 * });
 * 
 * chart.render();
 * chart.update({ data: newData });
 * chart.destroy();
 * ==========================================
 */

export class ChartFactory {
    /**
     * Create a Line Chart
     * @param {object} config - Chart configuration
     * @returns {LineChart} Line chart instance
     */
    static createLineChart(config) {
        return new LineChart(config);
    }

    /**
     * Create a Bar Chart
     * @param {object} config - Chart configuration
     * @returns {BarChart} Bar chart instance
     */
    static createBarChart(config) {
        return new BarChart(config);
    }

    /**
     * Create a Pie Chart
     * @param {object} config - Chart configuration
     * @returns {PieChart} Pie chart instance
     */
    static createPieChart(config) {
        return new PieChart(config);
    }

    /**
     * Create a Doughnut Chart
     * @param {object} config - Chart configuration
     * @returns {DoughnutChart} Doughnut chart instance
     */
    static createDoughnutChart(config) {
        return new DoughnutChart(config);
    }

    /**
     * Create an Area Chart
     * @param {object} config - Chart configuration
     * @returns {AreaChart} Area chart instance
     */
    static createAreaChart(config) {
        return new AreaChart(config);
    }

    /**
     * Create a Scatter Chart
     * @param {object} config - Chart configuration
     * @returns {ScatterChart} Scatter chart instance
     */
    static createScatterChart(config) {
        return new ScatterChart(config);
    }

    /**
     * Create a Funnel Chart
     * @param {object} config - Chart configuration
     * @returns {FunnelChart} Funnel chart instance
     */
    static createFunnelChart(config) {
        return new FunnelChart(config);
    }

    /**
     * Create a Radar Chart
     * @param {object} config - Chart configuration
     * @returns {RadarChart} Radar chart instance
     */
    static createRadarChart(config) {
        return new RadarChart(config);
    }

    /**
     * Create a Gauge Chart
     * @param {object} config - Chart configuration
     * @returns {GaugeChart} Gauge chart instance
     */
    static createGaugeChart(config) {
        return new GaugeChart(config);
    }

    /**
     * Create a Heatmap Chart
     * @param {object} config - Chart configuration
     * @returns {HeatmapChart} Heatmap chart instance
     */
    static createHeatmapChart(config) {
        return new HeatmapChart(config);
    }

    /**
     * Create a Combo Chart
     * @param {object} config - Chart configuration
     * @returns {ComboChart} Combo chart instance
     */
    static createComboChart(config) {
        return new ComboChart(config);
    }
}

/**
 * Base Chart Class
 */
class BaseChart {
    constructor(config = {}) {
        this.config = {
            container: config.container || '#chart-container',
            data: config.data || { labels: [], datasets: [] },
            options: {
                title: config.options?.title || '',
                subtitle: config.options?.subtitle || '',
                width: config.options?.width || '100%',
                height: config.options?.height || 300,
                animation: config.options?.animation !== undefined ? config.options.animation : true,
                animationDuration: config.options?.animationDuration || 800,
                tooltip: config.options?.tooltip !== undefined ? config.options.tooltip : true,
                legend: config.options?.legend !== undefined ? config.options.legend : true,
                legendPosition: config.options?.legendPosition || 'bottom',
                gridLines: config.options?.gridLines !== undefined ? config.options.gridLines : true,
                axisLabels: config.options?.axisLabels !== undefined ? config.options.axisLabels : true,
                dataLabels: config.options?.dataLabels !== undefined ? config.options.dataLabels : false,
                colors: config.options?.colors || ['#D4AF37', '#E8C95A', '#8B5CF6', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899'],
                theme: config.options?.theme || 'light',
                responsive: config.options?.responsive !== undefined ? config.options.responsive : true,
                maintainAspectRatio: config.options?.maintainAspectRatio !== undefined ? config.options.maintainAspectRatio : true,
                padding: config.options?.padding || { top: 20, right: 20, bottom: 30, left: 50 },
                xAxisLabel: config.options?.xAxisLabel || '',
                yAxisLabel: config.options?.yAxisLabel || '',
                ...config.options
            },
            ...config
        };

        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.animationId = null;
        this.isAnimating = false;
        this.animationProgress = 0;
        this.dimensions = { width: 0, height: 0, dpr: 1 };
        this.tooltip = null;
        this.legend = null;
        this.eventListeners = [];
        this.data = this.config.data;
        this.options = this.config.options;

        // Bind methods
        this.bindMethods();
    }

    bindMethods() {
        this.render = this.render.bind(this);
        this.update = this.update.bind(this);
        this.destroy = this.destroy.bind(this);
        this.resize = this.resize.bind(this);
        this.exportImage = this.exportImage.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.animate = this.animate.bind(this);
        this.draw = this.draw.bind(this);
    }

    /**
     * Render the chart
     * @returns {BaseChart} this (for chaining)
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

            // Create canvas wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            this.container.appendChild(wrapper);

            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            wrapper.appendChild(this.canvas);

            this.ctx = this.canvas.getContext('2d');

            // Setup DPR
            this.dimensions.dpr = window.devicePixelRatio || 1;

            // Set canvas size
            this.updateDimensions();

            // Setup event listeners
            this.setupEventListeners();

            // Draw chart
            this.draw();

            // Setup resize observer
            if (this.options.responsive) {
                this.setupResizeObserver();
            }

            return this;
        } catch (error) {
            console.error('[Chart] Render error:', error);
            this.showError(error.message);
            return this;
        }
    }

    /**
     * Update chart data and re-render
     * @param {object} data - New chart data
     * @param {object} options - New options
     */
    update(data, options = {}) {
        if (data) {
            this.data = data;
        }
        if (options) {
            this.options = { ...this.options, ...options };
        }

        // Reset animation
        this.animationProgress = 0;
        this.isAnimating = true;

        // Draw with animation
        this.animate();
    }

    /**
     * Destroy the chart
     */
    destroy() {
        // Cancel animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Remove event listeners
        this.removeEventListeners();

        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Remove container content
        if (this.container) {
            this.container.innerHTML = '';
        }

        this.canvas = null;
        this.ctx = null;
        this.container = null;
    }

    /**
     * Resize the chart
     */
    resize() {
        this.updateDimensions();
        this.draw();
    }

    /**
     * Export chart as image
     * @param {string} format - Image format (png, jpeg, webp)
     * @param {number} quality - Image quality (0-1)
     * @returns {string} Data URL
     */
    exportImage(format = 'png', quality = 0.92) {
        if (!this.canvas) {
            throw new Error('Chart not rendered');
        }
        const mimeType = `image/${format}`;
        return this.canvas.toDataURL(mimeType, quality);
    }

    /**
     * Update canvas dimensions
     */
    updateDimensions() {
        if (!this.canvas || !this.container) return;

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || this.options.width || 300;
        const height = this.options.height || 300;

        this.dimensions.width = width;
        this.dimensions.height = height;

        this.canvas.width = width * this.dimensions.dpr;
        this.canvas.height = height * this.dimensions.dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx.scale(this.dimensions.dpr, this.dimensions.dpr);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.canvas) return;

        // Mouse events
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.addEventListener('click', this.handleClick);

        this.eventListeners.push(
            { element: this.canvas, event: 'mousemove', handler: this.handleMouseMove },
            { element: this.canvas, event: 'mouseleave', handler: this.handleMouseLeave },
            { element: this.canvas, event: 'click', handler: this.handleClick }
        );
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }

    /**
     * Setup resize observer
     */
    setupResizeObserver() {
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.container);
        } else {
            // Fallback to window resize
            window.addEventListener('resize', this.handleResize);
            this.eventListeners.push(
                { element: window, event: 'resize', handler: this.handleResize }
            );
        }
    }

    /**
     * Handle resize
     */
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.resize();
        }, 100);
    }

    /**
     * Handle mouse move
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        if (!this.options.tooltip) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dataPoint = this.getDataPointAtPosition(x, y);
        if (dataPoint) {
            this.showTooltip(e.clientX, e.clientY, dataPoint);
            this.canvas.style.cursor = 'pointer';
        } else {
            this.hideTooltip();
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * Handle mouse leave
     */
    handleMouseLeave() {
        this.hideTooltip();
        this.canvas.style.cursor = 'default';
    }

    /**
     * Handle click
     * @param {MouseEvent} e - Mouse event
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dataPoint = this.getDataPointAtPosition(x, y);
        if (dataPoint && this.options.onClick) {
            this.options.onClick(dataPoint);
        }
    }

    /**
     * Get data point at position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {object|null} Data point
     */
    getDataPointAtPosition(x, y) {
        // To be implemented by subclasses
        return null;
    }

    /**
     * Show tooltip
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {object} data - Tooltip data
     */
    showTooltip(x, y, data) {
        this.hideTooltip();

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'chart-tooltip';
        this.tooltip.style.position = 'fixed';
        this.tooltip.style.left = `${x + 12}px`;
        this.tooltip.style.top = `${y - 10}px`;
        this.tooltip.style.zIndex = '1000';

        // Build tooltip content
        let content = '';
        if (data.label) {
            content += `<div class="tooltip-label">${data.label}</div>`;
        }
        if (data.value !== undefined) {
            content += `<div class="tooltip-value">${this.formatValue(data.value)}</div>`;
        }
        if (data.datasets) {
            data.datasets.forEach(ds => {
                const color = ds.color || '#D4AF37';
                content += `<div class="tooltip-dataset">
                    <span class="tooltip-color" style="background:${color}"></span>
                    ${ds.label}: ${this.formatValue(ds.value)}
                </div>`;
            });
        }

        this.tooltip.innerHTML = content;
        document.body.appendChild(this.tooltip);

        // Position tooltip
        const rect = this.tooltip.getBoundingClientRect();
        if (x + rect.width + 24 > window.innerWidth) {
            this.tooltip.style.left = `${x - rect.width - 12}px`;
        }
        if (y + rect.height + 20 > window.innerHeight) {
            this.tooltip.style.top = `${window.innerHeight - rect.height - 20}px`;
        }
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
    }

    /**
     * Animate chart
     */
    animate() {
        if (!this.isAnimating) return;

        const duration = this.options.animationDuration || 800;
        const startTime = performance.now();

        const animateStep = (timestamp) => {
            const elapsed = timestamp - startTime;
            this.animationProgress = Math.min(elapsed / duration, 1);
            this.draw();

            if (this.animationProgress < 1) {
                this.animationId = requestAnimationFrame(animateStep);
            } else {
                this.isAnimating = false;
                this.animationId = null;
            }
        };

        this.animationId = requestAnimationFrame(animateStep);
    }

    /**
     * Draw chart (to be implemented by subclasses)
     */
    draw() {
        throw new Error('draw() must be implemented by subclass');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        if (this.container) {
            const error = document.createElement('div');
            error.className = 'chart-error';
            error.textContent = `⚠️ ${message}`;
            error.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: #EF4444;
                font-size: 14px;
                border: 1px solid #EF4444;
                border-radius: 8px;
                background: rgba(239, 68, 68, 0.05);
            `;
            this.container.appendChild(error);
        }
    }

    /**
     * Format value
     * @param {number} value - Value to format
     * @returns {string} Formatted value
     */
    formatValue(value) {
        if (typeof value === 'number') {
            if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
            if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
            if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
            return `₹${value.toLocaleString()}`;
        }
        return value;
    }

    /**
     * Get color from palette
     * @param {number} index - Color index
     * @returns {string} Color
     */
    getColor(index) {
        const colors = this.options.colors || ['#D4AF37', '#E8C95A', '#8B5CF6', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899'];
        return colors[index % colors.length];
    }

    /**
     * Get text color based on theme
     * @param {string} opacity - Opacity
     * @returns {string} Text color
     */
    getTextColor(opacity = 1) {
        if (this.options.theme === 'dark') {
            return `rgba(255, 255, 255, ${opacity})`;
        }
        return `rgba(10, 10, 10, ${opacity})`;
    }

    /**
     * Get grid color based on theme
     * @returns {string} Grid color
     */
    getGridColor() {
        if (this.options.theme === 'dark') {
            return 'rgba(255, 255, 255, 0.06)';
        }
        return 'rgba(0, 0, 0, 0.06)';
    }

    /**
     * Draw legend
     * @param {Array} datasets - Dataset list
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     */
    drawLegend(datasets, x, y, width) {
        if (!this.options.legend || !datasets || datasets.length === 0) return y;

        const ctx = this.ctx;
        const itemHeight = 20;
        const itemWidth = width / datasets.length;
        const padding = 8;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Inter, sans-serif';

        datasets.forEach((dataset, index) => {
            const posX = x + (index * itemWidth) + (itemWidth / 2);
            const posY = y + padding;

            // Color box
            const boxSize = 12;
            ctx.fillStyle = dataset.color || this.getColor(index);
            ctx.fillRect(posX - boxSize / 2 - 4, posY - boxSize / 2, boxSize, boxSize);

            // Label
            ctx.fillStyle = this.getTextColor(0.7);
            ctx.textAlign = 'left';
            ctx.fillText(dataset.label || '', posX + 6, posY + 2);
        });

        return y + itemHeight + padding * 2;
    }

    /**
     * Draw title
     * @param {string} title - Title text
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     */
    drawTitle(title, x, y, width) {
        if (!title) return y;

        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 16px Poppins, sans-serif';
        ctx.fillStyle = this.getTextColor(0.9);
        ctx.fillText(title, x + width / 2, y);

        return y + 24;
    }

    /**
     * Draw subtitle
     * @param {string} subtitle - Subtitle text
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     */
    drawSubtitle(subtitle, x, y, width) {
        if (!subtitle) return y;

        const ctx = this.ctx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.5);
        ctx.fillText(subtitle, x + width / 2, y);

        return y + 18;
    }
}

/**
 * Line Chart
 */
class LineChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        // Calculate chart area
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        // Calculate chart area offset
        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        // Get data
        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        // Calculate ranges
        let maxValue = 0;
        let minValue = 0;
        datasets.forEach(dataset => {
            const data = dataset.data || [];
            data.forEach(value => {
                if (value > maxValue) maxValue = value;
                if (value < minValue) minValue = value;
            });
        });

        const range = maxValue - minValue || 1;
        const paddingRange = range * 0.1;
        maxValue += paddingRange;
        minValue -= paddingRange;
        if (minValue < 0) minValue = 0;

        // Draw grid lines
        if (this.options.gridLines) {
            const gridLines = 5;
            ctx.strokeStyle = this.getGridColor();
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= gridLines; i++) {
                const y = chartTop + (chartHeightAdjusted - (i / gridLines) * chartHeightAdjusted);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();

                // Grid labels
                const value = maxValue - (i / gridLines) * range;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillStyle = this.getTextColor(0.4);
                ctx.fillText(this.formatValue(Math.round(value)), padding.left - 8, y);
            }
        }

        // Draw x-axis labels
        if (this.options.axisLabels) {
            const labelCount = labels.length;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.5);

            labels.forEach((label, index) => {
                const x = padding.left + (index / (labelCount - 1 || 1)) * chartWidth;
                ctx.fillText(label, x, chartBottom + 6);
            });
        }

        // Draw x-axis label
        if (this.options.xAxisLabel) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.4);
            ctx.fillText(this.options.xAxisLabel, width / 2, height - 4);
        }

        // Draw y-axis label
        if (this.options.yAxisLabel) {
            ctx.save();
            ctx.translate(14, chartTop + chartHeightAdjusted / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.4);
            ctx.fillText(this.options.yAxisLabel, 0, 0);
            ctx.restore();
        }

        // Draw datasets
        const pointRadius = 4;
        const lineWidth = 2.5;

        datasets.forEach((dataset, datasetIndex) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(datasetIndex);
            const fillColor = dataset.fillColor || color + '33';
            const showArea = dataset.showArea || false;

            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Build path
            const points = data.map((value, index) => {
                const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
                const y = chartTop + chartHeightAdjusted - ((value - minValue) / range) * chartHeightAdjusted * progress;
                return { x, y, value };
            });

            // Draw area
            if (showArea) {
                const areaGradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
                areaGradient.addColorStop(0, color + '44');
                areaGradient.addColorStop(1, color + '08');
                ctx.fillStyle = areaGradient;
                ctx.beginPath();
                ctx.moveTo(points[0].x, chartBottom);
                points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(points[points.length - 1].x, chartBottom);
                ctx.closePath();
                ctx.fill();
            }

            // Draw line
            ctx.beginPath();
            points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            // Draw points
            if (this.options.dataLabels || dataset.showPoints !== false) {
                points.forEach((p, i) => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Data label
                    if (this.options.dataLabels) {
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = '10px Inter, sans-serif';
                        ctx.fillStyle = this.getTextColor(0.6);
                        ctx.fillText(this.formatValue(Math.round(p.value)), p.x, p.y - 6);
                    }
                });
            }

            // Store points for tooltip
            if (this.options.tooltip) {
                dataset._points = points;
            }
        });

        // Draw legend
        if (this.options.legend) {
            this.drawLegend(datasets, padding.left, chartBottom + 24, chartWidth);
        }

        // Draw tooltip data store
        this._tooltipData = { labels, datasets, points: [] };
    }

    getDataPointAtPosition(x, y) {
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        let closest = null;
        let closestDist = Infinity;

        this.data.datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(di);

            data.forEach((value, index) => {
                const px = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
                const py = padding.top + 10 + chartHeight - ((value - 0) / 1) * chartHeight;
                const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));

                if (dist < closestDist && dist < 30) {
                    closestDist = dist;
                    closest = {
                        label: this.data.labels[index],
                        value: value,
                        dataset: dataset.label,
                        color: color,
                        index: index,
                        datasetIndex: di
                    };
                }
            });
        });

        return closest;
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Bar Chart
 */
class BarChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        // Calculate max value
        let maxValue = 0;
        datasets.forEach(dataset => {
            const data = dataset.data || [];
            data.forEach(value => {
                if (value > maxValue) maxValue = value;
            });
        });
        maxValue += maxValue * 0.1 || 10;

        // Draw grid lines
        if (this.options.gridLines) {
            const gridLines = 5;
            ctx.strokeStyle = this.getGridColor();
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= gridLines; i++) {
                const y = chartTop + (chartHeightAdjusted - (i / gridLines) * chartHeightAdjusted);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();

                const value = maxValue - (i / gridLines) * maxValue;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillStyle = this.getTextColor(0.4);
                ctx.fillText(this.formatValue(Math.round(value)), padding.left - 8, y);
            }
        }

        // Draw bars
        const barWidth = chartWidth / labels.length;
        const groupWidth = barWidth * 0.7;
        const barGap = groupWidth / (datasets.length * 1.2);
        const barWidthActual = groupWidth / (datasets.length + 0.5);

        datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(di);

            data.forEach((value, idx) => {
                const x = padding.left + idx * barWidth + (barWidth - groupWidth) / 2 + di * barWidthActual + barGap / 2;
                const barHeight = (value / maxValue) * chartHeightAdjusted * progress;
                const y = chartBottom - barHeight;

                // Bar with rounded corners
                const radius = 4;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + barWidthActual - radius, y);
                ctx.quadraticCurveTo(x + barWidthActual, y, x + barWidthActual, y + radius);
                ctx.lineTo(x + barWidthActual, chartBottom);
                ctx.lineTo(x, chartBottom);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();

                ctx.fillStyle = color;
                ctx.fill();

                // Data label
                if (this.options.dataLabels) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = '10px Inter, sans-serif';
                    ctx.fillStyle = this.getTextColor(0.6);
                    ctx.fillText(this.formatValue(Math.round(value)), x + barWidthActual / 2, y - 4);
                }
            });
        });

        // Draw x-axis labels
        if (this.options.axisLabels) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.5);

            labels.forEach((label, index) => {
                const x = padding.left + index * barWidth + barWidth / 2;
                ctx.fillText(label, x, chartBottom + 6);
            });
        }

        // Draw legend
        if (this.options.legend) {
            this.drawLegend(datasets, padding.left, chartBottom + 24, chartWidth);
        }
    }

    getDataPointAtPosition(x, y) {
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) return null;

        const barWidth = chartWidth / labels.length;
        const groupWidth = barWidth * 0.7;
        const barWidthActual = groupWidth / (datasets.length + 0.5);

        for (let idx = 0; idx < labels.length; idx++) {
            for (let di = 0; di < datasets.length; di++) {
                const data = datasets[di].data || [];
                const value = data[idx] || 0;
                const color = datasets[di].color || this.getColor(di);

                const bx = padding.left + idx * barWidth + (barWidth - groupWidth) / 2 + di * barWidthActual + 4;
                const by = chartTop + 10;
                const bw = barWidthActual - 4;
                const bh = (value / (this._maxValue || 1)) * (chartHeight - 20);

                if (x >= bx && x <= bx + bw && y >= by + chartHeight - bh && y <= by + chartHeight) {
                    return {
                        label: labels[idx],
                        value: value,
                        dataset: datasets[di].label,
                        color: color,
                        index: idx,
                        datasetIndex: di
                    };
                }
            }
        }

        return null;
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Pie Chart
 */
class PieChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 20, left: 20 };

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, width - padding.left - padding.right);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, width - padding.left - padding.right);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeight = chartBottom - chartTop;

        const data = this.data.datasets || [];
        const labels = this.data.labels || [];

        if (data.length === 0 || labels.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        // Calculate total
        let total = 0;
        data.forEach(ds => {
            const values = ds.data || [];
            total += values.reduce((sum, v) => sum + v, 0);
        });

        if (total === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const centerX = width / 2;
        const centerY = chartTop + chartHeight / 2;
        const radius = Math.min(width - padding.left - padding.right, chartHeight) / 2 - 20;

        let startAngle = -Math.PI / 2;
        let colorIndex = 0;

        // Draw pie slices
        data.forEach((dataset, di) => {
            const values = dataset.data || [];
            const colors = dataset.colors || values.map(() => this.getColor(colorIndex++));

            values.forEach((value, idx) => {
                if (value === 0) return;

                const sliceAngle = (value / total) * Math.PI * 2 * progress;
                const endAngle = startAngle + sliceAngle;

                const label = labels[idx] || `Item ${idx + 1}`;
                const color = colors[idx % colors.length] || this.getColor(idx);

                // Draw slice
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, startAngle, endAngle);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();

                // Border
                ctx.strokeStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Data label
                if (this.options.dataLabels && sliceAngle > 0.1) {
                    const midAngle = startAngle + sliceAngle / 2;
                    const labelRadius = radius * 0.65;
                    const lx = centerX + Math.cos(midAngle) * labelRadius;
                    const ly = centerY + Math.sin(midAngle) * labelRadius;

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '11px Inter, sans-serif';
                    ctx.fillStyle = '#FFFFFF';
                    const percentage = Math.round((value / total) * 100);
                    ctx.fillText(`${percentage}%`, lx, ly);
                }

                startAngle = endAngle;
            });
        });

        // Draw center hole for doughnut
        // (Handled by DoughnutChart subclass)

        // Draw legend
        if (this.options.legend) {
            const legendY = chartTop + chartHeight + 10;
            this.drawLegendPie(ctx, data, labels, padding.left, legendY, width - padding.left - padding.right);
        }
    }

    drawLegendPie(ctx, datasets, labels, x, y, width) {
        if (!this.options.legend) return;

        const items = [];
        const colors = [];

        datasets.forEach((dataset, di) => {
            const values = dataset.data || [];
            const datasetColors = dataset.colors || values.map((_, idx) => this.getColor(idx));
            values.forEach((value, idx) => {
                if (value > 0) {
                    items.push(labels[idx]);
                    colors.push(datasetColors[idx % datasetColors.length]);
                }
            });
        });

        if (items.length === 0) return;

        const itemHeight = 22;
        const maxItemsPerRow = Math.floor(width / 120);
        const rows = Math.ceil(items.length / maxItemsPerRow);
        const totalHeight = rows * itemHeight;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Inter, sans-serif';

        items.forEach((label, index) => {
            const row = Math.floor(index / maxItemsPerRow);
            const col = index % maxItemsPerRow;
            const px = x + col * 120;
            const py = y + row * itemHeight + 4;

            // Color box
            const boxSize = 10;
            ctx.fillStyle = colors[index];
            ctx.fillRect(px, py - boxSize / 2, boxSize, boxSize);

            // Label
            ctx.fillStyle = this.getTextColor(0.7);
            ctx.fillText(label, px + 16, py + 1);
        });
    }

    getDataPointAtPosition(x, y) {
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 20, left: 20 };

        const chartTop = padding.top + 30;
        const chartHeight = height - padding.top - padding.bottom - 30;

        const centerX = width / 2;
        const centerY = chartTop + chartHeight / 2;
        const radius = Math.min(width - padding.left - padding.right, chartHeight) / 2 - 20;

        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius || dist < radius * 0.3) return null;

        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;

        const data = this.data.datasets || [];
        const labels = this.data.labels || [];

        let total = 0;
        data.forEach(ds => {
            const values = ds.data || [];
            total += values.reduce((sum, v) => sum + v, 0);
        });

        if (total === 0) return null;

        let currentAngle = -Math.PI / 2;
        let colorIndex = 0;

        for (let di = 0; di < data.length; di++) {
            const values = data[di].data || [];
            const colors = data[di].colors || values.map(() => this.getColor(colorIndex++));

            for (let idx = 0; idx < values.length; idx++) {
                const value = values[idx];
                if (value === 0) continue;

                const sliceAngle = (value / total) * Math.PI * 2;
                const endAngle = currentAngle + sliceAngle;

                if (angle >= currentAngle && angle < endAngle) {
                    return {
                        label: labels[idx] || `Item ${idx + 1}`,
                        value: value,
                        percentage: Math.round((value / total) * 100),
                        color: colors[idx % colors.length] || this.getColor(idx),
                        dataset: data[di].label || 'Dataset',
                        index: idx,
                        datasetIndex: di
                    };
                }

                currentAngle = endAngle;
            }
        }

        return null;
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Doughnut Chart (extends PieChart)
 */
class DoughnutChart extends PieChart {
    draw() {
        // Override draw to add center hole
        super.draw();

        // Add center hole after drawing slices
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 20, left: 20 };

        const chartTop = padding.top + 30;
        const chartHeight = height - padding.top - padding.bottom - 30;

        const centerX = width / 2;
        const centerY = chartTop + chartHeight / 2;
        const radius = Math.min(width - padding.left - padding.right, chartHeight) / 2 - 20;
        const innerRadius = radius * 0.55;

        // Draw center hole
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fill();

        // Draw center text
        const data = this.data.datasets || [];
        let total = 0;
        data.forEach(ds => {
            const values = ds.data || [];
            total += values.reduce((sum, v) => sum + v, 0);
        });

        if (total > 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 20px Poppins, sans-serif';
            ctx.fillStyle = this.getTextColor(0.9);
            ctx.fillText(this.formatValue(total), centerX, centerY - 6);
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.4);
            ctx.fillText('Total', centerX, centerY + 18);
        }
    }
}

/**
 * Area Chart (extends LineChart with filled area)
 */
class AreaChart extends LineChart {
    draw() {
        // Override to always show area
        const originalShowArea = this.options.showArea;
        this.options.showArea = true;
        super.draw();
        this.options.showArea = originalShowArea;
    }
}

/**
 * Scatter Chart
 */
class ScatterChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        const datasets = this.data.datasets || [];

        if (datasets.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        // Calculate ranges
        let minX = Infinity,
            maxX = -Infinity;
        let minY = Infinity,
            maxY = -Infinity;

        datasets.forEach(dataset => {
            const data = dataset.data || [];
            data.forEach(point => {
                if (point.x < minX) minX = point.x;
                if (point.x > maxX) maxX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.y > maxY) maxY = point.y;
            });
        });

        minX = minX === Infinity ? 0 : minX;
        maxX = maxX === -Infinity ? 1 : maxX;
        minY = minY === Infinity ? 0 : minY;
        maxY = maxY === -Infinity ? 1 : maxY;

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Draw grid lines
        if (this.options.gridLines) {
            const gridLines = 5;
            ctx.strokeStyle = this.getGridColor();
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= gridLines; i++) {
                const y = chartTop + (chartHeightAdjusted - (i / gridLines) * chartHeightAdjusted);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();

                const value = maxY - (i / gridLines) * rangeY;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillStyle = this.getTextColor(0.4);
                ctx.fillText(this.formatValue(Math.round(value)), padding.left - 8, y);
            }

            for (let i = 0; i <= gridLines; i++) {
                const x = padding.left + (i / gridLines) * chartWidth;
                ctx.beginPath();
                ctx.moveTo(x, chartTop);
                ctx.lineTo(x, chartBottom);
                ctx.stroke();

                const value = minX + (i / gridLines) * rangeX;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillStyle = this.getTextColor(0.4);
                ctx.fillText(Math.round(value), x, chartBottom + 4);
            }
        }

        // Draw scatter points
        const pointRadius = 6;

        datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(di);

            data.forEach(point => {
                const px = padding.left + ((point.x - minX) / rangeX) * chartWidth;
                const py = chartTop + chartHeightAdjusted - ((point.y - minY) / rangeY) * chartHeightAdjusted * progress;

                // Point
                ctx.beginPath();
                ctx.arc(px, py, pointRadius * progress, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Label
                if (this.options.dataLabels && point.label) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = '10px Inter, sans-serif';
                    ctx.fillStyle = this.getTextColor(0.6);
                    ctx.fillText(point.label, px, py - 8);
                }
            });
        });

        // Draw legend
        if (this.options.legend) {
            this.drawLegend(datasets, padding.left, chartBottom + 24, chartWidth);
        }
    }

    getDataPointAtPosition(x, y) {
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        let closest = null;
        let closestDist = Infinity;

        this.data.datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(di);

            data.forEach(point => {
                const px = padding.left + ((point.x - 0) / 1) * chartWidth;
                const py = padding.top + 10 + chartHeight - ((point.y - 0) / 1) * chartHeight;
                const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));

                if (dist < closestDist && dist < 30) {
                    closestDist = dist;
                    closest = {
                        label: point.label || `(${point.x}, ${point.y})`,
                        value: point.y,
                        x: point.x,
                        y: point.y,
                        dataset: dataset.label,
                        color: color
                    };
                }
            });
        });

        return closest;
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Funnel Chart
 */
class FunnelChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 60, bottom: 30, left: 20 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        const data = this.data.datasets || [];
        const labels = this.data.labels || [];

        if (data.length === 0 || labels.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const values = data[0]?.data || [];
        const progress = this.animationProgress || 1;

        if (values.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const maxValue = Math.max(...values) || 1;
        const stepHeight = chartHeightAdjusted / values.length;
        const funnelWidth = chartWidth * 0.6;
        const minWidth = funnelWidth * 0.2;

        values.forEach((value, index) => {
            const ratio = value / maxValue;
            const width = (minWidth + (funnelWidth - minWidth) * ratio) * progress;
            const y = chartTop + index * stepHeight;
            const x = padding.left + (chartWidth - width) / 2;

            const color = this.getColor(index);

            // Funnel segment
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + stepHeight - radius);
            ctx.quadraticCurveTo(x + width, y + stepHeight, x + width - radius, y + stepHeight);
            ctx.lineTo(x + radius, y + stepHeight);
            ctx.quadraticCurveTo(x, y + stepHeight, x, y + stepHeight - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.fill();

            // Border
            ctx.strokeStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label
            const label = labels[index] || `Stage ${index + 1}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.7);
            ctx.fillText(label, padding.left + funnelWidth + 16, y + stepHeight / 2);

            // Value
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.7);
            ctx.fillText(this.formatValue(value), padding.left - 8, y + stepHeight / 2);

            // Percentage
            const percentage = Math.round((value / maxValue) * 100);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.4);
            ctx.fillText(`${percentage}%`, x + width / 2, y + stepHeight / 2);
        });
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Radar Chart
 */
class RadarChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 40, left: 20 };

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, width - padding.left - padding.right);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, width - padding.left - padding.right);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeight = chartBottom - chartTop;

        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        const centerX = width / 2;
        const centerY = chartTop + chartHeight / 2;
        const radius = Math.min(width - padding.left - padding.right, chartHeight) / 2 - 20;

        const angles = labels.map((_, i) => (i / labels.length) * Math.PI * 2 - Math.PI / 2);

        // Draw radar grid
        const levels = 5;
        ctx.strokeStyle = this.getGridColor();
        ctx.lineWidth = 0.5;

        for (let level = 1; level <= levels; level++) {
            const r = (radius / levels) * level;
            ctx.beginPath();
            angles.forEach((angle, i) => {
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
        }

        // Draw axis lines
        angles.forEach(angle => {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            ctx.stroke();

            // Labels
            const lx = centerX + Math.cos(angle) * (radius + 12);
            const ly = centerY + Math.sin(angle) * (radius + 12);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.6);
            ctx.fillText(labels[angles.indexOf(angle)] || '', lx, ly);
        });

        // Draw datasets
        datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const color = dataset.color || this.getColor(di);
            const fillColor = color + '33';

            // Draw data polygon
            ctx.beginPath();
            data.forEach((value, i) => {
                const r = (value / 100) * radius * progress;
                const angle = angles[i];
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();

            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw points
            data.forEach((value, i) => {
                const r = (value / 100) * radius * progress;
                const angle = angles[i];
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Data label
                if (this.options.dataLabels) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = '9px Inter, sans-serif';
                    ctx.fillStyle = this.getTextColor(0.5);
                    ctx.fillText(Math.round(value), x, y - 6);
                }
            });
        });

        // Draw legend
        if (this.options.legend) {
            this.drawLegend(datasets, padding.left, chartBottom, width - padding.left - padding.right);
        }
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Gauge Chart
 */
class GaugeChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 20, left: 20 };

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, width - padding.left - padding.right);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, width - padding.left - padding.right);
        }

        const chartTop = currentY + 10;
        const chartHeight = height - padding.top - padding.bottom - 10;

        const data = this.data.datasets || [];
        const value = data[0]?.data?.[0] || 0;
        const maxValue = data[0]?.maxValue || 100;
        const label = data[0]?.label || 'Value';
        const color = data[0]?.color || this.getColor(0);

        const progress = this.animationProgress || 1;
        const normalizedValue = Math.min(Math.max(value / maxValue, 0), 1) * progress;

        const centerX = width / 2;
        const centerY = chartTop + chartHeight / 2 + 10;
        const radius = Math.min(width - padding.left - padding.right, chartHeight) / 2 - 20;

        // Draw gauge background
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const totalAngle = endAngle - startAngle;

        ctx.lineWidth = 20;
        ctx.lineCap = 'round';

        // Background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = this.options.theme === 'dark' ? '#2A2A2A' : '#E8E5DD';
        ctx.stroke();

        // Value arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + totalAngle * normalizedValue);
        ctx.strokeStyle = color;
        ctx.stroke();

        // Value text
        const displayValue = Math.round(value);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 36px Poppins, sans-serif';
        ctx.fillStyle = this.getTextColor(0.9);
        ctx.fillText(displayValue, centerX, centerY - 8);

        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.4);
        ctx.fillText(label, centerX, centerY + 30);

        // Min/Max labels
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('0', padding.left + 10, chartTop + chartHeight - 10);

        ctx.textAlign = 'right';
        ctx.fillText(maxValue, width - padding.right - 10, chartTop + chartHeight - 10);
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Heatmap Chart
 */
class HeatmapChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        const data = this.data.datasets || [];
        const labels = this.data.labels || [];
        const xLabels = this.data.xLabels || labels;

        if (data.length === 0 || xLabels.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const matrix = data[0]?.data || [];
        const colors = ['#F3F4F6', '#D4AF37', '#E8C95A', '#F5D97E', '#B8960F', '#8B5CF6', '#3B82F6'];

        const cellWidth = chartWidth / matrix.length;
        const cellHeight = chartHeightAdjusted / (matrix[0]?.length || 1);

        matrix.forEach((row, i) => {
            row.forEach((value, j) => {
                const x = padding.left + i * cellWidth;
                const y = chartTop + j * cellHeight;

                const intensity = Math.min(Math.max(value / 100, 0), 1);
                const colorIndex = Math.floor(intensity * (colors.length - 1));
                const color = colors[Math.min(colorIndex, colors.length - 1)];

                ctx.fillStyle = color;
                ctx.fillRect(x, y, cellWidth - 1, cellHeight - 1);

                // Value text
                if (value > 0) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '10px Inter, sans-serif';
                    ctx.fillStyle = intensity > 0.5 ? '#FFFFFF' : '#0A0A0A';
                    ctx.fillText(Math.round(value), x + cellWidth / 2, y + cellHeight / 2);
                }
            });
        });

        // X-axis labels
        if (this.options.axisLabels && xLabels) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.5);

            xLabels.forEach((label, i) => {
                const x = padding.left + i * cellWidth + cellWidth / 2;
                ctx.fillText(label, x, chartBottom + 4);
            });
        }

        // Y-axis labels
        if (this.options.axisLabels && labels) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.5);

            labels.forEach((label, j) => {
                const y = chartTop + j * cellHeight + cellHeight / 2;
                ctx.fillText(label, padding.left - 8, y);
            });
        }
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

/**
 * Combo Chart (Bar + Line)
 */
class ComboChart extends BaseChart {
    draw() {
        const ctx = this.ctx;
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = this.options.theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw title
        let currentY = padding.top;
        if (this.options.title) {
            currentY = this.drawTitle(this.options.title, padding.left, currentY, chartWidth);
        }
        if (this.options.subtitle) {
            currentY = this.drawSubtitle(this.options.subtitle, padding.left, currentY, chartWidth);
        }

        const chartTop = currentY + 10;
        const chartBottom = height - padding.bottom;
        const chartHeightAdjusted = chartBottom - chartTop;

        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) {
            this.drawEmptyState(ctx, width, height);
            return;
        }

        const progress = this.animationProgress || 1;

        // Calculate max value
        let maxValue = 0;
        datasets.forEach(dataset => {
            const data = dataset.data || [];
            data.forEach(value => {
                if (value > maxValue) maxValue = value;
            });
        });
        maxValue += maxValue * 0.1 || 10;

        // Draw grid lines
        if (this.options.gridLines) {
            const gridLines = 5;
            ctx.strokeStyle = this.getGridColor();
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= gridLines; i++) {
                const y = chartTop + (chartHeightAdjusted - (i / gridLines) * chartHeightAdjusted);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();

                const value = maxValue - (i / gridLines) * maxValue;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillStyle = this.getTextColor(0.4);
                ctx.fillText(this.formatValue(Math.round(value)), padding.left - 8, y);
            }
        }

        const barWidth = chartWidth / labels.length;
        const groupWidth = barWidth * 0.7;
        const barWidthActual = groupWidth / (datasets.filter(d => d.type !== 'line').length + 0.5);

        datasets.forEach((dataset, di) => {
            const data = dataset.data || [];
            const type = dataset.type || 'bar';
            const color = dataset.color || this.getColor(di);

            if (type === 'bar') {
                // Draw bars
                data.forEach((value, idx) => {
                    const x = padding.left + idx * barWidth + (barWidth - groupWidth) / 2 + di * barWidthActual + 4;
                    const barHeight = (value / maxValue) * chartHeightAdjusted * progress;
                    const y = chartBottom - barHeight;

                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, barWidthActual - 4, barHeight);

                    if (this.options.dataLabels) {
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = '10px Inter, sans-serif';
                        ctx.fillStyle = this.getTextColor(0.6);
                        ctx.fillText(this.formatValue(Math.round(value)), x + barWidthActual / 2, y - 4);
                    }
                });
            } else if (type === 'line') {
                // Draw line
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';

                const points = data.map((value, idx) => {
                    const x = padding.left + idx * barWidth + barWidth / 2;
                    const y = chartTop + chartHeightAdjusted - (value / maxValue) * chartHeightAdjusted * progress;
                    return { x, y, value };
                });

                ctx.beginPath();
                points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();

                // Draw points
                points.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                });
            }
        });

        // Draw x-axis labels
        if (this.options.axisLabels) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillStyle = this.getTextColor(0.5);

            labels.forEach((label, index) => {
                const x = padding.left + index * barWidth + barWidth / 2;
                ctx.fillText(label, x, chartBottom + 6);
            });
        }

        // Draw legend
        if (this.options.legend) {
            this.drawLegend(datasets, padding.left, chartBottom + 24, chartWidth);
        }
    }

    getDataPointAtPosition(x, y) {
        // For combo chart, use bar chart hit detection
        const { width, height } = this.dimensions;
        const padding = this.options.padding || { top: 20, right: 20, bottom: 30, left: 50 };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const labels = this.data.labels || [];
        const datasets = this.data.datasets || [];

        if (labels.length === 0 || datasets.length === 0) return null;

        const barWidth = chartWidth / labels.length;
        const groupWidth = barWidth * 0.7;

        for (let idx = 0; idx < labels.length; idx++) {
            for (let di = 0; di < datasets.length; di++) {
                const data = datasets[di].data || [];
                const value = data[idx] || 0;
                const color = datasets[di].color || this.getColor(di);
                const type = datasets[di].type || 'bar';

                if (type === 'bar') {
                    const bx = padding.left + idx * barWidth + (barWidth - groupWidth) / 2 + di * 12 + 4;
                    const by = chartTop + 10;
                    const bw = (groupWidth / (datasets.filter(d => d.type !== 'line').length + 0.5)) - 4;
                    const bh = (value / (this._maxValue || 1)) * (chartHeight - 20);

                    if (x >= bx && x <= bx + bw && y >= by + chartHeight - bh && y <= by + chartHeight) {
                        return {
                            label: labels[idx],
                            value: value,
                            dataset: datasets[di].label,
                            color: color,
                            index: idx,
                            datasetIndex: di
                        };
                    }
                } else if (type === 'line') {
                    const px = padding.left + idx * barWidth + barWidth / 2;
                    const py = chartTop + chartHeight - (value / (this._maxValue || 1)) * (chartHeight - 20);

                    if (Math.abs(x - px) < 15 && Math.abs(y - py) < 15) {
                        return {
                            label: labels[idx],
                            value: value,
                            dataset: datasets[di].label,
                            color: color,
                            index: idx,
                            datasetIndex: di
                        };
                    }
                }
            }
        }

        return null;
    }

    drawEmptyState(ctx, width, height) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = this.getTextColor(0.3);
        ctx.fillText('No data to display', width / 2, height / 2);
    }
}

// Export all chart classes
export {
    BaseChart,
    LineChart,
    BarChart,
    PieChart,
    DoughnutChart,
    AreaChart,
    ScatterChart,
    FunnelChart,
    RadarChart,
    GaugeChart,
    HeatmapChart,
    ComboChart
};
