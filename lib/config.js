'use strict'

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var Broker = require('./broker')
var error = require('./error')
var util = require('./util')

var DEFAULT_MQTT_KEEP_ALIVE_INTERVAL = 30 * 60 // seconds
var DEFAULT_RECONNECT_DELAY = 1 // seconds

function getSetting (config, section, setting, required, readFromFile,
                     configPath) {
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

  var value = config[section][setting]

  if (readFromFile) {
    var fileToRead = value
    if (!fs.existsSync(value) && !path.isAbsolute(value) &&
      (typeof (configPath) !== 'undefined') && configPath) {
      fileToRead = path.join(configPath, value)
    }
    if (fs.existsSync(fileToRead)) {
      try {
        value = fs.readFileSync(fileToRead)
      } catch (err) {
        throw new error.DxlError('Unable to read file for ' + setting + ': ' +
          err.message)
      }
    } else {
      throw new error.DxlError('Unable to locate file for ' + setting +
        ': ' + value)
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
  this.reconnectDelay = DEFAULT_RECONNECT_DELAY
  this.keepAliveInterval = DEFAULT_MQTT_KEEP_ALIVE_INTERVAL
}

Config.createDxlConfigFromFile = function (configFile) {
  var configData
  try {
    configData = fs.readFileSync(configFile, 'utf-8')
  } catch (err) {
    throw new error.DxlError('Unable to read config file: ' + err.message)
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
    throw new error.DxlError('Unable to parse config file: ' + err.message)
  }

  var configPath = path.dirname(configFile)

  var brokerCaBundle = getSetting(parsedConfig, 'Certs', 'BrokerCertChain',
    true, true, configPath)
  var cert = getSetting(parsedConfig, 'Certs', 'CertFile', true, true,
    configPath)
  var privateKey = getSetting(parsedConfig, 'Certs', 'PrivateKey', true, true,
    configPath)

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
