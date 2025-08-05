var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: {
      type: 'string',
      required: true,
      description: 'The unique identifier for the event.',
      example: '1234567890'
    },

    // A clear, machine-readable name for the event.
    // e.g., 'LESSON_STARTED', 'ANSWER_SUBMITTED'
    eventName: {
      type: 'string',
      required: true,
      description: 'The name of the event being tracked.',
      example: 'QUESTION_ANSWERED'
    },

    // The user associated with this event. Can be null for anonymous users.
    // It's a string to accommodate different ID formats (UUID, numbers, etc.).
    userId: {
      type: 'string',
      allowNull: true,
      description: 'The ID of the user who triggered the event.'
    },

    // A unique identifier for the user's session. Helps group events.
    sessionId: {
      type: 'string',
      required: true,
      description: 'A unique identifier for the user\'s current session.'
    },
    
    // The exact time the event occurred on the client's device.
    timestamp: {
      type: 'string',
      required: true,
      description: 'The ISO 8601 timestamp of when the event occurred.'
    },

    // A unique identifier for the physical device.
    device: {
      type: 'string',
      required: true,
      description: 'A unique identifier for the client device.'
    },

    // The client platform (e.g., 'ios', 'android').
    platform: {
      type: 'string',
      required: true,
      // isIn: ['ios', 'android', 'web'],
      description: 'The operating system of the device.'
    },

    // A flexible JSON object to hold all other event-specific data.
    // e.g., { "lessonId": "123", "isCorrect": false, "timeSpentMs": 15000 }
    properties: {
      type: 'json',
      defaultsTo: {},
      description: 'A JSON object containing event-specific data.'
    },

  },
});
