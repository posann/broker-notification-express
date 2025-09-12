import EventEmitter from 'events';

export class Broker extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }
  /**
   * Publishes an event to the given topic.
   *
   * @param {string} topic - the topic to publish to
   * @param {*} event - the event to publish
   *
   * @returns {Promise<void>}
   */
  async publish(topic, event) {
    setImmediate(() => this.emit(topic, event));
  }
}
