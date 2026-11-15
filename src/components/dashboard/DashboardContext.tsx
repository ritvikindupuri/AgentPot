'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { HoneypotEvent, Session } from '@/lib/types';

export interface TelemetryStats {
  totalEvents: number;
  totalSessions: number;
  eventTypeCounts: Record<string, number>;
  agentFamilyCounts: Record<string, number>;
  toolCallCounts: Record<string, number>;
  credentialUses: Record<string, number>;
  canaryStats: Array<{ canary: any; hits: number }>;
  timelineBuckets: Record<string, number>;
}

interface DashboardContextType {
  events: HoneypotEvent[];
  sessions: Session[];
  stats: TelemetryStats | null;
  loading: boolean;
  lastPollFailed: boolean;
  selectedSessionId: string | null;
  openSessionDrawer: (sessionId: string) => void;
  closeSessionDrawer: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<HoneypotEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPollFailed, setLastPollFailed] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const openSessionDrawer = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const closeSessionDrawer = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  const fetchData = useCallback(async () => {
    // If tab is hidden in background, pause polling to save resources
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      const [eventsRes, sessionsRes, statsRes] = await Promise.all([
        fetch('/api/events?limit=150'),
        fetch('/api/sessions?limit=50'),
        fetch('/api/stats'),
      ]);

      if (!eventsRes.ok || !sessionsRes.ok || !statsRes.ok) {
        setLastPollFailed(true);
        return;
      }

      const [eventsData, sessionsData, statsData] = await Promise.all([
        eventsRes.json(),
        sessionsRes.json(),
        statsRes.json(),
      ]);

      setEvents(eventsData);
      setSessions(sessionsData);
      setStats(statsData);
      setLastPollFailed(false);
    } catch {
      setLastPollFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  return (
    <DashboardContext.Provider
      value={{
        events,
        sessions,
        stats,
        loading,
        lastPollFailed,
        selectedSessionId,
        openSessionDrawer,
        closeSessionDrawer,
        searchTerm,
        setSearchTerm,
        refresh: fetchData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardData(): DashboardContextType {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider');
  }
  return context;
}
