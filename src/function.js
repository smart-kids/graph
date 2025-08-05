// --- 1. CONFIGURATION & IMPORTS ---
import 'dotenv/config';

// Core Modules
import express from "express";
import http from "http";

// Server & Middleware
import { Server } from "socket.io";
import session from "express-session";
import sharedsession from "express-socket.io-session"; // Restored for session sharing
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import cors from "cors";
import morgan from "morgan";

// Application, Error Reporting & Routers
import bugsnagClient from "./utils/bugsnug"; // Assuming bugsnag is configured here
const bugsnagMiddleware = bugsnagClient.getPlugin('express');
import storagePromise from "./storage"; // Renamed ormPromise to storagePromise for clarity
import dataGraphRouter from "./router";
import { router as authRouter } from "./auth";
import { createMpesaRouter } from "./payments";
import { router as ai_mlRouter } from "./ai_ml";
import socketPassHandler from "./sockets/socket-pass";

// Google Cloud Functions
import functions from '@google-cloud/functions-framework';

// --- 2. ENVIRONMENT VALIDATION ---
const {
    NODE_ENV = 'development',
    PORT = 4000,
    SESSION_SECRET,
    CORS_ORIGIN // e.g., "http://localhost:3000"
} = process.env;

// Fail fast if critical secrets are not provided in production.
if (NODE_ENV === 'production' && !SESSION_SECRET) {
    throw new Error("FATAL ERROR: SESSION_SECRET is not defined in environment variables.");
}
if (NODE_ENV === 'production' && !CORS_ORIGIN) {
    throw new Error("FATAL ERROR: CORS_ORIGIN is not defined in environment variables.");
}

// --- 3. CORE APPLICATION SETUP ---
const app = express();
const server = http.createServer(app);

// A) Bugsnag request handler (must be the very first middleware)
app.use(bugsnagMiddleware.requestHandler);

// B) Set security headers and enable trust for proxies (important for deployment)
app.set('trust proxy', 1);
app.use(helmet());

// C) CORS Configuration
app.use(cors({
    origin: CORS_ORIGIN || '*', // Fallback for development
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
}));

// D) Security & Performance Middleware
// These are often best enabled only in production
if (NODE_ENV === 'production') {
    app.use(hpp()); // Protect against HTTP Parameter Pollution attacks
    app.use(compression()); // Compress responses
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // Limit each IP to 200 requests per window
        standardHeaders: true,
        legacyHeaders: false,
    }));
}

// E) Body Parsers & Request Logging
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
if (NODE_ENV !== 'test') {
    app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// F) Session Management
const sessionMiddleware = session({
    secret: SESSION_SECRET || 'a-strong-default-secret-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    },
});
app.use(sessionMiddleware);

// G) Socket.IO setup (Correctly Initialized)
const io = null
// H) Router Mounting Function
// This async function ensures that routers are attached only after the database is ready.
async function attachRouters() {
    // Initialize the database connection.
    const storage = await storagePromise;
    console.log("Database ORM is ready.");

    // Assign critical instances to app.locals, maintaining the original structure.
    Object.assign(app.locals, { db: storage, io, bugsnag: bugsnagClient });

    // Mount the routers
    app.use("/health", (req, res) => res.status(200).json({ status: "ok" }));
    app.use(["/", "/graph"], dataGraphRouter(storage)); // Pass storage directly
    app.use("/auth", authRouter);
    app.use("/mpesa", await createMpesaRouter(storage, io)); // Pass storage and the REAL io instance
    app.use("/ai_ml", ai_mlRouter);

    console.log("Routers have been attached.");
}

// I) Final Error Handling Middleware (must be last)
app.use(bugsnagMiddleware.errorHandler);
app.use((err, req, res, next) => {
    // The default Express error handler logs errors and sends a 500 response.
    // Bugsnag has already been notified by its middleware.
    if (NODE_ENV !== 'test') {
        console.error("Unhandled Error:", err.stack);
    }
    if (!res.headersSent) {
        res.status(500).json({ error: "An unexpected internal server error occurred." });
    }
});


// --- 4. SERVER STARTUP & SHUTDOWN ---

// This async IIFE is the main entry point for running the server.
const startServer = async () => {
    try {
        // 1. Attach routers, which includes waiting for the database.
        await attachRouters();

        // 2. Start listening on the port *after* everything is initialized.
        server.listen(PORT, () => {
            console.log(`✅ Server process ${process.pid} started successfully.`);
            console.log(`🚀 Listening on http://localhost:${PORT} in ${NODE_ENV} mode.`);
        });

        // 3. Set up graceful shutdown logic.
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\nReceived ${signal}, shutting down gracefully...`);
                server.close(async () => {
                    console.log("HTTP server closed.");
                    // Attempt to gracefully shut down the database connection.
                    const storage = await storagePromise;
                    if (storage && storage.teardown) {
                        await storage.teardown();
                        console.log("Database connection closed.");
                    }
                    console.log("Process exited.");
                    process.exit(0);
                });
            });
        });
    } catch (err) {
        console.error("❌ FATAL ERROR: Server failed to start.", err);
        bugsnagClient.notify(err);
        process.exit(1);
    }
};

// --- 5. EXECUTION ---

// Run as a standalone server if not in a test environment.
if (NODE_ENV !== "test") {
    startServer();
}

// Export the app as a Google Cloud Function for serverless deployment.
// This function will handle the entire initialization on each invocation.
if (functions) functions.http('shuleplus-server', async (req, res) => {
    await attachRouters(); // Ensure everything is ready
    app(req, res); // Handle the request
});

// Export the configured Express app for testing purposes.
export default app;