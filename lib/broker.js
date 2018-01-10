'use strict'

var MalformedBrokerError = require('./malformed_broker_error')
var util = require('./util')

var SSL_PORT = 8883
var SSL_PROTOCOL = 'ssl'

/**
 * Return an integer representation of the port value represented by the
 * _text_ parameter.
 * @private
 * @param {(String|Number)} text - The port value to convert.
 * @returns {Number} The port value.
 * @throws {MalformedBrokerError} If _text_ does not contain a valid port - for
 *   example, not in the well-known IANA TCP port range (1 - 65535) or cannot
 *   be converted to a numeric value.
 */
function portAsInteger (text) {
  try {
    return util._toPortNumber(text)
  } catch (err) {
    throw new MalformedBrokerError('Invalid broker port number: ' +
      err.message)
  }
}

/**
 * @classdesc Represents a DXL message broker. Instances of this class are
 * created for the purpose of connecting to the DXL fabric.
 *
 * There are several ways to create broker instances:
 *
 * * Invoking the {@link Broker} constructor directly
 * * Passing a properly formatted string to the {@link Broker.parse} method
 * * When creating a {@link Config} object via the
 *   {@link Config.createDxlConfigFromFile} method
 * @param {Array<string>|String} hosts - A single (or array of) host name /
 *   IP address string(s)
 * @param {String} [uniqueId=null] - An optional unique identifier for the
 *   broker, used to identify the broker in log messages, etc.
 * @param {Number|String} [port=8883] - The port of the broker.
 * @throws {MalformedBrokerError} If the _port_ is not valid - for example,
 *   not in the well-known IANA TCP port range (1 - 65535) or cannot be
 *   converted to a numeric value.
 * @constructor
 */
function Broker (hosts, uniqueId, port) {
  /**
   * Array of host name / IP address string(s)
   * @name Broker#hosts
   * @type Array<String>
   */
  this.hosts = (typeof hosts === 'string') ? [hosts] : hosts
  /**
   * A unique identifier for the broker, used to identify the broker in log
   * messages, etc.
   * @name Broker#uniqueId
   * @type String
   */
  this.uniqueId = (typeof uniqueId === 'undefined') ? null : uniqueId
  /**
   * The port of the broker
   * @name Broker#port
   * @type Number
   */
  this.port = (typeof port === 'undefined') ? SSL_PORT : portAsInteger(port)
}

/**
 * Returns a broker instance corresponding to the specified broker URL of the
 * form: _[ssl://]&lt;hostname&gt;[:port]_.
 *
 * Valid URLs include:
 * * ssl://mybroker:8883
 * * ssl://mybroker
 * * mybroker:8883
 * * mybroker
 * @param {String} brokerUrl - A valid broker URL.
 * @returns {Broker} A broker corresponding to the specified broker URL.
 * @throws {MalformedBrokerError} If the _brokerUrl_ is not properly formatted.
 */
Broker.parse = function (brokerUrl) {
  var hostName = brokerUrl
  var protocol = SSL_PROTOCOL
  var port = SSL_PORT

  var urlElements = brokerUrl.split('://')
  if (urlElements.length === 2) {
    protocol = urlElements[0]
    hostName = urlElements[1]
  }

  if (hostName.slice(-1) !== ']') {
    var hostNameParts = hostName.match(/(.*):(.*)/)
    if (hostNameParts) {
      hostName = hostNameParts[1]
      port = hostNameParts[2]
    }
  }

  if (protocol !== SSL_PROTOCOL) {
    throw new MalformedBrokerError('Unknown protocol: ' + protocol)
  }

  return new Broker(hostName.replace(/[[\]]/g, ''),
      util.generateIdAsString(), port)
}

module.exports = Broker
