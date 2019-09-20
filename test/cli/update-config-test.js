'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var fs = require('fs')
var https = require('https')
var os = require('os')
var path = require('path')
var querystring = require('querystring')
var rimraf = require('rimraf')
var sinon = require('sinon')
var tmp = require('tmp')
var DxlError = require('../..').DxlError
var util = require('../../lib/util')
var cliHelpers = require('./cli-test-helpers')
var pkiHelpers = require('../pki-test-helpers')

var BROKER_LIST_COMMAND = '/remote/DxlClientMgmt.getBrokerList'
var CLIENT_CA_BUNDLE_COMMAND = '/remote/DxlClientMgmt.createClientCaBundle'
var BROKER_REQUEST_FILE = 'brokerrequest.json'

describe('updateconfig CLI command @cli', function () {
  var tmpDirSync
  var tmpDir
  var tmpBrokerRequestFile

  beforeEach(function () {
    tmpDirSync = tmp.dirSync()
    tmpDir = tmpDirSync.name
    tmpBrokerRequestFile = path.join(tmpDir, BROKER_REQUEST_FILE)
  })

  afterEach(function () {
    if (https.get.restore) {
      https.get.restore()
    }
    rimraf.sync(tmpDir)
  })

  function cliArgs (args) {
    return ['node', 'dxlclient', 'updateconfig'].concat(args)
  }

  function stubUpdateCommands (brokers, cookie) {
    if (typeof brokers === 'undefined') {
      brokers = [{
        guid: 'local',
        hostName: 'localhost',
        ipAddress: '127.0.0.1',
        port: '8883'
      }]
    }

    var requestHandlers = {}
    requestHandlers[BROKER_LIST_COMMAND] = function (requestOptions) {
      fs.writeFileSync(tmpBrokerRequestFile, JSON.stringify(requestOptions))
      return JSON.stringify({brokers: brokers, certVersion: 0})
    }
    requestHandlers[CLIENT_CA_BUNDLE_COMMAND] = function (requestOptions) {
      return JSON.stringify(requestOptions)
    }

    sinon.stub(https, 'get').callsFake(pkiHelpers.createManagementServiceStub(
      requestHandlers, cookie))
  }

  it('should update a ca bundle and config from the server', function (done) {
    // A DXL client config file with a single broker entry, 'oldbroker', is
    // stored before making the updateconfig request. This test confirms that
    // the 'oldbroker' entry is replaced with the new broker list that the
    // management service returns - and that the CA certificate bundle file
    // is also updated to the latest bundle returned by the server. Comment
    // lines in the original DXL client config file should be preserved
    // after the update.
    var configBeforeBrokers = ['[Certs]',
      '# This is the cert chain',
      'BrokerCertChain=ca-bundle.crt',
      'CertFile=client3.crt',
      'PrivateKey=client3.key',
      '',
      '# These are the brokers',
      '[Brokers]']
    var brokersBeforeUpdate = [
      'oldbroker=oldbroker;9922;oldbrokerhost;127.0.0.6']
    var configAfterBrokers = ['',
      '# Some other config',
      '[Dontcare]',
      'some=thing']

    var expectedBrokersInConfig = ['12345=12345;8883;firstbroker;127.0.0.2',
      '67890=67890;8993;secondbroker;127.0.0.3']
    var expectedBrokersInHttpResponse = [{
      guid: '12345',
      hostName: 'firstbroker',
      ipAddress: '127.0.0.2',
      port: '8883'
    }, {
      guid: '67890',
      hostName: 'secondbroker',
      ipAddress: '127.0.0.3',
      port: '8993'
    }]

    var expectedConfigFile = configBeforeBrokers
      .concat(expectedBrokersInConfig)
      .concat(configAfterBrokers).join(os.EOL)
    var expectedCookie = util.generateIdAsString()
    var configFile = path.join(tmpDir, 'dxlclient.config')
    fs.writeFileSync(configFile, configBeforeBrokers.concat(brokersBeforeUpdate)
      .concat(configAfterBrokers).join(os.EOL))
    stubUpdateCommands(expectedBrokersInHttpResponse, expectedCookie)
    var command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        // Validate that the 'CA certificate bundle' returned by the management
        // service stub was stored. This stub sets the content of the bundle
        // to the full request for convenience in testing.
        var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        var expectedRequest = {
          hostname: 'somehost',
          port: '8443',
          auth: 'admin:password',
          rejectUnauthorized: false,
          requestCert: false,
          headers: {cookie: expectedCookie}
        }
        var caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        // ignore agent/proxy settings when comparing if exists
        delete caBundleRequest.agent
        expectedRequest.path = CLIENT_CA_BUNDLE_COMMAND + '?:output=json'
        expect(caBundleRequest).to.eql(expectedRequest)

        // The management service stub stores the content of the broker list
        // request in a separate file. Confirm from the contents of that file
        // that the request had the expected content.
        expectedRequest.path = BROKER_LIST_COMMAND + '?%3Aoutput=json'
        expect(fs.existsSync(tmpBrokerRequestFile)).to.be.true
        var brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile, 'utf-8'))
        // ignore agent/proxy settings when comparing if exists
        delete brokerRequest.agent
        expect(brokerRequest).to.eql(expectedRequest)

        expect(fs.existsSync(configFile)).to.be.true
        expect(fs.readFileSync(configFile, 'utf-8')).to.equal(expectedConfigFile)
        done()
      }
    )
    command.parse(cliArgs(['-u', 'admin', '-p', 'password', tmpDir,
      'somehost']))
  })

  it('should use a trusted ca cert and port when provided', function (done) {
    var trustedCaText = 'fakecacert'
    var trustedCaCert = path.join(tmpDir, 'trustedca.crt')
    var expectedTrustedCaText = JSON.parse(JSON.stringify(Buffer.from(
      trustedCaText)))
    fs.writeFileSync(trustedCaCert, trustedCaText)

    var originalConfig = ['[Certs]',
      'BrokerCertChain=ca-bundle.crt',
      '',
      '[Brokers]',
      '']
    var configFile = path.join(tmpDir, 'dxlclient.config')
    fs.writeFileSync(configFile, originalConfig.join(os.EOL))
    stubUpdateCommands()
    var command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        var caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        expect(caBundleRequest).to.have.property('port', '9443')
        expect(caBundleRequest).to.have.property('rejectUnauthorized', true)
        expect(caBundleRequest).to.have.property('requestCert', true)
        expect(caBundleRequest).to.have.deep.property('ca', expectedTrustedCaText)

        var brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile,
          'utf-8'))
        expect(brokerRequest).to.have.property('port', '9443')
        expect(brokerRequest).to.have.property('rejectUnauthorized', true)
        expect(brokerRequest).to.have.property('requestCert', true)
        expect(brokerRequest).to.have.deep.property('ca', expectedTrustedCaText)
        done()
      }
    )
    command.parse(cliArgs(['-t', '9443', '-e', trustedCaCert, '-u', 'admin',
      '-p', 'password', tmpDir, 'somehost']))
  })

  it('should prompt for server username and password options with no value',
    function (done) {
      var userName = 'thetestuser'
      var password = 'thetestpassword'
      stubUpdateCommands()
      var stdinStub = new cliHelpers.StdinStub([userName, password])
      var stdoutStub = new cliHelpers.StdoutStub()
      var originalConfig = ['[Certs]',
        'BrokerCertChain=ca-bundle.crt',
        '',
        '[Brokers]',
        '']
      var configFile = path.join(tmpDir, 'dxlclient.config')
      fs.writeFileSync(configFile, originalConfig.join(
        os.EOL))
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          stdinStub.restore()
          stdoutStub.restore()
          expect(stdoutStub.data).to.equal(
            'Enter server user: Enter server password: ')
          var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
          expect(fs.existsSync(caBundleFileName)).to.be.true
          var caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
            caBundleFileName)))
          expect(caBundleRequest).to.have.property('auth',
            userName + ':' + password)
          var brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile,
            'utf-8'))
          expect(brokerRequest).to.have.property('auth',
            userName + ':' + password)
          done()
        }
      )
      command.parse(cliArgs([tmpDir, 'myhost']))
    }
  )

  it('should return error if DXL config file cannot be found',
    function (done) {
      // Management service with no request stubs should generate an HTTP 404
      // error
      sinon.stub(https, 'get').callsFake(
        pkiHelpers.createManagementServiceStub([]))

      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.an.instanceof(DxlError)
          expect(error.message).to.have.string('Unable to read config file')
          done()
        }
      )
      command.parse(cliArgs(['-u', 'admin', '-p', 'password', tmpDir,
        'somehost']))
    }
  )

  it('should return 404 error if management service endpoints cannot be found',
    function (done) {
      var configFile = path.join(tmpDir, 'dxlclient.config')
      var config = ['[Certs]', 'BrokerCertChain=ca-bundle.crt']
      fs.writeFileSync(configFile, config.join(os.EOL))

      // Management service with no request stubs should generate an HTTP 404
      // error
      sinon.stub(https, 'get').callsFake(
        pkiHelpers.createManagementServiceStub([]))

      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.an.instanceof(DxlError)
          expect(error.message).to.have.string('HTTP error code: 404')
          done()
        }
      )
      command.parse(cliArgs(['-u', 'admin', '-p', 'password', tmpDir,
        'somehost']))
    }
  )
})
