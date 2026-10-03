import React, { useEffect, useState, useRef } from 'react';
import api from '../../api.js';
import { getSocket } from '../../socket.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import OrderMap from '../../components/OrderMap.jsx';

export default function DeliveryDashboard() {
  const [pool, setPool] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchAll();
    const socket = getSocket();
    if (socket) {
      socket.on('order_available_for_pickup', fetchAll);
      socket.on('order_claimed', fetchAll);
      socket.on('order_status_changed', fetchAll);
      return () => {
        socket.off('order_available_for_pickup', fetchAll);
        socket.off('order_claimed', fetchAll);
        socket.off('order_status_changed', fetchAll);
      };
    }
  }, []);

    const lastEmitRef = useRef(0);

  useEffect(() => {
    const activeOrders = mine.filter((o) => o.status === 'assigned' || o.status === 'picked_up');
    if (activeOrders.length === 0 || !navigator.geolocation) return;

    const socket = getSocket();
    if (!socket) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastEmitRef.current < 8000) return; // throttle to once every 8s
        lastEmitRef.current = now;
        const { latitude, longitude } = pos.coords;
        activeOrders.forEach((o) => {
          socket.emit('delivery_location_update', { orderId: o.id, latitude, longitude });
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mine]);

  async function fetchAll() {
    try {
      const [poolRes, mineRes] = await Promise.all([
        api.get('/orders/delivery/pool'),
        api.get('/orders/delivery/mine'),
      ]);
      setPool(poolRes.data.orders);
      setMine(mineRes.data.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function claim(id) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/orders/${id}/claim`);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function advance(order) {
    const action = order.status === 'assigned' ? 'picked-up' : 'delivered';
    setBusyId(order.id);
    setError('');
    try {
      await api.patch(`/orders/${order.id}/${action}`);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-10">
      <div>
        <h1 className="font-display text-3xl mb-1">Your active deliveries</h1>
        <ErrorBanner message={error} />
        {mine.length === 0 ? (
          <EmptyState title="No deliveries in progress" hint="Claim a pickup below to get started." />
        ) : (
          <div className="space-y-3">
            {mine.map((o) => (
              <div key={o.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Pick up from {o.shop_name}</p>
                    <p className="text-sm text-ink/60 mt-0.5">{o.shop_address}</p>
                    <p className="text-sm text-ink/80 mt-2">Deliver to: {o.delivery_address}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                                          <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-ink/60">Earning on this delivery: ₹{o.delivery_fee}</span>
                    <button className="btn-accent !py-1.5" disabled={busyId === o.id} onClick={() => advance(o)}>
                      {busyId === o.id
                        ? 'Updating…'
                        : o.status === 'assigned'
                        ? 'Mark picked up'
                        : 'Mark delivered'}
                    </button>
                  </div>
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
                </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-2xl mb-1">Available for pickup</h2>
        <p className="text-ink/60 mb-4 text-sm">Packed orders across the district, ready for collection.</p>
        {pool.length === 0 ? (
          <EmptyState title="Nothing to pick up right now" hint="New pickups appear here the moment a shop finishes packing." />
        ) : (
          <div className="space-y-3">
            {pool.map((o) => (
              <div key={o.id} className="card flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{o.shop_name}</p>
                  <p className="text-sm text-ink/60">{o.shop_address}</p>
                  <p className="text-sm text-ink/50 mt-1">Delivery fee: ₹{o.delivery_fee}</p>
                </div>
                <button className="btn-primary !py-1.5" disabled={busyId === o.id} onClick={() => claim(o.id)}>
                  {busyId === o.id ? 'Claiming…' : 'Claim pickup'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
