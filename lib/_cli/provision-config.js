'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var cliUtil = require('./cli-util')
var ManagementService = require('./management-service')
var pki = require('./pki')

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
      cliUtil.throwError('Invalid key value pair for broker entry: ' +
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
 * @private
 */
function storeProvisionConfig (config, configDir, filePrefix,
                               privateKeyFileName, verbosity) {
  if (typeof config !== 'string') {
    cliUtil.throwError('Unexpected data type for response: ' +
      typeof config)
  }
  var configElements = config.split(',')
  if (configElements.length < 3) {
    cliUtil.throwError('Did not receive expected number of response ' +
      'elements. Expected: 3, Received: ' + configElements.length +
      '. Value: ' + config)
  }

  var brokerLines = configElements[2].split(
    /[\r\n]+/).filter(function (brokerLine) {
      return brokerLine.length > 0
    })

  var brokers = brokersForConfig(brokerLines)

  var certFileName = filePrefix + '.crt'
  var configString = ini.encode({
    Certs: {
      BrokerCertChain: DEFAULT_BROKER_CERT_CHAIN_FILE_NAME,
      CertFile: path.basename(certFileName),
      PrivateKey: path.basename(privateKeyFileName)
    },
    Brokers: brokers
  }).replace(/\\;/g, ';')

  var configFileName = path.join(configDir, cliUtil.DEFAULT_CONFIG_FILE_NAME)
  if (verbosity) {
    console.log('Saving DXL config file to ' + configFileName)
  }
  cliUtil.saveToFile(configFileName, configString)

  var caBundleFileName = path.join(configDir,
    DEFAULT_BROKER_CERT_CHAIN_FILE_NAME)
  if (verbosity) {
    console.log('Saving ca bundle file to ' + caBundleFileName)
  }
  cliUtil.saveToFile(caBundleFileName, configElements[0])

  var fullCertFileName = path.join(configDir, certFileName)
  if (verbosity) {
    console.log('Saving client certificate file to ' + fullCertFileName)
  }
  cliUtil.saveToFile(fullCertFileName, configElements[1])
}

/**
 * Provision the client configuration.
 * @param {String} configDir - Directory in which to store the configuration
 *   data.
 * @param {String} hostName - Name of the host where the management service
 *   resides.
 * @param {String} commonOrCsrFileName - A string representing either
 *   a common name (CN) to add into the generated file or the path to the
 *   location of an existing CSR file. The parameter is interpreted as a path
 *   to an existing CSR file if a property named certRequestFile exists on the
 *   command object and has a truthy value. If the parameter represents a path
 *   to an existing CSR file, this function does not generate a new CSR file.
 * @param {Command} command - Commander-based command which contains options
 *   to use in generating the CSR and private key and storing the configuration
 *   data returned from the management service.
 * @param {Boolean} command.certRequestFile - If present and truthy, interprets
 *   the commonOrCsrFileName parameter as the name of an existing CSR file.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} callback - Callback to invoke once the provisioned
 *   configuration has been stored.
 * @private
 */
function provisionConfig (configDir, hostName, commonOrCsrFileName, command,
                          verbosity, doneCallback) {
  pki.generatePrivateKeyAndCsr(configDir, commonOrCsrFileName, command,
    verbosity, function (privateKeyFileName, csrFileName) {
      var service = new ManagementService(hostName, command.port,
        command.user, command.password, command.truststore)
      requestProvisionConfig(service, fs.readFileSync(csrFileName), verbosity,
        function (config) {
          storeProvisionConfig(config, configDir, command.filePrefix,
            privateKeyFileName, verbosity)
          if (typeof doneCallback === 'function') {
            doneCallback()
          }
        }
      )
    }
  )
}

/**
 * Subcommand for provisioning a DXL client. This subcommand performs the
 * following steps:
 *
 * * Either generates a certificate signing request and private key, storing
 *   each to a file, (the default) or reads the certificate signing request
 *   from a file (if the "-r" argument is specified).
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
 *     <code>:" on failure.
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
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  var command = program.command(
    'provisionconfig <config_dir> <host_name> <common_or_csrfile_name>'
    )
    .description('download and provision the DXL client configuration')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR, key, and cert files', 'client')
  cliUtil.appendManagementServiceCommandOptions(command)
    .option('-r, --cert-request-file',
      'Interpret common_or_csrfile_name as a filename for an existing csr ' +
      'to be signed. If not specified, a new csr is generated.')
    .action(function (configDir, hostName, commonOrCsrFileName, command) {
      cliUtil.fillEmptyServerCredentialsFromPrompt(command, function () {
        provisionConfig(configDir, hostName, commonOrCsrFileName,
          command, cliUtil.getProgramVerbosity(program), program.doneCallback)
      })
    })
  pki.appendPkiCommandOptions(command)
}
