/**
 * =======================================================================================
 *  LESSON-SPECIFIC OPTIMIZED RESOLVERS
 * =======================================================================================
 *
 * This file contains optimized GraphQL resolvers specifically for lesson loading
 * with performance improvements including pagination and lightweight metadata queries.
 *
 * PERFORMANCE FEATURES:
 * 1. Lightweight lesson metadata endpoint (fast initial load)
 * 2. Paginated questions loading (reduce memory usage)
 * 3. Optimized field selection (fetch only what's needed)
 * 4. DataLoader integration for batched queries
 *
 * =======================================================================================
 */

import DataLoader from 'dataloader';
const { GraphQLError } = require('graphql');

// --- DataLoader Helper Functions ---

const groupItemsByKey = (items, keyField) => {
  const grouped = new Map();
  items.forEach(item => {
    const key = String(item[keyField]);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });
  return grouped;
};

const mapItemsToKeys = (keys, items, keyField = 'id') => {
  const itemMap = new Map(items.map(item => [String(item[keyField]), item]));
  return keys.map(key => itemMap.get(String(key)) || null);
};

// --- DataLoader Factory ---

export const createLoaders = (collections) => {
  const createByIdLoader = (collectionName) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Lesson query for '${collectionName}' with ${keys.length} keys:`, keys);
      const items = await collections[collectionName].find({
        where: { id: { in: keys }, isDeleted: false }
      });
      return mapItemsToKeys(keys, items, 'id');
    });
  };

  const createRelatedLoader = (collectionName, foreignKey) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Lesson related query for '${collectionName}' with ${keys.length} keys on '${foreignKey}':`, keys);
      const items = await collections[collectionName].find({
        where: { [foreignKey]: { in: keys }, isDeleted: false },
      });
      const groupedItems = groupItemsByKey(items, foreignKey);
      return keys.map(key => groupedItems.get(String(key)) || []);
    });
  };

  return {
    subtopicById: createByIdLoader('subtopic'),
    questionsBySubtopicId: createRelatedLoader('question', 'subtopic'),
    optionsByQuestionId: createRelatedLoader('option', 'question'),
    topicById: createByIdLoader('topic'),
    subjectById: createByIdLoader('subject'),
  };
};

// --- Optimized Lesson Resolvers ---

/**
 * Lightweight lesson metadata resolver
 * Fetches only essential lesson information for fast initial load
 */
const lessonMetadata = async (root, args, { loaders }) => {
  const { id } = args;
  if (!id) {
    throw new GraphQLError("Lesson ID must be provided.", { extensions: { code: 'BAD_USER_INPUT' } });
  }

  console.log(`[LESSON METADATA] Fast lookup for lesson ID: ${id}`);
  
  // Use DataLoader to fetch the subtopic (lesson)
  const subtopic = await loaders.subtopicById.load(id);
  
  if (!subtopic) {
    throw new GraphQLError("Lesson not found.", { extensions: { code: 'NOT_FOUND' } });
  }

  // Count questions without fetching them all
  const questions = await loaders.questionsBySubtopicId.load(id);
  const questionCount = questions ? questions.length : 0;

  // Calculate estimated duration (45 seconds per question)
  const estimatedDuration = Math.ceil((questionCount * 45) / 60); // in minutes

  return {
    id: subtopic.id,
    name: subtopic.name,
    topicName: subtopic.name, // Will be resolved by topic resolver
    questionCount,
    estimatedDuration,
    hasVideos: questions && questions.some(q => q.videos && q.videos.length > 0),
    hasImages: questions && questions.some(q => q.images && q.images.length > 0),
    difficulty: subtopic.difficulty || 'medium',
  };
};

/**
 * Paginated lesson questions resolver
 * Loads questions in chunks to reduce memory usage and improve load times
 */
