import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CajeroDashboard from './pages/CajeroDashboard';
import MeseroDashboard from './pages/MeseroDashboard';
<<<<<<< HEAD
import CocinaDashboard from './pages/Cocinadashboard';
=======
>>>>>>> e03a8546f00feda10554b319be01b19b320e7285
import { getStoredUser } from './utils/session';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = getStoredUser();
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.rol)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cajero"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'CAJERO']}>
              <CajeroDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mesero"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'CAJERO', 'MESERO']}>
              <MeseroDashboard />
            </ProtectedRoute>
          }
        />
<<<<<<< HEAD
         <Route
          path="/cocina"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'CAJERO', 'MESERO' , 'COCINA']}>
              <CocinaDashboard />
            </ProtectedRoute>
          }
        />
=======
>>>>>>> e03a8546f00feda10554b319be01b19b320e7285
      </Routes>
    </BrowserRouter>
  );
}

export default App;
