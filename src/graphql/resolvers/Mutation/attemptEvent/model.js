/**
 * AttemptEvent.js
 *
 * @description :: Logs a single user interaction (e.g., answering, retrying)
 *               within a specific LessonAttempt.
 */
var Waterline = require('waterline');

module.exports = Waterline.Collection.extend({
  identity: 'attemptevent',
  datastore: 'default',
  primaryKey: 'id',

  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
      required: true,
      // autoIncrement: true,
    },

    // --- Core Attributes ---
    questionId: {
      type: 'string',
      required: true,
      description: 'The ID of the question this event relates to.'
    },
    eventType: {
      type: 'string',
      required: true,
      // isIn: [
      //   'question_viewed',   // User navigated to the question
      //   'answer_updated',    // User selected an option, typed text, or picked an image
      //   'check_attempt'      // User pressed the "Check Answer" button
      // ]
    },
    eventTimestamp: {
      type: 'ref',
      // columnType: 'timestamptz',
      required: true,
    },
    userAnswer: {
      type: 'json',
      required: true,
      description: 'A JSON object representing the user\'s answer state at the time of the event.'
      // Example for text: { "inputText": "Photosynthesis" }
      // Example for camera: { "imageIdentifier": "https://s3.bucket/path/to/image.jpg" }
      // Example for multi-choice: { "selectedOptionIds": ["opt_abc", "opt_def"] }
    },
    isCorrect: {
      type: 'boolean',
      allowNull: true,
      description: 'Only relevant for the "check_attempt" event type.'
    },

    // --- Associations ---
    // Each event is part of one LessonAttempt.
    lessonAttempt: {
      model: 'lessonattempt',
      required: true
    },

    // Standard timestamps
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
  }
});