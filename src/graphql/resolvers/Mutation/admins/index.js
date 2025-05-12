import { ObjectId } from "mongodb";
import argon2 from "argon2";
const { name } = require("./about.js"); // Assuming name = 'admin'
const prepareUser = require("../../../../utils/prepapreUser");
import roles from "../../../../utils/rolesMapping"; // Your roles mapping
import sms from "../../../../utils/sms";
import Handlebars from "handlebars";
const { UserError } = require("graphql-errors");

// Consider a stronger temporary password generator
function makeTempPassword(length = 6) {
  var text = "";
  // Use alphanumeric for slightly better security
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

const create = async (data, { auth, db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const roleId = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });
  const { school } = entry;

  // --- Find the correct role ID for admin ---
  const adminRoleKey = Object.keys(roles).find(key => roles[key].toLowerCase() === 'admin');
  if (!adminRoleKey) {
    console.error("Could not find role key for 'admin' in rolesMapping.js");
    throw new UserError("Server configuration error: Admin role not defined.");
  }
  const adminRoleId = parseInt(adminRoleKey, 10); // Assuming role keys are numeric strings
  // ---

  try {
    // Admins must be invited to set initial password
    entry.password = undefined;

    await collections[name].create(entry); // Use insertOne for clarity
    

    const roleUser = {
      id: roleId,
      role: adminRoleId, // Use the mapped role ID
      user: id, // Link to the admin ID
      school,
      isDeleted: false
    };

    console.log("Creating user_role entry:", roleUser);
    await collections.user_role.create(roleUser);

    // --- Optional: Create entry in generic 'users' table ---
    // Consider if this is truly needed for admins if login checks 'admin' table directly
    try {
      const userToCreate = await prepareUser(entry); // Ensure prepareUser handles missing password
      userToCreate.id = entry.id; // Ensure ID matches
      console.log("Creating generic users entry for admin:", userToCreate);
      await collections.users.create(userToCreate);
    } catch (prepareErr) {
      console.error("Error preparing or saving admin to generic users table:", prepareErr);
      // Decide if this error is critical
    }
    // --- End Optional ---

    return entry; // Return the created admin data (without password)

  } catch (err) {
    console.error("Error creating admin:", {err});
    // Check for specific DB errors like unique constraints (err.code === 11000 in Mongo)
    if (err.code === 11000) {
      throw new UserError("Admin with this email or phone already exists.");
    }
    // Avoid exposing raw err.details if possible
    // throw new UserError("Failed to create admin. Please check the details and try again.");
  }
};

const update = async (data, { db: { collections } }) => {
  const { id, ...payload } = data[name];

  if (!id) {
    throw new UserError("ID is required for update.");
  }

  try {
    if (payload.password && typeof payload.password === 'string' && payload.password.trim()) {
      payload.password = await argon2.hash(payload.password);
    } else {
      delete payload.password;
    }

    console.log(id, payload)
    await collections[name].update({ id }).set(payload);

    return { id };

  } catch (err) {
    console.error(`Error updating record ${id}:`, err);
    if (err instanceof UserError) {
      throw err;
    }
    throw new UserError("An error occurred during the update process.");
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


const invite = async (data, { db: { collections } }) => {
  const { school, user: adminId } = data[name]; // Assuming 'user' contains the admin ID

  try {
    const admin = await collections["admin"].findOne({ id: adminId, isDeleted: false });

    if (!admin) {
      throw new UserError(`Admin with ID ${adminId} not found or is deleted.`);
    }
    if (!admin.phone) {
      throw new UserError(`Admin ${admin.names || adminId} does not have a phone number.`);
    }

    const inviteSmsText = `
Hello {{names}},

You have been invited to ShulePlus.

Access the app here: https://play.google.com/store/apps/details?id=com.shule.plusapp

Use the following details to login:
Phone Number: {{phone_number}}
Password: {{password}}

Please change this password after logging in.`; // Added advice

    const template = Handlebars.compile(inviteSmsText);
    const password = makeTempPassword(6); // Use stronger password function
    const hashedPassword = await argon2.hash(password);
    const phone = admin.phone;

    const smsTemplateData = {
      names: admin.names || 'Admin', // Fallback name
      phone_number: phone,
      password // Send plain text password
    };
    const message = template(smsTemplateData);

    let smsSuccessful = false;
    let smsCost = '0.0'; // Default cost if SMS fails? Or handle differently?

    try {
      // Promisify or use async/await with the sms call if possible
      await new Promise((resolve, reject) => {
        sms({ data: { phone, message } }, (res, err) => {
          if (err) {
            console.error(`SMS sending failed for ${phone}:`, err);
            return reject(new Error(`Failed to send SMS to ${phone}.`)); // Reject the promise on error
          }
          console.log("SMS Send Response:", res);
          smsCost = res?.smsCost || '0.6'; // Get cost from response
          smsSuccessful = true;
          resolve(res); // Resolve on success
        });
      });

    } catch (smsError) {
      console.error("SMS sending process failed:", smsError);
      // Decide: Throw error and don't update password? Or proceed but log failure?
      // For now, let's throw to prevent password update without notification
      throw new UserError(`Failed to send invitation SMS to ${phone}. Please check the number or try again later.`);
    }

    // --- Only proceed if SMS was potentially successful ---
    // (Error is thrown above if sms call explicitly failed via callback 'err' or promise rejection)

    // Update admin password in DB *after* trying to send SMS
    const updateResult = await collections["admin"].updateOne(
      { id: admin.id },
      { $set: { password: hashedPassword } }
    );

    if (updateResult.modifiedCount !== 1) {
      console.warn(`Password for admin ${admin.id} might not have been updated.`);
      // Potentially throw an error here too if update must succeed
    } else {
      console.log(`Initial password set for admin ${admin.id}`);
    }

    // Create charge record (even if update failed? Or only if successful?)
    await collections["charge"].insertOne({
      id: new ObjectId().toHexString(),
      school,
      amount: parseFloat(smsCost) || 0.6, // Use amount, ensure numeric
      reason: `Sending invitation SMS to admin ${admin.names || adminId} (${phone})`,
      time: new Date(),
      isDeleted: false
    });


    // Create invitation log record
    const invitationId = new ObjectId().toHexString();
    const entry = {
      id: invitationId,
      school,
      user: admin.id, // Log the admin ID
      message, // Log the message sent (consider privacy implications)
      phone,
      email: admin.email, // Log email if available
      sentAt: new Date(),
      isDeleted: false
    };

    await collections["invitation"].insertOne(entry);

    return {
      id: invitationId, // Return invitation ID
      message: "Invitation SMS sent successfully.", // Confirmation message
      phone
    };

  } catch (err) {
    console.error("Error inviting admin:", err);
    if (err instanceof UserError) { // Re-throw UserErrors
      throw err;
    }
    // Generic error for other issues
    throw new UserError("An unexpected error occurred during the invitation process.");
  }
};


export default () => {
  return {
    create,
    update, // Keep existing update, archive, restore
    archive,
    invite,
    restore
  };
};