/**
 * @module Pki
 * @description Helpers for crypto operations used in provisioning - e.g., for
 * creating certificate requests and private keys.
 * @private
 */

'use strict'

var fs = require('fs')
var os = require('os')
var path = require('path')
var childProcess = require('child_process')
var tmp = require('tmp')
var which = require('which')
var DxlError = require('../dxl-error')
var provisionUtil = require('./provision-util')

var DEFAULT_PKI_FILE_PREFIX = 'client'

var DEFAULT_OPENSSL_WIN32_INSTALL_DIRS = ['C:\\OpenSSL-Win64\\bin',
  'C:\\OpenSSL-Win32\\bin']
var CSR_EXTENSIONS_CONFIG_SECTION = 'v3_req'
var PUBLIC_KEY_BITS = 2048
var SUBJECT_ALT_NAME_CONFIG_SECTION = 'alt_names'

/**
 * Information for an X509 subject attribute name
 * @typedef {Object} SubjectAttribute
 * @property {String} name - Abbreviation which openssl uses to describe the
 *   attribute in an X509 subject.
 * @property {String} description - Description used in the command-line help
 *   text.
 * @property {String} optionValue - Short name for the attribute value used in
 *   the command-line help text.
 */

/**
 * Mapping of X509 subject attribute name information.
 * @typedef {Object<module:Pki~SubjectAttribute>} SubjectAttributes
 */

