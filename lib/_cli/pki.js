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

var DEFAULT_OPENSSL_WIN32_INSTALL_DIRS = ['C:\\OpenSSL-Win64\\bin',
  'C:\\OpenSSL-Win32\\bin']
var CSR_EXTENSIONS_CONFIG_SECTION = 'v3_req'
var PUBLIC_KEY_BITS = 2048
var SUBJECT_ALT_NAME_CONFIG_SECTION = 'alt_names'

var _0600 = parseInt('0600', 8)

function findOpenSslBin (opensslBin) {
  if (opensslBin) {
    if (!fs.existsSync(opensslBin)) {
      cliUtil.throwError('Unable to find openssl at: ' + opensslBin)
    }
  } else {
    opensslBin = which.sync('openssl', {nothrow: true})
    if (!opensslBin && (os.platform() === 'win32')) {
      opensslBin = DEFAULT_OPENSSL_WIN32_INSTALL_DIRS.reduce(
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

function indentedLogOutput (logOutput) {
  logOutput = logOutput.toString()
  if (logOutput) {
    logOutput = '\n ' + logOutput.toString().replace(/(\r?\n)/g, '$1 ')
  }
  return logOutput
}

function runOpenSslCommand (description, commandArgs, opensslBin, verbosity,
                            input) {
  opensslBin = findOpenSslBin(opensslBin)

  if (verbosity) {
    if (description) {
      console.log(description)
    }
    if (verbosity > 1) {
      console.log("Running openssl. Path: '" + opensslBin +
        "', Command: '" + commandArgs.join(' '))
    }
  }

  var command = spawnSync(opensslBin, commandArgs, input ? {input: input} : {})
  if (command.stdout && (verbosity > 1)) {
    console.log('OpenSSL OUTPUT LOG: ' + indentedLogOutput(command.stdout))
  }
  if (command.stderr && ((command.status !== 0) || (verbosity > 1))) {
    cliUtil.logError(indentedLogOutput(command.stderr), '', 'OpenSSL ERROR LOG')
  }

  if (command.status !== 0) {
    var errorMessage = 'openssl execution failed'
    if (command.error) {
      errorMessage = command.error.message
    }
    if (command.status) {
      errorMessage = errorMessage + ', status code: ' + command.status
    }
    cliUtil.throwError(errorMessage, description)
  }

  return command
}

function fieldAsOption (field) {
  var option = ''
  for (var i = 0; i < field.length; i++) {
    var c = field.charAt(i)
    if (c < 'a') {
      option = option + '-' + c.toLowerCase()
    } else {
      option += c
    }
  }
  return option
}

var subjectAttributes = {
  country: {
    name: 'C',
    description: "Country (C) to use in the CSR's Subject DN"
  },
  stateOrProvince: {
    name: 'ST',
    optionValue: 'state',
    description: "State or province (ST) to use in the CSR's Subject DN"
  },
  locality: {
    name: 'L',
    description: "Locality (L) to use in the CSR's Subject DN"
  },
  organization: {
    name: 'O',
    optionValue: 'org',
    description: "Organization (O) to use in the CSR's Subject DN"
  },
  organizationalUnit: {
    name: 'OU',
    optionValue: 'org_unit',
    description: "Organizational Unit (OU) to use in the CSR's Subject DN"
  },
  emailAddress: {
    name: 'emailAddress',
    optionValue: 'email',
    description: "e-mail address to use in the CSR's Subject DN"
  }
}

function buildCsrSubject (commonName, command) {
  var subject = '/CN=' + commonName
  Object.keys(subjectAttributes).forEach(function (key) {
    if (command[key]) {
      subject = subject + '/' + subjectAttributes[key].name + '=' + command[key]
    }
  })
  return subject
}

function buildSubjectAltNameConfig (subjectAltNames) {
  return subjectAltNames.map(function (subjectAltName, index) {
    return 'DNS.' + index + ' = ' + subjectAltName
  })
}

function generateCsr (configDir, commonName, command, verbosity,
                      responseCallback) {
  var privateKeyFileName = path.join(configDir, command.filePrefix + '.key')
  var csrFileName = path.join(configDir, command.filePrefix + '.csr')

  cliUtil.mkdirRecursive(configDir)

  var tmpOpenSslConfigFile = tmp.fileSync()
  var requestConfigAsArr = ['[req]',
    'distinguished_name=req_distinguished_name',
    '[req_distinguished_name]',
    '[' + CSR_EXTENSIONS_CONFIG_SECTION + ']',
    'basicConstraints = CA:FALSE',
    'keyUsage = digitalSignature, keyEncipherment',
    'extendedKeyUsage = clientAuth'
  ]
  if (command.san.length > 0) {
    requestConfigAsArr.push('subjectAltName = @' +
      SUBJECT_ALT_NAME_CONFIG_SECTION)
    requestConfigAsArr.push('[' + SUBJECT_ALT_NAME_CONFIG_SECTION + ']')
    Array.prototype.push.apply(requestConfigAsArr,
      buildSubjectAltNameConfig(command.san))
  }
  var requestConfigAsString = requestConfigAsArr.join('\n')
  fs.writeFileSync(tmpOpenSslConfigFile.name, requestConfigAsString)
  if (verbosity > 1) {
    console.log('OpenSSL config for CSR: ' +
      indentedLogOutput(requestConfigAsString))
  }

  try {
    if (verbosity) {
      console.log('Saving private key file to ' + privateKeyFileName)
    }
    var commandArgs = ['req', '-new', '-newkey', 'rsa:' + PUBLIC_KEY_BITS,
      '-out', csrFileName, '-keyout', privateKeyFileName,
      '-subj', buildCsrSubject(commonName, command),
      '-reqexts', CSR_EXTENSIONS_CONFIG_SECTION,
      '-config', tmpOpenSslConfigFile.name
    ]

    var input
    if (command.passphrase) {
      commandArgs.push('-passout')
      commandArgs.push('stdin')
      input = command.passphrase
    } else {
      commandArgs.push('-nodes')
    }
    runOpenSslCommand('Saving csr file to ' + csrFileName, commandArgs,
      command.opensslbin, verbosity, input)
    fs.chmodSync(privateKeyFileName, _0600)
  } finally {
    tmpOpenSslConfigFile.removeCallback()
  }

  if (responseCallback) {
    responseCallback(privateKeyFileName, csrFileName)
  }
}

function sanOption (san, sans) {
  sans.push(san)
  return sans
}

module.exports = {
  runOpenSslCommand: runOpenSslCommand,
  appendPkiCommandOptions: function (command) {
    command.option('--opensslbin <FILE>',
      'Location of the OpenSSL executable that the command uses. If not ' +
      'specified, the command attempts to find an OpenSSL executable in ' +
      'the current environment path.')
    command.option('-P, --passphrase [pass]',
      'Password for the private key. If specified with no value, prompts ' +
      'for the value.')
    command.option('-s, --san [value]',
      'add Subject Alternative Name(s) to the CSR', sanOption, [])
    Object.keys(subjectAttributes).forEach(function (key) {
      var attributeInfo = subjectAttributes[key]
      var optionName = fieldAsOption(key)
      var optionValue = attributeInfo.optionValue || optionName.toLowerCase()
      command.option('--' + fieldAsOption(key) + ' <' + optionValue + '>',
        attributeInfo.description)
    })
    return command
  },
  generatePrivateKeyAndCsr: function (configDir, commonName, command,
                                      verbosity, responseCallback) {
    var generateArgs = arguments
    if (command.passphrase === true) {
      cliUtil.getValueFromPrompt('private key passphrase', true,
        function (passphrase) {
          command.passphrase = passphrase
          generateCsr.apply(null, generateArgs)
        }
      )
    } else {
      generateCsr.apply(null, generateArgs)
    }
  }
}
