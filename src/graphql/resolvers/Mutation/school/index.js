import { ObjectId } from "mongodb"
const { name } = require("./about.js")
import argon2 from "argon2"
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"
import generatePassword from "../../../../utils/generatePassword"

const { UserError } = require("graphql-errors");

const default_roles_per_school = [
  "Admin",
  "Driver",
  // "Student",
  // "Parent",
]

const create = async (data, { db: { collections } }) => {
  // Assuming 'name' is a variable available in this scope, e.g., "school"
  // It would be better if 'name' was passed as an argument or clearly defined.
  // For this example, I'll assume 'name' holds the primary model name (e.g., "school")
  const modelName = name; // To make it clearer in logs

  console.log(`[${modelName} Create] Received data for new ${modelName}:`, data[modelName]);

  const { phone, email, ...restOfModelData } = data[modelName]; // Destructure phone and email early for clarity

  try {
    console.log(`[${modelName} Create] Checking if ${modelName} with phone ${phone} already exists...`);
    const phoneTaken = await collections[modelName].find({ phone, isDeleted: false });

    if (phoneTaken.length) {
      console.warn(`[${modelName} Create] ${modelName} with phone ${phone} already exists. Found:`, phoneTaken);
      throw new UserError(`A ${modelName} with the phone number ${phone} already exists!.`);
    }
    console.log(`[${modelName} Create] Phone number ${phone} is available.`);
  } catch (err) {
    // If it's a UserError we threw, rethrow it to be caught by GraphQL/caller
    if (err instanceof UserError) {
        console.error(`[${modelName} Create] UserError during phone check:`, err.message);
        throw err;
    }
    // For other unexpected errors during find
    console.error(`[${modelName} Create] Error during phone check for ${modelName} with phone ${phone}:`, err);
    // Decide if you want to throw a generic error or a UserError here
    throw new UserError(`An unexpected error occurred while checking phone availability for ${modelName}.`);
  }

  const newId = new ObjectId().toHexString();
  console.log(`[${modelName} Create] Generated new ID for ${modelName}: ${newId}`);

  const inviteSmsText = `Hello {{username}}, 

You have been invited to join {{team_name}} on ShulePlus.

access admin here https://cloud.shuleplus.co.ke

use 

phone number: {{phone_number}}
password: {{password}}`;

  let { gradeOrder, termOrder } = data[modelName]; // gradeOrder and termOrder might be undefined
  gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  termOrder = termOrder ? termOrder.join(",") : "";
  console.log(`[${modelName} Create] Processed gradeOrder: "${gradeOrder}", termOrder: "${termOrder}"`);

  const entryToCreate = {
    ...restOfModelData, // Spread the rest of the original data
    phone,              // Add back phone
    email,              // Add back email (if it was part of original data[name])
    inviteSmsText,
    gradeOrder,
    termOrder,
    id: newId,          // Use the generated ID
    isDeleted: false,
  };

  console.log(`[${modelName} Create] Attempting to create ${modelName} with entry:`, entryToCreate);

  try {
    const createdEntry = await collections[modelName].create(entryToCreate).fetch(); // Use .fetch() to get the full record
    console.log(`[${modelName} Create] Successfully created ${modelName}:`, createdEntry);

    // Assuming email and phone for the admin user come from the main entry's data
    const adminUserEmail = createdEntry.email; // Or data[modelName].email if preferred
    const adminUserPhone = createdEntry.phone; // Or data[modelName].phone

    if (!adminUserEmail || !adminUserPhone) {
        console.error(`[${modelName} Create] Missing email or phone for creating associated admin user for ${modelName} ID ${createdEntry.id}. Email: ${adminUserEmail}, Phone: ${adminUserPhone}`);
        // Decide how to handle this: throw error, or proceed without admin user?
        // For now, let's throw an error as an admin user seems intended.
        throw new UserError(`Cannot create admin user: email or phone not provided with ${modelName} data.`);
    }

    const adminId = new ObjectId().toHexString();
    console.log(`[${modelName} Create] Generated ID for admin user: ${adminId}`);

    const adminUserEntry = {
      id: adminId,
      names: adminUserEmail, // Or a dedicated 'names' field from input
      email: adminUserEmail,
      phone: adminUserPhone,
      password: adminUserPhone, // SECURITY WARNING: Storing phone as password is very insecure. HASH PASSWORDS!
      school: createdEntry.id, // Link to the newly created school/main entry
      isDeleted: false, // Default for new user
      // Consider adding a default role here if applicable
    };

    console.log(`[${modelName} Create] Attempting to create admin user with entry:`, adminUserEntry);
    await collections["users"].create(adminUserEntry).fetch(); // Use .fetch()
    console.log(`[${modelName} Create] Successfully created admin user for ${modelName} ID ${createdEntry.id}`);

    // Return the main created entry (e.g., the school)
    // The original code returned `entry` which was the input object with the new ID.
    // Returning `createdEntry` is better as it's the actual record from the DB.
    return createdEntry;

  } catch (err) {
    console.error(`[${modelName} Create] Error during ${modelName} or admin user creation (ID ${newId}):`, err);
    // If err.details exists (common for Waterline validation errors), log it for more info
    if (err.details) {
        console.error(`[${modelName} Create] Waterline Error Details:`, err.details);
    }
    // If it's a UserError we threw (e.g., missing email/phone for admin), rethrow it
    if (err instanceof UserError) {
        throw err;
    }
    throw new UserError(err.details || `An unexpected error occurred while creating the ${modelName}.`);
  }
};

