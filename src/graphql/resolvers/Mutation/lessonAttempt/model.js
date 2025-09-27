/**
 * LessonAttempt.js
 *
 * @description :: Represents a user's single, continuous session while attempting a lesson.
 */
var Waterline = require('waterline');

module.exports = Waterline.Collection.extend({
  identity: 'lessonattempt',
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
    lessonId: {
      type: 'string',
      required: true,
      description: 'The ID of the lesson being attempted (e.g., from your content structure).'
    },
    startedAt: {
      type: 'ref', // 'ref' is flexible, for Postgres use columnType for specificity
      // columnType: 'timestamptz', // Use 'timestamp with time zone' for accuracy
      required: true,
    },
    completedAt: {
      type: 'ref',
      // columnType: 'timestamptz',
      // allowNull: true,
      required: false,
    },
    status: {
      type: 'string',
      // isIn: ['in_progress', 'completed', 'abandoned'],
      defaultsTo: 'in_progress',
      description: 'The current state of the lesson attempt.'
    },
    finalScore: {
      type: 'number',
      allowNull: true,
      description: 'The total number of diamonds/correct answers at the end of the attempt.'
    },
    deviceInfo: {
      type: 'json',
      description: 'Snapshot of device info for debugging (e.g., app version, OS).'
    },

    // --- Associations ---
    // Each LessonAttempt belongs to one User.
    userId: {
      type: 'string',
      required: true
    },
    
    // A LessonAttempt can have many individual events.
    events: {
      collection: 'attemptevent',
      via: 'lessonAttempt'
    },
    
    // Standard timestamps
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
  }
});