frappe.provide('alphaspp.bulk_invoice_entry');

frappe.pages['bulk_invoice_entry'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Bulk Invoice Entry',
        single_column: true
    });

    frappe.require([
        '/assets/alphaspp/css/bulk_invoice_entry.css'
    ], () => {
        new alphaspp.bulk_invoice_entry.BulkInvoiceEntry(page);
    });
};

alphaspp.bulk_invoice_entry.BulkInvoiceEntry = class BulkInvoiceEntry {
    constructor(page) {
        this.page = page;
        this.entries = [];
        this.sales_orders = {};
        this.company_addresses = [];
        this.warehouses = [];
        this.setup();
        this.make();
        this.init_table();
        this.fetch_initial_data(); // Fetch the initial data for sales orders and products
        this.fetch_warehouses(); // Fetch warehouses for 'Shipping From' field
        this.load_drivers(); // Load drivers from Driver doctype
    }

    setup() {
        this.page.set_primary_action('Create Invoice', () => this.create_batch(), 'octicon octicon-plus');
        this.page.set_indicator('0 Entries', 'blue');
    }

    make() {
        const me = this;

        this.$content = $(`
<div class="bulk-invoice-entry">
    <div class="entry-section">
        <div class="frappe-card p-3 mb-4">
            <form class="bulk-entry-form">
                <!-- Core Workflow Section -->
                <div class="row">
                    <!-- Primary Workflow -->
                    <div class="col-md-8">
                        <!-- Customer Ref Code & Product Selection -->
                        <div class="row">
                            <div class="col-md-4 form-group">
                                <label>Ref Code / Product</label>
                                <input type="text" class="form-control" 
                                    id="customer-ref-code" placeholder="Enter code" 
                                    autocomplete="off">
                                <div id="ref-code-suggestions" class="dropdown-menu" style="display: none; position: absolute; z-index: 1000; width: 100%;"></div>
                            </div>
                            <div class="col-md-4 form-group">
                                <label>Product</label>
                                <select class="form-control" id="product" required>
                                    <option value="">Select Product</option>
                                </select>
                            </div>
                            <div class="col-md-4 form-group">
                                <label>Billed Qty</label>
                                <input type="number" class="form-control" 
                                    id="billed-qty" placeholder="Quantity" 
                                    min="1" required>
                            </div>
                        </div>

                        <!-- Sales Order & Customer -->
                        <div class="row">
                            <div class="col-md-6 form-group">
                                <label>Sales Order</label>
                                <select class="form-control" id="sales-order" required>
                                    <option value="">Loading orders...</option>
                                </select>
                            </div>
                            <div class="col-md-6 form-group">
                                <label>Customer</label>
                                <div class="card" id="customer-card">
                                    <div class="card-body">
                                        <h5 class="card-title" id="customer-name">Select product first</h5>
                                        <p class="card-text small" id="customer-address">
                                            Sales order will load customer details
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Date & Locations -->
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" class="form-control" 
                                id="entry-date" 
                                value="${frappe.datetime.get_today()}">
                        </div>
                        
                        <div class="form-group">
                            <label>Invoice Series</label>
                            <select class="form-control" id="invoice-series" required>
                                <option value="">Select Series</option>
                                <option value="U1/25-26/">U1/25-26/</option>
                                <option value="U2/25-26/">U2/25-26/</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Billing From</label>
                            <select class="form-control" id="billing-from" required>
                                <option value="">Select Address</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Shipment From</label>
                            <select class="form-control" id="shipment-from" required>
                                <option value="">Select Warehouse</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Packaging & Shipping -->
                <div class="row mt-3">
                    <div class="col-md-2 form-group">
                        <label>Packaging Type</label>
                        <select class="form-control" id="packaging-type" required>
                            <option value="">Select Packaging Type</option>
                            <option value="Box">Box</option>
                            <option value="Tray">Tray</option>
                            <option value="Packet">Packet</option>
                        </select>
                    </div>
                    <div class="col-md-2 form-group">
                        <label>Packages</label>
                        <input type="number" class="form-control" 
                            id="packages" placeholder="Count" required>
                    </div>
                    <div class="col-md-3 form-group">
                        <label>ASN No.</label>
                        <input type="text" class="form-control" 
                            id="asn-no" placeholder="ASN Number" required>
                    </div>
                    <div class="col-md-3 form-group">
                        <label>Vehicle No.</label>
                        <input type="text" class="form-control" 
                            id="vehicle-no" placeholder="Vehicle Number" required>
                    </div>
                    <div class="col-md-2 form-group">
                        <label>Driver Name</label>
                        <select class="form-control" 
                            id="driver-name" required>
                            <option value="">Select Driver</option>
                        </select>
                    </div>
                </div>

                <!-- Final Actions -->
                <div class="text-right mt-4">
                    <button type="button" class="btn btn-primary" 
                        id="add-entry">
                        Add Entry
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Data Display -->
    <div class="table-section">
        <div class="frappe-card">
            <div class="entries-table"></div>
        </div>
    </div>
</div>

        `).appendTo(this.page.main);

        this.bind_events();
        this.fetch_company_addresses(); // Fetch company addresses for 'Billing From' fields
    }

    init_table() {
        this.entries_table = new frappe.DataTable(
            this.$content.find('.entries-table')[0],
            {
                columns: [
                    {
                        name: 'actions',
                        label: __('Actions'),
                        width: 100,
                        format: (value, row, column, data, default_formatter) => {
                            return `<button class="btn btn-xs btn-danger delete-btn" 
                                      data-index="${row.meta.rowIndex}">
                                      ${__('Delete')}
                                    </button>`;
                        }
                    },
                    { name: 'date', label: 'Date', type: 'Date', width: 95 },
                    { name: 'invoice_series', label: 'Series', width: 100 },
                    { name: 'billing_from', label: 'Billing From', width: 100 },
                    { name: 'customer_ref_code', label: 'Ref Code', width: 100 },
                    { name: 'product', label: 'Product', width: 150 },
                    { name: 'billed_qty', label: 'Billed Qty', width: 90 },
                    { name: 'packaging_type', label: 'Packaging Type', width: 110 },
                    { name: 'packages', label: 'Packages', width: 90 },
                    { name: 'asn_no', label: 'ASN No.', width: 100 },
                    { name: 'shipment_from', label: 'Shipment From', width: 110 },
                    { name: 'vehicle_no', label: 'Vehicle No.', width: 100 },
                    { name: 'driver_name', label: 'Driver Name', width: 120 },
                    { name: 'sales_order', label: 'Sales Order', width: 120 },
                    { name: 'po_no', label: 'Customer PO', width: 120 },
                    { name: 'po_date', label: 'PO Date', width: 100 },
                    { name: 'customer', label: 'Customer', width: 150 }
                ],
                data: this.entries
            }
        );
        this.$content.on('click', '.delete-btn', (e) => {
            const index = $(e.target).data('index');
            this.delete_entry(index);
        });
    }

    delete_entry(index) {
        if (index >= 0 && index < this.entries.length) {
            this.entries.splice(index, 1);
            this.entries_table.refresh(this.entries);
            this.update_entries_count();
            frappe.show_alert({ message: __('Entry deleted'), indicator: 'green' });
        }
    }

    bind_events() {
        this.$content.find('#add-entry').on('click', () => this.add_entry());
        this.$content.find('#product').on('change', () => this.populate_sales_order());
        this.$content.find('#sales-order').on('change', () => this.fetch_customer_info());
        this.$content.find('#customer-ref-code').on('input', () => this.search_ref_codes());
        this.$content.find('#customer-ref-code').on('keydown', (e) => this.handle_ref_code_keydown(e));
        this.$content.find('#customer-ref-code').on('blur', () => this.hide_ref_code_suggestions());
    }

    fetch_initial_data() {
        console.log('Fetching initial sales orders and products...');
        frappe.call({
            method: 'alphaspp.alphaspp.api.fetch_sales_orders_and_products',
            callback: (r) => {
                console.log('Initial data response:', r);
                if (r.message) {
                    this.sales_orders = r.message;
                    console.log('Sales orders mapping loaded:', this.sales_orders);
                    this.populate_product();
                } else {
                    console.log('No sales orders data received');
                }
            },
            error: (r) => {
                console.error('Error fetching initial data:', r);
            }
        });
    }

    fetch_company_addresses() {
        frappe.call({
            method: 'alphaspp.alphaspp.api.get_company_addresses',
            callback: (r) => {
                if (r.message) {
                    this.company_addresses = r.message;
                    this.populate_address_fields();
                }
            }
        });
    }

    fetch_warehouses() {
        frappe.call({
            method: 'alphaspp.alphaspp.api.get_warehouses',
            callback: (r) => {
                if (r.message) {
                    this.warehouses = r.message;
                    this.populate_warehouse_fields();
                }
            }
        });
    }

    }

    load_drivers() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Driver',
                fields: ['name', 'full_name', 'status'],
                filters: [['status', '=', 'Active']],
                order_by: 'full_name asc'
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.populate_driver_field(r.message);
                } else {
                    console.log('No active drivers found');
                    // Keep the select field but show a message
                    this.$content.find('#driver-name').append('<option value="">No active drivers found</option>');
                }
            },
            error: (r) => {
                console.error('Error fetching drivers:', r);
                // Fallback: convert back to text input if Driver doctype is not available
                const driver_container = this.$content.find('#driver-name').parent();
                driver_container.html(`
                    <label>Driver Name</label>
                    <input type="text" class="form-control" 
                        id="driver-name" placeholder="Driver Name" required>
                `);
            }
        });
    }

    populate_driver_field(drivers) {
        const driver_select = this.$content.find('#driver-name');
        driver_select.empty();
        driver_select.append('<option value="">Select Driver</option>');
        
        drivers.forEach(driver => {
            driver_select.append(
                `<option value="${driver.name}" data-full-name="${driver.full_name}">
                    ${driver.full_name}
                </option>`
            );
        });
    }

    fetch_sales_orders_for_product(product) {
        console.log(`Fetching sales orders for product: ${product}`);
        frappe.call({
            method: 'alphaspp.alphaspp.api.get_sales_orders_for_product',
            args: { product: product },
            callback: (r) => {
                console.log(`Sales orders response for ${product}:`, r.message);
                if (r.message && r.message.length > 0) {
                    // Add this product's sales orders to our mapping
                    this.sales_orders[product] = r.message;
                    console.log(`Added to sales_orders mapping:`, this.sales_orders[product]);
                    // Repopulate the sales order dropdown
                    this.populate_sales_order();
                } else {
                    // No sales orders found for this product
                    console.log(`No sales orders found for product: ${product}`);
                    frappe.show_alert({
                        message: `No pending sales orders found for ${product}`,
                        indicator: 'orange'
                    });
                }
            },
            error: (r) => {
                console.error(`Error fetching sales orders for ${product}:`, r);
            }
        });
    }

    populate_product() {
        console.log('Populating product dropdown...');
        const $productSelect = this.$content.find('#product');
        $productSelect.empty().append('<option value="">Select Product</option>');

        // Get products from sales orders
        const allProducts = Object.keys(this.sales_orders || {});
        console.log('Active products from sales orders:', allProducts);
        
        allProducts.forEach(product => {
            $productSelect.append(`<option value="${product}">${product}</option>`);
        });
        
        console.log('Product dropdown populated with', allProducts.length, 'products');
    }

    populate_sales_order() {
        const selectedProduct = this.$content.find('#product').val();
        console.log('Populating sales orders for product:', selectedProduct);
        const $salesOrderSelect = this.$content.find('#sales-order');
        $salesOrderSelect.empty().append('<option value="">Select Sales Order</option>');
        let firstSalesOrder = null;

        if (selectedProduct) {
            console.log('Current sales_orders mapping:', this.sales_orders);
            // Check if product exists in sales_orders mapping
            if (this.sales_orders && this.sales_orders[selectedProduct]) {
                const sales_orders = this.sales_orders[selectedProduct];
                console.log(`Found ${sales_orders.length} sales orders for product ${selectedProduct}:`, sales_orders);
                
                // Store sales order details for later use
                this.so_details_map = {};
                
                sales_orders.forEach((so_detail, index) => {
                    // Check if the sales_order is a string (old format) or object (new format)
                    if (typeof so_detail === 'string') {
                        // Old format - just the sales order name
                        if (index === 0) firstSalesOrder = so_detail;
                        $salesOrderSelect.append(`<option value="${so_detail}">${so_detail}</option>`);
                    } else {
                        // New format - object with details
                        const so_name = so_detail.name;
                        if (index === 0) firstSalesOrder = so_name;
                        
                        // Store the details for later use
                        this.so_details_map[so_name] = {
                            po_no: so_detail.po_no || '',
                            po_date: so_detail.po_date || '',
                            status: so_detail.status || ''
                        };
                        
                        // Display PO number in the dropdown if available
                        const displayText = so_detail.po_no ? 
                            `${so_name} (PO: ${so_detail.po_no})` : 
                            so_name;
                            
                        $salesOrderSelect.append(`<option value="${so_name}">${displayText}</option>`);
                    }
                });
            } else {
                // Product might be from ref code but not in sales_orders
                // We need to fetch sales orders for this product
                console.log(`Product ${selectedProduct} not found in sales_orders mapping, fetching...`);
                this.fetch_sales_orders_for_product(selectedProduct);
                return;
            }
        }

        if (firstSalesOrder) {
            $salesOrderSelect.val(firstSalesOrder);
            console.log('Auto-selected first sales order:', firstSalesOrder);
            this.fetch_customer_info();
        } else {
            console.log('No sales orders found to auto-select');
        }
    }

    fetch_customer_info() {
        const sales_order = this.$content.find('#sales-order').val();
        if (sales_order) {
            frappe.call({
                method: 'alphaspp.alphaspp.api.get_customer_info',
                args: { sales_order },
                callback: (r) => {
                    if (r.message) {
                        const customer = r.message[0];
                        // Set both customer_name and customer (actual value)
                        $('#customer-name').text(customer.name);
                        $('#customer-address').text(customer.primary_address);
                        // Store actual customer value for entry
                        this.actual_customer = customer.name;
                    }
                }
            });
        } else {
            $('#customer-name').text('Customer Name');
            $('#customer-address').text('Customer Address');
            this.actual_customer = '';
        }
    }

    populate_address_fields() {
        const $billingFrom = this.$content.find('#billing-from');

        $billingFrom.empty().append('<option value="">Select Address</option>');

        this.company_addresses.forEach((address) => {
            $billingFrom.append(`<option value="${address.name}">${address.name}</option>`);
        });
    }

    populate_warehouse_fields() {
        const $shipmentFrom = this.$content.find('#shipment-from');

        $shipmentFrom.empty().append('<option value="">Select Warehouse</option>');

        this.warehouses.forEach((warehouse) => {
            $shipmentFrom.append(`<option value="${warehouse.name}">${warehouse.warehouse_name}</option>`);
        });
    }

    search_ref_codes() {
        const input = this.$content.find('#customer-ref-code').val().toLowerCase();
        const $suggestions = this.$content.find('#ref-code-suggestions');
        
        if (input.length < 2) {
            $suggestions.hide();
            return;
        }

        // Filter product codes that match the input (from active sales orders)
        const matches = Object.keys(this.sales_orders || {}).filter(item_code => 
            item_code.toLowerCase().includes(input)
        ).slice(0, 10); // Limit to 10 suggestions

        if (matches.length > 0) {
            const suggestionHtml = matches.map(item_code => 
                `<a class="dropdown-item ref-code-option" href="#" data-item-code="${item_code}">
                    <strong>${item_code}</strong>
                </a>`
            ).join('');
            
            $suggestions.html(suggestionHtml).show();
            
            // Bind click events for suggestions
            $suggestions.find('.ref-code-option').on('mousedown', (e) => {
                e.preventDefault();
                const itemCode = $(e.target).closest('.ref-code-option').data('item-code');
                this.select_ref_code(itemCode);
            });
        } else {
            $suggestions.hide();
        }
    }

    select_ref_code(itemCode) {
        // Set the code in the input
        this.$content.find('#customer-ref-code').val(itemCode);
        
        // Set the product in the dropdown
        const $productSelect = this.$content.find('#product');
        $productSelect.val(itemCode);
        
        // Manually trigger the sales order population
        this.populate_sales_order();
        
        // Hide suggestions
        this.$content.find('#ref-code-suggestions').hide();
        
        // Show success message
        frappe.show_alert({
            message: `Selected: ${itemCode}`,
            indicator: 'green'
        });
    }

    handle_ref_code_keydown(e) {
        const $suggestions = this.$content.find('#ref-code-suggestions');
        const $options = $suggestions.find('.ref-code-option');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const $current = $options.filter('.active');
            const $next = $current.length ? $current.removeClass('active').next() : $options.first();
            if ($next.length) $next.addClass('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const $current = $options.filter('.active');
            const $prev = $current.length ? $current.removeClass('active').prev() : $options.last();
            if ($prev.length) $prev.addClass('active');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const $active = $options.filter('.active');
            if ($active.length) {
                const itemCode = $active.data('itemCode'); // Fixed data attribute access
                this.select_ref_code(itemCode);
            }
        } else if (e.key === 'Escape') {
            $suggestions.hide();
        }
    }

    hide_ref_code_suggestions() {
        // Delay hiding to allow click events to fire
        setTimeout(() => {
            this.$content.find('#ref-code-suggestions').hide();
        }, 200);
    }

    add_entry() {
        const selectedSalesOrder = this.$content.find('#sales-order').val();
        const soDetails = this.so_details_map && this.so_details_map[selectedSalesOrder] || {};

        const entry = {
            date: this.$content.find('#entry-date').val(),
            invoice_series: this.$content.find('#invoice-series').val(),
            billing_from: this.$content.find('#billing-from').val(),
            customer_ref_code: this.$content.find('#customer-ref-code').val(),
            product: this.$content.find('#product').val(),
            billed_qty: this.$content.find('#billed-qty').val(),
            packaging_type: this.$content.find('#packaging-type').val(),
            packages: this.$content.find('#packages').val(),
            asn_no: this.$content.find('#asn-no').val(),
            shipment_from: this.$content.find('#shipment-from').val(),
            vehicle_no: this.$content.find('#vehicle-no').val(),
            driver_name: this.get_driver_name(),
            sales_order: selectedSalesOrder,
            customer: this.actual_customer || this.$content.find('#customer-name').text(),
            po_no: soDetails.po_no || '',
            po_date: soDetails.po_date || ''
        };

        const duplicateExists = this.entries.some(existingEntry => 
            existingEntry.customer === entry.customer &&
            existingEntry.product === entry.product
        );

        if (duplicateExists) {
            frappe.throw(__('This customer-product combination already exists in the table'));
            return;
        }

        if (this.validate_entry(entry)) {
            this.entries.push(entry);
            this.entries_table.refresh(this.entries);

            // Capturing current values before clearing the form
            const invoiceSeriesValue = this.$content.find('#invoice-series').val();
            const billingFromValue = this.$content.find('#billing-from').val();
            const shipmentFromValue = this.$content.find('#shipment-from').val();
            const vehicleNoValue = this.$content.find('#vehicle-no').val();
            const driverNameValue = this.$content.find('#driver-name').val();
            const dateValue = this.$content.find('#entry-date').val();
            
            this.clear_form_fields();

            // Reassigning the captured values
            this.$content.find('#invoice-series').val(invoiceSeriesValue);
            this.$content.find('#billing-from').val(billingFromValue);
            this.$content.find('#shipment-from').val(shipmentFromValue);
            this.$content.find('#vehicle-no').val(vehicleNoValue);
            this.$content.find('#driver-name').val(driverNameValue);
            this.$content.find('#entry-date').val(dateValue);

            this.update_entries_count();
        }
    }

    validate_entry(entry) {
        const required_fields = ['invoice_series', 'billing_from', 'product', 'billed_qty', 'customer', 'sales_order', 'packaging_type', 'packages', 'asn_no', 'shipment_from', 'vehicle_no', 'driver_name'];
        for (let field of required_fields) {
            if (!entry[field]) {
                frappe.throw(__(`${this.title_case(field.replace('_', ' '))} is required`));
                return false;
            }
        }
        return true;
    }

    clear_form_fields() {
        const fields_to_clear = this.$content.find('.bulk-entry-form').find('input, select').filter(function() {
            return ['invoice-series', 'billing-from', 'shipment-from', 'vehicle-no', 'driver-name', 'entry-date'].indexOf(this.id) === -1;
        });

        fields_to_clear.each(function() {
            if (this.tagName === 'SELECT') {
                $(this).val('');
            } else if (this.tagName === 'INPUT') {
                $(this).val('');
            }
        });

        $('#customer-name').text('Customer Name');
        $('#customer-address').text('Customer Address');
        this.$content.find('#ref-code-suggestions').hide();
        this.populate_product();
        this.populate_sales_order();
        this.populate_address_fields();
        this.populate_warehouse_fields();
    }

    update_entries_count() {
        this.page.set_indicator(`${this.entries.length} Entries`, 'blue');
    }

    create_batch() {
        if (!this.entries.length) {
            frappe.throw(__('Please add at least one entry'));
            return;
        }

        frappe.call({
            method: 'alphaspp.alphaspp.page.bulk_invoice_entry.bulk_invoice_entry.create_bulk_invoice_batch',
            args: {
                entries: this.entries
            },
            callback: (r) => {
                if (r.message) {
                    const result = r.message;
                    
                    let message = '';
                    let indicator = 'green';
                    
                    if (result.failed > 0) {
                        message = `Batch completed: ${result.successful} successful, ${result.failed} failed. Check log ${result.log_id} for details.`;
                        indicator = result.successful > 0 ? 'orange' : 'red';
                    } else {
                        message = `Batch created successfully! ${result.successful} invoices created. Log: ${result.log_id}`;
                    }
                    
                    frappe.show_alert({
                        message: message,
                        indicator: indicator
                    });
                    
                    // Show detailed results in modal
                    this.show_batch_results(result);
                    
                    this.entries = [];
                    this.entries_table.refresh(this.entries);
                    this.update_entries_count();
                }
            }
        });
    }

    show_batch_results(result) {
        const d = new frappe.ui.Dialog({
            title: 'Batch Creation Results',
            fields: [
                {
                    fieldtype: 'HTML',
                    options: `
                        <div class="batch-results">
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="card text-center">
                                        <div class="card-body">
                                            <h3 class="text-success">${result.successful}</h3>
                                            <p>Successful</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card text-center">
                                        <div class="card-body">
                                            <h3 class="text-danger">${result.failed}</h3>
                                            <p>Failed</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card text-center">
                                        <div class="card-body">
                                            <h3 class="text-info">${result.total}</h3>
                                            <p>Total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-3">
                                <p><strong>Log ID:</strong> <a href="/app/bulk-invoice-creation-log/${result.log_id}" target="_blank">${result.log_id}</a></p>
                                ${result.invoices.length > 0 ? `
                                <div class="mt-2">
                                    <strong>Created Invoices:</strong>
                                    <ul>
                                        ${result.invoices.map(inv => `<li><a href="/app/sales-invoice/${inv}" target="_blank">${inv}</a></li>`).join('')}
                                    </ul>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `
                }
            ],
            primary_action_label: 'View Log',
            primary_action: () => {
                frappe.set_route('Form', 'Bulk Invoice Creation Log', result.log_id);
                d.hide();
            }
        });
        d.show();
    }

    title_case(str) {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    get_driver_name() {
        const driver_field = this.$content.find('#driver-name');
        if (driver_field.is('select')) {
            // If it's a select field, get the full name from data attribute
            return driver_field.find('option:selected').data('full-name') || driver_field.val();
        } else {
            // If it's a text input (fallback), get the value directly
            return driver_field.val();
        }
    }
};
