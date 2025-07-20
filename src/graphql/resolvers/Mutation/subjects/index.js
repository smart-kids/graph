import { ObjectId } from "mongodb";
const { name } = require("./about.js"); // Assuming 'name' refers to the subject collection
const { UserError } = require("graphql-errors");
const fs = require("fs"); // Not directly used in this version, but kept for context
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Google AI Configuration ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// --- Helper function for generating curriculum with Google AI ---
async function generateCurriculumWithGoogleAI(imagesDataUrl, formName, subjectName) {
    if (!imagesDataUrl || imagesDataUrl.length === 0) {
        console.warn("No images provided for AI curriculum generation. Skipping AI step.");
        return null;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
        Analyze the following images, which contain a curriculum's table of contents for a specific grade and subject.
        Your task is to extract topics and lessons, and for each lesson, generate a single multiple-choice question suitable for a ${formName} student.

        For each topic, extract its title and suggest a 'suitable icon' name (e.g., 'magnet', 'ruler-square').
        For each lesson (which will become a 'subtopic'), extract its title and duration if visible (e.g., '~ 8 mins').
        For each lesson, generate ONE multiple-choice question with:
          - A clear question text (for the "name" field).
          - A brief explanation or context if needed (for the "content" field).
          - Approximately 3 options.
          - Exactly ONE correct option.
        Ensure the language and complexity of the questions are appropriate for a ${formName} student.

        Return the result ONLY as a raw JSON object, without any markdown formatting or explanations.

        The JSON structure must be exactly as follows, using the provided "${formName}" and "${subjectName}" (converted to lowercase and spaces removed for keys) as the top-level keys:
        {
          "${formName.toLowerCase().replace(/\s+/g, '')}": {
            "${subjectName.toLowerCase()}": [
              {
                "title": "The full title of the topic (e.g., '1. Magnetism')",
                "icon": "A descriptive icon name, e.g., 'magnet' or 'file-certificate' if not inferrable",
                "lessons": [
                  {
                    "id": "A generated unique ID for the lesson (e.g., 'f2p1l1' - you can use a simple counter or specific pattern)",
                    "title": "The full title of the lesson",
                    "duration": "The lesson's duration if visible (e.g., '~ 8 mins'), otherwise default to '~ 10 mins'",
                    "question": {
                      "name": "The question text (e.g., 'What is a property of magnets?')",
                      "content": "Brief context or explanation.",
                      "options": [
                        { "id": "...", "value": "Option A text", "correct": false },
                        { "id": "...", "value": "Option B text", "correct": true },
                        { "id": "...", "value": "Option C text", "correct": false }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }

        Example for a different subject:
        {
          "form1": {
            "chemistry": [
              {
                "title": "1. Introduction to Chemistry",
                "icon": "atom",
                "lessons": [
                  {
                    "id": "f1c1l1",
                    "title": "What is Chemistry?",
                    "duration": "~ 5 mins",
                    "question": {
                      "name": "What does chemistry primarily study?",
                      "content": "Chemistry is the scientific discipline involved in understanding the properties, composition, structure, and reactions of matter.",
                      "options": [
                        { "id": "...", "value": "The movement of planets", "correct": false },
                        { "id": "...", "value": "The properties of matter", "correct": true },
                        { "id": "...", "value": "The behavior of light", "correct": false }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }

        Now, process the provided images and generate the JSON with topics, lessons, and questions.
        If you cannot clearly infer an icon, use 'file-certificate'.
        If a lesson's duration is not visible, use '~ 10 mins'.
        If a question or option cannot be generated for a lesson, omit the 'question' field or leave 'lessons' empty for that topic.
    `;

    const imageParts = imagesDataUrl.map(dataUrl => {
        if (!dataUrl || !dataUrl.includes(';base64,')) {
            console.warn("Skipping invalid or incomplete dataUrl:", dataUrl);
            return null;
        }
        const base64Image = dataUrl.split(';base64,').pop();
        const mimeType = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));
        return {
            inlineData: {
                data: base64Image,
                mimeType: mimeType || "image/png"
            },
        };
    }).filter(part => part !== null);

    if (imageParts.length === 0) {
        console.warn("No valid images to send to AI after processing.");
        return null;
    }

    console.log(`Sending request to Google AI for curriculum generation for ${formName} - ${subjectName}...`);
    let responseText;
    try {
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        responseText = response.text();
        console.log("Received response from Google AI.");

        responseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '');

        const parsedJson = JSON.parse(responseText);
        const expectedFormKey = formName.toLowerCase().replace(/\s+/g, '');
        const expectedSubjectKey = subjectName.toLowerCase();

        if (!parsedJson[expectedFormKey] || !parsedJson[expectedFormKey][expectedSubjectKey]) {
            throw new Error(`AI response structure is not as expected. Missing keys: ${expectedFormKey} or ${expectedSubjectKey}`);
        }

        return parsedJson;

    } catch (e) {
        console.error("Failed to process AI response or parse JSON:", e);
        console.error("Raw response text was:", responseText);
        throw new Error(`AI curriculum generation failed: ${e.message}`);
    }
}


// --- Modified create function ---
const create = async (data, { db: { collections } }) => {
    // Access collections via Waterline ORM instance
    const subjectCollection = collections[name];
    const gradeCollection = collections.grade;
    const topicCollection = collections.topic;
    const subtopicCollection = collections.subtopic;
    const questionCollection = collections.question;
    const optionCollection = collections.option;
    const answerCollection = collections.answer;

    const generateId = () => new ObjectId().toHexString(); // Assuming string IDs are used

    const subjectId = generateId();

    const subjectInputData = data[name]; // Store this for easier access
    if (!subjectInputData) {
        throw new UserError(`No subject data provided in the input.`);
    }

    const topicalImages = subjectInputData.topicalImages || [];
    const subjectName = subjectInputData.name;
    const gradeId = subjectInputData.grade;

    let gradeEntry;
    try {
        gradeEntry = await gradeCollection.findOne({ id: gradeId });
        if (!gradeEntry) {
            throw new UserError(`Grade with ID ${gradeId} not found.`);
        }
    } catch (err) {
        console.error("Error fetching grade for AI prompt:", err);
        throw new UserError(`Could not retrieve grade information: ${err.message}`);
    }
    const actualGradeName = gradeEntry.name;

    let aiGeneratedCurriculum = null;
    let createdTopicIds = [];
    let createdSubtopicIds = [];

    // --- Step 1: Attempt AI Curriculum Generation ---
    if (topicalImages.length > 0) {
        try {
            aiGeneratedCurriculum = await generateCurriculumWithGoogleAI(
                topicalImages.map(img => img.dataUrl),
                actualGradeName,
                subjectName
            );
        } catch (aiError) {
            console.error("AI curriculum generation failed:", aiError);
            console.warn("AI curriculum generation failed. Proceeding without AI content.");
            // The error thrown by generateCurriculumWithGoogleAI will be caught by the outer catch block.
        }
    } else {
        console.log("No topical images provided for AI generation.");
    }

    // --- Step 2: Create Subject, Topics, and Subtopics ---
    let finalSubjectEntry;
    const gradeKeyForAI = actualGradeName.toLowerCase().replace(/\s+/g, '');
    const subjectKeyForAI = subjectName.toLowerCase();

    try {
        finalSubjectEntry = {
            id: subjectId,
            name: subjectName,
            grade: gradeId,
            teacher: subjectInputData.teacher,
            school: subjectInputData.school,
            topicalImages: undefined,
            topicsOrder: [],
        };

        if (aiGeneratedCurriculum && aiGeneratedCurriculum[gradeKeyForAI] && aiGeneratedCurriculum[gradeKeyForAI][subjectKeyForAI]) {
            const curriculumForSubject = aiGeneratedCurriculum[gradeKeyForAI][subjectKeyForAI];

            for (const aiTopic of curriculumForSubject) {
                const topicId = generateId();
                createdTopicIds.push(topicId);

                await topicCollection.create({
                    id: topicId,
                    name: aiTopic.title,
                    subject: subjectId,
                    grade: gradeId,
                    icon: aiTopic.icon || "file-certificate",
                    school: subjectInputData.school,
                    subTopicOrder: [],
                }).meta({ fetch: true }); // Added .meta({ fetch: true }) as per Waterline docs for `create` to return the created record

                console.log(`Created AI-generated Topic: "${aiTopic.title}" (ID: ${topicId})`);

                let currentTopicSubtopicOrder = [];
                if (aiTopic.lessons && aiTopic.lessons.length > 0) {
                    for (const aiLesson of aiTopic.lessons) {
                        const subtopicId = generateId();
                        currentTopicSubtopicOrder.push(subtopicId);

                        await subtopicCollection.create({
                            id: subtopicId,
                            name: aiLesson.title,
                            topic: topicId,
                            duration: aiLesson.duration || "~ 10 mins",
                        }).meta({ fetch: true });
                        console.log(`  Created AI-generated Subtopic: "${aiLesson.title}" (ID: ${subtopicId})`);
                        createdSubtopicIds.push(subtopicId);

                        if (aiLesson.question) {
                            try {
                                const questionId = generateId();
                                const questionOptionsDb = [];
                                const questionAnswersDb = [];

                                aiLesson.question.options.forEach(aiOption => {
                                    const optionId = generateId();
                                    questionOptionsDb.push({
                                        id: optionId,
                                        value: aiOption.value,
                                        question: questionId,
                                        school: subjectInputData.school,
                                    });
                                    if (aiOption.correct) {
                                        questionAnswersDb.push({
                                            id: generateId(),
                                            value: optionId,
                                            question: questionId,
                                        });
                                    }
                                });

                                await questionCollection.create({
                                    id: questionId,
                                    subtopic: subtopicId,
                                    type: "SINGLECHOICE",
                                    name: aiLesson.question.name,
                                    content: aiLesson.question.content,
                                    response_type: "single_choice",
                                    school: subjectInputData.school,
                                }).meta({ fetch: true });

                                if (questionOptionsDb.length > 0) {
                                    await optionCollection.createEach(questionOptionsDb);
                                }
                                if (questionAnswersDb.length > 0) {
                                    await answerCollection.createEach(questionAnswersDb);
                                }

                                console.log(`    Created AI-generated question for "${aiLesson.title}"`);

                            } catch (questionError) {
                                console.error(`Error creating AI-generated question for subtopic "${aiLesson.title}":`, questionError);
                            }
                        } else {
                            console.warn(`  AI did not generate a question for lesson "${aiLesson.title}". Skipping question creation.`);
                        }
                    }
                }
                await topicCollection.update({ id: topicId }).set({ subTopicOrder: currentTopicSubtopicOrder });
            }
            finalSubjectEntry.topicsOrder = createdTopicIds;
        } else {
            if (subjectInputData.topicsOrder && subjectInputData.topicsOrder.length > 0) {
                finalSubjectEntry.topicsOrder = subjectInputData.topicsOrder;
            } else {
                finalSubjectEntry.topicsOrder = [];
            }
            console.log("No valid AI-generated topics. Using provided subject data.");
        }

        // --- Step 4: Create the Main Subject Entry ---
        await subjectCollection.create(finalSubjectEntry);
        console.log(`Created main Subject: "${subjectName}" (ID: ${subjectId}) for Grade ID: ${gradeId}`);

        // --- Step 5: Return Created Subject and its Related Entities ---
        // Waterline query syntax with
        const createdTopics = await topicCollection.find({ subject: subjectId });
        for (const topic of createdTopics) {
            const subtopics = await subtopicCollection.find({ topic: topic.id });
            topic.subtopics = subtopics;

            for (const subtopic of subtopics) {
                const questions = await questionCollection.find({ subtopic: subtopic.id });
                for (const question of questions) {
                    const options = await optionCollection.find({ question: question.id });
                    question.options = options;

                    const answers = await answerCollection.find({ question: question.id });
                    question.answers = answers;
                }
                subtopic.questions = questions;
            }
        }

        return {
            ...finalSubjectEntry,
            topics: createdTopics,
        };

    } catch (err) {
        console.error("Error during subject creation process:", err);
        // --- Error Handling and Cleanup ---
        try {
            // Use Waterline's destroy or remove methods. Assuming destroy is available.
            if (createdTopicIds.length > 0) {
                await topicCollection.destroy({ id: createdTopicIds });
                console.log(`Cleaned up ${createdTopicIds.length} topics.`);
            }
            if (createdSubtopicIds.length > 0) {
                await subtopicCollection.destroy({ id: createdSubtopicIds });
                console.log(`Cleaned up ${createdSubtopicIds.length} subtopics.`);
            }
            // Add cleanup for questions, options, answers if they might have been created
            // and the main subject creation failed. This can be complex.

        } catch (cleanupError) {
            console.error("Error during cleanup after creation failure:", cleanupError);
        }

        throw new UserError(`Failed to create subject and its curriculum: ${err.message}`);
    }
};


// --- Existing update, archive, restore functions (adapted for Waterline) ---
const update = async (data, { db: { collections } }) => {
  const subjectCollection = collections[name];
  const { id } = data[name];
  const entry = data[name];
  let { topicOrder } = entry;
  entry.topicOrder = topicOrder ? topicOrder.join(",") : "";

  try {
    delete entry.id;
    await subjectCollection.update({ id }).set(entry);

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.message || "Failed to update subject.");
  }
};

const archive = async (data, { db: { collections } }) => {
  const subjectCollection = collections[name];
  const { id } = data[name];

  try {
    await subjectCollection.update({ id }).set({ isDeleted: true });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.message || "Failed to archive subject.");
  }
};

const restore = async (data, { db: { collections } }) => {
  const subjectCollection = collections[name];
  const { id } = data[name];

  try {
    await subjectCollection.update({ id }).set({ isDeleted: false });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.message || "Failed to restore subject.");
  }
};

export default () => {
  return {
    create,
    update,
    archive,
    restore
  };
};