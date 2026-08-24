import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import useStore from '../store/useStore'
import MarkdownMessage from '../components/MarkdownMessage'

export default function AICopilot() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlPipelineId = searchParams.get('pipeline')
  const urlDatasetId = searchParams.get('dataset')

  // Global store & theme
  const user = useStore((s) => s.user)
  const theme = useStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Context states
  const [context, setContext] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState(urlDatasetId || '')
  const [selectedPipelineId, setSelectedPipelineId] = useState(urlPipelineId ? Number(urlPipelineId) : '')
  const [aiStatus, setAiStatus] = useState({ online: true, active_provider: 'Detecting...' })

  // Chat states
  const [messages, setMessages] = useState([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `👋 **Welcome to NeuralCanva AI Copilot!**\n\nI can analyze your dataset, recommend the optimal ML/DL algorithms, generate end-to-end React Flow DAGs, and diagnose pipeline execution errors.\n\nTry clicking any of the **Quick Actions** below or type a message to begin!`,
      actionType: null,
      payload: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingAction, setApplyingAction] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')
  const [showRightPanel, setShowRightPanel] = useState(true)

  const messagesEndRef = useRef(null)

  // Scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Fetch initial AI Status and Context
  useEffect(() => {
    const fetchStatusAndContext = async () => {
      try {
        const [statusRes, ctxRes] = await Promise.all([
          api.get('/ai/status/'),
          api.get('/ai/context/', {
            params: {
              dataset_id: selectedDatasetId || undefined,
              pipeline_id: selectedPipelineId || undefined,
            },
          }),
        ])
        setAiStatus(statusRes.data)
        setContext(ctxRes.data)
        if (ctxRes.data.all_datasets) setDatasets(ctxRes.data.all_datasets)
        if (ctxRes.data.all_pipelines) setPipelines(ctxRes.data.all_pipelines)

        if (!selectedDatasetId && ctxRes.data.dataset?.id) {
          setSelectedDatasetId(ctxRes.data.dataset.id)
        }
        if (!selectedPipelineId && ctxRes.data.pipeline?.id) {
          setSelectedPipelineId(ctxRes.data.pipeline.id)
        }
      } catch (err) {
        console.error('Failed loading AI context:', err)
      }
    }

    fetchStatusAndContext()
  }, [selectedDatasetId, selectedPipelineId])

  // Send message
  const handleSend = async (customPrompt = null) => {
    const textToSend = (customPrompt || input).trim()
    if (!textToSend || loading) return

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customPrompt) setInput('')
    setLoading(true)
    setActionSuccess('')

    try {
      const history = messages
        .filter((m) => m.id !== 'msg_welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const { data } = await api.post('/ai/chat/', {
        message: textToSend,
        dataset_id: selectedDatasetId || undefined,
        pipeline_id: selectedPipelineId || undefined,
        history,
      })

      const assistantMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.text || 'Action completed.',
        actionType: data.action_type,
        payload: data.payload,
        provider: data.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorDetail = err.response?.data?.error || err.response?.data?.detail || 'AI Copilot service temporarily unavailable.'
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **AI Service Notice:** ${errorDetail}`,
          actionType: null,
          payload: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Quick Action triggers
  const handleQuickAction = async (endpoint, label) => {
    if (loading) return
    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: `⚡ **Action:** ${label}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setActionSuccess('')

    try {
      const { data } = await api.post(`/ai/${endpoint}/`, {
        dataset_id: selectedDatasetId || undefined,
        pipeline_id: selectedPipelineId || undefined,
      })

      const assistantMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.text || data.optimization_summary || 'Task completed successfully.',
        actionType: data.action_type,
        payload: data.payload,
        provider: data.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorDetail = err.response?.data?.error || err.response?.data?.detail || 'Could not complete requested action.'
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Action Error:** ${errorDetail}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Apply generated pipeline to Canvas
  const handleApplyPipeline = async (pipelinePayload) => {
    if (!pipelinePayload || applyingAction) return
    setApplyingAction(true)
    try {
      const res = await api.post('/ai/apply-action/', {
        action: 'apply_generated_pipeline',
        payload: {
          ...pipelinePayload,
          pipeline_name: `AI Pipeline - ${pipelinePayload.task_type?.toUpperCase() || 'ML'}`,
          pipeline_id: selectedPipelineId || undefined,
        },
      })

      const newPid = res.data.pipeline_id
      setActionSuccess(`✅ Pipeline #${newPid} successfully applied! Redirecting to canvas…`)
      setTimeout(() => {
        navigate(`/pipeline/${newPid}`)
      }, 1200)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply pipeline to canvas.')
    } finally {
      setApplyingAction(false)
    }
  }

  // Apply pipeline debug fix
  const handleApplyFix = async (fixPayload) => {
    if (!fixPayload || applyingAction) return
    setApplyingAction(true)
    try {
      await api.post('/ai/apply-action/', {
        action: 'update_node_params',
        payload: {
          pipeline_id: selectedPipelineId,
          node_id: fixPayload.node_id,
          changes: fixPayload.changes,
        },
      })
      setActionSuccess(`✅ Fix applied to block '${fixPayload.node_id}'! Parameter '${Object.keys(fixPayload.changes).join(', ')}' updated.`)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to apply parameter fix.')
    } finally {
      setApplyingAction(false)
    }
  }

  const activeDataset = context?.dataset || {}
  const activePipeline = context?.pipeline || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        background: 'rgba(10, 15, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 20,
      }}>
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ◀ Dashboard
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #ff0071, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxShadow: '0 0 16px rgba(255, 0, 113, 0.4)',
            }}>
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
                  NeuralCanva <span style={{ background: 'linear-gradient(135deg, #ff0071, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Copilot</span>
                </span>
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 700,
                  background: aiStatus.online ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: aiStatus.online ? '#86efac' : '#fde047',
                  border: `1px solid ${aiStatus.online ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                }}>
                  ● {aiStatus.online ? `AI Online (${aiStatus.active_provider})` : 'Smart Heuristic Mode'}
                </span>
              </div>
              <p style={{ fontSize: 10.5, color: '#64748b', margin: 0 }}>
                Intelligent ML/DL Pipeline Architect & Debugger
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Target Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dataset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Dataset:</span>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                borderRadius: 7,
                padding: '4px 8px',
                fontSize: 11.5,
                outline: 'none',
              }}
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  📄 {ds.name} ({ds.rows} rows)
                </option>
              ))}
              {datasets.length === 0 && <option value="">No Datasets Uploaded</option>}
            </select>
          </div>

          {/* Pipeline Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Pipeline:</span>
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value ? Number(e.target.value) : '')}
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                borderRadius: 7,
                padding: '4px 8px',
                fontSize: 11.5,
                outline: 'none',
              }}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  🔬 #{p.id} - {p.name} ({p.status})
                </option>
              ))}
              {pipelines.length === 0 && <option value="">No Active Pipelines</option>}
            </select>
          </div>

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            style={{
              background: showRightPanel ? 'rgba(255, 0, 113, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showRightPanel ? 'rgba(255, 0, 113, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: showRightPanel ? '#ff85be' : '#94a3b8',
              borderRadius: 7,
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Toggle Context Inspector"
          >
            📋 Context
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left / Center Chat Column */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Quick Actions Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'rgba(10, 15, 26, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ⚡ Quick Actions:
            </span>
            <button onClick={() => handleQuickAction('analyze-dataset', 'Analyze Dataset')} style={quickBtnStyle('#06b6d4')}>
              📊 Analyze Dataset
            </button>
            <button onClick={() => handleQuickAction('recommend-model', 'Recommend Model')} style={quickBtnStyle('#8b5cf6')}>
              🏆 Recommend Model
            </button>
            <button onClick={() => handleQuickAction('generate-pipeline', 'Build Full Pipeline')} style={quickBtnStyle('#ff0071')}>
              ⚡ Build Pipeline
            </button>
            <button onClick={() => handleQuickAction('debug-pipeline', 'Debug Current Pipeline')} style={quickBtnStyle('#ef4444')}>
              🔍 Debug Pipeline
            </button>
            <button onClick={() => handleQuickAction('optimize-pipeline', 'Optimize DAG')} style={quickBtnStyle('#f59e0b')}>
              ✨ Optimize Pipeline
            </button>
          </div>

          {/* Action Success Notification Alert */}
          {actionSuccess && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              borderBottom: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#86efac',
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess('')} style={{ background: 'transparent', border: 'none', color: '#86efac', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* Messages Thread Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {/* Sender Pill */}
                <div style={{
                  fontSize: 10.5,
                  color: m.role === 'user' ? '#ff85be' : '#a5b4fc',
                  fontWeight: 700,
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  {m.role === 'user' ? `👤 ${user?.username || 'You'}` : `🤖 AI Copilot ${m.provider ? `(${m.provider})` : ''}`}
                  <span style={{ color: '#475569', fontWeight: 500 }}>{m.timestamp}</span>
                </div>

                {/* Message Content Bubble */}
                <div style={{
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, rgba(255, 0, 113, 0.25), rgba(139, 92, 246, 0.25))'
                    : 'rgba(15, 23, 42, 0.85)',
                  border: m.role === 'user'
                    ? '1px solid rgba(255, 0, 113, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  color: '#f8fafc',
                  fontSize: 13,
                  lineHeight: 1.6,
                  backdropFilter: 'blur(10px)',
                  boxShadow: m.role === 'user' ? '0 4px 20px rgba(255, 0, 113, 0.15)' : '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  <MarkdownMessage content={m.content} isUser={m.role === 'user'} />

                  {/* Interactive Action Card: Generated Pipeline */}
                  {m.actionType === 'generate_pipeline' && m.payload && (
                    <div style={{
                      marginTop: 14,
                      padding: 14,
                      background: 'rgba(10, 15, 26, 0.9)',
                      borderRadius: 10,
                      border: '1px solid rgba(255, 0, 113, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#ff85be' }}>
                          ⚡ Generated Pipeline DAG ({m.payload.nodes?.length || 0} blocks)
                        </span>
                        <span style={{ fontSize: 10.5, color: '#86efac', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                          Target: {m.payload.target_column || 'Auto'}
                        </span>
                      </div>

                      {/* Visual DAG Nodes list */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {m.payload.nodes?.map((n, i) => (
                          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: '#cbd5e1',
                              fontSize: 11,
                              padding: '4px 8px',
                              borderRadius: 6,
                              fontWeight: 600,
                            }}>
                              {n.label || n.node_type}
                            </span>
                            {i < (m.payload.nodes.length - 1) && <span style={{ color: '#ff0071', fontSize: 11 }}>➔</span>}
                          </div>
                        ))}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleApplyPipeline(m.payload)}
                        disabled={applyingAction}
                        style={{
                          background: 'linear-gradient(135deg, #ff0071 0%, #8b5cf6 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '9px 16px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: applyingAction ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 16px rgba(255, 0, 113, 0.35)',
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        {applyingAction ? '⏳ Applying to Canvas...' : '⚡ Apply to Canvas & Open Editor'}
                      </button>
                    </div>
                  )}

                  {/* Interactive Action Card: Pipeline Debug Fix */}
                  {m.actionType === 'debug_pipeline' && m.payload?.suggested_action && (
                    <div style={{
                      marginTop: 14,
                      padding: 14,
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: 10,
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5' }}>
                        🛠️ Recommended Hyperparameter Repair:
                      </div>
                      <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                        {m.payload.suggested_action.reason}
                      </div>
                      <div style={{
                        background: 'rgba(0,0,0,0.5)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        color: '#86efac',
                      }}>
                        Update {m.payload.suggested_action.node_id}: {JSON.stringify(m.payload.suggested_action.changes)}
                      </div>
                      <button
                        onClick={() => handleApplyFix(m.payload.suggested_action)}
                        disabled={applyingAction}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444, #f97316)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 7,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: applyingAction ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {applyingAction ? '⏳ Applying Fix...' : '✔ Apply Fix to Block Parameters'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '10px 16px',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ff85be',
                fontSize: 12.5,
                fontWeight: 600,
              }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚡</span>
                AI Copilot is analyzing and generating response…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Box Footer */}
          <div style={{
            padding: '14px 20px',
            background: 'rgba(10, 15, 26, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}>
            <input
              type="text"
              placeholder="Ask AI Copilot (e.g. 'Build a classification pipeline for my dataset' or 'Why did my run fail?')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                background: !input.trim() || loading
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'linear-gradient(135deg, #ff0071 0%, #8b5cf6 100%)',
                color: !input.trim() || loading ? '#64748b' : '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                boxShadow: !input.trim() || loading ? 'none' : '0 4px 18px rgba(255, 0, 113, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ➤ Send
            </button>
          </div>
        </div>

        {/* Right Project Context Inspector Panel */}
        {showRightPanel && (
          <div style={{
            width: 330,
            background: 'rgba(10, 15, 26, 0.98)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 14,
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                📊 Project Context
              </span>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>Live Snapshot</span>
            </div>

            {/* Active Dataset Context Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>📂</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ff85be', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeDataset.name || 'No Dataset Selected'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 9.5 }}>ROWS</span>
                  <strong style={{ color: '#e2e8f0' }}>{activeDataset.rows ? activeDataset.rows.toLocaleString() : '0'}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 9.5 }}>COLUMNS</span>
                  <strong style={{ color: '#e2e8f0' }}>{activeDataset.columns || 0}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 9.5 }}>TASK</span>
                  <strong style={{ color: '#86efac' }}>{activeDataset.suggested_task || 'Classification'}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 9.5 }}>TARGET</span>
                  <strong style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {activeDataset.recommended_target || 'None'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Active Pipeline Context Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔬</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
                    {activePipeline.name ? `#${activePipeline.id} ${activePipeline.name}` : 'No Pipeline'}
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 700,
                  background: activePipeline.status === 'success' ? 'rgba(34,197,94,0.2)' : activePipeline.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)',
                  color: activePipeline.status === 'success' ? '#86efac' : activePipeline.status === 'failed' ? '#fca5a5' : '#94a3b8',
                }}>
                  {activePipeline.status || 'idle'}
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                Blocks in DAG: <strong>{activePipeline.nodes_count || 0}</strong>
              </div>

              {activePipeline.error && (
                <div style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 10.5,
                  color: '#fca5a5',
                  marginBottom: 8,
                }}>
                  ⚠️ <strong>Last Error:</strong> {activePipeline.error}
                </div>
              )}

              {activePipeline.id && (
                <button
                  onClick={() => navigate(`/pipeline/${activePipeline.id}`)}
                  style={{
                    width: '100%',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#c4b5fd',
                    borderRadius: 6,
                    padding: '6px 0',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Open in Canvas Editor ➔
                </button>
              )}
            </div>

            {/* Quick Context Prompt Suggestions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>💡 ASK ABOUT CONTEXT:</span>
              <button
                onClick={() => handleSend(`Explain the statistical distribution and data quality for dataset '${activeDataset.name}'`)}
                style={promptSuggestionBtnStyle}
              >
                📊 "How clean is my dataset?"
              </button>
              <button
                onClick={() => handleSend(`Why is ${activePipeline.status === 'failed' ? 'this pipeline failing' : 'Random Forest recommended'} for this data?`)}
                style={promptSuggestionBtnStyle}
              >
                🏆 "Which model gives highest accuracy?"
              </button>
              <button
                onClick={() => handleSend("What hyperparameters should I tune for the best result?")}
                style={promptSuggestionBtnStyle}
              >
                ⚙️ "How to tune hyperparameters?"
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const quickBtnStyle = (color) => ({
  background: 'rgba(255, 255, 255, 0.04)',
  border: `1px solid ${color}40`,
  color: '#f8fafc',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const promptSuggestionBtnStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#cbd5e1',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 11,
  textAlign: 'left',
  cursor: 'pointer',
}
