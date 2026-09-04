import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';

const ROLE_HOME = {
  customer: '/shops',
  shop_owner: '/shop/dashboard',
  delivery_boy: '/delivery/dashboard',
};

const ROLES = [
  { value: 'customer', label: 'Customer', hint: 'Shop from stores across the district' },
  { value: 'shop_owner', label: 'Shop owner', hint: 'List your shop and manage stock' },
  { value: 'delivery_boy', label: 'Delivery partner', hint: 'Pick up and deliver orders, earn per delivery' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await register(form);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Create an account</h1>
      <p className="text-ink/60 mb-6">Choose how you'll use Mandi Market.</p>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <ErrorBanner message={error} />

        <div>
          <label className="label">I am a…</label>
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`flex items-start gap-3 border rounded px-3 py-2.5 cursor-pointer ${
                  form.role === r.value ? 'border-marigold bg-marigold-light/40' : 'border-ledger'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={form.role === r.value}
                  onChange={() => update('role', r.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-sm">{r.label}</span>
                  <span className="block text-xs text-ink/60">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>

        {form.role === 'shop_owner' && (
          <p className="text-xs text-ink/60 bg-ledger/40 rounded px-3 py-2">
            After signing up, ask the platform admin to add your shop using this email address —
            that's what links your account to your shop.
          </p>
        )}

        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-4">
        Already have an account? <Link to="/login" className="text-brick font-medium">Log in</Link>
      </p>
    </div>
  );
}
