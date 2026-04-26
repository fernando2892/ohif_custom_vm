import { create } from 'zustand';

type SeriesProgress = {
  loaded: number;
  total: number;
  failed: number;
};

type ImageLoadProgressState = {
  progressBySeriesUID: Record<string, SeriesProgress>;
  globalLoaded: number;
  globalFailed: number;
  setSeriesTotal: (seriesInstanceUID: string, total: number) => void;
  incrementLoaded: (seriesInstanceUID: string) => void;
  incrementFailed: (seriesInstanceUID: string) => void;
  resetSeries: (seriesInstanceUID: string) => void;
  resetAll: () => void;
};

export const useImageLoadProgressStore = create<ImageLoadProgressState>(set => ({
  progressBySeriesUID: {},
  globalLoaded: 0,
  globalFailed: 0,

  setSeriesTotal: (seriesInstanceUID, total) =>
    set(state => ({
      progressBySeriesUID: {
        ...state.progressBySeriesUID,
        [seriesInstanceUID]: {
          loaded: state.progressBySeriesUID[seriesInstanceUID]?.loaded ?? 0,
          total,
          failed: state.progressBySeriesUID[seriesInstanceUID]?.failed ?? 0,
        },
      },
    })),

  incrementLoaded: seriesInstanceUID =>
    set(state => {
      const prev = state.progressBySeriesUID[seriesInstanceUID] ?? {
        loaded: 0,
        total: 0,
        failed: 0,
      };
      return {
        progressBySeriesUID: {
          ...state.progressBySeriesUID,
          [seriesInstanceUID]: {
            ...prev,
            loaded: prev.loaded + 1,
          },
        },
        globalLoaded: state.globalLoaded + 1,
      };
    }),

  incrementFailed: seriesInstanceUID =>
    set(state => {
      const prev = state.progressBySeriesUID[seriesInstanceUID] ?? {
        loaded: 0,
        total: 0,
        failed: 0,
      };
      return {
        progressBySeriesUID: {
          ...state.progressBySeriesUID,
          [seriesInstanceUID]: {
            ...prev,
            failed: prev.failed + 1,
          },
        },
        globalFailed: state.globalFailed + 1,
      };
    }),

  resetSeries: seriesInstanceUID =>
    set(state => {
      const updated = { ...state.progressBySeriesUID };
      delete updated[seriesInstanceUID];
      return { progressBySeriesUID: updated };
    }),

  resetAll: () => set({ progressBySeriesUID: {}, globalLoaded: 0, globalFailed: 0 }),
}));
