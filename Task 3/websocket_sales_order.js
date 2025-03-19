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
        }, 5000);
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
        frappe.realtime.on(`field_lock_${frm.doc.name}`, function(data) {
            console.log(" WebSocket Event Received:", data);

            if (data.user === frappe.session.user) {
                console.log(` Ignoring lock event for self (${data.user})`);
                return;
            }
            let fieldtype = frm.meta.fields.find(f => f.fieldname === data.field)?.fieldtype;
            if (["Column Break", "Section Break"].includes(fieldtype)) {
                console.log(`Skipping layout field: ${data.field} (${fieldtype})`);
                return;
            }
            frappe.show_alert({
                message: ` Field "<b>${data.field}</b>" is being edited by ${data.user}.`,
                indicator: "orange"
            });
            frm.set_df_property(data.field, "read_only", 1);
        });
        frappe.realtime.on(`field_unlock_${cur_frm.doc.name}`, function(data) {
            frm.fields_dict[data.field] && frm.set_df_property(data.field, "read_only", 0);
            console.log(`Field "${data.field}" unlocked.`);
        });
    },
    after_save: function(frm) {
        frappe.call({
            method: "demo_app.custom_code.unlock_field",
            args: {
                doctype: frm.doc.doctype,
                name: frm.doc.name
            }
        });
    }
});

$(document).on("focus", "[data-fieldname]", function(event) {
    let fieldname = $(this).attr("data-fieldname");
    console.log(` Field Focused: ${fieldname}`);

    frappe.call({
        method: "demo_app.custom_code.lock_field",
        args: {
            doctype: cur_frm.doc.doctype,
            name: cur_frm.doc.name,
            field_name: fieldname
        },
        callback: function(response) {
            if (response.message && response.message.status === "locked") {
                console.log(`Lock event confirmed for "${response.message.field}"`);
            }
        }
    });
});