'use strict'

function _CallbackManager (client) {
  // jshint validthis: true
  this.client = client
  this.callbacksByMessageType = {}
}

_CallbackManager.prototype.addCallback = function (messageType,
                                                   topic, callback) {
  var callbacksByTopic = this.callbacksByMessageType[messageType]
  if (!callbacksByTopic) {
    callbacksByTopic = {}
    this.callbacksByMessageType[messageType] = callbacksByTopic
  }

  var callbacks = callbacksByTopic[topic]
  if (!callbacks) {
    callbacks = []
    callbacksByTopic[topic] = callbacks
  }

  callbacks.push(callback)
}

_CallbackManager.prototype.onMessage = function (message) {
  var callbacksByTopic = this.callbacksByMessageType[message.messageType]
  if (callbacksByTopic) {
    var matchingTopicCallbacks = Object.keys(callbacksByTopic).reduce(
      function (matchesSoFar, topic) {
        if (!topic ||
          (topic === message.destinationTopic) ||
          ((topic.charAt(topic.length - 1) === '#') &&
            (message.destinationTopic.indexOf(topic.slice(0, -1)) === 0))) {
          matchesSoFar.push(callbacksByTopic[topic])
        }
        return matchesSoFar
      }, [])
    matchingTopicCallbacks.forEach(function (callbacks) {
      callbacks.forEach(function (callback) {
        callback(message)
      })
    })
  }
}

module.exports = _CallbackManager
