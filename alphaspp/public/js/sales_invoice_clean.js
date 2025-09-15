frappe.ui.form.on('Sales Invoice', {
    refresh: function(frm) {
        // Test if refresh hook is working
        console.log('Sales Invoice refresh hook is working!');

    },
    
    onload: function(frm) {
        // Test if onload hook is working
        console.log('Sales Invoice onload hook is working!');
    }
});

frappe.ui.form.on('Sales Invoice Item', {
    // Test if item-level hooks are working
    item_code: function(frm, cdt, cdn) {
        console.log('Sales Invoice Item - item_code changed!');

    },
    

});
