import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { useCart } from '../../context/CartContext.jsx';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

const DELIVERY_FEE = 30; // mirrors backend default; shown for clarity before order confirms exact figure

export default function Cart() {
  const { cart, updateQuantity, clearCart, total } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function placeOrder() {
    setError('');
    if (!address.trim()) {
      setError('Please add a delivery address.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/orders', {
        shop_id: cart.shopId,
        items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_address: address,
        customer_note: note || undefined,
        payment_method: paymentMethod,
      });
      clearCart();
      if (paymentMethod === 'online') {
        navigate(`/payment/${res.data.order.id}`);
      } else {
        navigate('/orders');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-10">
        <EmptyState title="Your basket is empty" hint="Pick a shop and add a few items to get started." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mb-1">Your basket</h1>
      <p className="text-ink/60 mb-6">From {cart.shopName}</p>

      <div className="card divide-y divide-ledger">
        {cart.items.map((item) => (
          <div key={item.product_id} className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-ink/50">₹{item.price} / {item.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-outline !px-2 !py-1"
                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
              >
                −
              </button>
              <span className="w-6 text-center">{item.quantity}</span>
              <button
                className="btn-outline !px-2 !py-1"
                disabled={item.quantity >= item.maxQuantity}
                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
              >
                +
              </button>
              <span className="w-16 text-right font-medium">₹{item.price * item.quantity}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-4 space-y-1 text-sm">
        <div className="flex justify-between"><span>Items total</span><span>₹{total}</span></div>
        <div className="flex justify-between text-ink/60"><span>Delivery fee</span><span>₹{DELIVERY_FEE}</span></div>
        <div className="flex justify-between font-display text-lg pt-2 border-t border-ledger mt-2">
          <span>Total</span><span>₹{total + DELIVERY_FEE}</span>
        </div>
      </div>

      <div className="card mt-4 space-y-4">
        <ErrorBanner message={error} />
        <div>
          <label className="label">Delivery address</label>
          <textarea className="input" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no., street, landmark, area" />
        </div>
        <div>
          <label className="label">Note for the shop (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment method</label>
          <div className="grid grid-cols-1 gap-2">
            <label className={`flex items-center gap-3 border rounded px-3 py-2.5 cursor-pointer ${paymentMethod === 'cod' ? 'border-marigold bg-marigold-light/40' : 'border-ledger'}`}>
              <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <span className="text-sm font-medium">Cash on Delivery</span>
            </label>
            <label className={`flex items-center gap-3 border rounded px-3 py-2.5 cursor-pointer ${paymentMethod === 'online' ? 'border-marigold bg-marigold-light/40' : 'border-ledger'}`}>
              <input type="radio" name="paymentMethod" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
              <span className="text-sm font-medium">Online Payment (UPI)</span>
            </label>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy} onClick={placeOrder}>
          {busy ? 'Placing order…' : `Place order · ₹${total + DELIVERY_FEE}`}
        </button>
      </div>
    </div>
  );
}