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

describe('provisionconfig CLI command @cli', function () {
  let tmpDirSync
  let tmpDir

  beforeEach(function () {
    tmpDirSync = tmp.dirSync()
    tmpDir = tmpDirSync.name
  })

  afterEach(function () {
    if (https.get.restore) {
      https.get.restore()
    }
    rimraf.sync(tmpDir)
  })

  function cliArgs (args) {
    return ['node', 'dxlclient', 'provisionconfig', tmpDir].concat(args)
  }

  function stubProvisionCommand (clientCert, brokers, cookie) {
    sinon.stub(https, 'get').callsFake(pkiHelpers.createProvisionCommandStub(
      clientCert, brokers, cookie))
  }

  it('should store a config provisioned from the server', function (done) {
    const expectedClientCert = 'myclientcert' + os.EOL
    const expectedBrokers = ['local=local;8883;localhost;127.0.0.1',
      'external=external;8883;127.0.0.1;127.0.0.1']
    const expectedCookie = util.generateIdAsString()
    stubProvisionCommand(expectedClientCert, expectedBrokers, expectedCookie)
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        // Validate that a CSR with the expected common name was generated
        const csrFileName = path.join(tmpDir, 'client3.csr')
        expect(fs.existsSync(csrFileName)).to.be.true
        // format is different based on openssl version
        try {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
        } catch (e) {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client2')
        }
        // Validate that a proper RSA private key was generated
        const privateKeyFileName = path.join(tmpDir, 'client3.key')
        pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
        // Validate that the 'CA certificate bundle' returned by the management
        // service stub was stored. This stub sets the content of the bundle
        // to the full request for convenience in testing.
        const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        // Validate that the request to the provisioning endpoint contained
        // the expected content.
        const actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        // ignore agent/proxy settings when comparing if exists
        delete actualRequestData.agent
        const expectedRequestPath = pkiHelpers.PROVISION_COMMAND +
          '?csrString=' + querystring.escape(fs.readFileSync(csrFileName)) +
          '&%3Aoutput=json'
        expect({
          hostname: 'myhost',
          port: '8443',
          path: expectedRequestPath,
          auth: 'myuser:mypass',
          rejectUnauthorized: false,
          requestCert: false,
          headers: { cookie: expectedCookie }
        }).to.eql(actualRequestData)
        // Validate that the 'client certificate' returned by the management
        // service stub was stored.
        const certFileName = path.join(tmpDir, 'client3.crt')
        expect(fs.existsSync(certFileName)).to.be.true
        expect(fs.readFileSync(certFileName, 'utf-8')).to.equal(
          expectedClientCert)
        // Validate that the DXL client config file stored from the management
        // service request contained the expected content.
        const configFile = path.join(tmpDir, 'dxlclient.config')
        expect(fs.existsSync(configFile)).to.be.true
        let expectedConfigFile = ['[General]',
          '#UseWebSockets=false',
          '',
          '[Certs]',
          'BrokerCertChain=ca-bundle.crt',
          'CertFile=client3.crt',
          'PrivateKey=client3.key',
          '',
          '[Brokers]']
        Array.prototype.push.apply(expectedConfigFile, expectedBrokers)
        expectedConfigFile.push('')
        expectedConfigFile.push('[BrokersWebSockets]')
        expectedConfigFile.push('')
        expectedConfigFile = expectedConfigFile.join(os.EOL)
        expect(fs.readFileSync(configFile, 'utf-8')).to.equal(expectedConfigFile)
        done()
      }
    )
    command.parse(cliArgs(['-u', 'myuser', '-p', 'mypass', '-f', 'client3',
      'myhost', 'client2']))
  })

  it('should avoid regenerating a csr when one is provided', function (done) {
    const csrText = 'fakecsr'
    const csrFileName = path.join(tmpDir, 'test.csr')
    fs.writeFileSync(csrFileName, csrText)
    stubProvisionCommand()
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        // Validate that the CSR file still has the same contents as it did
        // before the CLI command was run - i.e., that it was not regenerated.
        expect(fs.existsSync(csrFileName)).to.be.true
        expect(fs.readFileSync(csrFileName, 'utf-8')).to.equal(csrText)
        // Validate that the CSR sent to the management service was the one
        // specified as a command line argument.
        const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        const actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        const expectedRequestPath = pkiHelpers.PROVISION_COMMAND +
          '?csrString=' + querystring.escape(csrText) + '&%3Aoutput=json'
        expect(actualRequestData).to.have.property('path', expectedRequestPath)
        done()
      }
    )
    command.parse(cliArgs(['-u', 'testuser', '-p', 'testpass', 'testhost',
      csrFileName, '-r']))
  })

  it('should use a trusted ca cert and port when provided', function (done) {
    const trustedCaText = 'fakecacert'
    const trustedCaCert = path.join(tmpDir, 'trustedca.crt')
    fs.writeFileSync(trustedCaCert, trustedCaText)
    stubProvisionCommand()
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
        expect(fs.existsSync(caBundleFileName)).to.be.true
        const actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
          caBundleFileName)))
        expect(actualRequestData).to.have.property('port', '9443')
        expect(actualRequestData).to.have.property('rejectUnauthorized', true)
        expect(actualRequestData).to.have.property('requestCert', true)
        expect(actualRequestData).to.have.deep.property('ca',
          JSON.parse(JSON.stringify(Buffer.from(trustedCaText))))
        done()
      }
    )
    command.parse(cliArgs(['-t', '9443', '-e', trustedCaCert, '-u', 'myuser',
      '-p', 'mypass', 'myhost', 'client']))
  })

  it('should prompt for server username and password options with no value',
    function (done) {
      const userName = 'testuser'
      const password = 'testpassword'
      stubProvisionCommand()
      const stdinStub = new cliHelpers.StdinStub([userName, password])
      const stdoutStub = new cliHelpers.StdoutStub()
      const command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          stdinStub.restore()
          stdoutStub.restore()
          expect(stdoutStub.data).to.equal(
            'Enter server user: Enter server password: ')
          const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
          expect(fs.existsSync(caBundleFileName)).to.be.true
          const actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
            caBundleFileName)))
          expect(actualRequestData).to.have.property('auth',
            userName + ':' + password)
          done()
        }
      )
      command.parse(cliArgs(['myhost', 'client']))
    }
  )

  it('should return 404 error if the management endpoints cannot be found',
    function (done) {
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
      command.parse(cliArgs(['-u', 'myuser', '-p', 'mypass', 'myhost',
        'client2']))
    }
  )
})
