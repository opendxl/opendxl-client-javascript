/**
 * @module UpdateConfig
 * @private
 */

'use strict'

var path = require('path')
var ManagementService = require('../_provisioning/management-service')
var util = require('../util')
var provisionUtil = require('./provision-util')

var BROKER_CERT_CHAIN_COMMAND = 'DxlClientMgmt.createClientCaBundle'
var BROKER_LIST_COMMAND = 'DxlClientMgmt.getBrokerList'

/**
 * Gets the latest broker certificate chain file from the management service.
 * @param {ManagementService} managementService - The management service
 *   instance.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} callback - Callback function to invoke with the content
 *   of the broker certificate received from the management service.
 * @private
 */
function requestBrokerCertChain (managementService, verbosity, callback) {
  managementService.request('Requesting broker cert chain',
    BROKER_CERT_CHAIN_COMMAND, {}, verbosity, callback)
}

/**
 * Stores a broker certificate chain into a file.
 * @param {String} configDir - Directory in which to store the certificate
 *   chain. This is only used if certChainFile is not an absolute path to
 *   an existing certificate chain file.
 * @param {String} certChainFile - Name of the file at which to store the
 *   broker certificate chain.
 * @param {String} certChain - Broker certificate chain to store.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @private
 */
function updateBrokerCertChain (configDir, certChainFile, certChain, verbosity) {
  var caBundleFileName = util.getConfigFilePath(configDir, certChainFile)
  if (verbosity) {
    console.log('Updating certs in ' + caBundleFileName)
  }
  provisionUtil.saveToFile(caBundleFileName, certChain)
}

/**
 * Gets the latest broker list from the management service.
 * @param {ManagementService} managementService - The management service
 *   instance.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} callback - Callback function to invoke with the content
 *   of the broker list received from the management service.
 * @private
 */
function requestBrokerList (managementService, verbosity, callback) {
  managementService.request('Requesting broker list', BROKER_LIST_COMMAND,
    {}, verbosity, callback)
}

/**
 * Converts the list of brokers received from a call to the getBrokerList
 * endpoint on the management server (JSON objects) into the broker format
 * used in a configuration ini file (key=value pairs).
 * @param {String} brokerListResponse - Response received from the management
 *   service for a request to the getBrokerList endpoint.
 * @returns {Array<String>} A list of broker lines to include in the client
 *   configuration file.
 * @private
 */
function brokerConfigLines (brokerListResponse) {
  var brokers = JSON.parse(brokerListResponse).brokers
  return createMap(brokers)
}

/**
 * Converts the list of WebSocket Brokers received from a call to the getBrokerList
 * endpoint on the management server (JSON objects) into the broker format
 * used in a configuration ini file (key=value pairs).
 * @param {String} brokerListResponse - Response received from the management
 *   service for a request to the getBrokerList endpoint.
 * @returns {Array<String>} A list of WebSocket broker lines to include in the client
 *   configuration file.
 * @private
 */
function brokerWsConfigLines (brokerListResponse) {
  var brokersWs = JSON.parse(brokerListResponse).webSocketBrokers
  return createMap(brokersWs)
}

/**
 * Helper function that converts the list of broker info received from a call to the getBrokerList
 * endpoint on the management server (JSON objects) into the broker format
 * used in a configuration ini file (key=value pairs).
 * @param {String} brokers - ParsedResponse received from the management
 *   service for a request to the getBrokerList endpoint.
 * @returns {Array<String>} A list of broker lines to include in the client
 *   configuration file.
 * @private
 */
function createMap (brokers) {
  if (brokers) {
    return brokers.map(function (broker) {
      return broker.guid + '=' + [broker.guid, broker.port,
        broker.hostName, broker.ipAddress].join(';')
    })
  }
}

/**
 * Updates the broker section in a client configuration file with a list of
 * broker data lines.
 * @param {String} configFileName - Name of the configuration file to update.
 * @param {Array<String>} brokerLines - List of broker data strings to insert
 *  into the configuration file.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {String} section - Section like Brokers or websockets to process
 * @private
 */
