import fetch from 'node-fetch';

async function run() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000' })
    });
    const login = await loginRes.json();
    console.log('LOGIN', login);
    const token = login.token;

    const body = {
      tipo_pedido: 'LOCAL',
      id_mesa: 1,
      items: [ { id_producto: 1, cantidad: 1 } ]
    };

    const res = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });

    console.log('STATUS', res.status);
    const data = await res.text();
    console.log('BODY', data);
  } catch (e) {
    console.error('ERR', e);
  }
}

run();
