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
let authorization = null;

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

    it("Graphql fails hello withour auth", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({ query: "{hello}" })
        .end((err, res) => {
          res.should.have.status(400);

          done();
        });
    });
  });

  describe("Auth", function () {
    describe("Parent", function () {
      // it("Fetch Auth Code", done => {
      //   chai
      //     .request(app)
      //     .post("/auth/login")
      //     .set("content-type", "application/json")
      //     .send({
      //       "user": "0000000000",
      //     })
      //     .end((err, res) => {
      //       res.should.have.status(200);

      //       done();
      //     });
      // });
      // confirm code


      // TODO: confirm codes tests disabled for now
      // it("Confirm Auth Code", done => {


      it("Get Super Auth Code", done => {
        chai
          .request(app)
          .post("/auth/super")
          .set("content-type", "application/json")
          .send({
            "user": "sAdmin",
            "password": "00000"
          })
          .end((err, res) => {
            res.should.have.status(200);

            sharedInfo.auth = res.body
            authorization = sharedInfo.auth.token

            done();
          });
      });

      it("Test token using hello", done => {
        chai
          .request(app)
          .post("/graph")
          .set("authorization", authorization)
          .set("content-type", "application/json")
          .send({ query: "{hello}" })
          .end((err, res) => {
            res.should.have.status(200);

            done();
          });
      });
    })


    // login driver
    describe("Driver", function () {
      it("Fetch Auth Code", done => {
        chai
          .request(app)
          .post("/auth/login")
          .set("content-type", "application/json")
          .send({
            "user": "0711111111",
          })
          .end((err, res) => {
            res.should.have.status(200);

            done();
          });
      });
      // confirm code
      it("Confirm Auth Code", done => {
        chai
          .request(app)
          .post("/auth/verify/sms")
          .set("content-type", "application/json")
          .send({
            "user": "0711111111",
            "password": "0000"
          })
          .end((err, res) => {
            res.should.have.status(200);

            sharedInfo.auth = res.body
            authorization = sharedInfo.auth.token

            done();
          });
      });

      it("Test using hello", done => {
        chai
          .request(app)
          .post("/graph")
          .set("authorization", authorization)
          .set("content-type", "application/json")
          .send({ query: "{hello}" })
          .end((err, res) => {
            res.should.have.status(200);

            done();
          });
      });
    })

    describe("Admin", function () {
      it("super admin should return token based on env var", done => {
        chai
          .request(app)
          .post("/auth/super")
          .set("content-type", "application/json")
          .send({
            "user": "sAdmin",
            "password": "00000"
          })
          .end((err, res) => {
            res.should.have.status(200);

            sharedInfo.auth = res.body
            authorization = sharedInfo.auth.token

            done();
          });
      });

      it("Fetch Auth Code from super login again rather than normal (FIX THIS!)", done => {
        chai
          .request(app)
          .post("/auth/super")
          .set("content-type", "application/json")
          .send({
            "user": "sAdmin",
            "password": "00000"
          })
          .end((err, res) => {
            res.should.have.status(200);

            sharedInfo.auth = res.body
            authorization = sharedInfo.auth.token

            done();
          });
      });
      // confirm code
      it("Test using hello", done => {
        chai
          .request(app)
          .post("/graph")
          .set("authorization", authorization)
          .set("content-type", "application/json")
          .send({ query: "{hello}" })
          .end((err, res) => {
            res.should.have.status(200);

            done();
          });
      });
    })
  })

  describe("Graph", function () {
    // login parent


    // confirm code

    // Test to get all students record
    it("Graphql responds fetching the whole tree", done => {
      chai
        .request(app)
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: `
          {
            schools {
              id,
              name,
              terms {
                id
                name
              }
              grades {
                id
                name
                subjects {
                  id
                  name
                  topics {
                    id
                    name
                    subtopics {
                      id
                      name
                      questions {
                        id
                        name
                        type
                        answers {
                          id
                          value
                        }
                        options {
                          id
                          value
                        }
                      }
                    }
                  }
                }
              }
              complaints {
                id
                time
                content
                parent {
                  id
                  name
                }
              }
              students {
                id
                names
                gender
                registration
                class {
                  name
                  teacher {
                    name
                  }
                }
                route {
                  id
                  name
                }
                parent {
                  id
                  national_id
                  name
                }
                parent2 {
                  id
                  national_id
                  name
                }
              }
              buses {
                id
                plate
                make
                size
                driver {
                  username
                }
              }
              drivers {
                id
                username
                email
                phone
                license_expiry
                licence_number
                home
                bus {
                  id
                  plate
                  make
                  size
                  driver {
                    username
                  }
                }
              }
              parents {
                id
                national_id
                name
                complaints {
                  id
                  content
                }
                gender
                email
                phone
                students {
                  names
                  id
                  gender
                  route {
                    name
                  }
                  events {
                    type
                    trip {
                      startedAt
                      completedAt
                      bus {
                        id
                        make
                        plate
                      }
                      driver {
                        username
                      }
                      locReports {
                        id
                        time
                        loc {
                          lat
                          lng
                        }
                      }
                    }
                  }
                }
              }
              teachers {
                id
                national_id
                name
                gender
                phone
                email
                classes {
                  name
                }
              }
              classes {
                id
                name
                students {
                  names
                  gender
                  route {
                    name
                  }
                }
                teacher {
                  id
                  name
                }
              }
              routes {
                id
                name
                description
                path {
                  lat
                  lng
                }
              }
              schedules {
                id
                time
                end_time
                name
                days
                route {
                  id
                  name
                }
                bus {
                  id
                  make
                }
                trips {
                  startedAt
                  completedAt
                  bus {
                    id
                    make
                  }
                  driver {
                    id
                  }
                  locReports {
                    id
                    time
                    loc {
                      lat
                      lng
                    }
                  }
                  events {
                    time
                    type
                    student {
                      id
                    }
                  }
                }
              }
              complaints {
                id
                time
                parent {
                  id
                }
              }
              trips {
                id
                driver {
                  id
                  username
                }
                schedule {
                  name
                  id
                  time
                  end_time
                  route {
                    id
                    name
                    students {
                      id
                    }
                  }
                }
                events {
                  time
                  type
                  student {
                    id
                  }
                }
                startedAt
                isCancelled
                completedAt
                bus {
                  id
                  make
                  plate
                }
                driver {
                  id
                  username
                }
                locReports {
                  id
                  time
                  loc {
                    lat
                    lng
                  }
                }
                events {
                  time
                  type
                  student {
                    id
                    names
                  }
                }
              }
            }
          }        
          `
        })
        .end((err, res) => {
          res.should.have.status(200);

          res.body.errors ? console.log(res.body.errors) : null
          expect(res.body.errors).to.not.exist;

          const school = res.body.data.schools[0]

          const student = school.students[0];
          const bus = school.buses[0];

          const parent = school.parents[1];
          const route = school.routes[0];
          const driver = school.drivers[0];
          const teacher = school.teachers[0];
          const class1 = school.classes[0];
          const schedule = school.schedules[0];
          const complaint = school.complaints[0];
          const grade = school.grades[0];
          const subject = grade.subjects[0];
          const topic = subject.topics[0];
          const subtopic = topic.subtopics[0];
          const question = subtopic.questions[0];
          const answer = question.answers[0];
          const option = question.options[0];
          const term = school.terms[0];

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

          // trip locReports
          expect(schedule.trips[0].locReports).to.be.instanceof(Array);
          expect(schedule.trips[0].locReports[0].id).to.be.a.string;
          expect(schedule.trips[0].locReports[0].time).to.be.a.string;
          expect(schedule.trips[0].locReports[0].loc).to.exist;
          expect(schedule.trips[0].locReports[0].loc.lat).to.be.a.string;
          expect(schedule.trips[0].locReports[0].loc.lng).to.be.a.string;

          // teachers
          expect(teacher.id).to.be.a.string;
          expect(teacher.national_id).to.be.a.string;
          expect(teacher.name).to.be.a.string;
          expect(teacher.phone).to.be.a.string;
          expect(teacher.email).to.be.a.string;
          expect(teacher.gender).to.be.a.string;

          // classes
          expect(class1.id).to.be.a.string;
          expect(class1.name).to.be.a.string;

          // grades
          expect(grade.id).to.be.a.string;
          expect(school.grades).to.be.instanceof(Array);

          // subjects
          expect(subject.id).to.be.a.string;
          expect(grade.subjects).to.be.instanceof(Array);

          // topics
          expect(topic.id).to.be.a.string;
          expect(subject.topics).to.be.instanceof(Array);

          // subtopics
          expect(subtopic.id).to.be.a.string;
          expect(topic.subtopics).to.be.instanceof(Array);

          // questions
          expect(question.id).to.be.a.string;
          expect(question.name).to.be.a.string;
          expect(question.answer).to.be.a.string;
          expect(question.type).to.be.a.string;
          expect(subtopic.questions).to.be.instanceof(Array);

          // answers
          expect(answer.id).to.be.a.string;
          expect(answer.value).to.be.a.string;
          expect(question.answers).to.be.instanceof(Array);

          // options
          expect(option.id).to.be.a.string;
          expect(option.value).to.be.a.string;
          expect(question.options).to.be.instanceof(Array);

          // terms
          expect(term.id).to.be.a.string;
          expect(term.name).to.be.a.string;
          expect(school.terms).to.be.instanceof(Array);

          done();
        });
    });
  });
});
