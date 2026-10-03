import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';
import OtpStep from '../components/OtpStep.jsx';

const ROLE_HOME = {
  customer: '/shops',
  shop_owner: '/shop/dashboard',
  delivery_boy: '/delivery/dashboard',
  admin: '/admin/dashboard',
};

export default function Login() {
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resendIn, setResendIn] = useState(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCredentials(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await requestLoginOtp(email, password);
      setResendIn(data.resendInSeconds || 30);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOtp(code) {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await verifyLoginOtp(email, code);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl mb-1">{step === 'otp' ? 'Enter your code' : 'Log in'}</h1>
      <p className="text-ink/60 mb-6">
        {step === 'otp' ? 'One more step to keep your account safe.' : 'Shop, sell, or deliver across the district.'}
      </p>

      <div className="card">
        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <ErrorBanner message={error} />
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Sending code…' : 'Continue'}
            </button>
            <p className="text-sm text-right">
              <Link to="/forgot-password" className="text-brick font-medium">Forgot password?</Link>
            </p>
          </form>
        ) : (
          <OtpStep
            email={email}
            resendIn={resendIn}
            busy={busy}
            error={error}
            submitLabel="Verify and log in"
            onSubmit={handleOtp}
            onResend={() => requestLoginOtp(email, password)}
            onBack={() => {
              setError('');
              setStep('credentials');
            }}
          />
        )}
      </div>

      <p className="text-sm text-ink/60 mt-4">
        New here? <Link to="/register" className="text-brick font-medium">Create an account</Link>
      </p>
    </div>
  );
}
