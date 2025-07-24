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

// Helper to simulate ObjectId if not available in the environment (e.g. browser mock)
// In a real Node.js environment with MongoDB driver, `new ObjectId()` is preferred.
const generateId = () => {
    if (typeof ObjectId !== 'undefined') {
        return new ObjectId().toHexString();
    }
    // Simple fallback for environments without ObjectId (less robust for uniqueness)
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};


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
            // FIX: remove this and add reauth flow here
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
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming driver has its own id matching users.id
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

            case 'teacher':
                dbCollectionName = 'teacher'; // Use the specific teacher collection
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming teacher has its own id
                if (!userRecord) throw new Error(`Teacher record not found in ${dbCollectionName} for ID: ${userId}`);
                if (!userRecord.school) {
                    console.error(`Teacher user ${userId} has no school assigned.`);
                    throw new Error("Teacher account configuration incomplete (missing school).");
                }
                payload = {
                    userId: userRecord.id,
                    userType: 'teacher',
                    schoolId: userRecord.school, // Include school ID
                };
                break; // Exit switch

            case 'student':
                dbCollectionName = 'student'; // Use the specific student collection
                userRecord = await collections[dbCollectionName].findOne({ where: { id: userId, isDeleted: false } }); // Assuming student has its own id
                if (!userRecord) throw new Error(`Student record not found in ${dbCollectionName} for ID: ${userId}`);
                if (!userRecord.school) {
                    console.error(`Student user ${userId} has no school assigned.`);
                    throw new Error("Student account configuration incomplete (missing school).");
                }
                payload = {
                    userId: userRecord.id,
                    userType: 'student',
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
        const db = await req.app.locals.db;
        const { collections } = db;
        const { user, password } = req.body;

        let specificUserRecord = null;
        let determinedUserType = null;

        try {

            await Promise.all([
                collections["admin"].findOne({ where: { phone: user, isDeleted: false } }),
                collections["driver"].findOne({ where: { phone: user, isDeleted: false } }),
                collections["parent"].findOne({ where: { phone: user, isDeleted: false } })
            ]).then(async ([adminUser, driverUser, parentUser]) => {
                specificUserRecord = adminUser || driverUser || parentUser;
                determinedUserType = adminUser ? 'admin' : driverUser ? 'driver' : parentUser ? 'parent' : null;
                console.log({ specificUserRecord })
                console.log({ determinedUserType })

                if (!specificUserRecord) {
                    console.log(`User not found for input: ${user}`);
                    throw { status: 401, message: 'Invalid credentials or user not found.' };
                }

                // --- 2. Verify OTP (This part was already correct) ---
                const otpData = (await collections["otp"].find({
                    where: {
                        user: specificUserRecord.id, // Use the ID from the found user record
                        password: password,
                        used: false
                    },
                    // sort: 'createdAt DESC', // More standard syntax for sorting
                    limit: 1
                }))[0];

                if (!otpData) {
                    console.log(`Invalid or used OTP for user: ${specificUserRecord.id}`);
                    return res.status(401).send({ message: "Invalid or expired OTP." });
                }

                console.log(`OTP verified successfully for user: ${specificUserRecord.id}`);

                // --- 3. Mark OTP as Used (Important!) ---
                await collections["otp"].update({ id: otpData.id }).set({ used: true });
                console.log(`OTP marked as used: ${otpData.id}`);

                // --- 4. Generate Structured Token ---
                if (!determinedUserType) {
                    console.log(`Attempting token generation for unknown user type: ${determinedUserType}`);
                    console.log(`Error fetching record for token generation (userId: ${specificUserRecord.id}, type: ${determinedUserType}):`);
                    throw new Error(`Failed to retrieve user details for ${determinedUserType}.`);
                }

                const { token, user: safeUserData } = await generateTokenForUser(specificUserRecord.id, determinedUserType, collections);

                // Add the determined UserType to the safe user data
                safeUserData.userType = determinedUserType;

                // --- 5. Send Response ---
                return res.send({ token, user: safeUserData });
            });

        } catch (error) {
            console.error("Error during SMS verification:", error);
            return res.status(500).send({ message: "An internal server error occurred." });
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

const MOCK_CURRICULUM_DATA = {
    "form2": {
        "physics": [
            {
                "title": "1. Magnetism",
                "icon": "magnet", // Example icon name
                "lessons": [
                    { "id": "f2p1l1", "title": "Properties of magnets", "duration": "~ 8 mins", "completed": false },
                    { "id": "f2p1l2", "title": "Direction of magnetic field", "duration": "~ 7 mins", "completed": false },
                    { "id": "f2p1l3", "title": "Magnetic field patterns", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p1l4", "title": "The Earth's magnetic field", "duration": "~ 8 mins", "completed": false },
                    { "id": "f2p1l5", "title": "Exercise 1.1", "duration": "~ 15 mins", "completed": false },
                    { "id": "f2p1l6", "title": "The Domain theory", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p1l7", "title": "Magnetisation of a magnetic material", "duration": "~ 12 mins", "completed": false },
                    { "id": "f2p1l8", "title": "Demagnetisation", "duration": "~ 8 mins", "completed": false },
                    { "id": "f2p1l9", "title": "Hard and soft magnetic materials", "duration": "~ 7 mins", "completed": false },
                    { "id": "f2p1l10", "title": "Application of magnets", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p1l11", "title": "Revision Exercise 1", "duration": "~ 20 mins", "completed": false }
                ]
            },
            {
                "title": "2. Measurement (II)",
                "icon": "ruler-square", // Example icon name
                "lessons": [
                    { "id": "f2p2l1", "title": "Engineer's callipers", "duration": "~ 5 mins", "completed": false }, // Assuming 'Engineer's callipers' is intended
                    { "id": "f2p2l2", "title": "Vernier callipers", "duration": "~ 15 mins", "completed": false },
                    { "id": "f2p2l3", "title": "Exercise 2.1", "duration": "~ 15 mins", "completed": false },
                    { "id": "f2p2l4", "title": "Exercise 2.2", "duration": "~ 15 mins", "completed": false },
                    { "id": "f2p2l5", "title": "Micrometer screw gauge", "duration": "~ 15 mins", "completed": false },
                    { "id": "f2p2l6", "title": "Significant figures", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p2l7", "title": "Standard form", "duration": "~ 8 mins", "completed": false },
                    { "id": "f2p2l8", "title": "Prefixes used with SI units", "duration": "~ 7 mins", "completed": false },
                    { "id": "f2p2l9", "title": "Decimal places", "duration": "~ 5 mins", "completed": false },
                    { "id": "f2p2l10", "title": "Revision Exercise 2", "duration": "~ 20 mins", "completed": false }
                ]
            },
            {
                "title": "3. Turning Effect of a Force",
                "icon": "rotate-3d-variant", // Example icon name
                "lessons": [
                    { "id": "f2p3l1", "title": "Moment of a force", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p3l2", "title": "The principle of moments", "duration": "~ 12 mins", "completed": false },
                    { "id": "f2p3l3", "title": "Moment due to weight of an object", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p3l4", "title": "Moments of parallel forces", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p3l5", "title": "Applications of Anti-parallel Forces", "duration": "~ 12 mins", "completed": false },
                    { "id": "f2p3l6", "title": "Revision Exercise 3", "duration": "~ 20 mins", "completed": false }
                ]
            },
            {
                "title": "4. Equilibrium and Centre of Gravity",
                "icon": "weight-lifter", // Example icon name (could also be scale-balance, axis-arrow)
                "lessons": [
                    { "id": "f2p4l1", "title": "Centre of gravity of regular shapes", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p4l2", "title": "Centre of gravity of irregular shapes", "duration": "~ 12 mins", "completed": false },
                    { "id": "f2p4l3", "title": "States of equilibrium", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p4l4", "title": "Applications of stability", "duration": "~ 10 mins", "completed": false },
                    { "id": "f2p4l5", "title": "Revision Exercise 4", "duration": "~ 20 mins", "completed": false }
                ]
            },
            {
                "title": "5. Reflection at Curved Surfaces",
                "icon": "mirror-rectangle", // Example icon name (could also be reflect-horizontal)
                "lessons": [
                    { "id": "f2p5l1", "title": "Types of curved surfaces", "duration": "~ 8 mins", "completed": false },
                    { "id": "f2p5l2", "title": "Reflection of light by curved mirrors", "duration": "~ 15 mins", "completed": false }
                    // Add more lessons if they exist beyond the visible part of the image
                ]
            }
            // Add other subjects for form2 if needed, following the same structure
        ]
    }
    // Add other forms (form1, form3, etc.) if needed
}


// --- Helper function for seeding ---
async function seedInitialDataForSchool(orm, schoolId, schoolDetails) {
    const { name: schoolName, email: schoolEmail, phone: schoolPhone } = schoolDetails;
    const collections = orm.collections;



    console.log(`Starting to seed data for schoolId: ${schoolId}`);

    try {
        // --- Standard School Setup (from your original seeder) ---
        // 1. Grades (We'll specifically create "Form 2" for e-learning later)
        const grade1Id = generateId(); // Example "Grade 1"
        // const grade2Id = generateId(); // Example "Grade 2"
        await collections.grade.create({ id: grade1Id, name: "Grade 1", school: schoolId });
        console.log("Created Grade 1");

        // 2. Terms
        const term1Id = generateId();
        await collections.term.create({ id: term1Id, name: "Term 1", school: schoolId });
        console.log("Created Term 1");

        await collections.school.updateOne({ id: schoolId }).set({
            inviteSmsText: `Welcome to ${schoolName} Shuleplus panel. Visit https://www.shuleplus.co.ke/${schoolName.toLowerCase().replace(/\s+/g, '-')} to join`
        });
        console.log("Updated School Details");

        // ... (Keep other non-e-learning entities: Teacher, Class, Route, Driver, Bus, Parents, Students, Schedule, Trip, Event, etc.)
        // For brevity, I'm omitting them here, but they should remain as in your original seeder.
        // Make sure to link them to `grade1Id` or other relevant IDs if needed.
        // For instance, the 'Class' created might be linked to 'grade1Id'.

        console.log("--- Seeding E-Learning Content based on MOCK_CURRICULUM_DATA ---");

        // --- E-Learning Content Seeding ---

        // A. Create "Form 2" Grade (if it doesn't match grade1Id or grade2Id already created for other purposes)
        const form2GradeName = "Form 2"; // From MOCK_CURRICULUM_DATA key "form2"
        let form2Grade = await collections.grade.findOne({ name: form2GradeName, school: schoolId });
        let form2GradeId;
        if (!form2Grade) {
            form2GradeId = generateId();
            await collections.grade.create({ id: form2GradeId, name: form2GradeName, school: schoolId });
            console.log(`Created Grade: ${form2GradeName}`);
        } else {
            form2GradeId = form2Grade.id;
            console.log(`Found existing Grade: ${form2GradeName}`);
        }

        // B. Create "Physics" Subject for "Form 2"
        const physicsSubjectName = "Physics"; // From MOCK_CURRICULUM_DATA key "physics"
        let physicsSubject = await collections.subject.findOne({ name: physicsSubjectName, grade: form2GradeId });
        let physicsSubjectId;
        const physicsSubjectTopicOrder = []; // To store topic IDs for order

        if (!physicsSubject) {
            physicsSubjectId = generateId();
            await collections.subject.create({
                id: physicsSubjectId,
                name: physicsSubjectName,
                grade: form2GradeId,
                school: schoolId,
                icon: "atom", // Default icon for Physics
                // topicOrder will be updated later
            });
            console.log(`Created Subject: ${physicsSubjectName} for ${form2GradeName}`);
        } else {
            physicsSubjectId = physicsSubject.id;
            console.log(`Found existing Subject: ${physicsSubjectName} for ${form2GradeName}`);
        }

        // C. Iterate through Topics in MOCK_CURRICULUM_DATA for Physics
        const mockPhysicsTopics = MOCK_CURRICULUM_DATA.form2.physics;

        for (const mockTopic of mockPhysicsTopics) {
            const dbTopicId = generateId();
            physicsSubjectTopicOrder.push(dbTopicId); // Add to order array
            const topicSubTopicOrder = []; // To store subtopic IDs for this topic

            await collections.topic.create({
                id: dbTopicId,
                name: mockTopic.title, // e.g., "1. Magnetism"
                subject: physicsSubjectId,
                school: schoolId, // Assuming topics are directly linked to school
                icon: mockTopic.icon, // From mock data
                // subTopicOrder will be updated later
            });
            console.log(`  Created Topic: ${mockTopic.title}`);

            // D. Iterate through Lessons (Subtopics) for the current Topic
            for (const mockLesson of mockTopic.lessons) {
                const dbSubtopicId = generateId();
                // IMPORTANT: The original `LessonScreen.js` might have used `mockLesson.id` (e.g., "f2p1l1")
                // to key into its internal `MOCK_LESSONS` object for question details.
                // If your `QuestionPlayerScreen` now receives the `questions` array directly via navigation params
                // (as the refactor suggested), then using a new `generateId()` for `dbSubtopicId` is fine.
                // The `questions` for this subtopic will be seeded below.

                topicSubTopicOrder.push(dbSubtopicId); // Add to order array for this topic

                await collections.subtopic.create({
                    id: dbSubtopicId,
                    name: mockLesson.title, // e.g., "Properties of magnets"
                    topic: dbTopicId,
                    school: schoolId, // Assuming subtopics are directly linked to school
                    duration: mockLesson.duration, // From mock data
                    // The `icon` for subtopic/lesson items is usually handled client-side based on type/status
                });
                console.log(`    Created Subtopic: ${mockLesson.title} (ID: ${dbSubtopicId})`);

                // E. Seed a Placeholder Question, Options, and Answer for each Subtopic
                // This ensures the DataService query `subtopics { questions { ... } }` returns data.
                const questionId = generateId();
                await collections.question.create({
                    id: questionId,
                    subtopic: dbSubtopicId, // Link to the subtopic created above
                    type: "SINGLECHOICE", // Default type
                    name: `What is the main concept of "${mockLesson.title}"?`, // Placeholder question
                    content: `This lesson, "${mockLesson.title}", covers fundamental principles. Select the best summary.`, // Placeholder content
                    response_type: "single_choice", // Matching original LessonScreen structure if needed
                    school: schoolId,
                });

                const option1Id = generateId();
                const option2Id = generateId(); // Assume this is the "correct" placeholder
                const option3Id = generateId();

                await collections.option.createEach([
                    { id: option1Id, value: "Placeholder Option A", question: questionId, school: schoolId },
                    { id: option2Id, value: "Placeholder Option B (Correct)", question: questionId, school: schoolId },
                    { id: option3Id, value: "Placeholder Option C", question: questionId, school: schoolId },
                ]);

                await collections.answer.create({
                    id: generateId(),
                    value: option2Id, // Link to the ID of the "correct" placeholder option
                    question: questionId,
                    school: schoolId,
                });
                // console.log(`      Created placeholder question for ${mockLesson.title}`);
            }
            // Update the current topic with its subTopicOrder
            await collections.topic.updateOne({ id: dbTopicId }).set({ subTopicOrder: topicSubTopicOrder });
            console.log(`    Updated Topic ${mockTopic.title} with subTopicOrder`);
        }
        // Update the Physics subject with its topicOrder
        // await collections.subject.updateOne({ id: physicsSubjectId }).set({ topicOrder: physicsSubjectTopicOrder });
        // console.log(`  Updated Subject ${physicsSubjectName} with topicOrder`);


        // --- Resume other standard seeding if any ---
        // e.g., Teams, Invitations, etc. from your original seeder.
        // 3. Teacher
        const teacher1Id = new ObjectId().toHexString();
        await collections.teacher.create({
            id: teacher1Id,
            name: "Mrs. Jane Doe",
            national_id: `TID${Math.floor(Math.random() * 100000)}`,
            school: schoolId,
            phone: `0700${Math.floor(100000 + Math.random() * 900000)}`, // Sample phone
            email: `teacher1.${schoolId.substring(0, 5)}@example.com`,
            gender: "FEMALE",
            password: "password123", // In a real app, hash this!
        });
        console.log("Created Teacher");

        // 4. Class
        const class1Id = new ObjectId().toHexString();
        await collections.class.create({
            id: class1Id,
            name: "Grade 1 Alpha",
            teacher: teacher1Id,
            school: schoolId,
            grade: grade1Id, // Link to one of the created grades
        });
        console.log("Created Class");

        // 5. Route
        const route1Id = new ObjectId().toHexString();
        await collections.route.create({
            id: route1Id,
            name: "Morning Route A",
            description: "Picks up students from Downtown area.",
            school: schoolId,
        });
        console.log("Created Route");

        // 6. Driver
        const driver1Id = new ObjectId().toHexString();
        const userId = new ObjectId().toHexString();
        await collections.driver.create({
            id: driver1Id,
            userId,
            names: "John Ryder",
            email: `driver1.${schoolId.substring(0, 5)}@example.com`,
            phone: `0701${Math.floor(100000 + Math.random() * 900000)}`,
            school: schoolId,
            license_expiry: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString(),
            licence_number: `DL${Math.floor(Math.random() * 100000)}`,
            experience: "5",
            home: "Uptown, City",
        });
        console.log("Created Driver");

        // 7. Bus
        const bus1Id = new ObjectId().toHexString();
        await collections.bus.create({
            id: bus1Id,
            make: "Toyota",
            plate: `KDX ${Math.floor(100 + Math.random() * 900)}X`,
            size: 30,
            school: schoolId,
            driver: driver1Id,
        });
        console.log("Created Bus");

        // 8. Parents
        const parent1Id = new ObjectId().toHexString();
        const parent2Id = new ObjectId().toHexString();
        await collections.parent.createEach([
            {
                id: parent1Id,
                name: "Mr. Parent One",
                national_id: `PID${Math.floor(Math.random() * 100000)}`,
                phone: schoolPhone, // Use school's phone for one parent for easy testing
                password: "password123",
                school: schoolId,
                email: `parent1.${schoolId.substring(0, 5)}@example.com`,
                gender: "MALE",
            },
            {
                id: parent2Id,
                name: "Ms. Parent Two",
                national_id: `PID${Math.floor(Math.random() * 100000)}`,
                phone: `0702${Math.floor(100000 + Math.random() * 900000)}`,
                password: "password123",
                school: schoolId,
                email: `parent2.${schoolId.substring(0, 5)}@example.com`,
                gender: "FEMALE",
            },
        ]);
        console.log("Created Parents");

        // 9. Students
        const studentNames = ["Alice Wonderland", "Bob The Builder", "Charlie Brown"];
        const studentIds = studentNames.map(() => new ObjectId().toHexString());
        const studentData = studentNames.map((name, index) => ({
            id: studentIds[index],
            names: name,
            route: route1Id,
            gender: index % 2 === 0 ? "FEMALE" : "MALE",
            registration: `REG${Math.floor(1000 + Math.random() * 9000)}`,
            school: schoolId,
            parent: parent1Id, // Assign one parent
            parent2: parent2Id, // Assign another parent
            class: class1Id,
            grade: grade1Id,
        }));
        await collections.student.createEach(studentData);
        console.log("Created Students");

        // 10. Schedule
        const schedule1Id = new ObjectId().toHexString();
        const scheduleStartTime = new Date();
        scheduleStartTime.setHours(7, 0, 0, 0); // 7:00 AM
        const scheduleEndTime = new Date(scheduleStartTime.getTime() + 30 * 60000); // 7:30 AM
        await collections.schedule.create({
            id: schedule1Id,
            name: "Weekday Morning Pickup",
            message: `Hello {{parent_name}}, our {{school_name}} bus has confirmed {{student_name}} is on board for the morning trip.`,
            time: scheduleStartTime.toISOString(),
            end_time: scheduleEndTime.toISOString(),
            school: schoolId,
            route: route1Id,
            days: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY", // Comma-separated or array if model supports
            type: "PICK",
            bus: bus1Id,
        });
        console.log("Created Schedule");

        // 11. Trip
        const trip1Id = new ObjectId().toHexString();
        const tripStartTime = new Date(); // Now
        await collections.trip.create({
            id: trip1Id,
            startedAt: tripStartTime.toISOString(),
            // completedAt: can be null for an ongoing trip
            schedule: schedule1Id,
            driver: driver1Id,
            school: schoolId,
            bus: bus1Id,
        });
        console.log("Created Trip");

        // 12. Event (e.g., student checked in)
        const event1Id = new ObjectId().toHexString();
        await collections.event.create({
            id: event1Id,
            student: studentIds[0], // First sample student
            time: new Date().toISOString(),
            type: "CHECKEDIN",
            school: schoolId,
            trip: trip1Id,
        });
        console.log("Created Event");

        // 13. LocReport
        await collections.locreport.create({
            id: new ObjectId().toHexString(),
            trip: trip1Id,
            time: new Date().toISOString(),
            loc: JSON.stringify({ type: "Point", coordinates: [-1.286389, 36.817223] }), // Nairobi coordinates
        });
        console.log("Created LocReport");

        // 14. Complaint
        await collections.complaint.create({
            id: new ObjectId().toHexString(),
            parent: parent1Id,
            time: new Date().toISOString(),
            school: schoolId,
            content: "The bus was 5 minutes late this morning.",
            status: "PENDING",
            isDeleted: false
        });
        console.log("Created Complaint");

        // 15. Payment
        await collections.payment.create({
            id: new ObjectId().toHexString(),
            school: schoolId,
            ammount: "5000", // Represent as string if your model expects it
            type: "MPESA",
            phone: schoolPhone,
            ref: `PAY${Math.floor(Math.random() * 1000000)}`,
            time: new Date().toISOString(),
        });
        console.log("Created Payment");

        // 16. Charge
        await collections.charge.create({
            id: new ObjectId().toHexString(),
            school: schoolId,
            ammount: "15", // Represent as string
            reason: "SMS notification fee for welcome message.",
            time: new Date().toISOString(),
        });
        console.log("Created Charge");

        // 17. E-learning: Subject -> Topic -> Subtopic -> Question -> Options & Answer
        const subject1Id = new ObjectId().toHexString();
        await collections.subject.create({
            id: subject1Id,
            name: "Basic Mathematics",
            grade: grade1Id, // Linked to Grade 1
            school: schoolId, // Assuming subject is also school-specific
            // topicOrder: ["Addition", "Subtraction"]
        });

        const topic1Id = new ObjectId().toHexString();
        await collections.topic.create({
            id: topic1Id,
            name: "Addition",
            subject: subject1Id,
            // school: schoolId, // If topics are directly linked to school
            subTopicOrder: ["Single Digit Addition"]
        });

        const subtopic1Id = new ObjectId().toHexString();
        await collections.subtopic.create({
            id: subtopic1Id,
            name: "Single Digit Addition",
            topic: topic1Id,
            // school: schoolId, // If subtopics are directly linked to school
        });

        const question1Id = new ObjectId().toHexString();
        await collections.question.create({
            id: question1Id,
            subtopic: subtopic1Id,
            type: "SINGLECHOICE",
            name: "What is 2 + 2?",
            // school: schoolId, // If questions are directly linked to school
        });

        const option1Id = new ObjectId().toHexString();
        const option2Id = new ObjectId().toHexString();
        const option3Id = new ObjectId().toHexString();
        await collections.option.createEach([
            { id: option1Id, value: "3", question: question1Id },
            { id: option2Id, value: "4", question: question1Id }, // Correct answer
            { id: option3Id, value: "5", question: question1Id },
        ]);

        await collections.answer.create({
            id: new ObjectId().toHexString(),
            value: option2Id, // ID of the correct option
            question: question1Id,
        });
        console.log("Created E-learning entities");

        // 18. Teams
        const team1Id = new ObjectId().toHexString();
        await collections.team.create({
            id: team1Id,
            school: schoolId,
            name: "Grade 1 Teaching Team"
        });
        console.log("Created Team");

        // 19. Team Members (Assuming Admin is a user, link them)
        // First, ensure an admin user exists in the 'user' collection or create one.
        // For simplicity, let's assume the admin created during registration is usable here.
        // If not, you might need to create a generic 'user' record for the admin.
        // Let's assume adminId from school registration is a user ID.
        // The `admin` created earlier is in the `admin` collection. We need a generic `user` representation.
        // For now, let's link the teacher created earlier.
        await collections.team_member.create({
            id: new ObjectId().toHexString(),
            team: team1Id,
            user: teacher1Id, // Link the teacher to the team
        });
        console.log("Created Team Member");

        // 20. Invitations
        await collections.invitation.create({
            id: new ObjectId().toHexString(),
            user: teacher1Id, // Who is being invited (or who sent it if used differently)
            school: schoolId,
            message: `You're invited to join ${schoolName} on ShulePlus!`,
            phone: `0703${Math.floor(100000 + Math.random() * 900000)}`,
            email: `invited.user.${schoolId.substring(0, 5)}@example.com`,
            status: "PENDING"
        });
        console.log("Created Invitation");


        console.log(`Successfully seeded initial data for school: ${schoolName} (ID: ${schoolId})`);

        console.log(`--- Finished E-Learning Content Seeding ---`);
        console.log(`Successfully seeded initial data for school: ${schoolName} (ID: ${schoolId})`);

    } catch (error) {
        console.error(`Error seeding data for schoolId ${schoolId}:`, error);
        // throw error; // Optional: re-throw to halt further operations if seeding is critical
    }
}


// --- Your Router ---
// Assuming router is already defined (e.g., const router = express.Router();)

router.post(
    "/register",
    validator.body(Joi.object({ // Ensure Joi and validator are imported/defined
        name: Joi.string().required(),
        phone: Joi.string(),
        email: Joi.string().email(), // Added email validation
        address: Joi.string(),
        password: Joi.string()
    })),
    async (req, res) => {
        const orm = await req.app.locals.db; // Get the ORM instance
        console.log("ORM:", orm);
        if (!orm) {
            console.error("ORM not found in app.locals");
            return res.status(500).send({ error: "Server configuration error: ORM not available." });
        }
        const { collections } = orm; // Use ORM collections
        const { name, phone, email, address, password: adminPassword } = req.body;

        try {
            // create a school object
            const schoolId = new ObjectId().toHexString();
            const schoolRecord = await collections.school.create({ // Use Waterline create
                id: schoolId,
                name,
                phone,
                email,
                address
                // gradeOrder and termOrder will be updated by seeder
            }).fetch(); // .fetch() returns the created record
            console.log("School created:", schoolRecord.id);

            // create a user who is the admin with the phone number
            const adminId = new ObjectId().toHexString();
            // NOTE: Your admin model might need `password`. If so, generate/hash one.
            // Also, `username` is set to email. Ensure this is unique if your DB enforces it.

            // Consider if your 'admin' model should also be a 'user' model for team membership
            // For now, creating admin as per original logic
            await collections.admin.create({
                id: adminId,
                username: email, // Potentially use a generated unique username
                names: name, // Or "Admin for [School Name]"
                email,
                phone,
                school: schoolId,
                password: adminPassword, // Add if your admin model has a password
            }).fetch();
            console.log("Admin created:", adminId);

            // TODO: Create a corresponding record in `users` collection if admins are also generic users
            // This is important for things like Team Members if 'user' is a generic foreign key
            // const genericUserIdForAdmin = new ObjectId().toHexString();
            // await collections.user.create({
            //     id: genericUserIdForAdmin,
            //     name: name, // Or "Admin for [School Name]"
            //     email: email,
            //     phone: phone,
            //     password: adminPassword, // HASHED
            //     // any other fields your user model needs
            // }).fetch();
            // await collections.user_role.create({ // Assign 'admin' role
            //     id: new ObjectId().toHexString(),
            //     user: genericUserIdForAdmin,
            //     role: 'admin_role_id' // ID of your 'admin' role in the 'roles' table
            // }).fetch();


            // Call the seeding function - DO NOT await if you want to send response faster
            // but it's safer to await to ensure data is there or errors are caught.
            // For robustness, let's await.
            await seedInitialDataForSchool(orm, schoolId, { name, email, phone });
            console.log("Initial data seeding initiated/completed for school:", schoolId);

            // send an sms with welcome and link to download the app
            // Ensure `sms` function is defined and works
            if (typeof sms === "function") {
                sms({
                    school: schoolId,
                    data: { message: `Thank you for registering ${name} to Shule Plus. Shule Plus is an efficient, reliable and secure communication platform for schools to communicate with parents about the safety of their children. Please login to our app to start enjoying our services. For support please contact us on email: support@shuleplus.co.ke phone: +254743214479 :start here shuleplus.co.ke`, phone }
                }, (err, result) => {
                    if (err) console.error("Error sending welcome SMS:", err);
                    else console.log("Welcome SMS sent:", result);
                });

                // Sample message SMS (consider if this should always be sent on registration)
                sms({
                    school: schoolId,
                    data: {
                        message: `This is a sample message\n\nHello {{parent_name}}, \n\nOur {{school_name}} bus has confirmed that it just dropped {{student_name}} at their usual pickup location. \n\nWe would like to thank you for your continued commitment to time and safety.`, phone
                    }
                }, (err, result) => {
                    if (err) console.error("Error sending sample SMS:", err);
                    else console.log("Sample SMS sent:", result);
                });

                // Notification SMS to your support number
                sms({
                    school: schoolId, // Context for logging/charging
                    data: {
                        message: `A new school has been registered: name - ${name}, email - ${email}, phone - ${phone}`,
                        phone: "+254743214479" // Hardcoded support number
                    }
                }, (err, result) => {
                    if (err) console.error("Error sending notification SMS:", err);
                    else console.log("Notification SMS sent:", result);
                });
            } else {
                console.warn("SMS function is not defined. Skipping SMS notifications.");
            }


            const tokenData = {
                admin: { // Or more generic: user: { id: adminId, school: schoolId, role: 'admin' }
                    school: schoolId,
                    user: email, // or adminId
                    id: adminId // include the admin's actual ID
                }
            };

            var token = jwt.sign(tokenData, config.secret, { expiresIn: '24h' }); // Add expiry

            //TODO send an email with the welcome page, app and admin login

            return res.send({
                token,
                data: tokenData // Send back the payload that was used for the token
            });

        } catch (error) {
            console.error("Error during school registration:", error);
            // Check for unique constraint violations (e.g., email already exists)
            if (error.code === 'E_UNIQUE') { // Waterline unique constraint error
                return res.status(409).send({ error: "Registration failed: A user with this email or phone may already exist." });
            }
            return res.status(500).send({ error: "An unexpected error occurred during registration." });
        }
    }
);

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

router.get(
    "/meta",
    async (req, res) => {
        console.log("finding school")
        const db = await req.app.locals.db
        const schoolId = req.query.schoolId
        if (!schoolId) {
            return res.status(400).send({ error: 'schoolId is required' })
        }

        console.log({ schoolId })
        try {
            const school = await db.collections.school.findOne({ id: schoolId })
            if (!school) {
                console.error("School not found:", schoolId);
                return res.status(404).send({ error: 'School not found' })
            }
            const { name, logo, themeColor } = school
            return res.send({ name, logo, themeColor })
        } catch (error) {
            console.error("Error fetching school:", error);
            return res.status(500).send({ error: "An unexpected error occurred during fetching school." });
        }
    }
);

router.get(
    "/classes",
    async (req, res) => {
        const db = await req.app.locals.db
        const { collections } = db
        const { schoolid } = req.query

        if (!schoolid) {
            return res.status(400).send({ error: 'schoolid is required' })
        }

        try {
            const classes = await collections.class.find({ school: schoolid, isDeleted: false }).sort({ name: 1 });
            return res.send(classes);
        } catch (error) {
            console.error("Error fetching classes:", error);
            return res.status(500).send({ error: "An unexpected error occurred during fetching classes." });
        }
    }
);

// In your router file (e.g., routes/auth.js)

router.post(
    "/register/student",
    validator.body(Joi.object({
        school: Joi.string().required(),
        parent: Joi.object({
            name: Joi.string().required(),
            phone: Joi.string(), //.required().pattern(/^[0-9]{10,15}$/),
            email: Joi.string().email().required(),
            national_id: Joi.string().default('-'),
            gender: Joi.string().default('UNKOWN'),
            registration: Joi.string().default('-'),
        }).required(),
        student: Joi.object({
            name: Joi.string().required(),
            class: Joi.string().required(), // This will be the class ID
            route: Joi.string().required(),
            gender: Joi.string().default('UNKOWN'),
            registration: Joi.string().default('-'),
        }).required()
    })),
    async (req, res) => {
        const db = await req.app.locals.db;
        const { collections } = db;
        const { school, parent, student } = req.body;

        try {
            // Check if a parent with this phone or email already exists for this school
            // const existingParent = await collections.parent.findOne({
            //     or: [{ phone: parent.phone }, { email: parent.email }],
            //     school: school
            // });

            // console.log(existingParent)

            // if (existingParent) {
            //     return res.status(409).send({ error: "A parent with this phone number or email already exists for this school." });
            // }

            // Generate a unique parent ID
            const parentid = await generateId();

            // Create the parent user
            const parentData = { ...parent, id: parentid, school };
            const result = await collections.parent.create(parentData);

            // Generate a unique student ID
            const studentid = await generateId();

            // Create the student and link them to the newly created parent
            const studentData = {
                ...student,
                id: studentid,
                school,
                names: student.name,
                parent: parentid // Link using the parent's ID
            };
            const result2 = await collections.student.create(studentData);

            // The "user" who logs in is the Parent.
            // We'll create a user object for the token that includes their role.
            const user = { ...Object.assign(parentData, { parentid }), role: 'parent' };
            const token = jwt.sign(user, config.secret);


            // generate OTP, send it and save it
            const password = ['development', "test"].includes(NODE_ENV) ? '0000' : makeid()

            const otpSaveInfo = await collections["otp"].create({
                id: new ObjectId().toHexString(),
                user: parentid,
                password
            })

            // send sms to phone
            if (!['development', "test"].includes(NODE_ENV)) {
                // send welcome message first
                sms({
                    // school: schoolId,
                    data: {
                        message: `Welcome to Shule-Plus! We're glad you're here. Your child, ${student.name}, has been registered to class ${student.class}.`,
                        phone: parentData.phone
                    }
                }, () => {
                    // send OTP code
                    sms({
                        // school: schoolId,
                        data: { message: `Shule-Plus Code: ${password}.`, phone: parentData.phone }
                    }, ({ code }) => {
                        console.log("OTP sent successfully.");
                    })
                })
            }

            // Send back the token and the parent's user object.
            return res.send({ user, token });

        } catch (error) {
            console.error("Error during student registration:", error);
            // Check for waterline validation errors specifically if possible
            if (error.name === 'AdapterError') {
                return res.status(400).send({ error: "Invalid data provided. Please check your input." });
            }
            return res.status(500).send({ error: "An unexpected error occurred during registration." });
        }
    }
);



router.post(
    "/otp/send",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string()
    })),
    async (req, res) => {
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
                // Check Parent Collection
                [specificUserRecord] = await collections["parent"].find(userSearchingObject);
                if (specificUserRecord) {
                    determinedUserType = 'parent';
                    console.log(`User type determined: parent (phone: ${user}, id: ${specificUserRecord.id})`);
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
            { type: 'student', collection: 'student', field: identifierField },
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