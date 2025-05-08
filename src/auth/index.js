require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import { ObjectId } from "mongodb"
import express from "express";
import Joi from "joi"
import jwt from "jsonwebtoken"
import bodyParser from "body-parser"
import argon2 from "argon2"
import sms from "../utils/sms"
import roles from "../utils/rolesMapping"
// import config from "../config"

const validator = require('express-joi-validation').createValidator({})

const { NODE_ENV = 'development', SUPER_ADMIN_PASSWORD = '00000', ENCRYPTION_TOKEN = "privateKEY" } = process.env;

const config = {
    secret: ENCRYPTION_TOKEN
}

const checkToken = (req, res, next) => {
    const token = req.headers['authorization']; // Or however you get the token

    if (!token) {
        return res.status(403).send({ success: false, message: 'No token provided.' });
    }

    // Remove "Bearer " prefix if present
    const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    jwt.verify(bearerToken, config.secret, (err, decoded) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.status(401).send({ success: false, message: 'Failed to authenticate token.' });
        }

        // Attach the *entire decoded payload* to req.auth
        req.auth = decoded; // Contains userId, userType, schoolId (if applicable)
        console.log("Token Decoded:", req.auth); // For debugging
        next();
    });
};


async function generateTokenForUser(userId, determinedUserType, collections) {
    let userRecord;
    let dbCollectionName;
    let payload = {}; // Initialize payload

    console.log(`Generating token for userId: ${userId}, userType: ${determinedUserType}`);

    // --- Determine Collection and Fetch Record ---
    try {
        switch (determinedUserType) {
            case 'superadmin':
                // Superadmins might be special cases - maybe fetch from 'admin' or a dedicated 'superadmin' collection?
                // Or maybe their core info is in 'users' and the type alone is enough?
                // Let's assume for now their basic info is sufficient from the initial 'users' lookup,
                // and we just need to confirm the type. Fetching again might be redundant if no extra info (like school) is needed.
                // We'll fetch from 'users' again just to be consistent, but you might optimize this.
                dbCollectionName = 'users';
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } });
                if (!userRecord) throw new Error(`Superadmin record not found in ${dbCollectionName} for ID: ${userId}`);
                // No schoolId needed in token for superadmin
                payload = {
                    userId: userRecord.id,
                    userType: 'superadmin', // Explicitly set type
                    // Add other relevant superadmin details if necessary
                };
                break; // Exit switch

            case 'admin':
                dbCollectionName = 'admin'; // Use the specific admin collection
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming admin has its own id matching users.id
                if (!userRecord) throw new Error(`Admin record not found in ${dbCollectionName} for ID: ${userId}`);
                if (!userRecord.school) {
                    console.error(`Admin user ${userId} has no school assigned.`);
                    throw new Error("Admin account configuration incomplete (missing school).");
                }
                payload = {
                    userId: userRecord.id,
                    userType: 'admin',
                    schoolId: userRecord.school, // Include school ID
                };
                break; // Exit switch

            case 'driver':
                dbCollectionName = 'driver'; // Use the specific driver collection
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming driver has its own id
                if (!userRecord) throw new Error(`Driver record not found in ${dbCollectionName} for ID: ${userId}`);
                if (!userRecord.school) {
                    console.error(`Driver user ${userId} has no school assigned.`);
                    throw new Error("Driver account configuration incomplete (missing school).");
                }
                payload = {
                    userId: userRecord.id,
                    userType: 'driver',
                    schoolId: userRecord.school, // Include school ID
                };
                break; // Exit switch

            case 'parent':
                dbCollectionName = 'parent'; // Use the specific parent collection
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming parent has its own id
                if (!userRecord) throw new Error(`Parent record not found in ${dbCollectionName} for ID: ${userId}`);
                // Decide if parents need schoolId in token based on your access rules
                // If parents are always linked to one school, include it.
                // Let's assume they might be linked via students, so maybe school isn't directly on parent record
                // or maybe it is. Adjust as needed. For now, let's assume it might be needed.
                // if (!userRecord.school) { // Check if school is directly on parent
                //    console.error(`Parent user ${userId} has no school assigned.`);
                //    throw new Error("Parent account configuration incomplete (missing school).");
                // }
                payload = {
                    userId: userRecord.id,
                    userType: 'parent',
                    // schoolId: userRecord.school, // Include if available and needed
                };
                break; // Exit switch

            default:
                // Handle unknown or default user types if necessary
                console.warn(`Attempting token generation for unknown user type: ${determinedUserType}`);
                // Maybe fetch from 'users' as a fallback?
                userRecord = await collections['users'].findOne({ where: { id: userId, isDeleted: false } });
                if (!userRecord) throw new Error(`Generic user record not found for ID: ${userId}`);
                payload = {
                    userId: userRecord.id,
                    userType: 'user', // Assign a default type or the one from the record if available
                };
            // Decide if login should be allowed for default/unknown types
        }

    } catch (fetchError) {
        console.error(`Error fetching record for token generation (userId: ${userId}, type: ${determinedUserType}):`, fetchError);
        throw new Error(`Failed to retrieve user details for ${determinedUserType}.`); // Throw generic error
    }


    // --- Sign JWT ---
    // Ensure JWT_SECRET or ENCRYPTION_TOKEN is correctly loaded from process.env
    // const secret = process.env.ENCRYPTION_TOKEN || process.env.JWT_SECRET; // Use the correct env var
    if (!ENCRYPTION_TOKEN) {
        console.error("JWT Signing Error: Secret key is missing in environment variables.");
        throw new Error("Authentication configuration error.");
    }
    const token = jwt.sign(payload, ENCRYPTION_TOKEN, { expiresIn: '1d' }); // Standard expiry

    // --- Prepare Safe User Data ---
    // Return the specific record found (admin, driver, etc.) after sanitizing
    const safeUserData = { ...userRecord };
    delete safeUserData.password; // Remove password if present
    delete safeUserData.otp;      // Remove OTP details if present
    delete safeUserData.otpSecret;// Remove OTP secrets
    // Add any other fields to remove

    console.log("Generated Token Payload:", payload);
    return { token, user: safeUserData };
}

