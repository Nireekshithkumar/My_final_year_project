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
import { PARAM_SCHEMAS } from '../config/paramSchemas'
import api from '../api/axios'
import useStore from '../store/useStore'

const nodeTypes = { taskNode: TaskNode }
let idCounter = 1
const getId = () => `node_${idCounter++}`

const OUTPUT_PRESETS = {
  approval: [
    { id: 'approve', label: 'Approve Task', color: '#22c55e' },
    { id: 'reject', label: 'Reject Task', color: '#ef4444' },
  ],
  default: [{ id: 'next', label: 'Connection Task', color: '#22c55e' }],
}

const FlowCanvas = forwardRef(function FlowCanvas({ pipelineId, onStatusChange, isDark }, ref) {
  const reactFlowWrapper = useRef(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { screenToFlowPosition } = useReactFlow()
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [error, setError] = useState('')

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)

  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node))
    )
  }, [setNodes])

  const getUpstreamColumns = useCallback((nodeId) => {
    const parentEdge = edges.find((e) => e.target === nodeId)
    if (!parentEdge) return []
    const parentNode = nodes.find((n) => n.id === parentEdge.source)
    if (!parentNode) return []

    if (parentNode.data?.nodeType === 'splitDataset') {
      const allCols = getUpstreamColumns(parentNode.id)
      const target = parentNode.data.params?.target_column
      return allCols.filter((c) => c !== target)
    }

    if (parentNode.data?.columns) return parentNode.data.columns
    return getUpstreamColumns(parentNode.id)
  }, [edges, nodes])
  const getUpstreamColumnTypes = useCallback((nodeId) => {
    const parentEdge = edges.find((e) => e.target === nodeId)
    if (!parentEdge) return {}
    const parentNode = nodes.find((n) => n.id === parentEdge.source)
    if (!parentNode) return {}
    if (parentNode.data?.columnTypes) return parentNode.data.columnTypes
    return getUpstreamColumnTypes(parentNode.id)
  }, [edges, nodes])

  const handlePredict = useCallback(async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)
    const featureValues = node?.data?.params?.feature_values || {}

    try {
      const { data } = await api.post(`/pipelines/${pipelineId}/predict/`, { feature_values: featureValues })
      updateNodeData(nodeId, { lastPrediction: data.prediction })
    } catch (err) {
      updateNodeData(nodeId, {
        lastPrediction: 'Error: ' + (err.response?.data?.error || 'prediction failed'),
      })
    }
  }, [nodes, pipelineId, updateNodeData])

  const onConnect = useCallback(
    (params) =>
      setEdges((currentEdges) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, currentEdges)
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
          outputs: type === 'end' ? [] : (OUTPUT_PRESETS[type] || OUTPUT_PRESETS.default),
          onPredict: handlePredict,
        },
      }
      setNodes((currentNodes) => currentNodes.concat(newNode))
      onStatusChange('idle')
    },
    [onStatusChange, screenToFlowPosition, setNodes, handlePredict]
  )

  const saveGraph = useCallback(async () => {
    if (!pipelineId) return

    try {
      onStatusChange('saving')
      await api.put(`/pipelines/${pipelineId}/graph/`, { nodes, edges })
      onStatusChange('saved')
      setError('')
    } catch (err) {
      onStatusChange('failed')
      setError(err.response?.data?.detail || 'Unable to save the workflow.')
    }
  }, [edges, nodes, onStatusChange, pipelineId])

  const runGraph = useCallback(async () => {
    if (!pipelineId) return

    try {
      setError('')
      onStatusChange('running')
      await api.post(`/pipelines/${pipelineId}/execute/`)
    } catch (err) {
      onStatusChange('failed')
      setError(err.response?.data?.detail || 'Unable to run the workflow.')
    }
  }, [onStatusChange, pipelineId])

  const clearGraph = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    onStatusChange('idle')
  }, [onStatusChange, setEdges, setNodes])

  useImperativeHandle(ref, () => ({ saveGraph, runGraph, clearGraph }), [clearGraph, runGraph, saveGraph])

  useEffect(() => {
    const loadGraph = async () => {
      if (!pipelineId) return

      try {
        const { data } = await api.get(`/pipelines/${pipelineId}/graph/`)
        const loadedNodes = (data.nodes || []).map((n) =>
          n.data?.nodeType === 'predict' ? { ...n, data: { ...n.data, onPredict: handlePredict } } : n
        )
        setNodes(loadedNodes)
        setEdges(data.edges || [])
      } catch {
        // ignore missing graph on first load
      }
    }

    loadGraph()
  }, [pipelineId])

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <NodePalette />
      <div style={{ flex: 1, minHeight: 0 }} ref={reactFlowWrapper}>
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
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={20}
            size={1}
            color={isDark ? '#334155' : '#5084c7'}
          />
          <Controls />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div
          style={{
            width: 300,
            borderLeft: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            padding: 16,
            background: isDark ? '#1e293b' : '#fff',
            color: isDark ? '#f1f5f9' : '#0f172a',
          }}
        >
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>{selectedNode.data.title}</h3>

          {selectedNode.data.nodeType === 'loadDataset' && (
            <DatasetUpload
              onUploaded={(dataset) =>
                updateNodeData(selectedNode.id, {
                  datasetId: dataset.id,
                  columns: dataset.columns,
                  columnTypes: dataset.column_types,
                  subtitle: dataset.name,
                })
              }
            />
          )}

          {PARAM_SCHEMAS[selectedNode.data.nodeType] !== undefined && (
            <ParamEditor
              nodeType={selectedNode.data.nodeType}
              params={selectedNode.data.params || {}}
              onChange={(newParams) => updateNodeData(selectedNode.id, { params: newParams, checked: true })}
              dark={isDark}
              columns={
                selectedNode.data.nodeType === 'Encoder'
                  ? Object.entries(getUpstreamColumnTypes(selectedNode.id))
                    .filter(([, t]) => t === 'categorical' || t === 'text')
                    .map(([name]) => name)
                  : ['splitDataset', 'StandardScaler', 'MinMaxScaler', 'predict'].includes(selectedNode.data.nodeType)
                    ? getUpstreamColumns(selectedNode.id)
                    : []
              }
            />
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute', bottom: 16, right: 16,
            background: '#fee2e2', color: '#b91c1c',
            padding: '8px 12px', borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
})

