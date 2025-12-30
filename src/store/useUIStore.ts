/**
 * Zustand store para UI state.
 *
 * SOLO para estado de interfaz de usuario:
 * - Filtros activos, busqueda
 * - Elementos seleccionados
 * - Estado de modals/drawers
 * - Tab activo, paso de wizard
 * - Preferencias de vista
 *
 * NUNCA para datos del servidor:
 * - Lista de entidades (usar useQuery)
 * - Datos de API (usar useQuery)
 * - Loading/error de fetch (TanStack Query lo maneja)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ============================================
// TIPOS
// ============================================

interface UIState {
  // Seleccion
  selectedId: string | null;
  selectedIds: string[];

  // Filtros
  searchTerm: string;
  activeFilters: Record<string, string>;

  // UI
  activeTab: string;
  isModalOpen: boolean;
  isSidebarOpen: boolean;

  // Actions
  setSelectedId: (id: string | null) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setSearchTerm: (term: string) => void;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  setActiveTab: (tab: string) => void;
  toggleModal: () => void;
  toggleSidebar: () => void;
  reset: () => void;
}

// ============================================
// ESTADO INICIAL
// ============================================

const initialState = {
  selectedId: null,
  selectedIds: [],
  searchTerm: '',
  activeFilters: {},
  activeTab: 'overview',
  isModalOpen: false,
  isSidebarOpen: false,
};

// ============================================
// STORE
// ============================================

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      ...initialState,

      // Seleccion simple
      setSelectedId: (id) =>
        set({ selectedId: id }, false, 'ui/setSelectedId'),

      // Seleccion multiple (toggle)
      toggleSelection: (id) =>
        set(
          (state) => ({
            selectedIds: state.selectedIds.includes(id)
              ? state.selectedIds.filter((i) => i !== id)
              : [...state.selectedIds, id],
          }),
          false,
          'ui/toggleSelection',
        ),

      clearSelection: () =>
        set({ selectedId: null, selectedIds: [] }, false, 'ui/clearSelection'),

      // Filtros
      setSearchTerm: (term) =>
        set({ searchTerm: term }, false, 'ui/setSearchTerm'),

      setFilter: (key, value) =>
        set(
          (state) => ({
            activeFilters: { ...state.activeFilters, [key]: value },
          }),
          false,
          'ui/setFilter',
        ),

      clearFilters: () =>
        set({ searchTerm: '', activeFilters: {} }, false, 'ui/clearFilters'),

      // UI
      setActiveTab: (tab) =>
        set({ activeTab: tab }, false, 'ui/setActiveTab'),

      toggleModal: () =>
        set((state) => ({ isModalOpen: !state.isModalOpen }), false, 'ui/toggleModal'),

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'ui/toggleSidebar'),

      // Reset completo
      reset: () =>
        set(initialState, false, 'ui/reset'),
    }),
    { name: 'ui-store' },
  ),
);

// ============================================
// SELECTORES (opcional, para logica derivada)
// ============================================

export const selectHasSelection = (state: UIState) =>
  state.selectedId !== null || state.selectedIds.length > 0;

export const selectHasFilters = (state: UIState) =>
  state.searchTerm !== '' || Object.keys(state.activeFilters).length > 0;
