/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE (LESSONATTEMPT)
 * =======================================================================================
 *
 * This file contains the GraphQL resolvers for the LessonAttempt type and the
 * DataLoader factory (`createLoaders`) to optimize database queries.
 *
 * It includes pagination for nested lists like 'attemptEvents'.
 *
 * HOW BATCHING WORKS:
 * 1. A query asks for multiple lessonAttempts and their nested attemptEvents.
 * 2. The resolver for each lessonAttempt queues a request for its events.
 * 3. The DataLoader batches all these requests into a single database call,
 *    improving efficiency.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { GraphQLError } = require('graphql');

const { name } = require("./about.js"); // Assumes 'name' is 'lessonAttempt'

// --- DataLoader Helper Functions ---

/**
 * Groups an array of items by a specific key.
 * Used for one-to-many relationships (e.g., one lessonAttempt has many attemptEvents).
 */
const groupItemsByKey = (items, keyField) => {
  const grouped = new Map();
  items.forEach(item => {
    const key = String(item[keyField]);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });
  return grouped;
};

/**
 * Maps an array of items to an array of keys, preserving the order of the keys.
 * Used for fetching items by their primary ID.
 */
const mapItemsToKeys = (keys, items, keyField = 'id') => {
  const itemMap = new Map(items.map(item => [String(item[keyField]), item]));
  return keys.map(key => itemMap.get(String(key)) || null);
};


// --- DataLoader Factory with Logging ---

export const createLoaders = (collections) => {
  /**
   * Creates a DataLoader for fetching items by their primary ID.
   */
  const createByIdLoader = (collectionName) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' by ID with ${keys.length} keys:`, keys);
      const items = await collections[collectionName].find({
        where: { id: { in: keys }, isDeleted: false }
      });
      return mapItemsToKeys(keys, items, 'id');
    });
  };

  /**
   * Creates a DataLoader for fetching related child items.
   */
  const createRelatedLoader = (collectionName, fieldName) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' with ${keys.length} keys on field '${fieldName}':`, keys);
      const items = await collections[collectionName].find({
        where: { [fieldName]: { in: keys } },
      });
      const groupedItems = groupItemsByKey(items, fieldName);
      return keys.map(key => groupedItems.get(String(key)) || []);
    });
  };

  return {
    lessonAttemptById: createByIdLoader(name),
    attemptEventsByLessonAttemptId: createRelatedLoader('attemptevent', 'lessonAttempt'),
    
    // Reusable loaders for other related entities
    userById: createByIdLoader('user'),
    schoolById: createByIdLoader('school'),
    subtopicById: createByIdLoader('subtopic'),
  };
};

// --- GraphQL Resolvers (Using Loaders) ---

const list = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries;
};

const listDeleted = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: true
    }
  });
  return entries;
};

const single = async (root, args, { loaders }) => {
  const { id } = args[name];
  if (!id) {
    throw new GraphQLError("An ID must be provided.", { extensions: { code: 'BAD_USER_INPUT' } });
  }

  console.log(`[RESOLVER CALL] Queuing '${name}' lookup for ID: ${id}`);
  return loaders.lessonAttemptById.load(id);
};

const nested = {
  // Resolvers for fields on the 'LessonAttempt' type
  // Note: The type name 'LessonAttempt' must match your GraphQL schema.
  lessonAttempt: {
    // PAGINATED to fetch related attemptEvents efficiently.
    attemptEvents: async (root, { limit = 25, offset = 0 }, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'attemptEvents' lookup for LessonAttempt ID: ${root.id}`);
      const allItems = await loaders.attemptEventsByLessonAttemptId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },

    // Uses DataLoader to efficiently fetch the parent user.
    user: async (root, args, { loaders }) => {
      if (!root.userId) return null;
      console.log(`[RESOLVER CALL] Queuing 'user' lookup (ID: ${root.userId}) for LessonAttempt ID: ${root.id}`);
      return loaders.userById.load(root.userId);
    },

    // Uses DataLoader to efficiently fetch the parent school.
    school: async (root, args, { loaders }) => {
      if (!root.school) return null;
      console.log(`[RESOLVER CALL] Queuing 'school' lookup (ID: ${root.school}) for LessonAttempt ID: ${root.id}`);
      return loaders.schoolById.load(root.school);
    },
    
    // Uses DataLoader to efficiently fetch the parent "lesson" (which is a subtopic).
    lesson: async (root, args, { loaders }) => {
        if (!root.lessonId) return null;
        console.log(`[RESOLVER CALL] Queuing 'lesson' (subtopic) lookup (ID: ${root.lessonId}) for LessonAttempt ID: ${root.id}`);
        return loaders.subtopicById.load(root.lessonId);
    },
  }
};

// Keep old exports for compatibility.
export { list, single, listDeleted, nested };