import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompactionStore } from '@/stores/useCompactionStore';
import type { CompactionReport } from '@/types/compaction';

describe('useCompactionStore', () => {
  beforeEach(() => {
    useCompactionStore.setState({
      reports: [],
      selectedReportId: null,
      isDrawerOpen: false,
      isCompressing: false,
      contextUsage: {
        totalInputTokens: 0,
        estimatedWindow: 128000,
        usagePct: 0,
        lastUpdated: Date.now(),
      },
    });
  });

  it('should have expected initial state', () => {
    const state = useCompactionStore.getState();
    expect(state.reports).toEqual([]);
    expect(state.selectedReportId).toBeNull();
    expect(state.isDrawerOpen).toBe(false);
    expect(state.isCompressing).toBe(false);
    expect(state.contextUsage.totalInputTokens).toBe(0);
    expect(state.contextUsage.usagePct).toBe(0);
  });

  it('should add report', () => {
    const report: CompactionReport = {
      id: 'report_1',
      beforeTokens: 1000,
      afterTokens: 500,
      savings: 50,
      timestamp: Date.now(),
      sessionId: 'session_1',
      triggeredBy: 'auto',
    };
    useCompactionStore.getState().addReport(report);
    const state = useCompactionStore.getState();
    expect(state.reports).toHaveLength(1);
    expect(state.reports[0].id).toBe('report_1');
  });

  it('should keep at most 100 reports (FIFO)', () => {
    const addMany = useCompactionStore.getState().addReport;
    for (let i = 0; i < 105; i++) {
      addMany({
        id: `report_${i}`,
        beforeTokens: 1000,
        afterTokens: 500,
        savings: 50,
        timestamp: Date.now() + i,
        sessionId: 'session_1',
        triggeredBy: 'auto',
      });
    }
    const state = useCompactionStore.getState();
    expect(state.reports).toHaveLength(100);
    // newest report (report_104) is at the front due to [report, ...prev]
    expect(state.reports[0].id).toBe('report_104');
  });

  it('should select and clear report', () => {
    useCompactionStore.getState().selectReport('report_1');
    expect(useCompactionStore.getState().selectedReportId).toBe('report_1');
    useCompactionStore.getState().selectReport(null);
    expect(useCompactionStore.getState().selectedReportId).toBeNull();
  });

  it('should clear reports', () => {
    const report: CompactionReport = {
      id: 'report_1',
      beforeTokens: 1000,
      afterTokens: 500,
      savings: 50,
      timestamp: Date.now(),
      sessionId: 'session_1',
      triggeredBy: 'auto',
    };
    useCompactionStore.getState().addReport(report);
    useCompactionStore.getState().clearReports();
    expect(useCompactionStore.getState().reports).toEqual([]);
    expect(useCompactionStore.getState().selectedReportId).toBeNull();
  });

  it('should update context usage', () => {
    useCompactionStore.getState().updateContextUsage(10000);
    const state = useCompactionStore.getState();
    expect(state.contextUsage.totalInputTokens).toBe(10000);
    expect(state.contextUsage.usagePct).toBeGreaterThan(0);
  });

  it('should cap usagePct at 100', () => {
    useCompactionStore.getState().updateContextUsage(200000);
    const state = useCompactionStore.getState();
    expect(state.contextUsage.usagePct).toBe(100);
  });

  it('should reset context usage', () => {
    useCompactionStore.getState().updateContextUsage(50000);
    useCompactionStore.getState().resetContextUsage();
    const state = useCompactionStore.getState();
    expect(state.contextUsage.totalInputTokens).toBe(0);
    expect(state.contextUsage.usagePct).toBe(0);
  });

  it('should update settings', () => {
    useCompactionStore.getState().updateSettings({ autoThreshold: 80 });
    const state = useCompactionStore.getState();
    expect(state.settings.autoThreshold).toBe(80);
  });

  it('should reset settings', () => {
    useCompactionStore.getState().updateSettings({ autoThreshold: 80 });
    useCompactionStore.getState().resetSettings();
    const state = useCompactionStore.getState();
    expect(state.settings.autoThreshold).not.toBe(80);
  });

  it('should open/close drawer', () => {
    useCompactionStore.getState().setDrawerOpen(true);
    expect(useCompactionStore.getState().isDrawerOpen).toBe(true);
    useCompactionStore.getState().setDrawerOpen(false);
    expect(useCompactionStore.getState().isDrawerOpen).toBe(false);
  });

  it('should set compressing state', () => {
    useCompactionStore.getState().setCompressing(true);
    expect(useCompactionStore.getState().isCompressing).toBe(true);
    useCompactionStore.getState().setCompressing(false);
    expect(useCompactionStore.getState().isCompressing).toBe(false);
  });

  it('should get compression status', () => {
    const status = useCompactionStore.getState().getCompressionStatus();
    expect(status).toBeDefined();
  });

  it('should calculate total savings', () => {
    useCompactionStore.getState().addReport({
      id: 'r1', beforeTokens: 1000, afterTokens: 500, savings: 50,
      timestamp: Date.now(), sessionId: 's1', triggeredBy: 'auto',
    });
    useCompactionStore.getState().addReport({
      id: 'r2', beforeTokens: 1000, afterTokens: 300, savings: 70,
      timestamp: Date.now(), sessionId: 's1', triggeredBy: 'auto',
    });
    const savings = useCompactionStore.getState().getTotalSavings();
    // (1000-500 + 1000-300) / (1000+1000) * 100 = 1200/2000*100 = 60
    expect(savings).toBeCloseTo(60, 0);
  });

  it('should return 0 savings for empty reports', () => {
    const savings = useCompactionStore.getState().getTotalSavings();
    expect(savings).toBe(0);
  });
});
