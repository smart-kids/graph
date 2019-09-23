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

rimraf(".tmp/localDiskDb/*", () => {
  console.log("  Cleared setup dir");
});

describe("Setup", () => {
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
});

describe("Admins", () => {
  it("Can create an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iadmin: Iadmin!) {
            admins {
              create(admin: $Iadmin) {
                id
              }
            }
          }            
        `,
        variables: {
          "Iadmin": {
            "username": "new admin",
            "email": "test",
            "password": "test"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.admins.create.id).to.be.a.string;

        sharedInfo.adminId = res.body.data.admins.create.id
        done();
      });
  });

  it("Can update an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($admin: Uadmin!) {
            admins {
              update(admin: $admin) {
                id
              }
            }
          }            
        `,
        variables: {
          "admin": {
            "id": sharedInfo.adminId,
            "username": "updated admin"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.admins.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iadmin: Uadmin!) {
            admins {
              archive(admin: $Iadmin) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iadmin": {
            "id": sharedInfo.adminId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.admins.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iadmin: Uadmin!) {
            admins {
              restore(admin: $Iadmin) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iadmin": {
            "id": sharedInfo.adminId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.admins.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          admins{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.admins[0].id).to.be.a.string;

        done();
      });
  });
})

describe("Routes", () => {
  it("Can create an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iroute: Iroute!) {
            routes {
              create(route: $Iroute) {
                id
              }
            }
          }            
        `,
        variables: {
          "Iroute": {
            "name": "marwa",
            "description": "marwa"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.routes.create.id).to.be.a.string;

        sharedInfo.routeId = res.body.data.routes.create.id
        done();
      });
  });

  it("Can update an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($route: Uroute!) {
            routes {
              update(route: $route) {
                id
              }
            }
          }            
        `,
        variables: {
          "route": {
            "id": sharedInfo.routeId,
            "name": "tested",
            "description": "descr"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.routes.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iroute: Uroute!) {
            routes {
              archive(route: $Iroute) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iroute": {
            "id": sharedInfo.routeId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.routes.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iroute: Uroute!) {
            routes {
              restore(route: $Iroute) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iroute": {
            "id": sharedInfo.routeId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.routes.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          routes{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.routes[0].id).to.be.a.string;

        done();
      });
  });
})

describe("Drivers", () => {
  it("Can create an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Idriver: Idriver!) {
            drivers {
              create(driver: $Idriver) {
                id
              }
            }
          }
      `,
        variables: {
          "Idriver": {
            "username": "marwa",
            "email": "test",
            "phone": "test",
            "password": "12345"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.drivers.create.id).to.be.a.string;

        sharedInfo.driverId = res.body.data.drivers.create.id
        done();
      });
  });

  it("Can update an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($driver: Udriver!) {
            drivers {
              update(driver: $driver) {
                id
              }
            }
          }            
        `,
        variables: {
          "driver": {
            "id": sharedInfo.driverId,
            "username": "marwaed",
            "email": "test",
            "phone": "test",
            "password": "12345"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.drivers.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Idriver: Udriver!) {
            drivers {
              archive(driver: $Idriver) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Idriver": {
            "id": sharedInfo.driverId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.drivers.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Idriver: Udriver!) {
            drivers {
              restore(driver: $Idriver) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Idriver": {
            "id": sharedInfo.driverId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.drivers.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          drivers{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.drivers[0].id).to.be.a.string;

        done();
      });
  });
})


describe("Busses", () => {
  it("Can create an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($Ibus: Ibus!) {
          buses {
            create(bus: $Ibus) {
              id
            }
          }
        }
        `,
        variables: {
          "Ibus": {
            "make": "marwa",
            "plate": "test",
            "size": 2,
            driver: sharedInfo.driverId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.buses.create.id).to.be.a.string;

        sharedInfo.busId = res.body.data.buses.create.id
        done();
      });
  });

  it("Can update an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($bus: Ubus!) {
            buses {
              update(bus: $bus) {
                id
              }
            }
          }            
        `,
        variables: {
          "bus": {
            "id": sharedInfo.busId,
            "make": "marwaed",
            "plate": "test",
            "size": 3
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.buses.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ibus: Ubus!) {
            buses {
              archive(bus: $Ibus) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ibus": {
            "id": sharedInfo.busId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.buses.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ibus: Ubus!) {
            buses {
              restore(bus: $Ibus) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ibus": {
            "id": sharedInfo.busId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.buss.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          buses{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.buses[0].id).to.be.a.string;

        done();
      });
  });
})

