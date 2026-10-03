import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { ErrorBanner } from '../../components/Feedback.jsx';

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [orderId]);

  async function load() {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data.order);
      setShop(res.data.shop);
    } catch (err) {
      setError(err.message);
    }
  }

  async function markPaid() {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/orders/${orderId}/mark-paid`);
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!order || !shop) {
    return (
      <div className="max-w-md mx-auto px-5 py-16">
        <ErrorBanner message={error} />
        <p className="text-ink/60">Loading…</p>
      </div>
    );
  }

  const upiLink = `upi://pay?pa=${encodeURIComponent(shop.upi_id)}&pn=${encodeURIComponent(shop.upi_payee_name || shop.name)}&am=${order.grand_total}&cu=INR&tn=${encodeURIComponent('Order #' + order.id)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiLink)}`;

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display text-3xl mb-1">Pay via UPI</h1>
      <p className="text-ink/60 mb-6">Scan the QR or pay directly to {shop.upi_payee_name || shop.name}.</p>

      <div className="card space-y-4 text-center">
        <ErrorBanner message={error} />
        <img src={qrImageUrl} alt="UPI QR code" className="mx-auto rounded-md border border-ledger" />
        <div>
          <p className="text-sm text-ink/60">UPI ID</p>
          <p className="font-medium">{shop.upi_id}</p>
        </div>
        <div>
          <p className="text-sm text-ink/60">Amount to pay</p>
          <p className="font-display text-2xl">₹{order.grand_total}</p>
        </div>
        <a href={upiLink} className="btn-outline w-full">Open in UPI app</a>
        <button className="btn-primary w-full" disabled={busy} onClick={markPaid}>
          {busy ? 'Confirming…' : "I've completed the payment"}
        </button>
        <p className="text-xs text-ink/50">The shop will verify and confirm your payment before packing your order.</p>
      </div>
    </div>
  );
}