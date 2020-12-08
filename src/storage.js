import Waterline from "waterline"
import DiskAdapter from "sails-disk";
import MongoAdapter from "sails-mongo";
import PostgresAdapter from "sails-postgresql"

import admins from "./graphql/resolvers/Mutation/admins/model";
import routes from "./graphql/resolvers/Mutation/routes/model";
import drivers from "./graphql/resolvers/Mutation/drivers/model";
import buses from "./graphql/resolvers/Mutation/buses/model";
import students from "./graphql/resolvers/Mutation/students/model";
import parents from "./graphql/resolvers/Mutation/parents/model";
import schedule from "./graphql/resolvers/Mutation/schedules/model";
import event from "./graphql/resolvers/Mutation/event/model";
import trip from "./graphql/resolvers/Mutation/trip/model";
import complaint from "./graphql/resolvers/Mutation/complaints/model"
import locReport from "./graphql/resolvers/Mutation/location-reports/model"
import classModel from "./graphql/resolvers/Mutation/classes/model"
import school from "./graphql/resolvers/Mutation/school/model"
import teacher from "./graphql/resolvers/Mutation/teachers/model"
import OTP from "./graphql/resolvers/Mutation/OTP/model"
import payments from "./graphql/resolvers/Mutation/payments/model"
import charges from "./graphql/resolvers/Mutation/charges/model"
import grades from "./graphql/resolvers/Mutation/grades/model"
import subjects from "./graphql/resolvers/Mutation/subjects/model"
import topics from "./graphql/resolvers/Mutation/topics/model"
import subtopics from "./graphql/resolvers/Mutation/subtopics/model"
import questions from "./graphql/resolvers/Mutation/questions/model"
import answers from "./graphql/resolvers/Mutation/answers/model"

const { NODE_ENV, DB_URL = 'db url here' } = process.env;

console.log({
    NODE_ENV,
    DB_URL,
    storage: !['development', "test"].includes(NODE_ENV)
        ? "mongo"
        : "disk"
})

var waterline = new Waterline();

waterline.registerModel(admins);
waterline.registerModel(routes);
waterline.registerModel(drivers);
waterline.registerModel(buses);
waterline.registerModel(students);
waterline.registerModel(parents);
waterline.registerModel(schedule);
waterline.registerModel(event);
waterline.registerModel(trip);
waterline.registerModel(complaint);
waterline.registerModel(locReport)
waterline.registerModel(classModel)
waterline.registerModel(school)
waterline.registerModel(teacher)
waterline.registerModel(payments)
waterline.registerModel(charges)
waterline.registerModel(grades)
waterline.registerModel(subjects)
waterline.registerModel(topics)
waterline.registerModel(subtopics)
waterline.registerModel(questions)
waterline.registerModel(answers)
waterline.registerModel(OTP)

var config = {
    adapters: {
        mongo: MongoAdapter,
        disk: DiskAdapter,
    },
    datastores: {
        default: !['development', "test"].includes(NODE_ENV) ? {
            adapter: 'mongo',
            url: DB_URL
        } : {
                adapter: "disk",
                // filePath: '/tmp'
            }
    }
};

export default new Promise((resolve, reject) => {
    waterline.initialize(config, (err, db) => {
        if (err) {
            console.log(err)
            reject(err)
        }

        resolve(db)
    });
})