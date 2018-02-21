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

var PROVISION_COMMAND = '/remote/DxlBrokerMgmt.generateOpenDXLClientProvisioningPackageCmd'

describe('provisionconfig CLI command @cli', function () {
  var command
  var tmpDirSync
  var tmpDir

  beforeEach(function () {
    command = cliHelpers.cliCommand()
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
    if (typeof clientCert === 'undefined') {
      clientCert = 'clientcert'
    }
    if (typeof brokers === 'undefined') {
      brokers = ['local=local;8883;localhost']
    }
    var requestHandlers = {}
    requestHandlers[PROVISION_COMMAND] = function (requestOptions) {
      return [querystring.escape(JSON.stringify(requestOptions)),
        clientCert, brokers.join('\n')].join(',')
    }
    sinon.stub(https, 'get').callsFake(cliHelpers.createManagementServiceStub(
      requestHandlers, cookie))
  }

  it('should store a config provisioned from the server', function (done) {
    var expectedClientCert = 'myclientcert' + cliHelpers.LINE_SEPARATOR
    var expectedBrokers = ['local=local;8883;localhost;127.0.0.1',
      'external=external;8883;127.0.0.1;127.0.0.1']
    var expectedCookie = util.generateIdAsString()
    stubProvisionCommand(expectedClientCert, expectedBrokers, expectedCookie)
    command.doneCallback = function () {
      // Validate that a CSR with the expected common name was generated
      var csrFileName = path.join(tmpDir, 'client3.csr')
      expect(fs.existsSync(csrFileName)).to.be.true
      expect(cliHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
      // Validate that a proper RSA private key was generated
      var privateKeyFileName = path.join(tmpDir, 'client3.key')
      cliHelpers.validateRsaPrivateKey(privateKeyFileName)
      // Validate that the 'CA certificate bundle' returned by the management
      // service stub was stored. This stub sets the content of the bundle
      // to the full request for convenience in testing.
      var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
      expect(fs.existsSync(caBundleFileName)).to.be.true
      // Validate that the request to the provisioning endpoint contained
      // the expected content.
      var actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
        caBundleFileName)))
      expect({
        hostname: 'myhost',
        port: '8443',
        path: PROVISION_COMMAND + '?csrString=' +
          querystring.escape(fs.readFileSync(csrFileName)) + '&%3Aoutput=json',
        auth: 'myuser:mypass',
        rejectUnauthorized: false,
        requestCert: false,
        headers: {cookie: expectedCookie}
      }).to.eql(actualRequestData)
      // Validate that the 'client certificate' returned by the management
      // service stub was stored.
      var certFileName = path.join(tmpDir, 'client3.crt')
      expect(fs.existsSync(certFileName)).to.be.true
      expect(fs.readFileSync(certFileName, 'utf-8')).to.equal(
        expectedClientCert)
      // Validate that the DXL client config file stored from the management
      // service request contained the expected content.
      var configFile = path.join(tmpDir, 'dxlclient.config')
      expect(fs.existsSync(configFile)).to.be.true
      var expectedConfigFile = ['[Certs]',
        'BrokerCertChain=ca-bundle.crt',
        'CertFile=client3.crt',
        'PrivateKey=client3.key',
        '',
        '[Brokers]']
      Array.prototype.push.apply(expectedConfigFile, expectedBrokers)
      expectedConfigFile.push('')
      expectedConfigFile = expectedConfigFile.join(cliHelpers.LINE_SEPARATOR)
      expect(fs.readFileSync(configFile, 'utf-8')).to.equal(expectedConfigFile)
      done()
    }
    command.parse(cliArgs(['-u', 'myuser', '-p', 'mypass', '-f', 'client3',
      'myhost', 'client2']))
  })

  it('should avoid regenerating a csr when one is provided', function (done) {
    var csrText = 'fakecsr'
    var csrFileName = path.join(tmpDir, 'test.csr')
    fs.writeFileSync(csrFileName, csrText)
    stubProvisionCommand()
    command.doneCallback = function () {
      // Validate that the CSR file still has the same contents as it did
      // before the CLI command was run - i.e., that it was not regenerated.
      expect(fs.existsSync(csrFileName)).to.be.true
      expect(fs.readFileSync(csrFileName, 'utf-8')).to.equal(csrText)
      // Validate that the CSR sent to the management service was the one
      // specified as a command line argument.
      var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
      expect(fs.existsSync(caBundleFileName)).to.be.true
      var actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
        caBundleFileName)))
      expect(actualRequestData).to.have.property('path',
        PROVISION_COMMAND + '?csrString=' + querystring.escape(csrText) +
        '&%3Aoutput=json')
      done()
    }
    command.parse(cliArgs(['-u', 'testuser', '-p', 'testpass', 'testhost',
      csrFileName, '-r']))
  })

  it('should use a trusted ca cert and port when provided', function (done) {
    var trustedCaText = 'fakecacert'
    var trustedCaCert = path.join(tmpDir, 'trustedca.crt')
    fs.writeFileSync(trustedCaCert, trustedCaText)
    stubProvisionCommand()
    command.doneCallback = function () {
      var caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
      expect(fs.existsSync(caBundleFileName)).to.be.true
      var actualRequestData = JSON.parse(querystring.unescape(fs.readFileSync(
        caBundleFileName)))
      expect(actualRequestData).to.have.property('port', '9443')
      expect(actualRequestData).to.have.property('rejectUnauthorized', true)
      expect(actualRequestData).to.have.property('requestCert', true)
      expect(actualRequestData).to.have.deep.property('ca',
        JSON.parse(JSON.stringify(Buffer.from(trustedCaText))))
      done()
    }
    command.parse(cliArgs(['-t', '9443', '-e', trustedCaCert, '-u', 'myuser',
      '-p', 'mypass', 'myhost', 'client']))
  })
})
