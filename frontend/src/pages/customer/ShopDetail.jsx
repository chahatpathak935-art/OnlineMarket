import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, ErrorBanner } from '../../components/Feedback.jsx';

export default function ShopDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, addItem } = useCart();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api
      .get(`/shops/${id}`)
      .then((res) => {
        setShop(res.data.shop);
        setProducts(res.data.products);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  function handleAdd(product) {
    if (!user) {
      navigate('/login');
      return;
    }
    if (cart.shopId && cart.shopId !== shop.id) {
      setNotice(`Starting a new basket clears items from ${cart.shopName} — an order can only come from one shop.`);
    }
    addItem(shop, product, 1);
    setNotice(`Added ${product.name} to your basket.`);
    setTimeout(() => setNotice(''), 2500);
  }

  if (error) return <div className="max-w-6xl mx-auto px-5 py-10"><ErrorBanner message={error} /></div>;
  if (!shop) return <div className="max-w-6xl mx-auto px-5 py-10 text-ink/50">Loading shop…</div>;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <h1 className="font-display text-3xl">{shop.name}</h1>
      {shop.category && <p className="text-brick text-sm mt-1">{shop.category}</p>}
      {shop.description && <p className="text-ink/60 mt-2 max-w-2xl">{shop.description}</p>}
      {shop.address && <p className="text-ink/50 text-sm mt-1">{shop.address}</p>}

      {notice && (
        <div className="mt-4 border border-leaf/40 bg-leaf-light text-leaf-dark text-sm rounded px-4 py-2.5">
          {notice}
        </div>
      )}

      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState title="No items listed yet" hint="This shop hasn't added stock. Check back soon." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div key={p.id} className="card flex flex-col">
                <p className="font-medium">{p.name}</p>
                {p.description && <p className="text-sm text-ink/60 mt-1 flex-1">{p.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-lg">
                    ₹{p.price} <span className="text-xs text-ink/50">/ {p.unit}</span>
                  </span>
                  {p.quantity > 0 ? (
                    <button className="btn-accent !py-1.5 !px-3" onClick={() => handleAdd(p)}>
                      Add
                    </button>
                  ) : (
                    <span className="text-xs text-brick">Out of stock</span>
                  )}
                </div>
                {p.quantity > 0 && p.quantity <= 5 && (
                  <p className="text-xs text-brick mt-1">Only {p.quantity} {p.unit} left</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
