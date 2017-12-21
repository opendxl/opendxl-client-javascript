'use strict'

function CallbackManager (client) {
  this.client = client
  this.callbacksByMessageType = {}
}

CallbackManager.prototype.addCallback = function (messageType,
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

  if (callbacks.indexOf(callback) < 0) {
    callbacks.push(callback)
  }
}

CallbackManager.prototype.removeCallback = function (messageType,
                                                      topic, callback) {
  var callbacksByTopic = this.callbacksByMessageType[messageType]
  if (callbacksByTopic) {
    var callbacks = callbacksByTopic[topic]
    if (callbacks) {
      var callbackPosition = callbacks.indexOf(callback)
      if (callbackPosition > -1) {
        if (callbacks.length > 1) {
          // Remove the callback from the list of subscribers
          // for the topic and associated message type
          callbacks.splice(callbackPosition, 1)
        } else {
          // Remove the topic entry since no more callbacks
          // are registered for it
          delete callbacksByTopic[topic]
        }
      }
    }
  }
}

CallbackManager.prototype.onMessage = function (message) {
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

CallbackManager.prototype.destroy = function () {
  this.callbacksByMessageType = {}
}

module.exports = CallbackManager
