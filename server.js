const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { initDB, all, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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
  const { from, to } = req.query;
  let query = `SELECT p.*, r.name as retailer_name FROM payments p LEFT JOIN retailers r ON p.retailer_id = r.id WHERE 1=1`;
  const params = [];
  if (from) { query += ' AND p.payment_date>=?'; params.push(from); }
  if (to) { query += ' AND p.payment_date<=?'; params.push(to); }
  query += ' ORDER BY p.payment_date DESC';
  res.json(all(query, params));
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

// Monthly report - generates downloadable HTML report
app.get('/api/reports/monthly', (req, res) => {
  const { year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || (new Date().getMonth() + 1);
  const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
  const endDate = `${y}-${String(m).padStart(2,'0')}-31`;

  const orders = all(`SELECT o.*, r.name as retailer_name FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE o.order_date>=? AND o.order_date<=? ORDER BY o.order_date DESC`, [startDate, endDate]);
  const payments = all(`SELECT p.*, r.name as retailer_name FROM payments p LEFT JOIN retailers r ON p.retailer_id = r.id WHERE p.payment_date>=? AND p.payment_date<=? ORDER BY p.payment_date DESC`, [startDate, endDate]);
  const products = all('SELECT * FROM products ORDER BY category, name');

  const totalSales = orders.reduce((s, o) => s + o.net_amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[parseInt(m) - 1] || m;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Report - ${monthName} ${y}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;color:#333;padding:20px}
.header{background:linear-gradient(135deg,#e31e24,#8b0000);color:#fff;padding:30px;border-radius:16px;margin-bottom:24px;text-align:center}
.header h1{font-size:28px;font-weight:800;margin-bottom:6px}
.header p{font-size:14px;opacity:.8}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.stat{background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.stat h3{font-size:28px;font-weight:800;color:#e31e24}
.stat p{font-size:12px;color:#666;margin-top:4px}
.section{background:#fff;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.section h2{font-size:18px;font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e31e24}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
th{background:#f8f8f8;font-weight:600;color:#555}
.total-row{font-weight:700;background:#f0f0f0}
.footer{text-align:center;padding:20px;color:#888;font-size:12px}
@media print{body{padding:0}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><h1>Cola Next Distributor</h1><p>Monthly Report - ${monthName} ${y}</p></div>
<div class="stats">
<div class="stat"><h3>${orders.length}</h3><p>Total Orders</p></div>
<div class="stat"><h3>Rs.${totalSales.toLocaleString()}</h3><p>Total Sales</p></div>
<div class="stat"><h3>Rs.${totalPayments.toLocaleString()}</h3><p>Payments Received</p></div>
<div class="stat"><h3>${pendingOrders}</h3><p>Pending Orders</p></div>
</div>`;

  if (orders.length > 0) {
    html += `<div class="section"><h2>Orders</h2><table><thead><tr><th>Order #</th><th>Retailer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
    orders.forEach(o => {
      html += `<tr><td>${o.order_number}</td><td>${o.retailer_name||'-'}</td><td>Rs.${o.net_amount.toLocaleString()}</td><td>${o.status}</td><td>${o.order_date||''}</td></tr>`;
    });
    html += `<tr class="total-row"><td colspan="2">Total</td><td>Rs.${totalSales.toLocaleString()}</td><td colspan="2"></td></tr></tbody></table></div>`;
  }

  if (payments.length > 0) {
    html += `<div class="section"><h2>Payments</h2><table><thead><tr><th>Retailer</th><th>Amount</th><th>Date</th></tr></thead><tbody>`;
    payments.forEach(p => {
      html += `<tr><td>${p.retailer_name||'-'}</td><td>Rs.${p.amount.toLocaleString()}</td><td>${p.payment_date||''}</td></tr>`;
    });
    html += `<tr class="total-row"><td>Total</td><td>Rs.${totalPayments.toLocaleString()}</td><td></td></tr></tbody></table></div>`;
  }

  html += `<div class="footer">Generated on ${new Date().toLocaleString()} | Cola Next Distributor System</div></body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="cola-next-report-${y}-${m}.html"`);
  res.send(html);
});

// Retailer-specific report with date filter
app.get('/api/reports/retailer', (req, res) => {
  const { retailer_id, from, to } = req.query;
  if (!retailer_id) return res.status(400).json({ error: 'retailer_id required' });
  let orderQuery = `SELECT o.*, r.name as retailer_name FROM orders o LEFT JOIN retailers r ON o.retailer_id = r.id WHERE o.retailer_id=?`;
  let paymentQuery = `SELECT p.*, r.name as retailer_name FROM payments p LEFT JOIN retailers r ON p.retailer_id = r.id WHERE p.retailer_id=?`;
  const orderParams = [retailer_id];
  const paymentParams = [retailer_id];
  if (from) { orderQuery += ' AND o.order_date>=?'; orderParams.push(from); paymentQuery += ' AND p.payment_date>=?'; paymentParams.push(from); }
  if (to) { orderQuery += ' AND o.order_date<=?'; orderParams.push(to); paymentQuery += ' AND p.payment_date<=?'; paymentParams.push(to); }
  const orders = all(orderQuery + ' ORDER BY o.order_date DESC', orderParams);
  const payments = all(paymentQuery + ' ORDER BY p.payment_date DESC', paymentParams);
  const retailer = get('SELECT * FROM retailers WHERE id=?', [retailer_id]);
  const totalSales = orders.reduce((s, o) => s + o.net_amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  res.json({ retailer, orders, payments, totalSales, totalPayments, balance: totalSales - totalPayments });
});

// ============ BACKUP ============
const { execSync } = require('child_process');

app.get('/api/backup/download', (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'cola_next.db');
    res.download(dbPath, 'cola-next-backup.db');
  } catch (e) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

app.post('/api/backup/create', (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const src = path.join(__dirname, 'cola_next.db');
    const dest = path.join(backupDir, `cola-next-${date}.db`);
    fs.copyFileSync(src, dest);
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse();
    files.slice(30).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
    res.json({ success: true, file: `cola-next-${date}.db` });
  } catch (e) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

app.get('/api/backup/list', (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) return res.json([]);
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse();
    const list = files.map(f => ({
      name: f,
      size: fs.statSync(path.join(backupDir, f)).size,
      date: fs.statSync(path.join(backupDir, f)).mtime
    }));
    res.json(list);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/backup/download/:file', (req, res) => {
  const filePath = path.join(__dirname, 'backups', req.params.file);
  if (!fs.existsSync(filePath) || !req.params.file.endsWith('.db')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.download(filePath);
});

// ============ START ============
initDB().then(() => {
  const phone = process.env.PHONE || '03241281605';
  const whatsapp = process.env.WHATSAPP || '923241281605';
  run("UPDATE settings SET phone=?, whatsapp=? WHERE id=1", [phone, whatsapp]);
  run("UPDATE users SET phone=? WHERE role='admin'", [phone]);
  console.log(`Phone: ${phone} | WhatsApp: ${whatsapp}`);
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
