# Copyright (c) 2025, Alphaspp and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestBulkInvoiceCreationLog(FrappeTestCase):
	def test_bulk_invoice_creation_log_creation(self):
		"""Test creation of bulk invoice creation log"""
		log = frappe.get_doc({
			"doctype": "Bulk Invoice Creation Log",
			"total_invoices": 5,
			"status": "Completed",
			"remarks": "Test batch creation"
		})
		log.insert()
		
		self.assertEqual(log.created_by, frappe.session.user)
		self.assertTrue(log.batch_id)
		self.assertEqual(log.total_invoices, 5)
