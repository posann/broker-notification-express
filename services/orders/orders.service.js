import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ordersStore = path.join(__dirname, 'data', 'orders.json');
const outboxStore = path.join(__dirname, 'data', 'outbox.json');

/**
 * Create and start the Order Service.
 * - Provides REST API to place orders
 * - Stores orders into `orders.json`
 * - Emits "order.created" events to both `outbox.json` and broker (if available)
 * - Enforces idempotency: duplicate orderId or duplicate itemId across orders are rejected
 *
 * Membuat dan menjalankan Order Service.
 * - Menyediakan REST API untuk membuat order
 * - Menyimpan order ke file `orders.json`
 * - Menghasilkan event "order.created" ke `outbox.json` dan broker (jika ada)
 * - Menjamin idempoten: orderId duplikat atau itemId yang sudah pernah dipakai akan ditolak
 *
 * @param {Object} options - service options / opsi service
 * @param {import('../shared/broker.js').Broker} [options.broker] - optional event broker / broker event opsional
 * @param {number} options.port - HTTP port to listen on / port HTTP yang digunakan
 * @returns {{app: import('express').Express, server: import('http').Server}}
 */
export function createOrderService({ broker, port }) {
  const app = express();
  app.use(bodyParser.json());

  /**
   * Ensure storage files exist (`orders.json`, `outbox.json`).
   * If not present, create them as empty arrays.
   *
   * Memastikan file penyimpanan (`orders.json`, `outbox.json`) ada.
   * Jika tidak ada, buat file kosong berupa array.
   */
  async function ensureStores() {
    try { await fs.access(ordersStore); }
    catch { await fs.writeFile(ordersStore, JSON.stringify([])); }

    try { await fs.access(outboxStore); }
    catch { await fs.writeFile(outboxStore, JSON.stringify([])); }
  }
  ensureStores();

  /**
   * POST /orders
   * Accepts a new order, validates:
   * - itemId must be a non-empty array
   * - orderId must be unique
   * - each itemId must not already exist in previous orders
   * On success: order saved, event written to outbox.json and published to broker.
   *
   * Endpoint POST /orders
   * Menerima order baru, validasi:
   * - itemId harus array dan tidak boleh kosong
   * - orderId harus unik
   * - setiap itemId tidak boleh sudah ada di order sebelumnya
   * Jika sukses: order disimpan, event ditulis ke outbox.json dan publish ke broker.
   */
  app.post('/orders', async (req, res) => {
    const { itemId, orderId } = req.body;
    if (!Array.isArray(itemId) || itemId.length === 0) {
      return res.status(400).json({ error: 'itemId is required (non-empty array)' });
    }

    const orders = JSON.parse(await fs.readFile(ordersStore, 'utf-8'));
    const id = orderId || randomUUID();

    // 1. Check duplicate orderId
    if (orders.find(o => o.orderId === id)) {
      return res.status(409).json({ error: 'duplicate orderId' });
    }

    // 2. Check duplicate itemId across all previous orders
    const existingItems = new Set(orders.flatMap(o => o.itemId));
    const duplicates = itemId.filter(item => existingItems.has(item));
    if (duplicates.length > 0) {
      return res.status(409).json({ error: `duplicate item(s): ${duplicates.join(', ')}` });
    }

    // 3. Save order
    const order = { orderId: id, itemId, createdAt: new Date().toISOString() };
    orders.push(order);
    await fs.writeFile(ordersStore, JSON.stringify(orders, null, 2));

    const event = { type: 'order.created', version: 1, ...order };

    // Always write event to outbox.json
    let arr = [];
    try { arr = JSON.parse(await fs.readFile(outboxStore, 'utf-8')); } catch {}
    arr.push(event);
    await fs.writeFile(outboxStore, JSON.stringify(arr, null, 2));

    // If broker exists, publish event
    if (broker && typeof broker.publish === 'function') {
      await broker.publish('order.created', event);
    }

    res.status(202).json({ orderId: id });
  });

  const server = app.listen(port, () => {
    console.log(`📦 Order service listening on ${port}`);
  });

  return { app, server };
}

/**
 * CLI runner (if executed directly).
 * When running `node orders.service.js`, service starts with in-memory broker.
 *
 * Runner CLI (jika dijalankan langsung).
 * Saat menjalankan `node orders.service.js`, service akan jalan dengan broker in-memory.
 */
if (process.argv[1] && process.argv[1].endsWith('orders.service.js')) {
  import('../shared/broker.js').then(({ Broker }) => {
    const broker = new Broker();
    createOrderService({ broker, port: process.env.PORT ? Number(process.env.PORT) : 8080 });
  });
}
