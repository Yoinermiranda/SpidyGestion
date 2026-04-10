import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config.js';
import { clearStoredSession, getStoredToken, getStoredUser } from '../utils/session';
import { getCategoryIcon } from '../utils/menuIcons';

const EMPTY_USER = { id: null, nombre: '', pin_acceso: '', rol: 'MESERO' };
const EMPTY_PRODUCT = { id: null, nombre: '', precio: '', id_categoria: '', imagen: '' };
const EMPTY_TABLE = { id: null, numero_mesa: '', capacidad: '' };

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function AdminDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const token = getStoredToken();

  const [activeTab, setActiveTab] = useState('resumen');
  const [report, setReport] = useState({
    resumenDiario: { operaciones: 0, totalFacturado: 0, ticketPromedio: 0 },
    topProducts: [],
    tickets: [],
    pagos: [],
  });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);

  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE);
  const [newCategory, setNewCategory] = useState('');
  const [shifts, setShifts] = useState([]);

  const loadUsers = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setUsers(await response.json());
    }
  }, [token]);

  const loadMenu = useCallback(async () => {
    const [categoriesResponse, productsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/menu/categories`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (categoriesResponse.ok) {
      setCategories(await categoriesResponse.json());
    }

    if (productsResponse.ok) {
      setProducts(await productsResponse.json());
    }
  }, [token]);

  const loadTables = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setTables(await response.json());
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (activeTab === 'resumen') {
          const [reportsResponse, usersResponse] = await Promise.all([
            fetch(`${API_BASE}/api/reports/sales`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);

          if (!cancelled && reportsResponse.ok) {
            setReport(await reportsResponse.json());
          }

          if (!cancelled && usersResponse.ok) {
            setUsers(await usersResponse.json());
          }

          return;
        }

        if (activeTab === 'historial') {
          const response = await fetch(`${API_BASE}/api/reports/shifts`, { headers: { Authorization: `Bearer ${token}` } });
          if (!cancelled && response.ok) {
            setShifts(await response.json());
          }
          return;
        }

        if (activeTab === 'personal') {
          const usersResponse = await fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!cancelled && usersResponse.ok) {
            setUsers(await usersResponse.json());
          }

          return;
        }

        if (activeTab === 'menu') {
          const [categoriesResponse, productsResponse] = await Promise.all([
            fetch(`${API_BASE}/api/menu/categories`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);

          if (!cancelled && categoriesResponse.ok) {
            setCategories(await categoriesResponse.json());
          }

          if (!cancelled && productsResponse.ok) {
            setProducts(await productsResponse.json());
          }

          return;
        }

        if (activeTab === 'mesas') {
          const tablesResponse = await fetch(`${API_BASE}/api/tables`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!cancelled && tablesResponse.ok) {
            setTables(await tablesResponse.json());
          }
        }
      } catch (error) {
        console.error('Admin initial effect error:', error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, token]);

  const resetUserForm = () => setUserForm(EMPTY_USER);
  const resetProductForm = () => setProductForm(EMPTY_PRODUCT);
  const resetTableForm = () => setTableForm(EMPTY_TABLE);

  const handleLogout = () => {
    clearStoredSession();
    navigate('/');
  };

  const handleUserSubmit = async (event) => {
    event.preventDefault();

    const isEditing = userForm.id !== null;
    const payload = {
      nombre: userForm.nombre.trim(),
      rol: userForm.rol,
      ...(userForm.pin_acceso ? { pin_acceso: userForm.pin_acceso } : {}),
    };

    try {
      const response = await fetch(
        isEditing ? `${API_BASE}/api/users/${userForm.id}` : `${API_BASE}/api/users`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo guardar el usuario.');
        return;
      }

      resetUserForm();
      await loadUsers();
    } catch (error) {
      console.error('User save error:', error);
      alert('Fallo de conexion');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Eliminar este colaborador?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadUsers();
      }
    } catch (error) {
      console.error('Delete user error:', error);
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(
        productForm.id ? `${API_BASE}/api/menu/products/${productForm.id}` : `${API_BASE}/api/menu/products`,
        {
          method: productForm.id ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(productForm),
        }
      );

      if (!response.ok) {
        alert('No se pudo guardar el producto.');
        return;
      }

      resetProductForm();
      await loadMenu();
    } catch (error) {
      console.error('Save product error:', error);
      alert('Fallo de conexion');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/menu/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadMenu();
      }
    } catch (error) {
      console.error('Delete product error:', error);
    }
  };

  const handleToggleProduct = async (product) => {
    try {
      const response = await fetch(`${API_BASE}/api/menu/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ disponible: !product.disponible }),
      });

      if (response.ok) {
        await loadMenu();
      }
    } catch (error) {
      console.error('Toggle product error:', error);
    }
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/api/menu/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: newCategory.trim() }),
      });

      if (response.ok) {
        setNewCategory('');
        await loadMenu();
      }
    } catch (error) {
      console.error('Save category error:', error);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('¿Eliminar esta categoria?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/menu/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadMenu();
      } else {
        alert('La categoria aun tiene productos asociados.');
      }
    } catch (error) {
      console.error('Delete category error:', error);
    }
  };

  const handleTableSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(
        tableForm.id ? `${API_BASE}/api/tables/${tableForm.id}` : `${API_BASE}/api/tables`,
        {
          method: tableForm.id ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(tableForm),
        }
      );

      if (!response.ok) {
        alert('No se pudo guardar la mesa.');
        return;
      }

      resetTableForm();
      await loadTables();
    } catch (error) {
      console.error('Save table error:', error);
    }
  };

  const handleDeleteTable = async (id) => {
    if (!window.confirm('¿Eliminar esta mesa?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/tables/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        await loadTables();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo eliminar la mesa.');
      }
    } catch (error) {
      console.error('Delete table error:', error);
    }
  };

  const groupedUsers = {
    ADMIN: users.filter((member) => member.rol === 'ADMIN'),
    CAJERO: users.filter((member) => member.rol === 'CAJERO'),
    MESERO: users.filter((member) => member.rol === 'MESERO'),
  };

  const userFormValid =
    userForm.nombre.trim().length > 0 &&
    userForm.rol &&
    (userForm.id ? userForm.pin_acceso.length === 0 || userForm.pin_acceso.length === 4 : userForm.pin_acceso.length === 4);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
    
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-500">Panel Administrador</p>
            <h1 className="text-3xl font-black">SpidyGestion</h1>
            <p className="text-sm text-slate-500">{user?.nombre || 'Administrador'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['resumen', 'Resumen'],
              ['historial', 'Historial'],
              ['menu', 'Menu'],
              ['mesas', 'Mesas'],
              ['personal', 'Personal'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  activeTab === value ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button onClick={handleLogout} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
              Cerrar sesion
            </button>
          </div>
        </header>

        {activeTab === 'resumen' && (
          <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-slate-500">Facturado hoy</p>
                <p className="mt-3 text-4xl font-black text-purple-600">{formatMoney(report.resumenDiario.totalFacturado)}</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-slate-500">Operaciones</p>
                <p className="mt-3 text-4xl font-black">{report.resumenDiario.operaciones}</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-slate-500">Ticket promedio</p>
                <p className="mt-3 text-4xl font-black">{formatMoney(report.resumenDiario.ticketPromedio)}</p>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
                <h2 className="text-xl font-black">Ultimos pagos del dia</h2>
                <div className="mt-4 space-y-3">
                  {report.pagos.length === 0 && <p className="text-sm text-slate-500">No hay pagos registrados hoy.</p>}
                  {report.pagos.slice(0, 8).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-bold">{payment.metodo_pago}</p>
                        <p className="text-xs text-slate-500">{payment.cajero?.nombre || 'Sin cajero'} · Orden #{payment.id_orden}</p>
                      </div>
                      <span className="font-black text-purple-600">{formatMoney(payment.monto_pagado)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">Top platos</h2>
                <div className="mt-4 space-y-3">
                  {report.topProducts.length === 0 && <p className="text-sm text-slate-500">Sin ventas hoy.</p>}
                  {report.topProducts.map((product) => (
                    <div key={product.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="font-bold">{product.nombre}</p>
                      <p className="text-xs text-slate-500">{product.cantidad} unidades</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="rounded-3xl bg-white p-6 shadow-sm md:col-span-3 animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-red-600">Registro de Anulaciones</h2>
                    <p className="text-sm text-slate-500">Auditoria de ordenes y platos anulados.</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                    {report.voidRecords?.length || 0} anulaciones
                  </span>
                </div>
                
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="rounded-l-2xl px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Cajero</th>
                        <th className="px-4 py-3">Nivel</th>
                        <th className="px-4 py-3">Descripcion</th>
                        <th className="rounded-r-2xl px-4 py-3">Motivo Registrado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!report.voidRecords || report.voidRecords.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                            <span className="text-3xl block mb-2">✅</span>
                            Todo en orden. No hay anulaciones recientes.
                          </td>
                        </tr>
                      ) : (
                        report.voidRecords.map((record) => (
                          <tr key={record.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-4 font-medium text-slate-600">{new Date(record.fecha).toLocaleString()}</td>
                            <td className="px-4 py-4 font-bold">{record.cajero?.nombre || 'Desconocido'}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${record.tipo === 'ORDEN' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                {record.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-800">{record.descripcion}</td>
                            <td className="px-4 py-4 text-slate-600 italic">"{record.motivo}"</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Equipo registrado</h2>
              <div className="mt-4 space-y-3">
                {users.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold">{member.nombre}</p>
                      <p className="text-xs text-slate-500">{member.rol}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{formatDate(member.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'historial' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Cierres de Caja (Turnos)</h2>
                <p className="text-sm text-slate-500">Historial agrupado por aperturas y cierres físicos de caja.</p>
              </div>
            </div>

            {shifts.length === 0 ? (
              <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
                <span className="text-4xl block mb-4">📭</span>
                <p className="text-slate-500 font-bold">No hay turnos registrados aún.</p>
              </div>
            ) : (
              shifts.map((shift) => {
                const totalIngresos = (shift.movimientos || []).filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + m.monto, 0);
                const totalEgresos = (shift.movimientos || []).filter(m => m.tipo === 'EGRESO').reduce((sum, m) => sum + m.monto, 0);
                const ventasEfectivo = shift.total_efectivo || 0;
                const baseFija = shift.fondo_inicial || 0;

                return (
                  <div key={shift.id} className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4">
                       <div>
                         <div className="flex items-center gap-3">
                           <span className="rounded-lg bg-blue-100 px-3 py-1 font-black text-blue-700">Turno #{shift.id}</span>
                           <span className="font-bold text-slate-700">{shift.usuario?.nombre || 'Administrador'}</span>
                           {shift.fecha_cierre ? (
                             <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                <span className="h-2 w-2 rounded-full bg-slate-300"></span> Cerrado
                             </span>
                           ) : (
                             <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> En curso
                             </span>
                           )}
                         </div>
                         <p className="mt-2 text-sm text-slate-500 font-medium">
                           Abierto: {new Date(shift.fecha_apertura).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} 
                           {shift.fecha_cierre && ` • Cerrado: ${new Date(shift.fecha_cierre).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`}
                         </p>
                       </div>
                       <div className="text-right mt-4 sm:mt-0">
                         <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Ventas Brutas</p>
                         <p className="text-3xl font-black text-slate-800">
                           {formatMoney(ventasEfectivo + (shift.total_tarjeta||0) + (shift.total_transferencia||0))}
                         </p>
                       </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Base / Fondo</p>
                        <p className="font-black text-slate-700 text-lg">{formatMoney(baseFija)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Efectivo Físico (Entradas - Salidas)</p>
                        <p className="font-black text-emerald-700 text-lg">
                           {formatMoney(baseFija + ventasEfectivo + totalIngresos - totalEgresos)}
                           <span className="text-xs text-slate-400 font-bold ml-1">Teórico</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Declarado vs Contado</p>
                        {shift.fecha_cierre ? (
                           <p className="font-black text-blue-700 text-lg">{formatMoney(shift.efectivo_contado || 0)}</p>
                        ) : (
                           <p className="font-bold text-slate-400 text-sm italic">Esperando cierre...</p>
                        )}
                      </div>
                      <div className="md:border-l md:pl-4 border-slate-200">
                        <p className="text-[10px] font-black uppercase text-slate-400">Descuadre</p>
                        {shift.fecha_cierre ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-black text-sm border ${
                               shift.descuadre === 0 ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                               shift.descuadre > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {shift.descuadre > 0 ? '+' : ''}{formatMoney(shift.descuadre || 0)}
                            </span>
                            {shift.descuadre < 0 && <span className="text-[10px] font-black text-red-500 uppercase">Faltante</span>}
                            {shift.descuadre > 0 && <span className="text-[10px] font-black text-emerald-500 uppercase">Sobrante</span>}
                          </div>
                        ) : (
                           <p className="font-bold text-slate-400 text-sm">-</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3 mt-2">
                       <div>
                         <h4 className="font-black text-slate-700 mb-3 flex items-center justify-between">
                           Ventas por Caja
                           <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{shift.pagos?.length || 0}</span>
                         </h4>
                         <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                           {(!shift.pagos || shift.pagos.length === 0) && <p className="text-xs text-slate-400 font-bold">Sin ventas registradas.</p>}
                           {shift.pagos?.map(pago => (
                             <div key={pago.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 flex justify-between items-center group">
                               <div>
                                 <p className="font-bold text-xs text-slate-800">Orden #{pago.id_orden}</p>
                                 <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">{pago.metodo_pago}</span>
                               </div>
                               <div className="text-right">
                                 <p className="font-black text-sm text-blue-600">{formatMoney(pago.monto_pagado)}</p>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div>
                         <h4 className="font-black text-slate-700 mb-3 flex items-center justify-between">
                           Ingresos / Egresos
                           <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{shift.movimientos?.length || 0}</span>
                         </h4>
                         <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                           {(!shift.movimientos || shift.movimientos.length === 0) && <p className="text-xs text-slate-400 font-bold">Sin movimientos de caja extra.</p>}
                           {shift.movimientos?.map(m => (
                             <div key={m.id} className={`rounded-xl border p-2.5 flex justify-between items-center ${m.tipo === 'INGRESO' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                               <div className="overflow-hidden">
                                 <p className="font-bold text-xs text-slate-800 truncate" title={m.motivo}>{m.motivo}</p>
                                 <span className={`text-[9px] font-black uppercase tracking-wider ${m.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-600'}`}>{m.tipo}</span>
                               </div>
                               <div className="text-right ml-2 shrink-0">
                                 <p className={`font-black text-sm ${m.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-600'}`}>
                                   {m.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(m.monto)}
                                 </p>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div>
                         <h4 className="font-black text-red-600 mb-3 flex items-center justify-between">
                           Anulaciones
                           <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">{shift.voids?.length || 0}</span>
                         </h4>
                         <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                           {(!shift.voids || shift.voids.length === 0) && <p className="text-xs text-emerald-600/70 font-bold italic">Sin mermas ni anulaciones.</p>}
                           {shift.voids?.map(voidRec => (
                             <div key={voidRec.id} className="rounded-xl border border-red-100 bg-red-50 p-2.5">
                               <div className="flex justify-between items-start mb-1">
                                 <p className="font-bold text-[11px] text-slate-800 line-clamp-1" title={voidRec.descripcion}>{voidRec.descripcion}</p>
                               </div>
                               <p className="text-[10px] italic text-red-600 leading-tight">"{voidRec.motivo}"</p>
                             </div>
                           ))}
                         </div>
                       </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {activeTab === 'menu' && (
          <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <div className="space-y-6">
              <form onSubmit={handleProductSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">{productForm.id ? 'Editar producto' : 'Nuevo producto'}</h2>
                <div className="mt-4 space-y-3">
                  <input
                    required
                    value={productForm.nombre}
                    onChange={(event) => setProductForm({ ...productForm, nombre: event.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={productForm.precio}
                    onChange={(event) => setProductForm({ ...productForm, precio: event.target.value })}
                    placeholder="Precio"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                  <select
                    required
                    value={productForm.id_categoria}
                    onChange={(event) => setProductForm({ ...productForm, id_categoria: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <option value="">Selecciona categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={productForm.imagen}
                    onChange={(event) => setProductForm({ ...productForm, imagen: event.target.value })}
                    placeholder="URL de imagen"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </div>
                <div className="mt-4 flex gap-3">
                  {productForm.id && (
                    <button type="button" onClick={resetProductForm} className="rounded-2xl bg-slate-200 px-4 py-3 font-bold">
                      Cancelar
                    </button>
                  )}
                  <button type="submit" className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white">
                    Guardar
                  </button>
                </div>
              </form>

              <form onSubmit={handleCategorySubmit} className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">Categorias</h2>
                <div className="mt-4 flex gap-3">
                  <input
                    required
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="Nueva categoria"
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3"
                  />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white">
                    Crear
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-4 pr-2 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-red-200 hover:bg-red-50"
                    >
                      <span className="text-lg">{getCategoryIcon(category.nombre)}</span>
                      {category.nombre}
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-red-200 group-hover:text-red-600"
                        title="Eliminar categoria"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </form>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Catalogo</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <div key={product.id} className="flex flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-3 transition-all hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-600/10 group">
                    <div className="relative mb-3 h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {product.imagen ? (
                        <img src={product.imagen} alt={product.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl opacity-50">🍲</div>
                      )}
                      <div className="absolute right-2 top-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur-md ${product.disponible ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                          {product.disponible ? 'Disponible' : 'Agotado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-2 pb-2">
                      <div>
                        <p className="font-black text-slate-800 leading-tight group-hover:text-purple-600">{product.nombre}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{product.categoria?.nombre}</p>
                      </div>
                      <p className="mt-3 text-xl font-black text-purple-600">{formatMoney(product.precio)}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setProductForm({
                            id: product.id,
                            nombre: product.nombre,
                            precio: product.precio,
                            id_categoria: String(product.id_categoria),
                            imagen: product.imagen || '',
                          })
                        }
                        className="rounded-xl bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button type="button" onClick={() => handleToggleProduct(product)} className="rounded-xl bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                        {product.disponible ? 'Agotar' : 'Activar'}
                      </button>
                      <button type="button" onClick={() => handleDeleteProduct(product.id)} className="col-span-2 rounded-xl bg-red-50 px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'mesas' && (
          <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <form onSubmit={handleTableSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">{tableForm.id ? 'Editar mesa' : 'Nueva mesa'}</h2>
              <div className="mt-4 space-y-3">
                <input
                  required
                  type="number"
                  min="1"
                  value={tableForm.numero_mesa}
                  onChange={(event) => setTableForm({ ...tableForm, numero_mesa: event.target.value })}
                  placeholder="Numero"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
                <input
                  required
                  type="number"
                  min="1"
                  value={tableForm.capacidad}
                  onChange={(event) => setTableForm({ ...tableForm, capacidad: event.target.value })}
                  placeholder="Capacidad"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>
              <div className="mt-4 flex gap-3">
                {tableForm.id && (
                  <button type="button" onClick={resetTableForm} className="rounded-2xl bg-slate-200 px-4 py-3 font-bold">
                    Cancelar
                  </button>
                )}
                <button type="submit" className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white">
                  Guardar
                </button>
              </div>
            </form>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Mapa de mesas</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {tables.map((table) => (
                  <div key={table.id} className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 transition-all hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-600/10">
                    <p className="text-5xl font-black text-purple-600">{table.numero_mesa}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado: {table.estado}</p>
                    <div className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      {table.capacidad} pax
                    </div>
                    <div className="mt-5 grid w-full grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setTableForm({ id: table.id, numero_mesa: table.numero_mesa, capacidad: table.capacidad })}
                        className="rounded-xl bg-slate-100 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDeleteTable(table.id)} className="rounded-xl bg-red-50 px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'personal' && (
          <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <form onSubmit={handleUserSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">{userForm.id ? 'Editar colaborador' : 'Nuevo colaborador'}</h2>
              <div className="mt-4 space-y-3">
                <input
                  required
                  value={userForm.nombre}
                  onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })}
                  placeholder="Nombre completo"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
                <input
                  type="password"
                  maxLength="4"
                  value={userForm.pin_acceso}
                  onChange={(event) => setUserForm({ ...userForm, pin_acceso: event.target.value.replace(/\D/g, '') })}
                  placeholder={userForm.id ? 'Nuevo PIN (opcional)' : 'PIN de 4 digitos'}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
                <select
                  value={userForm.rol}
                  onChange={(event) => setUserForm({ ...userForm, rol: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <option value="MESERO">Mesero</option>
                  <option value="CAJERO">Cajero</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="mt-4 flex gap-3">
                {userForm.id && (
                  <button type="button" onClick={resetUserForm} className="rounded-2xl bg-slate-200 px-4 py-3 font-bold">
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!userFormValid}
                  className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </form>

            <div className="space-y-6">
              {[
                ['ADMIN', 'Administradores'],
                ['CAJERO', 'Cajeros'],
                ['MESERO', 'Meseros'],
              ].map(([role, label]) => (
                <div key={role} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black">{label}</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {groupedUsers[role].length}
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="pb-3">Nombre</th>
                          <th className="pb-3">Creado</th>
                          <th className="pb-3">Actualizado</th>
                          <th className="pb-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedUsers[role].map((member) => (
                          <tr key={member.id} className="border-b last:border-b-0">
                            <td className="py-3 font-bold">{member.nombre}</td>
                            <td className="py-3">{formatDate(member.createdAt)}</td>
                            <td className="py-3">{formatDate(member.updatedAt)}</td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setUserForm({ id: member.id, nombre: member.nombre, pin_acceso: '', rol: member.rol })}
                                  className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(member.id)}
                                  className="rounded-2xl bg-red-100 px-3 py-2 text-sm font-bold text-red-700"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
