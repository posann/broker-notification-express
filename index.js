// index.js
import { Broker } from './services/shared/broker.js';
import { createOrderService } from './services/orders/orders.service.js';
import { createNotificationService } from './services/notifications/notifications.service.js';

// bikin satu broker in-memory yang dishare
const broker = new Broker();

// start Order Service di port 8080
createOrderService({ broker, port: 8080 });

// start Notification Service (subscriber broker)
createNotificationService({ broker });

console.log('Services started:');
console.log('- Order Service: http://localhost:8080/orders');
console.log('- Notification Service: listening via broker');
