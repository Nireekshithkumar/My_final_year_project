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

const FlowCanvas = forwardRef(function FlowCanvas({ pipelineId, onStatusChange, isDark, refreshTrigger, setRefreshTrigger }, ref) {
  const reactFlowWrapper = useRef(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { screenToFlowPosition } = useReactFlow()
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [activeTab, setActiveTab] = useState('config') // 'config' | 'charts'
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
      updateNodeData(nodeId, { lastPrediction: data.prediction, status: 'success' })
    } catch (err) {
      updateNodeData(nodeId, {
        lastPrediction: 'Error: ' + (err.response?.data?.error || 'prediction failed'),
        status: 'failed',
      })
    }
  }, [nodes, pipelineId, updateNodeData])

  const handleRunNode = useCallback(async (nodeId) => {
    updateNodeData(nodeId, { status: 'running' })
    setError('')
    try {
      await api.post(`/pipelines/${pipelineId}/nodes/${nodeId}/run/`)
      updateNodeData(nodeId, { status: 'success' })
      setRefreshTrigger((t) => t + 1)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Node execution failed.'
      setError(msg)
      updateNodeData(nodeId, { status: 'failed' })
    }
  }, [pipelineId, updateNodeData, setRefreshTrigger])

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
          status: 'ready',
          outputs: type === 'end' ? [] : (OUTPUT_PRESETS[type] || OUTPUT_PRESETS.default),
          onPredict: handlePredict,
          onRunNode: handleRunNode,
        },
      }
      setNodes((currentNodes) => currentNodes.concat(newNode))
      onStatusChange('idle')
    },
    [onStatusChange, screenToFlowPosition, setNodes, handlePredict, handleRunNode]
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
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'running' } })))
      await api.post(`/pipelines/${pipelineId}/execute/`)
    } catch (err) {
      onStatusChange('failed')
      setError(err.response?.data?.detail || 'Unable to run the workflow.')
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'failed' } })))
    }
  }, [onStatusChange, pipelineId, setNodes])

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
        const loadedNodes = (data.nodes || []).map((n) => ({
          ...n,
          data: {
            ...n.data,
            onPredict: handlePredict,
            onRunNode: handleRunNode,
            status: n.data?.status || 'ready',
          },
        }))
        setNodes(loadedNodes)
        setEdges(data.edges || [])
      } catch {
        // ignore missing graph on first load
      }
    }

    loadGraph()
  }, [pipelineId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Transformation History Stepper */}
      <TransformationHistory
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        isDark={isDark}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <NodePalette />
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }} ref={reactFlowWrapper}>
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
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(99,102,241,0.08)"
            />
            <Controls />
          </ReactFlow>

          {error && (
            <div
              style={{
                position: 'absolute', bottom: 16, right: 16,
                background: '#fee2e2', color: '#b91c1c',
                padding: '8px 12px', borderRadius: 8, zIndex: 100, fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Right Dock Panel (Node Config / Charts Tabs) */}
        <div
          style={{
            width: 300,
            borderLeft: 'rgba(99,102,241,0.15)',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(8,12,20,0.95)',
            color: '#e2e8f0',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(99,102,241,0.12)',
          }}
        >
          {/* Tab Switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
            <button
              onClick={() => setActiveTab('config')}
              style={{
                flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700,
                border: 'none',
                background: activeTab === 'config' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTab === 'config' ? '#a5b4fc' : '#475569',
                cursor: 'pointer',
                borderBottom: activeTab === 'config' ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              ⚙ Node Config
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              style={{
                flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700,
                border: 'none',
                background: activeTab === 'charts' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTab === 'charts' ? '#a5b4fc' : '#475569',
                cursor: 'pointer',
                borderBottom: activeTab === 'charts' ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              📈 Charts & EDA
            </button>
          </div>

          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {activeTab === 'config' && selectedNode && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 14 }}>{selectedNode.data.title}</h3>

                {selectedNode.data.nodeType === 'loadDataset' && (
                  <DatasetUpload
                    onUploaded={(dataset) =>
                      updateNodeData(selectedNode.id, {
                        datasetId: dataset.id,
                        columns: dataset.columns,
                        columnTypes: dataset.column_types,
                        subtitle: dataset.name,
                        status: 'ready',
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
                    columnTypes={getUpstreamColumnTypes(selectedNode.id)}
                    columns={
                      selectedNode.data.nodeType === 'Encoder'
                        ? Object.entries(getUpstreamColumnTypes(selectedNode.id))
                          .filter(([, t]) => t === 'categorical' || t === 'text')
                          .map(([name]) => name)
                        : ['splitDataset', 'StandardScaler', 'MinMaxScaler', 'RobustScaler', 'MaxAbsScaler', 'Normalizer', 'predict'].includes(selectedNode.data.nodeType)
                          ? getUpstreamColumns(selectedNode.id)
                          : []
                    }
                  />
                )}
              </div>
            )}

            {activeTab === 'config' && !selectedNode && (
              <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Select any block on the canvas to configure its parameters.
              </div>
            )}

            {activeTab === 'charts' && (
              <ChartPanel pipelineId={pipelineId} selectedNodeId={selectedNodeId} isDark={isDark} />
            )}
          </div>
        </div>
      </div>

      {/* Dataset Spreadsheet Footer Viewer */}
      <DatasetViewer
        pipelineId={pipelineId}
        selectedNodeId={selectedNodeId}
        isDark={isDark}
        refreshTrigger={refreshTrigger}
      />
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
  const [refreshTrigger, setRefreshTrigger] = useState(0)
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
    if (!pipelineId) return

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/runs/${pipelineId}/logs/`)

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
        setRefreshTrigger((t) => t + 1)
      } else if (data.stage === 'error') {
        setStatus('failed')
      } else if (data.stage === 'node_success') {
        setRefreshTrigger((t) => t + 1)
      }
    }

    ws.onerror = () => {
      console.error('WebSocket connection failed for run logs.')
    }

    return () => ws.close()
  }, [pipelineId])

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
        <FlowCanvas
          ref={flowRef}
          pipelineId={pipelineId}
          onStatusChange={setStatus}
          isDark={isDark}
          refreshTrigger={refreshTrigger}
          setRefreshTrigger={setRefreshTrigger}
        />
      </ReactFlowProvider>
    </div>
  )
}

const topbar = () => ({
  wrap: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    padding: '10px 18px', borderBottom: '1px solid rgba(99,102,241,0.12)',
    background: 'rgba(8,12,20,0.95)',
    fontFamily: "'Inter', sans-serif",
    backdropFilter: 'blur(10px)',
  },
  label: { fontWeight: 800, fontSize: 13, color: '#94a3b8', fontFamily: "'Space Grotesk', sans-serif" },
  fields: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  small: { fontSize: 10.5, color: '#475569', display: 'block', marginBottom: 4 },
  input: {
    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8,
    padding: '6px 10px', fontSize: 13, minWidth: 180,
    background: 'rgba(99,102,241,0.06)', color: '#e2e8f0',
    outline: 'none', fontFamily: 'inherit',
  },
  btnGray: {
    background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 13px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
  btnDark: {
    background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 8, padding: '7px 13px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
  },
})