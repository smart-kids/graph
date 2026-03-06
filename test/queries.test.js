// GraphQL Queries Test
require("dotenv").config();
import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

let authorization = null;

describe("GraphQL Queries Test Suite", () => {
  before(function (done) {
    this.timeout(10000);
    
    chai
      .request("http://localhost:4001")
      .post("/auth/super")
      .set("content-type", "application/json")
      .send({
        "user": "sAdmin",
        "password": "00000"
      })
      .end((err, res) => {
        if (err || res.status !== 200) {
          console.log("Auth failed, proceeding without token...");
          authorization = "Bearer test-token";
        } else {
          authorization = `Bearer ${res.body.token}`;
        }
        done();
      });
  });

  describe("School Queries", () => {
    it("Can query schools", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ schools { id name phone email address } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.schools).to.be.an('array');
          done();
        });
    });
  });

  describe("Grade Queries", () => {
    it("Can query grades", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ grades { id name school { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.grades).to.be.an('array');
          done();
        });
    });
  });

  describe("Class Queries", () => {
    it("Can query classes", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ classes { id name school { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.classes).to.be.an('array');
          done();
        });
    });
  });

  describe("Student Queries", () => {
    it("Can query students", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ students { id names registration class { id name } feeStatus { amount status } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.students).to.be.an('array');
          done();
        });
    });
  });

  describe("Parent Queries", () => {
    it("Can query parents", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ parents { id name phone email students { id names } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.parents).to.be.an('array');
          done();
        });
    });
  });

  describe("Teacher Queries", () => {
    it("Can query teachers", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ teachers { id name phone email classes { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.teachers).to.be.an('array');
          done();
        });
    });
  });

  describe("Admin Queries", () => {
    it("Can query admins", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ admins { id names email phone schools { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.admins).to.be.an('array');
          done();
        });
    });
  });

  describe("Subject Queries", () => {
    it("Can query subjects", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ subjects { id name grade { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.subjects).to.be.an('array');
          done();
        });
    });
  });

  describe("Book Queries", () => {
    it("Can query books", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ books { id title author category description coverUrl school { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.books).to.be.an('array');
          done();
        });
    });
  });

  describe("Payment Queries", () => {
    it("Can query payments", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ payments { id school { id name } student { id names } amount status type paymentType time ref resultDesc } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.payments).to.be.an('array');
          done();
        });
    });
  });

  describe("Term Queries", () => {
    it("Can query terms", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ terms { id name startDate endDate school { id name } isActive } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.terms).to.be.an('array');
          done();
        });
    });
  });

  describe("Additional Model Queries", () => {
    it("Can query routes", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ routes { id name description } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.routes).to.be.an('array');
          done();
        });
    });

    it("Can query drivers", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ drivers { id name phone } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.drivers).to.be.an('array');
          done();
        });
    });

    it("Can query buses", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ buses { id make plate size } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.buses).to.be.an('array');
          done();
        });
    });

    it("Can query events", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ events { id time student { id names } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.events).to.be.an('array');
          done();
        });
    });

    it("Can query complaints", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ complaints { id content time parent { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.complaints).to.be.an('array');
          done();
        });
    });

    it("Can query schedules", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ schedules { id name message time } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.schedules).to.be.an('array');
          done();
        });
    });

    it("Can query charges", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ charges { id amount reason time school } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.charges).to.be.an('array');
          done();
        });
    });

    it("Can query topics", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ topics { id name subject { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.topics).to.be.an('array');
          done();
        });
    });

    it("Can query questions", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ questions { id name type subtopic { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.questions).to.be.an('array');
          done();
        });
    });

    it("Can query answers", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ answers { id value question { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.answers).to.be.an('array');
          done();
        });
    });

    it("Can query assessments", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ assessments { id student { id names } term { id name } subject { id name } } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.assessments).to.be.an('array');
          done();
        });
    });

    it("Can query teams", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ teams { id name } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.teams).to.be.an('array');
          done();
        });
    });

    it("Can query invitations", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ invitations { id message phone email } }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.invitations).to.be.an('array');
          done();
        });
    });
  });

  describe("Health Check", () => {
    it("GraphQL hello endpoint works", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "{ hello }"
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.hello).to.be.a.string;
          done();
        });
    });
  });
});
