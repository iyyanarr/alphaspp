frappe.ui.form.on('Weekly Schedule Report Entry', {
    setup: function(frm) {
        // Set query filters for schedule
        frm.set_query('schedule', function() {
            return {
                filters: {
                    'docstatus': 0
                }
            };
        });
    },

    refresh: function(frm) {
        if (!frm.doc.schedule || !frm.doc.week) {
            frm.set_value('week_start_date', '');
            frm.set_value('week_end_date', '');
        }
        frm.get_field('week_schedule_items').grid.refresh();
        applyRowStyles(frm);
    },

    schedule: function(frm) {
        console.log("Schedule function triggered");
        // Clear existing data
        frm.clear_table('week_schedule_items');
        frm.refresh_field('week_schedule_items');
        frm.set_value('week', '');
        frm.set_value('week_start_date', '');
        frm.set_value('week_end_date', '');

        if (!frm.doc.schedule) {
            console.log("Schedule field is empty");
            return;
        }

        // Fetch schedule details
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Monthly Schedule',
                name: frm.doc.schedule
            },
            callback: function(res) {
                console.log("Fetched Monthly Schedule:", res.message);
                if (res.message) {
                    const monthlySchedule = res.message;
                    if (monthlySchedule.week_table && monthlySchedule.week_table.length) {
                        const weekOptions = monthlySchedule.week_table.map(week => week.week_id);
                        frm.set_df_property('week', 'options', weekOptions.join('\n'));
                        
                        frappe.show_alert({
                            message: __('Schedule loaded successfully'),
                            indicator: 'green'
                        });
                    } else {
                        frappe.show_alert({
                            message: __('No weeks found in the selected schedule'),
                            indicator: 'red'
                        });
                    }
                }
            }
        });
    },

    week: function(frm) {
        if (!frm.doc.schedule || !frm.doc.week) {
            console.log("Schedule or week field is empty");
            return;
        }

        console.log("Selected week", frm.doc.week);
        fetchScheduleAndDispatchItems(frm, frm.doc.week);
    },

    validate: function(frm) {
        if (!frm.doc.week_schedule_items || frm.doc.week_schedule_items.length === 0) {
            frappe.throw(__('Please load schedule items before saving.'));
        }
    }
    
});

frappe.ui.form.on("Weekly Schedule Item", {
    enter_reason: function(frm, dt, dn) {
        let row = locals[dt][dn];
        console.log("Enter Reason", row);
        openReasonDialog(frm, row);
    }
});


function applyRowStyles(frm) {
    frm.fields_dict["week_schedule_items"].$wrapper.find('.grid-body .rows').find(".grid-row").each(function(i, item) {
        let d = locals[frm.fields_dict["week_schedule_items"].grid.doctype][$(item).attr('data-name')];
        
        // Apply styles to 'achvd' field
        let achvdField = $(item).find('.grid-static-col[data-fieldname="achvd"]');
        if (d["achvd"] > 0) {
            achvdField.css({'background-color': 'green'});
        } else if (d["achvd"] < 0) {
            achvdField.css({'background-color': 'red'});
        } else {
            achvdField.css({'background-color': 'yellow'});
        }

        // Apply styles to 'defct' field
        let defctField = $(item).find('.grid-static-col[data-fieldname="defct"]');
        if (d["defct"] > 0) {
            defctField.css({'background-color': 'green'});
        } else if (d["defct"] < 0) {
            defctField.css({'background-color': 'red'});
        } else {
            defctField.css({'background-color': 'yellow'});
        }

        // Apply styles to 'excess' field
        let excessField = $(item).find('.grid-static-col[data-fieldname="excess"]');
        if (d["excess"] > 0) {
            excessField.css({'background-color': '#ACE1AF'});
        } else if (d["excess"] < 0) {
            excessField.css({'background-color': 'red'});
        } else {
            excessField.css({'background-color': 'yellow'});
        }
    });
}

