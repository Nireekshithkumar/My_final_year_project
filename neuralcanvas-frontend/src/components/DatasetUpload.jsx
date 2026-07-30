import { useState } from 'react';
import axios from '../api/axios';

export default function DatasetUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      const res = await axios.post('/datasets/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(res.data); // { id, name, columns, row_count, ... }
    } catch (err) {
      setError('Upload failed. Check the file and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload Dataset'}
      </button>
      {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}
    </div>
  );
}