var router = express.Router()

router.use(bodyParser.urlencoded({ extended: false }))
router.use(bodyParser.json())
router.get("/health", async (req, res) => {
    console.log("Health check requested");
    try {
        const db = req.app.locals.db;
        await db.postgres.query("SELECT 1");
        console.log("Health check successful");
        res.json({ status: "ok" });
    } catch (error) {
        console.error("Health check failed:", error);
        res.status(500).json({ status: "error" });
    }
});

// / Define Superadmin Phone Numbers (move to .env ideally)
const SUPERADMIN_PHONES = process.env.SUPERADMIN_PHONES ? process.env.SUPERADMIN_PHONES.split(',') : ['0743214470', '0711657108']; // Example: Load from env, comma-separated

router.post(
    "/verify/sms",
    validator.body(Joi.object({
        user: Joi.string().required(), // phone number or email
        password: Joi.string().required() // OTP code
    })),
    async (req, res) => {
        const db = await req.app.locals.db; // Get DB instance correctly
        const { collections } = db;
        const { user, password } = req.body;

        let userInfo;
        let determinedUserType = null;
        let specificUserRecord = null; // To hold admin/driver/parent record if found

        try {
            // --- 1. Find User in Specific Role Collections ---
            const userSearchingObject = {
                isDeleted: false,
                phone: user
            };
            const [adminUser] = await collections["admin"].find({ where: userSearchingObject });
            const [driverUser] = await collections["driver"].find({ where: userSearchingObject });
            if (adminUser) {
                specificUserRecord = adminUser;
                determinedUserType = 'admin';
            } else if (driverUser) {
                specificUserRecord = driverUser;
                determinedUserType = 'driver';
            } else {
                console.log(`User not found for input: ${user}`);
                return res.status(401).send({ message: 'User not found.' });
            }

            // --- 2. Verify OTP ---
            const [otpData] = await collections["otp"].find({
                where: {
                    user: specificUserRecord.id, // Use the ID from the found user
                    password: password, // The OTP code entered by the user
                    used: false
                }
            });

            if (!otpData) {
                console.log(`Invalid or used OTP for user: ${specificUserRecord.id}`);
                // Optional: Check if OTP exists but is wrong vs not found/used
                return res.status(401).send({ message: "Invalid or expired OTP." });
            }

            console.log(`OTP verified successfully for user: ${specificUserRecord.id}`);

            // --- 3. Mark OTP as Used (Important!) ---
            await collections["otp"].update({ id: otpData.id }).set({ used: true });
            console.log(`OTP marked as used: ${otpData.id}`);

            // --- 4. Generate Structured Token ---
            // We use specificUserRecord.id as the canonical user identifier
            const { token, user: safeUserData } = await generateTokenForUser(specificUserRecord.id, determinedUserType, collections);

            // --- 5. Send Response ---
            return res.send({ token, user: safeUserData }); // Send structured token and sanitized user data

        } catch (error) {
            console.error("Error during SMS verification:", error);
            // Send a generic error message to the client
            return res.status(500).send({ message: error.message || "An internal server error occurred during verification." });
        }
    }
);


