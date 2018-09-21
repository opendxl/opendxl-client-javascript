'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var dxl = require('../..')
var ErrorResponse = dxl.ErrorResponse
var Message = dxl.Message
var Request = dxl.Request
var Response = dxl.Response
var ResponseErrorCode = dxl.ResponseErrorCode
var RequestError = dxl.RequestError
var ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
var util = require('../../lib/util')
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

var DXL_SERVICE_REGISTRY_QUERY_TOPIC = '/mcafee/service/dxl/svcregistry/query'

function registerTestService (client, callback, serviceType) {
  var topic = 'broker_service_registry_test_service_' +
    util.generateIdAsString()
  var regInfo = new ServiceRegistrationInfo(client, serviceType ||
    'broker_service_registry_test_service_' + util.generateIdAsString())
  regInfo.addTopic(topic, function (request) {
    var response = new Response(request)
    response.payload = 'Ok'
    client.sendResponse(response)
  })
  client.registerServiceAsync(regInfo, function () {
    callback(regInfo)
  })
}

function queryServiceRegistry (client, callback, query) {
  var request = new Request(DXL_SERVICE_REGISTRY_QUERY_TOPIC)
  request.payload = query || '{}'
  client.asyncRequest(request, function (error, response) {
    if (error) {
      throw error
    }
    var responsePayload = testHelpers.jsonPayloadToObject(response).services
    callback(responsePayload)
  })
}

function queryServiceRegistryByServiceId (client, serviceId, callback) {
  queryServiceRegistry(client,
    function (response) { callback(response[serviceId] || null) },
    JSON.stringify({serviceGuid: serviceId}))
}

function queryServiceRegistryByServiceType (client, serviceType, callback) {
  queryServiceRegistry(client, callback,
    JSON.stringify({serviceType: serviceType}))
}

function queryServiceRegistryByService (client, callback, serviceRegInfo) {
  queryServiceRegistryByServiceId(client, serviceRegInfo.serviceId, callback)
}

