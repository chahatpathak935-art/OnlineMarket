import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

export default function Earnings() {
  const [data, setData] = useState({ total: 0, entries: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/orders/delivery/earnings')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Your earnings</h1>
      <p className="text-ink/60 mb-6">A running total of what you've earned per delivery.</p>
      <ErrorBanner message={error} />

      <div className="card mb-6">
        <p className="text-sm text-ink/60">Total earned</p>
        <p className="font-display text-4xl mt-1">₹{data.total}</p>
      </div>

      {data.entries.length === 0 ? (
        <EmptyState title="No completed deliveries yet" hint="Earnings show up here once you mark an order delivered." />
      ) : (
        <div className="card divide-y divide-ledger">
          {data.entries.map((e) => (
            <div key={e.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm">Order #{e.order_id}</p>
                <p className="text-xs text-ink/50">{e.delivery_address}</p>
              </div>
              <span className="font-medium">+₹{e.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
