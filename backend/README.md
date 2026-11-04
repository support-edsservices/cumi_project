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

The web app uses `NEXT_PUBLIC_API_URL` when set. Otherwise, it uses `http://localhost:8001` for local development and the current site's origin when hosted. The API stores uploaded files under `DOCS_ROOT` and stores only their relative paths in MySQL. The default upload size limit is 25 MiB.

## Hosting and attachment storage

On a Hostinger VPS or another server with a persistent disk, attachments are stored on the backend server, not on the user's PC. Set `DOCS_ROOT` in the backend `.env` to an absolute directory outside the application release directory, for example:

```env
DOCS_ROOT=/var/lib/cumi/docs
```

Create that directory and grant the backend process permission to write to it. Keep it on persistent storage, back it up, and do not place it in a publicly served web directory. The API returns authenticated download URLs; the frontend does not expose the server's filesystem path.

By default, the hosted frontend calls the API on the same origin, so configure the reverse proxy to route the API paths (including `/api` and `/auth`) to the backend. If the API uses a different domain, set `NEXT_PUBLIC_API_URL` to that API's base URL when building the frontend, and configure backend `CORS_ORIGINS` to include the frontend's origin. `NEXT_PUBLIC_API_URL` is embedded during the frontend build, so rebuild after changing it.

This filesystem setup is suitable for a single VPS with persistent disk. For ephemeral hosting or multiple backend instances, use shared persistent storage or object storage; a server's temporary local disk is not sufficient.

Database table names are centralized in `config/settings.py` under `DB_TABLES`; views and the shipment-number procedure are in `DB_VIEWS` and `DB_PROCEDURES`. Update those mappings there if the schema uses different object names.

## Shipment API

- `GET /api/shipments` and `GET /api/shipments/{sh_no}`: authenticated users.
- `GET /api/shipments/{sh_no}/invoices` and `GET /api/shipments/{sh_no}/invoices/{invoice_id}/payments`: authenticated users.
- `POST /api/shipments` and `PUT /api/shipments/{sh_no}`: manager, admin, or superadmin.
- `POST /api/shipments/import`: manager, admin, or superadmin; imports up to 500 rows, preserves supplied shipment IDs, skips IDs that already exist without changing those shipments, allows blank PO dates for Excel imports, and returns row-level errors. Normal shipment creation still requires a PO date.
- `POST /api/shipments/{sh_no}/invoices/{invoice_id}/payments`: manager, admin, or superadmin.
- `DELETE /api/shipments/{sh_no}`: admin or superadmin; permanently deletes the shipment, related invoice payments, documents, audit entries, and uploaded attachments.
- `DELETE /api/shipments/{sh_no}/attachments/{id}`: admin or superadmin (soft deletes).
- `POST /api/shipments/{sh_no}/attachments?type=PO|INVOICE|BL|MAWB|HAWB|BOE|OTHER`: manager, admin, or superadmin.
- `GET /api/shipments/{sh_no}/attachments/{id}`: authenticated users.
- `GET /api/masters/{suppliers|ports|chas|warehouses|payment-terms|modes|countries|prw|materials}`: authenticated users.
- `POST /api/masters/{master_type}`, `PUT` and `DELETE /api/masters/{master_type}/{id}`, and `PATCH /api/masters/{master_type}/{id}/activate` or `/deactivate`: manager, admin, or superadmin.

Each master has a separate page under `/masters/`: suppliers, ports (used for both loading and landing), CHA agents, shipment modes, countries, payment terms, PRW/payment statuses, warehouses, and materials. In Payment Terms Master, `LC` is stored with the fixed label `LC`; credit-day terms require a day count and date basis and receive an automatically generated label; `Others` requires a manually entered payment-term label. Shipment Excel import adds missing supplier, material, port, CHA, mode, country, warehouse, and payment-term entries before importing rows. Payment terms created by import default to `OTHER`, have no credit days/date basis, and are marked for business review; import does not infer financial settings from the term label. Shipment entry also adds a newly entered material to the Materials master. PRW values remain fixed system statuses.

The API allocates shipment numbers in the format `{material ID}{4+ digit sequence}FY{YY}-{YY}`, restarting at `0001` for each material ID and financial year. In shipment entry, use the Add buttons to independently add PO, invoice, BL, and BOE values; the page creates one number/date row per value and joins them with `_` for the API, which inserts separate child-table rows. At least one PO and invoice are required. BL and BOE are optional and start with no rows. Proforma invoice number/date entries stay paired with the commercial invoice entries for due-date tracking. Enter one number per field; dates can be omitted unless the selected payment-term date basis requires them.
