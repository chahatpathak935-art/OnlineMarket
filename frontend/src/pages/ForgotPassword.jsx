import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { ErrorBanner } from '../components/Feedback.jsx';
import OtpStep from '../components/OtpStep.jsx';

export default function ForgotPassword() {
  const [step, setStep] = useState('email'); // 'email' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = () => api.post('/auth/forgot/request', { email });

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestCode();
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(code) {
    if (busy) return;
    setError('');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters');
    if (newPassword !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/forgot/reset', { email, otp: code, newPassword });
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Reset password</h1>
      <p className="text-ink/60 mb-6">
        {step === 'email' && "Enter your email and we'll send you a code."}
        {step === 'reset' && 'Enter the code and choose a new password.'}
        {step === 'done' && 'All set.'}
      </p>

      <div className="card">
        {step === 'email' && (
          <form onSubmit={handleEmail} className="space-y-4">
            <ErrorBanner message={error} />
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <OtpStep
            email={email}
            busy={busy}
            error={error}
            submitLabel="Reset password"
            onSubmit={handleReset}
            onResend={requestCode}
            onBack={() => {
              setError('');
              setStep('email');
            }}
          >
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input className="input" type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </OtpStep>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <p>Your password has been updated.</p>
            <Link to="/login" className="btn-primary inline-block">Go to log in</Link>
          </div>
        )}
      </div>

      <p className="text-sm text-ink/60 mt-4">
        Remembered it? <Link to="/login" className="text-brick font-medium">Log in</Link>
      </p>
    </div>
  );
}
