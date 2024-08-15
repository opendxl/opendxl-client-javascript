'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('..')
const ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
const Client = dxl.Client
const Config = dxl.Config

describe('ServiceRegistrationInfo', function () {
  const client = new Client(
    new Config('fake bundle', 'fake cert', 'fake key', [])
  )

  context('constructor', function () {
    it('should store the parameter as the service type', function () {
      const expectedServiceType = 'my service type'
      const serviceInfo = new ServiceRegistrationInfo(client, expectedServiceType)
      expect(serviceInfo.serviceType).to.equal(expectedServiceType)
    })
  })

  context('.addTopic', function () {
    it('should store a single topic and callback', function () {
      const serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      const topic = 'my topic'
      const callback = function () {}

      expect(serviceInfo.topics).to.eql([])
      expect(serviceInfo.callbacks(topic)).to.eql([])

      serviceInfo.addTopic(topic, callback)

      expect(serviceInfo.topics).to.eql([topic])
      expect(serviceInfo.callbacks(topic)).to.eql([callback])
    })

    it('should store multiple topics and callbacks', function () {
      const serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      const topic1 = 'my topic 1'
      const callback1 = function () {}
      const topic2 = 'my topic 2'
      const callback2 = function () {}

      serviceInfo.addTopic(topic1, callback1)
      expect(serviceInfo.callbacks(topic2)).to.eql([])

      serviceInfo.addTopic(topic2, callback2)
      expect(serviceInfo.topics.sort()).to.eql([topic1, topic2].sort())
      expect(serviceInfo.callbacks(topic1)).to.eql([callback1])
      expect(serviceInfo.callbacks(topic2)).to.eql([callback2])
    })

    it('should store multiple callbacks for the same topic', function () {
      const serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      const topic = 'my topic'
      const callback1 = function () {}
      const callback2 = function () {}

      serviceInfo.addTopic(topic, callback1)
      serviceInfo.addTopic(topic, callback2)
      expect(serviceInfo.topics).to.eql([topic])
      expect(serviceInfo.callbacks(topic)).to.eql([callback1, callback2])
    })
  })

  context('.addTopics', function () {
    it('should store multiple topics and callbacks', function () {
      const serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      const sharedCallback = function () {}
      const topicsToCallbacks = {
        topic1: sharedCallback,
        topic2: function () {},
        topic3: sharedCallback
      }

      serviceInfo.addTopics(topicsToCallbacks)
      expect(serviceInfo.topics.sort()).to.eql(Object.keys(topicsToCallbacks))
      expect(serviceInfo.callbacks('topic1')).to.eql([topicsToCallbacks.topic1])
      expect(serviceInfo.callbacks('topic2')).to.eql([topicsToCallbacks.topic2])
      expect(serviceInfo.callbacks('topic3')).to.eql([topicsToCallbacks.topic3])
    })
  })
})
