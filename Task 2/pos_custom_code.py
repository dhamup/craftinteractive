import frappe

@frappe.whitelist()
def pos_invoice_details(customer):
    """Fetch POS Invoices along with their child items in one API call"""

    invoices = frappe.get_all(
        "POS Invoice",
        filters={"customer": customer, "docstatus": 1},
        fields=["name", "posting_date", "grand_total", "status", "currency"],
        limit_page_length=5
    )

    invoice_names = [inv["name"] for inv in invoices]
    items = frappe.get_all(
        "POS Invoice Item",
        filters={"parent": ["in", invoice_names]},
        fields=["parent", "item_code", "item_name", "qty", "rate", "amount"]
    )

    invoice_map = {inv["name"]: inv for inv in invoices}
    for item in items:
        parent_invoice = item["parent"]
        if "items" not in invoice_map[parent_invoice]:
            invoice_map[parent_invoice]["items"] = []
        invoice_map[parent_invoice]["items"].append(item)

    return list(invoice_map.values())

