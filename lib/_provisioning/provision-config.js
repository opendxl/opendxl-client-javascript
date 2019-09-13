/**
 * @module ProvisionConfig
 * @private
 */

'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var DxlError = require('../dxl-error')
var pki = require('./pki')
var provisionUtil = require('./provision-util')
var ManagementService = require('./management-service')

var DEFAULT_BROKER_CERT_CHAIN_FILE_NAME = 'ca-bundle.crt'
var PROVISION_COMMAND = 'DxlBrokerMgmt.generateOpenDXLClientProvisioningPackageCmd'

/**
 * Gets the provision configuration from the management service.
 * @param {ManagementService} managementService - The management service
 *   instance.
 * @param {String} csr - The CSR string to send to the management service for
 *   signing.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} callback - Callback to invoke with the configuration
 *   retrieved from the management service.
 * @private
 */
function requestProvisionConfig (managementService, csr, verbosity, callback) {
  managementService.request('Requesting client certificate', PROVISION_COMMAND,
    {csrString: csr}, verbosity, callback)
}

/**
 * Converts the broker lines received from the management service into an
 * object which can be used for rewriting the full configuration ini file.
 * @param {Array<String>} brokerLines - List of broker lines.
 * @example For a value of "id1=id1;host1;8883;127.0.0.1\nid2=id2;host2;8883;127.0.0.2",
 *   this function would return an object with keys named 'id1' and 'id2' with
 *   corresponding values of 'id1;host1;8883;127.0.0.1' and
 *   'id2;host2;8883;127.0.0.2'.
 * @returns {Object} Object representation of the broker lines.
 * @private
 */
function brokersForConfig (brokerLines) {
  return brokerLines.reduce(function (acc, brokerLine) {
    var brokerElements = brokerLine.split('=')
    if (brokerElements.length !== 2) {
      throw new DxlError('Invalid key value pair for broker entry: ' +
        brokerLine)
    }
    acc[brokerElements[0]] = brokerElements[1]
    return acc
  }, {})
}

/**
 * Store the configuration data received from the management service to the
 * local file system.
 * @param {String} config - Configuration data received from the management
 *   service.
 * @param {String} configDir - Directory in which to store the configuration
 *   data.
 * @param {String} filePrefix - Prefix of the certificate file to store.
 * @param {String} privateKeyFileName - Name of the private key file to
 *   include in the stored configuration file.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Boolean} useWebSockets Whether or not the client will use WebSockets.
 *   If false MQTT over tcp will be used.
 *   If only WebSocket brokers are specified this will default to true.
 * @private
 */
