const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ PRODUCTS ============
app.get('/api/products', (req, res) => {
  res.json(all('SELECT * FROM products ORDER BY category, name, size'));
});

app.post('/api/products', (req, res) => {
  const { name, category, size, pieces_per_case, purchase_price, sale_price, stock, image, color } = req.body;
  const result = run('INSERT INTO products (name, category, size, pieces_per_case, purchase_price, sale_price, stock, image, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, category, size, pieces_per_case || 12, purchase_price || 0, sale_price || 0, stock || 0, image || '', color || '#e31e24']);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/products/:id', (req, res) => {
  const { name, category, size, pieces_per_case, purchase_price, sale_price, stock, image, color } = req.body;
  run('UPDATE products SET name=?, category=?, size=?, pieces_per_case=?, purchase_price=?, sale_price=?, stock=?, image=?, color=? WHERE id=?', [name, category, size, pieces_per_case, purchase_price, sale_price, stock, image || '', color || '#e31e24', req.params.id]);
  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  run('DELETE FROM products WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ============ RETAILERS ============
app.get('/api/retailers', (req, res) => {
  res.json(all('SELECT * FROM retailers ORDER BY name'));
});

app.post('/api/retailers', (req, res) => {
  const { name, phone, address, area, credit_limit } = req.body;
  const result = run('INSERT INTO retailers (name, phone, address, area, credit_limit) VALUES (?, ?, ?, ?, ?)', [name, phone || '', address || '', area || '', credit_limit || 0]);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/retailers/:id', (req, res) => {
  const { name, phone, address, area, credit_limit } = req.body;
  run('UPDATE retailers SET name=?, phone=?, address=?, area=?, credit_limit=? WHERE id=?', [name, phone, address, area, credit_limit, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/retailers/:id', (req, res) => {
  run('DELETE FROM retailers WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/retailers/:id/ledger', (req, res) => {
  const retailer = get('SELECT * FROM retailers WHERE id=?', [req.params.id]);
  const payments = all('SELECT * FROM payments WHERE retailer_id=? ORDER BY payment_date DESC', [req.params.id]);
  const orders = all('SELECT * FROM orders WHERE retailer_id=? ORDER BY order_date DESC', [req.params.id]);
  res.json({ retailer, payments, orders });
});

// ============ ORDERS ============
app.get('/api/orders', (req, res) => {
  const { status, from, to } = req.query;
  let query = `SELECT o.*, r.name as retailer_name, r.phone as retailer_phone FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE 1=1`;
  const params = [];
  if (status) { query += ' AND o.status=?'; params.push(status); }
  if (from) { query += ' AND o.order_date>=?'; params.push(from); }
  if (to) { query += ' AND o.order_date<=?'; params.push(to); }
  query += ' ORDER BY o.order_date DESC';
  res.json(all(query, params));
});

app.get('/api/orders/:id', (req, res) => {
  const order = get(`SELECT o.*, r.name as retailer_name, r.phone as retailer_phone, r.address as retailer_address FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE o.id=?`, [req.params.id]);
  const items = all(`SELECT oi.*, p.name as product_name, p.size, p.category FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id=?`, [req.params.id]);
  res.json({ order, items });
});

app.post('/api/orders', (req, res) => {
  const { retailer_id, items, discount, notes } = req.body;

  const lastOrder = get("SELECT order_number FROM orders ORDER BY id DESC LIMIT 1");
  let nextNum = 1;
  if (lastOrder && lastOrder.order_number) {
    const match = lastOrder.order_number.match(/CN-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const order_number = `CN-${String(nextNum).padStart(5, '0')}`;

  let total_amount = 0;
  for (const item of items) {
    const product = get('SELECT sale_price FROM products WHERE id=?', [item.product_id]);
    total_amount += product.sale_price * item.quantity;
  }

  const net_amount = total_amount - (discount || 0);

  const result = run('INSERT INTO orders (order_number, retailer_id, total_amount, discount, net_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [order_number, retailer_id, total_amount, discount || 0, net_amount, 'pending', notes || '']);

  for (const item of items) {
    const product = get('SELECT sale_price FROM products WHERE id=?', [item.product_id]);
    run('INSERT INTO order_items (order_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)', [result.lastInsertRowid, item.product_id, item.quantity, product.sale_price, product.sale_price * item.quantity]);
    run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
  }

  run('UPDATE retailers SET current_balance = current_balance + ?, total_purchases = total_purchases + ? WHERE id = ?', [net_amount, net_amount, retailer_id]);

  res.json({ id: result.lastInsertRowid, order_number });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  run('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/orders/:id', (req, res) => {
  const items = all('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
  for (const item of items) {
    run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
  }
  const order = get('SELECT * FROM orders WHERE id=?', [req.params.id]);
  if (order) {
    run('UPDATE retailers SET current_balance = current_balance - ?, total_purchases = total_purchases - ? WHERE id = ?', [order.net_amount, order.net_amount, order.retailer_id]);
  }
  run('DELETE FROM order_items WHERE order_id=?', [req.params.id]);
  run('DELETE FROM orders WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ============ PAYMENTS ============
app.get('/api/payments', (req, res) => {
  res.json(all(`SELECT p.*, r.name as retailer_name FROM payments p LEFT JOIN retailers r ON p.retailer_id = r.id ORDER BY p.payment_date DESC`));
});

app.post('/api/payments', (req, res) => {
  const { retailer_id, amount, notes } = req.body;
  const result = run('INSERT INTO payments (retailer_id, amount, notes) VALUES (?, ?, ?)', [retailer_id, amount, notes || '']);
  run('UPDATE retailers SET current_balance = current_balance - ? WHERE id = ?', [amount, retailer_id]);
  res.json({ id: result.lastInsertRowid });
});

// ============ RIDERS ============
app.get('/api/riders', (req, res) => {
  res.json(all('SELECT * FROM riders ORDER BY name'));
});

app.post('/api/riders', (req, res) => {
  const { name, phone, vehicle, assigned_area } = req.body;
  const result = run('INSERT INTO riders (name, phone, vehicle, assigned_area) VALUES (?, ?, ?, ?)', [name, phone || '', vehicle || '', assigned_area || '']);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/riders/:id', (req, res) => {
  const { name, phone, vehicle, assigned_area, status } = req.body;
  run('UPDATE riders SET name=?, phone=?, vehicle=?, assigned_area=?, status=? WHERE id=?', [name, phone, vehicle, assigned_area, status, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/riders/:id', (req, res) => {
  run('DELETE FROM riders WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ============ DELIVERIES ============
app.get('/api/deliveries', (req, res) => {
  res.json(all(`SELECT d.*, o.order_number, r.name as rider_name, rt.name as retailer_name FROM deliveries d LEFT JOIN orders o ON d.order_id = o.id LEFT JOIN riders r ON d.rider_id = r.id LEFT JOIN retailers rt ON o.retailer_id = rt.id ORDER BY d.delivery_date DESC`));
});

app.post('/api/deliveries', (req, res) => {
  const { order_id, rider_id } = req.body;
  const result = run('INSERT INTO deliveries (order_id, rider_id, status) VALUES (?, ?, ?)', [order_id, rider_id || null, 'assigned']);
  run('UPDATE orders SET status=? WHERE id=?', ['assigned', order_id]);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/deliveries/:id', (req, res) => {
  const { status, cash_collected } = req.body;
  run('UPDATE deliveries SET status=?, cash_collected=?, delivery_date=CURRENT_TIMESTAMP WHERE id=?', [status, cash_collected || 0, req.params.id]);
  if (status === 'delivered') {
    const delivery = get('SELECT * FROM deliveries WHERE id=?', [req.params.id]);
    run('UPDATE orders SET status=? WHERE id=?', ['delivered', delivery.order_id]);
  }
  res.json({ success: true });
});

// ============ DASHBOARD ============
app.get('/api/dashboard', (req, res) => {
  const totalProducts = get('SELECT COUNT(*) as c FROM products').c;
  const totalRetailers = get('SELECT COUNT(*) as c FROM retailers').c;
  const totalOrders = get('SELECT COUNT(*) as c FROM orders').c;
  const pendingOrders = get("SELECT COUNT(*) as c FROM orders WHERE status='pending'").c;
  const totalStock = get('SELECT COALESCE(SUM(stock),0) as c FROM products').c;

  const today = new Date().toISOString().split('T')[0];
  const todaySales = get("SELECT COALESCE(SUM(net_amount),0) as c FROM orders WHERE order_date>=?", [today]).c;
  const todayPayments = get("SELECT COALESCE(SUM(amount),0) as c FROM payments WHERE payment_date>=?", [today]).c;

  const totalReceivable = get('SELECT COALESCE(SUM(current_balance),0) as c FROM retailers WHERE current_balance > 0').c;
  const lowStock = all('SELECT * FROM products WHERE stock < 20 ORDER BY stock ASC');
  const recentOrders = all(`SELECT o.*, r.name as retailer_name FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id ORDER BY o.order_date DESC LIMIT 10`);

  res.json({
    totalProducts, totalRetailers, totalOrders, pendingOrders, totalStock,
    todaySales, todayPayments, totalReceivable, lowStock, recentOrders
  });
});

// ============ SETTINGS ============
app.get('/api/settings', (req, res) => {
  res.json(get('SELECT * FROM settings LIMIT 1'));
});

app.put('/api/settings', (req, res) => {
  const { company_name, phone, address, credit_terms_days } = req.body;
  run('UPDATE settings SET company_name=?, phone=?, address=?, credit_terms_days=? WHERE id=1', [company_name, phone, address, credit_terms_days]);
  res.json({ success: true });
});

// ============ REPORTS ============
app.get('/api/reports/sales', (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT o.*, r.name as retailer_name FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND o.order_date>=?'; params.push(from); }
  if (to) { query += ' AND o.order_date<=?'; params.push(to); }
  query += ' ORDER BY o.order_date DESC';
  const orders = all(query, params);
  const totalSales = orders.reduce((sum, o) => sum + o.net_amount, 0);
  const totalOrders = orders.length;
  res.json({ orders, totalSales, totalOrders });
});

app.get('/api/reports/profit', (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT oi.*, o.order_date, p.purchase_price, p.sale_price, p.name as product_name, p.size FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id LEFT JOIN products p ON oi.product_id = p.id WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND o.order_date>=?'; params.push(from); }
  if (to) { query += ' AND o.order_date<=?'; params.push(to); }
  const items = all(query, params);
  let totalRevenue = 0, totalCost = 0;
  for (const item of items) {
    totalRevenue += item.total;
    totalCost += item.purchase_price * item.quantity;
  }
  res.json({ items, totalRevenue, totalCost, profit: totalRevenue - totalCost });
});

// ============ START ============
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   Cola Next Distributor Management System        ║
║   URL: http://localhost:${PORT}                     ║
║   Status: Running                                 ║
╚══════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
