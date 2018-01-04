import clone from 'component-clone';
import Emitter from 'component-emitter';
import tabbable from 'tabbable';
import {HostedField} from './hosted-field';
import deepAssign from '../util/deep-assign';
import errors from '../errors';

const debug = require('debug')('recurly:hostedFields');

export const FIELD_TYPES = ['number', 'month', 'year', 'cvv', 'card'];

/**
 * HostedFields
 *
 * @constructor
 * @param {Object} options
 * @param {Object} options.recurly options to init a recurly instance
 * @param {String} options.version
 * @public
 */

export class HostedFields extends Emitter {
  constructor (options) {
    super();
    this.ready = false;
    this.state = {};
    this.fields = [];
    this.errors = [];
    this.initQueue = [];
    this.readyState = 0;
    this.configure(options);
    this.inject();
    this.on('hostedField:tab:previous', this.onTab.bind(this, 'previous'));
    this.on('hostedField:tab:next', this.onTab.bind(this, 'next'));
    this.on('hostedField:state:change', this.update.bind(this));
    this.on('bus:added', bus => {
      this.bus = bus;
      this.fields.forEach(hf => bus.add(hf));
    });
  }

  /**
   * checks integrity of constituent fields
   * optionally compares fields configuration with current state for parity
   *
   * @param {Object} fields fields configuration to compare against
   * @return {Boolean} whether all fields are present and receivable
   */
  integrityCheck (fields) {
    if (!this.ready) return false;
    if (this.fields.length === 0) return false;
    if (fields) {
      const newSelectors = Object.keys(fields).map(key => fields[key].selector).join('');
      const currentSelectors = Object.keys(this.config.recurly.fields).map(key => {
        return this.config.recurly.fields[key].selector
      }).join('');
      if (newSelectors !== currentSelectors) return false;
    }
    return !~this.fields.map(f => f.integrityCheck()).indexOf(false);
  }

  // Private

  configure (options) {
    this.config = clone(options || {});
  }

  inject () {
    this.on('hostedField:ready', this.onReady.bind(this));
    FIELD_TYPES.forEach(type => {
      try {
        this.fields.push(new HostedField(this.fieldConfig(type)));
        this.initQueue.push(type);
      } catch (e) {
        if (e.name === 'missing-hosted-field-target') {
          if (~['number', 'month', 'year', 'card'].indexOf(type)) {
            this.errors.push(e);
          }
        } else {
          throw e;
        }
      }
    });

    // If we have a card hosted field, clear all missing target errors.
    const cardFieldMissingErrorPresent = this.errors.some(e => e.type === 'card');
    if (cardFieldMissingErrorPresent) {
      // If we are only missing the card field, clear the error
      const missingFieldErrors = this.errors.filter(e => e.name === 'missing-hosted-field-target');
      if (missingFieldErrors.length === 1) {
        this.errors = this.errors.filter(e => !(e.name === 'missing-hosted-field-target' && e.type === 'card'));
      }
    } else {
      this.errors = this.errors.filter(e => e.name !== 'missing-hosted-field-target');
    }

    this.on('hostedFields:configure', (options) => {
      this.configure(options);
      this.fields.forEach(field => {
        if (this.bus) this.bus.send('hostedField:configure', this.fieldConfig(field.type));
      });
    });
  }

  reset () {
    this.off();
    this.ready = false;
    this.readyState = 0;
    this.fields.forEach(field => field.reset());
    this.fields = [];
    this.errors = [];
    this.initQueue = [];
  }

  onReady (body) {
    const pos = this.initQueue.indexOf(body.type);
    if (~pos) this.initQueue.splice(pos, 1);
    if (this.initQueue.length === 0) {
      this.off('hostedField:ready', this.onReady);
      this.bus.send('hostedFields:ready');
      this.ready = true;
    }
    this.update(body);
  }

  onTab (direction, message) {
    const origin = this.getFieldByType(message.type);
    let tabbableItems = this.tabbableItems();
    let destination;

    // Find the origin within the tabbable list, and focus in our intended direction
    tabbableItems.forEach((tabbableItem, i) => {
      if (origin instanceof HostedField) {
        if (origin.tabbingProxy == tabbableItem) {
          destination = direction == 'previous' ? tabbableItems[i - 1] : tabbableItems[i + 1];
        }
      }
    });

    if (destination) destination.focus();
  }

  tabbableItems () {
    return tabbable(global.document.body);
  }

  update (body) {
    let newState = Object.assign({}, body);
    delete newState.type;
    this.state[body.type] = newState;
    if (!this.ready) return;
    this.bus.send('hostedFields:state:change', this.state);
  }

  fieldConfig (type) {
    const fields = this.config.recurly.fields;
    if (!fields[type]) return;
    return {
      type,
      selector: fields[type].selector,
      format: fields[type].format || fields.all.format,
      inputType: fields[type].inputType,
      style: deepAssign({}, fields.all.style, fields[type].style),
      recurly: this.config.recurly
    };
  }

  getFieldByType (type) {
    return this.fields.filter(f => f.config.type === type)[0];
  }
}
