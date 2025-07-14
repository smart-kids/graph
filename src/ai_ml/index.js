// --- EXISTING IMPORTS ---
require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";
import { ObjectId } from "mongodb";
import express from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import sms from "../utils/sms";

// --- INTEGRATION: IMPORTS FOR NEW FUNCTIONALITY ---
import multer from 'multer';
import fs from 'fs';
import path from 'path';
// Import the Google Generative AI package
import { GoogleGenerativeAI } from "@google/generative-ai";


const validator = require('express-joi-validation').createValidator({});

// --- ROBUST CONFIG SETUP ---
const config = {
    secret: process.env.ENCRYPTION_TOKEN || "a_default_secret_key_for_development",
    googleApiKey: process.env.GOOGLE_API_KEY, // Get the Google API Key from .env
};
if (!config.secret || config.secret === "a_default_secret_key_for_development") {
    console.warn("WARNING: ENCRYPTION_TOKEN is not set or is default. THIS IS NOT SAFE FOR PRODUCTION.");
}
if (!config.googleApiKey) {
    // This is a critical failure. The new feature cannot work without it.
    throw new Error("FATAL ERROR: GOOGLE_API_KEY is not set in the .env file. The image processing endpoint will not work.");
}

// --- GOOGLE AI SETUP ---
const genAI = new GoogleGenerativeAI(config.googleApiKey);


var router = express.Router();
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

// --- MULTER SETUP (Unchanged) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


// ==========================================================
// --- INTEGRATION: REPLACEMENT FOR OCR PARSER ---
// This new function communicates with the Google Gemini API.
// ==========================================================
/**
 * Uses Google's Gemini Pro Vision model to analyze an image of a curriculum
 * and return it in a structured JSON format.
 *
 * @param {string} imagePath - The local path to the uploaded image file.
 * @param {string} formName - The name of the grade/form (e.g., "Form 2").
 * @param {string} subjectName - The name of the subject (e.g., "Physics").
 * @returns {Promise<object>} A promise that resolves to the structured curriculum object.
 */
async function generateCurriculumWithGoogleAI(imagePath, formName = "Form 2", subjectName = "Physics") {
    // 1. Select the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // 2. Define the prompt. This is the MOST IMPORTANT part.
    // We give it a "few-shot" prompt, showing it exactly what we want.
    const prompt = `
        Analyze the following image, which contains a curriculum's table of contents.
        Extract all topics and their corresponding lessons.
        Return the result ONLY as a raw JSON object, without any markdown formatting or explanations.

        The JSON structure must be exactly as follows, using "${formName}" and "${subjectName}" as the top-level keys:
        {
          "${formName.toLowerCase().replace(/\s+/g, '')}": {
            "${subjectName.toLowerCase()}": [
              {
                "title": "The full title of the topic (e.g., '1. Magnetism')",
                "icon": "file-certificate", // Use a default icon
                "lessons": [
                  {
                    "id": "A generated unique ID for the lesson (e.g., 'f2p1l1')",
                    "title": "The full title of the lesson",
                    "duration": "The lesson's duration if visible (e.g., '~ 8 mins'), otherwise default to '~ 10 mins'",
                    "completed": false
                  }
                ]
              }
            ]
          }
        }

        Here is a small example of a valid output for a different subject:
        {
          "form1": {
            "chemistry": [
              {
                "title": "1. Introduction to Chemistry",
                "icon": "file-certificate",
                "lessons": [
                  { "id": "f1c1l1", "title": "What is Chemistry?", "duration": "~ 5 mins", "completed": false },
                  { "id": "f1c1l2", "title": "Lab Safety", "duration": "~ 12 mins", "completed": false }
                ]
              }
            ]
          }
        }

        Now, process the provided image and generate the JSON.
    `;

    // 3. Convert image to Base64 for the API request
    const imageParts = [
        {
            inlineData: {
                data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
                mimeType: "image/png" // Or "image/jpeg", etc. Should be dynamic if you allow other types.
            },
        },
    ];

    // 4. Make the API call
    console.log("Sending request to Google AI...");
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    let text = response.text();
    console.log("Received response from Google AI.");

    // 5. Clean and parse the response
    // The model sometimes wraps the JSON in markdown backticks (```json ... ```). We must remove them.
    text = text.replace(/^```json\s*/, '').replace(/```$/, '');

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON response from Google AI:", e);
        console.error("Raw response text was:", text);
        throw new Error("The AI model returned a response that was not valid JSON.");
    }
}


// The seeder function remains the same, as it's designed to accept the curriculumData object.
async function seedInitialDataForSchool(orm, schoolId, schoolDetails, curriculumData) {
    // This function is the same as the one in the previous answer.
    // For brevity, I am omitting the full body, but it should be here in your final file.
    console.log("Seeder function called with curriculum data for school:", schoolId);
    // ... your full seeder logic here ...
}

// ==========================================================
// --- THE MAIN ENDPOINT, NOW POWERED BY GOOGLE AI ---
// ==========================================================
router.post(
    '/schools/:schoolId/seed-from-image',
    upload.single('curriculumImage'),
    async (req, res) => {
        const { schoolId } = req.params;
        const { formName, subjectName } = req.body; // Allow overriding form/subject via form data

        if (!req.file) {
            return res.status(400).send({ error: "No image file uploaded. Please use the 'curriculumImage' field." });
        }

        const imagePath = req.file.path;
        console.log(`Received image for school ${schoolId}: ${imagePath}`);

        try {
            const orm = await req.app.locals.db;
            const { collections } = orm;

            const schoolDetails = await collections.school.findOne({ id: schoolId });
            if (!schoolDetails) {
                fs.unlinkSync(imagePath);
                return res.status(404).send({ error: `School with ID ${schoolId} not found.` });
            }

            // --- THIS IS THE NEW LOGIC ---
            // Call the Google AI function instead of Tesseract
            const curriculumData = await generateCurriculumWithGoogleAI(imagePath, formName, subjectName);
            // --- END OF NEW LOGIC ---

            // Clean up the uploaded file immediately
            fs.unlinkSync(imagePath);

            // Basic validation of the AI's response
            const formKey = (formName || "form2").toLowerCase().replace(/\s+/g, '');
            const subjectKey = (subjectName || "physics").toLowerCase();
            if (!curriculumData || !curriculumData[formKey] || !curriculumData[formKey][subjectKey]) {
                return res.status(400).send({
                    error: "Could not parse curriculum structure from the image. The AI did not return the expected JSON format.",
                    aiResponse: curriculumData // Send back the response for debugging
                });
            }
            console.log("AI parsing successful. Generated Structure:", JSON.stringify(curriculumData, null, 2));

            // Call the seeder with the AI-generated data
            await seedInitialDataForSchool(orm, schoolId, schoolDetails, curriculumData);

            res.status(200).send({
                message: `Successfully processed image with Google AI and seeded curriculum data for school ${schoolDetails.name}.`,
                seededTopicsCount: curriculumData[formKey][subjectKey].length
            });

        } catch (error) {
            console.error("An error occurred during the image seeding process:", error);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            res.status(500).send({ error: "An internal server error occurred.", details: error.message });
        }
    }
);

export {
    router
};