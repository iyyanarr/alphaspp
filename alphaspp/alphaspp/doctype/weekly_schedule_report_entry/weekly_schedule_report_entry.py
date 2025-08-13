import frappe
from frappe import _
from frappe.model.document import Document

class WeeklyScheduleReportEntry(Document):
    def validate(self):
        if not self.week:
            frappe.throw(_("Please select a Week"))

        # Validate DEFCT field in the child table
        if self.week_schedule_items:
            for item in self.week_schedule_items:
                if item.defct is not None and item.defct < 0 and not item.reason_code:
                    frappe.throw(_("Row #{0}: Reason code is required for negative DEFCT value.").format(item.idx))

# Additional methods if needed
def before_insert(doc, method):
    doc.validate()

def before_update_after_submit(doc, method):
    doc.validate()

def before_save(doc, method):
    doc.validate()

def before_submit(doc, method):
    doc.validate()
