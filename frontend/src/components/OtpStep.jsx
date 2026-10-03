import React, { useEffect, useState } from 'react';
import OtpInput from './OtpInput.jsx';
import { ErrorBanner } from './Feedback.jsx';

// The "enter the code we emailed you" step, shared by login, register and forgot-password.
// onSubmit(code) is called when all 6 digits are in (or the button is pressed).
// onResend() must return a promise; it is throttled by a countdown.
export default function OtpStep({
  email,
  resendIn = 30,
  onSubmit,
  onResend,
  onBack,
  busy,
  error,
  submitLabel = 'Verify',
  children,
}) {
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(resendIn);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function resend() {
    setResendError('');
    try {
      await onResend();
      setCode('');
      setSeconds(resendIn);
    } catch (err) {
      setResendError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error || resendError} />
      <p className="text-sm text-ink/70">
        We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It expires in 5 minutes.
      </p>

      <OtpInput value={code} onChange={setCode} onComplete={onSubmit} disabled={busy} />

      {children}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={busy || code.length !== 6}
        onClick={() => onSubmit(code)}
      >
        {busy ? 'Please wait…' : submitLabel}
      </button>

      <div className="flex justify-between text-sm">
        <button type="button" className="text-ink/60 hover:text-ink" onClick={onBack}>
          ← Change email
        </button>
        {seconds > 0 ? (
          <span className="text-ink/50">Resend in {seconds}s</span>
        ) : (
          <button type="button" className="text-brick font-medium" onClick={resend}>
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
