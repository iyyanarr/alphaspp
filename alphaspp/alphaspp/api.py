import frappe
from frappe import _
from frappe.utils import cstr


@frappe.whitelist()
def get_customer_info(sales_order):
    so = frappe.get_doc('Sales Order', sales_order)
    customer = frappe.get_doc('Customer', so.customer)
    return { customer    }  # Ensure address field is appropriately fetched.


@frappe.whitelist()
def fetch_sales_orders_and_products():
    print('getting*****************')
    # Get all sales orders that are submitted and not completed/closed
    sales_orders = frappe.get_all(
        'Sales Order', 
        filters={
            'docstatus': 1,
            'status': ['in', ['To Deliver and Bill', 'To Bill', 'To Deliver', 'Draft']]
        }, 
        fields=['name', 'status', 'po_no', 'po_date']
    )
    print('Found sales orders:', sales_orders)
    product_sales_orders = {}

    for so in sales_orders:
        items = frappe.get_all('Sales Order Item', filters={'parent': so.name}, fields=['item_code', 'item_name'])
        print(f'Items for SO {so.name}:', items)
        for item in items:
            if item.item_code not in product_sales_orders:
                product_sales_orders[item.item_code] = []
            
            # Add sales order details including po_no and po_date
            so_details = {
                'name': so.name,
                'status': so.status,
                'po_no': so.po_no,
                'po_date': so.po_date
            }
            product_sales_orders[item.item_code].append(so_details)

    print('Final product_sales_orders mapping:', product_sales_orders)
    return product_sales_orders

@frappe.whitelist()
def get_linked_contacts(customer_name):
    # Fetch linked contacts through the Dynamic Link
    linked_contacts = frappe.get_all(
        'Dynamic Link',
        filters={
            'link_doctype': 'Customer',
            'link_name': customer_name
        },
        fields=['parent']
    )
    
    # Return the contact names
    return [contact.parent for contact in linked_contacts]


@frappe.whitelist()
def get_items_by_customer(customer_name=None):
    """
    Custom API to get items that have specific customer in customer_items child table
    Usage: /api/method/custom_api.api.get_items_by_customer?customer_name=Customer+Name
    """
    try:
        if not customer_name:
            frappe.throw(_("Customer name is required"))

        # Sanitize the customer name
        customer_name = cstr(customer_name)

        # SQL query to fetch items with the specified customer in customer_items
        items = frappe.db.sql("""
  
                SELECT parent 
                FROM `tabItem Customer Detail`
                WHERE customer_name = %s
  
        """, (customer_name,), as_dict=1)

        if not items:
            return {
                'success': True,
                'message': 'No items found for the specified customer',
                'data': []
            }

        # Format the response
        formatted_items = []
        for item in items:
            print("items check",item.parent)
            item_doc = frappe.get_doc('Item', item.parent)
            print("items check doc",item_doc)
            formatted_items.append({
                'item_code': item_doc.item_code,
                'item_name': item_doc.item_name,
                'description': item_doc.description,
                'stock_uom': item_doc.stock_uom,

            })

        return {
            'success': True,
            'message': 'Items retrieved successfully',
            'data': formatted_items
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Item Filter API Error'))
        return {
            'success': False,
            'message': str(e),
            'data': None
        }
        
# alphaspp/alphaspp/api.py
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
            fields=['name']
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
def get_warehouses():
    # Get all store warehouses for F1 and F2
    warehouse_filters = {
        'company': 'Shree Polymer Products',
        'name': ['like', '%Store%']
    }
    
    # Fetch all store warehouses
    all_store_warehouses = frappe.get_all('Warehouse', filters=warehouse_filters, fields=['name', 'warehouse_name'])
    
    # Filter for F1 and F2 store warehouses (excluding Common Store)
    f1_f2_warehouses = []
    for wh in all_store_warehouses:
        if (('F1' in wh.name and 'Store' in wh.name and 'Common' not in wh.name) or 
            ('F2' in wh.name and 'Store' in wh.name)):
            f1_f2_warehouses.append({
                'name': wh.name,
                'warehouse_name': wh.warehouse_name
            })
    
    return f1_f2_warehouses

@frappe.whitelist()
def get_customer_ref_code_mapping():
    """Fetch customer reference code to item code mapping from Item Customer Detail child table"""
    try:
        # Fetch from Item Customer Detail child table - get all records first
        customer_items = frappe.get_all(
            'Item Customer Detail',
            fields=['parent', 'ref_code', 'customer_name']
        )
        
        # Create mapping: {ref_code: item_code} - filter out empty ref_codes
        ref_code_mapping = {}
        for item in customer_items:
            if item.ref_code and item.ref_code.strip():  # Check if ref_code exists and is not empty
                ref_code_mapping[item.ref_code] = item.parent  # parent is the item_code
        
        return ref_code_mapping
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch customer ref code mapping'))
        return {}

@frappe.whitelist()
def get_sales_orders_for_product(product):
    """Get sales orders for a specific product"""
    try:
        # Get sales orders that have this product and are pending billing/delivery
        sales_orders = frappe.db.sql("""
            SELECT DISTINCT so.name, so.status
            FROM `tabSales Order` so
            INNER JOIN `tabSales Order Item` soi ON so.name = soi.parent
            WHERE so.docstatus = 1 
            AND so.status IN ('To Deliver and Bill', 'To Bill', 'To Deliver', 'Draft')
            AND soi.item_code = %(product)s
            ORDER BY so.creation DESC
        """, {'product': product}, as_dict=1)
        
        print(f'Found sales orders for product {product}:', sales_orders)
        return [so.name for so in sales_orders]
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch sales orders for product'))
        return []

@frappe.whitelist()
def get_customer_part_number(item_code, customer):
    """Fetch customer part number/ref code for a specific item and customer"""
    try:
        # Query the Item Customer Detail child table
        customer_detail = frappe.db.get_value(
            'Item Customer Detail',
            {
                'parent': item_code,
                'customer_name': customer
            },
            'ref_code'
        )
        
        return customer_detail if customer_detail else ""
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch customer part number'))
        return ""

@frappe.whitelist()
def get_item_by_customer_part_number(customer_part_number, customer):
    """Fetch item code based on customer part number and customer"""
    try:
        # Query the Item Customer Detail child table
        item_detail = frappe.db.get_value(
            'Item Customer Detail',
            {
                'ref_code': customer_part_number,
                'customer_name': customer
            },
            'parent'
        )
        
        return item_detail if item_detail else ""
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _('Failed to fetch item by customer part number'))
        return ""

