from . import __version__ as app_version

app_name = "alphaspp"
app_title = "Alphaspp"
app_publisher = "Alphaworkz"
app_description = "Alphaworkz Custom App"
app_email = "support@aplhaworkz.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/alphaspp/css/alphaspp.css"
# app_include_js = "/assets/alphaspp/js/alphaspp.js"

# include js, css files in header of web template
# web_include_css = "/assets/alphaspp/css/alphaspp.css"
# web_include_js = "/assets/alphaspp/js/alphaspp.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "alphaspp/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Sales Order": "public/js/sales_order_clean.js",
    "Sales Invoice": "public/js/sales_invoice_clean.js"
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "alphaspp.utils.jinja_methods",
# 	"filters": "alphaspp.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "alphaspp.install.before_install"
# after_install = "alphaspp.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "alphaspp.uninstall.before_uninstall"
# after_uninstall = "alphaspp.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "alphaspp.utils.before_app_install"
# after_app_install = "alphaspp.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "alphaspp.utils.before_app_uninstall"
# after_app_uninstall = "alphaspp.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "alphaspp.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"alphaspp.tasks.all"
# 	],
# 	"daily": [
# 		"alphaspp.tasks.daily"
# 	],
# 	"hourly": [
# 		"alphaspp.tasks.hourly"
# 	],
# 	"weekly": [
# 		"alphaspp.tasks.weekly"
# 	],
# 	"monthly": [
# 		"alphaspp.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "alphaspp.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "alphaspp.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "alphaspp.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["alphaspp.utils.before_request"]
# after_request = ["alphaspp.utils.after_request"]

# Job Events
# ----------
# before_job = ["alphaspp.utils.before_job"]
# after_job = ["alphaspp.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"alphaspp.auth.validate"
# ]

# Fixtures
# --------
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            ("module", "=", "Alphaspp"),
            ("dt", "in", ["Sales Order Item", "Sales Invoice Item"])
        ]
    },
    {
        "dt": "Property Setter",
        "filters": [
            ("module", "=", "Alphaspp"),
            ("doc_type", "in", ["Sales Order Item", "Sales Invoice Item"])
        ]
    }
]

page_js = {
    "bulk-invoice-entry": ["public/js/bulk_invoice_entry.js"]
}

app_include_css = [
    "/assets/alphaspp/css/bulk_invoice_entry.css"
]