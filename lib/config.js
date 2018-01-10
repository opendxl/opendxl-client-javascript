'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var Broker = require('./broker')
var DxlError = require('./dxl_error')
var MalformedBrokerError = require('./malformed_broker_error')
var util = require('./util')

var DEFAULT_MQTT_KEEP_ALIVE_INTERVAL = 30 * 60 // seconds
var DEFAULT_RECONNECT_DELAY = 1 // seconds

/**
 * Get the value for a setting from a configuration file.
 * @private
 * @param {Object} config - Object representation of a config file where each
 *   key corresponds to a section or setting name and each value corresponds
 *   to the contents of the section or the value for a setting, respectively.
 * @param {String} section - Name of the configuration section in which the
 *   setting resides.
 * @param {String} setting - Name of the setting whose value should be
 *   obtained.
 * @param {Boolean} [required=true] - Whether or not the setting is required
 *   to exist in the configuration file. If _true_ and the setting cannot be
 *   found, a {@link DxlError} is thrown.
 * @param {Boolean} [readFromFile=false] - Whether or not to try to treat the
 *   value of setting as a file whose contents should be read and returned as
 *   the value for the setting.
 * @param {String} [configPath=null] - Directory path in which the
 *   configuration file should reside.
 * @returns {Object} Value for the setting.
 * @throws {DxlError} If the setting is required but cannot be found or if
 *   the value should be read from a file but a problem occurs in reading
 *   the file - for example, if the file cannot be found.
 */
function getSetting (config, section, setting, required, readFromFile,
                     configPath) {
  if (typeof (required) === 'undefined') { required = true }
  if (typeof (configPath) === 'undefined') { configPath = null }

  if (!config[section]) {
    if (required) {
      throw new DxlError('Required section not found in config: ' +
        section)
    } else {
      return null
    }
  }

  if (!config[section][setting]) {
    if (required) {
      throw new DxlError('Required setting not found in config: ' +
        setting)
    } else {
      return null
    }
  }

  var value = config[section][setting]

  if (readFromFile) {
    var fileToRead = value
    // If the file cannot be found but is expressed as a relative path, try to
    // find the file relative to directory in which the configuration file
    // resides.
    if (!fs.existsSync(value) && !path.isAbsolute(value) &&
      (typeof (configPath) !== 'undefined') && configPath) {
      fileToRead = path.join(configPath, value)
    }
    if (fs.existsSync(fileToRead)) {
      try {
        value = fs.readFileSync(fileToRead)
      } catch (err) {
        throw new DxlError('Unable to read file for ' + setting + ': ' +
          err.message)
      }
    } else {
      throw new DxlError('Unable to locate file for ' + setting +
        ': ' + value)
    }
  }

  return value
}

/**
 * The Data Exchange Layer (DXL) client configuration contains the information
 * necessary to connect a {@link Client} to the DXL fabric.
 *
 * The configuration includes the required PKI information (client certificate,
 * client private key, broker CA certificates) and the set of DXL message
 * brokers that are available to connect to on the fabric.
 * @example
 * var dxl = require('@opendxl/dxl-client')
 * var fs = require('fs')
 * var config = new dxl.Config(
 *   fs.readFileSync('c:\\certs\\brokercerts.crt'),
 *   fs.readFileSync('c:\\certs\\client.crt'),
 *   fs.readFileSync('c:\\certs\\client.key'),
 *   [dxl.Broker.parse('ssl://192.168.99.100')])
 *
 * var client = new dxl.Client(config)
 * client.connect()
 * @param {String} brokerCaBundle - The bundle containing the broker CA
 *   certificates in PEM format.
 * @param {String} cert - The client certificate in PEM format.
 * @param {String} privateKey - The client private key in PEM format.
 * @param {Array<Broker>} brokers - An array of {@link Broker} objects
 *   representing brokers comprising the DXL fabric.
 * @constructor
 */
