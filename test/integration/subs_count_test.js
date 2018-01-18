'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../../lib/request')
var util = require('../../lib/util')
var TestClient = require('./test_client')
var testHelpers = require('../test_helpers')

describe('broker subs count @integration', function () {
  it('should return expected values for topic subscriptions', function (done) {
    var maxTestTime = 5000

    var random1 = util.generateIdAsString()
    var random2 = util.generateIdAsString()
    var topic1 = 'subs_count_test/foo/' + random1 + '/' + random2
    var topic2 = 'subs_count_test/bar/' + random2

    var clientsToConnect = 7
    var connectedClients = 0
    var topicsToSubscribe = 8
    var subscriptionsComplete = 0
    var clients = []

    var subsRequest = function (topic) {
      var request = new Request('/mcafee/service/dxl/broker/subs')
      request.payload = JSON.stringify({topic: topic})
      return request
    }

    var testTimeout = null

    var terminateClients = function (callback) {
      clearTimeout(testTimeout)
      var clientCount = clients.length
      var clientsShutdown = 0
      clients.forEach(function (client) {
        client.shutdown(null, function () {
          clientsShutdown++
          if (clientCount === clientsShutdown) {
            callback()
          }
        })
      })
    }

    var terminateClientsWithError = function (error) {
      terminateClients(function () { done(error) })
    }

    this.timeout(maxTestTime + (maxTestTime / 10))
    testTimeout = setTimeout(function () {
      terminateClientsWithError(
        new Error('Timeout of ' + maxTestTime + ' ms exceeded')
      )
    }, maxTestTime)

    for (var i = 0; i < clientsToConnect; i++) {
      clients[i] = new TestClient(this)
      clients[i].on('packetreceive', function (packet) {
        if ((typeof packet !== 'undefined') && (packet.cmd === 'suback')) {
          subscriptionsComplete++
          if (subscriptionsComplete === topicsToSubscribe) {
            testHelpers.asyncRequest(clients[0], subsRequest(topic1),
              terminateClientsWithError,
              function (topic1Response) {
                testHelpers.asyncRequest(clients[0], subsRequest(topic2),
                  terminateClientsWithError,
                  function (topic2Response) {
                    terminateClients(function () {
                      expect(testHelpers.jsonPayloadToObject(
                        topic1Response).count).to.equal(6)
                      expect(testHelpers.jsonPayloadToObject(
                        topic2Response).count).to.equal(3)
                      done()
                    })
                  }
                )
              }
            )
          }
        }
      })
      clients[i].connect(function () {
        connectedClients++
        if (connectedClients === clientsToConnect) {
          clients[1].subscribe(topic1)
          clients[2].subscribe(topic1)
          clients[3].subscribe(topic1)
          clients[4].subscribe('subs_count_test/foo/' + random1 + '/#')
          clients[5].subscribe('subs_count_test/+/' + random1 + '/#')
          clients[2].subscribe(topic2)
          clients[3].subscribe(topic2)
          clients[6].subscribe('#')
        }
      })
    }
  })
})
