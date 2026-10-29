'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shared shipment store
   The entry/history page and the dashboard both read from here, so an add,
   edit or delete on one page shows up on the other.

   It keeps the data in this browser's localStorage, seeded from
   data/shipmentData.ts. That is a stand-in: swap the three actions below for
   your API calls when the backend is ready and nothing else needs to change.
───────────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from 'react';
import { Shipment } from '@/types/shipment';
import { shipmentData as seed } from '@/data/shipmentData';

const STORAGE_KEY = 'cumi.shipments.v2';

function read(): Shipment[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Shipment[]) : seed;
  } catch {
    return seed;
  }
}

function write(list: Shipment[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the in-memory copy still works for this session */
  }
}

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>(seed);
  /** false until the saved data has been read, so pages don't flash the starting data. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setShipments(read());
    setReady(true);
    // Keep other open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setShipments(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addShipment = useCallback((record: Shipment) => {
    setShipments((prev) => {
      const next = [record, ...prev];
      write(next);
      return next;
    });
  }, []);

  const updateShipment = useCallback((record: Shipment) => {
    setShipments((prev) => {
      const next = prev.map((s) => (s.id === record.id ? record : s));
      write(next);
      return next;
    });
  }, []);

  const deleteShipment = useCallback((id: string) => {
    setShipments((prev) => {
      const next = prev.filter((s) => s.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { shipments, ready, addShipment, updateShipment, deleteShipment };
}