import payments from "../../Mutation/payments/index.js";
import schedules from "../../Mutation/schedules/index.js";
import { sum, subtract } from "mathjs"
import invitations from "../../Mutation/invitations/index.js";
const { GraphQLError } = require('graphql')

const { name } = require("./about.js")

const list = async (root, args, { auth, db: { collections } }) => {
  console.log(auth)
  // Get user type and potentially school ID from the validated auth context
  const { userType, school:schoolId } = auth; // Destructure from context.auth

  console.log(`[GraphQL School List] UserType: ${userType}, SchoolId from Token: ${schoolId}`);

  let query = { where: { isDeleted: false } };

  // { admin: { user: 'Super Admin' }, iat: 1745186074 }

  if (userType === 'admin' || userType === 'driver') {
      // --- Admin/Driver: Restricted Access ---
      if (!schoolId) {
           // This should ideally be caught during token generation, but double-check
           console.error(`Authorization Error: User type ${userType} requires a schoolId in token, but none found.`);
           throw new GraphQLError('Access Denied: User configuration incomplete.', {
               extensions: { code: 'FORBIDDEN' },
           });
      }
      // Filter strictly by the school ID from the token
      query.where.id = schoolId;
      console.log(`[GraphQL School List] Querying for specific school: ${schoolId}`);

  } else if (userType === 'sAdmin') {
      // --- Superadmin: Full Access ---
      // No additional school filtering needed, query remains { isDeleted: false }
      console.log(`[GraphQL School List] Superadmin querying all schools.`);

  } else {
      // --- Other roles (e.g., parent, student) ---
      // Assuming they also need to be tied to a specific school via schoolId in token
      if (!schoolId) {
           console.error(`Authorization Error: User type ${userType} requires a schoolId in token, but none found.`);
            throw new GraphQLError('Access Denied: User configuration incomplete.', {
               extensions: { code: 'FORBIDDEN' },
           });
      }
      query.where.id = schoolId;
       console.log(`[GraphQL School List] Querying for specific school for role ${userType}: ${schoolId}`);
      // If parents/students might need access to multiple schools (unlikely?), adjust logic.
  }

  const entries = await collections[name].find(query);
  console.log(`[GraphQL School List] Found ${entries.length} entries.`);
  return entries;
};

const listDeleted = async (root, args, { auth, db: { collections } }) => {
  // Only allow superadmins to see deleted schools
   const { userType } = auth;
   if (userType !== 'superadmin') {
        throw new GraphQLError('Access Denied: You do not have permission to view deleted schools.', {
               extensions: { code: 'FORBIDDEN' },
           });
   }
   const entries = await collections[name].find({
       where: { isDeleted: true }
   });
   return entries;
};

