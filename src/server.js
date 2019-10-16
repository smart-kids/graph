import express from "express"

import graphRouter from "./index"
import { router } from "./auth"
import storage from "./storage"

const { NODE_ENV, PORT = 3000 } = process.env;

var app = express()

const attatchRouter = async () => {
    const db = await storage

    Object.assign(app.locals, { db })
    app.use("/auth", router)
    app.use("/", graphRouter)
}

attatchRouter()

if (NODE_ENV !== "test")
    app.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

export default app;
