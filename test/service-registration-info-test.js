'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var dxl = require('../dxl-client')
var ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
var Client = dxl.Client
var Config = dxl.Config

describe('ServiceRegistrationInfo', function () {
  var client = new Client(
    new Config('fake bundle', 'fake cert', 'fake key', [])
  )

  context('constructor', function () {
    it('should store the parameter as the service type', function () {
      var expectedServiceType = 'my service type'
      var serviceInfo = new ServiceRegistrationInfo(client, expectedServiceType)
      expect(serviceInfo.serviceType).to.equal(expectedServiceType)
    })
  })

  context('.addTopic', function () {
    it('should store a single topic and callback', function () {
      var serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      var topic = 'my topic'
      var callback = function () {}

      expect(serviceInfo.topics).to.eql([])
      expect(serviceInfo.callbacks(topic)).to.eql([])

      serviceInfo.addTopic(topic, callback)

      expect(serviceInfo.topics).to.eql([topic])
      expect(serviceInfo.callbacks(topic)).to.eql([callback])
    })

    it('should store multiple topics and callbacks', function () {
      var serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      var topic1 = 'my topic 1'
      var callback1 = function () {}
      var topic2 = 'my topic 2'
      var callback2 = function () {}

      serviceInfo.addTopic(topic1, callback1)
      expect(serviceInfo.callbacks(topic2)).to.eql([])

      serviceInfo.addTopic(topic2, callback2)
      expect(serviceInfo.topics.sort()).to.eql([topic1, topic2].sort())
      expect(serviceInfo.callbacks(topic1)).to.eql([callback1])
      expect(serviceInfo.callbacks(topic2)).to.eql([callback2])
    })

    it('should store multiple callbacks for the same topic', function () {
      var serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      var topic = 'my topic'
      var callback1 = function () {}
      var callback2 = function () {}

      serviceInfo.addTopic(topic, callback1)
      serviceInfo.addTopic(topic, callback2)
      expect(serviceInfo.topics).to.eql([topic])
      expect(serviceInfo.callbacks(topic)).to.eql([callback1, callback2])
    })
  })

  context('.addTopics', function () {
    it('should store multiple topics and callbacks', function () {
      var serviceInfo = new ServiceRegistrationInfo(client, 'my service type')
      var sharedCallback = function () {}
      var topicsToCallbacks = {
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