function fetchScheduleAndDispatchItems(frm, selectedWeek) {
    console.log("Fetching schedule items for week:", selectedWeek);
    
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Monthly Schedule',
            name: frm.doc.schedule
        },
        callback: function(res) {
            if (res.message) {
                const monthlySchedule = res.message;
                const selectedWeekData = monthlySchedule.week_table.find(
                    week => week.week_id === selectedWeek
                );

                if (selectedWeekData) {
                    // Update form dates
                    frm.set_value('week_start_date', selectedWeekData.start_date);
                    frm.set_value('week_end_date', selectedWeekData.end_date);

                    // Fetch dispatch items with the date range
                    fetchDispatchItems(frm, selectedWeekData.start_date, selectedWeekData.end_date, monthlySchedule);
                } else {
                    frappe.msgprint(__('Selected week data not found.'));
                }
            }
        }
    });
}

function fetchDispatchItems(frm, start_date, end_date, monthlySchedule) {
    console.log("Fetching dispatch items for date range:", start_date, end_date);
    
    frappe.show_alert({
        message: __('Fetching dispatch items...'),
        indicator: 'blue'
    });

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Sales Invoice Item',
            filters: [
                ['Sales Invoice Item', 'docstatus', '=', '1'],
                ['Sales Invoice Item', 'modified', '>', start_date],
                ['Sales Invoice Item', 'modified', '<', end_date]
            ],
            fields: [
                'name',
                'parent',
                'item_code',
                'qty'
            ],
            parent: 'Sales Invoice',
            limit_page_length: 1000
        },
        callback: function(response) {
            if (response.message && response.message.length > 0) {
                // Fetch parent Sales Invoices to get customer information
                const parentInvoices = [...new Set(response.message.map(item => item.parent))];
                
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Sales Invoice',
                        filters: [
                            ['name', 'in', parentInvoices]
                        ],
                        fields: [
                            'name',
                            'customer'
                        ]
                    },
                    callback: function(invoiceResponse) {
                        if (invoiceResponse.message) {
                            // Create a map of invoice to customer
                            const customerMap = {};
                            invoiceResponse.message.forEach(invoice => {
                                customerMap[invoice.name] = invoice.customer;
                            });

                            // Add customer information to each item
                            const dispatchItems = response.message.map(item => ({
                                ...item,
                                customer: customerMap[item.parent] || ''
                            }));

                            console.log("Processed dispatch data:", dispatchItems);
                            processDispatchItems(frm, dispatchItems, monthlySchedule);
                        }
                    }
                });
            } else {
                console.log("No dispatch items found");
                processDispatchItems(frm, [], monthlySchedule);
            }
        }
    });
}

