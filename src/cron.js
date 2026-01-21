const cron = require('node-cron');
const sendSms = require('./utils/sms');
const moment = require('moment');

const initCron = async (storage) => {
    console.log("CronService: Initializing...");

    // Schedule: Running every day at 10:00 AM (East Africa Time is usually UTC+3, user said 'on server' which likely assumes local time or UTC)
    // Let's assume server time. 10 AM is a good time.
    cron.schedule('0 10 * * *', async () => {
        console.log("CronService: Running daily engagement check...");
        try {
            const db = await storage;
            const { collections } = db;
            
            // 1. Find inactive users (This is a simplified logic)
            // Ideally we check 'lastLogin' or 'lessonAttempts'
            // Since we just added 'lastLogin', old users won't have it.
            
            // For now, let's just log and maybe send to the admin as per 'Test' requirements implicitly
            // or send to a test group.
            
            // "Encourages the users to access the app and continue with their last class"
            
            // Allow querying for recent lesson attempts to find "drop-offs"
            // e.g. users who started a lesson 2 days ago but didn't finish?
            
            // For this implementation, we will stick to a basic reminder for now.
            // CAUTION: Sending SMS costs money. We should be careful about bulk sending.
            
            console.log("CronService: Engagement check completed (Simulation).");
            
            // EXAMPLE: Send a status report to Admin
            // await sendSms({ 
            //    data: { 
            //        phone: '0743214479', 
            //        message: 'Daily Engagement Cron Ran. System is healthy.' 
            //    } 
            // });

        } catch (e) {
            console.error("CronService: Error running daily check", e);
        }
    });
};

module.exports = { initCron };
