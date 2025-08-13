frappe.ui.form.on('Sales Order Item', {
    custom_customer_ref_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row && row.custom_customer_ref_code && frm.doc.customer) {
            // Call server to get item details based on customer ref code
            frappe.call({
                method: 'alphaspp.alphaspp.api.get_item_from_customer_ref',
                args: {
                    customer_ref: row.custom_customer_ref_code,
                    customer: frm.doc.customer
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'item_code', r.message.item_code);
                        // Trigger item_code change to load all related data
                        frm.script_manager.trigger('item_code', cdt, cdn);
                    } else {
                        frappe.msgprint(__("No item found for the selected customer ref code"));
                    }
                }
            });
        }
    },
    
    item_code: function(frm, cdt, cdn) {
        // When item_code changes, update the customer ref code based on customer
        let row = locals[cdt][cdn];
        if (row && row.item_code && frm.doc.customer) {
            frappe.call({
                method: 'alphaspp.alphaspp.api.get_customer_ref_for_item',
                args: {
                    item_code: row.item_code,
                    customer: frm.doc.customer
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'custom_customer_ref_code', r.message.ref_code);
                    }
                }
            });
        }
    }
});

frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        // Load customer ref codes for existing items when the form is refreshed/loaded
        if(frm.doc.customer && frm.doc.items && frm.doc.items.length > 0) {
            // Filter items that have an item_code but no custom_customer_ref_code
            const itemsToUpdate = frm.doc.items.filter(item => item.item_code && !item.custom_customer_ref_code);
            
            if(itemsToUpdate.length > 0) {
                // Use bulk fetch for better performance
                frappe.call({
                    method: 'alphaspp.alphaspp.api.get_bulk_customer_refs',
                    args: {
                        items: itemsToUpdate,
                        customer: frm.doc.customer
                    },
                    callback: function(r) {
                        if (r.message) {
                            // Update each item with the corresponding ref code
                            itemsToUpdate.forEach(item => {
                                const refCode = r.message[item.item_code];
                                if (refCode) {
                                    frappe.model.set_value('Sales Order Item', item.name, 'custom_customer_ref_code', refCode);
                                }
                            });
                            frm.refresh_field('items');
                        }
                    }
                });
            }
        }
    },
    
    onload_post_render: function(frm) {
        // This ensures the customer ref codes are loaded when the form is initially loaded
        if(frm.doc.customer && frm.doc.items && frm.doc.items.length > 0) {
            // Use the same logic as refresh
            frm.trigger('refresh');
        }
    },
    
    customer: function(frm) {
        // Clear customer ref codes when customer changes
        if (frm.doc.items) {
            frm.doc.items.forEach(function(item) {
                frappe.model.set_value('Sales Order Item', item.name, 'custom_customer_ref_code', '');
            });
        }
        // Refresh the grid to update options
        frm.refresh_field('items');
    }
});
