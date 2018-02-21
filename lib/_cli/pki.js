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

/**
 * Default file mode to use for private key files. No access for users other
 * than the file owner.
 * @type {Number}
 */
var _0600 = parseInt('0600', 8)

/**
 * Returns the first location found for the openssl executable.
 * @param {String} [opensslBin=null] - If non-null and the named file exists,
 *   this value is returned.
 * @returns {String} Path to the openssl executable.
 * @throws {CliError} If openssl cannot be found.
 */
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

/**
 * Indents the lines in the supplied string for display in log output.
 * @param {String} logOutput - The data to indent.
 * @returns {String} The indented output.
 */
function indentedLogOutput (logOutput) {
  logOutput = logOutput.toString()
  if (logOutput) {
    logOutput = '\n ' + logOutput.toString().replace(/(\r?\n)/g, '$1 ')
  }
  return logOutput
}

/**
 * Runs an openssl command.
 * @param {String} description - Textual description of the HTTP request (used
 *   in log and error messages).
 * @param {Array<String>} commandArgs - Array of arguments to supply to the
 *   openssl command line.
 * @param {String} [opensslBin=null] - Path to the openssl executable. If not
 *   specified, the function attempts to find the openssl executable from the
 *   environment path.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {String} [input=] - Optional standard input to provide to the
 *   openssl command.
 * @returns {Object} Results of the openssl command. The object returned is
 *   from the underlying call to child_process.spawnSync.
 * @throws {CliError} If the openssl command fails. A non-zero exit code for
 *   the command is interpreted as failure.
 */
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

/**
 * Converts a camelCase field name to lowercase hyphen-delimited format for
 * use as a command-line option.
 * @param {String} field - Name of the field to convert.
 * @example Converts 'optionName' to 'option-name'.
 * @returns {string} Field name in lowercase hyphen-delimited format.
 */
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

/**
 * Mapping of X509 subject attribute name information. Each key represents
 * a camelCase form of the CLI option name. The 'name' property in the value
 * represents the short name abbreviation which openssl uses to describe
 * the attribute in an X509 subject. The 'description' property in the value
 * is used in the command-line help text.
 */
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

/**
 * Convert the X509 subject attributes specified on the command-line into a
 * flat X509 subject string for use with openssl commands.
 * @param {String} commonName - The X509 Common Name (CN) specified on the
 *   command line.
 * @param {Command} command - The Commander command object containing the
 *   options that the user specifies on the command line.
 * @returns {String} The X509 Subject in openssl display format.
 */
function buildCsrSubject (commonName, command) {
  var subject = '/CN=' + commonName
  Object.keys(subjectAttributes).forEach(function (key) {
    if (command[key]) {
      subject = subject + '/' + subjectAttributes[key].name + '=' + command[key]
    }
  })
  return subject
}

/**
 * Convert the list of subject alternative names into DNS-type names for use
 * in an openssl extension value.
 * @param {Array<String>} subjectAltNames - List of subject alternative names
 * @returns {Array<String>} The subject alternative names in openssl format
 */
function buildSubjectAltNameConfig (subjectAltNames) {
  return subjectAltNames.map(function (subjectAltName, index) {
    return 'DNS.' + index + ' = ' + subjectAltName
  })
}

/**
 * Generate a private key and X509 Certificate Signing Request (CSR) file.
 * @param {String} configDir - Directory in which to store the private key
 *   and CSR file.
 * @param {String} commonOrCsrFileName - A string representing either
 *   a common name (CN) to add into the generated file or the path to the
 *   location of an existing CSR file. The parameter is interpreted as a path
 *   to an existing CSR file if a property named certRequestFile exists on the
 *   command object and has a truthy value. If the parameter represents a path
 *   to an existing CSR file, this function does not generate a new CSR file.
 * @param {Command} command - Commander-based command which contains options
 *   to use in generating the CSR and private key.
 * @param {Boolean} command.certRequestFile - If present and truthy, interprets
 *   the commonOrCsrFileName parameter as the name of an existing CSR file.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} responseCallback - Function to invoke with the name of
 *   the private key and CSR files after generation of the files is complete.
 */
