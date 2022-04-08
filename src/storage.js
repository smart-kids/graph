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
import options from "./graphql/resolvers/Mutation/options/model"
import terms from "./graphql/resolvers/Mutation/terms/model"
import teams from "./graphql/resolvers/Mutation/teams/model"
import team_members from "./graphql/resolvers/Mutation/team_members/model"
import invitations from "./graphql/resolvers/Mutation/invitations/model"
import users from "./graphql/resolvers/Mutation/users/model"
import roles from "./graphql/resolvers/Mutation/roles/model"
import user_roles from "./graphql/resolvers/Mutation/user_roles/model"
import google_users from "./graphql/resolvers/Mutation/google_users/model"
import school_creators from "./graphql/resolvers/Mutation/school_creators/model"

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
waterline.registerModel(options)
waterline.registerModel(terms)
waterline.registerModel(teams)
waterline.registerModel(team_members)
waterline.registerModel(invitations)
waterline.registerModel(OTP)
waterline.registerModel(users)
waterline.registerModel(roles)
waterline.registerModel(user_roles)
waterline.registerModel(google_users)
waterline.registerModel(school_creators)

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