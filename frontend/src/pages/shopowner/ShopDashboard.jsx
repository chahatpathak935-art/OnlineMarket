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

  useEffect(() => {
    fetchOrders();
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
                {o.status === 'placed' && (
                  <button className="btn-accent !py-1.5" disabled={busyId === o.id} onClick={() => act(o.id, 'accept')}>
                    {busyId === o.id ? 'Accepting…' : 'Accept order'}
                  </button>
                )}
                {o.status === 'accepted' && (
                  <button className="btn-accent !py-1.5" disabled={busyId === o.id} onClick={() => act(o.id, 'pack')}>
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
