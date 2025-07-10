/**
 * =======================================================================================
 *  DATALOADER-ENABLED RESOLVER FILE WITH LOGGING & PAGINATION
 * =======================================================================================
 *
 * This file contains both the GraphQL resolvers for the School type and the
 * DataLoader factory (`createLoaders`) needed to optimize database queries.
 *
 * It also includes pagination for nested lists like 'students', 'buses', etc.
 * Pagination arguments (`limit`, `offset`) can be passed in the GraphQL query.
 * If not provided, it defaults to returning the first 25 items.
 *
 * HOW TO SEE BATCHING IN ACTION:
 * 1. Run a GraphQL query that fetches multiple schools and a nested field, like 'students'.
 * 2. Watch your server's console output.
 * 3. You will see "[RESOLVER CALL]" log for EACH school.
 * 4. You will see ONE "[DATALOADER BATCH]" log for ALL students, proving the N+1
 *    problem has been solved.
 *
 * REMINDER: The `createLoaders` function must be called in your server's `context`
 * function to create new loaders for every request.
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
import { sum, subtract } from "mathjs";
const { GraphQLError } = require('graphql');

// Original imports for context
import payments from "../../Mutation/payments/index.js";
import schedules from "../../Mutation/schedules/index.js";
import invitations from "../../Mutation/invitations/index.js";

const openSchoolId = "683eb0b3269670f07ed0901c";
const { name } = require("./about.js");

// --- DataLoader Helper Functions ---

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

const mapItemsToKeys = (keys, items, keyField = 'id') => {
    const itemMap = new Map(items.map(item => [String(item[keyField]), item]));
    return keys.map(key => itemMap.get(String(key)) || null);
};

// --- DataLoader Factory with Logging ---

export const createLoaders = (collections) => {
  const createRelatedLoader = (collectionName, foreignKey) => {
    return new DataLoader(async (keys) => {
      // ✅ LOGGING: This log fires ONCE per batch, showing the batched query.
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' with ${keys.length} keys:`, keys);

      const items = await collections[collectionName].find({
        where: { [foreignKey]: { in: keys }, isDeleted: false },
      });
      const groupedItems = groupItemsByKey(items, foreignKey);
      return keys.map(key => groupedItems.get(String(key)) || []);
    });
  };

  const createByIdLoader = (collectionName) => {
    return new DataLoader(async (keys) => {
        // ✅ LOGGING: This log fires ONCE per batch for ID-based lookups.
        console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' by ID with ${keys.length} keys:`, keys);

        const items = await collections[collectionName].find({
            where: { id: { in: keys }, isDeleted: false }
        });
        return mapItemsToKeys(keys, items, 'id');
    });
  };

  return {
    schoolById: createByIdLoader(name),
    studentsBySchoolId: createRelatedLoader('student', 'school'),
    busesBySchoolId: createRelatedLoader('bus', 'school'),
    chargesBySchoolId: createRelatedLoader('charge', 'school'),
    paymentsBySchoolId: createRelatedLoader('payment', 'school'),
    teachersBySchoolId: createRelatedLoader('teacher', 'school'),
    classesBySchoolId: createRelatedLoader('class', 'school'),
    complaintsBySchoolId: createRelatedLoader('complaint', 'school'),
    driversBySchoolId: createRelatedLoader('driver', 'school'),
    adminsBySchoolId: createRelatedLoader('admin', 'school'),
    parentsBySchoolId: createRelatedLoader('parent', 'school'),
    routesBySchoolId: createRelatedLoader('route', 'school'),
    tripsBySchoolId: createRelatedLoader('trip', 'school'),
    schedulesBySchoolId: createRelatedLoader('schedule', 'school'),
    gradesBySchoolId: createRelatedLoader('grade', 'school'),
    termsBySchoolId: createRelatedLoader('term', 'school'),
    teamsBySchoolId: createRelatedLoader('team', 'school'),
    invitationsBySchoolId: createRelatedLoader('invitation', 'school'),
  };
};

// --- GraphQL Resolvers (Using Loaders) ---

const list = async (root, args, { auth, db: { collections }, loaders }) => {
  let { userType, schoolId } = auth;

  if (userType === 'sAdmin') {
      const query = { where: { isDeleted: false } };
      return await collections[name].find(query);
  } else {
      if (!schoolId) {
           throw new GraphQLError('Access Denied: User configuration incomplete.', { extensions: { code: 'FORBIDDEN' } });
      }
      const school = await loaders.schoolById.load(schoolId);
      return school ? [school] : [];
  }
};
// in your resolver file
const single = async (root, args, { auth, open, db: { collections }, loaders, params: { params } = { params: { id: undefined } } }) => {
  console.log(auth)
  let id = auth?.schoolId || params?.id;

  if (open === true && !id) {
      id = openSchoolId;
  }

  return loaders.schoolById.load(id);
};

const listDeleted = async (root, args, { auth, db: { collections } }) => {
  // ... listDeleted resolver logic remains the same ...
  if (auth.userType !== 'sAdmin') throw new GraphQLError('Access Denied.', { extensions: { code: 'FORBIDDEN' } });
  return await collections[name].find({ where: { isDeleted: true } });
};

const nested = {
  school: {
    studentsCount: async (root, args, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Queuing 'studentsCount' lookup for School ID: ${root.id}`);
      // The loader fetches all students, and we just need the length.
      // This is efficient because the loader will cache the result if the full
      // student list was already fetched by another resolver in the same request.
      const count = await collections.student.count({ where: { school: root.id } });
      return count;
    },
    gradeOrder: (root) => root.gradeOrder ? root.gradeOrder.split(",") : [],
    termOrder: (root) => root.termOrder ? root.termOrder.split(",") : [],
    async financial(root, args, { loaders }) {
      // ✅ LOGGING: The individual batch logs for payments/charges will show this is efficient.
      console.log(`[RESOLVER CALL] Queuing 'financial' data for School ID: ${root.id}`);
      const [payments, charges] = await Promise.all([
        loaders.paymentsBySchoolId.load(root.id),
        loaders.chargesBySchoolId.load(root.id)
      ]);
      const balance = subtract(sum(payments.map(p => p.ammount)), sum(charges.map(p => p.ammount)));
      return { balance, balanceFormated: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KSH' }).format(balance) };
    },

    // ==============================================================================
    // PAGINATED NESTED RESOLVERS
    // ==============================================================================
    // The following resolvers accept `limit` (default: 25) and `offset` (default: 0)
    // arguments to paginate the results. They use DataLoader to solve the N+1
    // database query problem, then paginate the full result set in memory.
    // ==============================================================================

    students: async (root, { limit = 25, offset = 0 }, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'students' lookup for School ID: ${root.id}`);
      console.log(`[RESOLVER ARGS] limit: ${limit}, offset: ${offset}`);
      const allItems = await loaders.studentsBySchoolId.load(root.id);
      console.log(`[RESOLVER RESULT] Retrieved ${allItems.length} students for School ID: ${root.id}`);
      return allItems.slice(offset, offset + limit);
    },
    buses: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'buses' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.busesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    charges: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'charges' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.chargesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    payments: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'payments' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.paymentsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    teachers: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'teachers' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.teachersBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    classes: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'classes' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.classesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    complaints: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'complaints' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.complaintsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    drivers: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'drivers' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.driversBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    admins: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'admins' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.adminsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    parents: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'parents' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.parentsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    routes: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'routes' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.routesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    trips: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'trips' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.tripsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    schedules: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'schedules' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.schedulesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    grades: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'grades' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.gradesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    terms: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'terms' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.termsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    teams: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'teams' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.teamsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    invitations: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'invitations' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.invitationsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
  }
};

export { list, single, listDeleted, nested };