describe("Parent", () => {
  it("Can create an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iparent: Iparent!) {
            parents {
              create(parent: $Iparent) {
                id
              }
            }
          }
        `,
        variables: {
          "Iparent": {
            "name": "marwa",
            "phone": "test",
            "email": "FEMALE",
            "gender": "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.create.id).to.be.a.string;

        sharedInfo.parentId = res.body.data.parents.create.id
        done();
      });
  });

  it("Create second parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iparent: Iparent!) {
            parents {
              create(parent: $Iparent) {
                id
              }
            }
          }
        `,
        variables: {
          "Iparent": {
            "name": "marwa 2",
            "phone": "test",
            "email": "FEMALE",
            "gender": "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.create.id).to.be.a.string;

        sharedInfo.parent2Id = res.body.data.parents.create.id
        done();
      });
  });

  it("Can update an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($parent: Uparent!) {
          parents {
            update(parent: $parent) {
              id
            }
          }
        }
      `,
        variables: {
          "parent": {
            "id": sharedInfo.parentId,
            "name": "marwaed",
            "phone": "test",
            "email": "email@email.com",
            "gender": "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iparent: Uparent!) {
            parents {
              archive(parent: $Iparent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iparent": {
            "id": sharedInfo.parentId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iparent: Uparent!) {
            parents {
              restore(parent: $Iparent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Iparent": {
            "id": sharedInfo.parentId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.parents.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          parents{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents[0].id).to.be.a.string;

        done();
      });
  });
})


describe("Students", () => {
  it("Can create an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Istudent: Istudent!) {
            students {
              create(student: $Istudent) {
                id
              }
            }
          }
        `,
        variables: {
          "Istudent": {
            "names": "marwa",
            "route": sharedInfo.routeId,
            "gender": "FEMALE",
            registration: "1234",
            "parent": sharedInfo.parentId,
            "parent2": sharedInfo.parent2Id
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.students.create.id).to.be.a.string;

        sharedInfo.studentId = res.body.data.students.create.id
        done();
      });
  });

  it("Can update an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($student: Ustudent!) {
          students {
            update(student: $student) {
              id
            }
          }
        }                 
        `,
        variables: {
          "student": {
            "id": sharedInfo.studentId,
            "names": "marwa",
            "route": sharedInfo.routeId,
            "gender": "MALE",
            "parent": "test"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.students.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Istudent: Ustudent!) {
            students {
              archive(student: $Istudent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Istudent": {
            "id": sharedInfo.studentId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.students.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Istudent: Ustudent!) {
            students {
              restore(student: $Istudent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Istudent": {
            "id": sharedInfo.studentId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.students.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          students{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.students[0].id).to.be.a.string;

        done();
      });
  });
})


describe("Schedule", () => {
  it("Can create an schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ischedule: Ischedule!) {
            schedules {
              create(schedule: $Ischedule) {
                id
              }
            }
          }            
        `,
        variables: {
          "Ischedule": {
            "name": "schedule 1",
            time: new Date().toLocaleTimeString(),
            route: sharedInfo.routeId,
            days: "MONDAY,TEUSDAY",
            bus: sharedInfo.busId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schedules.create.id).to.be.a.string;

        sharedInfo.scheduleId = res.body.data.schedules.create.id
        done();
      });
  });

  it("Can update an schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($schedule: Uschedule!) {
            schedules {
              update(schedule: $schedule) {
                id
              }
            }
          }            
        `,
        variables: {
          "schedule": {
            "id": sharedInfo.scheduleId,
            "name": "Schedule 1 edited"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schedules.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ischedule: Uschedule!) {
            schedules {
              archive(schedule: $Ischedule) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ischedule": {
            "id": sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schedules.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ischedule: Uschedule!) {
            schedules {
              restore(schedule: $Ischedule) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ischedule": {
            "id": sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.schedules.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          schedules{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schedules[0].id).to.be.a.string;

        done();
      });
  });
})

describe("Event", () => {
  it("Can create an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ievent: Ievent!) {
            events {
              create(event: $Ievent) {
                id
              }
            }
          }            
        `,
        variables: {
          "Ievent": {
            "student": sharedInfo.studentId,
            time: new Date().toLocaleTimeString(),
            type: "CHECKEDOFF",
            trip: sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.events.create.id).to.be.a.string;

        sharedInfo.eventId = res.body.data.events.create.id
        done();
      });
  });

  it("Can update an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($event: Uevent!) {
            events {
              update(event: $event) {
                id
              }
            }
          }            
        `,
        variables: {
          "event": {
            "id": sharedInfo.eventId,
            time: new Date().toLocaleTimeString(),
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.events.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ievent: Uevent!) {
            events {
              archive(event: $Ievent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ievent": {
            "id": sharedInfo.eventId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.events.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ievent: Uevent!) {
            events {
              restore(event: $Ievent) {
                id
              }
            }
          }                  
        `,
        variables: {
          "Ievent": {
            "id": sharedInfo.eventId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.events.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("content-type", "application/json")
      .send({
        query: `
        {
          events{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.events[0].id).to.be.a.string;

        done();
      });
  });
})
