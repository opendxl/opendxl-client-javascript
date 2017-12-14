'use strict'

var fs = require('fs')
var ini = require('ini')
var Broker = require('./broker')
var error = require('./error')
var util = require('./util')

function getSetting (config, section, setting, required, readFromFile) {
  if (typeof (required) === 'undefined') { required = true }

  if (!config[section]) {
    if (required) {
      throw new error.DxlError('Required section not found in config: ' +
        section)
    } else {
      return null
    }
  }

  if (!config[section][setting]) {
    if (required) {
      throw new error.DxlError('Required setting not found in config: ' +
        setting)
    } else {
      return null
    }
  }

  var value = config[section][setting].replace(/\u001f/g, ';')

  if (readFromFile) {
    try {
      value = fs.readFileSync(value)
    } catch (err) {
      throw new error.DxlError('Unable to read file for ' + setting + ': ' +
        err.message)
    }
  }

  return value
}

function Config (brokerCaBundle, cert, privateKey, brokers) {
  this.brokerCaBundle = brokerCaBundle
  this.cert = cert
  this.privateKey = privateKey
  this.brokers = brokers
  this._clientId = util.generateIdAsString()
}

Config.createDxlConfigFromFile = function (configFile) {
  var configData
  try {
    configData = fs.readFileSync(configFile, 'utf-8')
  } catch (err) {
    throw new error.DxlError('Unable to read config file: ' + err.message)
  }

  var lines = configData.split(/[\r\n]+/g)
  var escapedLines = lines.map(function (line) {
    if (line && !line.match(/^\s*;/)) {
      line = line.replace(/;/g, '\u001f')
    }
    return line
  })
  var escapedConfigData = escapedLines.join('\n')

  var parsedConfig
  try {
    parsedConfig = ini.parse(escapedConfigData)
  } catch (err) {
    throw new error.DxlError('Unable to parse config file: ' + err.message)
  }

  var brokerCaBundle = getSetting(parsedConfig, 'Certs', 'BrokerCertChain',
    true, true)
  var cert = getSetting(parsedConfig, 'Certs', 'CertFile', true, true)
  var privateKey = getSetting(parsedConfig, 'Certs', 'PrivateKey', true, true)

  var brokers = []
  if (parsedConfig.Brokers) {
    brokers = Object.keys(parsedConfig.Brokers).map(function (brokerKey) {
      var brokerInfo = getSetting(parsedConfig, 'Brokers', brokerKey, true)
      var brokerElements = brokerInfo.split(';')
      if (brokerElements.length < 2) {
        throw new error.MalformedBrokerError(
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

  var config = new Config(brokerCaBundle, cert, privateKey, brokers)
  var clientId = getSetting(parsedConfig, 'General', 'ClientId', false)
  if (clientId) {
    config._clientId = clientId
  }
  return config
}

module.exports = Config
