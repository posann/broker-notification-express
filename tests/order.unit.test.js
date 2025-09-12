import { expect } from 'chai';
import { createOrderService } from '../services/orders/orders.service.js';
import { Broker } from '../services/shared/broker.js';
import supertest from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ordersStore = path.join(__dirname, '..', 'services', 'orders', 'data', 'orders.json');

describe('Order Service - validation & idempotency', () => {
  let server, app, broker;

  before(() => {
    broker = new Broker();
    const s = createOrderService({ broker, port: 0 });
    app = s.app;
    server = s.server;
  });

  after(() => server && server.close());

  // reset file orders.json sebelum setiap test
  beforeEach(async () => {
    await fs.writeFile(ordersStore, JSON.stringify([]));
  });

  it('rejects empty itemId', async () => {
    const res = await supertest(app).post('/orders').send({ itemId: [] });
    expect(res.status).to.equal(400);
    expect(res.body.error).to.match(/itemId/);
  });

  it('accepts order and returns orderId', async () => {
    const res = await supertest(app).post('/orders').send({ itemId: ['a'] });
    expect(res.status).to.equal(202);
    expect(res.body.orderId).to.be.a('string');
  });

  it('returns 409 for duplicate orderId', async () => {
    const orderId = 'test-dup-id-123';

    // pertama kali harus diterima
    const res1 = await supertest(app).post('/orders').send({ orderId, itemId: ['x'] });
    expect(res1.status).to.equal(202);

    // kedua kali harus ditolak
    const res2 = await supertest(app).post('/orders').send({ orderId, itemId: ['x'] });
    expect(res2.status).to.equal(409);
  });
});
