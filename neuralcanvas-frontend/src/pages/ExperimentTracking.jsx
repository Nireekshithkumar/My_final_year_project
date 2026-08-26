import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ExperimentTracking() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedAlgo, setSelectedAlgo] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('start_time');
  const [sortOrder, setSortOrder] = useState('desc');

  // Selection & Modals
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [activeRunDetail, setActiveRunDetail] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [rerunStatus, setRerunStatus] = useState(null);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('/api/pipelines/experiments/', {
        params: {
          q: search,
          algorithm: selectedAlgo !== 'ALL' ? selectedAlgo : undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          sort: sortBy,
          order: sortOrder,
        },
        withCredentials: true,
      });
      setRuns(res.data.runs || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load experiment runs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [selectedAlgo, selectedStatus, sortBy, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRuns();
  };

  const handleRerun = async (runId) => {
    try {
      setRerunStatus({ runId, loading: true });
      const res = await axios.post(`/api/pipelines/runs/${runId}/rerun/`, {}, { withCredentials: true });
      setRerunStatus({ runId, success: true, message: res.data.message });
      setTimeout(() => {
        setRerunStatus(null);
        fetchRuns();
      }, 2000);
    } catch (err) {
      setRerunStatus({ runId, error: 'Failed to rerun experiment.' });
      setTimeout(() => setRerunStatus(null), 3000);
    }
  };

  const handleDelete = async (runId) => {
    if (!window.confirm('Are you sure you want to archive this experiment run?')) return;
    try {
      await axios.delete(`/api/pipelines/runs/${runId}/`, { withCredentials: true });
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      setSelectedRunIds((prev) => prev.filter((id) => id !== runId));
    } catch (err) {
      alert('Failed to archive experiment run.');
    }
  };

  const handleExport = (format) => {
    window.open(`/api/pipelines/experiments/export/?format=${format}`, '_blank');
  };

  const toggleSelectRun = (id) => {
    setSelectedRunIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const distinctAlgos = useMemo(() => {
    const set = new Set();
    runs.forEach((r) => {
      if (r.algorithm) set.add(r.algorithm);
    });
    return Array.from(set);
  }, [runs]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = runs.length;
    const successCount = runs.filter((r) => r.status === 'success').length;
    const bestRun = runs.find((r) => r.is_best_run) || runs[0];
    const totalDuration = runs.reduce((acc, r) => acc + (r.elapsed_seconds || 0), 0);
    return {
      total,
      successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
      bestRun,
      totalDuration: Math.round(totalDuration),
    };
  }, [runs]);

  const comparedRuns = useMemo(() => {
    return runs.filter((r) => selectedRunIds.includes(r.id));
  }, [runs, selectedRunIds]);

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Space Grotesk', sans-serif",
      padding: '28px 36px',
      boxSizing: 'border-box',
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🧪</span>
            <h1 style={{
              fontSize: 26,
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(135deg, #f8fafc 0%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Experiment Tracking & Benchmark Lab
            </h1>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Inspect model parameters, benchmark evaluation metrics, and replay reproducible training runs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => handleExport('csv')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f1f5f9',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f1f5f9',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📄 Export JSON
          </button>
          <button
            onClick={fetchRuns}
            style={{
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(236, 72, 153, 0.4)',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '16px 20px',
        }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>TOTAL RUNS</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>{summary.total}</div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '16px 20px',
        }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>SUCCESS RATE</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
            {summary.successRate}%
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 0 20px rgba(236, 72, 153, 0.08)',
        }}>
          <div style={{ color: '#ec4899', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            🏆 TOP BENCHMARK MODEL
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
            {summary.bestRun?.algorithm || 'No Model Yet'}
          </div>
          {summary.bestRun?.metrics?.accuracy !== undefined && (
            <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 2 }}>
              Accuracy: {(summary.bestRun.metrics.accuracy * 100).toFixed(1)}%
            </div>
          )}
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '16px 20px',
        }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>TOTAL TRAINING TIME</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
            {summary.totalDuration}s
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px' }}>
          <input
            type="text"
            placeholder="Search by algorithm, dataset, pipeline..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              padding: '7px 12px',
              color: '#f8fafc',
              fontSize: 12.5,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Algorithm Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Algorithm:</span>
            <select
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="ALL">All Algorithms</option>
              {distinctAlgos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                outline: 'none',
              }}
            >
              <option value="start_time">Date / Time</option>
              <option value="accuracy">Accuracy</option>
              <option value="f1">F1 Score</option>
              <option value="r2">R² Score</option>
              <option value="elapsed_seconds">Duration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Action Bar */}
      {selectedRunIds.length >= 2 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(236, 72, 153, 0.4)',
          borderRadius: 10,
          padding: '12px 20px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ff85be' }}>
            ⚡ {selectedRunIds.length} Experiments Selected for Comparison
          </span>
          <button
            onClick={() => setShowCompareModal(true)}
            style={{
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#fff',
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.3)',
            }}
          >
            ⚔️ Compare Side-by-Side
          </button>
        </div>
      )}

      {/* Experiment Runs Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            Loading experiment runs...
          </div>
        ) : runs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No experiment runs found. Run a pipeline from the Canvas to start recording experiments!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'left',
                  color: '#94a3b8',
                }}>
                  <th style={{ padding: '12px 14px', width: 40 }}></th>
                  <th style={{ padding: '12px 14px' }}>Run #</th>
                  <th style={{ padding: '12px 14px' }}>Pipeline</th>
                  <th style={{ padding: '12px 14px' }}>Algorithm</th>
                  <th style={{ padding: '12px 14px' }}>Dataset</th>
                  <th style={{ padding: '12px 14px' }}>Accuracy / R²</th>
                  <th style={{ padding: '12px 14px' }}>F1 / RMSE</th>
                  <th style={{ padding: '12px 14px' }}>Duration</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Timestamp</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const m = r.metrics || {};
                  const isChecked = selectedRunIds.includes(r.id);
                  const isBest = r.is_best_run;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isChecked
                          ? 'rgba(236, 72, 153, 0.08)'
                          : isBest
                          ? 'rgba(236, 72, 153, 0.04)'
                          : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRun(r.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          #{r.run_number}
                          {isBest && (
                            <span title="Best Performing Model" style={{ fontSize: 13 }}>👑</span>
                          )}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#f1f5f9', fontWeight: 600 }}>
                        {r.pipeline_name}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#c084fc',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}>
                          {r.algorithm}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                        {r.dataset_name || '—'}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#38bdf8' }}>
                        {m.accuracy !== undefined
                          ? `${(m.accuracy * 100).toFixed(1)}%`
                          : m.r2 !== undefined
                          ? m.r2.toFixed(3)
                          : '—'}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>
                        {m.f1 !== undefined
                          ? m.f1.toFixed(3)
                          : m.rmse !== undefined
                          ? m.rmse.toFixed(3)
                          : '—'}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                        {r.elapsed_seconds ? `${r.elapsed_seconds}s` : '—'}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: r.status === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: r.status === 'success' ? '#4ade80' : '#f87171',
                          border: `1px solid ${r.status === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {r.status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 11.5 }}>
                        {r.start_time || '—'}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => setActiveRunDetail(r)}
                            title="Inspect Run Details"
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: 'none',
                              color: '#f8fafc',
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            🔍 Details
                          </button>
                          <button
                            onClick={() => handleRerun(r.id)}
                            title="Rerun this Experiment Snapshot"
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            ⚡ Replay
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            title="Archive Run"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              padding: '5px 9px',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Detail Modal */}
      {activeRunDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 24,
        }}>
          <div style={{
            background: '#0b1120',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 720,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 28,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#f8fafc' }}>
                  Run #{activeRunDetail.run_number} Details — {activeRunDetail.algorithm}
                </h2>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Pipeline: {activeRunDetail.pipeline_name} | Dataset: {activeRunDetail.dataset_name}
                </div>
              </div>
              <button
                onClick={() => setActiveRunDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Metrics Grid */}
            <h4 style={{ fontSize: 13, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 10 }}>Evaluation Metrics</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {Object.entries(activeRunDetail.metrics || {}).map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{k.replace('_', ' ')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                    {typeof v === 'number' ? (v < 1 && v > 0 ? (v * 100).toFixed(2) + '%' : v.toFixed(3)) : String(v)}
                  </div>
                </div>
              ))}
            </div>

            {/* Hyperparameters */}
            <h4 style={{ fontSize: 13, color: '#c084fc', textTransform: 'uppercase', marginBottom: 10 }}>Hyperparameters</h4>
            <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 12 }}>
              <pre style={{ margin: 0, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(activeRunDetail.hyperparameters, null, 2)}
              </pre>
            </div>

            {/* Preprocessing Steps */}
            <h4 style={{ fontSize: 13, color: '#4ade80', textTransform: 'uppercase', marginBottom: 10 }}>Preprocessing Pipeline</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {(activeRunDetail.preprocessing_steps || []).map((step, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{step.type}</span>
                  <span style={{ color: '#94a3b8' }}>{JSON.stringify(step.params || {})}</span>
                </div>
              ))}
            </div>

            {/* Error banner if any */}
            {activeRunDetail.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 8,
                padding: 12,
                color: '#f87171',
                fontSize: 12,
                marginBottom: 20,
              }}>
                <strong>Execution Error:</strong> {activeRunDetail.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  const rId = activeRunDetail.id;
                  setActiveRunDetail(null);
                  handleRerun(rId);
                }}
                style={{
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚡ Replay Experiment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Side-by-Side Modal */}
      {showCompareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 24,
        }}>
          <div style={{
            background: '#0b1120',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 960,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 28,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: '#f8fafc' }}>
                ⚔️ Side-by-Side Run Comparison ({comparedRuns.length} Runs)
              </h2>
              <button
                onClick={() => setShowCompareModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', color: '#94a3b8' }}>Metric / Parameter</th>
                    {comparedRuns.map((r) => (
                      <th key={r.id} style={{ padding: '12px 14px', color: '#ff85be' }}>
                        Run #{r.run_number} ({r.algorithm})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Pipeline</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px' }}>{r.pipeline_name}</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Status</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px' }}>
                        <span style={{ color: r.status === 'success' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                          {r.status}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Accuracy</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px', fontWeight: 700, color: '#38bdf8' }}>
                        {r.metrics?.accuracy !== undefined ? `${(r.metrics.accuracy * 100).toFixed(2)}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>F1 Score</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px', color: '#c084fc' }}>
                        {r.metrics?.f1 !== undefined ? r.metrics.f1.toFixed(3) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Training Duration</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px' }}>{r.elapsed_seconds}s</td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Hyperparameters</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px', fontSize: 11.5, color: '#cbd5e1' }}>
                        <pre style={{ margin: 0 }}>{JSON.stringify(r.hyperparameters || {}, null, 1)}</pre>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Preprocessing Nodes</td>
                    {comparedRuns.map((r) => (
                      <td key={r.id} style={{ padding: '10px 14px', fontSize: 11.5 }}>
                        {(r.preprocessing_steps || []).map((s) => s.type).join(' ➔ ') || 'None'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
