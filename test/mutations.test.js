// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
var rimraf = require("rimraf");
import moment from "moment";
import app from "../src/server";

// Configure chai
chai.use(chaiHttp);
chai.should();
var expect = chai.expect;

const sharedInfo = {};
let authorization = null

rimraf(".tmp/localDiskDb/*", () => {
  console.log("  Cleared setup dir");
});

describe("Setup", () => {
  before(function (done) {
    this.timeout(4000); // wait for db connections etc.

    setTimeout(done, 4000);
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
  });
});

describe("Super Auth", () => {
  before(function (done) {
    this.timeout(4000); // wait for db connections etc.

    setTimeout(done, 4000);
  });

  describe("Auth", function () {
    // Test to get all students record
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

    it("Graphql responds hello", done => {
      chai
        .request(app)
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: `{
            hello
          }` })
        .end((err, res) => {
          res.should.have.status(200);

          done();
        });
    });
  });
});

describe("Schools", () => {
  it("Can create a school", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($school: ISchool!) {
            schools {
              create(school: $school) {
                id
              }
            }
          }            
        `,
        variables: {
          school: {
            name: "School Name",
            phone: "0711111111",
            email: "mail@domain.com",
            address: "PO Box 1234-00000 Someplace somewhere",
            inviteSmsText: 'Welcome to {shool_name} Shileplus panel. visit https://www.shuleplus.co.ke/{school_name} to join',
            gradeOrder: ['One', 'Two', 'Three', 'Five'],
            termOrder: ['One', 'Two'],
          }
        }
      })
      .end((err, res) => {
        console.log(res.body.errors)
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schools.create.id).to.be.a.string;

        sharedInfo.school = res.body.data.schools.create.id;
        done();
      });
  });

  it("Can update a school", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($school: USchool!) {
            schools {
              update(school: $school) {
                id
              }
            }
          }            
        `,
        variables: {
          school: {
            id: sharedInfo.school,
            name: "New School",
            gradeOrder: ['One', 'Two', 'Three', 'Five', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'],
            termOrder: ['One', 'Two', 'Three']
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schools.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a school", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($school: USchool!) {
            schools {
              archive(school: $school) {
                id
              }
            }
          }                  
        `,
        variables: {
          school: {
            id: sharedInfo.school
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schools.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a school", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($school: USchool!) {
            schools {
              restore(school: $school) {
                id
              }
            }
          }                  
        `,
        variables: {
          school: {
            id: sharedInfo.school
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored school", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          school{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Admins", () => {
  it("Can create an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Iadmin: {
            username: "admin1",
            email: "test",
            phone: "0711657108",
            password: "test",
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.admins.create.id).to.be.a.string;

        sharedInfo.adminId = res.body.data.admins.create.id;
        done();
      });
  });

  it("Can update an admin", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          admin: {
            id: sharedInfo.adminId,
            username: "updated admin"
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
      .set("authorization", authorization)
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
          Iadmin: {
            id: sharedInfo.adminId
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
      .set("authorization", authorization)
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
          Iadmin: {
            id: sharedInfo.adminId
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
      .set("authorization", authorization)
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
});

describe("Teacher", () => {
  it("Can create a teacher", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteacher: Iteacher!) {
            teachers {
              create(teacher: $Iteacher) {
                id
              }
            }
          }
        `,
        variables: {
          Iteacher: {
            name: "teacher1",
            national_id: "35718850",
            school: sharedInfo.school,
            phone: "0722222222",
            email: "teacher1@gmail.com",
            gender: "MALE",
            password: '1234567890'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teachers.create.id).to.be.a.string;

        sharedInfo.teacherId = res.body.data.teachers.create.id;
        done();
      });
  });

  it("Can update a teacher", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($teacher: Uteacher!) {
          teachers {
            update(teacher: $teacher) {
              id
            }
          }
        }
      `,
        variables: {
          teacher: {
            id: sharedInfo.teacherId,
            phone: "0722222223",
            national_id: "35718857",
            email: "teacher1@gmail.com",
            gender: "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teachers.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a teacher", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteacher: Uteacher!) {
            teachers {
              archive(teacher: $Iteacher) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iteacher: {
            id: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teachers.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a teacher", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteacher: Uteacher!) {
            teachers {
              restore(teacher: $Iteacher) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iteacher: {
            id: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.teachers.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored teacher", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          teachers{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teachers[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Classes", () => {
  it("Can create a class", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($class: IClass!) {
            classes {
              create(class: $class) {
                id
              }
            }
          }            
        `,
        variables: {
          class: {
            name: "Class Name",
            teacher: sharedInfo.teacherId,
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.classes.create.id).to.be.a.string;

        sharedInfo.class = res.body.data.classes.create.id;
        done();
      });
  });

  it("Can update a class", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($class: UClass!) {
            classes {
              update(class: $class) {
                id
              }
            }
          }            
        `,
        variables: {
          class: {
            id: sharedInfo.class,
            name: "New Class"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.classes.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a class", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($class: UClass!) {
            classes {
              archive(class: $class) {
                id
              }
            }
          }                  
        `,
        variables: {
          class: {
            id: sharedInfo.class
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.classes.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a class", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($class: UClass!) {
            classes {
              restore(class: $class) {
                id
              }
            }
          }                  
        `,
        variables: {
          class: {
            id: sharedInfo.class
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored class", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          classes{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Routes", () => {
  it("Can create an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Iroute: {
            name: "marwa",
            description: "marwa",
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.routes.create.id).to.be.a.string;

        sharedInfo.routeId = res.body.data.routes.create.id;
        done();
      });
  });

  it("Can update an route", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          route: {
            id: sharedInfo.routeId,
            name: "tested",
            description: "descr"
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
      .set("authorization", authorization)
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
          Iroute: {
            id: sharedInfo.routeId
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
      .set("authorization", authorization)
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
          Iroute: {
            id: sharedInfo.routeId
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
      .set("authorization", authorization)
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
});

describe("Drivers", () => {
  it("Can create an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Idriver: {
            username: "driver1",
            email: "driver@gmail.com",
            phone: "0711111111",
            school: sharedInfo.school,
            photo: "03/03/2022",
            license_expiry: "35718850",
            licence_number: "IcanDrive099",
            experience: "4",
            home: "Juja, Kiambu, Kenya",
            password: "4289Vtg"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.drivers.create.id).to.be.a.string;

        sharedInfo.driverId = res.body.data.drivers.create.id;
        done();
      });
  });

  it("Can update an driver", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          driver: {
            id: sharedInfo.driverId,
            username: "driver2",
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
      .set("authorization", authorization)
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
          Idriver: {
            id: sharedInfo.driverId
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
      .set("authorization", authorization)
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
          Idriver: {
            id: sharedInfo.driverId
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
      .set("authorization", authorization)
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
});

describe("Buses", () => {
  it("Can create an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Ibus: {
            make: "marwa",
            plate: "test",
            size: 2,
            school: sharedInfo.school,
            driver: sharedInfo.driverId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.buses.create.id).to.be.a.string;

        sharedInfo.busId = res.body.data.buses.create.id;
        done();
      });
  });

  it("Can update an bus", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          bus: {
            id: sharedInfo.busId,
            make: "marwaed",
            plate: "test",
            size: 3
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
      .set("authorization", authorization)
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
          Ibus: {
            id: sharedInfo.busId
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
      .set("authorization", authorization)
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
          Ibus: {
            id: sharedInfo.busId
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
      .set("authorization", authorization)
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
});

describe("Parent", () => {
  it("Can create an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Iparent: {
            name: "parent1",
            national_id: "35718850",
            phone: "0711657108",
            password: "rY8x5uW",
            school: sharedInfo.school,
            email: "parent1@gmail.com",
            gender: "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.create.id).to.be.a.string;

        sharedInfo.parentId = res.body.data.parents.create.id;
        done();
      });
  });

  it("Create second parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Iparent: {
            name: "parent2",
            national_id: "35718851",
            phone: "0711657108",
            password: "rY8x5uW",
            school: sharedInfo.school,
            email: "parent2@gmail.com",
            gender: "MALE"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.parents.create.id).to.be.a.string;

        sharedInfo.parent2Id = res.body.data.parents.create.id;
        done();
      });
  });

  it("Can update an parent", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          parent: {
            id: sharedInfo.parentId,
            national_id: "35718857",
            email: "parent1@gmail.com",
            gender: "MALE"
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
      .set("authorization", authorization)
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
          Iparent: {
            id: sharedInfo.parentId
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
      .set("authorization", authorization)
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
          Iparent: {
            id: sharedInfo.parentId
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
      .set("authorization", authorization)
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
});

describe("Students", () => {
  it("Can create an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Istudent: {
            names: "student1",
            route: sharedInfo.routeId,
            gender: "FEMALE",
            registration: "1234",
            school: sharedInfo.school,
            // parent: sharedInfo.parentId,
            parent2: sharedInfo.parent2Id,
            class: sharedInfo.class
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.students.create.id).to.be.a.string;

        sharedInfo.studentId = res.body.data.students.create.id;
        done();
      });
  });

  it("Can update an student", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          student: {
            id: sharedInfo.studentId,
            names: "marwa",
            route: sharedInfo.routeId,
            gender: "MALE",
            parent: "test"
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
      .set("authorization", authorization)
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
          Istudent: {
            id: sharedInfo.studentId
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
      .set("authorization", authorization)
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
          Istudent: {
            id: sharedInfo.studentId
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
      .set("authorization", authorization)
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
});

describe("Schedule", () => {
  it("Can create a schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Ischedule: {
            name: "schedule 1",
message: `Hello {{parent_name}}, 

Our {{school_name}} bus has confirmed that it just dropped {{student_name}} at their usual pickup location. 
            
We would like to thank you for your continued commitment to time and safety.`,
            time: new Date().toISOString(),
            end_time: moment(new Date())
              .add(30, "m")
              .toISOString(),
            school: sharedInfo.school,
            route: sharedInfo.routeId,
            days: "MONDAY,TUESDAY",
            type: "PICK",
            bus: sharedInfo.busId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.schedules.create.id).to.be.a.string;

        sharedInfo.scheduleId = res.body.data.schedules.create.id;
        done();
      });
  });

  it("Can update an schedule", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          schedule: {
            id: sharedInfo.scheduleId,
            name: "Schedule 1 edited"
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
      .set("authorization", authorization)
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
          Ischedule: {
            id: sharedInfo.scheduleId
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
      .set("authorization", authorization)
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
          Ischedule: {
            id: sharedInfo.scheduleId
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
      .set("authorization", authorization)
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
});




describe("Trips", () => {
  it("Can create a trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($Itrip: Itrip!) {
          trips {
            create(trip: $Itrip) {
              id
            }
          }
        }
        `,
        variables: {
          Itrip: {
            startedAt: new Date().toISOString(),
            schedule: sharedInfo.scheduleId,
            type: "DROP",
            driver: sharedInfo.driverId,
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.create.id).to.be.a.string;

        sharedInfo.tripId = res.body.data.trips.create.id;
        done();
      });
  });

  // dont add this id's to shared data
  it("Can create a completed trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($Itrip: Itrip!) {
          trips {
            create(trip: $Itrip) {
              id
            }
          }
        }
        `,
        variables: {
          Itrip: {
            type: "DROP",
            startedAt: new Date().toISOString(),
            completedAt: moment(new Date())
              .add(40, "m")
              .toISOString(),
            driver: sharedInfo.driverId,
            school: sharedInfo.school,
            schedule: sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.create.id).to.be.a.string;

        done();
      });
  });

  it("Can create a incomplete trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($Itrip: Itrip!) {
          trips {
            create(trip: $Itrip) {
              id
            }
          }
        }
        `,
        variables: {
          Itrip: {
            type: "DROP",
            startedAt: new Date().toISOString(),
            schedule: sharedInfo.scheduleId,
            driver: sharedInfo.driverId,
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.create.id).to.be.a.string;

        done();
      });
  });

  it("Can create a incomplete trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation ($Itrip: Itrip!) {
          trips {
            create(trip: $Itrip) {
              id
            }
          }
        }
        `,
        variables: {
          Itrip: {
            type: "PICK",
            isCancelled: true,
            school: sharedInfo.school,
            driver: sharedInfo.driverId,
            schedule: sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.create.id).to.be.a.string;

        done();
      });
  });

  it("Can update an trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($trip: Utrip!) {
            trips {
              update(trip: $trip) {
                id
              }
            }
          }            
        `,
        variables: {
          trip: {
            id: sharedInfo.tripId,
            startedAt: new Date().toISOString(),
            type: "PICK",
            completedAt: new Date().toISOString(),
            schedule: sharedInfo.scheduleId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itrip: Utrip!) {
            trips {
              archive(trip: $Itrip) {
                id
              }
            }
          }                  
        `,
        variables: {
          Itrip: {
            id: sharedInfo.tripId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itrip: Utrip!) {
            trips {
              restore(trip: $Itrip) {
                id
              }
            }
          }                  
        `,
        variables: {
          Itrip: {
            id: sharedInfo.tripId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.trip.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored trip", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          trips{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.trips[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Event", () => {
  it("Can create an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          Ievent: {
            student: sharedInfo.studentId,
            latitude: "-1.286389",
            longitude: "36.817223",
            time: new Date().toLocaleTimeString(),
            type: "CHECKEDOFF",
            school: sharedInfo.school,
            trip: sharedInfo.tripId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.events.create.id).to.be.a.string;

        sharedInfo.eventId = res.body.data.events.create.id;
        done();
      });
  });

  it("Can update an event", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
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
          event: {
            id: sharedInfo.eventId,
            latitude: "-1.286389",
            longitude: "36.817223",
            time: new Date().toLocaleTimeString()
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
      .set("authorization", authorization)
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
          Ievent: {
            id: sharedInfo.eventId
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
      .set("authorization", authorization)
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
          Ievent: {
            id: sharedInfo.eventId
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
      .set("authorization", authorization)
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
        // expect(res.body.data.events[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Complaint", () => {
  it("Can create an complaint", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Icomplaint: Icomplaint!) {
            complaints {
              create(complaint: $Icomplaint) {
                id,
                time,
                parent{
                  id
                }
              }
            }
          }            
        `,
        variables: {
          Icomplaint: {
            parent: sharedInfo.parent2Id,
            time: new Date().toLocaleTimeString(),
            school: sharedInfo.school,
            content: "Complaining"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.complaints.create.id).to.be.a.string;

        sharedInfo.complaintId = res.body.data.complaints.create.id;
        done();
      });
  });

  it("Can update an complaint", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($complaint: Ucomplaint!) {
            complaints {
              update(complaint: $complaint) {
                id
              }
            }
          }            
        `,
        variables: {
          complaint: {
            id: sharedInfo.complaintId,
            time: new Date().toLocaleTimeString()
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.complaints.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an complaint", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Icomplaint: Ucomplaint!) {
            complaints {
              archive(complaint: $Icomplaint) {
                id
              }
            }
          }                  
        `,
        variables: {
          Icomplaint: {
            id: sharedInfo.complaintId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.complaints.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an complaint", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Icomplaint: Ucomplaint!) {
            complaints {
              restore(complaint: $Icomplaint) {
                id
              }
            }
          }                  
        `,
        variables: {
          Icomplaint: {
            id: sharedInfo.complaintId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.complaints.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored complaint", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          complaints{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.complaints[0].id).to.be.a.string;

        done();
      });
  });
});

describe("Location Reporting", () => {
  it("Can create an locReport", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($IlocReport: IlocReport!) {
            locReports {
              create(locreport: $IlocReport) {
                id
              }
            }
          }            
        `,
        variables: {
          IlocReport: {
            trip: sharedInfo.tripId,
            time: new Date().toLocaleTimeString(),
            loc: {
              lat: 1.234,
              lng: -0.456
            }
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.locReports.create.id).to.be.a.string;

        sharedInfo.locReportId = res.body.data.locReports.create.id;
        done();
      });
  });

  it("Can update an locReport", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($locReport: UlocReport!) {
            locReports {
              update(locreport: $locReport) {
                id
              }
            }
          }            
        `,
        variables: {
          locReport: {
            id: sharedInfo.locReportId,
            time: new Date().toLocaleTimeString()
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.locReports.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an locReport", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($IlocReport: UlocReport!) {
            locReports {
              archive(locreport: $IlocReport) {
                id
              }
            }
          }                  
        `,
        variables: {
          IlocReport: {
            id: sharedInfo.locReportId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.locReports.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an locReport", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($IlocReport: UlocReport!) {
            locReports {
              restore(locreport: $IlocReport) {
                id
              }
            }
          }                  
        `,
        variables: {
          IlocReport: {
            id: sharedInfo.locReportId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports.restore.id).to.be.string;
        done();
      });
  });

  it("Can fetch restored locReport", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        {
          locReports{
            id
          }
        }        
        `
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports[0].id).to.be.a.string;

        done();
      });
  });
});

describe("SMS Communication", () => {
  it("Can send sms", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
        mutation($sms: Isms!){
          sms{
            send(sms: $sms)
          }
        }
        `,
        variables: {
          sms: {
            message: "Message",
            school: sharedInfo.school,
            parents: [sharedInfo.parentId, sharedInfo.parent2Id]
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        // expect(res.body.data.locReports[0].id).to.be.a.string;

        done();
      });
  });
});


describe("Payment", () => {
  it("Can create an payment", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ipayment: Ipayment!) {
            payments {
              create(payment: $Ipayment) {
                id
              }
            }
          }            
        `,
        variables: {
          Ipayment: {
            school: sharedInfo.school,
            ammount: "1000",
            type: "MPESA",
            phone: "0711657108",
            ref: "MKGFDYGVJH",
            time: new Date()
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.payments.create.id).to.be.a.string;

        sharedInfo.paymentId = res.body.data.payments.create.id;
        done();
      });
  });

  // it("Can nuke an payment", done => {
  //   chai
  //     .request(app)
  //     .post("/graph")
  //     .set("authorization", authorization)
  //     .set("content-type", "application/json")
  //     .send({
  //       query: `
  //         mutation ($Ipayment: Upayment!) {
  //           payments {
  //             archive(payment: $Ipayment) {
  //               id
  //             }
  //           }
  //         }                  
  //       `,
  //       variables: {
  //         Ipayment: {
  //           id: sharedInfo.paymentId
  //         }
  //       }
  //     })
  //     .end((err, res) => {
  //       res.should.have.status(200);
  //       expect(res.body).to.not.be.null;
  //       expect(res.body.errors).to.not.exist;
  //       expect(res.body.data.payments.archive.id).to.be.a.string;
  //       done();
  //     });
  // });

  // it("Can restore an payment", done => {
  //   chai
  //     .request(app)
  //     .post("/graph")
  //     .set("authorization", authorization)
  //     .set("content-type", "application/json")
  //     .send({
  //       query: `
  //         mutation ($Ipayment: Upayment!) {
  //           payments {
  //             restore(payment: $Ipayment) {
  //               id
  //             }
  //           }
  //         }                  
  //       `,
  //       variables: {
  //         Ipayment: {
  //           id: sharedInfo.paymentId
  //         }
  //       }
  //     })
  //     .end((err, res) => {
  //       res.should.have.status(200);
  //       expect(res.body).to.not.be.null;
  //       expect(res.body.errors).to.not.exist;
  //       // expect(res.body.data.payments.restore.id).to.be.string;
  //       done();
  //     });
  // });

  // it("Can fetch restored payment", done => {
  //   chai
  //     .request(app)
  //     .post("/graph")
  //     .set("authorization", authorization)
  //     .set("content-type", "application/json")
  //     .send({
  //       query: `
  //       {
  //         payments {
  //           id
  //         }
  //       }        
  //       `
  //     })
  //     .end((err, res) => {
  //       res.should.have.status(200);
  //       expect(res.body).to.not.be.null;
  //       expect(res.body.errors).to.not.exist;
  //       expect(res.body.data.payments[0].id).to.be.a.string;

  //       done();
  //     });
  // });
});


describe("Charges", () => {
  it("Can create an charge", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Icharge: Icharge!) {
            charges {
              create(charge: $Icharge) {
                id
              }
            }
          }
        `,
        variables: {
          Icharge: {
            school: sharedInfo.school,
            ammount: "100",
            reason: "Sending message 'This is a message This is a message This is a message This is a message This is a message'",
            time: new Date()
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.charges.create.id).to.be.a.string;

        sharedInfo.paymentId = res.body.data.charges.create.id;
        done();
      });
  });
})

describe("Grades", () => {
  it("Can create a grade", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Igrade: Igrade!) {
            grades {
              create(grade: $Igrade) {
                id
              }
            }
          }            
        `,
        variables: {
          Igrade: {
            name: "3",
            school: sharedInfo.school,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.grades.create.id).to.be.a.string;

        sharedInfo.gradeId = res.body.data.grades.create.id;
        done();
      });
  });

  it("Can update a grade", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Igrade: Ugrade!) {
            grades {
              update(grade: $Igrade) {
                id
              }
            }
          }            
        `,
        variables: {
          Igrade: {
            id: sharedInfo.gradeId,
            name: "2"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.grades.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a grade", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Igrade: Ugrade!) {
            grades {
              archive(grade: $Igrade) {
                id
              }
            }
          }                  
        `,
        variables: {
          Igrade: {
            id: sharedInfo.gradeId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.grades.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a grade", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Igrade: Ugrade!) {
            grades {
              restore(grade: $Igrade) {
                id
              }
            }
          }                  
        `,
        variables: {
          Igrade: {
            id: sharedInfo.gradeId
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
});


describe("Subjects", () => {
  it("Can create a subject", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubject: Isubject!) {
            subjects {
              create(subject: $Isubject) {
                id
              }
            }
          }            
        `,
        variables: {
          Isubject: {
            name: "Science",
            grade: sharedInfo.gradeId,
            topicOrder: ['Introduction', 'Reproduction']
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subjects.create.id).to.be.a.string;

        sharedInfo.subjectId = res.body.data.subjects.create.id;
        done();
      });
  });

  it("Can update a subject", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubject: Usubject!) {
            subjects {
              update(subject: $Isubject) {
                id
              }
            }
          }            
        `,
        variables: {
          Isubject: {
            id: sharedInfo.subjectId,
            name: "Social Studies",
            topicOrder: ['Introduction', 'Reproduction', 'Energy']
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subjects.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a subject", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubject: Usubject!) {
            subjects {
              archive(subject: $Isubject) {
                id
              }
            }
          }                  
        `,
        variables: {
          Isubject: {
            id: sharedInfo.subjectId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subjects.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a subject", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubject: Usubject!) {
            subjects {
              restore(subject: $Isubject) {
                id
              }
            }
          }                  
        `,
        variables: {
          Isubject: {
            id: sharedInfo.subjectId
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
});

describe("Topics", () => {
  it("Can create a topic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itopic: Itopic!) {
            topics {
              create(topic: $Itopic) {
                id
              }
            }
          }            
        `,
        variables: {
          Itopic: {
            name: "Introduction",
            subject: sharedInfo.subjectId,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.topics.create.id).to.be.a.string;

        sharedInfo.topicId = res.body.data.topics.create.id;
        done();
      });
  });

  it("Can update a topic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itopic: Utopic!) {
            topics {
              update(topic: $Itopic) {
                id
              }
            }
          }            
        `,
        variables: {
          Itopic: {
            id: sharedInfo.topicId,
            name: "Energy"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.topics.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a topic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itopic: Utopic!) {
            topics {
              archive(topic: $Itopic) {
                id
              }
            }
          }                  
        `,
        variables: {
          Itopic: {
            id: sharedInfo.topicId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.topics.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a topic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Itopic: Utopic!) {
            topics {
              restore(topic: $Itopic) {
                id
              }
            }
          }                  
        `,
        variables: {
          Itopic: {
            id: sharedInfo.topicId
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
});

describe("Subtopics", () => {
  it("Can create a subtopic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubtopic: Isubtopic!) {
            subtopics {
              create(subtopic: $Isubtopic) {
                id
              }
            }
          }            
        `,
        variables: {
          Isubtopic: {
            name: "Basics",
            topic: sharedInfo.topicId,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subtopics.create.id).to.be.a.string;

        sharedInfo.subtopicId = res.body.data.subtopics.create.id;
        done();
      });
  });

  it("Can update a subtopic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubtopic: Usubtopic!) {
            subtopics {
              update(subtopic: $Isubtopic) {
                id
              }
            }
          }            
        `,
        variables: {
          Isubtopic: {
            id: sharedInfo.subtopicId,
            name: "Summary"
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subtopics.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a subtopic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubtopic: Usubtopic!) {
            subtopics {
              archive(subtopic: $Isubtopic) {
                id
              }
            }
          }                  
        `,
        variables: {
          Isubtopic: {
            id: sharedInfo.subtopicId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.subtopics.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an subtopic", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Isubtopic: Usubtopic!) {
            subtopics {
              restore(subtopic: $Isubtopic) {
                id
              }
            }
          }                  
        `,
        variables: {
          Isubtopic: {
            id: sharedInfo.subtopicId
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
});

describe("Questions", () => {
  it("Can create a question", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iquestion: Iquestion!) {
            questions {
              create(question: $Iquestion) {
                id
              }
            }
          }            
        `,
        variables: {
          Iquestion: {
            subtopic: sharedInfo.subtopicId,
            type: "SINGLECHOICE",
            name: "Which image shows a cat?",
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.questions.create.id).to.be.a.string;

        sharedInfo.questionId = res.body.data.questions.create.id;
        done();
      });
  });

  it("Can update a question", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iquestion: Uquestion!) {
            questions {
              update(question: $Iquestion) {
                id
              }
            }
          }            
        `,
        variables: {
          Iquestion: {
            id: sharedInfo.questionId,
            subtopic: sharedInfo.subtopicId,
            type: "MULTICHOICE",
            name: "Which images show cats?",
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.questions.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a question", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iquestion: Uquestion!) {
            questions {
              archive(question: $Iquestion) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iquestion: {
            id: sharedInfo.questionId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.questions.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an question", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iquestion: Uquestion!) {
            questions {
              restore(question: $Iquestion) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iquestion: {
            id: sharedInfo.questionId
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
});

describe("Answers", () => {
  it("Can create an answer", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ianswer: Ianswer!) {
            answers {
              create(answer: $Ianswer) {
                id
              }
            }
          }            
        `,
        variables: {
          Ianswer: {
            value: 'A',
            question: sharedInfo.questionId,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.answers.create.id).to.be.a.string;

        sharedInfo.answerId = res.body.data.answers.create.id;
        done();
      });
  });

  it("Can update an answer", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ianswer: Uanswer!) {
            answers {
              update(answer: $Ianswer) {
                id
              }
            }
          }            
        `,
        variables: {
          Ianswer: {
            id: sharedInfo.answerId,
            value: 'C'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.answers.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an answer", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ianswer: Uanswer!) {
            answers {
              archive(answer: $Ianswer) {
                id
              }
            }
          }                  
        `,
        variables: {
          Ianswer: {
            id: sharedInfo.answerId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.answers.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an answer", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ianswer: Uanswer!) {
            answers {
              restore(answer: $Ianswer) {
                id
              }
            }
          }                  
        `,
        variables: {
          Ianswer: {
            id: sharedInfo.answerId
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
});

describe("Options", () => {
  it("Can create an option", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ioption: Ioption!) {
            options {
              create(option: $Ioption) {
                id
              }
            }
          }            
        `,
        variables: {
          Ioption: {
            value: 'cat.jpg',
            question: sharedInfo.questionId,
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.options.create.id).to.be.a.string;

        sharedInfo.optionId = res.body.data.options.create.id;
        done();
      });
  });

  it("Can update an option", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ioption: Uoption!) {
            options {
              update(option: $Ioption) {
                id
              }
            }
          }            
        `,
        variables: {
          Ioption: {
            id: sharedInfo.optionId,
            value: 'dog.jpg'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.options.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an option", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ioption: Uoption!) {
            options {
              archive(option: $Ioption) {
                id
              }
            }
          }                  
        `,
        variables: {
          Ioption: {
            id: sharedInfo.optionId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.options.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an option", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Ioption: Uoption!) {
            options {
              restore(option: $Ioption) {
                id
              }
            }
          }                  
        `,
        variables: {
          Ioption: {
            id: sharedInfo.optionId
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
});

describe("Terms", () => {
  it("Can create a term", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iterm: Iterm!) {
            terms {
              create(term: $Iterm) {
                id
              }
            }
          }            
        `,
        variables: {
          Iterm: {
            school: sharedInfo.school,
            name: 'One',
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.terms.create.id).to.be.a.string;

        sharedInfo.termId = res.body.data.terms.create.id;
        done();
      });
  });

  it("Can update a term", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iterm: Uterm!) {
            terms {
              update(term: $Iterm) {
                id
              }
            }
          }            
        `,
        variables: {
          Iterm: {
            id: sharedInfo.termId,
            name: 'Three'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.terms.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a term", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iterm: Uterm!) {
            terms {
              archive(term: $Iterm) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iterm: {
            id: sharedInfo.termId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.terms.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a term", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iterm: Uterm!) {
            terms {
              restore(term: $Iterm) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iterm: {
            id: sharedInfo.termId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        done();
      });
  });
});

describe("Teams", () => {
  it("Can create a team", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteam: Iteam!) {
            teams {
              create(team: $Iteam) {
                id
              }
            }
          }            
        `,
        variables: {
          Iteam: {
            school: sharedInfo.school,
            name: 'Alphas'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teams.create.id).to.be.a.string;

        sharedInfo.teamId = res.body.data.teams.create.id;
        done();
      });
  });

  it("Can update a team", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteam: Uteam!) {
            teams {
              update(team: $Iteam) {
                id
              }
            }
          }            
        `,
        variables: {
          Iteam: {
            id: sharedInfo.teamId,
            name: 'Betas',
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teams.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a team", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteam: Uteam!) {
            teams {
              archive(team: $Iteam) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iteam: {
            id: sharedInfo.teamId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.teams.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a team", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Iteam: Uteam!) {
            teams {
              restore(team: $Iteam) {
                id
              }
            }
          }                  
        `,
        variables: {
          Iteam: {
            id: sharedInfo.teamId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        done();
      });
  });
});

