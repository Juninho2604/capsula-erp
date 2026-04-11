'use client';

import { create } from 'zustand';

interface UIState {
    sidebarOpen: boolean;
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;
    posFullscreen: boolean;
    togglePosFullscreen: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    sidebarOpen: false,
    openSidebar: () => set({ sidebarOpen: true }),
    closeSidebar: () => set({ sidebarOpen: false }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    posFullscreen: false,
    togglePosFullscreen: () => set((state) => ({ posFullscreen: !state.posFullscreen })),
}));
