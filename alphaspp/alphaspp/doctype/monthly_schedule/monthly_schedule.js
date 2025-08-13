frappe.ui.form.on('Monthly Schedule', {
    onload: function(frm) {
        // Generate month options with labels
        let options = [];
        let currentDate = new Date();
        let currentYear = currentDate.getFullYear();
        
        // Month names array
        const monthNames = [
            "January", "February", "March", "April",
            "May", "June", "July", "August",
            "September", "October", "November", "December"
        ];
        
        // Add months for previous year, current year, and next year
        for (let year = currentYear - 1; year <= currentYear + 1; year++) {
            for (let month = 1; month <= 12; month++) {
                const monthNum = month < 10 ? '0' + month : month;
                const value = `${year}-${monthNum}`;
                const label = `${monthNames[month-1]} ${year}`;
                options.push({
                    label: label,
                    value: value
                });
            }
        }
        
        // Set the options for month field
        frm.set_df_property('month', 'fieldtype', 'Select');
        frm.set_df_property('month', 'options', options.map(o => {
            return {
                label: o.label,
                value: o.value
            }
        }));
        
        // Set default value to current month if new doc
        if (frm.is_new()) {
            let currentMonth = currentDate.getMonth() + 1;
            let defaultMonth = currentYear + '-' + 
                (currentMonth < 10 ? '0' + currentMonth : currentMonth);
            frm.set_value('month', defaultMonth);
        }
    },

    month: function(frm) {
        if (!frm.doc.month) return;
        
        // Clear existing rows
        frm.clear_table('week_table');
        
        // Get the selected month and year
        const [year, month] = frm.doc.month.split('-');
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        
        // Get week distribution based on total days in month
        const weekDays = getWeekDistribution(daysInMonth);
        
        // Calculate and add rows for each week period
        let currentDate = new Date(year, parseInt(month) - 1, 1);
        let weekNumber = 1;
        
        weekDays.forEach(daysInWeek => {
            const startDate = new Date(currentDate);
            const endDate = new Date(currentDate);
            endDate.setDate(endDate.getDate() + (daysInWeek - 1));
            
            const row = frm.add_child('week_table', {
                week_id: `Week ${weekNumber}`,
                start_date: frappe.datetime.obj_to_str(startDate),
                end_date: frappe.datetime.obj_to_str(endDate),
                no_days: daysInWeek
            });
            
            currentDate.setDate(currentDate.getDate() + daysInWeek);
            weekNumber++;
        });
        
        frm.refresh_field('week_table');
    },

    refresh: function(frm) {
        frm.add_custom_button(__('Add Schedule'), function() {
            Opendialog(frm);
        });
        frm.add_custom_button(__('Update Schedule'), function() {
            OpenUpdateDialog(frm);
        }
        );
        // add custom button for feed week report doctype "Weekly Schedule Report Entry"
        frm.add_custom_button(__('New Weekly Schedule Report'), function() {
            frappe.new_doc('Weekly Schedule Report Entry', {
                monthly_schedule: frm.doc.name
            });
        });

    
    }
});

