'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var Buffer = require('safe-buffer').Buffer
var BufferList = require('bl')
var expect = require('chai').expect
var msgpack = require('msgpack5')()
var Request = require('../../lib/request')
var ServiceRegistrationInfo = require('../../lib/service_registration_info')
var util = require('../../lib/util')
var TestClient = require('./test_client')

describe('message payload in an async request @integration', function () {
  it('should be delivered with the expected content', function (done) {
    var expectedString = 'SslUtils'
    var expectedInt = 123456

    var requestsSent = {}
    var requestsReceived = {}
    var requestCount = 3

    var testClient = new TestClient(this, done)
    var dxlClient = testClient.client
    dxlClient.connect(function () {
      var topic = 'message_payload_test_' + util.generateIdAsString()
      var regInfo = new ServiceRegistrationInfo(dxlClient,
        'message_payload_test_service')

      regInfo.addTopic(topic, function (request) {
        if (requestsSent[request.messageId]) {
          requestsReceived[request.messageId] = request
          if (Object.keys(requestsReceived).length === requestCount) {
            testClient.destroy(null, function () {
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
      dxlClient.registerServiceAsync(regInfo)

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

        dxlClient.asyncRequest(request)
      }
    })
  })
})
