import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../config.js';
import { getCategoryIcon } from '../utils/menuIcons';
import { clearStoredSession, getStoredToken, getStoredUser } from '../utils/session';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function MeseroDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const token = getStoredToken();

  const [view, setView] = useState('mesas');
  const [tables, setTables] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [existingOrder, setExistingOrder] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);

  const loadTables = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      setTables(await response.json());
    }
  }, [token]);

  const loadExistingOrder = useCallback(async (tableId) => {
    const response = await fetch(`${API_BASE}/api/orders/mesa/${tableId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setExistingOrder(await response.json());
      return;
    }

    setExistingOrder(null);
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
        console.error('Waiter menu effect error:', error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/tables`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled && response.ok) {
          setTables(await response.json());
        }
      } catch (error) {
        console.error('Waiter tables effect error:', error);
      }
    };

    run();
    const interval = window.setInterval(() => {
      if (view === 'mesas') {
        run();
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, view]);

  const handleLogout = () => {
    clearStoredSession();
    navigate('/');
  };

  const handleTableSelect = async (table) => {
    setCurrentTable(table);
    setView('pos');
    setCart([]);

    if (table.estado === 'OCUPADA' || table.estado === 'COBRANDO' || table.estado === 'POR_PAGAR') {
      await loadExistingOrder(table.id);
    } else {
      setExistingOrder(null);
    }
  };

  const addToCart = (product) => {
    const nextSeatBase = cart.filter((item) => item.id_producto === product.id).length + 1;
    const capacity = currentTable?.capacidad || 4;
    const suggestedSeat = nextSeatBase > capacity ? 99 : nextSeatBase;

    setCart((current) => [
      ...current,
      {
        uid: crypto.randomUUID(),
        id_producto: product.id,
        nombre: product.nombre,
        precio: product.precio,
        cantidad: 1,
        notas: '',
        comensal: suggestedSeat,
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

  const sendOrderToKitchen = async () => {
    if (!currentTable || cart.length === 0) return;

    try {
      if (currentTable.estado === 'LIBRE') {
        await fetch(`${API_BASE}/api/tables/${currentTable.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ estado: 'OCUPADA' }),
        });
      }

      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo_pedido: 'LOCAL',
          id_mesa: currentTable.id,
          items: cart.map((item) => ({
            id_producto: item.id_producto,
            cantidad: item.cantidad,
            notas_preparacion: `[${item.comensal === 99 ? 'Centro' : `Asiento ${item.comensal}`}] ${item.notas || ''}`.trim(),
          })),
        }),
      });

      if (!response.ok) {
        alert('No se pudo enviar la orden.');
        return;
      }

      setCart([]);
      await Promise.all([loadTables(), loadExistingOrder(currentTable.id)]);
    } catch (error) {
      console.error('Send order error:', error);
      alert('Fallo de conexion');
    }
  };

  const requestBill = async () => {
    if (!currentTable) return;

    try {
      const response = await fetch(`${API_BASE}/api/tables/${currentTable.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: 'POR_PAGAR' }),
      });

      if (response.ok) {
        setView('mesas');
        setCurrentTable(null);
        setExistingOrder(null);
        setCart([]);
        await loadTables();
      }
    } catch (error) {
      console.error('Request bill error:', error);
    }
  };

  const filteredProducts = products
    .filter((product) => product.disponible !== false)
    .filter((product) => activeCategory === null || product.id_categoria === activeCategory)
    .filter((product) => !searchQuery || product.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  const existingTotal = existingOrder?.total || 0;
  const newItemsTotal = cart.reduce((total, item) => total + item.precio * item.cantidad, 0);
  const totalToCharge = existingTotal + newItemsTotal;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-500">Modulo Mesero</p>
            <h1 className="text-3xl font-black">SpidyGestion</h1>
            <p className="text-sm text-slate-500">{user?.nombre || 'Servicio'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['mesas', 'Mesas'],
              ['mis_ordenes', 'Mi turno'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setView(value);
                  if (value !== 'pos') {
                    setCurrentTable(null);
                  }
                }}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  view === value ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  onClick={() => handleTableSelect(table)}
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-8 transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 ${
                    table.estado === 'LIBRE'
                      ? 'border-slate-200 bg-white hover:border-orange-300'
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

        {view === 'pos' && currentTable && (
          <section className="grid gap-6 lg:grid-cols-[1fr,380px]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-500">Mesa {currentTable.numero_mesa}</p>
                  <h2 className="text-3xl font-black">Tomar pedido</h2>
                </div>
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
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 -translate-y-0.5'
                            : 'bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-orange-300'
                        }`}
                      >
                        <span className="text-lg">{getCategoryIcon(category.nombre)}</span>
                        {category.nombre}
                      </button>
                    ))}
                  </div>
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
                    placeholder="Buscar platillo..."
                    className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 transition-all focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex flex-col rounded-[2rem] border border-slate-100 bg-white p-3 text-left transition-all hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-600/10 group"
                  >
                    <div className="relative mb-3 h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {product.imagen ? (
                        <img src={product.imagen} alt={product.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl opacity-50">🍲</div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-2 pb-2">
                       <p className="font-black text-slate-800 leading-tight group-hover:text-orange-600">{product.nombre}</p>
                       <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{product.categoria?.nombre}</p>
                       <p className="mt-3 text-xl font-black text-orange-600">{formatMoney(product.precio)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black">Comanda</h3>
                <button
                  type="button"
                  onClick={() => {
                    setView('mesas');
                    setCurrentTable(null);
                    setExistingOrder(null);
                    setCart([]);
                  }}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold"
                >
                  Volver
                </button>
              </div>

              {existingOrder && (
                <div className="mt-6 rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">Consumo actual</p>
                  <div className="mt-3 space-y-2">
                    {existingOrder.items.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white px-4 py-3">
                        <p className="font-bold">{item.cantidad} x {item.producto?.nombre}</p>
                        {item.notas_preparacion && <p className="text-xs text-slate-500">{item.notas_preparacion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {cart.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <span className="text-4xl">📝</span>
                    <p className="mt-4 text-sm font-bold text-slate-500">Aun no agregas productos nuevos.</p>
                  </div>
                )}
                {cart.map((item) => (
                  <div key={item.uid} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{item.nombre}</p>
                        <p className="text-sm font-bold text-orange-600">{formatMoney(item.precio)} <span className="text-xs font-normal text-slate-400">c/u</span></p>
                      </div>
                      <button type="button" onClick={() => removeCartItem(item.uid)} className="rounded-full bg-red-50 p-2 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-xl bg-slate-200/50 p-1">
                        <button type="button" onClick={() => updateCartItem(item.uid, (current) => ({ cantidad: Math.max(1, current.cantidad - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-600 shadow-sm transition-colors hover:text-orange-600">
                          -
                        </button>
                        <span className="w-10 text-center font-black">{item.cantidad}</span>
                        <button type="button" onClick={() => updateCartItem(item.uid, (current) => ({ cantidad: current.cantidad + 1 }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-600 shadow-sm transition-colors hover:text-orange-600">
                          +
                        </button>
                      </div>

                      <select
                        value={item.comensal}
                        onChange={(event) => updateCartItem(item.uid, () => ({ comensal: Number(event.target.value) }))}
                        className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        {Array.from({ length: (currentTable.capacidad || 4) + 1 }).map((_, index) => (
                          <option key={index + 1} value={index + 1}>
                            Asiento {index + 1}
                          </option>
                        ))}
                        <option value={99}>Centro</option>
                      </select>
                    </div>

                    <div className="mt-3">
                      <input
                        value={item.notas}
                        onChange={(event) => updateCartItem(item.uid, () => ({ notas: event.target.value }))}
                        placeholder="Nota de cocina (opcional)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t pt-4">
                {existingOrder && (
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Consumo actual</span>
                    <span className="font-bold">{formatMoney(existingTotal)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Nuevos items</span>
                  <span className="font-bold">{formatMoney(newItemsTotal)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">Total mesa</span>
                  <span className="text-3xl font-black text-orange-600">{formatMoney(totalToCharge)}</span>
                </div>
                <button type="button" onClick={sendOrderToKitchen} disabled={cart.length === 0} className="mt-4 w-full rounded-2xl bg-orange-500 px-4 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {existingOrder ? 'Anexar a la orden' : 'Enviar a cocina'}
                </button>
                {existingOrder && cart.length === 0 && currentTable.estado !== 'POR_PAGAR' && (
                  <button type="button" onClick={requestBill} className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white">
                    Solicitar cuenta
                  </button>
                )}
              </div>
            </aside>
          </section>
        )}

        {view === 'mis_ordenes' && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Estado del turno</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-orange-50 p-6">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-500">Mesas activas</p>
                <p className="mt-3 text-5xl font-black text-orange-600">{tables.filter((table) => table.estado !== 'LIBRE').length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-6">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">Mesas libres</p>
                <p className="mt-3 text-5xl font-black text-slate-700">{tables.filter((table) => table.estado === 'LIBRE').length}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default MeseroDashboard;