@frappe.whitelist()
def get_customer_ref_options(customer):
    """Get all customer reference codes for a specific customer as dropdown options"""
    try:
        # Query Item Customer Detail child table to get all ref codes for the customer
        ref_codes = frappe.db.sql("""
            SELECT DISTINCT 
                icd.ref_code,
                i.item_name,
                i.name as item_code
            FROM `tabItem Customer Detail` icd
            INNER JOIN `tabItem` i ON icd.parent = i.name
            WHERE icd.customer_name = %s
            AND icd.ref_code IS NOT NULL 
            AND icd.ref_code != ''
            ORDER BY icd.ref_code
        """, (customer,), as_dict=True)
        
        return ref_codes
        
    except Exception as e:
        frappe.log_error(f"Error getting customer ref options: {str(e)}")
        return []

@frappe.whitelist()
def get_item_from_customer_ref(customer_ref, customer):
    """Get item details based on customer reference code"""
    try:
        # Query to find the item based on customer ref code
        item_data = frappe.db.sql("""
            SELECT 
                i.name as item_code,
                i.item_name,
                i.item_group,
                icd.ref_code
            FROM `tabItem Customer Detail` icd
            INNER JOIN `tabItem` i ON icd.parent = i.name
            WHERE icd.customer_name = %s
            AND icd.ref_code = %s
            LIMIT 1
        """, (customer, customer_ref), as_dict=True)
        
        if item_data:
            return item_data[0]
        else:
            frappe.msgprint(f"No item found for customer reference: {customer_ref}")
            return None
            
    except Exception as e:
        frappe.log_error(f"Error getting item from customer ref: {str(e)}")
        frappe.throw(f"Error retrieving item: {str(e)}")

@frappe.whitelist()
def get_customer_ref_for_item(item_code, customer):
    """Get customer reference code for a specific item and customer"""
    try:
        # Get item customer details for the specific item and customer
        customer_detail = frappe.db.get_value(
            "Item Customer Detail",
            {
                "parent": item_code,
                "customer_name": customer
            },
            ["ref_code", "parent as item_code"],
            as_dict=True
        )
        
        if customer_detail:
            # Get item name
            item_name = frappe.db.get_value("Item", item_code, "item_name")
            customer_detail["item_name"] = item_name
            return customer_detail
        
        return None
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_ref_for_item: {str(e)}")
        return None

@frappe.whitelist()
def get_bulk_customer_refs(items, customer):
    """Get customer reference codes for multiple items at once"""
    try:
        if not items:
            return {}
            
        # Convert string to list if needed
        if isinstance(items, str):
            import json
            items = json.loads(items)
            
        result = {}
        
        # Get all customer ref codes for the given items in one query
        customer_details = frappe.db.sql("""
            SELECT 
                icd.parent as item_code,
                icd.ref_code
            FROM `tabItem Customer Detail` icd
            WHERE icd.customer_name = %s
            AND icd.parent IN %s
        """, (customer, tuple([item.get('item_code') for item in items if item.get('item_code')])), as_dict=True)
        
        # Create a mapping of item_code to ref_code
        for detail in customer_details:
            result[detail.item_code] = detail.ref_code
            
        return result
        
    except Exception as e:
        frappe.log_error(f"Error in get_bulk_customer_refs: {str(e)}")
        return {}

@frappe.whitelist()
def get_customer_ref_for_items(item_codes, customer):
    """Get customer reference codes for multiple items at once for a specific customer"""
    try:
        if not item_codes or not customer:
            return {}
        
        # Convert string to list if needed
        if isinstance(item_codes, str):
            import json
            item_codes = json.loads(item_codes)
        
        # Get all item customer details for the items and customer
        customer_details = frappe.db.sql("""
            SELECT 
                parent as item_code,
                ref_code
            FROM `tabItem Customer Detail`
            WHERE parent IN %(item_codes)s
            AND customer_name = %(customer)s
            AND ref_code IS NOT NULL
            AND ref_code != ''
        """, {
            "item_codes": item_codes,
            "customer": customer
        }, as_dict=True)
        
        # Convert to dictionary for easy lookup
        result = {}
        for detail in customer_details:
            result[detail.item_code] = detail.ref_code
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_ref_for_items: {str(e)}")
        return {}