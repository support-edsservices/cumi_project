'use client';

import { useCallback, useEffect, useState } from 'react';
import { BASE_URL } from '@/data/ENUM';
import { Shipment, ShipmentDocument } from '@/types/shipment';
import { useAuth } from '@/context/AuthContext';

export type ShipmentDocumentType = 'PO' | 'INVOICE' | 'BL' | 'MAWB' | 'HAWB' | 'BOE' | 'OTHER';

export interface ShipmentImportResult {
  rowNumber: number;
  shipment?: Shipment;
  skipped?: boolean;
  error?: string;
  statusCode?: number;
}

const SHIPMENT_PAGE_SIZE = 500;

const DOCUMENT_PROPERTIES: Partial<Record<ShipmentDocumentType, keyof Shipment>> = {
  PO: 'poDocument',
  INVOICE: 'invoiceDocument',
  BL: 'blDocument',
  MAWB: 'mawbDocument',
  HAWB: 'hawbDocument',
  BOE: 'boeDocument',
};

async function responseError(response: Response, fallback: string): Promise<Error> {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return new Error(data.detail);
  }
  if (data && typeof data === 'object' && 'detail' in data && Array.isArray(data.detail)) {
    const messages = data.detail.flatMap((item: unknown) => (
      item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string'
        ? [item.msg]
        : []
    ));
    if (messages.length) return new Error(messages.join('; '));
  }
  return new Error(fallback);
}

function shipmentFromApi(shipment: Shipment): Shipment {
  const normalized = { ...shipment };
  const documentKeys = ['poDocument', 'invoiceDocument', 'blDocument', 'mawbDocument', 'hawbDocument', 'boeDocument'] as const;
  for (const key of documentKeys) {
    const document = normalized[key] as ShipmentDocument | undefined;
    if (document?.url.startsWith('/')) {
      normalized[key] = { ...document, url: `${BASE_URL}${document.url}` };
    }
  }
  return normalized;
}

function uniqueShipments(shipments: Shipment[]): Shipment[] {
  const seen = new Set<string>();
  return shipments.filter((shipment) => {
    if (seen.has(shipment.id)) return false;
    seen.add(shipment.id);
    return true;
  });
}

export function useShipments() {
  const { fetchWithAuth } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadShipments() {
      try {
        const data: Shipment[] = [];
        let offset = 0;
        while (true) {
          const response = await fetchWithAuth(
            `${BASE_URL}/api/shipments?limit=${SHIPMENT_PAGE_SIZE}&offset=${offset}`,
          );
          if (!response.ok) throw await responseError(response, 'Could not load shipments.');
          const page: Shipment[] = await response.json();
          if (!Array.isArray(page)) throw new Error('Shipment list response was invalid.');
          data.push(...page);
          if (page.length < SHIPMENT_PAGE_SIZE) break;
          offset += page.length;
        }
        if (active) {
          setShipments(uniqueShipments(data.map(shipmentFromApi)));
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load shipments.');
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void loadShipments();
    return () => {
      active = false;
    };
  }, [fetchWithAuth]);

  const addShipment = useCallback(async (record: Shipment): Promise<Shipment> => {
    const response = await fetchWithAuth(`${BASE_URL}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw await responseError(response, 'Could not save shipment.');
    const saved: Shipment = shipmentFromApi(await response.json());
    setShipments((current) => uniqueShipments([saved, ...current]));
    setError(null);
    return saved;
  }, [fetchWithAuth]);

  const importShipments = useCallback(async (
    rows: { rowNumber: number; shipmentId: string; shipment: Shipment }[],
    fiscalYearCode: string | null,
  ): Promise<ShipmentImportResult[]> => {
    const response = await fetchWithAuth(`${BASE_URL}/api/shipments/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, fiscalYearCode }),
    });
    if (!response.ok) throw await responseError(response, 'Could not import shipments.');

    const data: { results: ShipmentImportResult[] } = await response.json();
    const imported = data.results
      .filter((result): result is ShipmentImportResult & { shipment: Shipment } => Boolean(result.shipment))
      .map((result) => shipmentFromApi(result.shipment));
    if (imported.length) {
      setShipments((current) => uniqueShipments([...imported, ...current]));
      setError(null);
    }
    return data.results;
  }, [fetchWithAuth]);

  const updateShipment = useCallback(async (record: Shipment): Promise<Shipment> => {
    const response = await fetchWithAuth(`${BASE_URL}/api/shipments/${encodeURIComponent(record.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw await responseError(response, 'Could not update shipment.');
    const saved: Shipment = shipmentFromApi(await response.json());
    setShipments((current) => uniqueShipments(
      current.map((shipment) => shipment.id === saved.id ? saved : shipment),
    ));
    setError(null);
    return saved;
  }, [fetchWithAuth]);

  const deleteShipment = useCallback(async (id: string): Promise<void> => {
    const response = await fetchWithAuth(`${BASE_URL}/api/shipments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw await responseError(response, 'Could not delete shipment.');
    setShipments((current) => current.filter((shipment) => shipment.id !== id));
    setError(null);
  }, [fetchWithAuth]);

  const uploadAttachment = useCallback(async (
    shNo: string,
    type: ShipmentDocumentType,
    file: File,
  ): Promise<ShipmentDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetchWithAuth(
      `${BASE_URL}/api/shipments/${encodeURIComponent(shNo)}/attachments?type=${type}`,
      { method: 'POST', body: formData },
    );
    if (!response.ok) throw await responseError(response, `Could not upload ${type} document.`);
    const uploaded = await response.json() as ShipmentDocument & { docType: ShipmentDocumentType };
    const document = {
      ...uploaded,
      url: uploaded.url.startsWith('/') ? `${BASE_URL}${uploaded.url}` : uploaded.url,
    };
    const property = DOCUMENT_PROPERTIES[type];
    if (property) {
      setShipments((current) => current.map((shipment) => (
        shipment.id === shNo ? { ...shipment, [property]: document } : shipment
      )));
    }
    return document;
  }, [fetchWithAuth]);

  return { shipments, ready, error, addShipment, importShipments, updateShipment, deleteShipment, uploadAttachment };
}
