import { useState } from 'react';
import {
  FileSpreadsheet, Upload, Download, Check, AlertTriangle,
  X, RefreshCw, FileText, ArrowRight, ShieldAlert,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import FeatureHelp from '../components/FeatureHelp';
import toast from 'react-hot-toast';

const CSV_SAMPLE = `original_url,title,custom_alias,tags
https://github.com/Ravikiran9988/axly-url-shortener,Axly Repository,axly-repo,"github, open-source"
https://example.com/docs,Developer Documentation,axly-docs,"docs, api"
https://example.com/pricing,Pricing Plans,,pricing`;

export default function BulkImportPage() {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  // Download Sample Template
  const handleDownloadSample = () => {
    const blob = new Blob([CSV_SAMPLE], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'axly-import-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('Sample CSV template downloaded!');
  };

  // Parse CSV into rows & validate
  const parseCsvContent = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const urlIdx = header.indexOf('original_url');
    const titleIdx = header.indexOf('title');
    const aliasIdx = header.indexOf('custom_alias');
    const tagsIdx = header.indexOf('tags');

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Basic CSV field parser supporting quotes
      const line = lines[i];
      const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

      const originalUrl = parts[urlIdx] || parts[0] || '';
      const title = titleIdx !== -1 ? parts[titleIdx] : '';
      const customAlias = aliasIdx !== -1 ? parts[aliasIdx] : '';
      const tagsStr = tagsIdx !== -1 ? parts[tagsIdx] : '';
      const tags = tagsStr ? tagsStr.split(';').map(t => t.trim()).filter(Boolean) : [];

      let error = null;
      if (!originalUrl) {
        error = 'Missing destination URL';
      } else if (!/^https?:\/\//i.test(originalUrl)) {
        error = 'Must start with http:// or https://';
      } else if (/localhost|127\.0\.0\.1|169\.254\./i.test(originalUrl)) {
        error = 'Restricted / private network address (SSRF guard)';
      }

      rows.push({
        rowNum: i + 1,
        originalUrl,
        title,
        customAlias,
        tags,
        isValid: !error,
        error,
      });
    }

    setParsedRows(rows);
    setResultSummary(null);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    parseCsvContent(val);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCsvText(text);
        parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  // Submit Bulk Import
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows found to import');
      return;
    }

    setImporting(true);
    try {
      const res = await api.post('/urls/bulk-import', {
        rows: validRows.map(r => ({
          originalUrl: r.originalUrl,
          title: r.title,
          customAlias: r.customAlias,
          tags: r.tags,
        })),
      });

      setResultSummary(res.data);
      toast.success(`Successfully imported ${res.data.successCount} links.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete bulk import');
    } finally {
      setImporting(false);
    }
  };

  // Full Account CSV Export
  const handleFullExport = async () => {
    try {
      const res = await api.get('/urls/export/csv', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `axly-all-links-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Account links exported to CSV!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Bulk Import &amp; Export Tools</h1>
            <FeatureHelp featureKey="bulk" title="Bulk Import & Export Tools" />
          </div>
          <p className="page-subtitle">
            Create dozens of short links simultaneously from a CSV file with atomic validation and SSRF verification
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleDownloadSample}>
            <FileText size={15} /> Sample Template
          </button>
          <button className="btn btn-secondary" onClick={handleFullExport}>
            <Download size={15} /> Export All Links
          </button>
        </div>
      </div>

      {/* Upload & Dropzone Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* File Dropzone */}
        <label className="csv-dropzone" htmlFor="csv-file-input">
          <Upload size={32} color="var(--brand-primary)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
            Click to upload CSV or drag and drop
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Max 2MB · UTF-8 formatted CSV · Up to 500 rows per batch
          </div>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>

        {/* Raw Text Input Card */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>
            Or Paste CSV Content Directly
          </div>
          <textarea
            className="form-input"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', minHeight: 120 }}
            placeholder={CSV_SAMPLE}
            value={csvText}
            onChange={handleTextChange}
          />
        </div>
      </div>

      {/* Validation Summary Header */}
      {parsedRows.length > 0 && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>CSV Live Validation Preview</h2>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.85rem' }}>
                <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={14} /> {validCount} valid rows ready
                </span>
                {invalidCount > 0 && (
                  <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <X size={14} /> {invalidCount} rows have errors
                  </span>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary"
              disabled={validCount === 0 || importing}
              onClick={handleImport}
              style={{ minWidth: 180 }}
            >
              {importing ? (
                <><RefreshCw size={15} className="spinner" /> Importing Batch...</>
              ) : (
                <><ArrowRight size={15} /> Import {validCount} Links</>
              )}
            </button>
          </div>

          {/* Result Outcome if completed */}
          {resultSummary && (
            <div style={{
              marginTop: 16,
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              border: '1px solid rgba(16,185,129,0.3)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <Check size={18} />
              <div>
                <strong>Batch complete:</strong> {resultSummary.successCount} links created in your workspace!
                {resultSummary.failedCount > 0 && ` (${resultSummary.failedCount} skipped due to conflicts/validation).`}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th>Destination URL</th>
                  <th>Title</th>
                  <th>Custom Alias</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r, i) => (
                  <tr key={i} style={{ background: r.isValid ? undefined : 'rgba(239,68,68,0.03)' }}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{r.rowNum}</td>
                    <td>
                      {r.isValid ? (
                        <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Valid</span>
                      ) : (
                        <span className="badge badge-expired" style={{ fontSize: '0.7rem' }} title={r.error}>
                          {r.error}
                        </span>
                      )}
                    </td>
                    <td style={{ wordBreak: 'break-all', maxWidth: 320 }}>{r.originalUrl}</td>
                    <td>{r.title || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {r.customAlias ? (
                        <code>{r.customAlias}</code>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Auto-generated</span>
                      )}
                    </td>
                    <td>
                      {r.tags?.length > 0 ? (
                        <span className="tag-badge">{r.tags.join(', ')}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
