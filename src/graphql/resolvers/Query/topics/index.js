/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE (TOPIC)
 * =======================================================================================
 *
 * This file contains the GraphQL resolvers for the Topic type and the
 * DataLoader factory (`createLoaders`) to optimize database queries.
 *
 * It includes pagination for nested lists like 'subtopics'. Pagination arguments
 * (`limit`, `offset`) can be passed in the GraphQL query. If not provided, it
 * defaults to returning the first 25 items.
 *
 * HOW TO SEE BATCHING IN ACTION:
 * 1. Run a GraphQL query that fetches multiple topics and a nested field, like 'subtopics' or 'subject'.
 * 2. Watch your server's console output.
 * 3. You will see "[RESOLVER CALL]" log for EACH topic.
 * 4. You will see ONE "[DATALOADER BATCH]" log for ALL related items (e.g., all subtopics),
 *    proving the N+1 problem has been solved.
 *
 * REMINDER: The `createLoaders` function must be called in your server's `context`
 * function to create new loaders for every request.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { GraphQLError } = require('graphql');

const { name } = require("./about.js"); // Assumes 'name' is 'topic'

// --- DataLoader Helper Functions ---

/**
 * Groups an array of items by a specific key.
 * Used for one-to-many relationships (e.g., one topic has many subtopics).
 * @param {Array<Object>} items - The array of items to group (e.g., [subtopic1, subtopic2]).
 * @param {string} keyField - The field to group by (e.g., 'topic').
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
   * @param {string} collectionName - The name of the child collection (e.g., 'subtopic').
   * @param {string} foreignKey - The foreign key field on the child collection (e.g., 'topic').
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
    topicById: createByIdLoader(name),
    subtopicsByTopicId: createRelatedLoader('subtopic', 'topic'),
    subjectById: createByIdLoader('subject'), // A reusable loader for Subject lookups
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
  // Use the DataLoader to fetch the topic. This will be batched with other topic lookups.
  return loaders.topicById.load(id);
};

const nested = {
  // Resolvers for fields on the 'Topic' type
  topic: {
    // This resolver does not require a database call, so it remains unchanged.
    subtopicOrder: (root) => {
      return root.subtopicOrder ? JSON.parse(root.subtopicOrder) : [];
    },

    // Uses DataLoader to efficiently fetch the parent subject.
    subject: async (root, args, { loaders }) => {
      if (!root.subject) {
        return null; // No associated subject ID.
      }
      console.log(`[RESOLVER CALL] Queuing 'subject' lookup (ID: ${root.subject}) for Topic ID: ${root.id}`);
      // The loader will batch fetch the subject. If other resolvers in the same request
      // also ask for this subject, the database will only be hit once.
      return loaders.subjectById.load(root.subject);
    },

    // PAGINATED to fetch related subtopics efficiently.
    subtopics: async (root, { limit = 25, offset = 0 }, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'subtopics' lookup for Topic ID: ${root.id}`);
      // The loader will batch fetch all subtopics for all topics in the request.
      const allItems = await loaders.subtopicsByTopicId.load(root.id);
      // Pagination is applied in-memory after the batched fetch.
      return allItems.slice(offset, offset + limit);
    },
  }
}

// Note: The original file exported `list`, `single`, `listDeleted`, and `nested`.
// The new pattern exports `createLoaders` as well.
// We keep the old exports for compatibility.
export { list, single, listDeleted, nested };