function processDispatchItems(frm, dispatchItems, monthlySchedule) {
    try {
        // Create a map to store totals by item_code and customer
        const dispatchTotals = {};
        
        // Process dispatch items and create totals
        dispatchItems.forEach(item => {
            const key = `${item.item_code}_${item.customer}`;
            if (!dispatchTotals[key]) {
                dispatchTotals[key] = {
                    item_code: item.item_code,
                    customer: item.customer,
                    total_qty: 0
                };
            }
            dispatchTotals[key].total_qty += parseFloat(item.qty || 0);
        });

        // Clear existing items
        frm.clear_table('week_schedule_items');

        // Get selected week data
        const selectedWeekData = monthlySchedule.week_table.find(
            week => week.week_id === frm.doc.week
        );

        // Track processed items
        const processedItems = new Set();

        // First, process items from the schedule
        if (monthlySchedule.schedule_item) {
            monthlySchedule.schedule_item.forEach((scheduleItem) => {
                const key = `${scheduleItem.part_no}_${scheduleItem.customer}`;
                processedItems.add(key);

                let row = frm.add_child('week_schedule_items');
                row.customer = scheduleItem.customer;
                row.part_no = scheduleItem.part_no;
                row.spp_ref = scheduleItem.spp_ref;
                
                // Set target from schedule
                row.target = selectedWeekData ? 
                    scheduleItem[`week_${selectedWeekData.idx}_w${selectedWeekData.idx}`] || 0 : 0;
                
                // Set achieved quantity from dispatch data if exists
                const dispatchData = dispatchTotals[key];
                row.achvd = dispatchData ? dispatchData.total_qty : 0;
                
                // Calculate defct and excess
                row.defct = row.achvd - row.target;
                row.excess = Math.max(row.defct, 0); // If positive deviation, it's excess
            });
        }

        // Add items from dispatch that weren't in schedule
        Object.values(dispatchTotals).forEach(dispatchItem => {
            const key = `${dispatchItem.item_code}_${dispatchItem.customer}`;
            if (!processedItems.has(key)) {
                let row = frm.add_child('week_schedule_items');
                row.customer = dispatchItem.customer;
                row.part_no = dispatchItem.item_code;
                row.target = 0; // No target as it wasn't in schedule
                row.achvd = dispatchItem.total_qty;
                // row.defct = dispatchItem.total_qty; // All quantity is deviation
                row.excess = dispatchItem.total_qty; // All quantity is excess
            }
        });

        frm.refresh_field('week_schedule_items');
        
        // Ensure grid refresh after data processing
        setTimeout(() => {
            if (frm.get_field('week_schedule_items').grid) {
                frm.get_field('week_schedule_items').grid.refresh();
            }
        }, 100);

        applyRowStyles(frm);

        frappe.show_alert({
            message: __(`Updated schedule with ${frm.doc.week_schedule_items.length} items`),
            indicator: 'green'
        });

    } catch (error) {
        console.error("Error processing dispatch items:", error);
        frappe.show_alert({
            message: __('Error processing items. Please check console for details.'),
            indicator: 'red'
        });
    }
}


// write me a function to open a dialog box to enter reason for deviation in weekly schedule report entry
// the function will recive the form and the row as arguments the default the dialog box will part no target and achvd defct,reason code, action plan root cause, this are filds user will fill in the dialog box
// the function will also have a save button to save the data entered in the dialog box
// the function will also have a cancel button to close the dialog box
// the function will also have a close button to close the dialog box
// save the data entered in the dialog box to the childtable row in the weekly schedule report entry

 function openReasonDialog(frm, row) {
    const dialog = new frappe.ui.Dialog({
        title: __('Enter Reason for Deviation'),
        fields: [
            {
                fieldname: 'part_no',
                label: __('Part No'),
                fieldtype: 'Data',
                read_only: 1,
                default: row.part_no
            },
            {
                fieldname: 'target',
                label: __('Target'),
                fieldtype: 'Float',
                read_only: 1,
                default: row.target
            },
            {
                fieldname: 'achvd',
                label: __('Achieved'),
                fieldtype: 'Float',
                read_only: 1,
                default: row.achvd
            },
            {
                fieldname: 'defct',
                label: __('Defect'),
                fieldtype: 'Float',
                read_only: 1,
                default: row.defct
            },
            {
                fieldname: 'reason_code',
                label: __('Reason Code'),
                fieldtype: 'Link',
                options: 'MCS Reason Code',
                reqd: 1
            },
            {
                fieldname: 'action_plan',
                label: __('Action Plan'),
                fieldtype: 'Text',
                reqd: 1
            },
            {
                fieldname: 'root_cause',
                label: __('Root Cause'),
                fieldtype: 'Text',
                reqd: 1
            }
        ],
        primary_action: function() {
            const values = dialog.get_values();
            if (values) {
                console.log("Values entered in dialog:", values);
                dialog.hide();
                saveReasonData(frm, row, values);
            }
        },
        primary_action_label: __('Save')
    });

    dialog.show();
}   
function saveReasonData(frm, row, values) {
    console.log("Saving reason data:", values);
    const child = frm.doc.week_schedule_items.find(item => item.name === row.name);
    if (child) {
        frappe.model.set_value(child.doctype, child.name, 'reason_code', values.reason_code);
        frappe.model.set_value(child.doctype, child.name, 'action_plan', values.action_plan);
        frappe.model.set_value(child.doctype, child.name, 'root_cause', values.root_cause);
        frm.refresh_field('week_schedule_items');
    }
}