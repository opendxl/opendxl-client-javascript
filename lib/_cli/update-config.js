'use strict'

var path = require('path')
var ManagementService = require('./management-service')
var cliUtil = require('./cli-util')
var util = require('../util')

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
  cliUtil.saveToFile(caBundleFileName, certChain, verbosity)
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
 * @param {Object} brokerListResponse - Response received from the management
 *   service for a request to the getBrokerList endpoint.
 * @returns {Array<String>} A list of broker lines to include in the client
 *   configuration file.
 * @private
 */
function brokerConfigLines (brokerListResponse) {
  var brokers = JSON.parse(brokerListResponse).brokers
  return brokers.map(function (broker) {
    return broker.guid + '=' + [broker.guid, broker.port,
      broker.hostName, broker.ipAddress].join(';')
  })
}

/**
 * Updates the broker section in a client configuration file with a list of
 * broker data lines.
 * @param {String} configFileName - Name of the configuration file to update.
 * @param {Array<String>} brokerLines - List of broker data strings to insert
 *  into the configuration file.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @private
 */
function updateBrokerListInConfigFile (configFileName, brokerLines, verbosity) {
  if (verbosity) {
    console.log('Updating DXL config file at ' + configFileName)
  }

  var inBrokerSection = false
  var linesAfterBrokerSection = []
  var configFileData = util.getConfigFileData(configFileName)

  // Replace the current contents of the broker section with the new broker
  // lines. Preserve existing content in the file which relates to other
  // sections - for example, the 'Certs' section.
  var newConfigLines = configFileData.lines.reduce(
    function (acc, line) {
      if (line === '[Brokers]') {
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

  cliUtil.saveToFile(configFileName, newConfig)
}

/**
 * Update the client configuration.
 * @param {String} configDir - Directory in which to store the configuration
 *   data.
 * @param {String} hostName - Name of the host where the management service
 *   resides.
 * @param {Command} command - Commander-based command which contains options
 *   to use storing the latest configuration data from the management service.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} doneCallback - Callback to invoke once the updated
 *   configuration has been stored.
 * @private
 */
function updateConfig (configDir, hostName, command, verbosity,
                       doneCallback) {
  var configFileName = path.join(configDir, cliUtil.DEFAULT_CONFIG_FILE_NAME)
  var config = util.getConfigFileAsObject(configFileName)
  if (!config.Certs.BrokerCertChain || !config.Certs.BrokerCertChain) {
    cliUtil.throwError(
      'BrokerCertChain setting not found in Certs section in config: ' +
      configFileName)
  }
  var service = new ManagementService(hostName, command.port,
    command.user, command.password, command.truststore)
  requestBrokerCertChain(service, verbosity, function (certChain) {
    updateBrokerCertChain(configDir, config.Certs.BrokerCertChain,
      certChain, verbosity)
    requestBrokerList(service, verbosity, function (response) {
      updateBrokerListInConfigFile(configFileName,
        brokerConfigLines(response), verbosity)
      if (typeof doneCallback === 'function') {
        doneCallback()
      }
    })
  })
}

/**
 * Subcommand for updating the DXL client configuration in the dxlclient.config
 * file, specifically the ca bundle and broker configuration.
 *
 * This subcommand performs the following steps:
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
 *     {
 *       "brokers": [
 *         {
 *           "guid": "{2c5b107c-7f51-11e7-0ebf-0800271cfa58}",
 *           "hostName": "broker1",
 *           "ipAddress": "10.10.100.100",
 *           "port": 8883
 *         },
 *         {
 *           "guid": "{e90335b2-8dc8-11e7-1bc3-0800270989e4}",
 *           "hostName": "broker2",
 *           "ipAddress": "10.10.100.101",
 *           "port": 8883
 *         },
 *         ...
 *       ],
 *       "certVersion": 0
 *     }
 *
 *  * Saves the [broker config] to the "Brokers" section of the
 *    dxlclient.config file.
 *
 *  Updates to the dxlclient.config file attempt to preserve comments outside
 *  of the body of the broker section. Any existing broker entries and
 *  associated comments are overwritten by the latest broker configuration
 *  data retrieved from the management service.
 *
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  var command = program
    .command('updateconfig <config_dir> <host_name>')
    .description('update the DXL client configuration')
  cliUtil.appendManagementServiceCommandOptions(command)
    .action(function (configDir, hostName, command) {
      cliUtil.fillEmptyServerCredentialsFromPrompt(command, function () {
        updateConfig(configDir, hostName, command,
          cliUtil.getProgramVerbosity(program),
          program.doneCallback)
      })
    })
}