const update = async (data, { db: { collections } }) => {
  const { id } = data[name];
  const entry = data[name];
  let { gradeOrder } = entry;
  entry.gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  let { termOrder } = entry;
  entry.termOrder = termOrder ? termOrder.join(",") : "";

  try {
    delete entry.id;

    await collections[name].update({ id }).set(entry);

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: true });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: false });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};


const pay = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].findOne({ id, isDeleted: false })

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const invite = async (data, { db: { collections } }) => {
  try {
    const { id: schoolId, name: schoolName } = data[name];
    console.log({ data })

    const admins = await collections["admin"].find({ where: { school: schoolId, isDeleted: false } });

    if (admins.length > 1) {
      console.log("found multiple admins for ", schoolId, data)
    }

    var admin = admins[0]

    const inviteSmsText = `
Hello {{username}}, 

You are being invited to join ShulePlus as an administrator for {{schoolName}}.

access your portal here https://cloud.shuleplus.co.ke

and download mobile app here https://play.google.com/store/apps/details?id=com.shule.plusapp

use the following details to login to the app
phone number: {{phone}}`

    const template = Handlebars.compile(inviteSmsText);
    const password = generatePassword();
    const hashedPassword = await argon2.hash(password);
    const { phone, username } = admin;

    const message = template({
      username,
      phone,
      password,
      schoolName
    })

    console.log("sending message", message)
    sms({ data: { phone, message } },
      async (res) => {
        const { smsCost = 0 } = res
        await collections["charge"].create({
          id: new ObjectId().toHexString(),
          school: schoolId,
          ammount: smsCost,
          reason: `Sending message '${message}'`,
          time: new Date(),
          isDeleted: false
        })
      }
    )
    await collections["admin"].update({ id: admin.id }).set({ password: hashedPassword });
    await collections["invitation_passwords"].insert({ id: admin.id }, { upsert: true }).set({ password: hashedPassword });

    const invitationId = new ObjectId().toHexString();
    const entry = Object.assign({ id: invitationId, school: schoolId, user: admin.id, message, phone, email: admin.email, isDeleted: false });

    await collections["invitation"].create(entry);
    return {
      id: invitationId,
      message,
      phone
    };
  } catch (err) {
    console.log(err)
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    update,
    archive,
    restore,
    invite,
  };
};