function generatePrivateKeyAndCsr (configDir, commonOrCsrFileName,
                                   command, verbosity, responseCallback) {
  var privateKeyFileName = path.join(configDir, command.filePrefix + '.key')
  var csrFileName = path.join(configDir, command.filePrefix + '.csr')

  if (command.certRequestFile) {
    csrFileName = commonOrCsrFileName
    if (!fs.existsSync(csrFileName)) {
      cliUtil.throwError('Unable to locate certificate request file: ' +
        commonOrCsrFileName)
    }
    responseCallback(privateKeyFileName, csrFileName)
    return
  }
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
      '-subj', buildCsrSubject(commonOrCsrFileName, command),
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

  if (typeof responseCallback === 'function') {
    responseCallback(privateKeyFileName, csrFileName)
  }
}

/**
 * Function used by a Commander command to append a subject alternative name
 * to the list of names specified on the command line.
 * @param {String} san - Subject alternative name to add to the list.
 * @param {Array<String>} sans - List of subject alternative names to append
 *   the san parameter to.
 * @returns {Array<String>} The sans parameter, with the san parameter appended.
 */
function sanOption (san, sans) {
  sans.push(san)
  return sans
}

module.exports = {
  runOpenSslCommand: runOpenSslCommand,
  /**
   * Appends options related to the use of PKI utilities to a Commander-based
   *   command.
   * @param {Command} command - The Commander command to append options onto.
   * @returns {Command}
   */
  appendPkiCommandOptions: function (command) {
    command.option('--opensslbin <FILE>',
      'Location of the OpenSSL executable that the command uses. If not ' +
      'specified, the command attempts to find an OpenSSL executable in ' +
      'the current environment path.')
    command.option('-s, --san [value]',
      'add Subject Alternative Name(s) to the CSR', sanOption, [])
    command.option('-P, --passphrase [pass]',
      'Password for the private key. If specified with no value, prompts ' +
      'for the value.')
    Object.keys(subjectAttributes).forEach(function (key) {
      var attributeInfo = subjectAttributes[key]
      var optionName = fieldAsOption(key)
      var optionValue = attributeInfo.optionValue || optionName.toLowerCase()
      command.option('--' + fieldAsOption(key) + ' <' + optionValue + '>',
        attributeInfo.description)
    })
    return command
  },
  /**
   * Generate a private key and X509 Certificate Signing Request (CSR) file.
   * @param {String} configDir - Directory in which to store the private key
   *   and CSR file.
   * @param {String} commonOrCsrFileName - A string representing either the
   *   a common name (CN) to add into the generated file or the path to the
   *   location of an existing CSR file. The parameter is interpreted as a path
   *   to an existing CSR file if a property named certRequestFile exists on the
   *   command object and has a truthy value. If the parameter represents a path
   *   to an existing CSR file, this function does not generate a new CSR file.
   * @param {Command} command - Commander-based command which contains options
   *   to use in generating the CSR and private key.
   * @param {Boolean} command.certRequestFile - If present and truthy,
   *   interprets the commonOrCsrFileName parameter as the name of an existing
   *   CSR file.
   * @param {Number} verbosity - Level of verbosity at which to log any error
   *   or trace messages.
   * @param {Function} responseCallback - Function to invoke with the name of
   *   the private key and CSR files after generation of the files is complete.
   */
  generatePrivateKeyAndCsr: function (configDir, commonOrCsrFileName, command,
                                      verbosity, responseCallback) {
    var generateArgs = arguments
    if (command.passphrase === true) {
      cliUtil.getValueFromPrompt('private key passphrase', true,
        function (passphrase) {
          command.passphrase = passphrase
          generatePrivateKeyAndCsr.apply(null, generateArgs)
        }
      )
    } else {
      generatePrivateKeyAndCsr.apply(null, generateArgs)
    }
  }
}