describe('broker service registry @integration', function () {
  it('should return service for query by id', function (done) {
    var client = new TestClient(this, done)
    client.connect(function () {
      registerTestService(client, function (regInfo) {
        queryServiceRegistryByServiceId(client, regInfo.serviceId,
          function (serviceEntryAfterRegistration) {
            client.unregisterServiceAsync(regInfo, function () {
              queryServiceRegistryByServiceId(client, regInfo.serviceId,
                function (serviceEntryAfterUnregistration) {
                  client.shutdown(null, function () {
                    // Validate that the service was initially
                    // registered with the broker.
                    expect(serviceEntryAfterRegistration).to.not.be.null
                    // Validate that the broker unregistered the
                    // service after the request made to the service
                    // failed.
                    expect(serviceEntryAfterUnregistration).to.be.null
                    done()
                  })
                }
              )
            })
          }
        )
      })
    })
  })

  it('should return service for query by type', function (done) {
    var client = new TestClient(this, done)
    client.connect(function () {
      // Register two services (regInfo1 and regInfo2) with the same serviceType
      // and one service (regInfo3) with a different serviceType. When querying
      // the registry using regInfo1's serviceType, expect entries to be
      // returned for regInfo1 and regInfo2 but not regInfo3 (since the
      // serviceType for the latter would not match the query).
      registerTestService(client, function (regInfo1) {
        registerTestService(client, function (regInfo2) {
          registerTestService(client, function (regInfo3) {
            queryServiceRegistryByServiceType(client, regInfo1.serviceType,
              function (serviceEntries) {
                client.shutdown(null, function () {
                  expect(serviceEntries).to.have.property(regInfo1.serviceId)
                  expect(serviceEntries).to.have.property(regInfo2.serviceId)
                  expect(serviceEntries).to.not.have.property(
                    regInfo3.serviceId)
                  done()
                })
              }
            )
          })
        }, regInfo1.serviceType)
      })
    })
  })

  it('should round-robin requests to registered services', function (done) {
    var test = this
    var serviceCount = 10
    var requestsPerService = 10
    var requestsToSend = serviceCount * requestsPerService
    var requestsByService = {}
    var requestsSentToWrongServiceId = 0
    var requestsReceived = 0
    var responsesReceived = 0
    var errorResponsesReceived = 0

    var serviceClient = new TestClient(this, done)
    serviceClient.connect(function () {
      var serviceType = 'registry_round_robin_test_service'
      var topic = 'registry_round_robin_test_' + util.generateIdAsString()
      var requestCallback = function (callbackServiceId, request) {
        requestsReceived++
        if (request.serviceId && callbackServiceId !== request.serviceId) {
          requestsSentToWrongServiceId++
        }
        if (requestsByService[request.serviceId]) {
          requestsByService[request.serviceId]++
        } else {
          requestsByService[request.serviceId] = 1
        }
        serviceClient.sendResponse(new Response(request))
      }
      Array.apply(null, new Array(serviceCount)).forEach(function () {
        var regInfo = new ServiceRegistrationInfo(serviceClient, serviceType)
        regInfo.addTopic(topic, function (request) {
          requestCallback(regInfo.serviceId, request)
        })
        serviceClient.registerServiceAsync(regInfo)
      })
      var requestClient = new TestClient(test, done)
      requestClient.connect(function () {
        Array.apply(null, new Array(requestsToSend)).forEach(function () {
          var request = new Request(topic)
          serviceClient.asyncRequest(request, function (error) {
            responsesReceived++
            if (error) {
              console.log('Error received for request: ' + error)
              errorResponsesReceived++
            }
            if (responsesReceived === requestsToSend) {
              requestClient.shutdown(null, function () {
                serviceClient.shutdown(null, function () {
                  var serviceIds = Object.keys(requestsByService)
                  expect(requestsSentToWrongServiceId).to.equal(0)
                  expect(errorResponsesReceived).to.equal(0)
                  expect(requestsReceived).to.equal(requestsToSend)
                  expect(serviceIds.length).to.equal(serviceCount)
                  serviceIds.forEach(function (serviceId) {
                    expect(requestsByService[serviceId]).to.equal(
                      requestsPerService)
                  })
                  done()
                })
              })
            }
          })
        })
      })
    })
  })

  it('should route requests to multiple services', function (done) {
    var test = this
    var serviceClient = new TestClient(this, done)
    serviceClient.connect(function () {
      var regInfoTopic1 = 'multiple_services_test_1_' + util.generateIdAsString()
      var regInfo1 = new ServiceRegistrationInfo(serviceClient,
        'multiple_services_test_1')
      regInfo1.addTopic(regInfoTopic1, function (request) {
        var response = new Response(request)
        response.payload = 'service1'
        serviceClient.sendResponse(response)
      })
      serviceClient.registerServiceAsync(regInfo1)
      var regInfoTopic2 = 'multiple_services_test_2_' + util.generateIdAsString()
      var regInfo2 = new ServiceRegistrationInfo(serviceClient,
        'multiple_services_test_2')
      regInfo2.addTopic(regInfoTopic2, function (request) {
        var response = new Response(request)
        response.payload = 'service2'
        serviceClient.sendResponse(response)
      })
      serviceClient.registerServiceAsync(regInfo2)
      var requestClient = new TestClient(test, done)
      requestClient.connect(function () {
        var regInfoRequest1 = new Request(regInfoTopic1)
        requestClient.asyncRequest(regInfoRequest1, function (
          regInfoErrorResponse1, regInfoResponse1) {
          var regInfoRequest2 = new Request(regInfoTopic2)
          requestClient.asyncRequest(regInfoRequest2,
            function (regInfoErrorResponse2, regInfoResponse2) {
              serviceClient.unregisterServiceAsync(regInfo1, function () {
                serviceClient.unregisterServiceAsync(regInfo2, function () {
                  requestClient.shutdown(null, function () {
                    serviceClient.shutdown(null, function () {
                      expect(regInfoErrorResponse1).to.be.null
                      expect(regInfoErrorResponse2).to.be.null
                      expect(testHelpers.decodePayload(regInfoResponse1)).to
                        .equal('service1')
                      expect(testHelpers.decodePayload(regInfoResponse2)).to
                        .equal('service2')
                      done()
                    })
                  })
                })
              })
            }
          )
        })
      })
    })
  })

  it('should route request to its specified service id', function (done) {
    var test = this
    var serviceCount = 10
    var requestsToSend = serviceCount * 10
    var requestsByService = {}
    var requestsSentToWrongServiceId = 0
    var requestsReceived = 0
    var responsesReceived = 0
    var errorResponsesReceived = 0

    var serviceClient = new TestClient(this, done)
    serviceClient.connect(function () {
      var serviceType = 'registry_specified_service_id_test'
      var topic = 'registry_specified_service_id_test_' +
        util.generateIdAsString()
      var requestCallback = function (callbackServiceId, request) {
        requestsReceived++
        if (request.serviceId && callbackServiceId !== request.serviceId) {
          requestsSentToWrongServiceId++
        }
        if (requestsByService[request.serviceId]) {
          requestsByService[request.serviceId]++
        } else {
          requestsByService[request.serviceId] = 1
        }
        serviceClient.sendResponse(new Response(request))
      }
      var firstServiceId
      Array.apply(null, new Array(serviceCount)).forEach(function () {
        var regInfo = new ServiceRegistrationInfo(serviceClient, serviceType)
        if (!firstServiceId) {
          firstServiceId = regInfo.serviceId
        }
        regInfo.addTopic(topic, function (request) {
          requestCallback(regInfo.serviceId, request)
        })
        serviceClient.registerServiceAsync(regInfo)
      })
      var requestClient = new TestClient(test, done)
      requestClient.connect(function () {
        Array.apply(null, new Array(requestsToSend)).forEach(function () {
          var request = new Request(topic)
          request.serviceId = firstServiceId
          serviceClient.asyncRequest(request, function (error, response) {
            responsesReceived++
            if (error) {
              console.log('Error received for request: ' + error)
              errorResponsesReceived++
            }
            if (responsesReceived === requestsToSend) {
              requestClient.shutdown(null, function () {
                serviceClient.shutdown(null, function () {
                  expect(requestsSentToWrongServiceId).to.equal(0)
                  expect(errorResponsesReceived).to.equal(0)
                  expect(requestsReceived).to.equal(requestsToSend)
                  expect(Object.keys(requestsByService).length).to.equal(1)
                  expect(requestsByService).to.have.property(firstServiceId,
                    requestsToSend)
                  done()
                })
              })
            }
          })
        })
      })
    })
  })

  it('should process requests when same service reregistered', function (done) {
    var test = this
    var serviceRegistrations = 10
    var requestsReceived = 0
    var errorResponsesReceived = 0
    var responsesReceived = 0
    var serviceClient = new TestClient(this, done)
    serviceClient.connect(function () {
      var topic = 'service_reregistration_test_' + util.generateIdAsString()
      var regInfo = new ServiceRegistrationInfo(serviceClient,
        'service_registration_test')
      regInfo.addTopic(topic, function (request) {
        requestsReceived++
        serviceClient.sendResponse(new Response(request))
      })

      var registerAndSend = function (attemptsRemaining, callback) {
        if (attemptsRemaining === 0) {
          callback()
        } else {
          serviceClient.registerServiceAsync(regInfo, function () {
            var requestClient = new TestClient(test, done)
            requestClient.connect(function () {
              requestClient.asyncRequest(new Request(topic),
                function (error) {
                  responsesReceived++
                  if (error) {
                    console.log('Error received for request: ' + error)
                    errorResponsesReceived++
                  }
                  requestClient.shutdown(null, function () {
                    serviceClient.unregisterServiceAsync(regInfo,
                      function () {
                        registerAndSend(--attemptsRemaining, callback)
                      }
                    )
                  })
                }
              )
            })
          })
        }
      }

      registerAndSend(serviceRegistrations, function () {
        serviceClient.shutdown(null, function () {
          expect(requestsReceived).to.equal(serviceRegistrations)
          expect(errorResponsesReceived).to.equal(0)
          expect(responsesReceived).to.equal(requestsReceived)
          done()
        })
      })
    })
  })

  it('should return error response for request to unsubscribed registered service',
    function (done) {
      var test = this
      var requestReceived = false
      var serviceClient = new TestClient(this, done)
      serviceClient.connect(function () {
        var topic = 'registered_unsubscribed_service_test_' +
          util.generateIdAsString()
        var regInfo = new ServiceRegistrationInfo(serviceClient,
          'registered_unsubscribed_service_test_')
        regInfo.addTopic(topic, function (request) {
          requestReceived = true
          serviceClient.sendResponse(new Response(request))
        })
        serviceClient.registerServiceAsync(regInfo, function () {
          serviceClient.unsubscribe(topic)
          queryServiceRegistryByService(serviceClient,
            function (serviceEntryAfterRegistration) {
              var requestClient = new TestClient(test, done)
              requestClient.connect(function () {
                requestClient.asyncRequest(new Request(topic),
                  function (error, response) {
                    queryServiceRegistryByService(serviceClient,
                      function (serviceEntryAfterRequest) {
                        requestClient.shutdown(null, function () {
                          serviceClient.shutdown(null, function () {
                            // The request should receive an 'unavailable
                            // service' error response because the service
                            // client is no longer subscribed for the
                            // topic it previously registered for the service.
                            expect(requestReceived).to.be.false
                            expect(response).to.be.null
                            expect(error).to.be.an.instanceof(RequestError)
                            expect(error.code).to.equal(
                              ResponseErrorCode.SERVICE_UNAVAILABLE)
                            expect(error.message).to.equal(
                              testHelpers.DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE)
                            expect(error.dxlErrorResponse).to.be.an.instanceof(
                              ErrorResponse)
                            // Validate that the service was initially
                            // registered with the broker.
                            expect(serviceEntryAfterRegistration).to.not.be.null
                            // Validate that the broker unregistered the
                            // service after the request made to the service
                            // failed.
                            expect(serviceEntryAfterRequest).to.be.null
                            done()
                          })
                        })
                      }, regInfo
                    )
                  }
                )
              })
            }, regInfo
          )
        })
      })
    }
  )

  it('should return error response for request when no service with id registered',
    function (done) {
      var test = this
      var requestReceived = false
      var serviceClient = new TestClient(this, done)
      serviceClient.connect(function () {
        var topic = 'service_not_matching_id_test_' + util.generateIdAsString()
        var regInfo = new ServiceRegistrationInfo(serviceClient,
          'service_not_matching_id_test_')
        regInfo.addTopic(topic, function (request) {
          requestReceived = true
          serviceClient.sendResponse(new Response(request))
        })
        serviceClient.registerServiceAsync(regInfo, function () {
          queryServiceRegistryByService(serviceClient,
            function (serviceEntryAfterRegistration) {
              var requestClient = new TestClient(test, done)
              requestClient.connect(function () {
                // Remove the service's registration with the client-side
                // CallbackManager and ServiceManager, avoiding unregistration
                // of the service from the broker. This should allow the
                // broker to forward the request on to the service client.
                var registeredServices = serviceClient._serviceManager._services
                serviceClient._callbackManager.removeCallback(
                  Message.MESSAGE_TYPE_REQUEST, topic,
                  registeredServices[regInfo.serviceId]
                    .callbacksByTopic[topic][0])
                var registeredService = registeredServices[regInfo.serviceId]
                delete registeredServices[regInfo.serviceId]
                requestClient.asyncRequest(new Request(topic),
                  function (error, response) {
                    queryServiceRegistryByService(serviceClient,
                      function (serviceEntryAfterRequest) {
                        requestClient.shutdown(null, function () {
                          // Re-register the service with the internal
                          // ServiceManager so that its resources (TTL timeout,
                          // etc.) can be cleaned up properly at shutdown.
                          registeredServices[regInfo.serviceId] =
                            registeredService
                          serviceClient.shutdown(null, function () {
                            // The request should receive an 'unavailable
                            // service' error response because the service
                            // client should be unable to route the request
                            // to an internally registered service.
                            expect(requestReceived).to.be.false
                            expect(response).to.be.null
                            expect(error).to.be.an.instanceof(RequestError)
                            expect(error.code).to.equal(
                              ResponseErrorCode.SERVICE_UNAVAILABLE)
                            expect(error.message).to.equal(
                              testHelpers.DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE)
                            expect(error.dxlErrorResponse).to.be.an.instanceof(
                              ErrorResponse)
                            // Validate that the service was initially
                            // registered with the broker.
                            expect(serviceEntryAfterRegistration).to.not.be.null
                            // Validate that the broker unregistered the
                            // service after the request made to the service
                            // failed.
                            expect(serviceEntryAfterRequest).to.be.null
                            done()
                          })
                        })
                      }, regInfo
                    )
                  }
                )
              })
            }, regInfo
          )
        })
      })
    }
  )
})
