frappe.ui.form.on('Sales Order', {
    onload: function(frm) {
        if (!frappe.session.user) return;

        frappe.call({
            method: "demo_app.custom_code.set_active_user",
            args: {
                doctype: frm.doc.doctype,
                name: frm.doc.name,
                user: frappe.session.user
            }
        });

        setInterval(() => {
            frappe.call({
                method: "demo_app.custom_code.get_active_users",
                args: {
                    doctype: frm.doc.doctype,
                    name: frm.doc.name
                },
                callback: function(response) {
                    let users = response.message || [];
                    if (users.length) {
                        frappe.show_alert({
                            message: `Currently editing: ${users.join(", ")}`,
                            indicator: "orange"
                        });
                    }
                }
            });
        }, 10000);
    },

    onhide: function(frm) {
        if (!frappe.session.user) return;

        frappe.call({
            method: "demo_app.custom_code.remove_active_user",
            args: {
                doctype: frm.doc.doctype,
                name: frm.doc.name,
                user: frappe.session.user
            }
        });
    },
	refresh: function(frm) {
        frappe.realtime.on(`doc_update_${frm.doc.name}`, function(data) {
            frappe.show_alert({
                message: `${data.user} is editing ${data.field}: ${data.value}`,
                indicator: "orange"
            });

            frm.set_value(data.field, data.value);
            frm.refresh_field(data.field);
        });

        frappe.call({
            method: "demo_app.custom_code.get_active_users",
            args: { doctype: frm.doc.doctype, name: frm.doc.name },
            callback: function(response) {
                let users = response.message || [];
                if (users.length) {
                    frappe.msgprint(`Currently editing: ${users.join(", ")}`);
                }
            }
        });
    },
	fieldname_on_focus: function(frm, cdt, cdn) {
        let fieldname;
        let docname = frm.doc.name;
        let doctype = frm.doc.doctype;
        
        if (cdt && cdn) {
            let child_doc = locals[cdt][cdn];
            fieldname = frappe.ui.form.get_event_target();
            doctype = cdt;
            docname = child_doc.name;
        } else {
            fieldname = frappe.ui.form.get_event_target();
        }

        frappe.call({
            method: "demo_app.custom_code.lock_field",
            args: {
                doctype: doctype,
                name: docname,
                field_name: fieldname
            },
            callback: function(response) {
                if (!response.message) {
                    frappe.msgprint(`Field "${fieldname}" is being edited by another user.`);
                    frm.set_df_property(fieldname, "read_only", 1);
                }
            }
        });
    },

    fieldname_on_blur: function(frm, cdt, cdn) {
        let fieldname;
        let docname = frm.doc.name;
        let doctype = frm.doc.doctype;
        
        if (cdt && cdn) {
            let child_doc = locals[cdt][cdn];
            fieldname = frappe.ui.form.get_event_target();
            doctype = cdt;
            docname = child_doc.name;
        } else {
            fieldname = frappe.ui.form.get_event_target();
        }

        frappe.call({
            method: "demo_app.custom_code.unlock_field",
            args: {
                doctype: doctype,
                name: docname,
                field_name: fieldname
            }
        });

        frm.set_df_property(fieldname, "read_only", 0);
    }
});
frappe.realtime.on("field_lock_update", (data) => {
    if (data.docname === cur_frm.doc.name) {
        cur_frm.set_df_property(data.field_name, "read_only", data.locked ? 1 : 0);
        frappe.show_alert(`${data.user} is editing "${data.field_name}"`, 3);
    }
});