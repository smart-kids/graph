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
    chargeTypesBySchoolId: createRelatedLoader('chargetype', 'school'),
    paymentsBySchoolId: createRelatedLoader('payment', 'school'),
    booksBySchoolId: createRelatedLoader('book', 'school'),
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
    smsEventsBySchoolId: createRelatedLoader('smsevent', 'school'),
    smsLogsByEventId: createRelatedLoader('smslog', 'event'),
    smsLogsBySchoolId: createRelatedLoader('smslog', 'school'),
    assessmentTypesBySchoolId: createRelatedLoader('assessmenttype', 'school'),
    assessmentRubricsBySchoolId: createRelatedLoader('assessmentrubric', 'school'),
  };
};

// --- GraphQL Resolvers (Using Loaders) ---

const list = async (root, args, { auth = {}, open, db: { collections } }) => {
  let { userType, school: schoolId } = auth;
  const { limit = 25, offset = 0, search = "" } = args;

  if (userType === 'sAdmin') {
    const query = {
        where: { isDeleted: false },
        skip: offset,
        limit: limit,
        sort: 'name ASC'
    };
    if (search) {
        query.where.or = [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } }
        ];
    }
    return await collections[name].find(query);
  } else {
    // Legacy logic for non-sAdmins
    if (open === true && !schoolId) {
      schoolId = openSchoolId;
    }


    if (!auth.schoolId) {
      schoolId = openSchoolId;
    } else {
      schoolId = auth.schoolId;
    }

    if (!schoolId) {
      throw new GraphQLError('Access Denied: User configuration incomplete.', { extensions: { code: 'FORBIDDEN' } });
    }
    // Single school for non-sAdmins
    const school = await collections[name].findOne({ id: schoolId, isDeleted: false });
    return school ? [school] : [];
  }
};

