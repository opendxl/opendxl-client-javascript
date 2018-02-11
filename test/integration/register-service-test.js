'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var util = require('../../lib/util')
var dxl = require('../..')
var Request = dxl.Request
var Response = dxl.Response
var ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

describe('registered services @integration', function () {
  var DXL_SERVICE_REGISTER_EVENT_TOPIC =
    '/mcafee/event/dxl/svcregistry/register'
  var DXL_SERVICE_UNREGISTER_EVENT_TOPIC =
    '/mcafee/event/dxl/svcregistry/unregister'

  function getTestService (client) {
    var topic = 'register_service_test_service_' + util.generateIdAsString()
    var regInfo = new ServiceRegistrationInfo(client,
      'register_service_test_service')
    regInfo.addTopic(topic, function (request) {
      var response = new Response(request)
      response.payload = 'Ok'
      client.sendResponse(response)
    })
    return regInfo
  }

  context('when service registered before connect', function () {
    it('should register service properly with broker', function (done) {
      var client = new TestClient(this, done)
      var regInfo = getTestService(client)

      client.addEventCallback(DXL_SERVICE_REGISTER_EVENT_TOPIC,
        function (event) {
          var registeredId = testHelpers.jsonPayloadToObject(event).serviceGuid
          if (registeredId === regInfo.serviceId) {
            client.addEventCallback(DXL_SERVICE_UNREGISTER_EVENT_TOPIC,
              function (event) {
                var unregisteredId =
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
      var client = new TestClient(this, done)
      var regInfo = getTestService(client)

      client.addEventCallback(DXL_SERVICE_REGISTER_EVENT_TOPIC,
        function (event) {
          var registeredId = testHelpers.jsonPayloadToObject(event).serviceGuid
          if (registeredId === regInfo.serviceId) {
            client.addEventCallback(DXL_SERVICE_UNREGISTER_EVENT_TOPIC,
              function (event) {
                var unregisteredId =
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
      var client = new TestClient(this, done)
      var regInfo = getTestService(client)
      client.registerServiceAsync(regInfo)
      client.connect(function () {
        var request = new Request(regInfo.topics[0])
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
        var client = new TestClient(this, done)
        var regInfo = getTestService(client)
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
