/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE FOR STUDENT
 * =======================================================================================
 *
 * This file contains both the GraphQL resolvers for the Student type and the
 * DataLoader factory (`createLoaders`) needed to optimize its nested database queries.
 *
 * This setup solves the classic N+1 query problem. For example, when fetching a
 * list of 100 students, instead of making 100 separate queries for each student's
 * parent, DataLoader batches them into a single, efficient database call.
 *
 * HOW TO SEE BATCHING IN ACTION:
 * 1. Run a GraphQL query that fetches multiple students and a nested field, like 'parent'.
 * 2. Watch your server's console output.
 * 3. You will see "[RESOLVER CALL]" log for EACH student.
 * 4. You will see ONE "[DATALOADER BATCH]" log for ALL parents, proving the N+1
 *    problem has been solved.
 *
 * REMINDER: The `createLoaders` function must be called in your server's `context`
 * function to create new loaders for every request.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { name } = require("./about.js");

// --- DataLoader Helper Functions ---

/**
 * Maps an array of items to an array of keys, ensuring the output array's
 * order and size match the input keys array. Used for one-to-one relationships.
 * @param {Array<string>} keys - The array of IDs to map against.
 * @param {Array<object>} items - The array of database records fetched.
 * @param {string} keyField - The field on the items to use for mapping (e.g., 'id').
 * @returns {Array<object|null>}
 */
const mapItemsToKeys = (keys, items, keyField = 'id') => {
    const itemMap = new Map(items.map(item => [String(item[keyField]), item]));
    return keys.map(key => itemMap.get(String(key)) || null);
};

/**
 * Groups an array of items by a specific key. Used for one-to-many relationships.
 * @param {Array<object>} items - The array of database records fetched.
 * @param {string} keyField - The foreign key field to group by (e.g., 'student').
 * @returns {Map<string, Array<object>>}
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


// --- DataLoader Factory with Logging for Student Relations ---

export const createLoaders = (collections) => {
  /**
   * Factory for creating a DataLoader that fetches items by their primary key ('id').
   * Solves N+1 for one-to-one relationships.
   */
  const createByIdLoader = (collectionName) => {
    return new DataLoader(async (ids) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for '${collectionName}' by ID with ${ids.length} keys.`);
      const items = await collections[collectionName].find({
        where: { id: { in: ids }, isDeleted: false }
      });
      return mapItemsToKeys(ids, items, 'id');
    });
  };

  /**
   * Factory for creating a DataLoader that fetches related items by a foreign key.
   * Solves N+1 for one-to-many relationships.
   */
  const createRelatedLoader = (collectionName, foreignKey) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for '${collectionName}' by foreign key '${foreignKey}' with ${keys.length} keys.`);
      
      // Handle payment collection specially due to schema restrictions
      let items;
      if (collectionName === 'payment') {
        // For payments, use a different approach since schema: true might be enabled
        items = [];
        for (const key of keys) {
          const paymentItems = await collections[collectionName].find({ [foreignKey]: key });
          items = items.concat(paymentItems);
        }
      } else {
        // For other collections, use the original batch query
        items = await collections[collectionName].find({
          where: { [foreignKey]: { in: keys }, isDeleted: false },
        });
      }
      
      const groupedItems = groupItemsByKey(items, foreignKey);
      return keys.map(key => groupedItems.get(String(key)) || []);
    });
  };

  return {
    // Loaders for one-to-one relations (Student -> X)
    routeById: createByIdLoader('route'),
    parentById: createByIdLoader('parent'),
    classById: createByIdLoader('class'),
    studentById: createByIdLoader('student'),

    // Loader for one-to-many relation (Student -> Events, Student -> Payments)
    eventsByStudentId: createRelatedLoader('event', 'student'),
    paymentsByStudentId: createRelatedLoader('payment', 'student'),
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

const single = async (root, args, { db: { collections } }) => {
  const { id } = args[name];
  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
};

const nested = {
  student: {
    // --- One-to-One Relationships ---
    async route(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Queuing 'route' lookup for Student ID: ${root.id}`);
      if (!root.route) return null;
      return loaders.routeById.load(root.route);
    },
    async parent(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Queuing 'parent' lookup for Student ID: ${root.id}`);
      if (!root.parent) return null;
      return loaders.parentById.load(root.parent);
    },
    async parent2(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Queuing 'parent2' lookup for Student ID: ${root.id}`);
      if (!root.parent2) return null;
      // We reuse the same loader, as it also fetches from the 'parent' collection.
      return loaders.parentById.load(root.parent2);
    },
    async class(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Queuing 'class' lookup for Student ID: ${root.id}`);
      if (!root.class) return null;
      // The loader cleanly replaces the old `.find()[0]` logic.
      return loaders.classById.load(root.class);
    },

    // --- One-to-Many Relationship with Pagination ---
    async events(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Queuing 'events' lookup for Student ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;

      // The loader efficiently fetches ALL events for the batched students.
      const allEvents = await loaders.eventsByStudentId.load(root.id);

      // Then, we paginate the result set in memory.
      return allEvents.slice(offset, offset + limit);
    },
    async feeStatus(root, args, { loaders }) {
        if (!root.class) return { balance: 0, balanceFormated: "0.00" };
        const classData = await loaders.classById.load(root.class);
        if (!classData) return { balance: 0, balanceFormated: "0.00" };
        
        const feeAmount = classData.feeAmount || 0;
        
        // --- LIVE CALCULATION: Fetch and sum all payments for this student ---
        const studentPayments = await loaders.paymentsByStudentId.load(root.id);
        const totalPaid = studentPayments.reduce((sum, p) => {
            const val = parseFloat(p.amount || p.ammount || 0);
            return sum + val;
        }, 0);

        const balance = feeAmount - totalPaid;
        return {
            balance,
            balanceFormated: balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
    }
  }
};

// Export all resolvers and the loader factory from the same file.
export { list, single, listDeleted, nested };