import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api.js';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = setTimeout(fetchShops, 250); // debounce search
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchShops() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/shops', { params: query ? { q: query } : {} });
      setShops(res.data.shops);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Shops in your district</h1>
      <p className="text-ink/60 mb-6">Search by name, or browse everything on offer.</p>

      <input
        className="input max-w-md mb-8"
        placeholder="Search shops…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ErrorBanner message={error} />

      {loading ? (
        <p className="text-ink/50">Loading shops…</p>
      ) : shops.length === 0 ? (
        <EmptyState title="No shops match your search" hint="Try a different name or clear the search box." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => (
            <Link key={shop.id} to={`/shops/${shop.id}`} className="card hover:border-marigold transition-colors">
              <p className="font-display text-lg">{shop.name}</p>
              {shop.category && <p className="text-sm text-brick mt-0.5">{shop.category}</p>}
              {shop.address && <p className="text-sm text-ink/60 mt-2">{shop.address}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