function Config (brokerCaBundle, cert, privateKey, brokers) {
  /**
   * The bundle containing the broker CA certificates in PEM format.
   * @type {String}
   * @name Config#brokerCaBundle
   */
  this.brokerCaBundle = brokerCaBundle
  /**
   * The client certificate in PEM format.
   * @type {String}
   * @name Config#cert
   */
  this.cert = cert
  /**
   * The client private key in PEM format.
   * @type {String}
   * @name Config#privateKey
   */
  this.privateKey = privateKey
  /**
   * An array of {@link Broker} objects representing brokers comprising the
   * DXL fabric.
   * @type {Array<Broker>}
   * @name Config#brokers
   */
  this.brokers = brokers
  /**
   * The delay between retry attempts in seconds.
   * @type {Number}
   * @default 1
   * @name Config#reconnectDelay
   */
  this.reconnectDelay = DEFAULT_RECONNECT_DELAY
  /**
   * The maximum period in seconds between communications with a connected
   * {@link Broker}. If no other messages are being exchanged, this controls
   * the rate at which the client will send ping messages to the
   * {@link Broker}.
   * @type {number}
   * @default 1800
   * @name Config#keepAliveInterval
   */
  this.keepAliveInterval = DEFAULT_MQTT_KEEP_ALIVE_INTERVAL
  /**
   * The unique identifier of the client
   * @private
   * @type {String}
   * @name Config#_clientId
   */
  this._clientId = util.generateIdAsString()
}

/**
 * This method allows creation of a {@link Config} object from a specified
 * configuration file. The information contained in the file has a one-to-one
 * correspondence with the {@link Config} constructor.
 * ```ini
 * [Certs]
 * BrokerCertChain=c:\\\\certs\\\\brokercerts.crt
 * CertFile=c:\\\\certs\\\\client.crt
 * PrivateKey=c:\\\\certs\\\\client.key
 *
 * [Brokers]
 * mybroker=mybroker;8883;mybroker.mcafee.com;192.168.1.12
 * mybroker2=mybroker2;8883;mybroker2.mcafee.com;192.168.1.13
 * ```
 * @example
 * var config = dxl.Config.createDxlConfigFromFile(c:\\certs\\dxlclient.config)
 * @param {String} configFile - Path to the configuration file
 * @returns {Config} A {@link Config} object corresponding to the specified
 *   configuration file.
 * @throws {DxlError} If an error is encountered when attempting to read
 *   the configuration file.
 * @throws {MalformedBrokerError} If one or more of the entries in the broker
 *   section of the configuration is invalid.
 */
Config.createDxlConfigFromFile = function (configFile) {
  var configData
  try {
    configData = fs.readFileSync(configFile, 'utf-8')
  } catch (err) {
    throw new DxlError('Unable to read config file: ' + err.message)
  }

  var lines = configData.split(/[\r\n]+/g)
  // The ini parser treats ';' and '#' characters in the middle of a line
  // as the beginning of a comment and trims the rest off when parsing.
  // For any lines that don't start with either of these characters, though,
  // we do not want to interpret these as comments - especially for the
  // value of a broker config entry, which is internally delimited with
  // ';' characters. The logic below ensures that these characters are
  // escaped so that the ini parser preserves them.
  var escapedLines = lines.map(function (line) {
    if (line && !line.match(/^\s*[;#]/)) {
      line = line.replace(/;/g, '\\;').replace(/#/g, '\\#')
    }
    return line
  })
  var escapedConfigData = escapedLines.join('\n')

  var parsedConfig
  try {
    parsedConfig = ini.parse(escapedConfigData)
  } catch (err) {
    throw new DxlError('Unable to parse config file: ' + err.message)
  }

  var configPath = path.dirname(configFile)

  var brokerCaBundle = getSetting(parsedConfig, 'Certs', 'BrokerCertChain',
    true, true, configPath)
  var cert = getSetting(parsedConfig, 'Certs', 'CertFile', true, true,
    configPath)
  var privateKey = getSetting(parsedConfig, 'Certs', 'PrivateKey', true, true,
    configPath)

  var brokers = []
  if (parsedConfig.hasOwnProperty('Brokers')) {
    brokers = Object.keys(parsedConfig.Brokers).map(function (brokerKey) {
      var brokerInfo = getSetting(parsedConfig, 'Brokers', brokerKey, true)
      if (typeof brokerInfo !== 'string') {
        throw new MalformedBrokerError(
          'Config broker section has incomplete entries')
      }
      var brokerElements = brokerInfo.split(';')
      if (brokerElements.length < 2) {
        throw new MalformedBrokerError(
          'Missing elements in config broker line: ' + brokerInfo)
      }

      var portPosition = 0
      try {
        util._toPortNumber(brokerElements[0])
      } catch (err) {
        portPosition = 1
      }

      var id = portPosition ? brokerElements[0] : null
      var port = brokerElements[portPosition]
      var hosts = brokerElements.slice(portPosition + 1)
      return new Broker(hosts, id, port)
    })
  }

  var config = new Config(brokerCaBundle, cert, privateKey, brokers)
  var clientId = getSetting(parsedConfig, 'General', 'ClientId', false)
  if (clientId) {
    config._clientId = clientId
  }
  return config
}

module.exports = Config
