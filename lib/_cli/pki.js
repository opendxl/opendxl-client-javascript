'use strict'

/**
 * @module Pki
 * @private
 */

var fs = require('fs')
var os = require('os')
var path = require('path')
var spawnSync = require('child_process').spawnSync
var tmp = require('tmp')
var which = require('which')
var cliUtil = require('./cli-util')

var OPENSSL_CONF_ENV_VAR = 'OPENSSL_CONF'
var PUBLIC_KEY_BITS = 2048

var _0600 = parseInt('0600', 8)

function findOpenSslBin (opensslBin) {
  if (opensslBin) {
    if (!fs.existsSync(opensslBin)) {
      cliUtil.throwError('Unable to find openssl at: ' + opensslBin)
    }
  } else {
    opensslBin = which.sync('openssl', {nothrow: true})
    if (!opensslBin && (os.platform() === 'win32')) {
      opensslBin = ['C:\\OpenSSL-Win64\\bin', 'C:\\OpenSSL-Win32\\bin'].reduce(
        function (acc, candidatePath) {
          candidatePath = path.join(candidatePath, 'openssl.exe')
          if (!acc && fs.existsSync(candidatePath)) {
            acc = candidatePath
          }
          return acc
        },
        null
      )
    }
    if (!opensslBin) {
      cliUtil.throwError('Unable to find openssl from system path')
    }
  }
  return opensslBin
}

function runOpenSslCommandWithEnvVars (description, commandArgs, opensslBin,
                                       verbosity, envVars) {
  if (!envVars) {
    envVars = {}
  }
  opensslBin = findOpenSslBin(opensslBin)

  if (verbosity) {
    if (description) {
      console.log(description)
    }
    if (verbosity > 1) {
      console.log("Running openssl. Path: '" + opensslBin +
        "', Command: '" + commandArgs.join(' ') +
        "', Env Vars: " + JSON.stringify(envVars))
    }
  }

  var command = spawnSync(opensslBin, commandArgs, {env: envVars})
  if (command.status !== 0) {
    if (verbosity < 2 && command.stderr) {
      cliUtil.logError(command.stderr, '', 'ERROR LOG')
    }
    var errorMessage = 'openssl execution failed'
    if (command.error) {
      errorMessage = command.error.message
      if (command.error.hasOwnProperty('code') &&
        (command.error.code === 'ENOENT')) {
        errorMessage = 'Could not find openssl'
      }
    }
    if (command.status) {
      errorMessage = errorMessage + ', status code: ' + command.status
    }
    cliUtil.throwError(errorMessage, description)
  }

  return command
}

function runOpenSslCommand (description, commandArgs, opensslBin, verbosity) {
  var openSslDir = process.env[OPENSSL_CONF_ENV_VAR]
  if (!openSslDir) {
    var versionInfo = runOpenSslCommandWithEnvVars('', ['version', '-a'],
      opensslBin, verbosity, {})
    var openSslDirInfo = versionInfo.stdout.toString().match(
      /OPENSSLDIR: "(.*)"/)
    if (openSslDirInfo) {
      openSslDir = openSslDirInfo[1]
    }
  }

  var openSslConfigFile = path.join(openSslDir, 'openssl.cnf')
  var tmpOpenSslConfigFile
  if (!openSslDir || !fs.existsSync(openSslConfigFile)) {
    tmpOpenSslConfigFile = tmp.fileSync()
    openSslConfigFile = tmpOpenSslConfigFile.name
    fs.writeFileSync(openSslConfigFile, ['[req]',
      'distinguished_name=req_distinguished_name',
      '[req_distinguished_name]'
    ].join('\n'))
  }

  var envVars = {}
  envVars[OPENSSL_CONF_ENV_VAR] = openSslConfigFile

  try {
    runOpenSslCommandWithEnvVars(description, commandArgs, opensslBin,
      verbosity, envVars)
  } finally {
    if (tmpOpenSslConfigFile) {
      tmpOpenSslConfigFile.removeCallback()
    }
  }
}

function generatePrivateKey (fileName, opensslBin, verbosity) {
  runOpenSslCommandWithEnvVars('Saving private key file to ' +
    fileName, ['genrsa', '-out', fileName, PUBLIC_KEY_BITS],
    opensslBin, verbosity)
  fs.chmodSync(fileName, _0600)
}

function generateCsr (privateKeyFileName, csrFileName, commonName,
                      command, verbosity) {
  runOpenSslCommand('Saving csr file to ' + csrFileName, ['req',
    '-out', csrFileName, '-key', privateKeyFileName, '-new',
    '-subj', '/CN=' + commonName], command.opensslbin, verbosity)
}

module.exports = {
  runOpenSslCommand: runOpenSslCommandWithEnvVars,
  generatePrivateKeyAndCsr: function (configDir, commonName, command,
                                      verbosity) {
    cliUtil.mkdirRecursive(configDir)
    var privateKeyFileName = path.join(configDir, command.filePrefix + '.key')
    generatePrivateKey(privateKeyFileName, command.opensslbin, verbosity)
    var csrFileName = path.join(configDir, command.filePrefix + '.csr')
    generateCsr(privateKeyFileName, csrFileName, commonName, command,
      verbosity)
    return {privateKeyFileName: privateKeyFileName, csrFileName: csrFileName}
  }
}