function makeid() {
    var text = "";
    var possible = "123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

router.post(
    "/super",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string().required()
    })),
    async (req, res) => {
        const { user, password } = req.body

        const data = {
            admin: {
                user: 'Super Admin'
            }
        }

        if (user === 'sAdmin' && password === SUPER_ADMIN_PASSWORD) {
            var token = jwt.sign(data, config.secret);
            return res.send({
                token,
                data
            })
        }

        res.status(401).send()
    }
);


router.post(
    "/register",
    validator.body(Joi.object({
        name: Joi.string().required(),
        phone: Joi.string(),
        email: Joi.string(),
        address: Joi.string()
    })),
    async (req, res) => {
        // create a school object
        const db = await req.app.locals.db
        const { collections } = db
        const { name, phone, email, address } = req.body

        const schoolId = new ObjectId().toHexString();
        await collections["school"].create({
            id: schoolId,
            name,
            phone,
            email,
            address
        })

        // create a use who is the admin with the phone number
        const adminId = new ObjectId().toHexString();
        await collections["admin"].create({
            id: adminId,
            username: email,
            names: name,
            email,
            phone,
            school: schoolId
        })

        // send an sms with welcome and link to download the app
        sms({
            school: schoolId,
            data: { message: `Thank you for registering ${name} to Shule Plus. Shule Plus is an efficient, reliable and secure communication platform for schools to communicate with parents about the safety of their children. Please login to our app to start enjoying our services. For support please contact us on email: support@shuleplus.co.ke phone: +254743214479 :start here shuleplus.co.ke`, phone }
        }, console.log)

        sms({
            school: schoolId,
            data: {
                message: `
                This is a sample message

                Hello {{parent_name}}, 

Our {{school_name}} bus has confirmed that it just dropped {{student_name}} at their usual pickup location. 
            
We would like to thank you for your continued commitment to time and safety.`, phone
            }
        }, console.log)

        sms({
            school: schoolId,
            data: {
                message: `A new school with the following details has been registered: name - ${name}, email - ${email}, phone - ${phone}`,
                phone: "+254743214479"
            }
        }, console.log)

        const data = {
            admin: {
                school: schoolId,
                user: email
            }
        }

        var token = jwt.sign(data, config.secret);
        return res.send({
            token,
            data
        })
        //TODO send an email with the welcome page, app and admin login

    })

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

router.post(
    "/otp/send",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string()
    })),
    async (req, res) => {
        console.log(req.body)
        const db = await req.app.locals.db
        const { collections } = db
        const { user } = req.body

        let userInfo;
        let determinedUserType = null;
        let specificUserRecord = null; // To hold admin/driver/parent record if found

        const userSearchingObject = {
            isDeleted: false
        }

        if (validateEmail(user)) {
            Object.assign(userSearchingObject, { email: user })
        } else {
            Object.assign(userSearchingObject, { phone: user })
        }

        // Check Admin Collection
        [specificUserRecord] = await collections["admin"].find(userSearchingObject);
        if (specificUserRecord) {
            determinedUserType = 'admin';
            console.log(`User type determined: admin (phone: ${user}, id: ${specificUserRecord.id})`);
        } else {
            // Check Driver Collection
            [specificUserRecord] = await collections["driver"].find(userSearchingObject);
            if (specificUserRecord) {
                determinedUserType = 'driver';
                console.log(`User type determined: driver (phone: ${user}, id: ${specificUserRecord.id})`);
            } else {
                // User exists in 'users' but not in specific role collections
                determinedUserType = 'user'; // Assign a default type
                specificUserRecord = await collections["users"].findOne(userSearchingObject); // Use base info
                console.warn(`User ${user} (phone: ${user}) not found in admin, driver, or parent collections. Assigning default type 'user'.`);
                // **Decision Point:** Should default 'user' type be allowed to log in?
                // If not, throw an error here:
                // return res.status(403).send({ message: "Access Denied: User role not configured for login." });
            }
        }

        if (!specificUserRecord) {
            return res.status(401).send({
                success: false,
            })
        }

        // generate OTP, send it and save it
        const password = ['development', "test"].includes(NODE_ENV) ? '0000' : makeid()

        const otpSaveInfo = await collections["otp"].create({
            id: new ObjectId().toHexString(),
            user: specificUserRecord.id,
            password
        })

        console.log({ otpSaveInfo })

        // send sms to phone
        if (!['development', "test"].includes(NODE_ENV)) {
            return sms({
                // school: schoolId,
                data: { message: `Shule-Plus Code: ${password}.`, phone: user }
            }, ({ code }) => {
                res.send({
                    success: true,
                    otp: code
                })
            })
        }

        return res.send({
            success: true,
            otp: `0000 - for development`
        })
    })

