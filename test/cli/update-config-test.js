'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var fs = require('fs')
var https = require('https')
var path = require('path')
var querystring = require('querystring')
var rimraf = require('rimraf')
var sinon = require('sinon')
var tmp = require('tmp')
var util = require('../../lib/util')
var cliHelpers = require('./cli-test-helpers')

var BROKER_LIST_COMMAND = '/remote/DxlClientMgmt.getBrokerList'
var CLIENT_CA_BUNDLE_COMMAND = '/remote/DxlClientMgmt.createClientCaBundle'
var BROKER_REQUEST_FILE = 'brokerrequest.json'

describe('updateconfig CLI command @cli', function () {
  var command
  var tmpDirSync
  var tmpDir
  var tmpBrokerRequestFile

  beforeEach(function () {
    command = cliHelpers.cliCommand()
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

    sinon.stub(https, 'get').callsFake(cliHelpers.createManagementServiceStub(
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
      .concat(configAfterBrokers).join(cliHelpers.LINE_SEPARATOR)
    var expectedCookie = util.generateIdAsString()
    var configFile = path.join(tmpDir, 'dxlclient.config')
    fs.writeFileSync(configFile, configBeforeBrokers.concat(brokersBeforeUpdate)
      .concat(configAfterBrokers).join(cliHelpers.LINE_SEPARATOR))
    stubUpdateCommands(expectedBrokersInHttpResponse, expectedCookie)
    command.doneCallback = function () {
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
      expectedRequest.path = CLIENT_CA_BUNDLE_COMMAND + '?:output=json'
      expect(caBundleRequest).to.eql(expectedRequest)

      // The management service stub stores the content of the broker list
      // request in a separate file. Confirm from the contents of that file
      // that the request had the expected content.
      expectedRequest.path = BROKER_LIST_COMMAND + '?%3Aoutput=json'
      expect(fs.existsSync(tmpBrokerRequestFile)).to.be.true
      expect(JSON.parse(fs.readFileSync(tmpBrokerRequestFile, 'utf-8'))).to
        .eql(expectedRequest)

      expect(fs.existsSync(configFile)).to.be.true
      expect(fs.readFileSync(configFile, 'utf-8')).to.equal(expectedConfigFile)
      done()
    }
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
    fs.writeFileSync(configFile, originalConfig.join(cliHelpers.LINE_SEPARATOR))
    stubUpdateCommands()
    command.doneCallback = function () {
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
    command.parse(cliArgs(['-t', '9443', '-e', trustedCaCert, '-u', 'admin',
      '-p', 'password', tmpDir, 'somehost']))
  })
})
