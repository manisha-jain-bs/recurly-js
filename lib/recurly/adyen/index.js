import omit from 'lodash.omit';
import Emitter from 'component-emitter';
import {DirectStrategy} from './strategy/direct';
localStorage.debug = '*'
/**
 * Adyen instantiation factory
 *
 * @param {Object} options
 * @return {Adyen}
 */
export function factory (options) {
  options = Object.assign({}, options, { recurly: this });
  return new Adyen(options);
}

const DEFERRED_EVENTS = [
  'ready',
  'token',
  'error'
];

/**
 * Adyen strategy interface
 */
class Adyen extends Emitter {
  constructor (options) {
    super();
    this.isReady = false;
    this.options = options;

    this.once('ready', () => this.isReady = true);
    this.strategy = new DirectStrategy(options);

    this.bindStrategy();
  }

  ready (done) {
    if (this.isReady) done();
    else this.once('ready', done);
  }

  start (...args) {
    return this.strategy.start(...args);
  }

  /**
   * Handles strategy failure scenario
   *
   * @private
   */
  fallback () {
    debug('Initializing strategy fallback');
    this.strategy = new DirectStrategy(omit(this.options, 'braintree'));
    this.bindStrategy();
    this.strategy.ready(() => this.emit('ready'));
  }

  /**
   * Binds external interface events to those on the strategy
   *
   * @private
   */
  bindStrategy () {
    DEFERRED_EVENTS.forEach(ev => this.strategy.on(ev, this.emit.bind(this, ev)));
  }
}