describe("Team Members", () => {
  it("Can create a team member", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: IteamMember!) {
            team_members {
              create(team_member: $Item) {
                id
              }
            }
          }            
        `,
        variables: {
          Item: {
            team: sharedInfo.teamId,
            user: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.team_members.create.id).to.be.a.string;

        sharedInfo.teamMemberId = res.body.data.team_members.create.id;
        done();
      });
  });

  it("Can update a team member", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: UteamMember!) {
            team_members {
              update(team_member: $Item) {
                id
              }
            }
          }            
        `,
        variables: {
          Item: {
            id: sharedInfo.teamMemberId,
            team: sharedInfo.teamId,
            user: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.team_members.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke a team member", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: UteamMember!) {
            team_members {
              archive(team_member: $Item) {
                id
              }
            }
          }                  
        `,
        variables: {
          Item: {
            team: sharedInfo.teamId,
            user: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.team_members.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore a team member", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: UteamMember!) {
            team_members {
              restore(team_member: $Item) {
                id
              }
            }
          }                  
        `,
        variables: {
          Item: {
            id: sharedInfo.teamMemberId,
            team: sharedInfo.teamId,
            user: sharedInfo.teacherId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        done();
      });
  });
});

describe("Invitations", () => {
  it("Can create an invitation", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: Iinvitation!) {
            invitations {
              create(invitation: $Item) {
                id
              }
            }
          }            
        `,
        variables: {
          Item: {
            user: sharedInfo.teacherId,
            school: sharedInfo.school,
            message: 'Welcome to Shuleplus.',
            phone: '0712345678',
            email: 'invitation@teams.com'
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.invitations.create.id).to.be.a.string;

        sharedInfo.invitationId = res.body.data.invitations.create.id;
        done();
      });
  });

  it("Can update an invitation", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: Uinvitation!) {
            invitations {
              update(invitation: $Item) {
                id
              }
            }
          }            
        `,
        variables: {
          Item: {
            id: sharedInfo.invitationId,
            message: 'Welcome back to Shuleplus',
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.invitations.update.id).to.be.a.string;
        done();
      });
  });

  it("Can nuke an invitation", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: Uinvitation!) {
            invitations {
              archive(invitation: $Item) {
                id
              }
            }
          }                  
        `,
        variables: {
          Item: {
            id: sharedInfo.invitationId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        expect(res.body.data.invitations.archive.id).to.be.a.string;
        done();
      });
  });

  it("Can restore an invitation", done => {
    chai
      .request(app)
      .post("/graph")
      .set("authorization", authorization)
      .set("content-type", "application/json")
      .send({
        query: `
          mutation ($Item: Uinvitation!) {
            invitations {
              restore(invitation: $Item) {
                id
              }
            }
          }                  
        `,
        variables: {
          Item: {
            id: sharedInfo.invitationId
          }
        }
      })
      .end((err, res) => {
        res.should.have.status(200);
        expect(res.body).to.not.be.null;
        expect(res.body.errors).to.not.exist;
        done();
      });
  });

  // it("Can send an invitation", done => {
  //   chai
  //     .request(app)
  //     .post("/graph")
  //     .set("authorization", authorization)
  //     .set("content-type", "application/json")
  //     .send({
  //       query: `
  //         mutation ($Item: Iinvite!) {
  //           teams {
  //             invite(team: $Item) {
  //               id
  //             }
  //           }
  //         }            
  //       `,
  //       variables: {
  //         Item: {
  //           user: sharedInfo.teacherId,
  //           school: sharedInfo.school,
  //         }
  //       }
  //     })
  //     .end((err, res) => {
  //       res.should.have.status(200);
  //       expect(res.body).to.not.be.null;
  //       expect(res.body.errors).to.not.exist;
  //       expect(res.body.data.teams.invite.id).to.be.a.string;
  //       done();
  //     });
  // });
});
