import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { getSocket } from '../../socket.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    fetchOrders();

    const socket = getSocket();
    if (socket) {
      socket.on('order_status_changed', handleUpdate);
      socket.on('delivery_location', handleLocation);
      return () => {
        socket.off('order_status_changed', handleUpdate);
        socket.off('delivery_location', handleLocation);
      };
    }
  }, []);

  function handleUpdate(updated) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  }

  function handleLocation({ orderId, latitude, longitude }) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, delivery_boy_lat: latitude, delivery_boy_lng: longitude } : o))
    );
  }

  async function fetchOrders() {
    try {
      const res = await api.get('/orders/mine');
      setOrders(res.data.orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder(id) {
    try {
      await api.patch(`/orders/${id}/cancel`);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-6">My orders</h1>
      <ErrorBanner message={error} />

      {loading ? (
        <p className="text-ink/50">Loading…</p>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" hint="Once you order from a shop, you'll be able to track it here." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{o.shop_name}</p>
                  <p className="text-xs text-ink/50 mt-0.5">
                    Order #{o.id} · {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>
                                <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-ink/60">Total: ₹{o.grand_total}</span>
                    {o.status === 'placed' && (
                      <button className="btn-danger !py-1 !px-3" onClick={() => cancelOrder(o.id)}>
                        Cancel order
                      </button>
                    )}
                  </div>
                                   {o.status !== 'cancelled' && (
                    <div className="mt-3">
                      <OrderMap
                        shopLat={o.shop_latitude}
                        shopLng={o.shop_longitude}
                        customerLat={o.delivery_latitude}
                        customerLng={o.delivery_longitude}
                        deliveryLat={o.delivery_boy_lat}
                        deliveryLng={o.delivery_boy_lng}
                        height={200}
                      />
                    </div>
                  )}
                </div>
          ))}
        </div>
      )}
    </div>
  );
}
