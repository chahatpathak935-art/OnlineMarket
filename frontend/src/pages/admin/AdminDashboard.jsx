import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { ErrorBanner } from '../../components/Feedback.jsx';

const CARDS = [
  { key: 'shops', label: 'Active shops' },
  { key: 'customers', label: 'Customers' },
  { key: 'deliveryBoys', label: 'Delivery partners' },
  { key: 'activeOrders', label: 'Orders in progress' },
  { key: 'ordersToday', label: 'Orders today' },
  { key: 'revenueToday', label: 'Revenue today (₹)' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/stats').then((res) => setStats(res.data)).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Platform overview</h1>
      <p className="text-ink/60 mb-6">A snapshot of the whole market, district-wide.</p>
      <ErrorBanner message={error} />

      {stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {CARDS.map((c) => (
            <div key={c.key} className="card">
              <p className="text-sm text-ink/60">{c.label}</p>
              <p className="font-display text-3xl mt-1">{stats[c.key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
