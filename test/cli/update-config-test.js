'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const querystring = require('querystring')
const rimraf = require('rimraf')
const sinon = require('sinon')
const tmp = require('tmp')
const DxlError = require('../..').DxlError
const util = require('../../lib/util')
const cliHelpers = require('./cli-test-helpers')
const pkiHelpers = require('../pki-test-helpers')

const BROKER_LIST_COMMAND = '/remote/DxlClientMgmt.getBrokerList'
const CLIENT_CA_BUNDLE_COMMAND = '/remote/DxlClientMgmt.createClientCaBundle'
const BROKER_REQUEST_FILE = 'brokerrequest.json'

describe('updateconfig CLI command @cli', function () {
  let tmpDirSync
  let tmpDir
  let tmpBrokerRequestFile

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

    const requestHandlers = {}
    requestHandlers[BROKER_LIST_COMMAND] = function (requestOptions) {
      fs.writeFileSync(tmpBrokerRequestFile, JSON.stringify(requestOptions))
      return JSON.stringify({ brokers, certVersion: 0 })
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
    const configBeforeBrokers = ['[Certs]',
      '# This is the cert chain',
      'BrokerCertChain=ca-bundle.crt',
      'CertFile=client3.crt',
      'PrivateKey=client3.key',
      '',
      '# These are the brokers',
      '[Brokers]']
    const brokersBeforeUpdate = [
      'oldbroker=oldbroker;9922;oldbrokerhost;127.0.0.6']
    const configAfterBrokers = ['',
      '# Some other config',
      '[Dontcare]',
      'some=thing']

    const expectedBrokersInConfig = ['12345=12345;8883;firstbroker;127.0.0.2',
      '67890=67890;8993;secondbroker;127.0.0.3']
    const expectedBrokersInHttpResponse = [{
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

    const expectedConfigFile = configBeforeBrokers
      .concat(expectedBrokersInConfig)
      .concat(configAfterBrokers).join(os.EOL)
    const expectedCookie = util.generateIdAsString()
    const configFile = path.join(tmpDir, 'dxlclient.config')
    fs.writeFileSync(configFile, configBeforeBrokers.concat(brokersBeforeUpdate)
      .concat(configAfterBrokers).join(os.EOL))
    stubUpdateCommands(expectedBrokersInHttpResponse, expectedCookie)
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        // Validate that the 'CA certificate bundle' returned by the management
        // service stub was stored. This stub sets the content of the bundle
        // to the full request for convenience in testing.
        const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        const expectedRequest = {
          hostname: 'somehost',
          port: '8443',
          auth: 'admin:password',
          rejectUnauthorized: false,
          requestCert: false,
          headers: { cookie: expectedCookie }
        }
        const caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
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
        const brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile, 'utf-8'))
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
    const trustedCaText = 'fakecacert'
    const trustedCaCert = path.join(tmpDir, 'trustedca.crt')
    const expectedTrustedCaText = JSON.parse(JSON.stringify(Buffer.from(
      trustedCaText)))
    fs.writeFileSync(trustedCaCert, trustedCaText)

    const originalConfig = ['[Certs]',
      'BrokerCertChain=ca-bundle.crt',
      '',
      '[Brokers]',
      '']
    const configFile = path.join(tmpDir, 'dxlclient.config')
    fs.writeFileSync(configFile, originalConfig.join(os.EOL))
    stubUpdateCommands()
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        const caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        expect(caBundleRequest).to.have.property('port', '9443')
        expect(caBundleRequest).to.have.property('rejectUnauthorized', true)
        expect(caBundleRequest).to.have.property('requestCert', true)
        expect(caBundleRequest).to.have.deep.property('ca', expectedTrustedCaText)

        const brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile,
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
      const userName = 'thetestuser'
      const password = 'thetestpassword'
      stubUpdateCommands()
      const stdinStub = new cliHelpers.StdinStub([userName, password])
      const stdoutStub = new cliHelpers.StdoutStub()
      const originalConfig = ['[Certs]',
        'BrokerCertChain=ca-bundle.crt',
        '',
        '[Brokers]',
        '']
      const configFile = path.join(tmpDir, 'dxlclient.config')
      fs.writeFileSync(configFile, originalConfig.join(
        os.EOL))
      const command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          stdinStub.restore()
          stdoutStub.restore()
          expect(stdoutStub.data).to.equal(
            'Enter server user: Enter server password: ')
          const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
          expect(fs.existsSync(caBundleFileName)).to.be.true
          const caBundleRequest = JSON.parse(querystring.unescape(fs.readFileSync(
            caBundleFileName)))
          expect(caBundleRequest).to.have.property('auth',
            userName + ':' + password)
          const brokerRequest = JSON.parse(fs.readFileSync(tmpBrokerRequestFile,
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

      const command = cliHelpers.cliCommand(
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
      const configFile = path.join(tmpDir, 'dxlclient.config')
      const config = ['[Certs]', 'BrokerCertChain=ca-bundle.crt']
      fs.writeFileSync(configFile, config.join(os.EOL))

      // Management service with no request stubs should generate an HTTP 404
      // error
      sinon.stub(https, 'get').callsFake(
        pkiHelpers.createManagementServiceStub([]))

      const command = cliHelpers.cliCommand(
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
