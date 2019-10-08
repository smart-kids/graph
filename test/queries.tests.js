require("./mutations.test.js");

// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
var rimraf = require("rimraf");
import app from "../src/server";

// Configure chai
chai.use(chaiHttp);
chai.should();
var expect = chai.expect;

const sharedInfo = {};

describe("Setup For Queries", () => {
  before(function(done) {
    this.timeout(1000); // wait for db connections etc.

    setTimeout(done, 500);
  });

  describe("OPS", function() {
    // Test to get all students record
    it("Health check should return 200", done => {
      chai
        .request(app)
        .get("/health")
        .end((err, res) => {
          res.should.have.status(200);

          done();
        });
    });

    it("Graphql responds hello", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({ query: "{hello}" })
        .end((err, res) => {
          res.should.have.status(200);

          done();
        });
    });
  });

  describe("Graph", function() {
    // Test to get all students record
    it("Graphql responds fetching the whole tree", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `{
          students {
            id
            names,
            route{
              name
            }
            parent{
              name
            }
            parent2{
              name
            }
          }
          buses {
            plate
            make
            size
          },
          complaints{
            id
            time
            parent{
              id
            }
          }
          drivers {
            id,
            username,
            email,
            phone
            bus {
              id
              plate
              make
              size
            },
          },
          parents{
            id,
            name
            complaints{
              id,
              content
            }
            students{
              id
              names,
              events{
                type
                trip{
                  startedAt,
                  completedAt,
                  bus{
                    id,
                    make,
                    plate
                  },
                  driver{
                    username
                  }
                }
              }
            }
          }
          routes{
            id,
            name,
            description
            path{
              lat,
              lng
            }
          }
          schedules{
            id,
            time,
            name,
            days,
            route{
              id,
              name
            }
            bus{
              id,
              make,
              size
              plate
            }
            trips {
              startedAt,
              completedAt
              bus{
                id,
                make
              }
              driver{
                id
              }
              events{
                time,
                type,
                student{
                  id
                }
              }
            }
          }
        }`
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.errors).to.not.exist;

          const student = res.body.data.students[0];
          const bus = res.body.data.buses[0];
          const parent = res.body.data.parents[0];
          const route = res.body.data.routes[0];
          const driver = res.body.data.drivers[0];
          const schedule = res.body.data.schedules[0];
          const complaint = res.body.data.complaints[0];

          // students
          expect(student.id).to.be.a.string;
          expect(student.names).to.be.a.string;
          expect(student.parent2.id).to.be.a.string;

          // busses
          expect(bus.plate).to.be.a.string;
          expect(bus.size).to.be.a.string;

          // drivers
          expect(driver.username).to.be.a.string;
          expect(driver.email).to.be.a.string;
          expect(driver.phone).to.be.a.string;
          expect(driver.bus).to.exist;
          expect(driver.bus.id).to.be.a.string;
          expect(driver.bus.username).to.be.a.string;

          // parents
          expect(parent.name).to.be.a.string;
          expect(parent.id).to.be.a.string;
          expect(parent.students).to.be.instanceof(Array);
          expect(parent.students[0].names).to.be.a.string;

          expect(parent.students[0].events).to.be.instanceof(Array);

          expect(parent.complaints).to.be.instanceof(Array);
          expect(parent.complaints[0].id).to.be.a.string;

          // routes
          expect(route.id).to.be.a.string;
          expect(route.name).to.be.a.string;
          expect(route.description).to.be.a.string;

          // complaints
          
          expect(complaint.id).to.be.a.string;
          expect(complaint.content).to.be.a.string;
          expect(complaint.parent).to.exist;
          expect(complaint.parent.id).to.be.a.string;

          // schedules
          expect(schedule.id).to.be.a.string;
          expect(schedule.name).to.be.a.string;
          expect(schedule.time).to.be.a.string;
          expect(schedule.days).to.be.instanceof(Array);
          expect(schedule.route.name).to.be.a.string;
          expect(schedule.bus.make).to.be.a.string;

          // trips
          expect(schedule.trips).to.be.instanceof(Array);
          expect(schedule.trips[0].bus.id).to.be.a.string;
          expect(schedule.trips[0].driver.id).to.be.a.string;

          // trip events
          expect(schedule.trips[0].events).to.be.instanceof(Array);
          expect(schedule.trips[0].events[0].student).to.exist;
          expect(schedule.trips[0].events[0].student.id).to.be.a.string;

          done();
        });
    });
  });
});
