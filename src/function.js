// index.js

// --- 1. CONFIGURATION & IMPORTS ---
// Load environment variables for local development.
import 'dotenv/config';

// Core Node.js & Express Modules
import express from "express";
import http from "http";
import cluster from "cluster";
import os from "os";

// Server & Middleware
import { Server } from "socket.io";
import session from "express-session";
import sharedsession from "express-socket.io-session";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import morgan from "morgan";

// Bugsnag & Error Reporting
import bugsnagClient from "./utils/bugsnug";
const bugsnagMiddleware = bugsnagClient.getPlugin('express');

// Application-Specific Imports
// Importing the Waterline ORM promise from your storage file.
import ormPromise from "./storage";
import dataGraphRouter from "./router";
import { router as authRouter } from "./auth";
import { createMpesaRouter } from "./payments";
import { router as ai_mlRouter } from "./ai_ml";
import socketPassHandler from "./sockets/socket-pass";

// --- 2. ENVIRONMENT & CONSTANTS VALIDATION ---
const {
    NODE_ENV = 'development',
    PORT = 4000,
    SESSION_SECRET,
    CORS_ORIGIN,
    APP_VERSION = '1.0.0'
} = process.env;

// Fail fast if critical configuration is missing.
if ((NODE_ENV === 'production' || NODE_ENV === 'development') && !SESSION_SECRET) {
    throw new Error("FATAL ERROR: SESSION_SECRET is not defined in environment variables.");
}

// --- 3. CORE APP FACTORY ---
// This function builds the complete Express app but does NOT start a server.
async function createApp(server, orm) {
    const app = express();

    // A) Bugsnag request handler (must be first)
    app.use(bugsnagMiddleware.requestHandler);

    // B) **FIXED**: Robust CORS Configuration to handle preflight requests
    // This solves the 'OPTIONS /graph HTTP/1.1" 400' error from your logs.
    app.use(cors({
        origin: CORS_ORIGIN,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow all methods your frontend might use
        allowedHeaders: ["Content-Type", "Authorization"], // Allow standard headers
        credentials: true,
        optionsSuccessStatus: 204 // Important for preflight requests
    }));

    // C) Core security middleware
    if (NODE_ENV === 'production') {
        app.use(helmet());
        app.use(hpp());
    }
    app.use(mongoSanitize());

    // D) Performance & Rate Limiting
    if (NODE_ENV === 'production') {
        app.use(compression());
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false,
        });
        app.use(limiter);
    }

    // E) Body parsers and request logging
    app.use(express.json({ limit: "500kb" }));
    app.use(express.urlencoded({ extended: true, limit: '500kb' }));
    if (NODE_ENV === 'production') app.use(morgan('combined'));
    if (NODE_ENV === 'development') app.use(morgan('dev'));

    // F) **IMPORTANT**: Session management using the default MemoryStore as requested.
    // #######################################################################################
    // ### WARNING: MemoryStore will not work correctly in a clustered environment.        ###
    // ### Each of your 12 workers will have its own separate session memory.              ###
    // ### This means user sessions will be lost when their requests hit different workers.  ###
    // ### A shared store like Redis (connect-redis) is required for production scaling.   ###
    // #######################################################################################
    const sessionMiddleware = session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: NODE_ENV === 'production', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    });
    app.use(sessionMiddleware);

    // G) Socket.IO setup
    let io;
    // if (server) {
    //     io = new Server(server, { cors: { origin: CORS_ORIGIN } });
    //     io.use(sharedsession(sessionMiddleware, { autoSave: true }));
    //     io.on("connection", socketPassHandler);
    // }

    // H) Application state and routing using the initialized Waterline ORM
    Object.assign(app.locals, { db: orm.collections, io, bugsnag: bugsnagClient });

    app.use(["/", "/graph"], dataGraphRouter(orm));
    app.use("/auth", authRouter);
    app.use("/mpesa", await createMpesaRouter(orm, io));
    app.use("/ai_ml", ai_mlRouter);
    app.use("/health", (req, res) => res.json({
        status: "ok", mode: NODE_ENV, version: APP_VERSION, pid: process.pid
    }));

    // I) Final error handling middleware
    app.use(bugsnagMiddleware.errorHandler);
    app.use((err, req, res, next) => {
        if (NODE_ENV !== 'test') console.error(err.stack);
        if (!res.headersSent) res.status(500).json({ error: "An unexpected internal server error occurred." });
    });

    return app;
}


// --- 4. MODE-BASED EXECUTION LOGIC ---

// PRIMARY DEPLOYMENT MODE: Production as a clustered Node.js application
if (cluster.isPrimary && NODE_ENV === 'production') {
    const numCPUs = os.cpus().length;
    console.log(`[Primary] ${process.pid} is running in production.`);
    console.log(`[Primary] Forking server for ${numCPUs} CPUs...`);

    // Remove debugging flags before forking workers to prevent port conflicts.
    const debugArgRegex = /--inspect(?:-brk)?(?:=\S+)?/;
    cluster.setupPrimary({ execArgv: process.execArgv.filter(arg => !debugArgRegex.test(arg)) });

    for (let i = 0; i < numCPUs; i++) cluster.fork();

    cluster.on("exit", (worker, code, signal) => {
        console.error(`[Primary] Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}.`);
        bugsnagClient.notify(new Error(`Worker ${worker.process.pid} died unexpectedly.`));
        console.log("[Primary] Starting a new worker...");
        cluster.fork();
    });

    // DEVELOPMENT or PRODUCTION WORKER: The code that actually runs the server
} else if (NODE_ENV === 'development' || NODE_ENV === 'production') {
    // This self-invoking async function encapsulates the worker's startup logic.
    (async () => {
        try {
            // 1. Initialize Waterline ORM by awaiting the promise from storage.js
            const orm = await ormPromise;
            console.log(`[Worker ${process.pid}] Waterline ORM ready.`);

            // 2. Create the HTTP server and Express App
            const server = http.createServer();
            const app = await createApp(server, orm); // Pass dependencies to the factory
            server.on('request', app);

            // 3. Start listening for requests
            server.listen(PORT, () => {
                console.log(`🚀 Worker ${process.pid} started. Server running in ${NODE_ENV} mode on port ${PORT}`);
            });

            // 4. Graceful shutdown logic
            const signals = ['SIGINT', 'SIGTERM'];
            signals.forEach(signal => {
                process.on(signal, () => {
                    console.log(`\n[Worker ${process.pid}] Received ${signal}, shutting down...`);
                    server.close(async () => {
                        console.log(`[Worker ${process.pid}] HTTP server closed.`);
                        // Gracefully shut down Waterline DB connections.
                        await orm.teardown();
                        console.log(`[Worker ${process.pid}] Process has shut down.`);
                        process.exit(0);
                    });
                });
            });

        } catch (err) {
            console.error(`[Worker ${process.pid}] Fatal error during server startup:`, err);
            bugsnagClient.notify(err);
            process.exit(1);
        }
    })();

    // OTHER MODES (Test, Serverless)
} else {
    if (NODE_ENV === 'test') {
        console.log("Running in 'test' mode. App factory is available for import.");
    }
}

// Default export provides the createApp factory for test runners.
export default createApp;