function Opendialog(frm) {
    if (!frm.doc.week_table || !frm.doc.week_table.length) {
        frappe.throw(__('Please select a month first to generate week table'));
        return;
    }

    let dialog = new frappe.ui.Dialog({
        title: 'Add Schedule Details',
        size: "extra-large",
        fields: [
            {
                fieldtype: 'Section Break',
                label: 'Basic Information'
            },
            {
                label: 'Customer',
                fieldname: 'customer',
                fieldtype: 'Link',
                options: 'Customer',
                reqd: 1,
                get_query: function() {
                    return {
                        filters: {
                            'customer_group': 'Individual'
                        }
                    };
                },
                onchange: function() {
                    updateItems(dialog);
                    updateBuyer(dialog);
                }
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Buyer Name',
                fieldname: 'buyer_name',
                fieldtype: 'Select',
                options: [],
                reqd: 1
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Factory',
                fieldname: 'factory',
                fieldtype: 'Select',
                options: 'Factory 1\nFactory 2\nFactory 3\nFactory 4\nFactory 5',
                reqd: 1
            },
            {
                fieldtype: 'Section Break',
                label: 'Schedule Items'
            },
            {
                fieldname: 'schedule_items',
                fieldtype: 'Table',
                cannot_add_rows: true,
                data: [],
                fields: [
                    {
                        fieldname: 'part_no',
                        label: 'Part No',
                        fieldtype: 'Data',
                        in_list_view: 1,
                        read_only: 1,
                        width: 120
                    },
                    {
                        fieldname: 'spp_ref',
                        label: 'SPP Ref',
                        fieldtype: 'Data',
                        in_list_view: 1,
                        read_only: 1,
                        width: 140
                    },
                    {
                        fieldname: 'total_quantity',
                        label: 'Total Qty',
                        fieldtype: 'Float',
                        in_list_view: 1,
                        width: 100
                    }
                ]
            }
        ],
        primary_action_label: 'Add',
        primary_action(values) {
            validateAndAddSchedule(frm, values, dialog);
        }
    });

    dialog.show();
    dialog.$wrapper.find('.modal-dialog').css("width", "1000px");
}

function updateItems(dialog) {
    let customer = dialog.get_value('customer');
    if (!customer) return;

    frappe.call({
        method: 'alphaspp.alphaspp.api.get_items_by_customer',
        args: {
            customer_name: customer
        },
        callback: function(response) {
            if (response.message && response.message.success) {
                let items = response.message.data;
                let tableData = items.map(item => ({
                    part_no: item.item_code,
                    spp_ref: item.item_name,
                    total_quantity: 0
                }));

                let scheduleItems = dialog.fields_dict.schedule_items;
                scheduleItems.df.data = tableData;
                scheduleItems.grid.refresh();

                frappe.show_alert({
                    message: __(`${tableData.length} items loaded`),
                    indicator: 'green'
                }, 3);
            } else {
                frappe.show_alert({
                    message: __('No items found for selected customer'),
                    indicator: 'orange'
                });
            }
        }
    });
}

function updateBuyer(dialog) {
    let customer = dialog.get_value('customer');
    if (!customer) return;

    frappe.call({
        method: 'alphaspp.alphaspp.api.get_buyers_by_customer',
        args: {
            customer_name: customer
        },
        callback: function(response) {
            if (response.message && response.message.success) {
                let buyers = response.message.data;
                dialog.set_df_property('buyer_name', 'options', buyers);
            }
        }
    });
}

function calculateWeeklyDistribution(totalQty, weekTable) {
    const weekDays = weekTable.map(row => row.no_days);
    const totalDays = weekDays.reduce((sum, days) => sum + days, 0);
    
    let weekQuantities = weekDays.map(days => (totalQty * days / totalDays));
    let roundedQuantities = weekQuantities.map(qty => Math.floor(qty));
    let distributedQty = roundedQuantities.reduce((sum, qty) => sum + qty, 0);
    let remaining = totalQty - distributedQty;
    
    let decimalParts = weekQuantities.map((qty, index) => ({
        index: index,
        decimal: qty - Math.floor(qty)
    }));
    
    decimalParts.sort((a, b) => b.decimal - a.decimal);
    
    for (let i = 0; i < remaining; i++) {
        if (decimalParts[i]) {
            roundedQuantities[decimalParts[i].index]++;
        }
    }
    
    return roundedQuantities;
}

function validateAndAddSchedule(frm, values, dialog) {
    if (!values.schedule_items || !values.schedule_items.length) {
        frappe.throw(__('Please add at least one item'));
        return;
    }

    // Filter out items with zero quantity
    values.schedule_items = values.schedule_items.filter(item => item.total_quantity > 0);

    if (values.schedule_items.length === 0) {
        frappe.throw(__('Please enter quantity for at least one item'));
        return;
    }

    // Check for duplicates
    const duplicates = checkDuplicates(frm, values.schedule_items, values.customer, values.buyer_name);
    if (duplicates.length > 0) {
        showDuplicateDialog(frm, values, dialog, duplicates);
        return;
    }

    showDistributionPreview(frm, values, dialog);
}

