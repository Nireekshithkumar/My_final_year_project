import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import NodePalette from '../components/NodePalette'
import TaskNode from '../components/nodes/TaskNode'
import DatasetUpload from '../components/DatasetUpload'
import ParamEditor from '../components/ParamEditor'
import Toolbar from '../components/Toolbar'
import DatasetViewer from '../components/DatasetViewer'
import TransformationHistory from '../components/TransformationHistory'
import ChartPanel from '../components/ChartPanel'
import ExecutionLogs from '../components/ExecutionLogs'
import ErrorBoundary from '../components/ErrorBoundary'
import { PARAM_SCHEMAS } from '../config/paramSchemas'
import api from '../api/axios'
import useStore from '../store/useStore'
import DatasetProfileModal from '../components/DatasetProfileModal'
import AutoMLModal from '../components/AutoMLModal'
import ModelCompareModal from '../components/ModelCompareModal'
import ModelRegistryModal from '../components/ModelRegistryModal'
import WhatIfModal from '../components/WhatIfModal'
import AICopilotPanel from '../components/AICopilotPanel'

const nodeTypes = { taskNode: TaskNode }
let idCounter = 1
const getId = () => `node_${idCounter++}`

// Advance the module-level counter past the highest numeric node ID that
// was loaded from the backend, so new nodes never collide with existing ones.
function syncIdCounterWithNodes(loadedNodes) {
  let maxNum = 0
  for (const n of loadedNodes) {
    const match = String(n.id || '').match(/^node_(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }
  if (maxNum >= idCounter) {
    idCounter = maxNum + 1
  }
}

const OUTPUT_PRESETS = {
  approval: [
    { id: 'approve', label: 'Approve Task', color: '#22c55e' },
    { id: 'reject', label: 'Reject Task', color: '#ef4444' },
  ],
  default: [{ id: 'next', label: 'Connection Task', color: '#22c55e' }],
}

const FlowCanvas = forwardRef(function FlowCanvas(
  {
    pipelineId,
    onStatusChange,
    isDark,
    refreshTrigger,
    setRefreshTrigger,
    logs = [],
    setLogs,
    progress = 0,
    setProgress,
    status = 'idle',
    setPredictionResult,
    showLeftPanel = true,
    showRightPanel = true,
    showBottomPanel = true,
    setActiveDatasetId,
  },
  ref
) {
  const reactFlowWrapper = useRef(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  // Resizable panel dimensions
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(350)
  const [bottomHeight, setBottomHeight] = useState(230)

  const [activeTab, setActiveTab] = useState('config') // 'config' | 'charts' | 'logs'
  const [error, setError] = useState('')

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)

  const updateNodeData = useCallback(
    (nodeId, newData) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
        )
      )
    },
    [setNodes]
  )

  const getUpstreamColumns = useCallback(
    (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return []
      visited.add(nodeId)
      const parentEdge = edges.find((e) => e.target === nodeId)
      if (!parentEdge) return []
      const parentNode = nodes.find((n) => n.id === parentEdge.source)
      if (!parentNode) return []

      if (parentNode.data?.nodeType === 'splitDataset') {
        const allCols = getUpstreamColumns(parentNode.id, visited)
        const rawTarget =
          parentNode.data.params?.target_column ||
          parentNode.data.params?.targetColumn ||
          parentNode.data.params?.target ||
          parentNode.data.params?.label_column ||
          parentNode.data.params?.label
        const target = rawTarget ? String(rawTarget).trim() : ''
        return target ? allCols.filter((c) => c !== target) : allCols
      }

      if (parentNode.data?.columns?.length > 0) {
        return parentNode.data.columns.map((c) => String(c).trim()).filter(Boolean)
      }
      return getUpstreamColumns(parentNode.id, visited)
    },
    [edges, nodes]
  )

  const getUpstreamColumnTypes = useCallback(
    (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return {}
      visited.add(nodeId)
      const parentEdge = edges.find((e) => e.target === nodeId)
      if (!parentEdge) return {}
      const parentNode = nodes.find((n) => n.id === parentEdge.source)
      if (!parentNode) return {}
      if (parentNode.data?.columnTypes && Object.keys(parentNode.data.columnTypes).length > 0)
        return parentNode.data.columnTypes
      return getUpstreamColumnTypes(parentNode.id, visited)
    },
    [edges, nodes]
  )

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const handlePredict = useCallback(
    async (nodeId) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
      const title = node?.data?.title || nodeId
      const featureValues = node?.data?.params?.feature_values || {}

      if (setLogs) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'PREDICT',
            message: `🔮 Requesting inference for block '${title}'…`,
          },
        ])
      }

      updateNodeData(nodeId, { status: 'running' })

      try {
        const { data } = await api.post(`/pipelines/${pipelineId}/predict/`, {
          feature_values: featureValues,
        })
        updateNodeData(nodeId, { lastPrediction: data.prediction, status: 'success' })
        if (onStatusChange) onStatusChange('success')
        if (setPredictionResult) setPredictionResult(`🎯 Predicted: ${data.prediction}`)
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'PREDICT',
              message: `🎯 Prediction result for '${title}': ${data.prediction}`,
            },
          ])
        }
      } catch (err) {
        const errMsg = err.response?.data?.error || 'Prediction failed'
        updateNodeData(nodeId, {
          lastPrediction: 'Error: ' + errMsg,
          status: 'failed',
        })
        if (onStatusChange) onStatusChange('failed')
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: `❌ Inference failed for '${title}': ${errMsg}`,
            },
          ])
        }
      }
    },
    [pipelineId, updateNodeData, setLogs, onStatusChange, setPredictionResult]
  )

  const handleDownload = useCallback(
    (nodeId, params) => {
      if (!pipelineId) return
      window.location.href = `/api/pipelines/${pipelineId}/download/`
    },
    [pipelineId]
  )

  const handleRunNode = useCallback(
    async (nodeId) => {
      const targetNode = nodesRef.current.find((n) => n.id === nodeId)
      const title = targetNode?.data?.title || nodeId
      const nodeType = targetNode?.data?.nodeType

      // Guard: loadDataset nodes must have a dataset attached before running.
      if (nodeType === 'loadDataset' && !targetNode?.data?.datasetId) {
        const msg = `Please select a dataset for '${title}' before running this block.`
        setError(msg)
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: `⚠️ ${msg}`,
            },
          ])
        }
        return
      }

      updateNodeData(nodeId, { status: 'running' })
      setError('')

      if (setLogs) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: nodeType || 'NODE',
            message: `⚡ Quick-running block: ${title}…`,
          },
        ])
      }

      // Sync the graph to the backend before running so the backend's node table
      // always matches the current React state. Without this, any unsaved node
      // addition causes a "Node not found" 404 on the run endpoint.
      try {
        if (pipelineId) {
          await api.put(`/pipelines/${pipelineId}/graph/`, {
            nodes: nodesRef.current,
            edges: edgesRef.current,
          })
        }
      } catch (saveErr) {
        const saveMsg =
          saveErr.response?.data?.non_field_errors?.[0] ||
          saveErr.response?.data?.detail ||
          'Failed to save graph before running block.'
        setError(saveMsg)
        updateNodeData(nodeId, { status: 'failed' })
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: `❌ Could not save graph: ${saveMsg}`,
            },
          ])
        }
        return
      }

      try {
        const { data } = await api.post(`/pipelines/${pipelineId}/nodes/${nodeId}/run/`)
        const result = data?.result || {}
        const newCols =
          Array.isArray(result.columns) && result.columns.length > 0
            ? result.columns.map((c) => String(c).trim())
            : null
        updateNodeData(nodeId, {
          status: 'success',
          lastError: null,
          errorType: null,
          availableColumns: null,
          ...(newCols ? { columns: newCols } : {}),
        })
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'SUCCESS',
              message: `✅ Block '${title}' finished successfully.`,
            },
          ])
        }
        setRefreshTrigger((t) => t + 1)
      } catch (err) {
        const resData = err.response?.data
        const msg =
          resData?.message ||
          resData?.detail ||
          resData?.error ||
          (typeof resData === 'string' ? resData : 'Node execution failed.')
        const errType = resData?.error || null
        const availCols = resData?.available_columns || null
        setError(msg)
        updateNodeData(nodeId, {
          status: 'failed',
          lastError: msg,
          errorType: errType,
          availableColumns: availCols,
        })
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: `❌ Block '${title}' failed: ${msg}`,
            },
          ])
        }
      }
    },
    [pipelineId, updateNodeData, setRefreshTrigger, setLogs, setError]
  )

  const onConnect = useCallback(
    (params) =>
      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          currentEdges
        )
      ),
    [setEdges]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow-type')
      const label = event.dataTransfer.getData('application/reactflow-label')
      const color = event.dataTransfer.getData('application/reactflow-color')
      const icon = event.dataTransfer.getData('application/reactflow-icon')

      if (!type) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode = {
        id: getId(),
        type: 'taskNode',
        position,
        data: {
          nodeType: type,
          icon,
          iconColor: color,
          title: label,
          subtitle: label,
          checked: true,
          status: 'ready',
          outputs: type === 'end' ? [] : OUTPUT_PRESETS[type] || OUTPUT_PRESETS.default,
          onPredict: handlePredict,
          onRunNode: handleRunNode,
          onDownload: handleDownload,
        },
      }
      setNodes((currentNodes) => currentNodes.concat(newNode))
      onStatusChange('idle')
    },
    [onStatusChange, screenToFlowPosition, setNodes, handlePredict, handleRunNode, handleDownload]
  )

  // Client-side defensive DAG validation
  const validateGraphStructure = useCallback((nodeList, edgeList) => {
    const nodeIds = new Set(nodeList.map((n) => String(n.id)))

    for (const e of edgeList) {
      if (!nodeIds.has(String(e.source))) {
        return { valid: false, error: `Connection references non-existent source block: ${e.source}` }
      }
      if (!nodeIds.has(String(e.target))) {
        return { valid: false, error: `Connection references non-existent target block: ${e.target}` }
      }
      if (String(e.source) === String(e.target)) {
        return { valid: false, error: `Self-loop connection detected on block: ${e.source}` }
      }
    }

    const adj = {}
    nodeList.forEach((n) => {
      adj[String(n.id)] = []
    })
    edgeList.forEach((e) => {
      if (adj[String(e.source)]) adj[String(e.source)].push(String(e.target))
    })

    const WHITE = 0,
      GREY = 1,
      BLACK = 2
    const color = {}
    nodeList.forEach((n) => {
      color[String(n.id)] = WHITE
    })

    const dfs = (v) => {
      color[v] = GREY
      for (const w of adj[v] || []) {
        if (color[w] === GREY) return true
        if (color[w] === WHITE && dfs(w)) return true
      }
      color[v] = BLACK
      return false
    }

    const cycleDetected = nodeList.some((n) => color[String(n.id)] === WHITE && dfs(String(n.id)))
    if (cycleDetected) {
      return { valid: false, error: '⚠️ Your pipeline contains a cycle (loop). Connections must flow strictly in one direction.' }
    }
    return { valid: true }
  }, [])

  const saveGraph = useCallback(async () => {
    if (!pipelineId) return

    const validation = validateGraphStructure(nodes, edges)
    if (!validation.valid) {
      onStatusChange('failed')
      setError(validation.error)
      return
    }

    try {
      onStatusChange('saving')
      await api.put(`/pipelines/${pipelineId}/graph/`, { nodes, edges })
      onStatusChange('saved')
      setError('')
    } catch (err) {
      onStatusChange('failed')
      const serverMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        'Unable to save the workflow.'
      setError(serverMsg)
    }
  }, [edges, nodes, onStatusChange, pipelineId, validateGraphStructure])

  const runGraph = useCallback(async () => {
    if (!pipelineId) return

    const validation = validateGraphStructure(nodes, edges)
    if (!validation.valid) {
      setError(validation.error)
      if (setLogs) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'ERROR',
            message: `⚠️ Validation error: ${validation.error}`,
          },
        ])
      }
      return
    }

    try {
      setError('')
      onStatusChange('running')
      const startNode = nodes.find((n) => n.data?.nodeType === 'start') || nodes[0]
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            status: n.id === startNode?.id ? 'running' : 'pending',
          },
        }))
      )
      if (setLogs) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'START',
            message: `🚀 Initiating pipeline DAG execution across ${nodes.length} blocks…`,
          },
        ])
      }
      await api.post(`/pipelines/${pipelineId}/execute/`)
    } catch (err) {
      if (err.response?.status === 409) {
        onStatusChange('running')
        const msg = err.response?.data?.message || 'Pipeline is already running.'
        setError(msg)
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'RUNNING',
              message: `ℹ️ ${msg}`,
            },
          ])
        }
      } else {
        onStatusChange('failed')
        const errDetail = err.response?.data?.detail || err.response?.data?.message || 'Unable to run the workflow.'
        setError(errDetail)
        setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'failed' } })))
        if (setLogs) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: `❌ Pipeline trigger failed: ${errDetail}`,
            },
          ])
        }
      }
    }
  }, [edges, nodes, onStatusChange, pipelineId, setNodes, validateGraphStructure, setLogs])

  const clearGraph = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    onStatusChange('idle')
  }, [onStatusChange, setEdges, setNodes])

  useImperativeHandle(
    ref,
    () => ({
      saveGraph,
      runGraph,
      clearGraph,
      zoomIn: () => zoomIn({ duration: 300 }),
      zoomOut: () => zoomOut({ duration: 300 }),
      fitView: () => fitView({ duration: 400, padding: 0.2 }),
    }),
    [clearGraph, runGraph, saveGraph, zoomIn, zoomOut, fitView]
  )

  useEffect(() => {
    const loadGraph = async () => {
      if (!pipelineId) return

      // Show a transient loading message while the async fetch is in flight so
      // the user never sees the misleading "0 blocks configured" message.
      if (setLogs) {
        setLogs([
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'INFO',
            message: '⏳ Loading pipeline graph…',
          },
        ])
      }

      try {
        const { data } = await api.get(`/pipelines/${pipelineId}/graph/`)

        // Fetch datasets to enrich loadDataset nodes with column metadata if needed
        let datasetMap = {}
        try {
          const dsRes = await api.get('/datasets/')
          const list = Array.isArray(dsRes.data) ? dsRes.data : dsRes.data.results || []
          list.forEach((d) => {
            datasetMap[String(d.id)] = d
          })
        } catch {
          // ignore dataset fetch error
        }

        const loadedNodes = (data.nodes || []).map((n) => {
          const nType = n.data?.nodeType || n.type
          const fallbackOutputs = nType === 'end' ? [] : (OUTPUT_PRESETS[nType] || OUTPUT_PRESETS.default)
          const outputs = n.data?.outputs !== undefined && n.data?.outputs !== null
            ? n.data.outputs
            : fallbackOutputs

          let extraData = {}
          if (n.data?.nodeType === 'loadDataset') {
            const dsId = n.data?.datasetId || n.data?.dataset_id
            const ds = dsId ? datasetMap[String(dsId)] : null
            if (ds) {
              const dsColTypes = ds.column_types && Object.keys(ds.column_types).length > 0
                ? ds.column_types : null
              const nodeColTypes = n.data.columnTypes && Object.keys(n.data.columnTypes).length > 0
                ? n.data.columnTypes : null
              const dsCols = Array.isArray(ds.columns) && ds.columns.length > 0
                ? ds.columns : null
              const nodeCols = Array.isArray(n.data.columns) && n.data.columns.length > 0
                ? n.data.columns : null
              extraData = {
                datasetId: String(ds.id),
                dataset_id: String(ds.id),
                filename: ds.name,
                columns: dsCols || nodeCols || [],
                columnTypes: dsColTypes || nodeColTypes || {},
                subtitle: ds.name || n.data.subtitle,
              }
            } else if (dsId) {
              extraData = {
                datasetId: String(dsId),
                dataset_id: String(dsId),
              }
            }
          }
          return {
            ...n,
            data: {
              ...n?.data,
              outputs,
              ...extraData,
              onPredict: handlePredict,
              onRunNode: handleRunNode,
              onDownload: handleDownload,
              status: n?.data?.status || 'ready',
            },
          }
        })

        const loadedEdges = (data.edges || []).map((e) => ({
          ...e,
          type: e.type || 'smoothstep',
          animated: e.animated !== undefined ? e.animated : true,
          markerEnd: e.markerEnd || { type: MarkerType.ArrowClosed },
        }))

        // Advance idCounter past the highest existing node number so that any
        // node added after this load won't collide with a backend ID.
        syncIdCounterWithNodes(loadedNodes)

        setNodes(loadedNodes)
        setEdges(loadedEdges)

        if (data.status === 'success') {
          if (onStatusChange) onStatusChange('success')
          if (setProgress) setProgress(100)
        } else if (data.status === 'failed') {
          if (onStatusChange) onStatusChange('failed')
        } else if (data.status === 'idle') {
          if (onStatusChange) onStatusChange('idle')
        }

        if (setLogs) {
          if (data.status === 'success' && data.elapsed_seconds) {
            setLogs([
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'INFO',
                message: `✨ Pipeline loaded. Last run finished in ${data.elapsed_seconds}s (Status: Success). Ready for execution.`,
              },
            ])
          } else if (data.status === 'failed' && data.error) {
            setLogs([
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'ERROR',
                message: `⚠️ Last run failed: ${data.error}`,
              },
            ])
          } else {
            const blockWord = loadedNodes.length === 1 ? 'block' : 'blocks'
            setLogs([
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'INFO',
                message: loadedNodes.length === 0
                  ? `📋 Pipeline canvas is empty. Drag blocks from the left panel to build your workflow.`
                  : `📋 Pipeline canvas ready (${loadedNodes.length} ${blockWord} configured). Click 'Run' to execute.`,
              },
            ])
          }
        }
      } catch {
        // Graph doesn't exist yet (new pipeline) — show a helpful prompt.
        if (setLogs) {
          setLogs([
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'INFO',
              message: '📋 New pipeline — drag blocks from the left panel to start building.',
            },
          ])
        }
      }
    }

    loadGraph()
  }, [pipelineId, handlePredict, handleRunNode, setNodes, setEdges, setLogs, onStatusChange, setProgress])

  // ── Helper to synchronize backend node statuses onto local ReactFlow nodes ─
  const syncNodeStatusesFromBackend = useCallback(
    (backendNodes) => {
      if (!Array.isArray(backendNodes) || backendNodes.length === 0) return
      const statusMap = new Map()
      const colsMap = new Map()
      for (const bn of backendNodes) {
        if (bn && bn.id) {
          statusMap.set(String(bn.id), bn.data?.status || 'ready')
          if (bn.data?.columns) {
            colsMap.set(String(bn.id), bn.data.columns)
          }
        }
      }
      setNodes((nds) =>
        nds.map((n) => {
          const bStatus = statusMap.get(String(n.id))
          const bCols = colsMap.get(String(n.id))
          if (bStatus || bCols) {
            return {
              ...n,
              data: {
                ...n.data,
                ...(bStatus ? { status: bStatus } : {}),
                ...(bCols ? { columns: bCols } : {}),
              },
            }
          }
          return n
        })
      )
    },
    [setNodes]
  )

  // ── HTTP Polling fallback for pipeline status ──────────────────────────────
  // WebSockets on Render free-tier can silently disconnect. This effect polls
  // GET /pipelines/{id}/graph/ every 2 s while status === 'running' so the UI
  // always transitions to success/failed even without a WS delivery.
  useEffect(() => {
    if (status !== 'running' || !pipelineId) return

    const intervalId = setInterval(async () => {
      try {
        const { data } = await api.get(`/pipelines/${pipelineId}/graph/`)
        const polledStatus = data?.status

        if (polledStatus === 'success') {
          clearInterval(intervalId)
          if (onStatusChange) onStatusChange('success')
          if (setProgress) setProgress(100)
          // Synchronize granular node statuses from backend
          if (Array.isArray(data?.nodes) && data.nodes.length > 0) {
            syncNodeStatusesFromBackend(data.nodes)
          } else {
            setNodes((nds) =>
              nds.map((n) => ({ ...n, data: { ...n.data, status: 'success' } }))
            )
          }
          if (setLogs) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'SUCCESS',
                message: data.elapsed_seconds
                  ? `✅ Pipeline completed in ${data.elapsed_seconds}s.`
                  : '✅ Pipeline completed successfully.',
              },
            ])
          }
        } else if (polledStatus === 'failed') {
          clearInterval(intervalId)
          if (onStatusChange) onStatusChange('failed')
          // Synchronize granular node statuses from backend (success, failed, skipped)
          if (Array.isArray(data?.nodes) && data.nodes.length > 0) {
            syncNodeStatusesFromBackend(data.nodes)
          } else {
            setNodes((nds) =>
              nds.map((n) => ({
                ...n,
                data: { ...n.data, status: n.data.status === 'running' ? 'failed' : n.data.status },
              }))
            )
          }
          if (setLogs) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date().toLocaleTimeString(),
                stage: 'ERROR',
                message: `❌ Pipeline failed: ${data.error || 'An error occurred during execution.'}`,
              },
            ])
          }
        }
        // While polledStatus === 'running', synchronize in-flight node updates if available
        else if (polledStatus === 'running' && Array.isArray(data?.nodes) && data.nodes.length > 0) {
          syncNodeStatusesFromBackend(data.nodes)
        }
      } catch {
        // Network error during poll — keep retrying until interval is cleared.
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [status, pipelineId, onStatusChange, setProgress, setNodes, setLogs, syncNodeStatusesFromBackend])

  // Left Panel Resize Drag Handle
  const handleLeftResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 160), 460)
      setLeftWidth(newWidth)
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Right Panel Resize Drag Handle
  const handleRightResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 240), 750)
      setRightWidth(newWidth)
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Transformation History Stepper */}
      <TransformationHistory
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        isDark={isDark}
      />

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '8px 16px',
            fontSize: 12,
            color: '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 20,
          }}
        >
          <span>⚠ {error}</span>
          <button
            onClick={() => setError('')}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Resizable Canvas Container */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Left Node Library (Sidebar) */}
        {showLeftPanel && (
          <div style={{ width: leftWidth, height: '100%', display: 'flex', flexShrink: 0 }}>
            <NodePalette width={leftWidth} />
          </div>
        )}

        {/* Left Resizer Divider Handle */}
        {showLeftPanel && (
          <div
            onMouseDown={handleLeftResize}
            style={{
              width: 5,
              height: '100%',
              cursor: 'col-resize',
              background: 'transparent',
              position: 'relative',
              zIndex: 15,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ff0071')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Drag to resize Node Palette"
          />
        )}

        {/* Center Canvas Area with ReactFlow and Bottom Dataset Viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 200, overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 150 }} ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              connectionRadius={32}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#ff0071', strokeWidth: 2, strokeDasharray: '5, 5' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#ff0071', width: 18, height: 18 },
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="rgba(255, 0, 113, 0.15)" />
              <Controls />
            </ReactFlow>
          </div>

          {/* Bottom Dataset Viewer / Data Table Panel */}
          {showBottomPanel && (
            <DatasetViewer
              pipelineId={pipelineId}
              selectedNodeId={selectedNodeId}
              isDark={isDark}
              refreshTrigger={refreshTrigger}
              height={bottomHeight}
              onHeightChange={setBottomHeight}
            />
          )}
        </div>

        {/* Right Resizer Divider Handle */}
        {showRightPanel && (
          <div
            onMouseDown={handleRightResize}
            style={{
              width: 5,
              height: '100%',
              cursor: 'col-resize',
              background: 'transparent',
              position: 'relative',
              zIndex: 15,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ff0071')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Drag to resize Inspector & Logs panel"
          />
        )}

        {/* Right Dock Panel (Config / EDA & Metrics / Logs) */}
        {showRightPanel && (
          <div
            style={{
              width: rightWidth,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(10, 15, 26, 0.95)',
              color: '#e2e8f0',
              backdropFilter: 'blur(16px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0,
            }}
          >
            {/* Tab Switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '0 4px' }}>
              {[
                { id: 'config', label: '⚙ Config' },
                { id: 'charts', label: '📈 EDA & Metrics' },
                { id: 'logs', label: `📋 Logs${logs.length ? ` (${logs.length})` : ''}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 4px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    border: 'none',
                    background: 'transparent',
                    color: activeTab === tab.id ? '#ff85be' : '#64748b',
                    cursor: 'pointer',
                    borderBottom: activeTab === tab.id ? '2px solid #ff0071' : '2px solid transparent',
                    transition: 'all 0.2s',
                    letterSpacing: 0.1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: 'auto' }}>
              {activeTab === 'config' && selectedNode && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 16,
                      paddingBottom: 10,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>⚙️</span>
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc' }}>
                      {selectedNode.data?.title || 'Node Config'}
                    </h3>
                  </div>

                  {selectedNode.data?.nodeType === 'loadDataset' && (
                    <DatasetUpload
                      onUploaded={(dataset) => {
                        const trimmedCols = (dataset.columns || []).map((c) => String(c).trim()).filter(Boolean);
                        const cleanTypes = {};
                        if (dataset.column_types && typeof dataset.column_types === 'object') {
                          Object.entries(dataset.column_types).forEach(([k, v]) => {
                            cleanTypes[String(k).trim()] = v;
                          });
                        }
                        updateNodeData(selectedNode.id, {
                          datasetId: String(dataset.id),
                          dataset_id: String(dataset.id),
                          filename: dataset.name,
                          columns: trimmedCols,
                          columnTypes: cleanTypes,
                          subtitle: dataset.name,
                          status: 'ready',
                          lastError: null,
                          errorType: null,
                        })
                        if (setActiveDatasetId) setActiveDatasetId(String(dataset.id))
                        setRefreshTrigger((t) => t + 1)
                      }}
                    />
                  )}

                  {selectedNode.data?.nodeType && PARAM_SCHEMAS[selectedNode.data.nodeType] !== undefined && (
                    <ParamEditor
                      nodeType={selectedNode.data.nodeType}
                      params={selectedNode.data.params || {}}
                      onChange={(newParams) =>
                        updateNodeData(selectedNode.id, { params: newParams, checked: true })
                      }
                      dark={isDark}
                      columnTypes={getUpstreamColumnTypes(selectedNode.id)}
                      columns={
                        selectedNode.data.nodeType === 'Encoder'
                          ? Object.entries(getUpstreamColumnTypes(selectedNode.id))
                              .filter(([, t]) => t === 'categorical' || t === 'text')
                              .map(([name]) => name)
                          : [
                              'splitDataset',
                              'StandardScaler',
                              'MinMaxScaler',
                              'RobustScaler',
                              'MaxAbsScaler',
                              'Normalizer',
                              'TfidfVectorizer',
                              'CountVectorizer',
                              'Embeddings',
                              'HyperparamTuning',
                              'RandomForestClassifier',
                              'GradientBoostingClassifier',
                              'ExtraTreesClassifier',
                              'LogisticRegression',
                              'SVC',
                              'KNeighborsClassifier',
                              'DecisionTreeClassifier',
                              'RandomForestRegressor',
                              'GradientBoostingRegressor',
                              'ExtraTreesRegressor',
                              'LinearRegression',
                              'Ridge',
                              'Lasso',
                              'SVR',
                              'KNeighborsRegressor',
                              'predict',
                            ].includes(selectedNode.data.nodeType)
                          ? getUpstreamColumns(selectedNode.id)
                          : []
                      }
                    />
                  )}
                </div>
              )}

              {activeTab === 'config' && !selectedNode && (
                <div
                  style={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 40,
                  }}
                >
                  Select any block on the canvas to configure its parameters.
                </div>
              )}

              {activeTab === 'charts' && (
                <ErrorBoundary>
                  <ChartPanel pipelineId={pipelineId} selectedNodeId={selectedNodeId} isDark={isDark} />
                </ErrorBoundary>
              )}

              {activeTab === 'logs' && (
                <ExecutionLogs
                  logs={logs}
                  isRunning={status === 'running'}
                  progress={progress}
                  onClearLogs={() => setLogs && setLogs([])}
                  pipelineId={pipelineId}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default function Canvas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const pipelineId = Number(id)
  const [workflowName, setWorkflowName] = useState('Untitled pipeline')
  const [workflowKey, setWorkflowKey] = useState('')
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState([])
  const [predictionResult, setPredictionResult] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const flowRef = useRef(null)
  const theme = useStore((s) => s.theme)
  const isDark = theme === 'dark'

  // VS Code Layout Panel Visibility
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [showBottomPanel, setShowBottomPanel] = useState(true)

  // Advanced ML Studio Modals
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showAutoMLModal, setShowAutoMLModal] = useState(false)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showRegistryModal, setShowRegistryModal] = useState(false)
  const [showWhatIfModal, setShowWhatIfModal] = useState(false)
  const [showCopilotPanel, setShowCopilotPanel] = useState(false)

  // Extract active dataset and feature context from canvas
  const [activeDatasetId, setActiveDatasetId] = useState(null)
  const [activeFeatures, setActiveFeatures] = useState([])
  const [activeNodesSnapshot, setActiveNodesSnapshot] = useState([])
  const [lastPipelineError, setLastPipelineError] = useState('')

  useEffect(() => {
    const loadPipeline = async () => {
      if (!pipelineId || isNaN(pipelineId)) return

      try {
        const { data } = await api.get(`/pipelines/${pipelineId}/`)
        setWorkflowName(data.name || 'Untitled pipeline')
        setWorkflowKey(data.description || '')

        if (data.graph && data.graph.nodes) {
          setActiveNodesSnapshot(data.graph.nodes)
          const dsNode = data.graph.nodes.find((n) => n.data?.nodeType === 'loadDataset')
          if (dsNode && dsNode.data?.datasetId) {
            setActiveDatasetId(dsNode.data.datasetId)
          }
          if (data.graph.error) {
            setLastPipelineError(data.graph.error)
          }
        }
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login')
        }
      }
    }

    loadPipeline()
  }, [navigate, pipelineId])

  const socketRef = useRef(null)

  useEffect(() => {
    if (!pipelineId || isNaN(pipelineId)) return

    let isUnmounted = false
    let reconnectTimeout = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5

    const getWsUrl = () => {
      const customWsUrl = import.meta.env.VITE_WS_URL
      if (customWsUrl) {
        return `${customWsUrl.replace(/\/+$/, '')}/ws/runs/${pipelineId}/logs/`
      }
      const apiUrl = import.meta.env.VITE_API_URL
      if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
        const wsProto = apiUrl.startsWith('https:') ? 'wss:' : 'ws:'
        const host = apiUrl.replace(/^https?:\/\//i, '').split('/')[0]
        return `${wsProto}//${host}/ws/runs/${pipelineId}/logs/`
      }
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${wsProtocol}//${window.location.host}/ws/runs/${pipelineId}/logs/`
    }

    const connectWebSocket = () => {
      if (isUnmounted) return

      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.onmessage = null
        socketRef.current.close()
        socketRef.current = null
      }

      try {
        const wsUrl = getWsUrl()
        const ws = new WebSocket(wsUrl)
        socketRef.current = ws

        let pingInterval = null

        ws.onopen = () => {
          reconnectAttempts = 0
          // Send a ping every 25 seconds so the server-side Redis subscription
          // does not time out on idle connections.
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping' }))
              } catch {}
            }
          }, 25000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            // Ignore pong messages from the server
            if (data.type === 'pong') return
            if (data.percent !== null && data.percent !== undefined) {
              setProgress(data.percent)
            }
            if (data.stage === 'predict') {
              setPredictionResult(data.message)
            }
            if (data.message) {
              setLogs((prev) => [
                ...prev,
                {
                  timestamp: new Date().toLocaleTimeString(),
                  stage: data.stage || 'EVENT',
                  message: data.message,
                },
              ])
            }
            if (data.stage === 'done' || data.stage === 'cached') {
              setStatus('success')
              setRefreshTrigger((t) => t + 1)
            } else if (data.stage === 'error') {
              setStatus('failed')
              setLastPipelineError(data.message || 'Execution error')
              setRefreshTrigger((t) => t + 1)
            } else if (data.stage === 'node_success' || data.stage === 'node_error') {
              setRefreshTrigger((t) => t + 1)
            } else if (data.stage === 'paused') {
              setStatus('paused')
            } else if (data.stage === 'stopped') {
              setStatus('idle')
            }
          } catch {}
        }

        ws.onerror = () => {
          // Handled via onclose
        }

        ws.onclose = (event) => {
          if (pingInterval) clearInterval(pingInterval)
          if (isUnmounted) return
          if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts += 1
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)
            reconnectTimeout = setTimeout(connectWebSocket, delay)
          }
        }
      } catch {
        if (!isUnmounted && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts += 1
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)
          reconnectTimeout = setTimeout(connectWebSocket, delay)
        }
      }
    }

    connectWebSocket()

    return () => {
      isUnmounted = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.onmessage = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [pipelineId])

  const handlePause = async () => {
    if (!pipelineId || isNaN(pipelineId)) return
    try {
      await api.post(`/pipelines/${pipelineId}/stop/`, { action: 'pause' })
      setStatus('paused')
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'PAUSE',
          message: 'Execution paused by user.',
        },
      ])
    } catch (err) {
      console.error('Failed to pause execution:', err)
    }
  }

  const handleResume = async () => {
    if (!pipelineId || isNaN(pipelineId)) return
    try {
      setStatus('running')
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'RESUME',
          message: 'Resuming pipeline execution…',
        },
      ])
      await api.post(`/pipelines/${pipelineId}/execute/`)
    } catch (err) {
      if (err.response?.status === 409) {
        setStatus('running')
      } else {
        setStatus('failed')
        console.error('Failed to resume execution:', err)
      }
    }
  }

  const handleStop = async () => {
    if (!pipelineId || isNaN(pipelineId)) return
    try {
      await api.post(`/pipelines/${pipelineId}/stop/`, { action: 'stop' })
      setStatus('idle')
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'STOP',
          message: 'Execution reset by user.',
        },
      ])
    } catch (err) {
      console.error('Failed to stop execution:', err)
    }
  }

  const handleExportProject = () => {
    if (!pipelineId || isNaN(pipelineId)) return
    window.location.href = `/api/pipelines/${pipelineId}/export/`
  }

  const handleImportProject = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const jsonContent = JSON.parse(event.target.result)
          const { data } = await api.post('/pipelines/import/', jsonContent)
          if (data.pipeline_id) {
            navigate(`/canvas/${data.pipeline_id}`)
          }
        } catch {
          alert('Invalid project JSON file format.')
        }
      }
      reader.readAsText(file)
    } catch {
      alert('Failed reading file.')
    }
  }

  const handleOpenReport = () => {
    if (!pipelineId || isNaN(pipelineId)) return
    window.open(`/api/pipelines/${pipelineId}/report/`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: isDark ? '#0f172a' : '#fff', overflow: 'hidden' }}>
      <Toolbar
        pipelineName={workflowName}
        status={status}
        onSave={() => flowRef.current?.saveGraph()}
        onRun={() => flowRef.current?.runGraph()}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onClear={() => flowRef.current?.clearGraph()}
        showLeftPanel={showLeftPanel}
        setShowLeftPanel={setShowLeftPanel}
        showRightPanel={showRightPanel}
        setShowRightPanel={setShowRightPanel}
        showBottomPanel={showBottomPanel}
        setShowBottomPanel={setShowBottomPanel}
        onZoomIn={() => flowRef.current?.zoomIn()}
        onZoomOut={() => flowRef.current?.zoomOut()}
        onFitView={() => flowRef.current?.fitView()}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenAutoML={() => setShowAutoMLModal(true)}
        onOpenCompare={() => setShowCompareModal(true)}
        onOpenRegistry={() => setShowRegistryModal(true)}
        onOpenWhatIf={() => setShowWhatIfModal(true)}
        onOpenCopilot={() => setShowCopilotPanel(!showCopilotPanel)}
        onOpenReport={handleOpenReport}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
      />

      <ReactFlowProvider>
        <FlowCanvas
          ref={flowRef}
          pipelineId={pipelineId}
          onStatusChange={setStatus}
          isDark={isDark}
          refreshTrigger={refreshTrigger}
          setRefreshTrigger={setRefreshTrigger}
          logs={logs}
          setLogs={setLogs}
          progress={progress}
          setProgress={setProgress}
          status={status}
          setPredictionResult={setPredictionResult}
          showLeftPanel={showLeftPanel}
          showRightPanel={showRightPanel}
          showBottomPanel={showBottomPanel}
          setActiveDatasetId={setActiveDatasetId}
        />
      </ReactFlowProvider>

      {/* Advanced Studio Modals */}
      <DatasetProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        datasetId={activeDatasetId}
        onApplyTarget={(targetCol) => {
          setShowProfileModal(false)
          alert(`Target column '${targetCol}' selected. Update your Split Dataset block parameters.`)
        }}
      />

      <AutoMLModal
        isOpen={showAutoMLModal}
        onClose={() => setShowAutoMLModal(false)}
        pipelineId={pipelineId}
        onAutoMLComplete={() => {
          setRefreshTrigger((t) => t + 1)
        }}
      />

      <ModelCompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        pipelineId={pipelineId}
      />

      <ModelRegistryModal
        isOpen={showRegistryModal}
        onClose={() => setShowRegistryModal(false)}
      />

      <WhatIfModal
        isOpen={showWhatIfModal}
        onClose={() => setShowWhatIfModal(false)}
        pipelineId={pipelineId}
        initialFeatures={activeFeatures}
      />

      <AICopilotPanel
        isOpen={showCopilotPanel}
        onClose={() => setShowCopilotPanel(false)}
        pipelineNodes={activeNodesSnapshot}
        pipelineError={lastPipelineError}
      />
    </div>
  )
}

const topbar = () => ({
  wrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '8px 18px',
    borderBottom: '1px solid rgba(99,102,241,0.12)',
    background: 'rgba(8,12,20,0.95)',
    fontFamily: "'Inter', sans-serif",
    backdropFilter: 'blur(10px)',
  },
  label: { fontWeight: 800, fontSize: 13, color: '#94a3b8', fontFamily: "'Space Grotesk', sans-serif" },
  fields: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  small: { fontSize: 10.5, color: '#475569', display: 'block', marginBottom: 4 },
  input: {
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12.5,
    minWidth: 160,
    background: 'rgba(99,102,241,0.06)',
    color: '#e2e8f0',
    outline: 'none',
    fontFamily: 'inherit',
  },
  btnGray: {
    background: 'rgba(99,102,241,0.1)',
    color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11.5,
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnDark: {
    background: 'rgba(139,92,246,0.15)',
    color: '#c4b5fd',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11.5,
    cursor: 'pointer',
    fontWeight: 700,
  },
})