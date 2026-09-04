import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_HOME = {
  customer: '/shops',
  shop_owner: '/shop/dashboard',
  delivery_boy: '/delivery/dashboard',
  admin: '/admin/dashboard',
};

const ROLE_LABEL = {
  customer: 'Customer',
  shop_owner: 'Shop owner',
  delivery_boy: 'Delivery partner',
  admin: 'Admin',
};

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="border-b border-ledger bg-ink text-paper">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link to={user ? ROLE_HOME[user.role] : '/'} className="font-display text-xl tracking-tight">
          Mandi Market
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {user?.role === 'customer' && (
            <>
              <Link to="/shops" className="hover:text-marigold">Shops</Link>
              <Link to="/orders" className="hover:text-marigold">My orders</Link>
              <Link to="/cart" className="hover:text-marigold">Cart</Link>
            </>
          )}
          {user?.role === 'shop_owner' && (
            <>
              <Link to="/shop/dashboard" className="hover:text-marigold">Orders</Link>
              <Link to="/shop/inventory" className="hover:text-marigold">Inventory</Link>
            </>
          )}
          {user?.role === 'delivery_boy' && (
            <>
              <Link to="/delivery/dashboard" className="hover:text-marigold">Deliveries</Link>
              <Link to="/delivery/earnings" className="hover:text-marigold">Earnings</Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link to="/admin/dashboard" className="hover:text-marigold">Overview</Link>
              <Link to="/admin/shops" className="hover:text-marigold">Shops</Link>
              <Link to="/admin/users" className="hover:text-marigold">Users</Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-3 pl-3 ml-2 border-l border-paper/20">
              <span className="text-paper/60 hidden sm:inline">
                {user.name} · {ROLE_LABEL[user.role]}
              </span>
              <button onClick={handleLogout} className="text-marigold hover:underline">
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="hover:text-marigold">Log in</Link>
              <Link to="/register" className="btn-accent !py-1.5">Sign up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
