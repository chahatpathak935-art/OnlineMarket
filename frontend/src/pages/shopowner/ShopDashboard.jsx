
import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { getSocket } from '../../socket.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

export default function ShopDashboard() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiError, setUpiError] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchShopSettings();
    const socket = getSocket();
    if (socket) {
      socket.on('new_order', fetchOrders);
      socket.on('order_status_changed', fetchOrders);
      return () => {
        socket.off('new_order', fetchOrders);
        socket.off('order_status_changed', fetchOrders);
      };
    }
  }, []);

  async function fetchOrders() {
    try {
      const res = await api.get('/orders/shop/incoming');
      setOrders(res.data.orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchShopSettings() {
    try {
      const res = await api.get('/shops/mine/detail');
      setUpiId(res.data.shop.upi_id || '');
      setUpiPayeeName(res.data.shop.upi_payee_name || '');
    } catch (err) {
      // non-fatal, dashboard still works without this
    }
  }

  async function saveUpi(e) {
    e.preventDefault();
    setUpiError('');
    setUpiSaved(false);
    setSavingUpi(true);
    try {
      await api.patch('/shops/mine/detail', { upi_id: upiId, upi_payee_name: upiPayeeName });
      setUpiSaved(true);
    } catch (err) {
      setUpiError(err.message);
    } finally {
      setSavingUpi(false);
    }
  }

  async function act(id, action) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/orders/${id}/${action}`);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Incoming orders</h1>
      <p className="text-ink/60 mb-6">New orders arrive here the moment a customer checks out.</p>

      <form onSubmit={saveUpi} className="card space-y-3 mb-8">
        <h2 className="font-display text-xl">Payment settings</h2>
        <p className="text-sm text-ink/60">Add your UPI ID so customers can pay you directly for online orders.</p>
        <ErrorBanner message={upiError} />
        {upiSaved && <p className="text-sm text-leaf">Saved.</p>}
        <div>
          <label className="label">UPI ID</label>
          <input className="input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourshop@okaxis" />
        </div>
        <div>
          <label className="label">Name to show customers (optional)</label>
          <input className="input" value={upiPayeeName} onChange={(e) => setUpiPayeeName(e.target.value)} placeholder="Your shop name" />
        </div>
        <button className="btn-accent" disabled={savingUpi} type="submit">
          {savingUpi ? 'Saving…' : 'Save payment details'}
        </button>
      </form>

      <ErrorBanner message={error} />

      {loading ? (
        <p className="text-ink/50">Loading…</p>
      ) : orders.length === 0 ? (
        <EmptyState title="No active orders" hint="New orders from customers will show up here in real time." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Order #{o.id}</p>
                  <p className="text-xs text-ink/50 mt-0.5">{new Date(o.created_at).toLocaleString()}</p>
                  <p className="text-sm text-ink/70 mt-2">{o.delivery_address}</p>
                  {o.customer_note && <p className="text-sm text-ink/50 italic mt-1">"{o.customer_note}"</p>}
                </div>
                <StatusBadge status={o.status} />
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-ink/60">Items total: ₹{o.items_total}</span>
                <span className="text-sm text-ink/60">
                  {o.payment_method === 'online' ? 'Online (UPI)' : 'Cash on Delivery'}
                </span>
              </div>

              {o.payment_method === 'online' && (
                <div className="mt-2">
                  {o.payment_status === 'pending' && (
                    <p className="text-sm text-marigold-dark">Waiting for customer to pay via UPI…</p>
                  )}
                  {o.payment_status === 'claimed_paid' && (
                    <button
                      className="btn-accent !py-1.5 w-full mt-1"
                      disabled={busyId === o.id}
                      onClick={() => act(o.id, 'confirm-payment')}
                    >
                      {busyId === o.id ? 'Confirming…' : 'Customer says paid — confirm payment received'}
                    </button>
                  )}
                  {o.payment_status === 'confirmed' && (
                    <p className="text-sm text-leaf">Payment confirmed ✓</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                {o.status === 'placed' && (
                  <button className="btn-accent !py-1.5" disabled={busyId === o.id} onClick={() => act(o.id, 'accept')}>
                    {busyId === o.id ? 'Accepting…' : 'Accept order'}
                  </button>
                )}
                {o.status === 'accepted' && (
                  <button
                    className="btn-accent !py-1.5"
                    disabled={busyId === o.id || (o.payment_method === 'online' && o.payment_status !== 'confirmed')}
                    onClick={() => act(o.id, 'pack')}
                  >
                    {busyId === o.id ? 'Marking packed…' : 'Mark as packed'}
                  </button>
                )}
                {o.status === 'packed' && (
                  <span className="text-sm text-ink/50">Waiting for a delivery partner to pick up…</span>
                )}
                {(o.status === 'assigned' || o.status === 'picked_up') && (
                  <span className="text-sm text-ink/50">On its way to the customer</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}