function checkDuplicates(frm, scheduleItems, customer, buyerName) {
    let duplicates = [];
    
    scheduleItems.forEach(item => {
        if (!item.total_quantity) return;

        const existingItem = frm.doc.schedule_item.find(existing => 
            existing.customer === customer &&
            existing.buyer_name === buyerName &&
            existing.part_no === item.part_no
        );

        if (existingItem) {
            duplicates.push({
                part_no: item.part_no,
                spp_ref: item.spp_ref,
                new_qty: item.total_quantity,
                existing_qty: existingItem.total_quantity,
                existing_week1: existingItem.week_1_w1,
                existing_week2: existingItem.week_2_w2,
                existing_week3: existingItem.week_3_w3,
                existing_week4: existingItem.week_4_w4
            });
        }
    });

    return duplicates;
}

function showDuplicateDialog(frm, values, mainDialog, duplicates) {
    let duplicateDialog = new frappe.ui.Dialog({
        title: 'Duplicate Items Found',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'duplicate_message',
                options: `<div class="alert alert-warning">
                    The following items already exist in the schedule. 
                    Please select how to handle each duplicate item.
                </div>`
            },
            {
                fieldtype: 'Table',
                fieldname: 'duplicate_items',
                cannot_add_rows: true,
                cannot_delete_rows: true,
                data: duplicates.map(d => ({
                    ...d,
                    action: 'skip' // Default action
                })),
                fields: [
                    {
                        fieldname: 'part_no',
                        label: 'Part No',
                        fieldtype: 'Data',
                        in_list_view: 1,
                        read_only: 1
                    },
                    {
                        fieldname: 'spp_ref',
                        label: 'SPP Ref',
                        fieldtype: 'Data',
                        in_list_view: 1,
                        read_only: 1
                    },
                    {
                        fieldname: 'existing_qty',
                        label: 'Existing Qty',
                        fieldtype: 'Float',
                        in_list_view: 1,
                        read_only: 1
                    },
                    {
                        fieldname: 'new_qty',
                        label: 'New Qty',
                        fieldtype: 'Float',
                        in_list_view: 1,
                        read_only: 1
                    },
                    {
                        fieldname: 'action',
                        label: 'Action',
                        fieldtype: 'Select',
                        in_list_view: 1,
                        options: [
                            'Skip',
                            'Update',
                            'Add'
                        ],
                        default: 'Skip'
                    }
                ]
            }
        ],
        primary_action_label: 'Proceed',
        primary_action(duplicateValues) {
            handleDuplicateActions(frm, values, mainDialog, duplicateValues.duplicate_items);
            duplicateDialog.hide();
        }
    });

    duplicateDialog.show();
}

function handleDuplicateActions(frm, values, mainDialog, duplicateItems) {
    let itemsToProcess = values.schedule_items.filter(item => {
        const duplicate = duplicateItems.find(d => d.part_no === item.part_no);
        return !duplicate || duplicate.action.toLowerCase() !== 'skip';
    });

    itemsToProcess.forEach(item => {
        const duplicate = duplicateItems.find(d => d.part_no === item.part_no);
        if (duplicate) {
            handleDuplicateItem(frm, item, duplicate, values);
        } else {
            addNewScheduleItem(frm, item, values);
        }
    });

    frm.refresh_field('schedule_item');
    mainDialog.hide();
    
    frappe.show_alert({
        message: __('Schedule items processed successfully'),
        indicator: 'green'
    });
}

