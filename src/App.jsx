
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import PaymentCallback from './pages/PaymentCallback';
import AdminLogin from './pages/AdminLogin';
import AdminPayouts from './pages/AdminPayouts';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* User Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Payment Callback */}
        <Route
          path="/payment/callback"
          element={<PaymentCallback />}
        />

        {/* NEXTVEST Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/payouts" element={<AdminPayouts />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
