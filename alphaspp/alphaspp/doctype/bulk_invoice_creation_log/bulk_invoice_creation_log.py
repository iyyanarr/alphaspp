# Copyright (c) 2025, Alphaspp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class BulkInvoiceCreationLog(Document):
	def before_save(self):
		"""Set default values before saving"""
		if not self.created_by:
			self.created_by = frappe.session.user
		
		if not self.creation_date:
			self.creation_date = frappe.utils.now()
		
		if not self.batch_id:
			self.batch_id = frappe.generate_hash(length=10)
	
	def validate(self):
		"""Validate the document"""
		if self.invoice_details:
			self.total_invoices = len(self.invoice_details)
	
	def on_submit(self):
		"""Actions to perform on submit"""
		frappe.logger().info(f"Bulk Invoice Creation Log {self.name} submitted by {frappe.session.user}")
	
	@frappe.whitelist()
	def get_invoice_summary(self):
		"""Get summary of invoices created in this batch"""
		if not self.invoice_details:
			return {}
		
		summary = {
			'total_invoices': len(self.invoice_details),
			'total_amount': sum([d.invoice_amount or 0 for d in self.invoice_details]),
			'customers': list(set([d.customer for d in self.invoice_details if d.customer])),
			'sales_orders': list(set([d.sales_order for d in self.invoice_details if d.sales_order]))
		}
		
		return summary
