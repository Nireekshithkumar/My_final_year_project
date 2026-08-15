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
import ErrorBoundary from '../components/ErrorBoundary'
import ExecutionLogs from '../components/ExecutionLogs'
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

const FlowCanvas = forwardRef(function FlowCanvas({
  pipelineId,
  onStatusChange,
  isDark,
  refreshTrigger,
  setRefreshTrigger,
  logs = [],
  setLogs,
  progress = 0,
  status = 'idle',
}, ref) {
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

  const getUpstreamColumns = useCallback((nodeId, visited = new Set()) => {
    if (visited.has(nodeId)) return []
    visited.add(nodeId)
    const parentEdge = edges.find((e) => e.target === nodeId)
    if (!parentEdge) return []
    const parentNode = nodes.find((n) => n.id === parentEdge.source)
    if (!parentNode) return []

    if (parentNode.data?.nodeType === 'splitDataset') {
      const allCols = getUpstreamColumns(parentNode.id, visited)
      const target = parentNode.data.params?.target_column
      return target ? allCols.filter((c) => c !== target) : allCols
    }

    // Use stored columns if available (set after a run)
    if (parentNode.data?.columns?.length > 0) return parentNode.data.columns
    // Otherwise keep walking up
    return getUpstreamColumns(parentNode.id, visited)
  }, [edges, nodes])

  const getUpstreamColumnTypes = useCallback((nodeId, visited = new Set()) => {
    if (visited.has(nodeId)) return {}
    visited.add(nodeId)
    const parentEdge = edges.find((e) => e.target === nodeId)
    if (!parentEdge) return {}
    const parentNode = nodes.find((n) => n.id === parentEdge.source)
    if (!parentNode) return {}
    if (parentNode.data?.columnTypes && Object.keys(parentNode.data.columnTypes).length > 0)
      return parentNode.data.columnTypes
    return getUpstreamColumnTypes(parentNode.id, visited)
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
      const { data } = await api.post(`/pipelines/${pipelineId}/nodes/${nodeId}/run/`)
      // Persist updated columns from run result so downstream dropdowns stay populated
      const result = data?.result || {}
      const newCols = Array.isArray(result.columns) && result.columns.length > 0
        ? result.columns
        : null
      updateNodeData(nodeId, {
        status: 'success',
        ...(newCols ? { columns: newCols } : {}),
      })
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

  // Client-side DAG cycle detection (DFS) — mirrors backend logic
  const hasCycle = useCallback((nodeList, edgeList) => {
    const adj = {}
    nodeList.forEach(n => { adj[n.id] = [] })
    edgeList.forEach(e => { if (adj[e.source]) adj[e.source].push(e.target) })
    const WHITE = 0, GREY = 1, BLACK = 2
    const color = {}
    nodeList.forEach(n => { color[n.id] = WHITE })
    const dfs = (v) => {
      color[v] = GREY
      for (const w of (adj[v] || [])) {
        if (color[w] === GREY) return true   // back-edge → cycle
        if (color[w] === WHITE && dfs(w)) return true
      }
      color[v] = BLACK
      return false
    }
    return nodeList.some(n => color[n.id] === WHITE && dfs(n.id))
  }, [])

  const saveGraph = useCallback(async () => {
    if (!pipelineId) return

    // Client-side cycle check before the network round-trip
    if (hasCycle(nodes, edges)) {
      onStatusChange('failed')
      setError('⚠️ Your pipeline contains a cycle (loop). All connections must flow in one direction. Remove the circular link and try again.')
      return
    }

    try {
      onStatusChange('saving')
      await api.put(`/pipelines/${pipelineId}/graph/`, { nodes, edges })
      onStatusChange('saved')
      setError('')
    } catch (err) {
      onStatusChange('failed')
      // Server may return non_field_errors (e.g. cycle detection) or detail
      const serverMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        'Unable to save the workflow.'
      setError(serverMsg)
    }
  }, [edges, hasCycle, nodes, onStatusChange, pipelineId])

  const runGraph = useCallback(async () => {
    if (!pipelineId) return

    // Guard: must be a valid DAG before executing
    if (hasCycle(nodes, edges)) {
      setError('⚠️ Cannot run: pipeline contains a cycle. Fix the graph connections first.')
      return
    }

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
  }, [edges, hasCycle, nodes, onStatusChange, pipelineId, setNodes])

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
  }, [pipelineId, handlePredict, handleRunNode, setNodes, setEdges])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: 'calc(100vh - 110px)', position: 'relative' }}>
      {/* Transformation History Stepper */}
      <TransformationHistory
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        isDark={isDark}
      />

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '8px 16px',
          fontSize: 12,
          color: '#fca5a5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div style={{ flex: 1, position: 'relative', height: '100%' }} ref={reactFlowWrapper}>
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
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="rgba(255, 0, 113, 0.15)"
            />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Dock Panel (Node Config / Charts Tabs) */}
        <div
          style={{
            width: 340,
            display: 'flex', flexDirection: 'column',
            background: 'rgba(10, 15, 26, 0.95)',
            color: '#e2e8f0',
            backdropFilter: 'blur(16px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
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
                  flex: 1, padding: '12px 4px', fontSize: 11.5, fontWeight: 700,
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                  paddingBottom: 10,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                  <span style={{ fontSize: 14 }}>⚙️</span>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc' }}>{selectedNode.data.title}</h3>
                </div>


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
                        : [
                            'splitDataset',
                            'StandardScaler', 'MinMaxScaler', 'RobustScaler', 'MaxAbsScaler', 'Normalizer',
                            'TfidfVectorizer', 'CountVectorizer', 'Embeddings',
                            'HyperparamTuning',
                            'RandomForestClassifier', 'GradientBoostingClassifier', 'ExtraTreesClassifier',
                            'LogisticRegression', 'SVC', 'KNeighborsClassifier', 'DecisionTreeClassifier',
                            'RandomForestRegressor', 'GradientBoostingRegressor', 'ExtraTreesRegressor',
                            'LinearRegression', 'Ridge', 'Lasso', 'SVR', 'KNeighborsRegressor',
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
              <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
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
  const [logs, setLogs] = useState([])
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
      } else if (data.stage === 'node_success') {
        setRefreshTrigger((t) => t + 1)
      } else if (data.stage === 'stopped') {
        setStatus('idle')
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

  const handleStop = async () => {
    if (!pipelineId) return
    try {
      await api.post(`/pipelines/${pipelineId}/stop/`)
      setStatus('idle')
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'STOP',
          message: 'Execution stopped by user.',
        },
      ])
    } catch (err) {
      console.error('Failed to stop execution:', err)
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
        onStop={handleStop}
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
          logs={logs}
          setLogs={setLogs}
          progress={progress}
          status={status}
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