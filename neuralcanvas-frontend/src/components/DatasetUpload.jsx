import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

export default function DatasetUpload({ onUploaded, isDark = true }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [existingDatasets, setExistingDatasets] = useState([]);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'existing'
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingExisting(true);
      try {
        const res = await api.get('/datasets/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setExistingDatasets(list);
        if (list.length > 0) {
          setSelectedExistingId(String(list[0].id));
        }
      } catch {
        // ignore
      } finally {
        setLoadingExisting(false);
      }
    };
    fetchDatasets();
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Please drop a valid .csv file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      const res = await api.post('/datasets/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(res.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Check the CSV format and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectExisting = () => {
    const found = existingDatasets.find((d) => String(d.id) === String(selectedExistingId));
    if (found) {
      onUploaded(found);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Tab Selector */}
      <div style={{
        display: 'flex',
        background: 'rgba(10, 15, 26, 0.8)',
        borderRadius: 8,
        padding: 3,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11.5,
            fontWeight: 700,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            background: activeTab === 'upload' ? 'rgba(255, 0, 113, 0.2)' : 'transparent',
            color: activeTab === 'upload' ? '#ff85be' : '#64748b',
            transition: 'all 0.15s ease',
          }}
        >
          ⬆ Upload New CSV
        </button>
        <button
          onClick={() => setActiveTab('existing')}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11.5,
            fontWeight: 700,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            background: activeTab === 'existing' ? 'rgba(255, 0, 113, 0.2)' : 'transparent',
            color: activeTab === 'existing' ? '#ff85be' : '#64748b',
            transition: 'all 0.15s ease',
          }}
        >
          📂 Library ({existingDatasets.length})
        </button>
      </div>

      {activeTab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              borderRadius: 12,
              border: isDragging
                ? '2px dashed #ff0071'
                : '1.5px dashed rgba(255, 255, 255, 0.15)',
              background: isDragging
                ? 'rgba(255, 0, 113, 0.08)'
                : 'rgba(10, 15, 26, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isDragging ? '0 0 20px rgba(255, 0, 113, 0.2)' : 'none',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(255, 0, 113, 0.15)',
              border: '1px solid rgba(255, 0, 113, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              marginBottom: 8,
              boxShadow: '0 0 14px rgba(255, 0, 113, 0.25)',
            }}>
              📂
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
              {file ? file.name : 'Choose CSV or drag here'}
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b' }}>
              {file ? `${formatBytes(file.size)} • Ready to upload` : 'Supports standard .csv tabular datasets'}
            </div>
          </div>

          {/* Selected File Pill */}
          {file && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 0, 113, 0.08)',
              border: '1px solid rgba(255, 0, 113, 0.25)',
              borderRadius: 8,
              padding: '6px 10px',
            }}>
              <span style={{ fontSize: 11.5, color: '#ff85be', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📄 {file.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              >
                ×
              </button>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              width: '100%',
              background: !file || uploading
                ? 'rgba(255, 255, 255, 0.05)'
                : 'linear-gradient(135deg, #ff0071 0%, #d90368 100%)',
              color: !file || uploading ? '#64748b' : '#fff',
              border: !file || uploading ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              borderRadius: 9,
              padding: '9px 0',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: !file || uploading ? 'not-allowed' : 'pointer',
              boxShadow: !file || uploading ? 'none' : '0 4px 18px rgba(255, 0, 113, 0.4)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {uploading ? '⏳ Uploading & Analyzing...' : '⚡ Upload & Attach Dataset'}
          </button>
        </div>
      )}

      {activeTab === 'existing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingExisting && (
            <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', padding: 12 }}>
              Loading saved datasets...
            </div>
          )}

          {!loadingExisting && existingDatasets.length === 0 && (
            <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', padding: 14 }}>
              No previously uploaded datasets found.
            </div>
          )}

          {!loadingExisting && existingDatasets.length > 0 && (
            <>
              <div>
                <label style={{ fontSize: 11.5, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                  Select from Library:
                </label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(10, 15, 26, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f1f5f9',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    outline: 'none',
                  }}
                >
                  {existingDatasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.columns?.length || 0} cols)
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSelectExisting}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ff0071 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9,
                  padding: '9px 0',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255, 0, 113, 0.35)',
                  transition: 'all 0.2s ease',
                }}
              >
                ✔ Attach Selected Dataset
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: 11.5,
          padding: '6px 10px',
          borderRadius: 7,
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}