const count = async (root, args, { auth, db: { collections } }) => {
    if (auth.userType !== 'sAdmin') return 1;
    return await collections[name].count({ isDeleted: false });
};
// in your resolver file
const single = async (root, args, { auth, open, db: { collections }, loaders, params: { params } = { params: { id: undefined } } }) => {
  console.log(auth)
  let id = auth?.schoolId || params?.id || args.id;

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
  // Resolver for the 'smsLog' type (Optional, but good for safety)
  smsLog: {
    providerResponse: (root) => {
      // If root.providerResponse is a string (legacy data), try to parse it
      if (typeof root.providerResponse === 'string') {
        try {
          return JSON.parse(root.providerResponse);
        } catch (e) {
          return null;
        }
      }
      // If it's already an object (new data), return as is
      return root.providerResponse;
    }
  },
  // --- ADD THIS NEW TYPE RESOLVER (Sibling to school) ---
  payment: {
    amount: (root) => root.amount || root.ammount
  },
  charge: {
    amount: (root) => root.amount || root.ammount
  },
  smsEvent: {
    logs: async (root, args, { loaders }) => {
      // This solves N+1. If you request 10 events, this runs 1 batch query for all their logs.
      console.log(`[RESOLVER CALL] Queuing 'logs' lookup for SmsEvent ID: ${root.id}`);
      
      // Return all logs for this event
      return await loaders.smsLogsByEventId.load(root.id);
    },
    // Ensure the raw JSON object is passed through correctly
    providerResponse: (root) => root.providerResponse
  },
  school: {
    studentsCount: async (root, { search = "" }, { db: { collections } }) => {
      const query = { where: { school: root.id, isDeleted: false } };
      if (search) {
        const words = search.split(/\s+/).filter(w => w.length > 0);
        query.where.and = words.map(word => ({
          or: [
            { names: { contains: word } },
            { registration: { contains: word } },
            { phone: { contains: word } }
          ]
        }));
      }
      return await collections.student.count(query);
    },
    parentsCount: async (root, { search = "" }, { db: { collections } }) => {
      const query = { where: { school: root.id, isDeleted: false } };
      if (search) {
        // Implement fuzzy search for count - split into words and search each field
        const words = search.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 1) {
          // Single word - use contains for broader matching
          query.where.or = [
            { name: { contains: words[0] } },
            { phone: { contains: words[0] } },
            { email: { contains: words[0] } },
            { national_id: { contains: words[0] } }
          ];
        } else {
          // Multiple words - each word must match in at least one field (fuzzy AND)
          query.where.and = words.map(word => ({
            or: [
              { name: { contains: word } },
              { phone: { contains: word } },
              { email: { contains: word } },
              { national_id: { contains: word } }
            ]
          }));
        }
      }
      return await collections.parent.count(query);
    },
    teachersCount: async (root, args, { db: { collections } }) => {
      return await collections.teacher.count({ where: { school: root.id, isDeleted: false } });
    },
    classesCount: async (root, args, { db: { collections } }) => {
      return await collections.class.count({ where: { school: root.id, isDeleted: false } });
    },
    busesCount: async (root, args, { db: { collections } }) => {
      return await collections.bus.count({ where: { school: root.id, isDeleted: false } });
    },
    driversCount: async (root, args, { db: { collections } }) => {
      return await collections.driver.count({ where: { school: root.id, isDeleted: false } });
    },
    adminsCount: async (root, args, { db: { collections } }) => {
      return await collections.admin.count({ where: { school: root.id, isDeleted: false } });
    },
    routesCount: async (root, args, { db: { collections } }) => {
      return await collections.route.count({ where: { school: root.id, isDeleted: false } });
    },
    schedulesCount: async (root, args, { db: { collections } }) => {
      return await collections.schedule.count({ where: { school: root.id, isDeleted: false } });
    },
    paymentsCount: async (root, args, { db: { collections } }) => {
      return await collections.payment.count({ where: { school: root.id, isDeleted: false } });
    },
    chargesCount: async (root, args, { db: { collections } }) => {
      return await collections.charge.count({ where: { school: root.id, isDeleted: false } });
    },
    eventsCount: async (root, args, { db: { collections } }) => {
      return await collections.event.count({ where: { school: root.id, isDeleted: false } });
    },
    booksCount: async (root, args, { db: { collections } }) => {
      return await collections.book.count({ where: { school: root.id, isDeleted: false } });
    },
    complaintsCount: async (root, args, { db: { collections } }) => {
      return await collections.complaint.count({ where: { school: root.id, isDeleted: false } });
    },
    gradeOrder: (root) => root.gradeOrder ? root.gradeOrder.split(",") : [],
    termOrder: (root) => root.termOrder ? root.termOrder.split(",") : [],
    async financial(root, args, { loaders }) {
      console.log(`[RESOLVER CALL] Calculating finances for School ID: ${root.id}`);

      // Constants for billing
      const COST_PER_SMS = 2.0; 
      const CHARS_PER_SMS = 160;

      // 1. Fetch all financial data sources in parallel
      const [allPayments, allCharges, allSmsEvents] = await Promise.all([
        loaders.paymentsBySchoolId.load(root.id),
        loaders.chargesBySchoolId.load(root.id),
        loaders.smsEventsBySchoolId.load(root.id) // Fetch SMS history to calculate usage
      ]);

      // 2. Separate Income: Bulk SMS vs General Fees
      let smsIncome = 0;
      let generalIncome = 0;

      allPayments.forEach(p => {
        if (p.status !== 'COMPLETED') return;
        const val = parseFloat(p.amount || p.ammount || 0);
        if (isNaN(val)) return;

        // Check if tagged for Bulk SMS in metadata
        let metadata = p.metadata || {};
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch(e) {}
        }

        if (metadata.type === 'bulksms' || p.type === 'bulksms') {
          smsIncome += val;
        } else {
          generalIncome += val;
        }
      });

      // 3. Calculate Expenses from Manual Charges (Legacy/Admin fees)
      const manualExpenses = allCharges.reduce((total, c) => {
        const val = parseFloat(c.amount || c.ammount || 0);
        return total + (isNaN(val) ? 0 : val);
      }, 0);

      // 4. Calculate Expenses from SMS Usage
      const smsExpenses = allSmsEvents.reduce((total, event) => {
        const successCount = event.successCount || 0;
        if (successCount === 0) return total;

        const content = event.messageTemplate || "";
        const length = content.length;
        const segments = length > 0 ? Math.ceil(length / CHARS_PER_SMS) : 1;
        const eventCost = segments * successCount * COST_PER_SMS;

        return total + eventCost;
      }, 0);

      // 5. Final Calculation
      const smsBalance = smsIncome - smsExpenses;
      const combinedBalance = (generalIncome + smsIncome) - (manualExpenses + smsExpenses);

      // Calculate how many standard (1-segment) SMS they can send with remaining balance
      const smsRemaining = Math.floor(smsBalance / COST_PER_SMS);

      console.log(`[Financial] School ${root.id}: SMS Income=${smsIncome}, SMS Exp=${smsExpenses}, SMS Bal=${smsBalance}, Total Bal=${combinedBalance}`);

      return { 
        balance: smsBalance, // Navbar uses 'balance' for SMS display now
        smsBalance: smsBalance,
        smsIncome: smsIncome,
        balanceFormated: `${Math.max(0, smsRemaining)} SMS's`
      };
    },

    assessments: async (root, args, { db: { collections } }) => {
      // Specialized resolver to fetch assessments for a specific Class + Term context
      // This avoids loading ALL school assessments into memory.
      console.log(`[RESOLVER CALL] specialized 'assessments' lookup for School ID: ${root.id}`, args);
      const { class: classId, term: termId, student: studentId, limit = 1000, offset = 0 } = args;

      const query = {
        where: {
          school: root.id,
        },
        limit,
        skip: offset,
      };

      if (termId) {
        query.where.term = termId;
      }

      if (studentId) {
        query.where.student = studentId;
      }

      if (classId) {
        // 1. Find the students in this class
        const studentsInClass = await collections.student.find({
            where: { class: classId },
            select: ['id']
        });
        const studentIds = studentsInClass.map(s => s.id);

        if (studentIds.length === 0) {
            return [];
        }
        
        // 2. Filter assessments by these students
        query.where.student = studentIds; // Waterline/Sails usually supports array for IN query
      }

      return await collections.assessment.find(query);
    },

    // ==============================================================================
    // PAGINATED NESTED RESOLVERS
    // ==============================================================================
    // The following resolvers accept `limit` (default: 25) and `offset` (default: 0)
    // arguments to paginate the results. They use DataLoader to solve the N+1
    // database query problem, then paginate the full result set in memory.
    // ==============================================================================

    // in nested.school
    students: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated students for School ID: ${root.id}`);
      console.log(`[RESOLVER ARGS] limit: ${limit}, offset: ${offset}, search: ${search}`);

      const query = {
        where: {
          school: root.id,
          isDeleted: false
        },
        skip: offset,
        limit: limit,
        sort: 'createdAt DESC'
      };

      if (search) {
        const words = search.split(/\s+/).filter(w => w.length > 0);
        query.where.and = words.map(word => ({
          or: [
            { names: { contains: word } },
            { registration: { contains: word } },
            { phone: { contains: word } }
          ]
        }));
      }

      return await collections.student.find(query);
    },
    buses: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated buses for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'createdAt DESC' };
      if (search) {
        query.where.or = [
          { plate: { contains: search } },
          { make: { contains: search } }
        ];
      }
      return await collections.bus.find(query);
    },
    charges: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated charges for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'time DESC' };
      if (search) {
        query.where.or = [
          { reason: { contains: search } },
          { amount: { contains: search } }
        ];
      }
      return await collections.charge.find(query);
    },
    chargeTypes: async (root, args, { loaders }) => {
      // Keep as is for now since it's usually a small list, or update if needed
      console.log(`[RESOLVER CALL] Queuing 'chargeTypes' lookup for School ID: ${root.id}`);
      const { limit = 100, offset = 0 } = args;
      const allItems = await loaders.chargeTypesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    payments: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated payments for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'time DESC' };
      if (search) {
        query.where.or = [
          { phone: { contains: search } },
          { ref: { contains: search } },
          { mpesaReceiptNumber: { contains: search } },
          { amount: { contains: search } }
        ];
      }
      return await collections.payment.find(query);
    },
    books: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated books for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'createdAt DESC' };
      if (search) {
        query.where.or = [
          { title: { contains: search } },
          { author: { contains: search } }
        ];
      }
      return await collections.book.find(query);
    },
    teachers: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated teachers for School ID: ${root.id}`);
      
      const query = {
        where: {
          school: root.id,
          isDeleted: false
        },
        skip: offset,
        limit: limit,
        sort: 'createdAt DESC'
      };

      if (search) {
        query.where.or = [
          { names: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ];
      }

      return await collections.teacher.find(query);
    },
    classes: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated classes for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'name ASC' };
      if (search) {
        query.where.name = { contains: search };
      }
      return await collections.class.find(query);
    },
    complaints: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated complaints for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'time DESC' };
      if (search) {
        query.where.content = { contains: search };
      }
      return await collections.complaint.find(query);
    },
    drivers: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated drivers for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'names ASC' };
      if (search) {
        query.where.or = [
          { names: { contains: search } },
          { phone: { contains: search } },
          { username: { contains: search } }
        ];
      }
      return await collections.driver.find(query);
    },
    admins: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated admins for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'names ASC' };
      if (search) {
        query.where.or = [
          { names: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ];
      }
      return await collections.admin.find(query);
    },
    parents: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated parents for School ID: ${root.id}`);
      
      const query = {
        where: {
          school: root.id,
          isDeleted: false
        },
        skip: offset,
        limit: limit,
        sort: 'createdAt DESC'
      };

      if (search) {
        // Implement fuzzy search - split into words and search each field
        const words = search.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 1) {
          // Single word - use contains for broader matching
          query.where.or = [
            { name: { contains: words[0] } },
            { phone: { contains: words[0] } },
            { email: { contains: words[0] } },
            { national_id: { contains: words[0] } }
          ];
        } else {
          // Multiple words - each word must match in at least one field (fuzzy AND)
          query.where.and = words.map(word => ({
            or: [
              { name: { contains: word } },
              { phone: { contains: word } },
              { email: { contains: word } },
              { national_id: { contains: word } }
            ]
          }));
        }
      }

      return await collections.parent.find(query);
    },
    routes: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated routes for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'name ASC' };
      if (search) {
        query.where.name = { contains: search };
      }
      return await collections.route.find(query);
    },
    trips: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated trips for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'startedAt DESC' };
      // Trips might be searched by date or driver name (harder since direct DB), just leave content search for now
      return await collections.trip.find(query);
    },
    schedules: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections } }) => {
      console.log(`[RESOLVER CALL] Fetching paginated schedules for School ID: ${root.id}`);
      const query = { where: { school: root.id, isDeleted: false }, skip: offset, limit: limit, sort: 'name ASC' };
      if (search) {
        query.where.name = { contains: search };
      }
      return await collections.schedule.find(query);
    },
    grades: async (root, { limit = 25, offset = 0, search = "" }, { db: { collections }, auth }) => {
      console.log(`[RESOLVER CALL] Fetching paginated grades for School ID: ${root.id}`);
      const isAdmin = auth && (auth.userType === 'sAdmin' || auth.userType === 'admin');
      const query = { 
        where: { 
          school: root.id, 
          isDeleted: false,
          ...(isAdmin ? {} : { isvisible: { '!=': false } })
        }, 
        skip: offset, 
        limit: limit, 
        sort: 'name ASC' 
      };
      if (search) {
        query.where.name = { contains: search };
      }
      return await collections.grade.find(query);
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
    smsEvents: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'smsEvents' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.smsEventsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    smsLogs: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'smsLogs' lookup for School ID: ${root.id}`);
      const { limit = 25, offset = 0 } = args;
      const allItems = await loaders.smsLogsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    assessmentTypes: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'assessmentTypes' lookup for School ID: ${root.id}`);
      const { limit = 100, offset = 0 } = args;
      const allItems = await loaders.assessmentTypesBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
    assessmentRubrics: async (root, args, { loaders }) => {
      console.log(`[RESOLVER CALL] Queuing 'assessmentRubrics' lookup for School ID: ${root.id}`);
      const { limit = 100, offset = 0 } = args;
      const allItems = await loaders.assessmentRubricsBySchoolId.load(root.id);
      return allItems.slice(offset, offset + limit);
    },
  }
};

export { list, single, listDeleted, nested };