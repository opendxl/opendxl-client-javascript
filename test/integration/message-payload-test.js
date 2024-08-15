'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const Buffer = require('safe-buffer').Buffer
const BufferList = require('bl')
const expect = require('chai').expect
const msgpack = require('msgpack5')()
const dxl = require('../..')
const Request = dxl.Request
const ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
const util = require('../../lib/util')
const TestClient = require('./test-client')
const testHelpers = require('../test-helpers')

describe('message payload in an async request @integration', function () {
  context('with buffers of various sizes', function () {
    it('should be delivered with the expected content', function (done) {
      const expectedString = 'SslUtils'
      const expectedInt = 123456

      const requestsSent = {}
      const requestsReceived = {}
      const requestCount = 3

      const client = new TestClient(this, done)
      client.connect(function () {
        const topic = 'message_payload_test_buffers_' + util.generateIdAsString()
        const regInfo = new ServiceRegistrationInfo(client,
          'message_payload_test_buffers_service')

        regInfo.addTopic(topic, function (request) {
          if (requestsSent[request.messageId]) {
            requestsReceived[request.messageId] = request
            if (Object.keys(requestsReceived).length === requestCount) {
              client.shutdown(null, function () {
                Object.keys(requestsReceived).forEach(function (messageId) {
                  const payload = new BufferList(
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

        for (let index = 0; index < requestCount; index++) {
          const request = new Request(topic)
          const expectedBuffer = Buffer.alloc(Math.pow(2, index * 8) + 1, index + 1)
          const bufferList = new BufferList()
          bufferList.append(msgpack.encode(expectedString))
          bufferList.append(msgpack.encode(expectedBuffer))
          bufferList.append(msgpack.encode(expectedInt))
          request.payload = bufferList.slice()

          requestsSent[request.messageId] = {
            request,
            expectedBuffer
          }

          client.asyncRequest(request)
        }
      })
    })
  })
  context('with non-ASCII character in a string', function () {
    it('should be delivered with the expected context', function (done) {
      const expectedString = 'hello \ud83d\ude39'

      const client = new TestClient(this, done)
      client.connect(function () {
        const topic = 'message_payload_test_non_ascii_' +
          util.generateIdAsString()
        const regInfo = new ServiceRegistrationInfo(client,
          'message_payload_test_non_ascii_service')

        regInfo.addTopic(topic, function (request) {
          client.shutdown(null, function () {
            expect(testHelpers.decodePayload(request)).to.equal(expectedString)
            done()
          })
        })

        client.registerServiceAsync(regInfo)

        const request = new Request(topic)
        request.payload = expectedString
        client.asyncRequest(request)
      })
    })
  })
})
