import { create } from 'zustand'

export interface SearchResult {
  name: string
  version: string
  description: string
  author?: string
  date?: string
  keywords?: string[]
}

interface SearchState {
  results: SearchResult[]
  selectedPackage: any | null
  loading: boolean
  detailLoading: boolean

  search: (query: string) => Promise<void>
  viewPackage: (packageName: string) => Promise<void>
  clearResults: () => void
}

// Monotonic request id: stale search responses must not overwrite newer ones.
let searchRequestId = 0

// Independent counter: viewPackage races (quickly viewing A then B) must not
// be judged against search requests or vice versa.
let viewRequestId = 0

export const useSearchStore = create<SearchState>((set) => ({
  results: [],
  selectedPackage: null,
  loading: false,
  detailLoading: false,

  search: async (query: string) => {
    if (!query.trim()) {
      // Invalidate any in-flight search: its response must not repopulate the
      // cleared result list after the user emptied the query.
      searchRequestId += 1
      set({ results: [], loading: false })
      return
    }

    const requestId = ++searchRequestId
    set({ loading: true })
    try {
      const results = await window.electronAPI.npm.search(query)
      if (requestId !== searchRequestId) return
      set({ results: results || [] })
    } catch (error) {
      console.error('Search failed:', error)
      if (requestId !== searchRequestId) return
      set({ results: [] })
    } finally {
      if (requestId === searchRequestId) set({ loading: false })
    }
  },

  viewPackage: async (packageName: string) => {
    const requestId = ++viewRequestId
    set({ detailLoading: true })
    try {
      const info = await window.electronAPI.npm.view(packageName)
      if (requestId !== viewRequestId) return
      set({ selectedPackage: info })
    } catch (error) {
      console.error('Failed to view package:', error)
      if (requestId !== viewRequestId) return
      set({ selectedPackage: null })
    } finally {
      if (requestId === viewRequestId) set({ detailLoading: false })
    }
  },

  clearResults: () => {
    // Invalidate in-flight searches and detail views so stale responses cannot
    // refill the store after an explicit clear.
    searchRequestId += 1
    viewRequestId += 1
    set({ results: [], selectedPackage: null, loading: false, detailLoading: false })
  }
}))