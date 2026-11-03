import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openDatabase(
  path = process.env.DB_PATH || resolve("data/meridian.sqlite"),
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0), stock INTEGER NOT NULL CHECK(stock>=0));
    CREATE TABLE IF NOT EXISTS cart(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99), PRIMARY KEY(user_id,product_id));
    CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), PRIMARY KEY(user_id,product_id));
    CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Новый', address TEXT NOT NULL, phone TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS order_items(order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), budget INTEGER NOT NULL, purpose TEXT NOT NULL, phone TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    PRAGMA user_version=1;`);
  const seed = db.prepare(
    "INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?)",
  );
  [
    [
      1,
      "Lenovo Legion 5",
      "Ноутбуки",
      "Intel Core i5 • RTX 3050 • 16 ГБ RAM",
      "lenovolegion5.png",
      499990,
      12,
    ],
    [
      2,
      "Acer Nitro VG271",
      "Мониторы",
      "IPS • Full HD • 144 Гц • 27 дюймов",
      "acernitrovg271.png",
      119990,
      18,
    ],
    [
      3,
      "ASUS ROG Strix G17",
      "Ноутбуки",
      "Intel Core i5 • RTX 3060 • 16 ГБ RAM",
      "asusrog g17.png",
      599990,
      8,
    ],
    [
      4,
      "Lenovo Legion 5i",
      "Компьютеры",
      "Intel Core i7 • RTX 3070 • 16 ГБ RAM",
      "lenovolegionpc.png",
      699990,
      6,
    ],
    [
      5,
      "Meta Quest 3",
      "VR и консоли",
      "Автономная VR-гарнитура • 128 ГБ",
      "meta-quest 3.png",
      279990,
      10,
    ],
    [
      6,
      "G Pro X Superlight",
      "Аксессуары",
      "60 г • 1000 Гц • Сенсор HERO 25K",
      "gproxsuperlight.png",
      69990,
      25,
    ],
    [
      7,
      "AULA F75",
      "Аксессуары",
      "Механическая клавиатура • Hot swap • 4000 мА·ч",
      "aulaf75.png",
      32990,
      30,
    ],
    [
      8,
      "Xbox Wireless Controller",
      "Аксессуары",
      "Беспроводной геймпад • USB Type-C",
      "xbox series gamepad.png",
      29990,
      20,
    ],
  ].forEach(([id, name, category, description, image, price, stock]) =>
    seed.run(
      id,
      name,
      category,
      description,
      `/img/products/${image}`,
      price,
      stock,
    ),
  );
  return db;
}