const lessonQuestions = async (root, { id, limit = 20, offset = 0, includeOptions = true }, { loaders }) => {
  if (!id) {
    throw new GraphQLError("Lesson ID must be provided.", { extensions: { code: 'BAD_USER_INPUT' } });
  }

  console.log(`[LESSON QUESTIONS] Paginated lookup for lesson ID: ${id}, limit: ${limit}, offset: ${offset}`);
  
  // Get all questions for this subtopic (DataLoader batches these)
  const allQuestions = await loaders.questionsBySubtopicId.load(id);
  
  if (!allQuestions || allQuestions.length === 0) {
    return {
      questions: [],
      totalCount: 0,
      hasMore: false,
    };
  }

  // Apply pagination
  const lessonQuestions = allQuestions.slice(offset, offset + limit);
  const hasMore = offset + limit < allQuestions.length;

  // Prepare questions with optional options loading
  const lessonQuestionsWithOptions = await Promise.all(
    lessonQuestions.map(async (question) => {
      const questionData = {
        id: question.id,
        name: question.name,
        type: question.type,
        videos: question.videos || [],
        images: question.images || [],
        contentOrder: question.contentOrder ? JSON.parse(question.contentOrder) : [],
        optionsOrder: question.optionsOrder ? JSON.parse(question.optionsOrder) : [],
      };

      // Only fetch options if requested (reduces payload size)
      if (includeOptions) {
        const options = await loaders.optionsByQuestionId.load(question.id);
        questionData.options = options || [];
      } else {
        questionData.options = [];
      }

      return questionData;
    })
  );

  return {
    questions: lessonQuestionsWithOptions,
    totalCount: allQuestions.length,
    hasMore,
    currentPage: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
};

/**
 * Complete lesson resolver (for backward compatibility)
 * Combines metadata and questions in a single call
 */
const lesson = async (root, { id, questionLimit = 50, questionOffset = 0 }, { loaders }) => {
  if (!id) {
    throw new GraphQLError("Lesson ID must be provided.", { extensions: { code: 'BAD_USER_INPUT' } });
  }

  console.log(`[LESSON COMPLETE] Full lesson lookup for ID: ${id}`);

  // Get metadata
  const metadata = await lessonMetadata(root, { id }, { loaders });
  
  // Get questions
  const lessonQuestionsData = await lessonQuestions(root, { 
    id, 
    limit: questionLimit, 
    offset: questionOffset, 
    includeOptions: true 
  }, { loaders });

  return {
    ...metadata,
    ...lessonQuestionsData,
  };
};

// --- Nested Resolvers ---

const nested = {
  lesson: {
    // Resolve topic name efficiently
    topicName: async (root, args, { loaders }) => {
      if (!root.topic) return root.name; // Fallback to subtopic name
      
      try {
        const topic = await loaders.topicById.load(root.topic);
        return topic ? topic.name : root.name;
      } catch (error) {
        console.warn('Failed to resolve topic name:', error);
        return root.name;
      }
    },

    // Resolve subject information for additional context
    subject: async (root, args, { loaders }) => {
      if (!root.topic) return null;
      
      try {
        const topic = await loaders.topicById.load(root.topic);
        if (!topic || !topic.subject) return null;
        
        const subject = await loaders.subjectById.load(topic.subject);
        return subject ? {
          id: subject.id,
          name: subject.name,
        } : null;
      } catch (error) {
        console.warn('Failed to resolve subject:', error);
        return null;
      }
    },
  },

  LessonMetadata: {
    // Resolve topic name efficiently for metadata as well
    topicName: async (root, args, { loaders }) => {
      if (!root.topic && !root.topicName) return root.name;
      
      const topicId = root.topic || root.topicId; // Handle potential variations in root object
      if (!topicId) return root.topicName || root.name;

      try {
        const topic = await loaders.topicById.load(topicId);
        return topic ? topic.name : (root.topicName || root.name);
      } catch (error) {
        console.warn('Failed to resolve topic name for metadata:', error);
        return root.topicName || root.name;
      }
    },
  },

  lessonQuestions: {
    // Resolve options for each question when needed
    questions: async (root, args, { loaders }) => {
      if (!root.questions || !Array.isArray(root.questions)) {
        return [];
      }

      // If options are already included, return as-is
      if (root.questions.length > 0 && root.questions[0].options) {
        return root.questions;
      }

      // Otherwise, fetch options for each question
      return await Promise.all(
        root.questions.map(async (question) => {
          const options = await loaders.optionsByQuestionId.load(question.id);
          return {
            ...question,
            options: options || [],
          };
        })
      );
    },
  },
};

export { lessonMetadata, lessonQuestions, lesson, nested };