export default function Canvas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workflowName, setWorkflowName] = useState('Untitled pipeline')
  const [workflowKey, setWorkflowKey] = useState('')
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [predictionResult, setPredictionResult] = useState(null)
  const flowRef = useRef(null)
  const theme = useStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [pipelineId] = useState(Number(id))

  useEffect(() => {
    const loadPipeline = async () => {
      if (!pipelineId) return

      try {
        const { data } = await api.get(`/pipelines/${pipelineId}/`)
        setWorkflowName(data.name || 'Untitled pipeline')
        setWorkflowKey(data.description || '')
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login')
        }
      }
    }

    loadPipeline()
  }, [navigate, pipelineId])

  useEffect(() => {
    if (!pipelineId || status !== 'running') return

    const ws = new WebSocket(`ws://localhost:8080/ws/runs/${pipelineId}/logs/`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.percent !== null && data.percent !== undefined) {
        setProgress(data.percent)
      }
      if (data.stage === 'predict') {
        setPredictionResult(data.message)
      }
      if (data.stage === 'done' || data.stage === 'cached') {
        setStatus('success')
      } else if (data.stage === 'error') {
        setStatus('failed')
      }
    }

    ws.onerror = () => {
      console.error('WebSocket connection failed for run logs.')
    }

    return () => ws.close()
  }, [pipelineId, status])

  const handleUpdate = async () => {
    if (!pipelineId) return

    try {
      await api.patch(`/pipelines/${pipelineId}/`, { name: workflowName, description: workflowKey })
      setStatus('saved')
    } catch {
      setStatus('failed')
    }
  }

  const handleDownload = async () => {
    if (!pipelineId) return
    window.location.href = `/api/pipelines/${pipelineId}/download/`
  }

  const styles = topbar(isDark)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: isDark ? '#0f172a' : '#fff' }}>
      <div style={styles.wrap}>
        <div style={styles.label}>Workflow</div>
        <div style={styles.fields}>
          <div>
            <label style={styles.small}>Workflow Name *</label>
            <input style={styles.input} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} />
          </div>
          <div>
            <label style={styles.small}>Key</label>
            <input style={styles.input} value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value)} />
          </div>
          {status === 'running' && (
            <div style={styles.small}>Running… {progress}%</div>
          )}
          {predictionResult && (
            <div style={{ ...styles.small, color: isDark ? '#4ade80' : '#16a34a', fontWeight: 600 }}>
              {predictionResult}
            </div>
          )}
          <button style={styles.btnGray} onClick={handleDownload}>⬇ Download Model</button>
          <button style={styles.btnGray} onClick={handleUpdate}>Update</button>
          <button style={styles.btnDark}>User Permissions</button>
          <button style={styles.btnDark}>Variables</button>
        </div>
      </div>

      <Toolbar
        pipelineName={workflowName}
        status={status}
        onSave={() => flowRef.current?.saveGraph()}
        onRun={() => flowRef.current?.runGraph()}
        onClear={() => flowRef.current?.clearGraph()}
      />

      <ReactFlowProvider>
        <FlowCanvas ref={flowRef} pipelineId={pipelineId} onStatusChange={setStatus} isDark={isDark} />
      </ReactFlowProvider>
    </div>
  )
}

const topbar = (isDark) => ({
  wrap: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    padding: '12px 20px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    background: isDark ? '#1e293b' : '#f8fafc',
    fontFamily: 'Inter, sans-serif',
  },
  label: { fontWeight: 700, fontSize: 15, color: isDark ? '#f1f5f9' : '#0f172a' },
  fields: { display: 'flex', gap: 14, alignItems: 'flex-end' },
  small: { fontSize: 11, color: isDark ? '#94a3b8' : '#475569', display: 'block', marginBottom: 2 },
  input: {
    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 13, minWidth: 200,
    background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a',
  },
  btnGray: {
    background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#0f172a',
    border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
  },
  btnDark: {
    background: '#312e81', color: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
})