var SUBJECT_ATTRIBUTES = {
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
 * @throws {DxlError} If openssl cannot be found.
 */
function findOpenSslBin (opensslBin) {
  if (opensslBin) {
    if (!fs.existsSync(opensslBin)) {
      throw new DxlError('Unable to find openssl at: ' + opensslBin)
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
      throw new DxlError('Unable to find openssl from system path')
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
 * Convert the X509 subject attributes specified on the command-line into a
 * flat X509 subject string for use with openssl commands.
 * @param {String} commonName - The X509 Common Name (CN) specified on the
 *   command line.
 * @param {Object} [options] - Options to use in generating the CSR and private
 *   key.
 * @returns {String} The X509 Subject in openssl display format.
 */
function buildCsrSubject (commonName, options) {
  var subject = '/CN=' + commonName
  Object.keys(SUBJECT_ATTRIBUTES).forEach(function (key) {
    if (options[key]) {
      subject = subject + '/' + SUBJECT_ATTRIBUTES[key].name + '=' +
        options[key]
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

module.exports = {
  /**
   * Runs an openssl command.
   * @param {String} description - Textual description of the HTTP request (used
   *   in log and error messages).
   * @param {Array<String>} commandArgs - Array of arguments to supply to the
   *   openssl command line.
   * @param {String} [opensslBin] - Path to the openssl executable. If not
   *   specified, the function attempts to find the openssl executable from the
   *   environment path.
   * @param {Number} [verbosity] - Level of verbosity at which to log any error
   *   or trace messages.
   * @param {String} [input] - Optional standard input to provide to the
   *   openssl command.
   * @returns {Object} Results of the openssl command. The object returned is
   *   from the underlying call to child_process.spawnSync.
   * @throws {DxlError} If the openssl command fails. A non-zero exit code for
   *   the command is interpreted as failure.
   */
  runOpenSslCommand: function (description, commandArgs, opensslBin, verbosity,
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

    var command = childProcess.spawnSync(opensslBin, commandArgs,
      input ? {input: input} : {})
    if (command.stdout && (verbosity > 1)) {
      console.log('OpenSSL OUTPUT LOG: ' + indentedLogOutput(command.stdout))
    }
    if (command.stderr && ((command.status !== 0) || (verbosity > 1))) {
      provisionUtil.logError(indentedLogOutput(command.stderr),
        {header: 'OpenSSL ERROR LOG', verbosity: verbosity})
    }

    if (command.status !== 0) {
      var errorMessage = 'openssl execution failed'
      if (command.error) {
        errorMessage = command.error.message
      }
      if (command.status) {
        errorMessage = errorMessage + ', status code: ' + command.status
      }
      throw provisionUtil.createFormattedDxlError(errorMessage, description)
    }

    return command
  },
  /**
   * Generate a private key and X509 Certificate Signing Request (CSR) file.
   * @param {String} configDir - Directory in which to store the private key
   *   and CSR file.
   * @param {String} commonOrCsrFileName - A string representing either
   *   a common name (CN) to add into the generated file or the path to the
   *   location of an existing CSR file. The parameter is interpreted as a path
   *   to an existing CSR file if a property named certRequestFile exists on the
   *   options object and has a truthy value. If the parameter represents a path
   *   to an existing CSR file, this function does not generate a new CSR file.
   * @param {Object} [options] - Options to use in generating the CSR and
   *   private key.
   * @param {Boolean} [options.certRequestFile] - If present and truthy,
   *   interprets the commonOrCsrFileName parameter as the name of an existing
   *   CSR file.
   * @param {String} [options.filePrefix=client] - Prefix of the private key,
   *   CSR, and certificate to store.
   * @param {String} [options.opensslbin] - Path to the openssl executable. If
   *   not specified, the function attempts to find the openssl executable from
   *   the environment path.
   * @param {String} [options.passphrase] - Password to use for encrypting the
   *   private key.
   * @param {Array<String>} [options.san] - List of subject alternative names to
   *   add to the CSR.
   * @param {String} [options.country] - Country (C) to use in the CSR's Subject
   *   DN.
   * @param {String} [options.stateOrProvince] - State or province (ST) to use
   *   in the CSR's Subject DN.
   * @param {String} [options.locality] - Locality (L) to use in the CSR's
   *   Subject DN.
   * @param {String} [options.organization] - Organization (O) to use in the
   *   CSR's Subject DN.
   * @param {String} [options.organizationalUnit] - Organizational Unit (OU) to
   *   use in the CSR's Subject DN.
   * @param {String} [options.emailAddress] - E-mail address to use in the CSR's
   *   Subject DN.
   * @param {Number} [options.verbosity] - Level of verbosity at which to log
   *   any error or trace messages.
   * @param {Function} [options.doneCallback] - Callback to invoke once the
   *   provisioned configuration has been stored. If an error occurs, the first
   *   parameter supplied to the `doneCallback` is an `Error` instance
   *   containing failure details.
   */
  generatePrivateKeyAndCsr: function (configDir, commonOrCsrFileName, options) {
    var doneCallback = options.doneCallback
    var verbosity = options.verbosity || 0

    var filePrefix = options.filePrefix || DEFAULT_PKI_FILE_PREFIX
    var privateKeyFileName = path.join(configDir, filePrefix + '.key')
    var csrFileName = path.join(configDir, filePrefix + '.csr')

    if (options.certRequestFile) {
      csrFileName = commonOrCsrFileName
      if (fs.existsSync(csrFileName)) {
        if (doneCallback) {
          doneCallback(null, privateKeyFileName, csrFileName)
        }
      } else {
        provisionUtil.invokeCallback(provisionUtil.createFormattedDxlError(
          'Unable to locate certificate request file: ' +
          commonOrCsrFileName), doneCallback, verbosity)
      }
      return
    }

    try {
      provisionUtil.mkdirRecursive(configDir)
    } catch (err) {
      provisionUtil.invokeCallback(provisionUtil.createFormattedDxlError(
        'Unable to create config directory: ' + configDir + '. Message: ' +
        err), doneCallback, verbosity)
      return
    }

    var tmpOpenSslConfigFile
    try {
      tmpOpenSslConfigFile = tmp.fileSync()
    } catch (err) {
      provisionUtil.invokeCallback(provisionUtil.createFormattedDxlError(
        'Unable to create temporary SSL config for CSR generation. ' +
        'Message: ' + err), doneCallback, verbosity)
      return
    }

    var requestConfigAsArr = ['[req]',
      'distinguished_name=req_distinguished_name',
      '[req_distinguished_name]',
      '[' + CSR_EXTENSIONS_CONFIG_SECTION + ']',
      'basicConstraints = CA:FALSE',
      'keyUsage = digitalSignature, keyEncipherment',
      'extendedKeyUsage = clientAuth'
    ]
    if (options.san && options.san.length) {
      requestConfigAsArr.push('subjectAltName = @' +
        SUBJECT_ALT_NAME_CONFIG_SECTION)
      requestConfigAsArr.push('[' + SUBJECT_ALT_NAME_CONFIG_SECTION + ']')
      Array.prototype.push.apply(requestConfigAsArr,
        buildSubjectAltNameConfig(options.san))
    }
    var requestConfigAsString = requestConfigAsArr.join('\n')

    try {
      fs.writeFileSync(tmpOpenSslConfigFile.name, requestConfigAsString)
    } catch (err) {
      provisionUtil.invokeCallback(provisionUtil.createFormattedDxlError(
        'Unable to write temporary SSL config for CSR generation. ' +
        'Message: ' + err), doneCallback, verbosity)
      return
    }

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
        '-subj', buildCsrSubject(commonOrCsrFileName, options),
        '-reqexts', CSR_EXTENSIONS_CONFIG_SECTION,
        '-config', tmpOpenSslConfigFile.name
      ]

      var input
      if (options.passphrase) {
        commandArgs.push('-passout')
        commandArgs.push('stdin')
        input = options.passphrase
      } else {
        commandArgs.push('-nodes')
      }
      module.exports.runOpenSslCommand('Saving csr file to ' + csrFileName,
        commandArgs, options.opensslbin, verbosity, input)
      fs.chmodSync(privateKeyFileName, _0600)
    } catch (err) {
      provisionUtil.invokeCallback(err, doneCallback, verbosity)
      return
    } finally {
      tmpOpenSslConfigFile.removeCallback()
    }

    if (doneCallback) {
      doneCallback(null, privateKeyFileName, csrFileName)
    }
  },
  /**
   * Default file prefix used in the generation of private key, certificate,
   * and CSR files.
   * @type {String}
   */
  DEFAULT_PKI_FILE_PREFIX: DEFAULT_PKI_FILE_PREFIX,
  /**
   * Mapping of X509 subject attribute name information.
   * @type {module:Pki~SubjectAttributes}
   */
  SUBJECT_ATTRIBUTES: SUBJECT_ATTRIBUTES
}