router.post(
    "/login",
    validator.body(Joi.object({
        user: Joi.string().required(), // Can be email or phone
        password: Joi.string().required() // Password or OTP
    })),
    async (req, res) => {
        const { db } = req.app.locals; // Assuming config and password are in locals
        const { collections } = await db;
        const { user: userInput, password: providedPassword } = req.body;

        console.log(`Attempting to authenticate user: ${userInput}`);

        // --- 1. Super Admin Check ---
        if (userInput === 'sAdmin') {
            if (providedPassword === SUPER_ADMIN_PASSWORD) {
                console.log("Super Admin authentication successful.");
                const sAdminData = {
                    // Use a consistent ID structure if possible, otherwise use a known static value
                    id: 'sAdmin_001', // Or generate a consistent pseudo-ID
                    names: 'Super Admin',
                    email: 'sAdmin@shuleplus.co.ke', // Use the input or a default
                    phone: '00000',
                    userType: 'sAdmin',
                    // Add any other necessary fields expected in the token/response
                };
                const token = jwt.sign(sAdminData, config.secret, { expiresIn: '1d' }); // Add expiry
                return res.send({ token, data: sAdminData });
            } else {
                console.warn("Super Admin authentication failed: Incorrect password.");
                return res.status(401).send({ message: "Invalid credentials." });
            }
        }

        // --- 2. Find User Across Different Collections ---
        let userInfo = null;
        let userType = null;
        const isEmail = validateEmail(userInput);
        const identifierField = isEmail ? 'email' : 'phone';
        // For admin, also check 'username' if it's potentially an email
        const adminIdentifierField = isEmail ? 'email' : 'phone';

        // Define search order and collections
        const searchOrder = [
            // Admins might have username or phone
            { type: 'admin', collection: 'admin', field: adminIdentifierField },
            // Others typically use phone or email
            { type: 'teacher', collection: 'teacher', field: identifierField },
            { type: 'parent', collection: 'parent', field: identifierField },
            { type: 'driver', collection: 'driver', field: identifierField },
            // Add 'users' here if it's a fallback or primary source
            // { type: 'user', collection: 'users', field: identifierField },
        ];

        console.log(`Searching for user by ${identifierField}: ${userInput}`);

        for (const { type, collection, field } of searchOrder) {
            if (collections && !collections[collection]) {
                console.warn(`Collection "${collection}" not found, skipping search for type "${type}".`);
                continue;
            }
            console.log(`Checking collection: ${collection} using field: ${field}`);
            const query = { [field]: userInput, isDeleted: false };

            // Use findOne for efficiency
            const potentialUser = await collections[collection].findOne(query);

            if (potentialUser) {
                userInfo = potentialUser;
                userType = type;
                console.log(`User found in collection "${collection}" as type "${type}". ID: ${userInfo.id || userInfo._id}`);
                // If using the generic 'users' table, you might need to fetch role separately
                // if (type === 'user') {
                //     const userRoleInfo = await collections["user_role"]?.findOne({ user: userInfo.id, isDeleted: false });
                //     if (userRoleInfo) {
                //         userInfo.school = userRoleInfo.school; // Add school info
                //         userType = roles[userRoleInfo.role] || 'user'; // Get specific role name if mapped
                //         console.log(`User role info found: School=${userInfo.school}, Role=${userType}`);
                //     } else {
                //          console.warn(`User found in 'users' but no role found in 'user_role' for ID: ${userInfo.id}`);
                //          // Decide how to handle users without roles - reject or assign default?
                //          userInfo = null; // Reject if role is mandatory
                //          userType = null;
                //          continue; // Continue searching other collections
                //     }
                // }
                break; // Stop searching once a user is found
            }
        }

        // --- 3. Handle User Not Found ---
        if (!userInfo) {
            console.warn(`User not found for identifier: ${userInput}`);
            return res.status(401).send({ message: "Invalid credentials." }); // Generic message
        }

        // --- 4. Verify Password (Permanent or OTP) ---
        let isAuthenticated = false;
        const userId = userInfo.id || userInfo._id; // Get the user's actual ID (_id or id)

        // a) Check Permanent Password (if it exists)
        if (userInfo.password) {
            console.log(`Verifying permanent password for user ID: ${userId}`);
            try {
                if (await argon2.verify(userInfo.password, providedPassword)) {
                    console.log("Permanent password verified successfully.");
                    isAuthenticated = true;
                } else {
                    console.log("Permanent password verification failed.");
                }
            } catch (err) {
                // Argon2 verify throws if hash is invalid format or verification fails
                console.error(`Argon2 verification error for user ID ${userId}:`, err.message);
                // Log err.code if needed (e.g., 'ERR_ARGON2_INVALID_HASH')
                // Treat as failed verification, but log the error
            }
        } else {
            console.log(`User ID: ${userId} does not have a permanent password set. Checking OTP.`);
        }

        // b) Check OTP (if permanent password failed or doesn't exist)
        if (!isAuthenticated && collections.otp) { // Only check if not already authenticated and OTP collection exists
            console.log(`Checking OTP for user ID: ${userId} with OTP: ${providedPassword}`);
            const otpRecord = await collections.otp.findOne({
                user: userId.toString(), // Ensure ID is compared correctly (string vs ObjectId)
                password: providedPassword,
                used: false
                // Optional: Add expiry check: expiryTimestamp: { $gt: new Date() }
            });

            if (otpRecord) {
                console.log("Valid OTP found.");
                isAuthenticated = true;
                // Mark OTP as used
                try {
                    const updateResult = await collections.otp.updateOne(
                        { _id: otpRecord._id }, // Use OTP record's ID
                        { $set: { used: true, usedAt: new Date() } }
                    );
                    if (updateResult.modifiedCount === 1) {
                        console.log(`OTP record ${otpRecord._id} marked as used.`);
                    } else {
                        console.warn(`Failed to mark OTP record ${otpRecord._id} as used.`);
                        // Decide if login should still proceed or fail if OTP can't be marked used
                        // isAuthenticated = false; // Potentially revert authentication
                    }
                } catch (dbError) {
                    console.error(`Database error marking OTP ${otpRecord._id} as used:`, dbError);
                    // Decide if login should fail
                    // isAuthenticated = false;
                }
            } else {
                console.log("No valid, unused OTP found matching the provided password.");
            }
        } else if (!isAuthenticated) {
            console.log("OTP collection not configured or permanent password failed.");
        }

        // --- 5. Handle Authentication Failure ---
        if (!isAuthenticated) {
            console.warn(`Authentication failed for user ID: ${userId} (identifier: ${userInput})`);
            return res.status(401).send({ message: "Invalid credentials." }); // Generic message
        }

        // --- 6. Authentication Successful - Prepare Payload and Token ---
        console.log(`Authentication successful for user ID: ${userId}, type: ${userType}`);

        // Prepare consistent user data payload for the token and response
        const userData = {
            id: userId,
            userType: userType,
            names: userInfo.names || userInfo.name, // Handle different name fields
            email: userInfo.email,
            phone: userInfo.phone,
            school: userInfo.school, // Ensure school ID is present if needed
            // Add any other relevant, non-sensitive fields
            // username: userInfo.username, // Only if needed
        };

        // Remove sensitive data just in case (though we built userData selectively)
        // delete userData.password; // Password should not be in userInfo passed here anyway
        // delete userData.isDeleted;

        const token = jwt.sign(userData, config.secret, { expiresIn: '1d' }); // Use expiry

        console.log("JWT token generated successfully.");
        return res.send({ token, data: userData });

    }
);

export {
    checkToken,
    router
};

// const schoolId = "12345"
// const message = "1234"

// sms({ schoolId, data: { password: makeid(), phone: "+254711657108", message } }, async({
//     code,
//     messageID,
//     status,
//     smsCost,
//     smsCount
// }) => {
//     await collections["charges"].create({
//         id: new ObjectId().toHexString(),
//         school: schoolId,
//         ammount: smsCost,
//         userId: user,
//         reason: `sending message ${message}`,
//         time: new Date(),
//         isDeleted:false
//     })

//     // id: { type: "string", required: true },
//     // school: { type: "string", required: true },
//     // ammount: { type: "string", required: true },
//     // reason: { type: "string", required: true },
//     // time: { type: "string", required: true },
//     // isDeleted: { type: "boolean", defaultsTo: false }


//     console.log({
//         schoolId,
//         code,
//         messageID,
//         status,
//         smsCost,
//         smsCount
//     })
// })