'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var fs = require('fs')
var sinon = require('sinon')
var Broker = require('../lib/broker')
var Config = require('../lib/config')
var MalformedBrokerError = require('../lib/malformed-broker-error')

describe('Config', function () {
  context('when built from a config file', function () {
    var fileName = 'dxlclient.config'
    var configFile = [
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

    var readStub = sinon.stub(fs, 'readFileSync')
    readStub.withArgs('dxlclient.config').returns(configFile)
    readStub.withArgs('mycertchain.crt').returns('the cert chain')
    readStub.withArgs('mycert.crt').returns('the cert')
    readStub.withArgs('mykey.key').returns('the private key')

    var config = Config.createDxlConfigFromFile(fileName)

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
        var broker = config.brokers[0]
        expect(broker.hosts).to.eql(['127.0.0.1'])
        expect(broker.uniqueId).to.equal('broker1')
        expect(broker.port).to.equal(8883)
      })

    it('should return from the file the broker with two host entries',
      function () {
        var broker = config.brokers[1]
        expect(broker.hosts).to.eql(['localhost', '127.0.0.2'])
        expect(broker.uniqueId).to.equal('broker2')
        expect(broker.port).to.equal(9883)
      })

    it('should return from the file the broker with no id', function () {
      var broker = config.brokers[2]
      expect(broker.hosts).to.eql(['127.0.0.3'])
      expect(broker.uniqueId).to.be.null
      expect(broker.port).to.equal(10883)
    })

    it('should raise a malformed broker error for a bad broker port number',
      function () {
        var fileName = 'bad_broker_port.config'
        var configFile = [
          '[Certs]',
          'BrokerCertChain=mycertchain.crt',
          'CertFile=mycert.crt',
          'PrivateKey=mykey.key',
          '',
          '[Brokers]',
          'broker1=broker1;notaport;127.0.0.1'
        ].join('\n')

        sinon.stub(fs, 'existsSync').returns(true)

        var readStub = sinon.stub(fs, 'readFileSync')
        readStub.withArgs('bad_broker_port.config').returns(configFile)
        readStub.withArgs('mycertchain.crt').returns('the cert chain')
        readStub.withArgs('mycert.crt').returns('the cert')
        readStub.withArgs('mykey.key').returns('the private key')

        expect(function () { Config.createDxlConfigFromFile(fileName) }).to
          .throw(MalformedBrokerError)

        fs.existsSync.restore()
        readStub.restore()
      })
  })
  context('when specifying settings during construction', function () {
    var config = new Config('the cert chain', 'the cert', 'the private key',
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
        var broker = config.brokers[0]
        expect(broker.hosts).to.eql(['127.0.0.1'])
        expect(broker.uniqueId).to.equal('broker1')
        expect(broker.port).to.equal(8883)
      })

    it('should return from the file the broker with two host entries',
      function () {
        var broker = config.brokers[1]
        expect(broker.hosts).to.eql(['localhost', '127.0.0.2'])
        expect(broker.uniqueId).to.equal('broker2')
        expect(broker.port).to.equal(9883)
      })

    it('should return from the file the broker with no id', function () {
      var broker = config.brokers[2]
      expect(broker.hosts).to.eql(['127.0.0.3'])
      expect(broker.uniqueId).to.be.null
      expect(broker.port).to.equal(10883)
    })
  })
})