function storeProvisionConfig (config, configDir, filePrefix,
                               privateKeyFileName, verbosity, useWebSockets) {
  if (typeof config !== 'string') {
    throw new DxlError('Unexpected data type for response: ' +
      typeof config)
  }
  var configElements = config.split(',')
  if (configElements.length < 3) {
    throw new DxlError('Did not receive expected number of response ' +
      'elements. Expected: 3, Received: ' + configElements.length +
      '. Value: ' + config)
  }

  var brokerLines = configElements[2].split(
    /[\r\n]+/).filter(function (brokerLine) {
      return brokerLine.length > 0
    }
  )

  var brokers = brokersForConfig(brokerLines)

  var brokerWSLines = []
  if (configElements[3]) {
    brokerWSLines = configElements[3].split(
      /[\r\n]+/).filter(function (brokerWSLine) {
        return brokerWSLine.length > 0
      }
    )
  }

  var brokersWS = brokersForConfig(brokerWSLines)
  var webSocketsEnabled = typeof useWebSockets !== 'undefined' ? useWebSockets : false
  var certFileName = filePrefix + '.crt'
  var configString = ini.encode({
    General: {
      UseWebSockets: webSocketsEnabled
    },
    Certs: {
      BrokerCertChain: DEFAULT_BROKER_CERT_CHAIN_FILE_NAME,
      CertFile: path.basename(certFileName),
      PrivateKey: path.basename(privateKeyFileName)
    },
    Brokers: brokerLines.length ? brokers : { marker: 1 },
    BrokersWebSockets: brokerWSLines.length ? brokersWS : { marker: 1 }
  }).replace(/\\;/g, ';')

  // ini.js does not support empty sections , using marker and replacing it
  if (configString.includes('marker=1')) {
    configString = configString.replace(/marker=1(\r\n|\n)/g, '')
  }

  if (!webSocketsEnabled) {
    // UseWebSockets property is commented out by default
    configString = configString.replace('UseWebSockets', '#UseWebSockets')
  }

  var configFileName = path.join(configDir,
    provisionUtil.DEFAULT_CONFIG_FILE_NAME)
  if (verbosity) {
    console.log('Saving DXL config file to ' + configFileName)
  }
  provisionUtil.saveToFile(configFileName, configString)

  var caBundleFileName = path.join(configDir,
    DEFAULT_BROKER_CERT_CHAIN_FILE_NAME)
  if (verbosity) {
    console.log('Saving ca bundle file to ' + caBundleFileName)
  }
  provisionUtil.saveToFile(caBundleFileName, configElements[0])

  var fullCertFileName = path.join(configDir, certFileName)
  if (verbosity) {
    console.log('Saving client certificate file to ' + fullCertFileName)
  }
  provisionUtil.saveToFile(fullCertFileName, configElements[1])
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
 *   management server. The HTTP response payload for this request should look
 *   like the following:
 *
 *   OK:
 *   "[ca bundle],[signed client cert],[broker config]"
 *
 *   Sections of the response include:
 *
 *   * A line with the text "OK:" if the request was successful, else "ERROR
 *     [code]:" on failure.
 *   * A JSON-encoded string with a double-quote character at
 *     the beginning and end and with the following parts, comma-delimited:
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
 * @param {ManagementServiceHostInfo} hostInfo - Info for the management service
 *   host.
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
 * @param {Number} [options.verbosity] - Level of verbosity at which to log any
 *   error or trace messages.
 * @param {Function} [options.doneCallback] - Callback to invoke once the
 *   provisioned configuration has been stored. If an error occurs, the first
 *   parameter supplied to the `doneCallback` is an `Error` instance
 *   containing failure details.
 *  @param {Boolean} [useWebSockets] Whether or not the client will use WebSockets.
 *    If false MQTT over tcp will be used.
 *    If only WebSocket brokers are specified this will default to true.
 * @private
 */
module.exports = function provisionConfig (configDir, commonOrCsrFileName,
                                           hostInfo, options, useWebSockets) {
  if (!configDir) {
    throw new TypeError('configDir is required for provisioning')
  }

  if (!commonOrCsrFileName) {
    throw new TypeError('commonOrCsrFileName is required for provisioning')
  }

  options = options || {}
  var doneCallback = options.doneCallback
  var verbosity = options.verbosity || 0

  options.doneCallback = function (error, privateKeyFileName, csrFileName) {
    if (error) {
      provisionUtil.invokeCallback(error, doneCallback, verbosity)
    } else {
      var service = new ManagementService(hostInfo)

      var csr
      try {
        csr = fs.readFileSync(csrFileName)
      } catch (err) {
        provisionUtil.invokeCallback(error, doneCallback, verbosity)
        return
      }

      requestProvisionConfig(service, csr, verbosity,
        function (error, config) {
          if (config) {
            try {
              storeProvisionConfig(config, configDir,
                options.filePrefix || pki.DEFAULT_PKI_FILE_PREFIX,
                privateKeyFileName, verbosity, useWebSockets)
            } catch (err) {
              error = err
            }
          } else {
            if (error) {
              console.log('Error from server' + error)
            }
            console.log('No data from Server.Check Server Configuration')
          }
          provisionUtil.invokeCallback(error, doneCallback, verbosity)
        }
      )
    }
  }

  pki.generatePrivateKeyAndCsr(configDir, commonOrCsrFileName, options)
}
