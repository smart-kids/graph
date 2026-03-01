require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runAudit() {
  const client = new Client({
    connectionString: process.env.DB_URL,
    ssl: false
  });

  try {
    await client.connect();
    console.log('Connected to database!');

    // --- 1. Fetch all raw data ---
    console.log('Fetching subjects...');
    const subjectsRes = await client.query('SELECT id, name FROM subject WHERE "isDeleted" = false OR "isDeleted" IS NULL');
    
    console.log('Fetching topics...');
    const topicsRes = await client.query('SELECT id, name, subject FROM topic WHERE "isDeleted" = false OR "isDeleted" IS NULL');
    
    console.log('Fetching subtopics...');
    const subtopicsRes = await client.query('SELECT id, name, topic FROM subtopic WHERE "isDeleted" = false OR "isDeleted" IS NULL');
    
    console.log('Fetching questions...');
    const questionsRes = await client.query('SELECT id, name, type, subtopic FROM question WHERE "isDeleted" = false OR "isDeleted" IS NULL');
    
    console.log('Fetching options (this may take a moment)...');
    const optionsRes = await client.query('SELECT id, value, correct, question FROM option WHERE "isDeleted" = false OR "isDeleted" IS NULL');

    console.log('Data fetched. Processing hierarchy...');

    // --- 2. Index data for fast lookup ---
    const optionsByQuestion = new Map();
    optionsRes.rows.forEach(opt => {
        const qId = String(opt.question);
        if (!optionsByQuestion.has(qId)) optionsByQuestion.set(qId, []);
        optionsByQuestion.get(qId).push(opt);
    });

    const questionsBySubtopic = new Map();
    questionsRes.rows.forEach(q => {
        const sId = String(q.subtopic);
        if (!questionsBySubtopic.has(sId)) questionsBySubtopic.set(sId, []);
        
        // Nest options
        q.options = optionsByQuestion.get(String(q.id)) || [];
        questionsBySubtopic.get(sId).push(q);
    });

    const subtopicsByTopic = new Map();
    subtopicsRes.rows.forEach(st => {
        const tId = String(st.topic);
        if (!subtopicsByTopic.has(tId)) subtopicsByTopic.set(tId, []);
        
        // Nest questions
        const questions = questionsBySubtopic.get(String(st.id)) || [];
        st.questionCount = questions.length;
        st.questions = questions; 
        subtopicsByTopic.get(tId).push(st);
    });

    const topicsBySubject = new Map();
    topicsRes.rows.forEach(t => {
        const subId = String(t.subject);
        if (!topicsBySubject.has(subId)) topicsBySubject.set(subId, []);
        
        // Nest subtopics
        const subtopics = subtopicsByTopic.get(String(t.id)) || [];
        t.subtopicCount = subtopics.length;
        t.totalQuestions = subtopics.reduce((sum, st) => sum + st.questionCount, 0);
        t.subtopics = subtopics;
        topicsBySubject.get(subId).push(t);
    });

    // --- 3. Build top-level Subject structure ---
    const auditData = subjectsRes.rows.map(sub => {
        const topics = topicsBySubject.get(String(sub.id)) || [];
        return {
            ...sub,
            topicCount: topics.length,
            totalSubtopics: topics.reduce((sum, t) => sum + t.subtopicCount, 0),
            totalQuestions: topics.reduce((sum, t) => sum + t.totalQuestions, 0),
            topics: topics
        };
    });

    // --- 4. Calculate Summary Statistics ---
    const stats = {
        totalSubjects: subjectsRes.rowCount,
        totalTopics: topicsRes.rowCount,
        totalSubtopics: subtopicsRes.rowCount,
        totalQuestions: questionsRes.rowCount,
        totalOptions: optionsRes.rowCount,
        emptySubtopics: subtopicsRes.rows.filter(st => (questionsBySubtopic.get(String(st.id)) || []).length === 0).length,
        emptyTopics: topicsRes.rows.filter(t => (subtopicsByTopic.get(String(t.id)) || []).length === 0).length,
        emptySubjects: subjectsRes.rows.filter(s => (topicsBySubject.get(String(s.id)) || []).length === 0).length,
        averageQuestionsPerSubtopic: parseFloat((questionsRes.rowCount / subtopicsRes.rowCount).toFixed(2))
    };

    const finalReport = {
        generatedAt: new Date().toISOString(),
        statistics: stats,
        hierarchy: auditData
    };

    // --- 5. Write to File ---
    const outputPath = path.join(__dirname, 'content_audit.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 2));

    console.log('\n--- Audit Complete ---');
    console.table(stats);
    console.log(`\nFull hierarchical report written to: ${outputPath}`);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.end();
  }
}

runAudit();
