import frappe
from frappe import _
from frappe.utils import cint
import redis
import json
r = redis.Redis()

def notify_edit(doc, method):
    """Notify all users about real-time updates in the document."""
    
    user = frappe.session.user
    doc_name = doc.name
    changed_fields = {}

    old_doc = frappe.get_doc(doc.doctype, doc.name)

    for field in doc.meta.get("fields"):
        fieldname = field.fieldname
        old_value = old_doc.get(fieldname)
        new_value = doc.get(fieldname)
        if old_value != new_value:
            changed_fields[fieldname] = new_value
    
    if changed_fields:
        first_modified_field = list(changed_fields.keys())[0]
        new_value = changed_fields[first_modified_field]

        message = f"{user} updated {first_modified_field} to {new_value}"

        frappe.publish_realtime(
            event=f"doc_update_{doc_name}",
            message={"user": user, "field": first_modified_field, "value": new_value, "message": message},
            doctype=doc.doctype,
            docname=doc_name
        )

@frappe.whitelist()
def lock_field(doctype, name, field_name):
    """Notify other users when a field is being edited via WebSocket."""
    user = frappe.session.user

    frappe.publish_realtime(f"field_lock_{name}", {
        "user": user,
        "field": field_name
    })

    return {"status": "locked", "field": field_name, "user": user}

@frappe.whitelist()
def unlock_field(doctype, name):
    """Unlock a field when a user stops editing."""
    user = frappe.session.user
    meta = frappe.get_meta(doctype)
    field_names = [
        df.fieldname for df in meta.fields
        if df.fieldtype not in ["Section Break", "Column Break"] and df.fieldname
    ]
    for field in field_names:
        frappe.publish_realtime(f"field_unlock_{name}", {"user": user, "field": field})

    return {"status": "unlocked", "fields": field_names}

def is_field_locked(doc, field_name):
    """Check if a field is locked by another user."""
    lock_key = f"{doc.doctype}:{doc.name}:{field_name}"
    return r.get(lock_key)

@frappe.whitelist()
def get_active_users(doctype, name):
    """Retrieve the list of active users editing a document"""
    active_users_key = f"{doctype}:{name}:active_users"
    
    users_json = r.get(active_users_key)
    
    if users_json:
        users = json.loads(users_json)
    else:
        users = []
    
    return users

@frappe.whitelist()
def set_active_user(doctype, name, user):
    """Store the active user in Redis when they start editing"""
    active_users_key = f"{doctype}:{name}:active_users"
    
    users_json = r.get(active_users_key)
    if users_json:
        users = json.loads(users_json)
    else:
        users = []
    
    if user not in users:
        users.append(user)
    
    r.setex(active_users_key, 60, json.dumps(users))

@frappe.whitelist()
def remove_active_user(doctype, name, user):
    """Remove the user from active editors when they leave the document"""
    active_users_key = f"{doctype}:{name}:active_users"
    
    users_json = r.get(active_users_key)
    if users_json:
        users = json.loads(users_json)
        if user in users:
            users.remove(user)
    
        if users:
            r.setex(active_users_key, 60, json.dumps(users))
        else:
            r.delete(active_users_key)