frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        // Test if refresh hook is working
        console.log('Sales Order refresh hook is working!');
        frappe.show_alert({
            message: 'Sales Order form refreshed successfully!',
            indicator: 'green'
        });
    },
    
    onload: function(frm) {
        // Test if onload hook is working
        console.log('Sales Order onload hook is working!');
        frappe.show_alert({
            message: 'Sales Order form loaded!',
            indicator: 'green'
        });
    }
});

frappe.ui.form.on('Sales Order Item', {
    // When item_code changes, populate custom_customer_ref_code options for that specific item
    item_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        console.log('Sales Order Item - item_code changed!', row.item_code);
        
        if (row.item_code && frm.doc.customer) {
            // Use our new custom API function to get customer ref codes for specific item
            frappe.call({
                method: 'alphaspp.alphaspp.api.get_customer_ref_codes_for_item',
                args: {
                    item_code: row.item_code,
                    customer: frm.doc.customer
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        console.log('Customer ref codes for item ' + row.item_code + ':', r.message);
                        
                        let ref_codes = r.message; // API already returns filtered array of ref codes
                        console.log('Ref codes for select field:', ref_codes);
                        
                        // Set the options for the custom_customer_ref_code field
                        frm.fields_dict.items.grid.update_docfield_property(
                            'custom_customer_ref_code', 
                            'options', 
                            ref_codes.join('\n')
                        );
                        
                        // Auto-select the first ref code if only one exists
                        if (ref_codes.length === 1) {
                            frappe.model.set_value(cdt, cdn, 'custom_customer_ref_code', ref_codes[0]);
                            frappe.show_alert({
                                message: `Customer ref code '${ref_codes[0]}' set for item ${row.item_code}`,
                                indicator: 'green'
                            });
                        } else {
                            // Clear the field if multiple options exist so user can choose
                            frappe.model.set_value(cdt, cdn, 'custom_customer_ref_code', '');
                            frappe.show_alert({
                                message: `${ref_codes.length} reference codes available for item ${row.item_code}`,
                                indicator: 'blue'
                            });
                        }
                        
                        // Refresh the field to show updated options
                        frm.refresh_field('items');
                        
                    } else {
                        console.log('No customer ref codes found for this item-customer combination');
                        // Clear options if no ref codes found
                        frm.fields_dict.items.grid.update_docfield_property(
                            'custom_customer_ref_code', 
                            'options', 
                            ''
                        );
                        frappe.model.set_value(cdt, cdn, 'custom_customer_ref_code', '');
                        frappe.show_alert({
                            message: `No customer reference codes found for item ${row.item_code}`,
                            indicator: 'orange'
                        });
                        frm.refresh_field('items');
                    }
                },
                error: function(r) {
                    console.error('Error fetching customer ref codes for item:', r);
                }
            });
        } else if (row.item_code && !frm.doc.customer) {
            // Clear ref code and options if no customer selected
            frm.fields_dict.items.grid.update_docfield_property(
                'custom_customer_ref_code', 
                'options', 
                ''
            );
            frappe.model.set_value(cdt, cdn, 'custom_customer_ref_code', '');
            frm.refresh_field('items');
            
            frappe.show_alert({
                message: 'Please select a customer first to see reference codes',
                indicator: 'orange'
            });
        }
    },
    
    qty: function(frm, cdt, cdn) {
        console.log('Sales Order Item - quantity changed!');
        frappe.show_alert({
            message: 'Quantity changed in Sales Order Item',
            indicator: 'orange'
        });
    }
});
