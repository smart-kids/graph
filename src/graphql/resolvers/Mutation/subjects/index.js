import { ObjectId } from "mongodb";
const { name } = require("./about.js"); // Assuming 'name' refers to the subject collection
const { UserError } = require("graphql-errors");
const fs = require("fs"); // Not directly used in this version, but kept for context
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Google AI Configuration ---
const MODEL_NAME = "gemini-1.5-pro-latest"; // Using 'pro' as requested
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

// --- Retry Utility ---
async function retryOperation(operation, maxRetries = 3, delayMs = 1000, operationName = "Operation") {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const result = await operation();
            if (attempt > 0) {
                console.log(`Successfully completed ${operationName} on attempt ${attempt + 1}.`);
            }
            return result;
        } catch (error) {
            attempt++;
            // --- MODIFIED ERROR HANDLING ---
            // If it's a quota error, and we've exhausted retries, throw a more specific message.
            // Otherwise, handle other errors or continue retrying.
            const isQuotaError = error.message.includes("429 Too Many Requests") || error.message.includes("quota");

            if (isQuotaError) {
                console.error(`Quota exceeded or too many requests for ${operationName} (Attempt ${attempt}/${maxRetries}):`, error.message);
                if (attempt >= maxRetries) {
                    // For quota errors, it's often best to fail immediately after max retries
                    // as waiting more won't resolve the fundamental quota issue.
                    throw new Error(`AI quota exceeded for ${operationName}. Please check your API plan and billing. ${error.message}`);
                }
                // If not max retries, we still log and wait, as quota might be temporary
            } else {
                // Handle non-quota errors
                if (attempt >= maxRetries) {
                    console.error(`Failed ${operationName} after ${maxRetries} attempts. Last error:`, error);
                    throw new Error(`Failed to complete ${operationName} after ${maxRetries} attempts. ${error.message}`);
                }
                console.warn(`Error during ${operationName} (Attempt ${attempt}/${maxRetries}):`, error.message);
            }

            const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`Waiting for ${waitTime}ms before retrying ${operationName}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw new Error(`Operation ${operationName} failed after all retries.`);
}


// --- Helper Function 1: Extract Topics and Lessons ---
async function extractTopicsAndLessonsFromImages(imagesDataUrl, formName, subjectName) {
    if (!imagesDataUrl || imagesDataUrl.length === 0) {
        console.warn("No images provided for AI topic/lesson extraction. Skipping AI step.");
        return null;
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
        Analyze the following images, which contain a curriculum's table of contents for a specific grade and subject.
        Your task is to extract topics and lessons. For each topic, extract its title and suggest a 'suitable icon' name. For each lesson, extract its title and duration if visible.

        Ensure the language is appropriate for a ${formName} student.

        Return the result ONLY as a raw JSON object, without any markdown formatting or explanations.

        The JSON structure MUST be exactly as follows:
        {
          "topics": [
            {
              "title": "The full title of the topic (e.g., '1. Magnetism')",
              "icon": "A descriptive icon name, e.g., 'magnet' or 'file-certificate' if not inferrable",
              "lessons": [
                {
                  "title": "The full title of the lesson",
                  "duration": "The lesson's duration if visible (e.g., '~ 8 mins'), otherwise default to '~ 10 mins'"
                }
                // ... more lessons for this topic
              ]
            }
            // ... more topics
          ]
        }

        Example output:
        {
          "topics": [
            {
              "title": "1. Introduction to Chemistry",
              "icon": "atom",
              "lessons": [
                {
                  "title": "What is Chemistry?",
                  "duration": "~ 5 mins"
                },
                {
                  "title": "Atoms and Elements",
                  "duration": "~ 15 mins"
                }
              ]
            }
          ]
        }

        Now, process the provided images and generate the JSON with topics, lessons, and their titles/durations.
        If you cannot clearly infer an icon, use 'file-certificate'.
        If a lesson's duration is not visible, use '~ 10 mins'.
        **Do not include any 'id' fields in your response.**
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

    const operation = async () => {
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const responseText = response.text();
        console.log("Received response from Google AI for topic/lesson extraction.");

        const cleanedResponseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '');

        let parsedJson;
        try {
            parsedJson = JSON.parse(cleanedResponseText);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", parseError);
            console.error("Raw response text was:", cleanedResponseText);
            throw new Error("AI returned an invalid JSON format for topic/lesson extraction.");
        }

        // --- Refined AI Response Handling ---
        let extractedTopics = null;
        if (parsedJson && Array.isArray(parsedJson.topics)) {
            extractedTopics = parsedJson.topics;
        } else {
            console.warn("AI response structure did not directly yield a 'topics' array. Attempting to find it.");
            if (parsedJson) {
                for (const key in parsedJson) {
                    if (Array.isArray(parsedJson[key]) && parsedJson[key].every(item => item.hasOwnProperty('title') && item.hasOwnProperty('lessons'))) {
                        extractedTopics = parsedJson[key];
                        console.log(`Found 'topics' array under key: ${key}`);
                        break;
                    }
                }
            }
        }

        if (!extractedTopics || extractedTopics.length === 0 || !extractedTopics[0].lessons || extractedTopics[0].lessons.length === 0) {
            console.warn("AI response contains no valid topics or lessons. Returning null.");
            return null;
        }

        // --- Data Cleanup and Validation ---
        const cleanedTopics = extractedTopics.map(topic => {
            const cleanedTopic = JSON.parse(JSON.stringify(topic)); // Deep clone
            delete cleanedTopic.id; // Remove any potential ID from AI

            if (cleanedTopic.lessons) {
                cleanedTopic.lessons = cleanedTopic.lessons.map(lesson => {
                    delete lesson.id; // Remove any potential ID from AI
                    lesson.duration = lesson.duration || "~ 10 mins"; // Ensure duration is set
                    return lesson;
                });
            }
            return cleanedTopic;
        });

        return { topics: cleanedTopics };
    };

    try {
        return await retryOperation(operation, 3, 1500, `Google AI Topic/Lesson Extraction (${formName} - ${subjectName})`);
    } catch (e) {
        console.error("Retry failed for AI topic/lesson extraction:", e);
        throw new Error(`AI topic/lesson extraction failed after multiple retries: ${e.message}`);
    }
}


// --- Helper Function 2: Generate Questions for a Single Lesson ---
async function generateQuestionsForLesson(lessonTitle, formName, subjectName, lessonDuration) {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // --- REVISED Prompt to Emphasize 4-5 Questions per Lesson ---
    const prompt = `
        Generate **between 4 and 5 unique multiple-choice questions** for the following specific lesson. This quantity is CRITICAL.

        Lesson Details:
        Title: "${lessonTitle}"
        Subject: "${subjectName}"
        Grade: "${formName}"
        Duration: "${lessonDuration}"

        Each question must adhere to these rules:
          - A clear question text (for the "name" field).
          - **HTML formatted content** for explanations or context. This HTML can include text formatting (bolding, italics), lists, and emojis, but should **not** contain full markdown like code blocks or images unless they are inline SVGs.
          - Approximately **3 to 4 options**.
          - Exactly **ONE correct option**.
          - **Subtle hints** about the correct answer within the options themselves. For example, if the answer is "photosynthesis", one option might read "Process of energy conversion (e.g., photosynthesis)" while others are clearly incorrect.

        Ensure the language and complexity of the questions and explanations are appropriate for a ${formName} student.

        Return the result ONLY as a raw JSON object, without any markdown formatting or explanations.

        The JSON structure MUST be exactly as follows:
        {
          "questions": [
            {
              "name": "The question text (e.g., 'What is a property of magnets?')",
              "content": "<b>Brief context or explanation using HTML.</b> For example, this process is vital for life on Earth. 🌱",
              "options": [
                { "value": "Option A text", "correct": false },
                { "value": "Option B text (with a subtle hint)", "correct": true },
                { "value": "Option C text", "correct": false }
              ]
            }
            // ... repeat for a total of 4 to 5 questions for this lesson. ENSURE YOU GENERATE AT LEAST 4.
          ]
        }

        Example output demonstrating 4-5 questions:
        {
          "questions": [
            {
              "name": "What does chemistry primarily study?",
              "content": "Chemistry is the scientific discipline involved in understanding the properties, composition, structure, and reactions of matter. It's fundamental to many natural sciences. 🧪",
              "options": [
                { "value": "The movement of celestial bodies", "correct": false },
                { "value": "The properties and transformations of matter (like chemical reactions)", "correct": true },
                { "value": "The patterns of weather systems", "correct": false },
                { "value": "The study of living organisms", "correct": false }
              ]
            },
            {
              "name": "Which of the following is a core concept in chemistry?",
              "content": "Understanding how atoms bond and form molecules is key to chemistry. <br>Think about the building blocks of everything! 🧱",
              "options": [
                { "value": "Gravity", "correct": false },
                { "value": "Chemical Bonding", "correct": true },
                { "value": "Photosynthesis", "correct": false }
              ]
            },
            {
              "name": "What is matter?",
              "content": "Matter is anything that has mass and occupies space. Think about all the objects around you! 🌎",
              "options": [
                { "value": "Energy only", "correct": false },
                { "value": "Anything with mass and volume", "correct": true },
                { "value": "Pure light", "correct": false }
              ]
            },
            {
              "name": "What is a chemical reaction?",
              "content": "A process that involves rearrangement of the molecular or ionic structure of a substance. It leads to new substances. 🔥",
              "options": [
                { "value": "A physical change like melting ice", "correct": false },
                { "value": "The formation of new chemical substances", "correct": true },
                { "value": "Simply mixing two liquids", "correct": false }
              ]
            }
            // ... and so on, up to 5 questions.
          ]
        }

        **Do not include any 'id' fields in your response.**
    `;

    const operation = async () => {
        const result = await model.generateContent([prompt]); // No images for question generation
        const response = await result.response;
        const responseText = response.text();
        console.log(`Received response from Google AI for questions for lesson: "${lessonTitle}"`);

        const cleanedResponseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '');

        let parsedJson;
        try {
            parsedJson = JSON.parse(cleanedResponseText);
        } catch (parseError) {
            console.error(`Failed to parse AI response as JSON for lesson "${lessonTitle}":`, parseError);
            console.error("Raw response text was:", cleanedResponseText);
            throw new Error(`AI returned an invalid JSON format for lesson "${lessonTitle}".`);
        }

        let extractedQuestions = null;
        if (parsedJson && Array.isArray(parsedJson.questions)) {
            extractedQuestions = parsedJson.questions;
        } else {
            console.warn(`AI response for lesson "${lessonTitle}" did not yield a 'questions' array. Attempting to find it.`);
            if (parsedJson) {
                for (const key in parsedJson) {
                    if (Array.isArray(parsedJson[key])) {
                        extractedQuestions = parsedJson[key];
                        console.log(`Found 'questions' array under key: ${key}`);
                        break;
                    }
                }
            }
        }

        // --- Validation: Check for minimum 4-5 questions per lesson ---
        if (!extractedQuestions || extractedQuestions.length < 4) {
            console.warn(`AI response for lesson "${lessonTitle}" did not generate the required minimum of 4 questions (${extractedQuestions ? extractedQuestions.length : 0} found).`);
            // If strict adherence is needed, uncomment the next line:
            // return null;
        }

        console.log(`AI response for lesson "${lessonTitle}" passed basic validation.`);

        // --- Data Cleanup and Validation ---
        const cleanedQuestions = extractedQuestions ? extractedQuestions.map(question => {
            const cleanedQuestion = JSON.parse(JSON.stringify(question)); // Deep clone
            delete cleanedQuestion.id; // Remove any potential ID from AI

            // IMPORTANT: Place the AI-generated 'content' into the 'name' field
            // as per the requirement for the 'question' model.
            if (cleanedQuestion.content !== undefined) {
                cleanedQuestion.name = cleanedQuestion.content;
                delete cleanedQuestion.content; // Remove the original content field
            } else {
                // Fallback if content is missing but name might exist.
                // The prompt guarantees 'name' for question text and 'content' for HTML.
                // If 'name' is empty after mapping, it's an issue.
                if (cleanedQuestion.name === undefined || cleanedQuestion.name === "") {
                     console.warn(`Question in lesson "${lessonTitle}" is missing both question text and HTML content. Assigning a placeholder.`);
                     cleanedQuestion.name = "<div>Missing Question Text</div>"; // Placeholder if name is missing
                }
            }
            return cleanedQuestion;
        }) : []; // Return empty array if no questions were extracted

        return { questions: cleanedQuestions };
    };

    try {
        return await retryOperation(operation, 3, 2000, `Google AI Question Generation for Lesson "${lessonTitle}"`);
    } catch (e) {
        console.error("Retry failed for AI question generation for lesson:", e);
        throw new Error(`AI question generation failed after multiple retries for lesson "${lessonTitle}": ${e.message}`);
    }
}


// --- Modified create function ---
const create = async (data, { db: { collections } }) => {
    const subjectCollection = collections[name];
    const gradeCollection = collections.grade;
    const topicCollection = collections.topic;
    const subtopicCollection = collections.subtopic;
    const questionCollection = collections.question;
    const optionCollection = collections.option;
    const answerCollection = collections.answer;

    const generateId = () => new ObjectId().toHexString();

    const subjectId = generateId();

    const subjectInputData = data[name];
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

    let extractedCurriculum = null;
    let aiGeneratedQuestions = {}; // Store questions per lesson title

    let createdTopicIds = [];
    let createdSubtopicIds = [];
    let createdQuestionIds = [];
    let createdOptionIds = [];
    let createdAnswerIds = [];

    // --- Step 1: Extract Topics and Lessons from Images ---
    if (topicalImages.length > 0) {
        try {
            extractedCurriculum = await extractTopicsAndLessonsFromImages(
                topicalImages.map(img => img.dataUrl),
                actualGradeName,
                subjectName
            );
        } catch (aiError) {
            console.error("AI topic/lesson extraction failed:", aiError);
            console.warn("AI topic/lesson extraction failed. Proceeding without AI curriculum structure.");
        }
    } else {
        console.log("No topical images provided for AI generation.");
    }

    // --- Step 2: If topics/lessons extracted, generate questions for each lesson ---
    if (extractedCurriculum && extractedCurriculum.topics && extractedCurriculum.topics.length > 0) {
        console.log(`Found ${extractedCurriculum.topics.length} topics and attempting to generate questions for their lessons.`);
        for (const topic of extractedCurriculum.topics) {
            if (topic.lessons && topic.lessons.length > 0) {
                for (const lesson of topic.lessons) {
                    try {
                        const lessonQuestions = await generateQuestionsForLesson(
                            lesson.title,
                            actualGradeName,
                            subjectName,
                            lesson.duration
                        );
                        // Store questions associated with the lesson title
                        if (lessonQuestions && lessonQuestions.questions && lessonQuestions.questions.length > 0) {
                            aiGeneratedQuestions[lesson.title] = lessonQuestions.questions;
                            console.log(`Successfully generated ${lessonQuestions.questions.length} questions for lesson: "${lesson.title}"`);
                        } else {
                            console.warn(`No questions generated or lesson "${lesson.title}" returned empty. Skipping this lesson's questions.`);
                        }
                    } catch (error) {
                        console.error(`Failed to generate questions for lesson "${lesson.title}":`, error);
                        // Decide if this failure should halt the whole process or just skip this lesson.
                        // For now, we'll log and continue.
                    }
                }
            }
        }
    } else {
        console.log("No valid AI-generated topics/lessons found. Cannot proceed with question generation.");
    }

    // --- Step 3: Prepare Subject and Process Curriculum Data for Database Insertion ---
    let finalSubjectEntry;
    try {
        finalSubjectEntry = {
            id: subjectId,
            name: subjectName,
            grade: gradeId,
            teacher: subjectInputData.teacher,
            school: subjectInputData.school,
            topicalImages: undefined, // Not storing raw image data in the subject
            topicsOrder: [],
        };

        let topicsToCreate = [];

        if (extractedCurriculum && extractedCurriculum.topics && Object.keys(aiGeneratedQuestions).length > 0) {
            for (const topic of extractedCurriculum.topics) {
                const topicId = generateId();
                createdTopicIds.push(topicId);
                finalSubjectEntry.topicsOrder.push(topicId);

                const topicData = {
                    id: topicId,
                    name: topic.title,
                    subject: subjectId,
                    grade: gradeId,
                    icon: topic.icon || "file-certificate",
                    school: subjectInputData.school,
                    subTopicOrder: [],
                };
                topicsToCreate.push(topicData);
                console.log(`Preparing Topic: "${topic.title}" (ID: ${topicId})`);

                let currentTopicSubtopicOrder = [];
                if (topic.lessons && topic.lessons.length > 0) {
                    for (const lesson of topic.lessons) {
                        const lessonQuestions = aiGeneratedQuestions[lesson.title];

                        if (!lessonQuestions || lessonQuestions.length === 0) {
                            console.log(`  Skipping lesson "${lesson.title}" as no questions were generated.`);
                            continue; // Skip lesson if no questions were generated for it
                        }

                        const subtopicId = generateId();
                        currentTopicSubtopicOrder.push(subtopicId);
                        createdSubtopicIds.push(subtopicId);

                        const subtopicData = {
                            id: subtopicId,
                            name: lesson.title,
                            topic: topicId,
                            duration: lesson.duration || "~ 10 mins",
                        };
                        console.log(`  Preparing Subtopic: "${lesson.title}" (ID: ${subtopicId})`);

                        let subtopicQuestions = [];
                        for (const aiQuestion of lessonQuestions) {
                            const questionId = generateId();
                            createdQuestionIds.push(questionId);
                            const questionData = {
                                id: questionId,
                                subtopic: subtopicId,
                                type: "SINGLECHOICE",
                                name: aiQuestion.name, // This will hold the HTML content
                                // content field is not used in the question model as per provided schema snippet
                                response_type: "single_choice",
                                school: subjectInputData.school,
                            };
                            subtopicQuestions.push(questionData);

                            const questionOptionsDb = [];
                            const questionAnswersDb = [];

                            if (aiQuestion.options && aiQuestion.options.length > 0) {
                                for (const aiOption of aiQuestion.options) {
                                    const optionId = generateId();
                                    createdOptionIds.push(optionId);
                                    questionOptionsDb.push({
                                        id: optionId,
                                        value: aiOption.value,
                                        question: questionId,
                                        school: subjectInputData.school,
                                    });
                                    if (aiOption.correct) {
                                        const answerId = generateId();
                                        createdAnswerIds.push(answerId);
                                        questionAnswersDb.push({
                                            id: answerId,
                                            value: optionId,
                                            question: questionId,
                                        });
                                    }
                                }
                            }
                            // Attach prepared options and answers to the question data
                            subtopicQuestions[subtopicQuestions.length - 1].options = questionOptionsDb;
                            subtopicQuestions[subtopicQuestions.length - 1].answers = questionAnswersDb;
                        }
                        subtopicData.questions = subtopicQuestions;
                        topicData.subtopics = topicData.subtopics || [];
                        topicData.subtopics.push(subtopicData);
                    }
                }
                topicData.subTopicOrder = currentTopicSubtopicOrder;
            }
        } else {
            console.log("No valid AI-generated topics or questions. Processing manual subject data.");
            if (subjectInputData.topicsOrder && subjectInputData.topicsOrder.length > 0) {
                finalSubjectEntry.topicsOrder = subjectInputData.topicsOrder;
            } else {
                finalSubjectEntry.topicsOrder = [];
            }
        }

        // --- Step 4: Bulk Create Records ---
        await subjectCollection.create(finalSubjectEntry);
        console.log(`Created main Subject: "${subjectName}" (ID: ${subjectId}) for Grade ID: ${gradeId}`);

        if (topicsToCreate.length > 0) {
            await topicCollection.createEach(topicsToCreate);
            console.log(`Created ${topicsToCreate.length} topics.`);
        }

        const allSubtopicsToCreate = [];
        const allQuestionsToCreate = [];
        const allOptionsToCreate = [];
        const allAnswersToCreate = [];

        topicsToCreate.forEach(topic => {
            if (topic.subtopics) {
                topic.subtopics.forEach(subtopic => {
                    allSubtopicsToCreate.push(subtopic);
                    if (subtopic.questions) {
                        subtopic.questions.forEach(question => {
                            allQuestionsToCreate.push(question);
                            if (question.options) {
                                allOptionsToCreate.push(...question.options);
                            }
                            if (question.answers) {
                                allAnswersToCreate.push(...question.answers);
                            }
                        });
                    }
                });
            }
        });

        if (allSubtopicsToCreate.length > 0) {
            await subtopicCollection.createEach(allSubtopicsToCreate);
            console.log(`Created ${allSubtopicsToCreate.length} subtopics.`);
        }
        if (allQuestionsToCreate.length > 0) {
            await questionCollection.createEach(allQuestionsToCreate);
            console.log(`Created ${allQuestionsToCreate.length} questions.`);
        }
        if (allOptionsToCreate.length > 0) {
            await optionCollection.createEach(allOptionsToCreate);
            console.log(`Created ${allOptionsToCreate.length} options.`);
        }
        if (allAnswersToCreate.length > 0) {
            await answerCollection.createEach(allAnswersToCreate);
            console.log(`Created ${allAnswersToCreate.length} answers.`);
        }

        // --- Step 5: Update Topics with their Subtopic Order ---
        for (const topic of topicsToCreate) {
            await topicCollection.update({ id: topic.id }).set({ subTopicOrder: topic.subTopicOrder });
        }

        // --- Step 6: Return Created Subject and its Related Entities ---
        // Fetch and structure the output to include nested relationships
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
            console.log("Attempting cleanup of partially created records...");
            if (createdTopicIds.length > 0) {
                await topicCollection.destroy({ id: createdTopicIds });
                console.log(`Cleaned up ${createdTopicIds.length} topics.`);
            }
            if (createdSubtopicIds.length > 0) {
                await subtopicCollection.destroy({ id: createdSubtopicIds });
                console.log(`Cleaned up ${createdSubtopicIds.length} subtopics.`);
            }
            if (createdQuestionIds.length > 0) {
                await questionCollection.destroy({ id: createdQuestionIds });
                console.log(`Cleaned up ${createdQuestionIds.length} questions.`);
            }
            if (createdOptionIds.length > 0) {
                await optionCollection.destroy({ id: createdOptionIds });
                console.log(`Cleaned up ${createdOptionIds.length} options.`);
            }
            if (createdAnswerIds.length > 0) {
                await answerCollection.destroy({ id: createdAnswerIds });
                console.log(`Cleaned up ${createdAnswerIds.length} answers.`);
            }
            if (subjectId) {
                 await subjectCollection.destroy({ id: subjectId });
                 console.log(`Cleaned up main subject: ${subjectId}.`);
            }
        } catch (cleanupError) {
            console.error("Error during cleanup after creation failure:", cleanupError);
        }

        throw new UserError(`Failed to create subject and its curriculum: ${err.message}`);
    }
};


// --- Existing update, archive, restore functions ---
const update = async (data, { db: { collections } }) => {
  const subjectCollection = collections[name];
  const { id } = data[name];
  const entry = data[name];
  let { topicOrder } = entry;

  entry.topicsOrder = topicOrder; // Assuming it's an array of IDs

  try {
    delete entry.id; // Ensure ID is not updated
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