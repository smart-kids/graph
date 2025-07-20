// src/graphql/resolvers/Mutation/subjects/index.js (or wherever your create function is)

import { ObjectId } from "mongodb";
const { name } = require("./about.js"); // Assuming 'name' refers to the subject collection
const { UserError } = require("graphql-errors");
const fs = require("fs"); // Not directly used in this version, but kept for context
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Google AI Configuration ---
const MODEL_NAME = "gemini-1.5-pro-latest";
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
            const isQuotaError = error.message.includes("429 Too Many Requests") || error.message.includes("quota");

            if (isQuotaError) {
                console.error(`Quota exceeded or too many requests for ${operationName} (Attempt ${attempt}/${maxRetries}):`, error.message);
                if (attempt >= maxRetries) {
                    throw new Error(`AI quota exceeded for ${operationName}. Please check your API plan and billing. ${error.message}`);
                }
            } else {
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


// --- Helper Function 1: Extract Topics and Lessons (REMOVED - Not used in this flow) ---
// ... This function is no longer needed as we rely solely on manual JSON input ...


// --- Helper Function 2: Generate Questions for a Single Lesson (REMOVED - Not directly called by create resolver) ---
// This function's PROMPT TEMPLATE is used by the Modal component to help the user generate the prompt.
// The actual generation is done by the user externally.


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

    // Determine if manual AI input is provided. Image upload logic is removed.
    const useManualAiInput = subjectInputData.aiGeneratedCurriculum && typeof subjectInputData.aiGeneratedCurriculum === 'object' && Object.keys(subjectInputData.aiGeneratedCurriculum).length > 0;

    let extractedCurriculum = null; // Holds { topics: [...] } from pasted JSON

    let createdTopicIds = [];
    let createdSubtopicIds = [];
    let createdQuestionIds = [];
    let createdOptionIds = [];
    let createdAnswerIds = [];

    // --- Step 1: Get Curriculum Data from Manual Input ---
    if (useManualAiInput) {
        console.log("Manual AI JSON input provided.");
        // Validate the manual AI input
        if (typeof subjectInputData.aiGeneratedCurriculum === 'object' && subjectInputData.aiGeneratedCurriculum.topics) {
            // Perform basic validation on the pasted JSON
            let allLessonsHaveSufficientQuestions = true;
            // Check if there are any topics/lessons/questions to validate against
            if (subjectInputData.aiGeneratedCurriculum.topics.length > 0 && subjectInputData.aiGeneratedCurriculum.topics[0].lessons && subjectInputData.aiGeneratedCurriculum.topics[0].lessons.length > 0) {
                for (const topic of subjectInputData.aiGeneratedCurriculum.topics) {
                    for (const lesson of topic.lessons) {
                        if (!lesson.questions || lesson.questions.length < 4) { // Check for minimum 4 questions
                            allLessonsHaveSufficientQuestions = false;
                            break;
                        }
                    }
                    if (!allLessonsHaveSufficientQuestions) break;
                }
            }

            if (!allLessonsHaveSufficientQuestions) {
                console.warn("Pasted AI JSON does not meet the minimum question count requirement (4 per lesson).");
                throw new UserError("Pasted AI JSON does not meet the minimum question count requirement (4 per lesson).");
            }

            extractedCurriculum = subjectInputData.aiGeneratedCurriculum; // Use the valid manual input
            console.log("Pasted AI JSON is valid.");
        } else {
            console.warn("Pasted AI JSON is invalid or missing 'topics'. Cannot use manual AI input.");
            throw new UserError("Pasted AI JSON is invalid or missing 'topics'.");
        }
    } else {
        console.log("No AI input provided for curriculum generation. Subject will be created without AI-generated content.");
        // If no AI input is provided, the subject will be created, but without topics/lessons/questions from AI.
        // The 'topicsToCreate' array will remain empty.
    }

    // --- Step 2: Prepare Subject and Process Curriculum Data for Database Insertion ---
    let finalSubjectEntry;
    try {
        finalSubjectEntry = {
            id: subjectId,
            name: subjectName,
            grade: gradeId,
            teacher: subjectInputData.teacher,
            school: subjectInputData.school,
            topicalImages: undefined, // No images used in this flow
            topicsOrder: [],
        };

        let topicsToCreate = [];

        // Proceed only if we have curriculum data from manual input
        if (extractedCurriculum && extractedCurriculum.topics && extractedCurriculum.topics.length > 0) {
            for (const topic of extractedCurriculum.topics) {
                // Skip topics that ended up with no lessons or no questions after processing
                if (!topic.lessons || topic.lessons.length === 0) {
                    console.log(`Skipping topic "${topic.title}" as it has no lessons.`);
                    continue;
                }

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
                for (const lesson of topic.lessons) {
                    // Get questions for this lesson directly from the pasted JSON
                    const lessonQuestions = lesson.questions;

                    if (!lessonQuestions || lessonQuestions.length === 0) {
                        console.log(`  Skipping lesson "${lesson.title}" as no questions were provided in the JSON.`);
                        continue; // Skip lesson if no questions were provided
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
                            name: aiQuestion.name, // This now holds the HTML content
                            // content field is not used in the question model
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
                topicData.subTopicOrder = currentTopicSubtopicOrder;
            }
        } else {
            console.log("No valid AI-generated curriculum structure found. Processing manual subject data.");
            // If no AI data, fallback to manual topicsOrder if provided in input
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