function handleDuplicateItem(frm, item, duplicate, values) {
    const distribution = calculateWeeklyDistribution(item.total_quantity, frm.doc.week_table);
    
    if (duplicate.action.toLowerCase() === 'update') {
        frm.doc.schedule_item.forEach(existing => {
            if (existing.part_no === item.part_no && 
                existing.customer === values.customer && 
                existing.buyer_name === values.buyer_name) {
                existing.total_quantity = item.total_quantity;
                existing.week_1_w1 = distribution[0];
                existing.week_2_w2 = distribution[1];
                existing.week_3_w3 = distribution[2];
                existing.week_4_w4 = distribution[3];
            }
        });
    } else if (duplicate.action.toLowerCase() === 'add') {
        addNewScheduleItem(frm, item, values);
    }
}

function addNewScheduleItem(frm, item, values) {
    const distribution = calculateWeeklyDistribution(item.total_quantity, frm.doc.week_table);
    
    frm.add_child('schedule_item', {
        customer: values.customer,
        buyer_name: values.buyer_name,
        factory: values.factory,
        part_no: item.part_no,
        spp_ref: item.spp_ref,
        total_quantity: item.total_quantity,
        week_1_w1: distribution[0],
        week_2_w2: distribution[1],
        week_3_w3: distribution[2],
        week_4_w4: distribution[3]
    });
}

function showDistributionPreview(frm, values, dialog) {
    let message = 'Weekly distribution preview:\n';
    values.schedule_items.forEach(item => {
        if (item.total_quantity) {
            const distribution = calculateWeeklyDistribution(item.total_quantity, frm.doc.week_table);
            message += `\n${item.part_no}: `;
            distribution.forEach((qty, index) => {
                message += `Week ${index + 1}: ${qty} | `;
            });
        }
    });

    frappe.confirm(
        message + '\n\nDo you want to proceed?',
        () => {
            addItemsToSchedule(frm, values, dialog);
        }
    );
}

function addItemsToSchedule(frm, values, dialog) {
    values.schedule_items.forEach(item => {
        if (!item.total_quantity) return;
        addNewScheduleItem(frm, item, values);
    });

    frm.refresh_field('schedule_item');
    dialog.hide();
    
    frappe.show_alert({
        message: __('Schedule items added successfully'),
        indicator: 'green'
    });
}

function getWeekDistribution(daysInMonth) {
    switch(daysInMonth) {
        case 31:
            return [7, 8, 8, 8];
        case 30:
            return [7, 7, 8, 8];
        case 29:
            return [7, 7, 7, 8];
        case 28:
            return [7, 7, 7, 7];
        default:
            frappe.throw(__('Invalid number of days in month'));
            return [];
    }
}

// end add schedule

// Function to open dialog for updating schedule details

function OpenUpdateDialog(frm) {
    console.log('OpenUpdateDialog function triggered');

    // First get all unique customers and part numbers from child table
    let scheduleItems = frm.doc.schedule_item || [];
    let uniqueCustomers = [...new Set(scheduleItems.map(item => item.customer))];
    let uniquePartNos = [...new Set(scheduleItems.map(item => item.part_no))];
    let uniqueBuyer = []

    let dialog = new frappe.ui.Dialog({
        title: 'Update Schedule Details',
        fields: [
            {
                fieldtype: 'Section Break',
                label: 'Select Items to Update'
            },
            {
                label: 'Customer',
                fieldname: 'customer',
                fieldtype: 'Select',
                options: uniqueCustomers,
                reqd: 1,
                onchange: function() {
                    updatePartNoOptions(dialog, frm);
                    GetBuyerinfo(dialog);
                }
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Part No',
                fieldname: 'part_no',
                fieldtype: 'Select',
                options: uniquePartNos,
                reqd: 1,
                onchange: function() {
                    loadCurrentValues(dialog, frm);
                }
            },
            {
                label: 'Buyer Name',
                fieldname: 'buyer_name',
                fieldtype: 'Select',
                options: [], // Will be populated by updateBuyer function
                reqd: 1
            },
        
            {
                fieldtype: 'Section Break',
                label: 'Current Schedule'
            },
            {
                label: 'Schedule Date',
                fieldname: 'schedule_date',
                fieldtype: 'Date',
                reqd: 1
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Type',
                fieldname: 'type',
                fieldtype: 'Select',
                options: 'NEW/ADDL\nREVISED',
                reqd: 1
            },
            {
                fieldtype: 'Section Break',
                label: 'Quantity Details'
            },
            {
                label: 'Total Quantity',
                fieldname: 'total_quantity',
                fieldtype: 'Float',
                reqd: 1,
                onchange: function(){
                    distributeQuantity(dialog, frm);
                }
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Week 1 (W1)',
                fieldname: 'week_1',
                fieldtype: 'Float'
            },
            {
                label: 'Week 2 (W2)',
                fieldname: 'week_2',
                fieldtype: 'Float'
            },
            {
                fieldtype: 'Column Break'
            },
            {
                label: 'Week 3 (W3)',
                fieldname: 'week_3',
                fieldtype: 'Float'
            },
            {
                label: 'Week 4 (W4)',
                fieldname: 'week_4',
                fieldtype: 'Float'
            },
            {
                fieldtype: 'Section Break',
                label: 'Update Comments'
            },
            {
                label: 'Reason for Update',
                fieldname: 'update_comment',
                fieldtype: 'Small Text',
                reqd: 1
            }
        ],
        primary_action_label: 'Update',
        primary_action(values) {
            console.log('Primary action triggered with values:', values);
            updateScheduleItem(frm, values, dialog);
        }
    });

    dialog.show();
}


