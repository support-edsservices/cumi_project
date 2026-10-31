# Shipment backend

## Database setup

1. Create a test MySQL 8.0.16+ database and apply the supplied `import_schema.sql` to it. The API requires its tables, `sp_next_sh_no`, and the `v_shipment_overview` view.
2. Apply `sql/master_lookup_tables.sql` to add the country, shipment-mode, PRW status, and material masters. It also adds the missing active flag to ports and allows shipment modes to be maintained as names:

   ```powershell
   mysql -u root -p cumi < sql\master_lookup_tables.sql
   ```

   Supplier, port, CHA, warehouse, and payment-term masters are supplied by `import_schema.sql`.
3. Copy `.env.example` to `.env` and set the test database credentials and two different random JWT secrets. Do not use production credentials against a test environment.
4. From `backend`, install dependencies and start the API:

   ```powershell
   py -m venv venv
   .\venv\Scripts\python.exe -m pip install -r requirements.txt
   .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
   ```

5. Check `http://127.0.0.1:8001/health/db` and `http://127.0.0.1:8001/docs`.

The web app uses `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8001`). The API stores uploaded files under `DOCS_ROOT` and stores only their relative paths in MySQL. The default upload size limit is 25 MiB.

Database table names are centralized in `config/settings.py` under `DB_TABLES`; views and the shipment-number procedure are in `DB_VIEWS` and `DB_PROCEDURES`. Update those mappings there if the schema uses different object names.

## Shipment API

- `GET /api/shipments` and `GET /api/shipments/{sh_no}`: authenticated users.
- `GET /api/shipments/{sh_no}/invoices` and `GET /api/shipments/{sh_no}/invoices/{invoice_id}/payments`: authenticated users.
- `POST /api/shipments` and `PUT /api/shipments/{sh_no}`: manager, admin, or superadmin.
- `POST /api/shipments/{sh_no}/invoices/{invoice_id}/payments`: manager, admin, or superadmin.
- `DELETE /api/shipments/{sh_no}` and `DELETE /api/shipments/{sh_no}/attachments/{id}`: admin or superadmin (soft deletes).
- `POST /api/shipments/{sh_no}/attachments?type=PO|INVOICE|BL|MAWB|HAWB|BOE|OTHER`: manager, admin, or superadmin.
- `GET /api/shipments/{sh_no}/attachments/{id}`: authenticated users.
- `GET /api/masters/{suppliers|ports|chas|warehouses|payment-terms|modes|countries|prw|materials}`: authenticated users.
- `POST /api/masters/{master_type}`, `PUT` and `DELETE /api/masters/{master_type}/{id}`, and `PATCH /api/masters/{master_type}/{id}/activate` or `/deactivate`: manager, admin, or superadmin.

Each master has a separate page under `/masters/`: suppliers, ports (used for both loading and landing), CHA agents, shipment modes, countries, payment terms, PRW/payment statuses, warehouses, and materials. Add/activate values on those pages; shipment entry uses searchable selectors for active master values and does not create missing values automatically. Shipment modes are maintained as names; PRW values remain fixed system statuses.

The API uses the schema's stored procedure to allocate shipment numbers in the same transaction as the shipment insert. In shipment entry, choose how many PO, invoice, BL, and BOE values to add; the page creates one number/date row per value and joins them with `_` for the API, which inserts separate child-table rows. At least one PO and invoice are required. BL and BOE are optional; leave their counts at zero when they do not apply. Enter one number per field; dates can be omitted unless the selected payment-term date basis requires them.
