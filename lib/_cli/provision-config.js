'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var cliUtil = require('./cli-util')
var ManagementService = require('./management-service')
var pki = require('./pki')

var DEFAULT_BROKER_CERT_CHAIN_FILE_NAME = 'ca-bundle.crt'
var PROVISION_COMMAND = 'DxlBrokerMgmt.generateOpenDXLClientProvisioningPackageCmd'

function requestProvisionConfig (hostName, port, userName, password,
                                 csr, verbosity, callback) {
  var service = new ManagementService(hostName, port, userName, password)
  service.request('Requesting client certificate', PROVISION_COMMAND,
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
                          verbosity) {
  var results = pki.generatePrivateKeyAndCsr(configDir, commonOrCsrFileName,
    command, verbosity)
  var privateKeyFileName = results.privateKeyFileName
  var csrFileName = results.csrFileName
  requestProvisionConfig(hostName, command.port,
    command.user, command.password,
    fs.readFileSync(csrFileName), verbosity,
    function (config) {
      storeProvisionConfig(config, configDir, command.filePrefix,
        privateKeyFileName, verbosity)
    }
  )
}

module.exports = function (program) {
  var command = program.command(
    'provisionconfig <config_dir> <host_name> <common_or_csrfile_name>'
  )
  var addProgramArgs = cliUtil.addProgramArgsToAction(program, provisionConfig)
  command
    .description('download and provision the DXL client configuration')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR, key, and cert files', 'client')
    .option('-u, --user <username>',
      'user registered at the management service')
    .option('-p, --password <password>', 'password for the management user')
    .option('-t, --port <port>', 'password for the management user', '8443')
    .action(function (configDir, hostName, commonOrCsrFileName, command) {
      var actionArguments = arguments
      cliUtil.fillEmptyServerCredentialsFromPrompt(command, function () {
        addProgramArgs.apply(null, actionArguments)
      })
    })
  pki.appendPkiCommandOptions(command)
}
