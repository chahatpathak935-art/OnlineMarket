import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

const EMPTY_FORM = { name: '', description: '', price: '', unit: 'kg', quantity: '' };

export default function Inventory() {
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const res = await api.get('/shops/mine/detail');
      setShop(res.data.shop);
      setProducts(res.data.products);
    } catch (err) {
      setError(err.message);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function addProduct(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/products', {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
      });
      setForm(EMPTY_FORM);
      setNotice('Item added to your shop.');
      setTimeout(() => setNotice(''), 2000);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(product, delta) {
    setError('');
    try {
      await api.patch(`/products/${product.id}/stock`, { delta });
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(product) {
    setError('');
    try {
      await api.patch(`/products/${product.id}`, { is_active: product.is_active ? 0 : 1 });
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeProduct(product) {
    if (!confirm(`Remove "${product.name}" from your shop?`)) return;
    setError('');
    try {
      await api.delete(`/products/${product.id}`);
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !shop) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10">
        <ErrorBanner message={error} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">{shop ? shop.name : 'Your shop'}</h1>
      <p className="text-ink/60 mb-6">Manage what's in stock — customers only see items with quantity above zero.</p>

      <ErrorBanner message={error} />
      {notice && (
        <div className="border border-leaf/40 bg-leaf-light text-leaf-dark text-sm rounded px-4 py-2.5 mb-4">{notice}</div>
      )}

      <form onSubmit={addProduct} className="card grid sm:grid-cols-2 gap-4 mb-8">
        <div className="sm:col-span-2">
          <label className="label">Item name</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description (optional)</label>
          <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Price (₹)</label>
          <input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => update('price', e.target.value)} />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={form.unit} onChange={(e) => update('unit', e.target.value)}>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="pc">pc</option>
            <option value="dozen">dozen</option>
            <option value="litre">litre</option>
            <option value="packet">packet</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Stock quantity</label>
          <input className="input" type="number" min="0" required value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
        </div>
        <button className="btn-primary sm:col-span-2" disabled={busy} type="submit">
          {busy ? 'Adding…' : 'Add item to shop'}
        </button>
      </form>

      {products.length === 0 ? (
        <EmptyState title="No items listed yet" hint="Add your first item using the form above." />
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">
                  {p.name} {!p.is_active && <span className="text-xs text-brick ml-1">(hidden)</span>}
                </p>
                <p className="text-sm text-ink/60">₹{p.price} / {p.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-outline !px-2 !py-1" onClick={() => adjustStock(p, -1)} disabled={p.quantity <= 0}>−</button>
                <span className="w-10 text-center">{p.quantity}</span>
                <button className="btn-outline !px-2 !py-1" onClick={() => adjustStock(p, 1)}>+</button>
              </div>
              <button className="btn-outline !py-1.5 !px-3" onClick={() => toggleActive(p)}>
                {p.is_active ? 'Hide' : 'Show'}
              </button>
              <button className="btn-danger !py-1.5 !px-3" onClick={() => removeProduct(p)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
