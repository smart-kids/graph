require("./mutations.test.js")

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
  before(function (done) {
    this.timeout(1000); // wait for db connections etc.

    setTimeout(done, 500);
  });

  describe("OPS", function () {
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

  describe("Graph", function () {
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
          }
          buses {
            plate
            make
            size
          },
          drivers {
            id,
            username,
            email,
            phone
          },
          parents{
            id,
            name
          }
          routes{
            id,
            path{
              lat,
              lng
            }
          }
          schedules{
            id,
            time,
            route{
              id,
              name
            }
          }
        }` })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.errors).to.not.exist;

          const student = res.body.data.students[0]
          const bus = res.body.data.buses[0]
          const parent = res.body.data.parents[0]
          const route = res.body.data.routes[0]
          const driver = res.body.data.drivers[0]
          const schedule = res.body.data.schedules[0]


          // students
          expect(student.id).to.be.a.string;
          expect(student.names).to.be.a.string;
          expect(student.parent.name).to.be.a.string;
          expect(student.parent.id).to.be.a.string;

          // busses
          expect(bus.plate).to.be.a.string;
          expect(bus.size).to.be.a.string;

          // drivers
          expect(driver.username).to.be.a.string;
          expect(driver.email).to.be.a.string;
          expect(driver.phone).to.be.a.string;

          // parents
          expect(parent.name).to.be.a.string;
          expect(parent.id).to.be.a.string;

          // routes
          expect(route.id).to.be.a.string;
          expect(route.name).to.be.a.string;

          // schedules
          expect(schedule.id).to.be.a.string;
          expect(schedule.name).to.be.a.string;
          expect(schedule.time).to.be.a.string;
          expect(schedule.route.name).to.be.a.string;

          done();
        });
    });
  });
});
