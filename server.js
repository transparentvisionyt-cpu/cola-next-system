const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// ============ AUTH ============
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = get('SELECT id, username, name, phone, role FROM users WHERE username=? AND password=?', [username, password]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(user);
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, name, phone } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'All fields required' });
  const exists = get('SELECT id FROM users WHERE username=?', [username]);
  if (exists) return res.status(400).json({ error: 'Username already exists' });
  const result = run('INSERT INTO users (username, password, name, phone, role) VALUES (?, ?, ?, ?, ?)', [username, password, name, phone || '', 'user']);
  res.json({ id: result.lastInsertRowid, username, name, role: 'user' });
});

// User panel routes
app.get('/api/user/orders', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const user = get('SELECT id, name FROM users WHERE id=?', [userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const orders = all(`SELECT o.*, r.name as retailer_name FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE r.name LIKE ? ORDER BY o.order_date DESC`, ['%' + user.name + '%']);
  res.json({ user, orders });
});

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

// ============ STOCK RESET ============
app.put('/api/products/reset-stock', (req, res) => {
  run('UPDATE products SET stock = 0');
  res.json({ success: true });
});

// ============ FAQ CRUD ============
app.get('/api/faq', (req, res) => {
  res.json(all('SELECT * FROM faq ORDER BY sort_order ASC, id ASC'));
});

app.post('/api/faq', (req, res) => {
  const { question, answer, keywords } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });
  const result = run('INSERT INTO faq (question, answer, keywords) VALUES (?, ?, ?)', [question, answer, keywords || '']);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/faq/:id', (req, res) => {
  const { question, answer, keywords } = req.body;
  run('UPDATE faq SET question=?, answer=?, keywords=? WHERE id=?', [question, answer, keywords || '', req.params.id]);
  res.json({ success: true });
});

app.delete('/api/faq/:id', (req, res) => {
  run('DELETE FROM faq WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ============ LOW STOCK ALERT ============
app.get('/api/alerts/low-stock', (req, res) => {
  const products = all('SELECT *, (stock * pieces_per_case) as total_pets FROM products WHERE (stock * pieces_per_case) < 100 AND (stock * pieces_per_case) > 0');
  res.json(products);
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
    const unitPrice = (item.price && item.price > 0) ? item.price : product.sale_price;
    total_amount += unitPrice * item.quantity;
  }

  const net_amount = total_amount - (discount || 0);

  const result = run('INSERT INTO orders (order_number, retailer_id, total_amount, discount, net_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [order_number, retailer_id, total_amount, discount || 0, net_amount, 'pending', notes || '']);

  for (const item of items) {
    const product = get('SELECT sale_price FROM products WHERE id=?', [item.product_id]);
    const unitPrice = (item.price && item.price > 0) ? item.price : product.sale_price;
    run('INSERT INTO order_items (order_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)', [result.lastInsertRowid, item.product_id, item.quantity, unitPrice, unitPrice * item.quantity]);
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
  const stockDetails = all('SELECT stock, pieces_per_case FROM products');
  const totalBottles = stockDetails.reduce((sum, p) => sum + (p.stock * p.pieces_per_case), 0);

  res.json({
    totalProducts, totalRetailers, totalOrders, pendingOrders, totalStock: totalBottles,
    todaySales, todayPayments, totalReceivable, lowStock, recentOrders
  });
});

// ============ SETTINGS ============
app.get('/api/settings', (req, res) => {
  res.json(get('SELECT * FROM settings LIMIT 1'));
});

app.put('/api/settings', (req, res) => {
  const { company_name, phone, whatsapp, email, address, credit_terms_days, logo_path, panel_name, primary_color, bg_color, sidebar_color, header_color, animations_enabled } = req.body;
  run(`UPDATE settings SET company_name=?, phone=?, whatsapp=?, email=?, address=?, credit_terms_days=?, logo_path=?, panel_name=?, primary_color=?, bg_color=?, sidebar_color=?, header_color=?, animations_enabled=? WHERE id=1`, [company_name || '', phone || '', whatsapp || '', email || '', address || '', credit_terms_days || 30, logo_path || '', panel_name || '', primary_color || '', bg_color || '', sidebar_color || '', header_color || '', animations_enabled || '1']);
  res.json({ success: true });
});

app.put('/api/settings/password', (req, res) => {
  const { old_password, new_password } = req.body;
  const s = get('SELECT * FROM settings LIMIT 1');
  const currentPw = s.admin_password || 'cola2026admin';
  if (old_password !== currentPw) return res.status(400).json({ error: 'Current password is wrong' });
  if (!new_password || new_password.length < 4) return res.status(400).json({ error: 'Password must be 4+ characters' });
  run('UPDATE settings SET admin_password=? WHERE id=1', [new_password]);
  run('UPDATE users SET password=? WHERE username=? AND role=?', [new_password, 'admin', 'admin']);
  res.json({ success: true });
});

app.post('/api/settings/logo', (req, res) => {
  const { image, filename } = req.body;
  if (!image) return res.status(400).json({ error: 'image required' });
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const fname = filename || 'company-logo.png';
  const filePath = path.join(uploadDir, fname);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  run('UPDATE settings SET logo_path=? WHERE id=1', ['/uploads/' + fname]);
  res.json({ url: '/uploads/' + fname });
});

// ============ IMAGE UPLOAD ============
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.post('/api/upload', (req, res) => {
  const { image, filename } = req.body;
  if (!image || !filename) return res.status(400).json({ error: 'image and filename required' });
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  res.json({ url: '/uploads/' + filename });
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
