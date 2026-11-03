import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const scrypt = promisify(scryptCallback);
const digest = (token) => createHash("sha256").update(token).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, min, max, label) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, `Проверьте поле «${label}»`);
  return v.trim();
};
const password = (v) => {
  if (typeof v !== "string" || v.length < 10 || v.length > 128)
    fail(400, "Пароль должен содержать от 10 до 128 символов");
  return v;
};
const existingPassword = (v) => {
  if (typeof v !== "string" || v.length < 1 || v.length > 128)
    fail(400, "Проверьте пароль");
  return v;
};
async function hash(value) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(value, salt, 64)).toString("hex");
}
async function matches(value, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    await scrypt(value, salt, 64),
  );
}
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  address: u.address,
});

export function createApp(
  db,
  {
    origin = process.env.APP_ORIGIN || "http://localhost:3000",
    secure = process.env.NODE_ENV === "production",
    limits = true,
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "16kb" }), cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const origins = secure
      ? [origin]
      : [origin, "http://localhost:4200", "http://127.0.0.1:4200"];
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("X-Meridian-Client") !== "web" ||
        (req.get("Origin") && !origins.includes(req.get("Origin"))))
    )
      return res
        .status(403)
        .json({ error: "Запрос из недопустимого источника" });
    next();
  });
  if (limits)
    app.use(
      "/api",
      rateLimit({
        windowMs: 60_000,
        limit: 240,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Слишком много запросов. Попробуйте позже." },
      }),
    );
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    skip: () => !limits,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Слишком много попыток входа. Повторите через 15 минут.",
    },
  });
  app.use("/api", (req, res, next) => {
    const token = req.cookies.session;
    if (token && /^[a-f0-9]{64}$/.test(token))
      req.user = db
        .prepare(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(digest(token), Date.now());
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: "Войдите в аккаунт" });
  const cookie = { httpOnly: true, sameSite: "lax", secure, path: "/" };
  function session(req, res, id) {
    if (req.cookies.session)
      db.prepare("DELETE FROM sessions WHERE token=?").run(
        digest(req.cookies.session),
      );
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("session", token, { ...cookie, maxAge: 7 * 86400000 });
  }
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/products", (req, res) =>
    res.json(db.prepare("SELECT * FROM products").all()),
  );
  app.get("/api/me", (req, res) =>
    res.json(req.user ? publicUser(req.user) : null),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const name = text(req.body.name, 2, 80, "Имя"),
      email = text(req.body.email, 3, 254, "Email").toLowerCase(),
      pass = password(req.body.password);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Некорректный email");
    const hashed = await hash(pass);
    let id;
    try {
      id = Number(
        db
          .prepare("INSERT INTO users(email,name,password) VALUES(?,?,?)")
          .run(email, name, hashed).lastInsertRowid,
      );
    } catch (e) {
      if (String(e.message).includes("UNIQUE"))
        fail(409, "Этот email уже зарегистрирован");
      throw e;
    }
    session(req, res, id);
    res
      .status(201)
      .json(publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(id)));
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const email = text(req.body.email, 3, 254, "Email").toLowerCase(),
      pass = existingPassword(req.body.password);
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const valid = await matches(
      pass,
      u?.password || "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!u || !valid) fail(401, "Неверный email или пароль");
    session(req, res, u.id);
    res.json(publicUser(u));
  });
  app.post("/api/auth/logout", (req, res) => {
    if (req.cookies.session)
      db.prepare("DELETE FROM sessions WHERE token=?").run(
        digest(req.cookies.session),
      );
    res.clearCookie("session", cookie).json({ ok: true });
  });
  app.patch("/api/me", auth, (req, res) => {
    const name = text(req.body.name, 2, 80, "Имя"),
      phone = text(req.body.phone, 0, 30, "Телефон"),
      address = text(req.body.address, 0, 300, "Адрес");
    db.prepare("UPDATE users SET name=?,phone=?,address=? WHERE id=?").run(
      name,
      phone,
      address,
      req.user.id,
    );
    res.json(
      publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)),
    );
  });
  app.post("/api/auth/password", authLimit, auth, async (req, res) => {
    const old = existingPassword(req.body.currentPassword),
      pass = password(req.body.password);
    if (!(await matches(old, req.user.password)))
      fail(400, "Текущий пароль неверен");
    const hashed = await hash(pass);
    db.prepare("UPDATE users SET password=? WHERE id=?").run(
      hashed,
      req.user.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
    session(req, res, req.user.id);
    res.json({ ok: true });
  });
  const cart = (id) =>
    db
      .prepare(
        "SELECT p.*,c.quantity FROM cart c JOIN products p ON p.id=c.product_id WHERE c.user_id=?",
      )
      .all(id);
  app.get("/api/cart", auth, (req, res) => res.json(cart(req.user.id)));
  app.put("/api/cart/:id", auth, (req, res) => {
    const p = db
        .prepare("SELECT * FROM products WHERE id=?")
        .get(req.params.id),
      q = req.body.quantity;
    if (!p) fail(404, "Товар не найден");
    if (!Number.isInteger(q) || q < 0 || q > 99)
      fail(400, "Некорректное количество");
    if (q > p.stock) fail(409, "Недостаточно товара на складе");
    if (q === 0)
      db.prepare("DELETE FROM cart WHERE user_id=? AND product_id=?").run(
        req.user.id,
        p.id,
      );
    else
      db.prepare(
        "INSERT INTO cart VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity",
      ).run(req.user.id, p.id, q);
    res.json(cart(req.user.id));
  });
  app.get("/api/favorites", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT product_id FROM favorites WHERE user_id=?")
        .all(req.user.id)
        .map((x) => x.product_id),
    ),
  );
  app.put("/api/favorites/:id", auth, (req, res) => {
    if (typeof req.body.active !== "boolean")
      fail(400, "Некорректное значение");
    if (!db.prepare("SELECT id FROM products WHERE id=?").get(req.params.id))
      fail(404, "Товар не найден");
    db.prepare(
      req.body.active
        ? "INSERT OR IGNORE INTO favorites VALUES(?,?)"
        : "DELETE FROM favorites WHERE user_id=? AND product_id=?",
    ).run(req.user.id, req.params.id);
    res.json({ ok: true });
  });
  app.get("/api/orders", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC")
        .all(req.user.id)
        .map((o) => ({
          ...o,
          items: db
            .prepare("SELECT * FROM order_items WHERE order_id=?")
            .all(o.id),
        })),
    ),
  );
  app.post("/api/orders", auth, (req, res) => {
    const address = text(req.body.address, 10, 300, "Адрес доставки"),
      phone = text(req.body.phone, 7, 30, "Телефон");
    db.exec("BEGIN IMMEDIATE");
    try {
      const items = cart(req.user.id);
      if (!items.length) fail(400, "Корзина пуста");
      if (items.some((p) => p.quantity > p.stock))
        fail(409, "Количество товара на складе изменилось. Обновите корзину.");
      const total = items.reduce((s, p) => s + p.price * p.quantity, 0);
      const id = Number(
        db
          .prepare(
            "INSERT INTO orders(user_id,total,address,phone) VALUES(?,?,?,?)",
          )
          .run(req.user.id, total, address, phone).lastInsertRowid,
      );
      for (const p of items) {
        db.prepare("INSERT INTO order_items VALUES(?,?,?,?,?)").run(
          id,
          p.id,
          p.name,
          p.price,
          p.quantity,
        );
        db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(
          p.quantity,
          p.id,
        );
      }
      db.prepare("DELETE FROM cart WHERE user_id=?").run(req.user.id);
      db.exec("COMMIT");
      res.status(201).json({ id, total });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  app.post("/api/requests", auth, (req, res) => {
    const budget = req.body.budget,
      purpose = text(req.body.purpose, 10, 2000, "Задачи компьютера"),
      phone = text(req.body.phone, 7, 30, "Телефон");
    if (!Number.isInteger(budget) || budget < 100000 || budget > 10000000)
      fail(400, "Бюджет: от 100 000 до 10 000 000 ₸");
    const result = db
      .prepare(
        "INSERT INTO requests(user_id,budget,purpose,phone) VALUES(?,?,?,?)",
      )
      .run(req.user.id, budget, purpose, phone);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.get("/api/requests", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM requests WHERE user_id=? ORDER BY id DESC")
        .all(req.user.id),
    ),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Маршрут не найден" }),
  );
  const dist = resolve("dist/meridian/browser");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? "Ошибка сервера. Попробуйте позже." : err.message,
    });
  });
  return app;
}
