import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Download, Trash2, ToggleRight,
  ToggleLeft, Tag, CheckSquare, Square, X, ArrowUpDown, Link2,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import CreateLinkModal from '../components/CreateLinkModal';
import LinkCard from '../components/LinkCard';
import FeatureHelp from '../components/FeatureHelp';
import toast from 'react-hot-toast';

export default function LinksPage() {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (selectedTag) params.tag = selectedTag;

      const res = await api.get('/urls', { params });
      setUrls(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, selectedTag, sortBy, sortOrder]);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  // Bulk selection helpers
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrentPage = () => {
    if (selectedIds.size === urls.length && urls.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(urls.map(u => u.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk actions execution
  const executeBulkAction = async (action, extraData = {}) => {
    if (selectedIds.size === 0) return;
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected links? This cannot be undone.`)) return;
    }

    setBulkProcessing(true);
    try {
      const res = await api.post('/urls/bulk', {
        action,
        urlIds: Array.from(selectedIds),
        ...extraData,
      });

      toast.success(res.data.message || `Bulk ${action} completed`);
      clearSelection();
      setShowTagModal(false);
      setNewTagInput('');
      fetchUrls();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to perform bulk ${action}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    try {
      await api.delete(`/urls/${id}`);
      toast.success('Link deleted');
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchUrls();
    } catch {
      toast.error('Failed to delete link');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/urls/${id}`, { status: newStatus });
      toast.success(`Link ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      fetchUrls();
    } catch {
      toast.error('Failed to update link');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/urls/export/csv', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `axly-links-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Links exported to CSV!');
    } catch {
      toast.error('Failed to export links');
    }
  };

  // Collect unique tags across loaded links
  const availableTags = Array.from(new Set(urls.flatMap(u => Array.isArray(u.tags) ? u.tags : [])));

  return (
    <div className="page-container" style={{ paddingBottom: selectedIds.size > 0 ? 100 : 40 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">My Links</h1>
            <FeatureHelp featureKey="shorten" title="My Links" />
          </div>
          <p className="page-subtitle">
            {pagination.total} link{pagination.total !== 1 ? 's' : ''} total · Smart routing, analytics, and custom aliases
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} title="Export all owned links">
            <Download size={15} /> Export CSV
          </button>
          <button id="links-create-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Link
          </button>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div className="search-wrap" style={{ flex: 1, minWidth: 240 }}>
            <Search size={15} className="search-icon" />
            <input
              id="links-search"
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Search destination, title, alias, or notes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status:</span>
            {['all', 'active', 'inactive', 'expired'].map(st => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize', padding: '4px 12px', fontSize: '0.78rem' }}
                onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto' }}
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                setSortBy(sb);
                setSortOrder(so);
                setCurrentPage(1);
              }}
            >
              <option value="created_at:DESC">Newest First</option>
              <option value="created_at:ASC">Oldest First</option>
              <option value="click_count:DESC">Most Clicks</option>
              <option value="title:ASC">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tag Filters Row */}
        {(availableTags.length > 0 || selectedTag) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Tag size={12} /> Tags:
            </span>
            {selectedTag && (
              <button
                className="tag-badge clickable active"
                onClick={() => { setSelectedTag(''); setCurrentPage(1); }}
              >
                All Tags <X size={10} style={{ marginLeft: 2 }} />
              </button>
            )}
            {availableTags.map(tag => (
              <button
                key={tag}
                className={`tag-badge clickable ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTag(selectedTag === tag ? '' : tag);
                  setCurrentPage(1);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Select All Row (when links present) */}
      {urls.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            onClick={selectAllCurrentPage}
          >
            {selectedIds.size === urls.length && urls.length > 0 ? (
              <><CheckSquare size={14} color="var(--brand-primary)" /> Deselect Page</>
            ) : (
              <><Square size={14} /> Select All on Page ({urls.length})</>
            )}
          </button>
          {selectedIds.size > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* Links List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
      ) : urls.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Link2 size={28} style={{ color: 'var(--text-muted)' }} /></div>
          <div className="empty-title">
            {debouncedSearch || statusFilter !== 'all' || selectedTag
              ? 'No links match your filter criteria'
              : 'No links created yet'}
          </div>
          <div className="empty-desc">
            {debouncedSearch || statusFilter !== 'all' || selectedTag
              ? 'Try resetting your search, status, or tag filters.'
              : 'Create your first short link with custom routing and analytics.'}
          </div>
          {!debouncedSearch && statusFilter === 'all' && !selectedTag && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create your first link
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {urls.map(url => (
              <LinkCard
                key={url.id}
                url={url}
                isSelected={selectedIds.has(url.id)}
                onToggleSelect={() => toggleSelect(url.id)}
                onTagClick={(t) => { setSelectedTag(t); setCurrentPage(1); }}
                onDelete={() => handleDelete(url.id)}
                onToggleStatus={() => handleToggleStatus(url.id, url.status)}
                showActions
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span style={{
                padding: '8px 16px', fontSize: '0.875rem',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              }}>
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Sticky Bulk Actions Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedIds.size} link{selectedIds.size > 1 ? 's' : ''} selected
          </span>

          <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => executeBulkAction('activate')}
            disabled={bulkProcessing}
            title="Enable selected links"
          >
            <ToggleRight size={14} color="#10b981" /> Enable
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => executeBulkAction('deactivate')}
            disabled={bulkProcessing}
            title="Disable selected links"
          >
            <ToggleLeft size={14} color="#f59e0b" /> Disable
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowTagModal(true)}
            disabled={bulkProcessing}
            title="Add tag to selected links"
          >
            <Tag size={14} /> Add Tag
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => executeBulkAction('delete')}
            disabled={bulkProcessing}
            style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            title="Delete selected links"
          >
            <Trash2 size={14} /> Delete
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={clearSelection}
            style={{ padding: 6, color: 'var(--text-muted)' }}
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showTagModal && (
        <div className="modal-overlay" onClick={() => setShowTagModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add Tag to {selectedIds.size} Links</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Enter a tag to attach to all selected URLs.</p>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. twitter-campaign, summer2026"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              autoFocus
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTagModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!newTagInput.trim() || bulkProcessing}
                onClick={() => executeBulkAction('add_tag', { tag: newTagInput.trim() })}
              >
                Apply Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchUrls(); }}
        />
      )}
    </div>
  );
}
