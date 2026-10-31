'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { Shipment } from '@/types/shipment';

interface NotificationContextType {
  overduePayments: Shipment[];
  etaArrived: Shipment[];
  setNotifications: (overdue: Shipment[], eta: Shipment[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [overduePayments, setOverduePayments] = React.useState<Shipment[]>([]);
  const [etaArrived, setEtaArrived] = React.useState<Shipment[]>([]);

  const setNotifications = (overdue: Shipment[], eta: Shipment[]) => {
    setOverduePayments(overdue);
    setEtaArrived(eta);
  };

  return (
    <NotificationContext.Provider value={{ overduePayments, etaArrived, setNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
