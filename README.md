# Multi Power Group - Backend Assessment

## Overview

This project implements a simple microservices setup with:

- **Order Service**: REST API to create and store orders.
- **Notification Service**: Listens for order events and logs notifications.
- **Broker**: In-memory event bus for communication.
- **Outbox**: Events are also written to `outbox.json` to ensure durability (Transactional Outbox Pattern).

Key rules:

- `itemId` must be a non-empty array.
- Duplicate `orderId` is rejected.
- Duplicate `itemId` across all orders is rejected.

---

## Setup

```bash
# Install dependencies
npm install
```

```bash
# Run Broker & Notification
npm start
```

```bash
# Run Individually
npm run start:broker       # Order Service
npm run start:notification # Notification Service
```

## API Usage

### Create Order

POST `http://localhost:8080/orders`

Request body:

```json
{ "itemId": ["itemA", "itemB"] }
```

Success response:

```json
{ "orderId": "uuid-1234" }
```

Duplicate orderId:

```json
{ "error": "duplicate orderId" }
```

Duplicate itemId:

```json
{ "error": "duplicate item(s): itemB" }
```

## Testing

Run automated tests:

```bash
npm test
```

Expected result:

```bash
  Order Service - validation & idempotency
    ✓ rejects empty itemId
    ✓ accepts order and returns orderId
    ✓ returns 409 for duplicate orderId
    ✓ returns 409 for duplicate itemId

  Integration: order -> notification
    ✓ publishes event and notification service logs per item

  5 passing
```
