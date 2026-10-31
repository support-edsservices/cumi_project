-- Apply this migration to the configured CUMI database before deploying the
-- application changes. It adds invoice-aligned proforma details and includes
-- their dates in the invoice due-date view.

ALTER TABLE shipment_invoices
    ADD COLUMN IF NOT EXISTS proforma_invoice_no VARCHAR(80) NULL AFTER invoice_date,
    ADD COLUMN IF NOT EXISTS proforma_invoice_date DATE NULL AFTER proforma_invoice_no;

UPDATE payment_term_master
SET credit_basis = NULL
WHERE credit_basis = 'RECEIPT_DATE';

UPDATE shipments
SET credit_basis = NULL
WHERE credit_basis = 'RECEIPT_DATE';

ALTER TABLE payment_term_master
    MODIFY COLUMN credit_basis ENUM(
        'INVOICE_DATE',
        'BL_DATE',
        'PO_DATE',
        'PROFORMA_INVOICE_DATE'
    ) DEFAULT NULL;

ALTER TABLE shipments
    MODIFY COLUMN credit_basis ENUM(
        'INVOICE_DATE',
        'BL_DATE',
        'PO_DATE',
        'PROFORMA_INVOICE_DATE'
    ) DEFAULT NULL COMMENT 'the date the credit days are counted from';

CREATE OR REPLACE VIEW v_invoice_due AS
SELECT
    d.invoice_id,
    d.sh_no,
    d.invoice_no,
    d.invoice_date,
    d.proforma_invoice_no,
    d.proforma_invoice_date,
    d.amount,
    d.currency,
    d.due_date_override,
    d.supplier_id,
    d.payment_type,
    d.credit_days,
    d.credit_basis,
    d.prw_status,
    d.material_status,
    d.base_date,
    d.paid_amount,
    d.due_date,
    CASE
        WHEN d.payment_type = 'NO_PAYMENT' THEN 'NOT_APPLICABLE'
        WHEN d.prw_status = 'PAID'
            OR (d.amount IS NOT NULL AND d.paid_amount >= d.amount) THEN 'PAID'
        WHEN d.due_date IS NULL THEN 'NO_DUE_DATE'
        WHEN d.due_date < CURDATE() THEN 'OVERDUE'
        WHEN d.due_date <= CURDATE() + INTERVAL 7 DAY THEN 'DUE_SOON'
        ELSE 'UPCOMING'
    END AS payment_state,
    TO_DAYS(d.due_date) - TO_DAYS(CURDATE()) AS days_to_due
FROM (
    SELECT
        b.invoice_id,
        b.sh_no,
        b.invoice_no,
        b.invoice_date,
        b.proforma_invoice_no,
        b.proforma_invoice_date,
        b.amount,
        b.currency,
        b.due_date_override,
        b.supplier_id,
        b.payment_type,
        b.credit_days,
        b.credit_basis,
        b.prw_status,
        b.material_status,
        b.base_date,
        b.paid_amount,
        COALESCE(
            b.due_date_override,
            CASE
                WHEN b.payment_type = 'CREDIT_DAYS' AND b.base_date IS NOT NULL
                    THEN b.base_date + INTERVAL b.credit_days DAY
            END
        ) AS due_date
    FROM (
        SELECT
            i.id AS invoice_id,
            i.sh_no,
            i.invoice_no,
            i.invoice_date,
            i.proforma_invoice_no,
            i.proforma_invoice_date,
            i.amount,
            i.currency,
            i.due_date_override,
            s.supplier_id,
            s.payment_type,
            s.credit_days,
            s.credit_basis,
            s.prw_status,
            s.material_status,
            CASE s.credit_basis
                WHEN 'INVOICE_DATE' THEN i.invoice_date
                WHEN 'PROFORMA_INVOICE_DATE' THEN i.proforma_invoice_date
                WHEN 'BL_DATE' THEN COALESCE(
                    bl.bl_date,
                    (SELECT MIN(x.bl_date) FROM shipment_bls x WHERE x.sh_no = i.sh_no)
                )
                WHEN 'PO_DATE' THEN COALESCE(
                    po.po_date,
                    (SELECT MIN(y.po_date) FROM shipment_pos y WHERE y.sh_no = i.sh_no)
                )
            END AS base_date,
            COALESCE(
                (SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id = i.id),
                0
            ) AS paid_amount
        FROM shipment_invoices i
        JOIN shipments s
            ON s.sh_no = i.sh_no
            AND s.deleted_at IS NULL
            AND s.record_status = 'ACTIVE'
        LEFT JOIN shipment_bls bl ON bl.id = i.bl_id
        LEFT JOIN shipment_pos po ON po.id = i.po_id
    ) b
) d;
