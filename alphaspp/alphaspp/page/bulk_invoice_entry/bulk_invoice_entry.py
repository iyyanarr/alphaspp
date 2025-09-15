import frappe
from frappe import _

@frappe.whitelist()
def get_company_addresses():
    """Fetch all company addresses marked as billing address"""
    try:
        addresses = frappe.get_all(
            'Address',
            filters={
                'is_your_company_address': 1,
                'disabled': 0
            },
            fields=['name', 'address_title', 'address_line1', 'city', 'country']
        )
        return addresses
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch company addresses'))
        return []

@frappe.whitelist()
def get_address_details(address_name):
    """Fetch complete address details for selected billing unit"""
    try:
        address = frappe.get_doc('Address', address_name)
        return {
            'address_title': address.address_title,
            'address_line1': address.address_line1,
            'address_line2': address.address_line2,
            'city': address.city,
            'state': address.state,
            'country': address.country,
            'pincode': address.pincode,
            'gstin': address.gstin
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch address details'))
        return {}

@frappe.whitelist()
def get_pending_delivery_items(doctype, txt, searchfield, start, page_len, filters):
    conditions = """
        WHERE so.docstatus = 1 
        AND so.status in ('To Deliver and Bill', 'To Deliver')
        AND soi.delivered_qty < soi.qty
    """
    
    if txt:
        conditions += """ AND (soi.item_code LIKE %(txt)s 
                        OR soi.item_name LIKE %(txt)s
                        OR so.name LIKE %(txt)s)"""
    
    query = """
        SELECT 
            soi.item_code as value,
            CONCAT(soi.item_code, ' - ', soi.item_name, ' (SO: ', so.name, ')') as label,
            so.name as sales_order,
            so.customer,
            (soi.qty - soi.delivered_qty) as qty
        FROM 
            `tabSales Order Item` soi
        INNER JOIN 
            `tabSales Order` so ON so.name = soi.parent
        {conditions}
        ORDER BY so.creation DESC
        LIMIT %(start)s, %(page_len)s
    """.format(conditions=conditions)
    
    return frappe.db.sql(
        query,
        {
            'txt': f"%{txt}%",
            'start': start,
            'page_len': page_len
        },
        as_dict=1
    )

@frappe.whitelist()
def create_bulk_invoice_batch(entries):
    entries = frappe.parse_json(entries)  # Parse the entries if they come as JSON

    if not entries:
        frappe.throw(_('No entries found to create Sales Invoices.'))

    invoices = []
    successful_invoices = []
    failed_invoices = []

    for entry in entries:
        billing_from = entry.get('billing_from')
        product = entry.get('product')
        billed_qty = entry.get('billed_qty')
        customer = entry.get('customer')
        date = entry.get('date')
        packaging_type = entry.get('packaging_type')
        packages = entry.get('packages')
        asn_no = entry.get('asn_no')
        shipment_from = entry.get('shipment_from')
        sales_order = entry.get('sales_order')
        vehicle_no = entry.get('vehicle_no')
        driver_name = entry.get('driver_name')
        invoice_series = entry.get('invoice_series')
        po_no = entry.get('po_no')
        po_date = entry.get('po_date')
        c_customer_ref_code = entry.get('customer_ref_code')

        if not (billing_from and product and billed_qty and customer and date and invoice_series):
            frappe.throw(_('Some mandatory fields are missing in the entry.'))

        # Use the selected invoice series from the frontend
        naming_series = invoice_series

        # Get item rate from sales order based on custom_customer_ref_code
        item_rate = None
        if c_customer_ref_code and sales_order:
            item_rate = frappe.db.get_value(
                'Sales Order Item',
                {
                    'parent': sales_order,
                    'custom_customer_ref_code': c_customer_ref_code
                },
                'rate'
            )
        
        # If rate not found with customer ref code, fallback to item_code match
        if not item_rate and sales_order:
            item_rate = frappe.db.get_value(
                'Sales Order Item',
                {
                    'parent': sales_order,
                    'item_code': product
                },
                'rate'
            )
        
        # If still not found, get from Item master
        if not item_rate:
            item_rate = frappe.db.get_value('Item', product, 'standard_rate') or 0

        try:
            # Prepare terms content with packaging details
            terms_content = f"Packaging Type: {packaging_type}<br><br>Packages: {packages}<br><br>ASN No: {asn_no}"
            
            # Get appropriate tax template
            # First try to get from sales order
            taxes_and_charges = None
            if sales_order:
                taxes_and_charges = frappe.db.get_value('Sales Order', sales_order, 'taxes_and_charges')
            
            # If not found, try to get from customer's default
            if not taxes_and_charges:
                customer_tax_category = frappe.db.get_value('Customer', customer, 'tax_category')
                if customer_tax_category:
                    # Try to find a matching tax template for this category
                    tax_templates = frappe.get_all(
                        'Sales Taxes and Charges Template',
                        filters={
                            'tax_category': customer_tax_category,
                            'disabled': 0
                        },
                        fields=['name']
                    )
                    if tax_templates:
                        taxes_and_charges = tax_templates[0].name
            
            # If still not found, get company default
            if not taxes_and_charges:
                taxes_and_charges = frappe.db.get_value(
                    'Company', 
                    frappe.db.get_value('Warehouse', shipment_from, 'company') if shipment_from else None,
                    'default_selling_taxes_and_charges'
                )
            
            # Create invoice document
            invoice_doc = {
                'doctype': 'Sales Invoice',
                'status': 'Draft',
                'customer': customer,
                'posting_date': date,
                'company_address': billing_from,
                'naming_series': naming_series,
                'po_no': po_no,
                'po_date': po_date,
                'terms': terms_content,
                'e_waybill_status': 'Pending',
                'vehicle_no': vehicle_no,
                'driver': driver_name,  # Driver field for Sales Invoice
                'driver_name': driver_name,  # Driver name field for Sales Invoice
                'items': [{
                    'item_code': product,
                    'custom_customer_ref_code': c_customer_ref_code,
                    'qty': billed_qty,
                    'rate': item_rate,
                    'sales_order': sales_order,
                    'warehouse': shipment_from
                }],
                'remarks': f'Packaging Type: {packaging_type}, Packages: {packages}, ASN No: {asn_no}, Shipment From: {shipment_from}, Vehicle No: {vehicle_no}, Driver Name: {driver_name}'
            }
            
            # Add taxes and charges if found
            if taxes_and_charges:
                invoice_doc['taxes_and_charges'] = taxes_and_charges
                
                # Get tax template details and add to taxes table
                tax_template = frappe.get_doc('Sales Taxes and Charges Template', taxes_and_charges)
                if tax_template and tax_template.taxes:
                    invoice_doc['taxes'] = []
                    for tax in tax_template.taxes:
                        invoice_doc['taxes'].append({
                            'charge_type': tax.charge_type,
                            'account_head': tax.account_head,
                            'description': tax.description,
                            'rate': tax.rate,
                            'included_in_print_rate': tax.included_in_print_rate,
                            'cost_center': tax.cost_center
                        })

            invoice = frappe.get_doc(invoice_doc)
            invoice.insert()
            invoices.append(invoice.name)
            
            # Add successful invoice to tracking
            invoice_amount = float(billed_qty) * float(item_rate)
            successful_invoices.append({
                'invoice_no': invoice.name,
                'customer': customer,
                'sales_order': sales_order,
                'product': product,
                'quantity': billed_qty,
                'rate': item_rate,
                'invoice_amount': invoice_amount,
                'status': 'Success',
                'billing_from': billing_from,
                'shipment_from': shipment_from,
                'packaging_type': packaging_type,
                'packages': packages,
                'asn_no': asn_no,
                'vehicle_no': vehicle_no,
                'driver_name': driver_name,
                'invoice_series': invoice_series,
                'po_no': po_no,
                'po_date': po_date
            })
            
        except Exception as e:
            # Add failed invoice to tracking
            failed_invoices.append({
                'invoice_no': '',
                'customer': customer,
                'sales_order': sales_order,
                'product': product,
                'quantity': billed_qty,
                'rate': item_rate or 0,
                'invoice_amount': 0,
                'status': 'Failed',
                'billing_from': billing_from,
                'shipment_from': shipment_from,
                'packaging_type': packaging_type,
                'packages': packages,
                'asn_no': asn_no,
                'vehicle_no': vehicle_no,
                'driver_name': driver_name,
                'invoice_series': invoice_series,
                'po_no': po_no,
                'po_date': po_date,
                'error_message': str(e)
            })
            frappe.log_error(frappe.get_traceback(), f'Bulk Invoice Creation Error - {product}')

    # Create tracking log after processing all entries
    all_invoice_details = successful_invoices + failed_invoices
    
    # Ensure we have at least one entry
    if not all_invoice_details:
        frappe.throw(_('No invoice details to log'))
    
    # Determine status
    if len(failed_invoices) == 0:
        status = 'Completed'
        remarks = f'Successfully created {len(successful_invoices)} invoices'
    elif len(successful_invoices) == 0:
        status = 'Failed'
        remarks = f'Failed to create all {len(failed_invoices)} invoices'
    else:
        status = 'Partially Completed'
        remarks = f'Created {len(successful_invoices)} invoices, {len(failed_invoices)} failed'

    log_doc = frappe.get_doc({
        'doctype': 'Bulk Invoice Creation Log',
        'created_by': frappe.session.user,
        'creation_date': frappe.utils.now(),
        'total_invoices': len(successful_invoices),
        'status': status,
        'remarks': remarks,
        'invoice_details': all_invoice_details
    })
    
    log_doc.insert()

    # Return results
    return {
        'invoices': invoices,
        'log_id': log_doc.name,
        'successful': len(successful_invoices),
        'failed': len(failed_invoices),
        'total': len(entries)
    }
@frappe.whitelist()
def fetch_sales_orders_and_products():
    print('getting*****************')
    sales_orders = frappe.get_all('Sales Order', filters={'status': ['in', ['To Bill', 'To Bill and Deliver']]}, fields=['name'])
    product_sales_orders = {}

    for so in sales_orders:
        items = frappe.get_all('Sales Order Item', filters={'parent': so.name}, fields=['item_code', 'item_name'])
        for item in items:
            if item.item_code not in product_sales_orders:
                product_sales_orders[item.item_code] = []
            product_sales_orders[item.item_code].append(so.name)

    return product_sales_orders

@frappe.whitelist()
def get_customer_info(sales_order):
    so = frappe.get_doc('Sales Order', sales_order)
    customer = frappe.get_doc('Customer', so.customer)
    return {'name': customer.customer_name, 'address': customer.address_display or 'No address available'}  # Ensure address field is appropriately fetched.
