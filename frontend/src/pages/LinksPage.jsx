import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { api } from '../context/AuthContext';
import CreateLinkModal from '../components/CreateLinkModal';
import LinkCard from '../components/LinkCard';
import toast from 'react-hot-toast';

export default function LinksPage() {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/urls', {
        params: { page: currentPage, limit: 10, search: debouncedSearch }
      });
      setUrls(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => { fetchUrls(); }, [fetchUrls]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    try {
      await api.delete(`/urls/${id}`);
      toast.success('Link deleted');
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

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Links</h1>
          <p className="page-subtitle">
            {pagination.total} links total · Manage and track all your short URLs
          </p>
        </div>
        <button id="links-create-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create Link
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} className="search-icon" />
          <input
            id="links-search"
            type="text"
            className="search-input"
            style={{ width: '100%' }}
            placeholder="Search by URL, title, or alias..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Links List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />
          ))}
        </div>
      ) : urls.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <div className="empty-title">{debouncedSearch ? 'No links match your search' : 'No links yet'}</div>
          <div className="empty-desc">
            {debouncedSearch
              ? 'Try a different search term'
              : 'Create your first short link to get started'}
          </div>
          {!debouncedSearch && (
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
                onUpdated={fetchUrls}
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

      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchUrls(); }}
        />
      )}
    </div>
  );
}
