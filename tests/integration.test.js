import { expect } from 'chai';
import { Broker } from '../services/shared/broker.js';
import { createOrderService } from '../services/orders/orders.service.js';
import { createNotificationService } from '../services/notifications/notifications.service.js';
import supertest from 'supertest';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const notifStore = path.join(
  __dirname,
  '..',
  'services',
  'notifications',
  'data',
  'processed_notifications.json'
);

describe('Integration: order -> notification', function() {
  let order, broker;

  before(async function() {
    broker = new Broker();
    order = createOrderService({ broker, port: 3001 });
    createNotificationService({ broker });
    await new Promise(resolve => order.server.on('listening', resolve));
  });

  after(function() {
    order && order.server && order.server.close();
  });

  beforeEach(async () => {
    // reset notification store sebelum test
    await fs.writeFile(notifStore, JSON.stringify([]));
  });

  it('publishes event and notification service logs per item', async function() {
    const res = await supertest(order.app)
      .post('/orders')
      .send({ itemId: ['itemA', 'itemB'] });

    expect(res.status).to.equal(202);

    // tunggu lebih lama agar event diproses
    await new Promise(r => setTimeout(r, 500));

    let content = [];
    try {
      content = JSON.parse(await fs.readFile(notifStore, 'utf-8'));
    } catch {
      content = [];
    }

    const matches = content.filter(x => x.includes(res.body.orderId));
    expect(matches.length).to.equal(2);
  });
});
