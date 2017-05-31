import Promise from 'promise';
import {AdyenStrategy} from './index';

const debug = require('debug')('recurly:paypal:strategy:direct');

/**
 * Direct Adyen Checkout strategy
 */
export class DirectStrategy extends AdyenStrategy {
  constructor (...args) {
    super(...args);
    this.emit('ready');
  }

  start (opts) {
    const payload = {
      invoiceUuid: opts.invoiceUuid,
      countryCode: opts.countryCode,
      shopperLocale: opts.shopperLocale,
      currencyCode: opts.currencyCode,
      skinCode: opts.skinCode
    };

    const frame = this.recurly.Frame({ height: 600, path: '/adyen/start', payload });
    frame.once('error', cause => this.error('adyen-error', { cause }));

    frame.once('done', function(token) {
      this.emit('token', token)
    })
  }
}