// Function to update Part No options based on selected customer
function updatePartNoOptions(dialog, frm) {
    let selectedCustomer = dialog.get_value('customer');
    let scheduleItems = frm.doc.schedule_item || [];

    // Filter part numbers for selected customer
    let customerPartNos = [...new Set(
        scheduleItems
            .filter(item => item.customer === selectedCustomer)
            .map(item => item.part_no)
    )];

    // Update part_no field options
    dialog.set_df_property('part_no', 'options', customerPartNos);
    dialog.set_value('part_no', ''); // Clear current selection
}



// Corrected updateScheduleItem function
function updateScheduleItem(frm, values, dialog) {
    console.log('Updating schedule item with values:', values);

    let scheduleItems = frm.doc.schedule_item || [];
    let updatedAny = false;

    scheduleItems.forEach(item => {
        if (item.customer === values.customer && item.part_no === values.part_no) {
            $.extend(item, {
                schedule_date: values.schedule_date,
                type: values.type,
                buyer_name: values.buyer_name, // Fixed syntax error here
                total_quantity: values.total_quantity,
                week_1_w1: values.week_1,
                week_2_w2: values.week_2,
                week_3_w3: values.week_3,
                week_4_w4: values.week_4,
                revised_comment: values.update_comment,
                last_updated: frappe.datetime.now_datetime()
            });

            updatedAny = true;
        }
    });

    if (updatedAny) {
        frm.refresh_field('schedule_item');
        dialog.hide();
        frappe.show_alert({
            message: `Schedule updated successfully<br>Comment: ${values.update_comment}`,
            indicator: 'green'
        }, 5);
    } else {
        frappe.throw('No matching schedule item found to update');
    }
}

// Make sure loadCurrentValues includes buyer_name
function loadCurrentValues(dialog, frm) {
    let selectedCustomer = dialog.get_value('customer');
    let selectedPartNo = dialog.get_value('part_no');
    let scheduleItems = frm.doc.schedule_item || [];

    let matchingItem = scheduleItems.find(item =>
        item.customer === selectedCustomer &&
        item.part_no === selectedPartNo
    );

    if (matchingItem) {
        dialog.set_values({
            'schedule_date': matchingItem.schedule_date,
            'type': matchingItem.type,
            'total_quantity': matchingItem.total_quantity,
            'buyer_name': matchingItem.buyer_name, // Include buyer_name
            'week_1': matchingItem.week_1,
            'week_2': matchingItem.week_2,
            'week_3': matchingItem.week_3,
            'week_4': matchingItem.week_4
        });
    }
}

