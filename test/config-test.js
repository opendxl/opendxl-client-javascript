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
const dxl = require('..')
const Broker = dxl.Broker
const Config = dxl.Config
const DxlError = dxl.DxlError
const MalformedBrokerError = dxl.MalformedBrokerError
const util = require('../lib/util')
const pkiHelpers = require('./pki-test-helpers')

describe('Config', function () {
  after(function () {
    if (fs.existsSync.restore) {
      fs.existsSync.restore()
    }
    if (fs.readFileSync.restore) {
      fs.readFileSync.restore()
    }
  })

  context('when built from a config file', function () {
    const fileName = 'dxlclient.config'
    const configFile = [
      '# Comment that should be ignored',
      '[General]',
      'ClientId=myclientid',
      '',
      '; Another comment that should be ignored',
      '[Certs]',
      'BrokerCertChain=mycertchain.crt',
      'CertFile=mycert.crt',
      'PrivateKey=mykey.key',
      '',
      '[Brokers]',
      'broker1=broker1;8883;127.0.0.1',
      'broker2=broker2;9883;localhost;127.0.0.2',
      'broker3=10883;127.0.0.3'
    ].join('\n')

    sinon.stub(fs, 'existsSync').returns(true)

    const readStub = sinon.stub(fs, 'readFileSync')
    readStub.withArgs('dxlclient.config').returns(configFile)
    readStub.withArgs('mycertchain.crt').returns('the cert chain')
    readStub.withArgs('mycert.crt').returns('the cert')
    readStub.withArgs('mykey.key').returns('the private key')

    const config = Config.createDxlConfigFromFile(fileName)

    fs.existsSync.restore()
    readStub.restore()

    it('should return the client id from the file', function () {
      expect(config._clientId).to.equal('myclientid')
    })

    it('should return the broker ca bundle from the file', function () {
      expect(config.brokerCaBundle).to.equal('the cert chain')
    })

    it('should return the cert file from the file', function () {
      expect(config.cert).to.equal('the cert')
    })

    it('should return the private key from the file', function () {
      expect(config.privateKey).to.equal('the private key')
    })

    it('should return the number of brokers from the file', function () {
      expect(config.brokers.length).to.equal(3)
    })

    it('should return from the file the broker with one host entry',
      function () {
        const broker = config.brokers[0]
        expect(broker.hosts).to.eql(['127.0.0.1'])
        expect(broker.uniqueId).to.equal('broker1')
        expect(broker.port).to.equal(8883)
      })

    it('should return from the file the broker with two host entries',
      function () {
        const broker = config.brokers[1]
        expect(broker.hosts).to.eql(['localhost', '127.0.0.2'])
        expect(broker.uniqueId).to.equal('broker2')
        expect(broker.port).to.equal(9883)
      })

    it('should return from the file the broker with no id', function () {
      const broker = config.brokers[2]
      expect(broker.hosts).to.eql(['127.0.0.3'])
      expect(broker.uniqueId).to.be.null
      expect(broker.port).to.equal(10883)
    })

    it('should raise a malformed broker error for a bad broker port number',
      function () {
        const fileName = 'bad_broker_port.config'
        const configFile = [
          '[Certs]',
          'BrokerCertChain=mycertchain.crt',
          'CertFile=mycert.crt',
          'PrivateKey=mykey.key',
          '',
          '[Brokers]',
          'broker1=broker1;notaport;127.0.0.1'
        ].join('\n')

        sinon.stub(fs, 'existsSync').returns(true)

        const readStub = sinon.stub(fs, 'readFileSync')
        readStub.withArgs('bad_broker_port.config').returns(configFile)
        readStub.withArgs('mycertchain.crt').returns('the cert chain')
        readStub.withArgs('mycert.crt').returns('the cert')
        readStub.withArgs('mykey.key').returns('the private key')

        expect(function () { Config.createDxlConfigFromFile(fileName) }).to
          .throw(MalformedBrokerError)

        fs.existsSync.restore()
        readStub.restore()
      })

    it('should return the proxy info from the file',
      function () {
        const fileName = 'withproxy.config'
        const configFile = [
          '# Comment that should be ignored',
          '[General]',
          'ClientId=myclientid',
          '',
          '; Another comment that should be ignored',
          '[Certs]',
          'BrokerCertChain=mycertchain.crt',
          'CertFile=mycert.crt',
          'PrivateKey=mykey.key',
          '',
          '[Brokers]',
          'broker1=broker1;8883;127.0.0.1',
          'broker2=broker2;9883;localhost;127.0.0.2',
          'broker3=10883;127.0.0.3',
          '',
          '[BrokersWebSockets]',
          'broker2=broker2;8443;test;10.25.10.11',
          '',
          '[Proxy]',
          'Address=10.25.0.1',
          'Port=3128',
          'User=user',
          'Password=Welcome2dxl'
        ].join('\n')

        sinon.stub(fs, 'existsSync').returns(true)

        const readStub = sinon.stub(fs, 'readFileSync')
        readStub.withArgs('withproxy.config').returns(configFile)
        readStub.withArgs('mycertchain.crt').returns('the cert chain')
        readStub.withArgs('mycert.crt').returns('the cert')
        readStub.withArgs('mykey.key').returns('the private key')

        const config = Config.createDxlConfigFromFile(fileName)

        fs.existsSync.restore()
        readStub.restore()
        // validate websockets
        const broker = config._webSocketBrokers[0]
        expect(broker.hosts).to.eql(['test', '10.25.10.11'])
        expect(broker.uniqueId).to.equal('broker2')
        expect(broker.port).to.equal(8443)
        // validate proxy
        const proxy = config.proxy
        expect(proxy.address).to.equal('10.25.0.1')
        expect(proxy.port).to.equal(3128)
        expect(proxy.user).to.equal('user')
        expect(proxy.password).to.equal('Welcome2dxl')
      })

    it('should raise an error for a missing proxy port number',
      function () {
        const fileName = 'no_proxy_port.config'
        const configFile = [
          '# Comment that should be ignored',
          '[General]',
          'ClientId=myclientid',
          '',
          '; Another comment that should be ignored',
          '[Certs]',
          'BrokerCertChain=mycertchain.crt',
          'CertFile=mycert.crt',
          'PrivateKey=mykey.key',
          '',
          '[Brokers]',
          'broker1=broker1;8883;127.0.0.1',
          '',
          '[Proxy]',
          'Address=10.25.0.1',
          'User=user',
          'Password=Welcome2dxl'
        ].join('\n')

        sinon.stub(fs, 'existsSync').returns(true)

        const readStub = sinon.stub(fs, 'readFileSync')
        readStub.withArgs('no_proxy_port.config').returns(configFile)
        readStub.withArgs('mycertchain.crt').returns('the cert chain')
        readStub.withArgs('mycert.crt').returns('the cert')
        readStub.withArgs('mykey.key').returns('the private key')

        expect(function () { Config.createDxlConfigFromFile(fileName) }).to
          .throw(DxlError)

        fs.existsSync.restore()
        readStub.restore()
      })

    it('should raise an error for a missing proxy password',
      function () {
        const fileName = 'no_proxy_password.config'
        const configFile = [
          '# Comment that should be ignored',
          '[General]',
          'ClientId=myclientid',
          '',
          '; Another comment that should be ignored',
          '[Certs]',
          'BrokerCertChain=mycertchain.crt',
          'CertFile=mycert.crt',
          'PrivateKey=mykey.key',
          '',
          '[Brokers]',
          'broker1=broker1;8883;127.0.0.1',
          '',
          '[Proxy]',
          'Address=10.25.0.1',
          'Port=8080',
          'User=user'
        ].join('\n')

        sinon.stub(fs, 'existsSync').returns(true)

        const readStub = sinon.stub(fs, 'readFileSync')
        readStub.withArgs('no_proxy_password.config').returns(configFile)
        readStub.withArgs('mycertchain.crt').returns('the cert chain')
        readStub.withArgs('mycert.crt').returns('the cert')
        readStub.withArgs('mykey.key').returns('the private key')

        expect(function () { Config.createDxlConfigFromFile(fileName) }).to
          .throw(DxlError)

        fs.existsSync.restore()
        readStub.restore()
      })
  })
  context('when specifying settings during construction', function () {
    const config = new Config('the cert chain', 'the cert', 'the private key',
      [
        new Broker(['127.0.0.1'], 'broker1'),
        new Broker(['localhost', '127.0.0.2'], 'broker2', 9883),
        new Broker(['127.0.0.3'], null, 10883)
      ])

    it('should return a uuid-formatted client id', function () {
      expect(config._clientId).to.match(
        /{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}/)
    })

    it('should return the broker ca bundle from the file', function () {
      expect(config.brokerCaBundle).to.equal('the cert chain')
    })

    it('should return the cert file from the file', function () {
      expect(config.cert).to.equal('the cert')
    })

    it('should return the private key from the file', function () {
      expect(config.privateKey).to.equal('the private key')
    })

    it('should return the number of brokers from the file', function () {
      expect(config.brokers.length).to.equal(3)
    })

    it('should return from the file the broker with one host entry',
      function () {
        const broker = config.brokers[0]
        expect(broker.hosts).to.eql(['127.0.0.1'])
        expect(broker.uniqueId).to.equal('broker1')
        expect(broker.port).to.equal(8883)
      })

    it('should return from the file the broker with two host entries',
      function () {
        const broker = config.brokers[1]
        expect(broker.hosts).to.eql(['localhost', '127.0.0.2'])
        expect(broker.uniqueId).to.equal('broker2')
        expect(broker.port).to.equal(9883)
      })

    it('should return from the file the broker with no id', function () {
      const broker = config.brokers[2]
      expect(broker.hosts).to.eql(['127.0.0.3'])
      expect(broker.uniqueId).to.be.null
      expect(broker.port).to.equal(10883)
    })
  })
  context('when provisioning', function () {
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

    function stubProvisionCommand (clientCert, brokers, cookie) {
      sinon.stub(https, 'get').callsFake(
        pkiHelpers.createProvisionCommandStub(clientCert, brokers, cookie))
    }

    it('should store the config provided by the server', function (done) {
      const expectedClientCert = 'myclientcert' + os.EOL
      const expectedBrokers = ['local=local;8883;localhost;127.0.0.1',
        'external=external;8883;127.0.0.1;127.0.0.1']
      const expectedCookie = util.generateIdAsString()
      stubProvisionCommand(expectedClientCert, expectedBrokers, expectedCookie)
      Config.provisionConfig(tmpDir, 'client2',
        {
          hostname: 'myhost',
          user: 'myuser',
          password: 'mypass'
        },
        {
          filePrefix: 'client3',
          doneCallback: function (error) {
            expect(error).to.be.null
            // Validate that a CSR with the expected common name was generated
            const csrFileName = path.join(tmpDir, 'client3.csr')
            expect(fs.existsSync(csrFileName)).to.be.true
            // format is different for version of openssl used
            try {
              expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
            } catch (e) {
              expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client2')
            }
            // Validate that a proper RSA private key was generated
            const privateKeyFileName = path.join(tmpDir, 'client3.key')
            pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
            // Validate that the 'CA certificate bundle' returned by the
            // management service stub was stored. This stub sets the content of
            // the bundle to the full request for convenience in testing.
            const caBundleFileName = path.join(tmpDir, 'ca-bundle.crt')
            expect(fs.existsSync(caBundleFileName)).to.be.true
            // Validate that the request to the provisioning endpoint contained
            // the expected content.
            const actualRequestData = JSON.parse(querystring.unescape(
              fs.readFileSync(caBundleFileName)))
            // ignore agent/proxy settings when comparing
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
            // Validate that the DXL client config file stored from the
            // management service request contained the expected content.
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
            expect(fs.readFileSync(configFile, 'utf-8')).to.equal(
              expectedConfigFile)
            done()
          }
        }
      )
    })
    it('should return a 404 error if the management endpoints cannot be found',
      function (done) {
        // Management service with no request stubs should generate an HTTP 404
        // error
        sinon.stub(https, 'get').callsFake(
          pkiHelpers.createManagementServiceStub([]))
        Config.provisionConfig(tmpDir, 'client2',
          {
            hostname: 'myhost',
            user: 'myuser',
            password: 'mypass'
          },
          {
            filePrefix: 'client3',
            doneCallback: function (error) {
              expect(error).to.be.an.instanceof(DxlError)
              expect(error.message).to.have.string('HTTP error code: 404')
              done()
            }
          }
        )
      }
    )
  })
})
