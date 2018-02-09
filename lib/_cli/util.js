'use strict'

/**
 * @module Util
 * @private
 */

var fs = require('fs')
var https = require('https')
var mkdirp = require('mkdirp')
var os = require('os')
var path = require('path')
var querystring = require('querystring')
var read = require('read')
var spawnSync = require('child_process').spawnSync
var tmp = require('tmp')
var url = require('url')
var which = require('which')
var CliError = require('./cli-error')

var HTTP_MAX_REDIRECTS = 5
var OPENSSL_CONF_ENV_VAR = 'OPENSSL_CONF'
var PUBLIC_KEY_BITS = 2048

var _0600 = parseInt('0600', 8)
var _0644 = parseInt('0644', 8)
var _0755 = parseInt('0755', 8)

function getErrorMessage (message, component, header) {
  if (typeof header === 'undefined') {
    header = ''
  }
  if (component) {
    if (header) {
      header += ' '
    }
    header += '('
    header += component
    header += ')'
  }
  if (header) {
    message = header + ': ' + message
  }
  return message
}

function logError (message, component, header) {
  message = getErrorMessage(message, component, header)
  if (typeof header === 'undefined') {
    message = 'ERROR: ' + message
  }
  console.error(message)
}

function throwError (message, component, header) {
  throw new CliError(getErrorMessage(message, component, header))
}

function buildQueryString (obj) {
  var query = Object.keys(obj).reduce(function (acc, key) {
    return acc + '&' + querystring.escape(key) + '=' +
      querystring.escape(obj[key])
  }, '')
  return query.replace(/^&/, '?')
}

function toUrlString (urlObject) {
  return 'https://' + urlObject.hostname + ':' + urlObject.port +
    '/' + urlObject.path
}

function httpGet (description, currentRedirects, requestOptions, queryString,
                  verbosity, responseCallback) {
  var requestUrl = toUrlString(requestOptions)
  var responseBody = ''

  if (verbosity > 1) {
    console.log('HTTP request to: ' + requestUrl)
  }

  var request = https.get(requestOptions, function (response) {
    if (verbosity > 1) {
      console.log('HTTP response status code: ' + response.statusCode)
    }
    if (response.statusCode === 302) {
      if (currentRedirects === HTTP_MAX_REDIRECTS) {
        throwError('Reached maximum redirects for request to ' +
          requestUrl, description)
      } else {
        var redirectLocation = response.headers.location
        if (!redirectLocation) {
          throwError('Redirect with no location specified for ' +
            requestUrl, description)
        }

        var parsedRedirectLocation = url.parse(redirectLocation)
        if ((parsedRedirectLocation.hostname &&
            (parsedRedirectLocation.hostname !== requestOptions.hostname)) ||
          (parsedRedirectLocation.port &&
            (parsedRedirectLocation.port !== requestOptions.port))) {
          throwError('Redirect to different host or port not supported. ' +
            'Original URL: ' + requestUrl +
            '. Redirect URL: ' + redirectLocation + '.', description)
        }

        if (response.headers['set-cookie']) {
          if (!requestOptions.headers) {
            requestOptions.headers = {}
          }
          requestOptions.headers['cookie'] = response.headers['set-cookie']
        }

        requestOptions.path = response.headers.location
        httpGet(description, currentRedirects + 1, requestOptions,
          queryString, responseCallback, verbosity)
      }
      response.resume()
      return
    }
    response.on('data', function (chunk) {
      responseBody += chunk
    })
    response.on('end', function () {
      if (response.statusCode >= 200 && response.statusCode <= 299) {
        responseCallback(responseBody)
      } else {
        throwError('Request to ' + requestUrl +
          ' failed with HTTP error code: ' + response.statusCode +
          '. Reason: ' + response.statusMessage + '.', description)
      }
    })
  })
  request.on('error', function (error) {
    throwError('Error processing request to ' + requestUrl + ': ' + error,
      description)
  })
}

