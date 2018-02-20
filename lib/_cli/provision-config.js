'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var cliUtil = require('./cli-util')
var ManagementService = require('./management-service')
var pki = require('./pki')

var DEFAULT_BROKER_CERT_CHAIN_FILE_NAME = 'ca-bundle.crt'
var PROVISION_COMMAND = 'DxlBrokerMgmt.generateOpenDXLClientProvisioningPackageCmd'

function requestProvisionConfig (managementService, csr, verbosity, callback) {
  managementService.request('Requesting client certificate', PROVISION_COMMAND,
    {csrString: csr}, verbosity, callback)
}

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
    console.log('Saving client certificate to ' + fullCertFileName)
  }
  cliUtil.saveToFile(fullCertFileName, configElements[1])
}

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
