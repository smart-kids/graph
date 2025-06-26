import payments from "../../Mutation/payments/index.js";
import schedules from "../../Mutation/schedules/index.js";
import { sum, subtract } from "mathjs"
import invitations from "../../Mutation/invitations/index.js";
const { GraphQLError } = require('graphql')

const openSchoolId = "683eb0b3269670f07ed0901c"

const { name } = require("./about.js")
// This 'name' variable would typically be defined based on the model/collection being accessed.
// For example: const name = 'School'; // Or whatever your collection/model name is.
// It's used as `collections[name]`. Ensure it's correctly scoped for your setup.

const list = async (root, args, { auth, db: { collections } }) => {
  console.log({auth})
  // Get user type and potentially school ID from the validated auth context
  let { userType, schoolId, userId } = auth; // Destructure from context.auth

  if (userType === 'sAdmin') {
      // --- Superadmin: Full Access ---
      console.log(`[GraphQL School List] Superadmin querying all schools.`);
      const query = { where: { isDeleted: false } };
      const entries = await collections[name].find(query);
      console.log(`[GraphQL School List] Found ${entries.length} entries.`);
      return entries;
  } else if (userType === 'admin') {
      // --- Admin: Restricted Access ---
      if (!schoolId) {
           // This should ideally be caught during token generation, but double-check
           console.error(`Authorization Error: User type ${userType} requires a schoolId in token, but none found.`);
           throw new GraphQLError('Access Denied: User configuration incomplete.', {
               extensions: { code: 'FORBIDDEN' },
           });
      }
      // Filter strictly by the school ID from the token
      const query = { where: { id: schoolId, isDeleted: false } };
      const entries = await collections[name].find(query);
      console.log(`[GraphQL School List] Found ${entries.length} entries.`);
      return entries;
  } else if (userType === 'parent') {
      // --- Parent: Restricted Access ---

      // Filter strictly by the school ID from the token in the parents collection
      const query = { where: { id: userId, isDeleted: false } };
      console.log(`[GraphQL School List] Querying parents collection for user ${userId} with schoolId ${schoolId}.`);
      const parents = await collections["parent"].find(query);
      if (parents.length === 0) {
          console.error(`Authorization Error: User type ${userType} not found in parents collection with schoolId ${schoolId}.`);
          throw new GraphQLError('Access Denied: User not found in parents collection.', {
              extensions: { code: 'FORBIDDEN' },
          });
      }

      const school = parents[0].school;
      console.log(`[GraphQL School List] Found school ${school} for parent ${userId}.`);
      const entry = await collections[name].findOne({where: {id: school, isDeleted: false}});
      const openEntry = await collections[name].findOne({where: {id: openSchoolId, isDeleted: false}});
      console.log({entry, openEntry})
      console.log(`[GraphQL School List] Found ${entry ? 1 : 0} entries.`);
      return [entry, openEntry];
  } else if (userType === 'driver') {
    // --- Parent: Restricted Access ---

    // Filter strictly by the school ID from the token in the drivers collection
    const query = { where: { id: userId, isDeleted: false } };
    console.log(`[GraphQL School List] Querying drivers collection for user ${userId} with schoolId ${schoolId}.`);
    const drivers = await collections["driver"].find(query);
    if (drivers.length === 0) {
        console.error(`Authorization Error: User type ${userType} not found in drivers collection with schoolId ${schoolId}.`);
        throw new GraphQLError('Access Denied: User not found in drivers collection.', {
            extensions: { code: 'FORBIDDEN' },
        });
    }

    const school = drivers[0].school;
    console.log(`[GraphQL School List] Found school ${school} for driver ${userId}.`);
    const entry = await collections[name].findOne({where: {id: school, isDeleted: false}});
    console.log({entry})
    console.log(`[GraphQL School List] Found ${entry ? 1 : 0} entries.`);
    return [entry];
} else {
      // Other roles not supported
      console.error(`Authorization Error: User type ${userType} not supported.`);
      throw new GraphQLError('Access Denied: User type not supported.', {
          extensions: { code: 'FORBIDDEN' },
      });
  }
};

  const single = async (root, args, { auth, db: { collections }, open }) => {
    if(open) {
      

      const entries = await collections[name].find({where: {id: openSchoolId, isDeleted: false}});
      const entry = entries.length > 0 ? entries[0] : null;
      console.log(`[GraphQL School Single] Open querying school: ${openSchoolId}`);
      return entry;
    }

     // ID of the school being requested from query arguments
    let { userType, school, schoolId } = auth; // User's type and school ID from their token
    let userTokenSchoolId = schoolId || school
    // const { id: requestedSchoolId } = args;
    let requestedSchoolId = userTokenSchoolId
    userType = auth?.admin?.user === 'Super Admin' ? 'sAdmin' : userType

    console.log(`[GraphQL School Single] UserType: ${userType}, UserTokenSchoolId: ${schoolId}, RequestedSchoolId: ${requestedSchoolId}`, root);

    if (!requestedSchoolId) {
      throw new GraphQLError('Bad Request: School ID must be provided.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    let query = { where: { id: requestedSchoolId, isDeleted: false } };

    

    if (userType === 'sAdmin') {
      // Superadmin can access any non-deleted school by its ID.
      console.log(`[GraphQL School Single] sAdmin querying school: ${requestedSchoolId}`);
    } else if (userType === 'admin' || userType === 'driver' || userType === 'parent' || userType === 'student' || userType) { // Catches other known roles or any userType that implies restriction
      // For any other user type that is school-bound.
      if (!userTokenSchoolId) {
        console.error(`Authorization Error: User type ${userType} requires a schoolId in token.`);
        throw new GraphQLError('Access Denied: User configuration incomplete.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      // These users can only access their own assigned school.
      if (requestedSchoolId !== userTokenSchoolId) {
        console.warn(`[GraphQL School Single] Forbidden: User (${userType}) from school ${userTokenSchoolId} attempted to access school ${requestedSchoolId}.`);
        return null; // Not authorized to see this specific school, or it doesn't exist for them.
      }
      // If we are here, requestedSchoolId === userTokenSchoolId. Query is already set correctly.
      console.log(`[GraphQL School Single] User ${userType} querying for their school: ${requestedSchoolId}`);
    } else {
      // Fallback for undefined userType or unhandled roles.
      console.error(`[GraphQL School Single] Access Denied: Unknown or unauthorized user type: ${userType}.`);
      throw new GraphQLError('Access Denied.', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Consider using findOne if your ORM/DB layer supports it efficiently for single record queries.
    const entries = await collections[name].find(query);
    const entry = entries.length > 0 ? entries[0] : null;

    console.log(`[GraphQL School Single] Found entry: ${entry ? entry.id : 'null'}`);
    return entry;
  };

const listDeleted = async (root, args, { auth, db: { collections } }) => {
  const { userType } = auth; // Assuming auth.userType is 'sAdmin' for superadmins.

  if (userType !== 'sAdmin') { // Match 'sAdmin' type used in 'list'
    console.warn(`[GraphQL School ListDeleted] Access Denied: User type ${userType} attempted operation.`);
    throw new GraphQLError('Access Denied: You do not have permission to view deleted schools.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  console.log(`[GraphQL School ListDeleted] sAdmin querying deleted schools.`);
  const entries = await collections[name].find({
    where: { isDeleted: true }
  });
  console.log(`[GraphQL School ListDeleted] Found ${entries.length} deleted entries.`);
  return entries;
};

const nested = {
  school: {
    gradeOrder(root, args, { db: { collections } }) {
      return root.gradeOrder ? root.gradeOrder.split(",") : [];
    },
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