// Function to update SPP Ref based on selected Part No and Customer
function updateSPPRef(dialog) {
    let values = dialog.get_values();
    console.log(values);
    if (!values || !values.customer || !values.part_no) return;

    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Item',
            name: values.part_no
        },
        callback: function(r) {
            if (r.message) {
                let item = r.message;
                let sppRef = '';

                // First check the customer_code field at item level
                if (item.customer_code) {
                    sppRef = item.customer_code;
                }
                
                // Then check in customer_items table if exists
                if (item.customer_items && item.customer_items.length > 0) {
                    let customerItem = item.customer_items.find(
                        ci => ci.customer_name === values.customer
                    );

                    if (customerItem && customerItem.ref_code) {
                        sppRef = customerItem.ref_code;
                    }
                }

                // Update the dialog field
                dialog.set_value('spp_ref', sppRef);

                if (!sppRef) {
                    frappe.show_alert({
                        message: __('No SPP Reference found for this Customer and Part No combination'),
                        indicator: 'yellow'
                    });
                }
            }
        }
    });
}

// Function to validate duplicate entries while typing
function validateDuplicateEntry(dialog, frm) {
    let values = dialog.get_values();
    // if (!values.customer || !values.part_no) return;

    let isDuplicate = false;
    if (frm.doc.schedule_item && frm.doc.schedule_item.length) {
        isDuplicate = frm.doc.schedule_item.some(row => 
            row.customer === values.customer && 
            row.part_no === values.part_no
        );
    }

    if (isDuplicate) {
        dialog.set_df_property('customer', 'description', 
            '<div style="color: red;">This combination already exists!</div>');
        dialog.set_df_property('part_no', 'description', 
            '<div style="color: red;">This combination already exists!</div>');
    } else {
        dialog.set_df_property('customer', 'description', '');
        dialog.set_df_property('part_no', 'description', '');
    }
}



// Function to update main dialog with selected sales order details
function updateDialogWithSalesOrder(dialog, so_data, part_no) {
    const selected_so = so_data.find(row => row.select === 1);
    if (!selected_so) {
        frappe.throw(__('Please select a Sales Order'));
        return;
    }

    // Fetch specific sales order item details
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Sales Order',
            name: selected_so.sales_order
        },
        callback: function(r) {
            if (r.message) {
                const so = r.message;
                const so_item = so.items.find(item => item.item_code === part_no);
                
                if (so_item) {
                    dialog.set_value('sales_order', so.name);
                    dialog.set_value('so_item', so_item.name);
                    dialog.set_value('order_qty', so_item.qty);
                    dialog.set_value('total_quantity', so_item.qty);
                    
                    // Trigger quantity distribution
                    distributeQuantity(dialog, frm);
                } else {
                    frappe.throw(__('Selected Part No not found in Sales Order'));
                }
            }
        }
    });
}


// Function to get customer contacts
function updateBuyer(dialog) {
    console.log("geting buyer contact")
    let customer = dialog.get_value('customer');
    getLinkedContacts(customer)  // Replace with actual customer name
    .then(contactNames => {
        console.log('Linked Contacts:', contactNames);
        console.log(contactNames)
     
        dialog.set_df_property('buyer_name', 'options', contactNames);
    })
    .catch(error => {
        console.error('Error fetching linked contacts:', error);
    });

}
function GetBuyerinfo(dialog) {
    console.log("geting buyer contact")
    let customer = dialog.get_value('customer');
    getLinkedContacts(customer)  // Replace with actual customer name
    .then(contactNames => {
        console.log('Linked Contacts:', contactNames);
        console.log(contactNames)
     
        dialog.set_df_property('buyer_name', 'options', contactNames);
    })
    .catch(error => {
        console.error('Error fetching linked contacts:', error);
    });

}

function getLinkedContacts(customerName) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'alphaspp.alphaspp.api.get_linked_contacts', // Adjust this based on your app structure
            args: {
                customer_name: customerName
            },
            callback: function(response) {
                if(response.message) {
                    resolve(response.message);
                } else {
                    resolve([]); // No contacts found
                }
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}


