import React, { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'mandi_cart';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { shopId: null, shopName: null, items: [] };
  } catch {
    return { shopId: null, shopName: null, items: [] };
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // Adding from a different shop clears the cart first — an order is single-shop only.
  function addItem(shop, product, quantity = 1) {
    setCart((prev) => {
      const isSameShop = prev.shopId === shop.id;
      const items = isSameShop ? [...prev.items] : [];
      const idx = items.findIndex((i) => i.product_id === product.id);
      const maxQty = product.quantity;

      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: Math.min(items[idx].quantity + quantity, maxQty) };
      } else {
        items.push({
          product_id: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          maxQuantity: maxQty,
          quantity: Math.min(quantity, maxQty),
        });
      }
      return { shopId: shop.id, shopName: shop.name, items };
    });
  }

  function updateQuantity(productId, quantity) {
    setCart((prev) => {
      if (quantity <= 0) {
        const items = prev.items.filter((i) => i.product_id !== productId);
        return { ...prev, items, shopId: items.length ? prev.shopId : null, shopName: items.length ? prev.shopName : null };
      }
      const items = prev.items.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.min(quantity, i.maxQuantity) } : i
      );
      return { ...prev, items };
    });
  }

  function clearCart() {
    setCart({ shopId: null, shopName: null, items: [] });
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addItem, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