function updateBrokerListInConfigFile (configFileName, brokerLines, verbosity, section) {
  var inBrokerSection = false
  var linesAfterBrokerSection = []
  var configFileData = util.getConfigFileData(configFileName)

  // Replace the current contents of the broker section with the new broker
  // lines. Preserve existing content in the file which relates to other
  // sections - for example, the 'Certs' section.
  var newConfigLines = configFileData.lines.reduce(
    function (acc, line) {
      if (line === section) {
        inBrokerSection = true
        acc.push(line)
      } else {
        if (inBrokerSection) {
          // Skip over any existing lines in the broker section since these
          // will be replaced.
          if (line.match(/^\s*($|[;#])/)) {
            // Preserve any empty/comment lines if there is another section
            // after the Broker section. Comments may pertain to the content of
            // the next section.
            linesAfterBrokerSection.push(line)
          } else if (line.match(/^\[.*]$/)) {
            // A section after the broker section has been reached.
            inBrokerSection = false
            Array.prototype.push.apply(acc, brokerLines)
            if (linesAfterBrokerSection.length === 0) {
              newConfigLines.push(configFileData.lineSeparator)
            } else {
              Array.prototype.push.apply(acc,
                linesAfterBrokerSection)
            }
            acc.push(line)
          } else {
            // A broker config entry in the existing file, which will be
            // replaced by the new broker lines, has been encountered. Any
            // prior empty/comment lines which had been stored so far would
            // be between broker config entries. Those lines should be dropped
            // since they might not line up with the new broker list data.
            linesAfterBrokerSection = []
          }
        } else {
          acc.push(line)
        }
      }
      return acc
    }, []
  )

  if (inBrokerSection) {
    Array.prototype.push.apply(newConfigLines, brokerLines)
  }
  // Flatten the broker line array back into a string, delimited using the
  // line separator which appeared to be used in the original config file.
  var newConfig = newConfigLines.join(configFileData.lineSeparator)
  if (inBrokerSection) {
    newConfig += configFileData.lineSeparator
  }

  provisionUtil.saveToFile(configFileName, newConfig)
}

/**
 * Updates the DXL client configuration in the dxlclient.config file,
 * specifically the ca bundle and broker configuration, by performing the
 * following steps:
 *
 * * Sends a request to a management server endpoint for the latest ca bundle
 *   information. The HTTP response payload for this request should look
 *   like the following:
 *
 *   OK:
 *   "[ca bundle]"
 *
 *   Sections of the response include:
 *
 *   * A line with the text "OK:" if the request was successful, else
 *     "ERROR [code]:" on failure.
 *   * A JSON-encoded string with a double-quote character at the beginning
 *     and end. The string contains a concatenation of one or more PEM-encoded
 *     CA certificates.
 *
 * * Saves the [ca bundle] to the file at the location specified in the
 *   "BrokerCertChain" setting in the "Certs" section of the dxlclient.config
 *   file.
 *
 * * Sends a request to a management server endpoint for the latest broker
 *   configuration. The HTTP response payload for this request should look
 *   like the following:
 *
 *   OK:
 *   "[broker config]"
 *
 *   Sections of the response include:
 *
 *   * A line with the text "OK:" if the request was successful, else
 *     "ERROR [code]:" on failure.
 *   * A JSON-encoded string with a double-quote character at the beginning
 *     and end. The string should contain a JSON document which looks similar
 *     to the following:
 *
 *     ```js
 *     {
 *       "brokers": [
 *         {
 *           "guid": "{2c5b107c-7f51-11e7-0ebf-0800271cfa58}",
 *           "hostname": "broker1",
 *           "ipAddress": "10.10.100.100",
 *           "port": 8883
 *         },
 *         {
 *           "guid": "{e90335b2-8dc8-11e7-1bc3-0800270989e4}",
 *           "hostname": "broker2",
 *           "ipAddress": "10.10.100.101",
 *           "port": 8883
 *         },
 *         ...
 *       ],
 *       "certVersion": 0
 *     }
 *     ```
 *
 *  * Saves the [broker config] to the "Brokers" section of the
 *    dxlclient.config file.
 *
 *  Updates to the dxlclient.config file attempt to preserve comments outside
 *  of the body of the broker section. Any existing broker entries and
 *  associated comments are overwritten by the latest broker configuration
 *  data retrieved from the management service.
 *
 * @param {String} configDir - Directory in which to store the configuration
 *   data.
 * @param {ManagementServiceHostInfo} hostInfo - Info for the management service
 *   host.
 * @param {Object} [options] - Additional options for the provision operation.
 * @param {Number} [options.verbosity] - Level of verbosity at which to log any
 *   error or trace messages.
 * @param {Function} [options.doneCallback] - Callback to invoke once the
 *   provisioned configuration has been stored. If an error occurs, the first
 *   parameter supplied to the `doneCallback` is an `Error` instance
 *   containing failure details.
 * @private
 */
module.exports = function updateConfig (configDir, hostInfo, options) {
  options = options || {}
  var doneCallback = options.doneCallback
  var verbosity = options.verbosity || 0

  var configFileName = path.join(configDir,
    provisionUtil.DEFAULT_CONFIG_FILE_NAME)

  var config
  try {
    config = util.getConfigFileAsObject(configFileName)
  } catch (err) {
    provisionUtil.invokeCallback(err, doneCallback, verbosity)
    return
  }

  if (!config.Certs || !config.Certs.BrokerCertChain ||
    !config.Certs.BrokerCertChain) {
    if (doneCallback) {
      doneCallback(provisionUtil.createFormattedDxlError(
        'BrokerCertChain setting not found in Certs section in config: ' +
        configFileName))
    }
  } else {
    var service = new ManagementService(hostInfo)
    requestBrokerCertChain(service, verbosity,
      function (error, certChain) {
        if (certChain) {
          updateBrokerCertChain(configDir, config.Certs.BrokerCertChain,
            certChain, verbosity)
          requestBrokerList(service, verbosity,
            function (error, response) {
              if (response) {
                try {
                  updateBrokerListInConfigFile(configFileName,
                    brokerConfigLines(response), verbosity, '[Brokers]')
                  updateBrokerListInConfigFile(configFileName,
                    brokerWsConfigLines(response), verbosity, '[BrokersWebSockets]')
                  if (verbosity) {
                    console.log('Updating DXL config file at ' + configFileName)
                  }
                } catch (err) {
                  error = err
                }
              }
              provisionUtil.invokeCallback(error, doneCallback, verbosity)
            }
          )
        } else {
          provisionUtil.invokeCallback(error, doneCallback, verbosity)
        }
      }
    )
  }
}
