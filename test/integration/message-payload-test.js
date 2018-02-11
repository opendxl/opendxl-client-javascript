'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var Buffer = require('safe-buffer').Buffer
var BufferList = require('bl')
var expect = require('chai').expect
var msgpack = require('msgpack5')()
var dxl = require('../..')
var Request = dxl.Request
var ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
var util = require('../../lib/util')
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

describe('message payload in an async request @integration', function () {
  context('with buffers of various sizes', function () {
    it('should be delivered with the expected content', function (done) {
      var expectedString = 'SslUtils'
      var expectedInt = 123456

      var requestsSent = {}
      var requestsReceived = {}
      var requestCount = 3

      var client = new TestClient(this, done)
      client.connect(function () {
        var topic = 'message_payload_test_buffers_' + util.generateIdAsString()
        var regInfo = new ServiceRegistrationInfo(client,
          'message_payload_test_buffers_service')

        regInfo.addTopic(topic, function (request) {
          if (requestsSent[request.messageId]) {
            requestsReceived[request.messageId] = request
            if (Object.keys(requestsReceived).length === requestCount) {
              client.shutdown(null, function () {
                Object.keys(requestsReceived).forEach(function (messageId) {
                  var payload = new BufferList(
                    requestsReceived[messageId].payload
                  )
                  expect(msgpack.decode(payload)).to.equal(expectedString)
                  expect(msgpack.decode(payload)).to.eql(
                    requestsSent[messageId].expectedBuffer
                  )
                  expect(msgpack.decode(payload)).to.equal(expectedInt)
                })
                done()
              })
            }
          }
        })
        client.registerServiceAsync(regInfo)

        for (var index = 0; index < requestCount; index++) {
          var request = new Request(topic)
          var expectedBuffer = Buffer.alloc(Math.pow(2, index * 8) + 1, index + 1)
          var bufferList = new BufferList()
          bufferList.append(msgpack.encode(expectedString))
          bufferList.append(msgpack.encode(expectedBuffer))
          bufferList.append(msgpack.encode(expectedInt))
          request.payload = bufferList.slice()

          requestsSent[request.messageId] = {
            request: request,
            expectedBuffer: expectedBuffer
          }

          client.asyncRequest(request)
        }
      })
    })
  })
  context('with non-ASCII character in a string', function () {
    it('should be delivered with the expected context', function (done) {
      var expectedString = 'hello \ud83d\ude39'

      var client = new TestClient(this, done)
      client.connect(function () {
        var topic = 'message_payload_test_non_ascii_' +
          util.generateIdAsString()
        var regInfo = new ServiceRegistrationInfo(client,
          'message_payload_test_non_ascii_service')

        regInfo.addTopic(topic, function (request) {
          client.shutdown(null, function () {
            expect(testHelpers.decodePayload(request)).to.equal(expectedString)
            done()
          })
        })

        client.registerServiceAsync(regInfo)

        var request = new Request(topic)
        request.payload = expectedString
        client.asyncRequest(request)
      })
    })
  })
})
