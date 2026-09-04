import React, { useEffect, useState } from 'react';
import api from '../../api.js';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

const FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'customer', label: 'Customers' },
  { value: 'shop_owner', label: 'Shop owners' },
  { value: 'delivery_boy', label: 'Delivery partners' },
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  async function fetchUsers() {
    try {
      const res = await api.get('/admin/users', { params: filter ? { role: filter } : {} });
      setUsers(res.data.users);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(user) {
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}/status`, { is_active: user.is_active ? 0 : 1 });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">People on the platform</h1>
      <p className="text-ink/60 mb-6">Deactivate an account to block sign-in without deleting their history.</p>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={filter === f.value ? 'btn-primary !py-1.5' : 'btn-outline !py-1.5'}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {users.length === 0 ? (
        <EmptyState title="No users in this category yet" />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {u.name} {!u.is_active && <span className="text-xs text-brick ml-1">(deactivated)</span>}
                </p>
                <p className="text-sm text-ink/60">{u.email} · {u.phone || 'no phone on file'}</p>
              </div>
              {u.role !== 'admin' && (
                <button className="btn-outline !py-1.5 !px-3" onClick={() => toggleActive(u)}>
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
