/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE (ANSWER)
 * =======================================================================================
 *
 * This file contains the GraphQL resolvers for the Answer type and the
 * DataLoader factory (`createLoaders`) to optimize database queries.
 *
 * It efficiently resolves nested fields like 'question'.
 *
 * HOW TO SEE BATCHING IN ACTION:
 * 1. Run a GraphQL query that fetches multiple answers and their related 'question'.
 * 2. Watch your server's console output.
 * 3. You will see "[RESOLVER CALL]" log for EACH answer.
 * 4. You will see ONE "[DATALOADER BATCH]" log for ALL related questions,
 *    proving the N+1 problem has been solved.
 *
 * REMINDER: The `createLoaders` function must be called in your server's `context`
 * function to create new loaders for every request.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { GraphQLError } = require('graphql');

const { name } = require("./about.js"); // Assumes 'name' is 'answer'

// --- DataLoader Helper Functions ---

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

  return {
    answerById: createByIdLoader(name),
    questionById: createByIdLoader('question'), // A reusable loader for Question lookups
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
  // Use the DataLoader to fetch the answer. This will be batched with other answer lookups.
  return loaders.answerById.load(id);
};

const nested = {
  // Resolvers for fields on the 'Answer' type
  answer: {
    // Uses DataLoader to efficiently fetch the parent question.
    async question(root, args, { loaders }) {
      if (!root.question) {
        return null; // No associated question ID.
      }
      console.log(`[RESOLVER CALL] Queuing 'question' lookup (ID: ${root.question}) for Answer ID: ${root.id}`);
      // The loader will batch fetch the question. If other resolvers in the same request
      // also ask for this question, the database will only be hit once.
      return loaders.questionById.load(root.question);
    },
  }
}

// Note: The original file exported `list`, `single`, `listDeleted`, and `nested`.
// The new pattern exports `createLoaders` as well.
// We keep the old exports for compatibility.
export { list, single, listDeleted, nested };