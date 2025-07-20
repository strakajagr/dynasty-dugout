/**
 * Table Service - Handles all table creation and manipulation
 * This is a modular service that can be used across the entire application
 */
class TableService {
    
    /**
     * Creates a resizable, sortable table with the given data and columns
     * @param {Array} data - Array of objects containing the table data
     * @param {Array} columns - Array of column definitions {key, title}
     * @param {Object} options - Optional styling and configuration
     * @returns {String} HTML string for the complete table
     */
    static createResizableTable(data, columns, options = {}) {
        const tableId = options.id || 'dataTable';
        const headerColor = options.headerColor || '#D4A000';
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            return `<div class="no-data">No data available</div>`;
        }

        // Create table headers
        const headers = columns.map(col => 
            `<th data-key="${col.key}" style="position: relative; background-color: ${headerColor}; cursor: pointer;">
                ${col.title}
                <span class="sort-indicator"></span>
                <div class="resize-handle"></div>
            </th>`
        ).join('');

        // Create table rows
        const rows = data.map(row => {
            const cells = columns.map(col => {
                let value = row[col.key] || '';
                // Handle different data types
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                return `<td>${value}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        // Return complete table HTML with embedded styles
        return `
            <div class="table-container">
                <table id="${tableId}" class="resizable-table">
                    <thead>
                        <tr>${headers}</tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <style>
                .table-container {
                    overflow: auto;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    max-height: 600px;
                }
                
                .resizable-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                
                .resizable-table th,
                .resizable-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .resizable-table th {
                    background-color: ${headerColor};
                    font-weight: bold;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                .resize-handle {
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: 5px;
                    cursor: col-resize;
                    background: rgba(255,255,255,0.2);
                    opacity: 0;
                    transition: opacity 0.25s;
                }
                
                .resizable-table th:hover .resize-handle {
                    opacity: 1;
                }
                
                .resize-handle:hover {
                    background: rgba(255,255,255,0.4);
                }
                
                .resizable-table tbody tr:hover {
                    background-color: #f0f0f0;
                }
                
                .resizable-table tbody tr:nth-child(even) {
                    background-color: #f8f8f8;
                }
                
                .sort-indicator {
                    margin-left: 5px;
                    font-size: 12px;
                }
                
                .sort-indicator:after {
                    content: '↕';
                    color: rgba(255,255,255,0.7);
                }
                
                .sort-indicator.asc:after {
                    content: '↑';
                    color: white;
                }
                
                .sort-indicator.desc:after {
                    content: '↓';
                    color: white;
                }
                
                .no-data {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                    font-style: italic;
                }
            </style>
        `;
    }

    /**
     * Adds resize and sort functionality to an existing table
     * @param {String} tableId - The ID of the table element
     */
    static addResizeAndSort(tableId) {
        this.addColumnResizing(tableId);
        this.addSorting(tableId);
    }

    /**
     * Adds column resizing functionality to a table
     * @param {String} tableId - The ID of the table element
     */
    static addColumnResizing(tableId) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Table with ID '${tableId}' not found`);
            return;
        }

        const headers = table.querySelectorAll('th');
        let isResizing = false;
        let currentColumn = null;
        let startX = 0;
        let startWidth = 0;

        headers.forEach(header => {
            const resizeHandle = header.querySelector('.resize-handle');
            if (!resizeHandle) return;

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentColumn = header;
                startX = e.clientX;
                startWidth = parseInt(window.getComputedStyle(header).width, 10);
                
                document.addEventListener('mousemove', handleResize);
                document.addEventListener('mouseup', stopResize);
                e.preventDefault();
            });
        });

        function handleResize(e) {
            if (!isResizing || !currentColumn) return;
            
            const width = startWidth + e.clientX - startX;
            if (width > 50) { // Minimum column width
                currentColumn.style.width = width + 'px';
            }
        }

        function stopResize() {
            isResizing = false;
            currentColumn = null;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }

    /**
     * Adds sorting functionality to a table
     * @param {String} tableId - The ID of the table element
     */
    static addSorting(tableId) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Table with ID '${tableId}' not found`);
            return;
        }

        const headers = table.querySelectorAll('th[data-key]');
        let currentSort = { column: null, direction: 'asc' };

        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't sort if clicking on resize handle
                if (e.target.classList.contains('resize-handle')) return;
                
                const column = header.dataset.key;
                const sortIndicator = header.querySelector('.sort-indicator');
                
                // Clear all other sort indicators
                headers.forEach(h => {
                    const indicator = h.querySelector('.sort-indicator');
                    if (indicator && h !== header) {
                        indicator.className = 'sort-indicator';
                    }
                });
                
                // Determine sort direction
                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.direction = 'asc';
                }
                currentSort.column = column;
                
                // Update sort indicator
                sortIndicator.className = `sort-indicator ${currentSort.direction}`;
                
                // Sort the table
                this.sortTable(table, column, currentSort.direction);
            });
        });
    }

    /**
     * Sorts a table by the specified column
     * @param {HTMLElement} table - The table element
     * @param {String} column - The column key to sort by
     * @param {String} direction - 'asc' or 'desc'
     */
    static sortTable(table, column, direction) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const columnIndex = Array.from(table.querySelectorAll('th[data-key]'))
            .findIndex(th => th.dataset.key === column);

        if (columnIndex === -1) return;

        rows.sort((a, b) => {
            const aValue = a.cells[columnIndex].textContent.trim();
            const bValue = b.cells[columnIndex].textContent.trim();
            
            // Try to parse as numbers first
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            
            let comparison = 0;
            if (!isNaN(aNum) && !isNaN(bNum)) {
                comparison = aNum - bNum;
            } else {
                comparison = aValue.localeCompare(bValue);
            }
            
            return direction === 'asc' ? comparison : -comparison;
        });

        // Clear tbody and re-append sorted rows
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }

    /**
     * Creates a simple table without advanced features
     * @param {Array} data - Array of objects containing the table data
     * @param {Array} columns - Array of column definitions {key, title}
     * @returns {String} HTML string for a basic table
     */
    static createSimpleTable(data, columns) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return `<div class="no-data">No data available</div>`;
        }

        const headers = columns.map(col => `<th>${col.title}</th>`).join('');
        const rows = data.map(row => {
            const cells = columns.map(col => `<td>${row[col.key] || ''}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <table class="simple-table">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }
}

// Make TableService globally available
window.TableService = TableService;
