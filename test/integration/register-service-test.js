'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const util = require('../../lib/util')
const dxl = require('../..')
const Request = dxl.Request
const Response = dxl.Response
const ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
const TestClient = require('./test-client')
const testHelpers = require('../test-helpers')

describe('registered services @integration', function () {
  const DXL_SERVICE_REGISTER_EVENT_TOPIC =
    '/mcafee/event/dxl/svcregistry/register'
  const DXL_SERVICE_UNREGISTER_EVENT_TOPIC =
    '/mcafee/event/dxl/svcregistry/unregister'

  function getTestService (client) {
    const topic = 'register_service_test_service_' + util.generateIdAsString()
    const regInfo = new ServiceRegistrationInfo(client,
      'register_service_test_service')
    regInfo.addTopic(topic, function (request) {
      const response = new Response(request)
      response.payload = 'Ok'
      client.sendResponse(response)
    })
    return regInfo
  }

  context('when service registered before connect', function () {
    it('should register service properly with broker', function (done) {
      const client = new TestClient(this, done)
      const regInfo = getTestService(client)

      client.addEventCallback(DXL_SERVICE_REGISTER_EVENT_TOPIC,
        function (event) {
          const registeredId = testHelpers.jsonPayloadToObject(event).serviceGuid
          if (registeredId === regInfo.serviceId) {
            client.addEventCallback(DXL_SERVICE_UNREGISTER_EVENT_TOPIC,
              function (event) {
                const unregisteredId =
                  testHelpers.jsonPayloadToObject(event).serviceGuid
                if (unregisteredId === regInfo.serviceId) {
                  client.shutdown(null, done)
                }
              })
            client.unregisterServiceAsync(regInfo)
          }
        })

      client.registerServiceAsync(regInfo)
      client.connect()
    })
  })

  context('when service registered after connect', function () {
    it('should register service properly with broker', function (done) {
      const client = new TestClient(this, done)
      const regInfo = getTestService(client)

      client.addEventCallback(DXL_SERVICE_REGISTER_EVENT_TOPIC,
        function (event) {
          const registeredId = testHelpers.jsonPayloadToObject(event).serviceGuid
          if (registeredId === regInfo.serviceId) {
            client.addEventCallback(DXL_SERVICE_UNREGISTER_EVENT_TOPIC,
              function (event) {
                const unregisteredId =
                  testHelpers.jsonPayloadToObject(event).serviceGuid
                if (unregisteredId === regInfo.serviceId) {
                  client.shutdown(null, done)
                }
              })
            client.unregisterServiceAsync(regInfo)
          }
        })

      client.connect(function () {
        client.registerServiceAsync(regInfo)
      })
    })
  })

  context('when service registered with broker', function () {
    it('should be able to send a request', function (done) {
      const client = new TestClient(this, done)
      const regInfo = getTestService(client)
      client.registerServiceAsync(regInfo)
      client.connect(function () {
        const request = new Request(regInfo.topics[0])
        request.payload = 'Test'
        client.asyncRequest(request, function (error, response) {
          client.shutdown(error, function () {
            expect(testHelpers.decodePayload(response)).to.equal('Ok')
            done()
          })
        })
      })
    })
  })

  context('when disconnect called before service can be registered',
    function () {
      it('should successfully disconnect', function (done) {
        const client = new TestClient(this, done)
        const regInfo = getTestService(client)
        client.registerServiceAsync(regInfo)
        client.connect()
        client.shutdown(null, function () {
          expect(client.subscriptions).to.be.empty
          expect(client.connected).to.be.false
          done()
        })
      })
    }
  )
})
