'use strict'

/**
 * @classdesc Proxy information for WebSockets Connection (Optional)
 * @param {String} address - The proxy IP address or host
 * @param {Integer} port - The proxy port
 * @param {String} user - The proxy user (optional)
 * @param {String} password - The proxy password. Required if user is specified
 * @augments Message
 * @constructor
 */
function Proxy (address, port, user, password) {
  /**
   * The Proxy IP address or host name
   * @type {String}
   * @name Proxy#address
   */
  this.address = address
  /**
   * The Proxy port
   * @type {Integer}
   * @name Proxy#port
   */
  this.port = port
  /**
   * The Proxy user
   * @type {String}
   * @name Proxy#user
   */
  this.user = user
  /**
   * The Proxy password
   * @type {String}
   * @name Proxy#password
   */
  this.password = password
}
module.exports = Proxy