const single = async (root, args, { auth, db: { collections } }) => {
  // Get user type and potentially school ID from the validated auth context
  const { userType, schoolId: userSchoolId } = auth; // schoolId from token
  const requestedSchoolId = userSchoolId; // ID requested in the query arguments

  console.log(`[GraphQL School Single] UserType: ${userType}, UserSchoolId: ${userSchoolId}, RequestedId: ${requestedSchoolId}`);

  let query = { where: { id: requestedSchoolId, isDeleted: false } };

  if (userType === 'admin' || userType === 'driver') {
      // --- Admin/Driver: Restricted Access ---
      if (!userSchoolId) {
           console.error(`Authorization Error: User type ${userType} requires a schoolId in token.`);
           throw new GraphQLError('Access Denied: User configuration incomplete.', {
               extensions: { code: 'FORBIDDEN' },
           });
      }
      // Must request their OWN school ID
      if (requestedSchoolId !== userSchoolId) {
          console.warn(`[GraphQL School Single] Forbidden: User ${auth.userId} (${userType}) attempted to access school ${requestedSchoolId} but is assigned to ${userSchoolId}.`);
           // Return null or throw forbidden error - returning null is often standard for "not found" in GraphQL single queries
           // throw new GraphQLError('Access Denied: You can only access your assigned school.', {
           //    extensions: { code: 'FORBIDDEN' },
           // });
           return null;
      }
      // Query is already set correctly: where: { id: requestedSchoolId (which equals userSchoolId), isDeleted: false }

  } else if (userType === 'superadmin') {
      // --- Superadmin: Full Access ---
      // Can query any school by ID, query is already correct: where: { id: requestedSchoolId, isDeleted: false }
      console.log(`[GraphQL School Single] Superadmin querying school: ${requestedSchoolId}`);

  } else {
      // --- Other roles (e.g., parent, student) ---
       if (!userSchoolId) {
           console.error(`Authorization Error: User type ${userType} requires a schoolId in token.`);
           throw new GraphQLError('Access Denied: User configuration incomplete.', {
               extensions: { code: 'FORBIDDEN' },
           });
       }
       // Must request their OWN school ID
      if (requestedSchoolId !== userSchoolId) {
           console.warn(`[GraphQL School Single] Forbidden: User ${auth.userId} (${userType}) attempted to access school ${requestedSchoolId} but is assigned to ${userSchoolId}.`);
          return null; // Not found for them
      }
      // Query is already correct.
  }

  // Use findOne for single queries for efficiency if your adapter supports it well
  // const entry = await collections[name].findOne(query);
  // Using find and taking the first element for consistency with your original code:
  const entries = await collections[name].find(query);
  const entry = entries.length > 0 ? entries[0] : null;

  console.log(`[GraphQL School Single] Found entry: ${entry ? entry.id : 'null'}`);
  return entry;
};

const nested = {
  school: {
    async financial(root, args, { db: { collections } }) {
      const payments = await collections["payment"].find({
        where: { school: root.id, isDeleted: false }
      });

      const charges = await collections["charge"].find({
        where: { school: root.id, isDeleted: false }
      });

      const paymentsSum = sum(payments.map(p => p.ammount))
      const chargesSum = sum(charges.map(p => p.ammount))

      const balance = subtract(paymentsSum, chargesSum)

      var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'KSH',
      });

      return {
        balance,
        balanceFormated: formatter.format(balance)
      }
    },
    async gradeOrder(root, args, { db: { collections } }) {
      return root.gradeOrder ? root.gradeOrder.split(",") : [];
    },
    async termOrder(root, args, { db: { collections } }) {
      return root.termOrder ? root.termOrder.split(",") : [];
    },
    async students(root, args, { db: { collections } }) {
      const entries = await collections["student"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async buses(root, args, { db: { collections } }) {
      const entries = await collections["bus"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async charges(root, args, { db: { collections } }) {
      const entries = await collections["charge"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async payments(root, args, { db: { collections } }) {
      const entries = await collections["payment"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async teachers(root, args, { db: { collections } }) {
      const entries = await collections["teacher"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async classes(root, args, { db: { collections } }) {
      const entries = await collections["class"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async complaints(root, args, { db: { collections } }) {
      const entries = await collections["complaint"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async drivers(root, args, { db: { collections } }) {
      const entries = await collections["driver"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async admins(root, args, { db: { collections } }) {
      const entries = await collections["admin"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async parents(root, args, { db: { collections } }) {
      const entries = await collections["parent"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async routes(root, args, { db: { collections } }) {
      const entries = await collections["route"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async trips(root, args, { db: { collections } }) {
      const entries = await collections["trip"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async schedules(root, args, { db: { collections } }) {
      const entries = await collections["schedule"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async grades(root, args, { db: { collections } }) {
      const entries = await collections["grade"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async terms(root, args, { db: { collections } }) {
      const entries = await collections["term"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async teams(root, args, { db: { collections } }) {
      const entries = await collections["team"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async invitations(root, args, { db: { collections } }) {
      const entries = await collections["invitation"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    }
  }
};

export { list, single, listDeleted, nested };
