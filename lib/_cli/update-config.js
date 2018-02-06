'use strict'

var path = require('path')
var cliUtil = require('./util')
var dxlUtil = require('../util')

var BROKER_CERT_CHAIN_COMMAND = 'DxlClientMgmt.createClientCaBundle'
var BROKER_LIST_COMMAND = 'DxlClientMgmt.getBrokerList'

function requestBrokerCertChain (hostName, port, userName, password,
                                 verbosity, callback) {
  cliUtil.managementServiceRequest('Requesting broker cert chain',
    hostName, port, userName, password, BROKER_CERT_CHAIN_COMMAND,
    {}, verbosity, callback)
}

function updateBrokerCertChain (configDir, certChainFile, certChain, verbosity) {
  var caBundleFileName = dxlUtil.getConfigFilePath(configDir, certChainFile)
  if (verbosity) {
    console.log('Updating certs in ' + caBundleFileName)
  }
  cliUtil.saveToFile(caBundleFileName, certChain, verbosity)
}

function requestBrokerList (hostName, port, userName, password,
                            verbosity, callback) {
  cliUtil.managementServiceRequest('Requesting broker list',
    hostName, port, userName, password, BROKER_LIST_COMMAND,
    {}, verbosity, callback)
}

function brokerConfigLines (brokerListResponse) {
  var brokers = JSON.parse(brokerListResponse)['brokers']
  return brokers.map(function (broker) {
    return broker.guid + '=' + [broker.guid, broker.port,
      broker.hostName, broker.ipAddress].join(';')
  })
}

function updateBrokerListInConfigFile (configFileName, brokerLines, verbosity) {
  if (verbosity) {
    console.log('Updating DXL config file at ' + configFileName)
  }

  var inBrokerSection = false
  var linesAfterBrokerSection = []
  var configFileData = dxlUtil.getConfigFileData(configFileName)

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
          } else if (line.match(/^\[.*\]$/)) {
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

function updateConfig (configDir, hostName, command, verbosity) {
  var configFileName = path.join(configDir, cliUtil.DEFAULT_CONFIG_FILE_NAME)
  var config = dxlUtil.getConfigFileAsObject(configFileName)
  if (!config.Certs.BrokerCertChain || !config.Certs.BrokerCertChain) {
    cliUtil.throwError(
      'BrokerCertChain setting not found in Certs section in config: ' +
      configFileName)
  }
  requestBrokerCertChain(hostName, command.port, command.username,
    command.password, verbosity, function (certChain) {
      updateBrokerCertChain(configDir, config.Certs.BrokerCertChain,
        certChain, verbosity)
      requestBrokerList(hostName, command.port, command.username,
        command.password, verbosity, function (response) {
          updateBrokerListInConfigFile(configFileName,
            brokerConfigLines(response), verbosity)
        }
      )
    }
  )
}

module.exports = function (program) {
  var addProgramArgs = cliUtil.addProgramArgsToAction(program, updateConfig)
  program
    .command('updateconfig <CONFIG_DIR> <HOST_NAME>')
    .description('update the DXL client configuration')
    .option('-u, --username <username>',
      'user registered at the management service')
    .option('-p, --password <password>', 'password for the management user')
    .option('-t, --port <port>', 'password for the management user', '8443')
    .action(function (configDir, hostName, command) {
      var actionArguments = arguments
      cliUtil.fillEmptyServerCredentialsFromPrompt(command, function () {
        addProgramArgs.apply(null, actionArguments)
      })
    })
}