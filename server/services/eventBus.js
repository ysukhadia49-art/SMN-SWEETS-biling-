const EventEmitter = require('events');

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Broadcast an event across all connected SSE clients and local listeners
   * @param {string} type Event type (e.g. 'BILL_CREATED', 'PAYMENT_CONFIRMED', 'CUSTOMER_UPDATED', 'PRODUCT_UPDATED', 'SMS_UPDATED', 'SETTINGS_UPDATED')
   * @param {Object} payload Event data payload
   */
  broadcast(type, payload = {}) {
    const event = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    this.emit('app_event', event);
  }
}

const eventBus = new AppEventBus();

module.exports = eventBus;

