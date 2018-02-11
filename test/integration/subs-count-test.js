'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../..').Request
var util = require('../../lib/util')
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

describe('broker subs count @integration', function () {
  it('should return expected values for topic subscriptions', function (done) {
    var maxTestTime = 5000

    var baseTopic = 'subs_count_test'
    var random1 = util.generateIdAsString()
    var random2 = util.generateIdAsString()
    var topic1 = baseTopic + '/foo/' + random1 + '/' + random2
    var topic2 = baseTopic + '/bar/' + random2

    // Each item in this array corresponds to a client connection which should
    // be established and a subarray of topic names to which the client should
    // subscribe.
    var topicsByClient = [
      [],
      [topic1],
      [topic1, topic2],
      [topic1, topic2],
      [baseTopic + '/foo/' + random1 + '/#'],
      [baseTopic + '/+/' + random1 + '/#'],
      ['#']
    ]

    var clientsToConnect = topicsByClient.length
    var subscriptionsToAttempt = topicsByClient.reduce(function (acc, current) {
      return acc + current.length
    }, 0)
    var subscriptionAttemptsSent = 0
    var subscriptionMessagesToBeAcked = 0
    var infoByClient = []

    var connectedClients = 0
    var subscriptionMessagesAcked = 0

    var subsRequest = function (topic) {
      var request = new Request('/mcafee/service/dxl/broker/subs')
      request.payload = JSON.stringify({topic: topic})
      return request
    }

    var testTimeout = null

    // Iterate over all of the clients which have been created, shutting down
    // each one.
    var terminateClients = function (callback) {
      clearTimeout(testTimeout)
      var clientsToShutdown = infoByClient.length
      var clientsShutdown = 0
      infoByClient.forEach(function (info) {
        info.client.shutdown(null, function () {
          clientsShutdown++
          if (clientsToShutdown === clientsShutdown) {
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

    topicsByClient.forEach(function (topics) {
      var client = new TestClient(this)
      infoByClient.push({
        client: client,
        topics: topics,
        subscriptionMessageIds: []
      })
      client.connect(function () {
        connectedClients++
        if (connectedClients === clientsToConnect) {
          infoByClient.forEach(function (clientInfo) {
            // Listen for packets being sent in order to determine the point
            // at which all intended subscriptions have been sent to the broker.
            // The message id for each subscription attempt is captured so
            // that it can be matched up to the messageId on the corresponding
            // subscription ack (suback) from the broker.
            clientInfo.client.on('packetsend', function (packet) {
              if (packet.cmd === 'subscribe') {
                // The client could batch one or more topics together
                // into the same subscription packet so iterate through each
                // one of the available topics to count them.
                packet.subscriptions.forEach(function (subscription) {
                  var currentSubscriptionAttemptsSent = subscriptionAttemptsSent
                  // Only count this subscription if this is for a topic
                  // that this test specifically subscribed for - i.e., not
                  // the topic that the client subscribes itself for in order
                  // to receive responses to requests that it makes.
                  if ((subscription.topic.indexOf(baseTopic) === 0) ||
                    (subscription.topic === '#')) {
                    subscriptionAttemptsSent++
                  }
                  if (currentSubscriptionAttemptsSent <
                    subscriptionAttemptsSent) {
                    clientInfo.subscriptionMessageIds.push(packet.messageId)
                    subscriptionMessagesToBeAcked++
                  }
                })
              }
            })
            // Listen for packets being received in order to determine when
            // all subscription attempts have been acked from the broker.
            clientInfo.client.on('packetreceive', function (packet) {
              var subscriptionMessageIds = clientInfo.subscriptionMessageIds
              if ((packet.cmd === 'suback') &&
                (subscriptionMessageIds.indexOf(packet.messageId) >= 0)) {
                subscriptionMessagesAcked++
                if ((subscriptionAttemptsSent === subscriptionsToAttempt) &&
                  (subscriptionMessagesAcked ===
                    subscriptionMessagesToBeAcked)) {
                  // Subscriptions have all been acked by the broker at this
                  // point so it should be safe to query the broker to
                  // determine how many subscriptions it is holding for the
                  // topics that this test uses.
                  var requestClient = infoByClient[0].client
                  testHelpers.asyncRequest(requestClient, subsRequest(topic1),
                    terminateClientsWithError,
                    function (topic1Response) {
                      testHelpers.asyncRequest(requestClient,
                        subsRequest(topic2),
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
            // Clients were all successfully connected so send subscriptions
            // for topics from the appropriate clients.
            clientInfo.topics.forEach(function (topic) {
              clientInfo.client.subscribe(topic)
            })
          })
        }
      })
    })
  })
})
