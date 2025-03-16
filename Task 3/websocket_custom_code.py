import frappe
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

def lock_field(doc, user, field_name):
    """Lock a field when a user starts editing."""
    lock_key = f"{doc.doctype}:{doc.name}:{field_name}"
    
    if r.exists(lock_key):
        return False
    
    r.set(lock_key, user, ex=30)
    return True

def unlock_field(doc, field_name):
    """Unlock a field when a user stops editing."""
    lock_key = f"{doc.doctype}:{doc.name}:{field_name}"
    r.delete(lock_key)

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