'use strict'

var fs = require('fs')
var path = require('path')
var Broker = require('./broker')
var DxlError = require('./dxl-error')
var MalformedBrokerError = require('./malformed-broker-error')
var util = require('./util')
var provisionConfig = require('./_provisioning/provision-config')
var Proxy = require('./proxy')

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

  if (config[section][setting] === null || typeof (config[section][setting]) === 'undefined') {
    if (required) {
      throw new DxlError('Required setting not found in config: ' +
        setting)
    } else {
      return null
    }
  }

  var value = config[section][setting]

  if (readFromFile) {
    var fileToRead = util.getConfigFilePath(configPath, value)
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
 * Parse the broker list from the config {@link Config} object
 * Sample Section
 * [Brokers]
 * mybroker=mybroker;8883;mybroker.mcafee.com;192.168.1.12
 * mybroker2=mybroker2;8883;mybroker2.mcafee.com;192.168.1.13
 * ```
 * @private
 * @param {String} parsedConfig - Configuration settings from the configuration file
 * @param {String} brokerList - List of brokers (mqtt or websocket brokers)
 * @param {section} section - Section (mqtt or websocket) section to parse
 * @returns {Array<Broker>} brokers An array of {@link Broker} objects
 *   representing brokers on the DXL fabric
 * @throws {MalformedBrokerError} If one or more of the entries in the broker
 *   section of the configuration is invalid.
 */
function parseBrokerString (parsedConfig, brokerList, section) {
  return Object.keys(brokerList).map(function (brokerKey) {
    var brokerInfo = getSetting(parsedConfig, section, brokerKey, true)
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
      util.toPortNumber(brokerElements[0])
    } catch (err) {
      portPosition = 1
    }

    var id = portPosition ? brokerElements[0] : null
    var port = brokerElements[portPosition]
    var hosts = brokerElements.slice(portPosition + 1)
    return new Broker(hosts, id, port)
  })
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
 * @param {Array<Broker>} webSocketBrokers - An array of {@link Broker} objects
 *   representing brokers on the DXL fabric supporting DXL connections over WebSockets.
 * @param {Boolean} useWebSockets - If true and webSocketBrokers are defined,
 * client will attempt to connect over WebSockets.
 * @param {proxy} proxy Information- If non null the proxy settings will be used. This is for
 * WebSocket connections only.
 * @constructor
 */
function Config (brokerCaBundle, cert, privateKey, brokers, webSocketBrokers, useWebSockets, proxy) {
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
   * An array of {@link Broker} objects representing mqtt brokers comprising the
   * DXL fabric.
   * @private
   * @type {Array<Broker>}
   * @name Config#_brokers
   */
  this._brokers = brokers
  /**
   * An array of {@link Broker} objects representing WebSocket brokers comprising the
   * DXL fabric
   * @private
   * @type {Array<Broker>}
   * @name Config#_webSocketBrokers
   */
  this._webSocketBrokers = webSocketBrokers
  /**
   * An array of {@link Broker} objects representing brokers comprising the
   * DXL fabric. This could be webSockets brokers depending on configuration
   * @type {Array<Broker>}
   * @name Config#brokers
   */
  this.brokers = useWebSockets ? this._webSocketBrokers : this._brokers
  /**
   * Flag to use websocketBrokers if defined in the config
   * @type {String}
   * @name Config#useWebSockets
   */
  this.useWebSockets = useWebSockets
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
  /**
   * The proxy information for the Connection via WebSockets only
   * @type {Proxy}
   * @name Config#_proxy
   */
  this.proxy = proxy
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
  var parsedConfig = util.getConfigFileAsObject(configFile)
  var configPath = path.dirname(configFile)

  var brokerCaBundle = getSetting(parsedConfig, 'Certs', 'BrokerCertChain',
    true, true, configPath)
  var cert = getSetting(parsedConfig, 'Certs', 'CertFile', true, true,
    configPath)
  var privateKey = getSetting(parsedConfig, 'Certs', 'PrivateKey', true, true,
    configPath)

  // parse MQTT broker list
  var brokers = []
  if (parsedConfig.hasOwnProperty('Brokers')) {
    brokers = parseBrokerString(parsedConfig, parsedConfig.Brokers, 'Brokers')
  }

  // parse WebSockets broker list
  var webSocketBrokers = []
  if (parsedConfig.hasOwnProperty('BrokersWebSockets')) {
    webSocketBrokers = parseBrokerString(parsedConfig, parsedConfig.BrokersWebSockets, 'BrokersWebSockets')
  }

  var useWebSocketBrokers = getSetting(parsedConfig, 'General', 'UseWebSockets', false)

  // read proxy settings from config file if present
  var proxyAddress = getSetting(parsedConfig, 'Proxy', 'Address', false)
  var proxy = null
  if (proxyAddress) {
    var port = util.toPortNumber(getSetting(parsedConfig, 'Proxy', 'Port', true))
    var user = getSetting(parsedConfig, 'Proxy', 'User', false)
    var password
    if (user) {
      password = getSetting(parsedConfig, 'Proxy', 'Password', true)
    }
    proxy = new Proxy(proxyAddress, port, user, password)
  }
  // check for non boolean values 'True' is non boolean
  if (useWebSocketBrokers != null && typeof useWebSocketBrokers !== 'boolean') {
    useWebSocketBrokers = useWebSocketBrokers.toLowerCase() === 'true'
  }
  // If false MQTT over tcp will be used. If only WebSocket brokers are specified this will default to true.
  if (useWebSocketBrokers == null || !useWebSocketBrokers) {
    useWebSocketBrokers = webSocketBrokers.length > 0 && brokers.length <= 0
  }

  var config = new Config(brokerCaBundle, cert, privateKey, brokers, webSocketBrokers, useWebSocketBrokers, proxy)
  var clientId = getSetting(parsedConfig, 'General', 'ClientId', false)
  if (clientId) {
    config._clientId = clientId
  }
  return config
}

/**
 * Provisions a DXL client by performing the following steps:
 *
 * * Either generates a certificate signing request and private key, storing
 *   each to a file (the default), or reads the certificate signing request
 *   from a file (if the `certRequestFile` property under the `options` object
 *   is present and has a truthy value).
 *
 * * Sends the certificate signing request to a signing endpoint on a
 *   management server. If the request is successfully authenticated and
 *   authorized, the management server is expected to respond with the following
 *   data:
 *
 *     * [ca bundle] - a concatenation of one or more PEM-encoded CA
 *       certificates
 *     * [signed client cert] - a PEM-encoded certificate signed from the
 *       certificate request
 *     * [broker config] - zero or more lines, each delimited by a line feed
 *       character, for each of the brokers known to the management service.
 *       Each line contains a key and value, delimited by an equal sign. The
 *       key contains a broker guid. The value contains other metadata for the
 *       broker, e.g., the broker guid, port, hostname, and ip address. For
 *       example: "[guid1]=[guid1];8883;broker;10.10.1.1\n[guid2]=[guid2]...".
 *
 * * Saves the [ca bundle] and [signed client cert] to separate files.
 * * Creates a "dxlclient.config" file with the following sections:
 *
 *   * A "Certs" section with certificate configuration which refers to the
 *     locations of the private key, ca bundle, and certificate files.
 *   * A "Brokers" section with the content of the [broker config] provided
 *     by the management service.
 * @param {String} configDir - Directory in which to store the configuration
 *   data.
 * @param {String} commonOrCsrFileName - A string representing either
 *   a common name (CN) to add into the generated file or the path to the
 *   location of an existing CSR file. The parameter is interpreted as a path
 *   to an existing CSR file if a property named certRequestFile exists on the
 *   command object and has a truthy value. If the parameter represents a path
 *   to an existing CSR file, this function does not generate a new CSR file.
 * @param {Object} hostInfo - Info for the management service host.
 * @param {String} hostInfo.user - Username to run remote commands as.
 * @param {String} hostInfo.password - Password for the management service user.
 * @param {String} [hostInfo.port=8443] - Port at which the management service
 *   resides.
 * @param {String} [hostInfo.truststore] - Location of a file of CA certificates
 *   to use when verifying the management service's certificate. If no value is
 *   specified, no validation of the management service's certificate is
 *   performed.
 * @param {Object} [options] - Additional options for the provision operation.
 * @param {Boolean} [options.certRequestFile] - If present and truthy,
 *   interprets the commonOrCsrFileName parameter as the name of an existing CSR
 *   file.
 * @param {String} [options.filePrefix=client] - Prefix of the private key, CSR,
 *   and certificate to store.
 * @param {String} [options.opensslbin] - Path to the openssl executable. If not
 *   specified, the function attempts to find the openssl executable from the
 *   environment path.
 * @param {String} [options.passphrase] - Password to use for encrypting the
 *   private key.
 * @param {Array<String>} [options.san] - List of subject alternative names to
 *   add to the CSR.
 * @param {String} [options.country] - Country (C) to use in the CSR's Subject
 *   DN.
 * @param {String} [options.stateOrProvince] - State or province (ST) to use in
 *   the CSR's Subject DN.
 * @param {String} [options.locality] - Locality (L) to use in the CSR's Subject
 *   DN.
 * @param {String} [options.organization] - Organization (O) to use in the CSR's
 *   Subject DN.
 * @param {String} [options.organizationalUnit] - Organizational Unit (OU) to
 *   use in the CSR's Subject DN.
 * @param {String} [options.emailAddress] - E-mail address to use in the CSR's
 *   Subject DN.
 * @param {Function} [options.doneCallback] - Callback to invoke once the
 *   provisioned configuration has been stored. If an error occurs, the first
 *   parameter supplied to the `doneCallback` is an `Error` instance
 *   containing failure details.
 */
Config.provisionConfig = function (configDir, commonOrCsrFileName,
                                   hostInfo, options) {
  provisionConfig(configDir, commonOrCsrFileName, hostInfo, options)
}

module.exports = Config
