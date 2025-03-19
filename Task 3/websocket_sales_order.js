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
                        if (frappe.get_route()[0] === "Form" && frappe.get_route()[1] === frm.doc.doctype) {
                            frappe.show_alert({
                                message: `Currently Viewing: ${users.join(", ")}`,
                                indicator: "orange"
                            });
                        }
                    }
                }
            });
        }, 10000);
    },
    refresh: function(frm) {
        frappe.realtime.on(`doc_update_${frm.doc.name}`, function(data) {
            if (data.user !== frappe.session.user) {
                frappe.show_alert({
                    message: `${data.user} is editing ${data.field}: ${data.value}`,
                    indicator: "orange"
                });

                frm.set_value(data.field, data.value);
                frm.refresh_field(data.field);
            }
        });
        frappe.router.on('change', function() {
            if (cur_frm && cur_frm.doc) {
                if (frappe.get_route()[0] === "Form" && frappe.get_route()[1] === cur_frm.doctype) {
                    frappe.call({
                        method: "demo_app.custom_code.set_active_user",
                        args: {
                            doctype: frm.doc.doctype,
                            name: frm.doc.name,
                            user: frappe.session.user
                        }
                    });
                } else {
                    frappe.call({
                        method: "demo_app.custom_code.remove_active_user",
                        args: {
                            doctype: frm.doc.doctype,
                            name: frm.doc.name,
                            user: frappe.session.user
                        }
                    });
                }
            }
        });
    },
    fieldname_on_focus: function(frm, cdt, cdn) {
        alert("1");
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
        alert("2");
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
        frappe.show_alert(`${data.user} is editingss "${data.field_name}"`, 3);
    }
});