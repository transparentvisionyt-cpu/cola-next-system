const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cola_next.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      size TEXT NOT NULL,
      pieces_per_case INTEGER DEFAULT 12,
      purchase_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      image TEXT DEFAULT '',
      color TEXT DEFAULT '#e31e24',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS retailers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      area TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      retailer_id INTEGER NOT NULL,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      total REAL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retailer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT DEFAULT 'cash',
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS riders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      vehicle TEXT,
      assigned_area TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT DEFAULT 'Cola Next Distributor',
      phone TEXT,
      address TEXT,
      credit_terms_days INTEGER DEFAULT 30
    )
  `);

  seedProducts();
  seedSettings();
  seedAdmin();
  saveDB();

  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function seedProducts() {
  const result = db.exec("SELECT COUNT(*) as c FROM products");
  if (result.length > 0 && result[0].values[0][0] > 0) return;

  const products = [
    ['Cola Next', 'Classic', '300ml', 12, 480, 550, 200, 'cola-next-300', '#e31e24'],
    ['Cola Next', 'Classic', '500ml', 6, 520, 600, 150, 'cola-next-500', '#e31e24'],
    ['Cola Next', 'Classic', '1L', 6, 700, 800, 100, 'cola-next-1l', '#e31e24'],
    ['Cola Next', 'Classic', '1.5L', 6, 900, 1000, 80, 'cola-next-1.5l', '#e31e24'],
    ['Cola Next', 'Classic', '2.25L', 6, 1100, 1250, 60, 'cola-next-2.25l', '#e31e24'],
    ['Dare Next', 'Classic', '300ml', 12, 480, 550, 100, 'dare-next-300', '#ff6b00'],
    ['Dare Next', 'Classic', '500ml', 6, 520, 600, 80, 'dare-next-500', '#ff6b00'],
    ['Dare Next', 'Classic', '1L', 6, 700, 800, 50, 'dare-next-1l', '#ff6b00'],
    ['Dare Next', 'Classic', '1.5L', 6, 900, 1000, 40, 'dare-next-1.5l', '#ff6b00'],
    ['Fizzup Next', 'Classic', '300ml', 12, 480, 550, 100, 'fizzup-300', '#00a651'],
    ['Fizzup Next', 'Classic', '500ml', 6, 520, 600, 80, 'fizzup-500', '#00a651'],
    ['Rango Next', 'Classic', '300ml', 12, 480, 550, 100, 'rango-300', '#ff1493'],
    ['Rango Next', 'Classic', '500ml', 6, 520, 600, 80, 'rango-500', '#ff1493'],
    ['Anaar Next', 'Flavored', '300ml', 12, 500, 580, 80, 'anaar-300', '#8b0000'],
    ['Anaar Next', 'Flavored', '500ml', 6, 550, 630, 60, 'anaar-500', '#8b0000'],
    ['Green Soda Next', 'Flavored', '300ml', 12, 500, 580, 80, 'soda-300', '#00c853'],
    ['Green Soda Next', 'Flavored', '500ml', 6, 550, 630, 60, 'soda-500', '#00c853'],
    ['Lychee Next', 'Flavored', '300ml', 12, 500, 580, 80, 'lychee-300', '#ff69b4'],
    ['Lychee Next', 'Flavored', '500ml', 6, 550, 630, 60, 'lychee-500', '#ff69b4'],
    ['Storm', 'Flavored', '300ml', 12, 500, 580, 80, 'storm-300', '#1a237e'],
    ['Storm', 'Flavored', '500ml', 6, 550, 630, 60, 'storm-500', '#1a237e'],
  ];

  const stmt = db.prepare("INSERT INTO products (name, category, size, pieces_per_case, purchase_price, sale_price, stock, image, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const p of products) {
    stmt.run(p);
  }
  stmt.free();
  console.log('Products seeded:', products.length);
}

function seedSettings() {
  const result = db.exec("SELECT COUNT(*) as c FROM settings");
  if (result.length > 0 && result[0].values[0][0] > 0) return;
  db.run("INSERT INTO settings (company_name, phone, address, credit_terms_days) VALUES (?, ?, ?, ?)", ['Cola Next Distributor', '', '', 30]);
}

function seedAdmin() {
  const result = db.exec("SELECT COUNT(*) as c FROM users WHERE role='admin'");
  if (result.length > 0 && result[0].values[0][0] > 0) return;
  db.run("INSERT INTO users (username, password, name, phone, role) VALUES (?, ?, ?, ?, ?)", ['admin', 'cola2026admin', 'System Admin', '03000000000', 'admin']);
  console.log('Admin seeded: admin / cola2026admin');
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id");
  saveDB();
  return { lastInsertRowid: lastId.length ? lastId[0].values[0][0] : 0 };
}

module.exports = { initDB, all, get, run, saveDB };
