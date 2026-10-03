import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';

import ShopList from './pages/customer/ShopList.jsx';
import ShopDetail from './pages/customer/ShopDetail.jsx';
import Cart from './pages/customer/Cart.jsx';
import Orders from './pages/customer/Orders.jsx';
import Payment from './pages/customer/Payment.jsx';

import ShopDashboard from './pages/shopowner/ShopDashboard.jsx';
import Inventory from './pages/shopowner/Inventory.jsx';

import DeliveryDashboard from './pages/delivery/DeliveryDashboard.jsx';
import Earnings from './pages/delivery/Earnings.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminShops from './pages/admin/AdminShops.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/shops" element={<ShopList />} />
          <Route path="/shops/:id" element={<ShopDetail />} />
          <Route path="/cart" element={<ProtectedRoute roles={['customer']}><Cart /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute roles={['customer']}><Orders /></ProtectedRoute>} />
          <Route path="/payment/:orderId" element={<ProtectedRoute roles={['customer']}><Payment /></ProtectedRoute>} />

          <Route path="/shop/dashboard" element={<ProtectedRoute roles={['shop_owner']}><ShopDashboard /></ProtectedRoute>} />
          <Route path="/shop/inventory" element={<ProtectedRoute roles={['shop_owner']}><Inventory /></ProtectedRoute>} />

          <Route path="/delivery/dashboard" element={<ProtectedRoute roles={['delivery_boy']}><DeliveryDashboard /></ProtectedRoute>} />
          <Route path="/delivery/earnings" element={<ProtectedRoute roles={['delivery_boy']}><Earnings /></ProtectedRoute>} />

          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/shops" element={<ProtectedRoute roles={['admin']}><AdminShops /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />

          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
