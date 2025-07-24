// src/graphql/resolvers/Mutation/subjects/index.js

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


// --- Modified create function ---
const create = async (data, { db: { collections } }) => {
  console.log("Subject creation started.", data);
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

  // --- VALIDATION ---
  if (!subjectInputData.name) throw new UserError("Subject name is missing.");
  if (!subjectInputData.grade) throw new UserError("Grade ID is missing.");
  if (!subjectInputData.teacher) throw new UserError("Teacher ID is missing.");
  // --- END VALIDATION ---

  console.log("Subject Input Data received:", JSON.stringify(subjectInputData, null, 2));

  let extractedCurriculum = null;
  const useManualAiInput = typeof subjectInputData.aiGeneratedCurriculum === 'string' && subjectInputData.aiGeneratedCurriculum.trim().length > 0;

  if (useManualAiInput) {
      try {
          const parsedCurriculum = JSON.parse(subjectInputData.aiGeneratedCurriculum);
          if (typeof parsedCurriculum === 'object' && parsedCurriculum.topics && Array.isArray(parsedCurriculum.topics)) {
              extractedCurriculum = parsedCurriculum;
              console.log("Manual AI JSON is valid and processed.");
          } else {
              throw new UserError("Pasted AI JSON is invalid or missing 'topics' array.");
          }
      } catch (parseError) {
          console.error("Error parsing AI JSON:", parseError);
          throw new UserError(`Invalid AI JSON format: ${parseError.message}`);
      }
  } else {
      console.log("No AI input provided for curriculum generation. Subject will be created without AI-generated content.");
  }

  let createdTopicIds = [];
  let createdSubtopicIds = [];
  let createdQuestionIds = [];
  let createdOptionIds = [];
  let createdAnswerIds = [];

  // --- Prepare Data for Database Insertion ---
  const finalSubjectEntry = {
      id: subjectId,
      name: subjectInputData.name,
      grade: subjectInputData.grade,
      teacher: subjectInputData.teacher,
      school: subjectInputData.school,
      topicalImages: undefined,
      topicsOrder: [],
  };

  const topicsWithChildren = []; // Temporary array to hold topics with their nested children

  // --- Step 1: Build the complete nested data structure in memory ---
  if (extractedCurriculum && extractedCurriculum.topics) {
      console.log(`Processing ${extractedCurriculum.topics.length} topics from AI data.`);
      for (const topic of extractedCurriculum.topics) {
          if (!topic.title) {
              console.warn("Skipping a topic because it has no title.");
              continue;
          }
          console.log(`Processing topic: "${topic.title}"`);

          if (!topic.lessons || !Array.isArray(topic.lessons) || topic.lessons.length === 0) {
              console.log(`Skipping topic "${topic.title}" as it has no valid 'lessons' array.`);
              continue;
          }
          console.log(`  Topic "${topic.title}" has ${topic.lessons.length} lessons.`);

          const topicId = generateId();
          createdTopicIds.push(topicId);
          finalSubjectEntry.topicsOrder.push(topicId);

          const topicData = {
              id: topicId,
              name: topic.title,
              subject: subjectId,
              grade: subjectInputData.grade,
              icon: topic.icon || "file-certificate",
              school: subjectInputData.school,
              subTopicOrder: [],
          };
          
          const subtopicsForThisTopic = [];
          for (const lesson of topic.lessons) {
              if (!lesson.title) {
                  console.warn("Skipping a lesson because it has no title.");
                  continue;
              }
              console.log(`  Processing lesson: "${lesson.title}"`);

              const lessonQuestions = lesson.questions;
              if (!lessonQuestions || !Array.isArray(lessonQuestions) || lessonQuestions.length === 0) {
                  console.log(`    Skipping lesson "${lesson.title}" as its 'questions' array is empty or invalid.`);
                  continue;
              }
              console.log(`    Lesson "${lesson.title}" has ${lessonQuestions.length} questions.`);

              const subtopicId = generateId();
              createdSubtopicIds.push(subtopicId);
              topicData.subTopicOrder.push(subtopicId);

              const subtopicData = {
                  id: subtopicId,
                  name: lesson.title,
                  topic: topicId,
                  duration: lesson.duration || "~ 10 mins",
                  school: subjectInputData.school,
              };

              const questionsForThisSubtopic = [];
              for (const aiQuestion of lessonQuestions) {
                  if (!aiQuestion || !aiQuestion.name) {
                      console.warn("Skipping a question because it's invalid or has no name.");
                      continue;
                  }

                  const questionId = generateId();
                  createdQuestionIds.push(questionId);

                  const questionData = {
                      id: questionId,
                      subtopic: subtopicId,
                      type: "SINGLECHOICE",
                      name: aiQuestion.name,
                      response_type: "single_choice",
                      school: subjectInputData.school,
                  };
                  
                  const questionOptionsDb = [];
                  const questionAnswersDb = [];

                  if (aiQuestion.options && Array.isArray(aiQuestion.options)) {
                      for (const aiOption of aiQuestion.options) {
                          if (!aiOption || typeof aiOption.value === 'undefined') continue;
                          
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
                  // Temporarily attach children for flattening later
                  questionData.options = questionOptionsDb;
                  questionData.answers = questionAnswersDb;
                  questionsForThisSubtopic.push(questionData);
              }
              
              // Only add subtopic if it has questions
              if (questionsForThisSubtopic.length > 0) {
                  subtopicData.questions = questionsForThisSubtopic;
                  subtopicsForThisTopic.push(subtopicData);
              } else {
                  console.log(`  Skipping subtopic "${lesson.title}" because no valid questions were processed for it.`);
              }
          }
          
          // Only add topic if it has subtopics
          if (subtopicsForThisTopic.length > 0) {
              topicData.subtopics = subtopicsForThisTopic;
              topicsWithChildren.push(topicData);
          } else {
              console.log(`Skipping topic "${topic.title}" because no valid subtopics with questions were processed.`);
          }
      }
  }

  // --- Step 2: Flatten the nested structure into separate lists for bulk creation ---
  const topicsToCreate = [];
  const allSubtopicsToCreate = [];
  const allQuestionsToCreate = [];
  const allOptionsToCreate = [];
  const allAnswersToCreate = [];

  topicsWithChildren.forEach(topic => {
      const { subtopics, ...topicForDb } = topic;
      topicsToCreate.push(topicForDb);

      if (subtopics) {
          subtopics.forEach(subtopic => {
              const { questions, ...subtopicForDb } = subtopic;
              allSubtopicsToCreate.push(subtopicForDb);

              if (questions) {
                  questions.forEach(question => {
                      const { options, answers, ...questionForDb } = question;
                      allQuestionsToCreate.push(questionForDb);
                      if (options) allOptionsToCreate.push(...options);
                      if (answers) allAnswersToCreate.push(...answers);
                  });
              }
          });
      }
  });


  // --- Step 3: Perform all database write operations ---
  try {
      console.log(`Attempting to create Subject: "${finalSubjectEntry.name}"`);
      await subjectCollection.create(finalSubjectEntry);
      console.log(`Created main Subject: "${finalSubjectEntry.name}" (ID: ${subjectId})`);

      if (topicsToCreate.length > 0) {
          console.log(`Attempting to create ${topicsToCreate.length} topics.`);
          await topicCollection.createEach(topicsToCreate);
          console.log(`Successfully created ${topicsToCreate.length} topics.`);
      }
      
      if (allSubtopicsToCreate.length > 0) {
          console.log(`Attempting to create ${allSubtopicsToCreate.length} subtopics.`);
          await subtopicCollection.createEach(allSubtopicsToCreate);
          console.log(`Successfully created ${allSubtopicsToCreate.length} subtopics.`);
      }
      
      if (allQuestionsToCreate.length > 0) {
          console.log(`Attempting to create ${allQuestionsToCreate.length} questions.`);
          await questionCollection.createEach(allQuestionsToCreate);
          console.log(`Successfully created ${allQuestionsToCreate.length} questions.`);
      }

      if (allOptionsToCreate.length > 0) {
          console.log(`Attempting to create ${allOptionsToCreate.length} options.`);
          await optionCollection.createEach(allOptionsToCreate);
          console.log(`Successfully created ${allOptionsToCreate.length} options.`);
      }

      if (allAnswersToCreate.length > 0) {
          console.log(`Attempting to create ${allAnswersToCreate.length} answers.`);
          await answerCollection.createEach(allAnswersToCreate);
          console.log(`Successfully created ${allAnswersToCreate.length} answers.`);
      }
      
      // Update Topic `subTopicOrder` after all subtopics are created
      for (const topic of topicsToCreate) {
          if (topic.subTopicOrder && topic.subTopicOrder.length > 0) {
              await topicCollection.update({ id: topic.id }).set({ subTopicOrder: topic.subTopicOrder });
          }
      }
      console.log("Finished updating subTopicOrder for topics.");

      // --- Step 4: Fetch and Return the Created Structure ---
      console.log(`Fetching created subject and its nested content for ID: ${subjectId}`);
      const createdSubject = await subjectCollection.findOne({ id: subjectId });
      if (!createdSubject) {
          throw new Error("Internal error: Created subject not found after creation.");
      }

      const createdTopics = await topicCollection.find({ subject: subjectId });
      for (const topic of createdTopics) {
          const subtopics = await subtopicCollection.find({ topic: topic.id });
          for (const subtopic of subtopics) {
              const questions = await questionCollection.find({ subtopic: subtopic.id });
              for (const question of questions) {
                  question.options = await optionCollection.find({ question: question.id });
                  question.answers = await answerCollection.find({ question: question.id });
              }
              subtopic.questions = questions;
          }
          topic.subtopics = subtopics;
      }
      createdSubject.topics = createdTopics;

      console.log(`Successfully prepared response for subject ID: ${subjectId}`);
      return createdSubject;

  } catch (err) {
      console.error("Error during subject creation process:", err);
      // --- Error Handling and Cleanup ---
      console.log("Attempting cleanup of partially created records...");
      try {
          if (createdTopicIds.length > 0) await topicCollection.destroy({ id: createdTopicIds });
          if (createdSubtopicIds.length > 0) await subtopicCollection.destroy({ id: createdSubtopicIds });
          if (createdQuestionIds.length > 0) await questionCollection.destroy({ id: createdQuestionIds });
          if (createdOptionIds.length > 0) await optionCollection.destroy({ id: createdOptionIds });
          if (createdAnswerIds.length > 0) await answerCollection.destroy({ id: createdAnswerIds });
          if (subjectId) await subjectCollection.destroy({ id: subjectId });
          console.log("Cleanup completed.");
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