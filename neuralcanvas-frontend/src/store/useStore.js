import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow'
import api from '../api/axios'

const useStore = create((set, get) => ({
  user: null,
  authLoading: true,
  setUser: (user) => set({ user, authLoading: false }),
  hydrateUser: async () => {
    try {
      const { data } = await api.get('/auth/me/')
      set({ user: data, authLoading: false })
    } catch {
      set({ user: null, authLoading: false })
    }
  },
  logout: async () => {
    try {
      await api.post('/auth/logout/')
    } catch {
      // ignore logout failures and clear local auth state
    }
    set({ user: null })
  },

  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  nodes: [],
  edges: [],
  setCanvasGraph: (graph = {}) =>
    set({
      nodes: graph.nodes || [],
      edges: graph.edges || [],
    }),
  clearCanvas: () => set({ nodes: [], edges: [] }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({ edges: addEdge(connection, get().edges) }),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    })),

  updateNodeData: (nodeId, newData) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      ),
    })),
}))

export default useStore