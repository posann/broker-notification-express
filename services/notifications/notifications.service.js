import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, 'data', 'processed_notifications.json');

/**
 * Ensure that the notification store file exists.
 * If not, create an empty JSON array at `processed_notifications.json`.
 *
 * Memastikan file penyimpanan notifikasi ada.
 * Jika tidak ada, buat file JSON kosong di `processed_notifications.json`.
 */
async function ensureStore() {
  try {
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.access(STORE);
  } catch {
    await fs.writeFile(STORE, JSON.stringify([]));
  }
}

/**
 * Load already processed notifications from file into a Set.
 * Each entry is identified by `orderId::itemId`.
 *
 * Memuat notifikasi yang sudah diproses dari file ke dalam Set.
 * Setiap entry diidentifikasi dengan `orderId::itemId`.
 *
 * @returns {Promise<Set<string>>} set of processed notifications / kumpulan notifikasi yang sudah diproses
 */
async function loadProcessed() {
  await ensureStore();
  const raw = await fs.readFile(STORE, 'utf-8');
  return new Set(JSON.parse(raw));
}

/**
 * Save processed notifications Set back to file.
 *
 * Menyimpan kembali Set notifikasi yang sudah diproses ke file.
 *
 * @param {Set<string>} set - processed notifications / notifikasi yang sudah diproses
 */
async function saveProcessed(set) {
  await fs.writeFile(STORE, JSON.stringify(Array.from(set)));
}

/**
 * Create Notification Service.
 * It subscribes to `order.created` events via broker (if provided),
 * or falls back to reading `outbox.json` once if no broker is available.
 *
 * Membuat Notification Service.
 * Service ini akan subscribe ke event `order.created` via broker (jika ada),
 * atau fallback membaca `outbox.json` sekali jika broker tidak tersedia.
 *
 * @param {Object} [options]
 * @param {import('../shared/broker.js').Broker} [options.broker] - event broker (optional) / broker event (opsional)
 * @returns {{ processEvent: function(Object): Promise<void> }}
 */
export function createNotificationService({ broker } = {}) {
  /**
   * Process a single `order.created` event.
   * Logs notification per itemId and stores it in processed_notifications.json
   * to avoid duplicate notifications.
   *
   * Memproses satu event `order.created`.
   * Mencetak notifikasi per itemId dan menyimpannya di processed_notifications.json
   * agar tidak terjadi duplikasi.
   *
   * @param {Object} event - event payload / payload event
   */
  const processEvent = async (event) => {
    if (!event || !event.orderId || !Array.isArray(event.itemId)) return;
    const processed = await loadProcessed();
    for (const item of event.itemId) {
      const key = `${item}::${event.orderId}`;
      if (processed.has(key)) continue;
      console.log(`🔔 notification.sent orderId=${event.orderId} itemId=${item}`);
      processed.add(key);
    }
    await saveProcessed(processed);
  };

  /**
   * Subscribe to broker if available, otherwise fallback to outbox.json.
   *
   * Subscribe ke broker jika tersedia, jika tidak fallback baca outbox.json.
   */
  if (broker && typeof broker.on === 'function') {
    broker.on('order.created', (event) => {
      setImmediate(() => processEvent(event));
    });
  } else {
    (async () => {
      const outbox = path.join(__dirname, '..', 'orders', 'data', 'outbox.json');
      try {
        const raw = await fs.readFile(outbox, 'utf-8');
        const arr = JSON.parse(raw);
        for (const ev of arr) await processEvent(ev);
      } catch {}
    })();
  }

  return { processEvent };
}

/**
 * CLI runner (if executed directly).
 * When running `node notifications.service.js`, it starts service with a local broker.
 *
 * Runner CLI (jika dijalankan langsung).
 * Saat menjalankan `node notifications.service.js`, service akan jalan dengan broker lokal.
 */
if (process.argv[1] && process.argv[1].endsWith('notifications.service.js')) {
  const { Broker } = await import('../shared/broker.js');
  const broker = new Broker();
  createNotificationService({ broker });
}
