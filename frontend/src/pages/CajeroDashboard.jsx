import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config.js';
import { getCategoryIcon } from '../utils/menuIcons';
import { clearStoredSession, getStoredToken, getStoredUser } from '../utils/session';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function parseCustomer(rawCustomer) {
  try {
    return JSON.parse(rawCustomer || '{}');
  } catch {
    return {};
  }
}

function groupOrderItemsBySeat(order) {
  if (!order) return [];

  const groups = order.items.reduce((acc, item) => {
    const note = item.notas_preparacion || '';
    const match = note.match(/^\[(.*?)\]/);
    const seat = match ? match[1] : 'Cuenta general';
    const cleanNote = match ? note.replace(match[0], '').trim() : note.trim();

    if (!acc[seat]) {
      acc[seat] = { seat, subtotal: 0, items: [] };
    }

    acc[seat].subtotal += item.precio_unitario * item.cantidad;
    acc[seat].items.push({ ...item, cleanNote });
    return acc;
  }, {});

  return Object.values(groups);
}

function CajeroDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const token = getStoredToken();

  const [view, setView] = useState('mesas');
  const [tables, setTables] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [report, setReport] = useState({ resumenDiario: { totalFacturado: 0 } });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previousTableState, setPreviousTableState] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [deliveryNombre, setDeliveryNombre] = useState('');
  const [deliveryTelefono, setDeliveryTelefono] = useState('');
  const [deliveryDireccion, setDeliveryDireccion] = useState('');

  // Shift Management State
  const [isShiftOpen, setIsShiftOpen] = useState(true);
  const [fondoInput, setFondoInput] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementForm, setMovementForm] = useState({ tipo: 'EGRESO', monto: '', motivo: '' });

  const checkActiveShift = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reports/check-open-shift`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIsShiftOpen(data.hasOpenShift);
      }
    } catch(e) {
      console.error('Error checking shift:', e);
    }
  }, [token]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!fondoInput || isNaN(fondoInput)) return alert('Ingrese un monto válido');
    
    try {
      const resp = await fetch(`${API_BASE}/api/reports/open-shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fondo_inicial: parseFloat(fondoInput) })
      });
      if (resp.ok) {
        setIsShiftOpen(true);
        loadReport();
      } else {
        const data = await resp.json();
        alert(data.error);
      }
    } catch(e) {
      alert('Error de conexión.');
    }
  };

  const handleCashMovement = async (e) => {
    e.preventDefault();
    if (!movementForm.monto || !movementForm.motivo) return alert('Completa todos los campos');
    
    try {
      const resp = await fetch(`${API_BASE}/api/reports/cash-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(movementForm)
      });
      if (resp.ok) {
        setShowMovementModal(false);
        setMovementForm({ tipo: 'EGRESO', monto: '', motivo: '' });
        loadReport(); // Refresh data
      } else {
        alert('No se pudo registrar.');
      }
    } catch(e) {
      alert('Error de red');
    }
  };

  const loadTables = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setTables(await response.json());
    }
  }, [token]);

  const loadDeliveries = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/orders/delivery`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setDeliveries(await response.json());
    }
  }, [token]);

  const loadReport = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/reports/current-shift`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setReport(await response.json());
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/menu/categories`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/menu/products`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!cancelled && categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData);
          if (categoriesData.length > 0) {
            setActiveCategory((current) => current ?? categoriesData[0].id);
          }
        }

        if (!cancelled && productsResponse.ok) {
          setProducts(await productsResponse.json());
        }
      } catch (error) {
        console.error('Cashier menu effect error:', error);
      }
    };

    checkActiveShift();
    run();

    return () => {
      cancelled = true;
    };
  }, [token, checkActiveShift]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (view === 'mesas') {
          const response = await fetch(`${API_BASE}/api/tables`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && response.ok) {
            setTables(await response.json());
          }
          return;
        }

        if (view === 'delivery') {
          const response = await fetch(`${API_BASE}/api/orders/delivery`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && response.ok) {
            setDeliveries(await response.json());
          }
          return;
        }

        if (view === 'cierre') {
          const response = await fetch(`${API_BASE}/api/reports/current-shift`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && response.ok) {
            setReport(await response.json());
          }
        }
      } catch (error) {
        console.error('Cashier refresh effect error:', error);
      }
    };

    run();
    const interval = window.setInterval(run, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, view]);

  const handleLogout = () => {
    clearStoredSession();
    navigate('/');
  };

  const addToCart = (product) => {
    setCart((current) => [
      ...current,
      {
        uid: crypto.randomUUID(),
        id_producto: product.id,
        nombre: product.nombre,
        precio: product.precio,
        cantidad: 1,
        notas: '',
      },
    ]);
  };

  const updateCartItem = (uid, updater) => {
    setCart((current) =>
      current.map((item) => (item.uid === uid ? { ...item, ...updater(item) } : item))
    );
  };

  const removeCartItem = (uid) => {
    setCart((current) => current.filter((item) => item.uid !== uid));
  };

  const sendDeliveryOrder = async () => {
    if (!deliveryNombre.trim() || !deliveryTelefono.trim() || cart.length === 0) {
      alert('Completa los datos obligatorios del domicilio.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo_pedido: 'DOMICILIO',
          datos_cliente: {
            nombre: deliveryNombre.trim(),
            telefono: deliveryTelefono.trim(),
            direccion: deliveryDireccion.trim(),
          },
          items: cart.map((item) => ({
            id_producto: item.id_producto,
            cantidad: item.cantidad,
            notas_preparacion: item.notas,
          })),
        }),
      });

      if (!response.ok) {
        alert('No se pudo registrar el domicilio.');
        return;
      }

      setCart([]);
      setDeliveryNombre('');
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setView('delivery');
      await loadDeliveries();
    } catch (error) {
      console.error('Create delivery order error:', error);
      alert('Fallo de conexion');
    }
  };

  const openTableAccount = async (table) => {
    if (table.estado === 'LIBRE') return;

    try {
      setPreviousTableState(table.estado);

      await fetch(`${API_BASE}/api/tables/${table.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: 'COBRANDO' }),
      });

      const response = await fetch(`${API_BASE}/api/orders/mesa/${table.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        alert('No se encontro una orden abierta para esa mesa.');
        await loadTables();
        return;
      }

      setSelectedOrder(await response.json());
      setPaymentMethod('EFECTIVO');
      setReferencia('');
      await loadTables();
    } catch (error) {
      console.error('Open table account error:', error);
    }
  };

  const closePaymentModal = async () => {
    if (selectedOrder?.id_mesa && selectedOrder.tipo_pedido === 'LOCAL' && previousTableState) {
      await fetch(`${API_BASE}/api/tables/${selectedOrder.id_mesa}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: previousTableState }),
      }).catch((error) => console.error('Restore table state error:', error));

      await loadTables();
    }

    setSelectedOrder(null);
    setReferencia('');
    setPreviousTableState(null);
  };

  const processPayment = async () => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          metodo_pago: paymentMethod,
          monto_pagado: selectedOrder.total,
          referencia: paymentMethod === 'TRANSFERENCIA' ? referencia.trim() : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo registrar el pago.');
        return;
      }

      setSelectedOrder(null);
      setReferencia('');
      await Promise.all([loadTables(), loadDeliveries(), loadReport()]);
    } catch (error) {
      console.error('Process payment error:', error);
    }
  };

  const voidItem = async (itemId) => {
    const motivo = window.prompt('¿Cuál es el motivo para anular este plato? (Ej. Error de cocina, Cliente arrepentido, etc.)');
    if (!motivo || motivo.trim() === '') return;

    try {
      const response = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/void-item/${itemId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'No se pudo anular el plato.');
        return;
      }
      
      const orderResp = await fetch(`${API_BASE}/api/orders/mesa/${selectedOrder.id_mesa}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (orderResp.ok) {
        setSelectedOrder(await orderResp.json());
      } else {
        closePaymentModal();
      }
    } catch (error) {
      console.error('Void item error:', error);
      alert('Error de conexión.');
    }
  };

  const voidOrder = async () => {
    const motivo = window.prompt('¿Cuál es el motivo para anular TODA la cuenta? (Ej. Cliente se fue sin pagar, Error de sistema)');
    if (!motivo || motivo.trim() === '') return;

    if (!window.confirm('¿Estás seguro de que deseas anular y cerrar esta orden por completo?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo anular la orden.');
        return;
      }

      setSelectedOrder(null);
      setReferencia('');
      setPreviousTableState(null);
      await loadTables();
    } catch (error) {
      console.error('Void order error:', error);
      alert('Error de conexión.');
    }
  };

  const executeClose = () => {
    setShowCloseModal(true);
  };

  const confirmCloseShift = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/reports/cierre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ efectivo_contado: countedCashInput || null })
      });

      if (response.ok) {
        handleLogout();
      } else {
        const err = await response.json();
        alert(err.error || 'Error al cerrar caja');
      }
    } catch (error) {
      console.error('Close register error:', error);
      alert('Error de conexión');
    }
  };

  const filteredProducts = products
    .filter((product) => product.disponible !== false)
    .filter((product) => activeCategory === null || product.id_categoria === activeCategory)
    .filter((product) => !searchQuery || product.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  const cartTotal = cart.reduce((total, item) => total + item.precio * item.cantidad, 0);
  const groupedItems = groupOrderItemsBySeat(selectedOrder);
  const selectedOrderCustomer = parseCustomer(selectedOrder?.datos_cliente);

  const pagos = report.pagos || [];
  const voids = report.voidRecords || [];
  const totalEfectivo = pagos.filter(p => p.metodo_pago === 'EFECTIVO').reduce((acc, p) => acc + p.monto_pagado, 0);
  const totalTarjeta = pagos.filter(p => p.metodo_pago === 'TARJETA').reduce((acc, p) => acc + p.monto_pagado, 0);
  const totalTransferencia = pagos.filter(p => p.metodo_pago === 'TRANSFERENCIA').reduce((acc, p) => acc + p.monto_pagado, 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-500">Modulo Caja</p>
            <h1 className="text-3xl font-black">SpidyGestion</h1>
            <p className="text-sm text-slate-500">{user?.nombre || 'Caja'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['mesas', 'Mesas'],
              ['delivery', 'Delivery'],
              ['nuevo_domicilio', 'Nuevo domicilio'],
              ['cierre', 'Cierre'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  view === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

        {view === 'mesas' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => openTableAccount(table)}
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-8 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 ${
                    table.estado === 'LIBRE'
                      ? 'border-slate-200 bg-white hover:border-blue-300'
                      : table.estado === 'POR_PAGAR'
                        ? 'animate-pulse border-transparent bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-xl shadow-purple-500/30'
                        : table.estado === 'COBRANDO'
                          ? 'border-transparent bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/30'
                          : 'border-transparent bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-xl shadow-orange-500/30'
                  }`}
                >
                  <p className={`text-6xl font-black ${table.estado === 'LIBRE' ? 'text-slate-700' : 'text-white'}`}>{table.numero_mesa}</p>
                  <p className={`mt-2 text-xs font-bold uppercase tracking-widest ${table.estado === 'LIBRE' ? 'text-slate-400' : 'text-white/80'}`}>{table.estado}</p>
                  <div className="absolute right-4 top-4 rounded-full bg-black/10 px-2 py-1 text-[10px] font-bold backdrop-blur-md">
                    {table.capacidad} pax
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === 'delivery' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-black">Pedidos a domicilio</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{deliveries.length} activos</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {deliveries.length === 0 && <p className="text-sm text-slate-500">No hay domicilios pendientes.</p>}
              {deliveries.map((order) => {
                const customer = parseCustomer(order.datos_cliente);
                return (
                  <div key={order.id} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-black">{customer.nombre || 'Sin nombre'}</p>
                        <p className="text-sm text-slate-500">{customer.telefono || 'Sin telefono'}</p>
                        <p className="text-sm text-slate-500">{customer.direccion || 'Sin direccion'}</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">#{order.id}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.cantidad} x {item.producto?.nombre}</span>
                          <span>{formatMoney(item.precio_unitario * item.cantidad)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xl font-black">{formatMoney(order.total)}</span>
                      <button type="button" onClick={() => setSelectedOrder(order)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                        Cobrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {view === 'nuevo_domicilio' && (
          <section className="grid gap-6 lg:grid-cols-[1fr,360px]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex w-full flex-wrap gap-2 overflow-x-auto pb-2 sm:w-auto sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className={`flex whitespace-nowrap items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                      activeCategory === null
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 -translate-y-0.5'
                        : 'bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    Todos
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex whitespace-nowrap items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                        activeCategory === category.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 -translate-y-0.5'
                          : 'bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg">{getCategoryIcon(category.nombre)}</span>
                      {category.nombre}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                  <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex flex-col rounded-[2rem] border border-slate-100 bg-white p-3 text-left transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-600/10 group"
                  >
                    <div className="relative mb-3 h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {product.imagen ? (
                        <img src={product.imagen} alt={product.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl opacity-50">🍲</div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-2 pb-2">
                       <p className="font-black text-slate-800 leading-tight group-hover:text-blue-600">{product.nombre}</p>
                       <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{product.categoria?.nombre}</p>
                       <p className="mt-3 text-xl font-black text-blue-600">{formatMoney(product.precio)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Nuevo domicilio</h2>
              <div className="mt-4 space-y-3">
                <input value={deliveryNombre} onChange={(event) => setDeliveryNombre(event.target.value)} placeholder="Nombre del cliente" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                <input value={deliveryTelefono} onChange={(event) => setDeliveryTelefono(event.target.value)} placeholder="Telefono" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                <input value={deliveryDireccion} onChange={(event) => setDeliveryDireccion(event.target.value)} placeholder="Direccion" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
              </div>

              <div className="mt-6 space-y-3">
                {cart.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <span className="text-4xl">🛒</span>
                    <p className="mt-4 text-sm font-bold text-slate-500">Agrega productos al carrito.</p>
                  </div>
                )}
                {cart.map((item) => (
                  <div key={item.uid} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{item.nombre}</p>
                        <p className="text-sm font-bold text-blue-600">{formatMoney(item.precio)} <span className="text-xs font-normal text-slate-400">c/u</span></p>
                      </div>
                      <button type="button" onClick={() => removeCartItem(item.uid)} className="rounded-full bg-red-50 p-2 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-xl bg-slate-200/50 p-1">
                        <button type="button" onClick={() => updateCartItem(item.uid, (current) => ({ cantidad: Math.max(1, current.cantidad - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-600 shadow-sm transition-colors hover:text-blue-600">
                          -
                        </button>
                        <span className="w-10 text-center font-black">{item.cantidad}</span>
                        <button type="button" onClick={() => updateCartItem(item.uid, (current) => ({ cantidad: current.cantidad + 1 }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-600 shadow-sm transition-colors hover:text-blue-600">
                          +
                        </button>
                      </div>
                      
                      <input
                        value={item.notas}
                        onChange={(event) => updateCartItem(item.uid, () => ({ notas: event.target.value }))}
                        placeholder="Nota (opcional)"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">Total</span>
                  <span className="text-2xl font-black">{formatMoney(cartTotal)}</span>
                </div>
                <button type="button" onClick={sendDeliveryOrder} className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white">
                  Registrar domicilio
                </button>
              </div>
            </aside>
          </section>
        )}

        {view === 'cierre' && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr] animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-6">
              
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-500">Arqueo Diario</p>
                <h2 className="mt-2 text-5xl font-black text-slate-800">{formatMoney(report.resumenDiario.totalFacturado)}</h2>
                <p className="mt-2 text-sm font-bold text-slate-500">{pagos.length} operaciones registradas</p>
                
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-600">Efectivo</p>
                    <p className="mt-2 text-xl font-black text-emerald-700">{formatMoney(totalEfectivo)}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                    <p className="text-xs font-bold uppercase text-blue-600">Tarjeta</p>
                    <p className="mt-2 text-xl font-black text-blue-700">{formatMoney(totalTarjeta)}</p>
                  </div>
                  <div className="rounded-2xl bg-purple-50 p-4 border border-purple-100">
                    <p className="text-xs font-bold uppercase text-purple-600">Transferencia</p>
                    <p className="mt-2 text-xl font-black text-purple-700">{formatMoney(totalTransferencia)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 rounded-3xl bg-white p-6 shadow-sm overflow-hidden flex flex-col">
                <h3 className="text-xl font-black text-slate-800 mb-4">Ultimos pagos ({pagos.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {pagos.length === 0 && <p className="text-sm text-slate-500">No hay cobros registrados.</p>}
                  {pagos.slice(0, 15).map((pago) => (
                    <div key={pago.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-bold text-slate-800">Orden #{pago.id_orden}</p>
                        <p className="text-xs font-bold text-slate-500">{new Date(pago.fecha_pago).toLocaleTimeString()} - {pago.metodo_pago}</p>
                      </div>
                      <span className="font-black text-blue-600">{formatMoney(pago.monto_pagado)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 rounded-3xl bg-white p-6 shadow-sm overflow-hidden flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800">Movimientos de Caja</h3>
                  <button onClick={() => setShowMovementModal(true)} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95">
                     + Registrar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {(!report.cashMovements || report.cashMovements.length === 0) && (
                     <p className="text-sm text-slate-400 italic">No hay ingresos ni egresos adicionales.</p>
                  )}
                  {report.cashMovements?.map(m => (
                    <div key={m.id} className={`rounded-xl border p-3 flex justify-between items-center ${m.tipo === 'INGRESO' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                       <div>
                         <p className="font-bold text-sm text-slate-800">{m.motivo}</p>
                         <span className={`text-[10px] font-black uppercase tracking-wider ${m.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-600'}`}>{m.tipo}</span>
                       </div>
                       <span className={`font-black ${m.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-600'}`}>
                         {m.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(m.monto)}
                       </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex flex-col gap-6">
              <div className="flex-1 rounded-3xl bg-white p-6 shadow-sm overflow-hidden flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-black text-red-600">Registro de Anulaciones</h3>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{voids.length} hoy</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {voids.length === 0 && (
                    <div className="py-8 text-center text-slate-400">
                       <span className="text-3xl block mb-2">✅</span>
                       <p className="text-sm font-bold">Excelente, no hay anulaciones en tu turno.</p>
                    </div>
                  )}
                  {voids.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{record.descripcion}</p>
                          <p className="text-xs font-bold text-slate-500">{new Date(record.fecha).toLocaleTimeString()} - {record.tipo}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm italic text-red-600">"{record.motivo}"</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm border-t-4 border-slate-900">
                <h3 className="text-xl font-black mb-2">Término de Turno</h3>
                <p className="text-sm text-slate-500 mb-6">Inicia el Arqueo Ciego. Tendrás que declarar cuánto efectivo exacto cuentas en gaveta para validar el cuadre.</p>
                <button type="button" onClick={executeClose} className="w-full rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white transition-transform active:scale-95 shadow-xl shadow-slate-900/20">
                  Emitir Cierre Z y Salir
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="grid max-h-[90vh] w-full max-w-5xl gap-0 overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.4fr,420px]">
            <div className="overflow-y-auto p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black">
                    {selectedOrder.tipo_pedido === 'DOMICILIO'
                      ? selectedOrderCustomer.nombre || `Domicilio #${selectedOrder.id}`
                      : `Mesa ${selectedOrder.id_mesa}`}
                  </h2>
                  {selectedOrder.tipo_pedido === 'DOMICILIO' && (
                    <p className="text-sm text-slate-500">
                      {selectedOrderCustomer.telefono || '-'} · {selectedOrderCustomer.direccion || 'Sin direccion'}
                    </p>
                  )}
                </div>
                <button type="button" onClick={closePaymentModal} className="rounded-full bg-slate-100 px-4 py-3 font-bold">
                  Cerrar
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {groupedItems.map((group) => (
                  <div key={group.seat} className="rounded-3xl bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-black">{group.seat}</p>
                      <p className="font-bold text-slate-500">{formatMoney(group.subtotal)}</p>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="group relative flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                          <div className="flex-1">
                            <p className="font-bold">{item.cantidad} x {item.producto?.nombre}</p>
                            {item.cleanNote && <p className="text-xs text-slate-500">{item.cleanNote}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black">{formatMoney(item.precio_unitario * item.cantidad)}</span>
                            <button
                              type="button"
                              onClick={() => voidItem(item.id)}
                              className="rounded-full bg-red-50 p-2 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100"
                              title="Anular plato"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="border-l border-slate-200 p-6">
              <h3 className="text-2xl font-black">Cobro</h3>
              <p className="mt-4 text-sm font-bold text-slate-500">Total</p>
              <p className="text-4xl font-black text-blue-600">{formatMoney(selectedOrder.total)}</p>

              <div className="mt-6 grid grid-cols-1 gap-3">
                {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-2xl px-4 py-4 text-sm font-black tracking-wide transition-all ${
                      paymentMethod === method 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {paymentMethod === 'TRANSFERENCIA' && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <input
                    value={referencia}
                    onChange={(event) => setReferencia(event.target.value)}
                    placeholder="Referencia de pago"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button type="button" onClick={processPayment} className="w-full rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white transition-transform active:scale-95">
                  Confirmar pago
                </button>
                <button type="button" onClick={closePaymentModal} className="w-full rounded-2xl bg-slate-100 px-4 py-4 font-bold text-slate-700 transition-colors hover:bg-slate-200">
                  Cancelar y cerrar
                </button>
                <button type="button" onClick={voidOrder} className="mt-2 w-full text-center text-sm font-bold text-red-500 hover:underline">
                  Anular toda la orden
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {!isShiftOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <form onSubmit={handleOpenShift} className="w-full max-w-md rounded-[3rem] bg-white p-8 text-center shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-5xl">💶</div>
            <h2 className="text-3xl font-black text-slate-800">Apertura de Turno</h2>
            <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">
              Para empezar a cobrar, declara el fondo inicial o base de tu caja. Escribe 0 si no tienes base.
            </p>
            <div className="mt-8 text-left">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Total en caja física ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                max="100000"
                value={fondoInput}
                onChange={e => setFondoInput(e.target.value)}
                autoFocus
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-6 py-4 text-2xl font-black text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <button type="submit" className="mt-8 w-full rounded-full bg-blue-600 px-6 py-4 text-lg font-black tracking-wide text-white transition-transform active:scale-95 shadow-xl shadow-blue-600/20 hover:bg-blue-700">
              Abrir Toma de Pedidos
            </button>
            <button type="button" onClick={handleLogout} className="mt-4 w-full text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Cerrar sesión
            </button>
          </form>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <form onSubmit={confirmCloseShift} className="w-full max-w-md rounded-[3rem] bg-white p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 border-b-8 border-red-500">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-5xl">🏧</div>
            <h2 className="text-3xl font-black text-slate-800">Cierre Z: Arqueo Ciego</h2>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              Antes de finalizar tu turno, debes ingresar exactamente el saldo de dinero físico / digital que posees en tu caja o poder.
            </p>
            <div className="mt-8 text-left">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-red-500">Dinero Contado ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={countedCashInput}
                onChange={e => setCountedCashInput(e.target.value)}
                autoFocus
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-6 py-4 text-2xl font-black text-slate-800 focus:border-red-600 focus:bg-white focus:outline-none transition-all"
                placeholder="Total contado"
              />
            </div>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setShowCloseModal(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-4 font-bold text-slate-600 hover:bg-slate-200">
                Atrás
              </button>
              <button type="submit" className="flex-[2] rounded-2xl bg-red-600 px-4 py-4 font-black text-white shadow-xl shadow-red-600/20 transition-transform active:scale-95 hover:bg-red-700">
                Confirmar y Salir
              </button>
            </div>
          </form>
        </div>
      )}

      {showMovementModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
           <form onSubmit={handleCashMovement} className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl">
             <h3 className="text-xl font-black text-slate-800 mb-6">Registrar Movimiento de Caja</h3>
             <div className="space-y-4">
               <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Tipo</label>
                  <select value={movementForm.tipo} onChange={e => setMovementForm({...movementForm, tipo: e.target.value})} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-bold focus:border-blue-500 focus:outline-none">
                    <option value="EGRESO">Salida / Gasto (Egreso)</option>
                    <option value="INGRESO">Entrada / Base extra (Ingreso)</option>
                  </select>
               </div>
               <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Monto ($)</label>
                  <input type="number" step="0.01" min="0" required value={movementForm.monto} onChange={e => setMovementForm({...movementForm, monto: e.target.value})} className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold focus:border-blue-500 focus:outline-none" placeholder="0.00" />
               </div>
               <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Motivo</label>
                  <input type="text" required value={movementForm.motivo} onChange={e => setMovementForm({...movementForm, motivo: e.target.value})} className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none" placeholder="Ej. Pago a proveedor de hielo" />
               </div>
             </div>
             <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setShowMovementModal(false)} className="flex-1 rounded-2xl bg-slate-100 font-bold hover:bg-slate-200">Cancelar</button>
                <button type="submit" className="flex-[2] rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-xl active:scale-95">Guardar Movimiento</button>
             </div>
           </form>
        </div>
      )}
    </div>
  );
}

export default CajeroDashboard;
