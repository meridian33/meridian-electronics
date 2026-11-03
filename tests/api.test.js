import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";

test("Регистрация, изоляция аккаунтов, корзина, заказ, пароль и выход", async (t) => {
  const db = openDatabase(":memory:");
  const server = createApp(db, { limits: false }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const client = () => {
    let cookie = "";
    return async (path, method = "GET", body, headers = {}) => {
      const r = await fetch(base + "/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Meridian-Client": "web",
          cookie,
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie"),
      };
    };
  };
  const a = client(),
    b = client(),
    anon = client();
  assert.equal((await anon("/cart")).status, 401);
  assert.equal(
    (
      await a("/auth/register", "POST", {
        name: "A",
        email: "bad",
        password: "short",
      })
    ).status,
    400,
  );
  const registered = await a("/auth/register", "POST", {
    name: "Адылжан",
    email: "owner@example.com",
    password: " safe password 123 ",
  });
  assert.equal(registered.status, 201);
  assert.match(registered.cookie, /HttpOnly/);
  assert.equal(registered.data.password, undefined);
  assert.notEqual(
    db.prepare("SELECT password FROM users").get().password,
    " safe password 123 ",
  );
  assert.equal(
    (
      await b("/auth/register", "POST", {
        name: "Другой",
        email: "owner@example.com",
        password: "safe password 123",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await b("/auth/register", "POST", {
        name: "Другой",
        email: "other@example.com",
        password: "safe password 123",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await a(
        "/cart/1",
        "PUT",
        { quantity: 2 },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal((await a("/cart/1", "PUT", { quantity: -1 })).status, 400);
  assert.equal((await a("/cart/1", "PUT", { quantity: 99 })).status, 409);
  assert.equal(
    (await a("/cart/1", "PUT", { quantity: 2 })).data[0].quantity,
    2,
  );
  assert.equal((await b("/cart")).data.length, 0);
  await a("/favorites/1", "PUT", { active: true });
  assert.deepEqual((await a("/favorites")).data, [1]);
  assert.deepEqual((await b("/favorites")).data, []);
  assert.equal(
    (await a("/orders", "POST", { address: "x", phone: "0" })).status,
    400,
  );
  const order = await a("/orders", "POST", {
    address: "Алматы, улица Тестовая 10",
    phone: "+77770000000",
    total: 1,
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.total, 999980);
  assert.equal((await a("/cart")).data.length, 0);
  assert.equal((await a("/orders")).data.length, 1);
  assert.equal((await b("/orders")).data.length, 0);
  assert.equal(
    db.prepare("SELECT stock FROM products WHERE id=1").get().stock,
    10,
  );
  assert.equal(
    (
      await a("/orders", "POST", {
        address: "Алматы, улица Тестовая 10",
        phone: "+77770000000",
      })
    ).status,
    400,
  );
  await a("/cart/2", "PUT", { quantity: 2 });
  db.prepare("UPDATE products SET stock=1 WHERE id=2").run();
  assert.equal(
    (
      await a("/orders", "POST", {
        address: "Алматы, улица Тестовая 10",
        phone: "+77770000000",
      })
    ).status,
    409,
  );
  assert.equal((await a("/cart")).data.length, 1);
  assert.equal((await a("/orders")).data.length, 1);
  await a("/me", "PATCH", {
    name: "Новое имя",
    phone: "+77770000000",
    address: "Адрес",
  });
  assert.equal((await a("/me")).data.name, "Новое имя");
  assert.equal(
    (
      await a("/requests", "POST", {
        budget: 500000,
        purpose: "Для разработки и игр",
        phone: "+77770000000",
      })
    ).status,
    201,
  );
  assert.equal((await b("/requests")).data.length, 0);
  const second = client();
  await second("/auth/login", "POST", {
    email: "owner@example.com",
    password: " safe password 123 ",
  });
  assert.equal(
    (
      await a("/auth/password", "POST", {
        currentPassword: "wrong",
        password: "new safe password",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a("/auth/password", "POST", {
        currentPassword: " safe password 123 ",
        password: "new safe password",
      })
    ).status,
    200,
  );
  assert.equal((await second("/cart")).status, 401);
  await a("/auth/logout", "POST", {});
  assert.equal((await a("/me")).data, null);
  assert.equal(
    (
      await a("/auth/login", "POST", {
        email: "' OR 1=1 --",
        password: "new safe password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await a("/auth/login", "POST", {
        email: "owner@example.com",
        password: "safe password 123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await a("/auth/login", "POST", {
        email: "owner@example.com",
        password: "new safe password",
      })
    ).status,
    200,
  );
  assert.equal((await a("/cart")).data.length, 1);
});
