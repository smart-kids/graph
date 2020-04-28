import express from "express"

import dataGraphRouter from "./index"
import { router } from "./auth"
import storage from "./storage"

import morgan from "morgan";

import cors from "cors"

const { NODE_ENV, PORT = 3000 } = process.env;

var app = express()

if (NODE_ENV !== "test") app.use(morgan("tiny"), cors());

const attatchRouter = async () => {
    const db = await storage

    Object.assign(app.locals, { db })
    app.use("/auth", router)
    app.use("/health", (req, res)=> res.send("OK"))
    app.use("/", dataGraphRouter)

    app.use("*", (req, res)=> res.send(`
        that url doesnt have a home here, are you lost? 

        <a url="/">go home </a>
    `))
}

attatchRouter()

if (NODE_ENV !== "test")
    app.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

export default app;
