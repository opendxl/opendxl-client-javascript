'use strict'

/**
 * Manager that delivers incoming {@link Message} objects to callbacks matching
 * the message topic.
 * @private
 * @constructor
 */
function CallbackManager () {
  /**
   * Mapping of registered callbacks. Each key in the object corresponds to one
   * of the message type constants in the {@link Message} class - for example,
   * {@link Message.MESSAGE_TYPE_RESPONSE}. Each value in the object is an
   * object with keys representing the name of the topic associated with
   * the callback and values being an array of callback functions.
   * @private
   * @example
   * var this._callbacksByMessageType = {}
   * this._callbacksByMessageType[Message.MESSAGE_TYPE_RESPONSE] = {
   *   '/topic1', [ function(message) { console.log('callback 1') } ]
   * }
   * @name CallbackManager#_callbacksByMessageType
   * @default {}
   * @type {Object}
   */
  this._callbacksByMessageType = {}
}

/**
 * Adds a callback to the list of registered callbacks.
 * @param {(Number|String)} messageType - Type of DXL messages for which the
 *   callback should be invoked. Corresponds to one of the message type
 *   constants in the {@link Message} class - for example,
 *   {@link Message.MESSAGE_TYPE_RESPONSE}.
 * @param {String} topic - Topic associated with the callback.
 * @param {Function} callback - Callback to invoke for a message matching the
 *   _topic_ value.
 */
CallbackManager.prototype.addCallback = function (messageType,
                                                  topic, callback) {
  var callbacksByTopic = this._callbacksByMessageType[messageType]
  if (!callbacksByTopic) {
    callbacksByTopic = {}
    this._callbacksByMessageType[messageType] = callbacksByTopic
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

/**
 * Removes a callback from the list of registered callbacks.
 * @param {(Number|String)} messageType - Type of DXL messages for which the
 *   callback should be invoked. Corresponds to one of the message type
 *   constants in the {@link Message} class - for example,
 *   {@link Message.MESSAGE_TYPE_RESPONSE}.
 * @param {String} topic - Topic associated with the callback.
 * @param {Function} callback - Callback to invoke for a message matching the
 *   _topic_ value.
 */
CallbackManager.prototype.removeCallback = function (messageType,
                                                     topic, callback) {
  var callbacksByTopic = this._callbacksByMessageType[messageType]
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

/**
 * Propagates the message to the appropriate set of registered callbacks.
 * @param {Message} message - {@link Message} which should be delivered to
 *   the appropriate callbacks.
 */
CallbackManager.prototype.onMessage = function (message) {
  var callbacksByTopic = this._callbacksByMessageType[message.messageType]
  if (callbacksByTopic) {
    // Find all of the callbacks registered for the message type which
    // match the message. Any of the following callback topic values is
    // considered a match:
    // * Callback topic is an exact match for the message's destination topic.
    // * Callback topic matches the message's destination topic via a wildcard.
    //   For example, a callback topic with a value '/mytopic/#' would be
    //   match a message destination topic of '/mytopic/mysubtopic'.
    // * Callback topic is empty. An empty topic value matches all messages,
    //   regardless of the destination topic value.
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
        try {
          callback(message)
        } catch (err) {
          console.log('Error invoking callback for incoming message: ' + err)
        }
      })
    })
  }
}

/**
 * Destroys resources for all callback registrations.
 */
CallbackManager.prototype.destroy = function () {
  this._callbacksByMessageType = {}
}

module.exports = CallbackManager
