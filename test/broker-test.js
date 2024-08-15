'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Broker = require('..').Broker

describe('Broker', function () {
  context('.parse', function () {
    it('should construct a broker from a host name', function () {
      const broker = Broker.parse('mybroker')
      expect(broker).to.be.an.instanceof(Broker)
      expect(broker.hosts).to.eql(['mybroker'])
      expect(broker.port).to.equal(8883)
    })

    it('should construct a broker from a host name and port', function () {
      const broker = Broker.parse('mybroker:8993')
      expect(broker).to.be.an.instanceof(Broker)
      expect(broker.hosts).to.eql(['mybroker'])
      expect(broker.port).to.equal(8993)
    })

    it('should construct a broker from a protocol and host name', function () {
      const broker = Broker.parse('ssl://mybroker')
      expect(broker).to.be.an.instanceof(Broker)
      expect(broker.hosts).to.eql(['mybroker'])
      expect(broker.port).to.equal(8883)
    })

    it('should construct a broker from a protocol, host name, and port',
      function () {
        const broker = Broker.parse('ssl://mybroker:8993')
        expect(broker).to.be.an.instanceof(Broker)
        expect(broker.hosts).to.eql(['mybroker'])
        expect(broker.port).to.equal(8993)
      })

    it('should generate an id for a broker instance', function () {
      const broker = Broker.parse('mybroker')
      expect(broker).to.be.an.instanceof(Broker)
      expect(broker.uniqueId).to.not.be.empty
    })

    context('with an IPv6-based hostname and no port', function () {
      it('should construct a broker with brackets stripped', function () {
        const broker = Broker.parse('[ff02::1]')
        expect(broker).to.be.an.instanceof(Broker)
        expect(broker.hosts).to.eql(['ff02::1'])
        expect(broker.port).to.equal(8883)
      })
    })

    context('with an IPv6-based hostname and a port', function () {
      it('should construct a broker with brackets stripped', function () {
        const broker = Broker.parse('[ff02::1]:8993')
        expect(broker).to.be.an.instanceof(Broker)
        expect(broker.hosts).to.eql(['ff02::1'])
        expect(broker.port).to.equal(8993)
      })
    })
  })
})
