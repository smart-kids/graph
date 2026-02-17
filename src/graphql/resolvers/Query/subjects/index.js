/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE (SUBJECT)
 * =======================================================================================
 *
 * This file contains the GraphQL resolvers for the Subject type and the
 * DataLoader factory (`createLoaders`) to optimize database queries.
 *
 * It includes pagination for nested lists like 'topics'. Pagination arguments
 * (`limit`, `offset`) can be passed in the GraphQL query. If not provided, it
 * defaults to returning the first 25 items.
 *
 * HOW TO SEE BATCHING IN ACTION:
 * 1. Run a GraphQL query that fetches multiple subjects and a nested field, like 'topics' or 'grade'.
 * 2. Watch your server's console output.
 * 3. You will see "[RESOLVER CALL]" log for EACH subject.
 * 4. You will see ONE "[DATALOADER BATCH]" log for ALL related items (e.g., all topics),
 *    proving the N+1 problem has been solved.
 *
 * REMINDER: The `createLoaders` function must be called in your server's `context`
 * function to create new loaders for every request.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { GraphQLError } = require('graphql');

const { name } = require("./about.js"); // Assumes 'name' is 'subject'

// --- DataLoader Helper Functions ---

/**
 * Groups an array of items by a specific key.
 * Used for one-to-many relationships (e.g., one subject has many topics).
 * @param {Array<Object>} items - The array of items to group (e.g., [topic1, topic2]).
 * @param {string} keyField - The field to group by (e.g., 'subject').
 * @returns {Map<string, Array<Object>>} A map where keys are the foreign key values and values are arrays of items.
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
 * Used for one-to-one relationships or fetching items by their primary ID.
 * @param {Array<string>} keys - The array of keys to map against.
 * @param {Array<Object>} items - The array of items fetched from the database.
 * @param {string} [keyField='id'] - The field on the items that corresponds to the keys.
 * @returns {Array<Object|null>} An array of items in the same order as the input keys.
 */
const mapItemsToKeys = (keys, items, keyField = 'id') => {
  const itemMap = new Map(items.map(item => [String(item[keyField]), item]));
  return keys.map(key => itemMap.get(String(key)) || null);
};


// --- DataLoader Factory with Logging ---

export const createLoaders = (collections) => {
  /**
   * Creates a DataLoader for fetching items by their primary ID.
   * @param {string} collectionName - The name of the collection to query.
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
   * Creates a DataLoader for fetching related items in a one-to-many relationship.
   * @param {string} collectionName - The name of the child collection (e.g., 'topic').
   * @param {string} foreignKey - The foreign key field on the child collection (e.g., 'subject').
   */
  const createRelatedLoader = (collectionName, foreignKey) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' with ${keys.length} keys on foreign key '${foreignKey}':`, keys);
      const items = await collections[collectionName].find({
        where: { [foreignKey]: { in: keys }, isDeleted: false },
      });
      const groupedItems = groupItemsByKey(items, foreignKey);
      return keys.map(key => groupedItems.get(String(key)) || []);
    });
  };

  return {
    subjectById: createByIdLoader(name),
    topicsBySubjectId: createRelatedLoader('topic', 'subject'),
    gradeById: createByIdLoader('grade'), // A reusable loader for Grade lookups
    lessonAttemptsByLessonId: createRelatedLoader('lessonattempt', 'lessonId'),
  };
};

// --- GraphQL Resolvers (Using Loaders) ---

const list = async (root, args, { db: { collections } }) => {
  // DataLoader is not typically used for a top-level list of the primary resource.
  // Direct database call is appropriate here.
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries;
};

const listDeleted = async (root, args, { db: { collections } }) => {
  // Direct database call is appropriate here.
  const entries = await collections[name].find({
    where: {
      isDeleted: true
    }
  });
  return entries;
};

const single = async (root, args, { loaders }) => {
  // The argument structure `args[name]` is unusual, but maintained from the original code.
  // A more common pattern is `args.id`.
  const { id } = args[name];
  if (!id) {
    throw new GraphQLError("An ID must be provided.", { extensions: { code: 'BAD_USER_INPUT' } });
  }

  console.log(`[RESOLVER CALL] Queuing '${name}' lookup for ID: ${id}`);
  // Use the DataLoader to fetch the subject. This will be batched with other subject lookups.
  return loaders.subjectById.load(id);
};

const nested = {
  // Resolvers for fields on the 'Subject' type
  subject: {
    // This resolver does not require a database call, so it remains unchanged.
    topicsOrder: (root) => {
      return root.topicsOrder ? JSON.parse(root.topicsOrder) : [];
    },

    // Uses DataLoader to efficiently fetch the parent grade.
    grade: async (root, args, { loaders }) => {
      if (!root.grade) {
        return null; // No associated grade ID.
      }
      console.log(`[RESOLVER CALL] Queuing 'grade' lookup (ID: ${root.grade}) for Subject ID: ${root.id}`);
      // The loader will batch fetch the grade. If other resolvers in the same request
      // also ask for this grade, the database will only be hit once.
      return loaders.gradeById.load(root.grade);
    },

    // PAGINATED to fetch related topics efficiently.
    topics: async (root, { limit = 25, offset = 0 }, { loaders, auth }) => {
      console.log(`[RESOLVER CALL] Queuing 'topics' lookup for Subject ID: ${root.id}`);
      // The loader will batch fetch all topics for all subjects in the request.
      const allItems = await loaders.topicsBySubjectId.load(root.id);
      
      // Filter out invisible topics if user is NOT an admin
      const isAdmin = auth.userType === 'sAdmin' || auth.userType === 'admin';
      const visibleItems = isAdmin 
        ? allItems 
        : allItems.filter(t => t.isvisible !== false);

      // Pagination is applied in-memory after the batched fetch.
      return visibleItems.slice(offset, offset + limit);
    },


    lessonAttempts: async (root, { limit = 25, offset = 0 }, { loaders }) => {
      console.log(`[RESOLVER CALL] Starting traversal for 'lessonAttempts' from Subject ID: ${root.id}`);

      // Step 1: Get all topics for the current subject.
      // This uses a loader you already have.
      const topics = await loaders.topicsBySubjectId.load(root.id);
      if (!topics || topics.length === 0) {
        return []; // No topics means no subtopics and no attempts.
      }

      // Step 2: Get all subtopics for ALL the topics found in Step 1.
      // We will create a new loader for this. It takes an array of topic IDs.
      const topicIds = topics.map(topic => topic.id);
      // `loadMany` will call our batch function with all topic IDs.
      const subtopicsByTopic = await loaders.subtopicsByTopicId.loadMany(topicIds);

      // Flatten the array of arrays into a single list of all subtopics for this subject.
      const allSubtopics = subtopicsByTopic.flat();
      if (!allSubtopics || allSubtopics.length === 0) {
        return []; // No subtopics means no attempts.
      }

      // Step 3: Get all lesson attempts for ALL the subtopics found in Step 2.
      // We will create another new loader for this.
      const subtopicIds = allSubtopics.map(subtopic => subtopic.id);
      const lessonAttemptsBySubtopic = await loaders.lessonAttemptsByLessonId.loadMany(subtopicIds);

      // Flatten the final array and apply pagination.
      const allItems = lessonAttemptsBySubtopic.flat();

      // In-memory pagination is the final step.
      return allItems.slice(offset, offset + limit);
    },
  }
}

// Note: The original file exported `list`, `single`, `listDeleted`, and `nested`.
// The new pattern exports `createLoaders` as well.
// We keep the old exports for compatibility.
export { list, single, listDeleted, nested };