import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

const EMPTY_FORM = { name: '', owner_email: '', category: '', description: '', address: '' };

export default function AdminShops() {
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShops();
  }, []);

  async function fetchShops() {
    try {
      const res = await api.get('/shops/admin/all');
      setShops(res.data.shops);
    } catch (err) {
      setError(err.message);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function addShop(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/shops', form);
      setForm(EMPTY_FORM);
      setNotice('Shop added to the market.');
      setTimeout(() => setNotice(''), 2000);
      fetchShops();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(shop) {
    setError('');
    try {
      await api.patch(`/shops/${shop.id}/status`, { is_active: shop.is_active ? 0 : 1 });
      fetchShops();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Shops in the market</h1>
      <p className="text-ink/60 mb-6">
        Add a shop by linking it to a "shop owner" account's email — they'll manage its stock and orders from there.
      </p>

      <ErrorBanner message={error} />
      {notice && (
        <div className="border border-leaf/40 bg-leaf-light text-leaf-dark text-sm rounded px-4 py-2.5 mb-4">{notice}</div>
      )}

      <form onSubmit={addShop} className="card grid sm:grid-cols-2 gap-4 mb-8">
        <div>
          <label className="label">Shop name</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Owner's account email</label>
          <input className="input" type="email" required value={form.owner_email} onChange={(e) => update('owner_email', e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input" placeholder="e.g. Grocery, Vegetables, Grains" value={form.category} onChange={(e) => update('category', e.target.value)} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description (optional)</label>
          <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <button className="btn-primary sm:col-span-2" disabled={busy} type="submit">
          {busy ? 'Adding…' : 'Add shop'}
        </button>
      </form>

      {shops.length === 0 ? (
        <EmptyState title="No shops yet" hint="Add the first shop using the form above." />
      ) : (
        <div className="space-y-3">
          {shops.map((s) => (
            <div key={s.id} className="card flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {s.name} {!s.is_active && <span className="text-xs text-brick ml-1">(deactivated)</span>}
                </p>
                <p className="text-sm text-ink/60">{s.owner_name} · {s.owner_email}</p>
                {s.address && <p className="text-xs text-ink/50 mt-0.5">{s.address}</p>}
              </div>
              <button className="btn-outline !py-1.5 !px-3" onClick={() => toggleActive(s)}>
                {s.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