function findOpenSslBin (opensslBin) {
  if (opensslBin) {
    if (!fs.existsSync(opensslBin)) {
      throwError('Unable to find openssl at: ' + opensslBin)
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
      throwError('Unable to find openssl from system path')
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
      logError(command.stderr, '', 'ERROR LOG')
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
    throwError(errorMessage, description)
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
  DEFAULT_CONFIG_FILE_NAME: 'dxlclient.config',
  getProgramVerbosity: function (program) {
    var verbosity = program.verbose
    if (program.silent) {
      verbosity = 0
    } else if (typeof verbosity === 'undefined') {
      verbosity = 1
    }
    return verbosity
  },
  addProgramArgsToAction: function (program, action) {
    return function () {
      Array.prototype.push.call(arguments,
        module.exports.getProgramVerbosity(program))
      action.apply(null, arguments)
    }
  },
  logError: logError,
  throwError: throwError,
  mkdirRecursive: function (dir) {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir, _0755)
    }
  },
  saveToFile: function (file, data) {
    module.exports.mkdirRecursive(path.dirname(file))
    fs.writeFileSync(file, data, {mode: _0644})
  },
  managementServiceRequest: function (description,
                                      hostName, port,
                                      userName, password,
                                      path, queryString,
                                      verbosity, responseCallback) {
    if (typeof queryString === 'undefined') {
      queryString = {}
    }
    queryString[':output'] = 'json'

    var requestOptions = {
      hostname: hostName,
      port: port,
      path: '/remote/' + path + buildQueryString(queryString),
      rejectUnauthorized: false,
      requestCert: false
    }
    var requestUrl = toUrlString(requestOptions)

    if (userName && password) {
      requestOptions.auth = userName + ':' + password
    }

    httpGet(description, 0, requestOptions,
      queryString, verbosity, function (response) {
        if (verbosity > 1) {
          console.log('Response: ' + response)
        }
        var responseStatusDelimiter = response.indexOf(':')
        if (responseStatusDelimiter < 0) {
          throwError("Did not find ':' status delimiter in response body " +
            'for request to: ' + requestUrl, description)
        }
        var status = response.substring(0, responseStatusDelimiter).trim()
        var responseDetail = response.substring(
          responseStatusDelimiter + 1).trim()
        if (status !== 'OK') {
          throwError('Request to ' + requestUrl + ' failed with status ' +
            status + '. Message: ' + responseDetail, description)
        }
        responseCallback(JSON.parse(responseDetail))
      })
  },
  getValueFromPrompt: function (title, confirm, callback) {
    var fullTitle = title.indexOf('Confirm') === 0 ? title : 'Enter ' + title
    fullTitle += ':'
    read({
      prompt: fullTitle,
      silent: true
    }, function (error, result) {
      if (error) {
        throwError('Error obtaining value for prompt: ' + title)
      }
      if (result) {
        if (confirm) {
          module.exports.getValueFromPrompt('Confirm ' + title, false,
            function (confirmationResult) {
              if (result === confirmationResult) {
                callback(result)
              } else {
                console.log('Values for ' + title + ' do not match. Try again.')
                module.exports.getValueFromPrompt(title, true, callback)
              }
            }
          )
        } else {
          callback(result)
        }
      } else {
        console.log('Value cannot be empty. Try again.')
        module.exports.getValueFromPrompt(title, confirm, callback)
      }
    })
  },
  fillEmptyArgsFromPrompt: function (options, args, callback, startPosition) {
    if (typeof startPosition === 'undefined') {
      startPosition = 0
    }
    if (startPosition < 0) {
      throw new RangeError('Start position must not be negative')
    }
    if (startPosition > args.length) {
      throw new RangeError('Start position (' + startPosition +
        ') is greater than length of args (' + args.length + ')')
    }
    if (startPosition === args.length) {
      callback(options)
    } else {
      var arg = args[startPosition]
      if (options[arg.name]) {
        module.exports.fillEmptyArgsFromPrompt(options, args, callback,
          startPosition + 1)
      } else {
        module.exports.getValueFromPrompt(arg.title || arg.name, arg.confirm,
          function (result) {
            options[arg.name] = result
            module.exports.fillEmptyArgsFromPrompt(options, args, callback,
              startPosition + 1)
          }
        )
      }
    }
  },
  fillEmptyServerCredentialsFromPrompt: function (options, callback) {
    module.exports.fillEmptyArgsFromPrompt(options, [
      {name: 'username', title: 'server user'},
      {name: 'password', title: 'server password'}
    ], callback)
  },
  runOpenSslCommand: runOpenSslCommandWithEnvVars,
  generatePrivateKeyAndCsr: function (configDir, commonName, command,
                                      verbosity) {
    module.exports.mkdirRecursive(configDir)
    var privateKeyFileName = path.join(configDir, command.filePrefix + '.key')
    generatePrivateKey(privateKeyFileName, command.opensslbin, verbosity)
    var csrFileName = path.join(configDir, command.filePrefix + '.csr')
    generateCsr(privateKeyFileName, csrFileName, commonName, command,
      verbosity)
    return {privateKeyFileName: privateKeyFileName, csrFileName: csrFileName}
  }
}
