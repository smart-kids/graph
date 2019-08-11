// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
import app from "../src";

// Configure chai
chai.use(chaiHttp);
chai.should();
var expect = chai.expect;

const sharedInfo = {};

describe("Setup", () => {
  before(function(done) {
    this.timeout(1000); // wait for db connections etc.
    setTimeout(done, 500);
  });

  describe("Health", function() {
    // Test to get all students record
    it("Health should return 200", done => {
      chai
        .request(app)
        .get("/health")
        .end((err, res) => {
          res.should.have.status(200);

          done();
        });
    });

    it("Hello graphql responds correct", done => {
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

describe("Companies", () => {
  before(function(done) {
    this.timeout(1000); // wait for db connections etc.
    setTimeout(done, 500);
  });

  describe("Innitialization", function() {
    it("Can create a company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `
            mutation ($inputCompany: inputCompany!) {
              companies {
                create(company: $inputCompany) {
                  id
                }
              }
            }
          `,
          variables: {
            inputCompany: {
              name: "test",
              address: "test",
              email: "test",
              town: "test",
              mobile: 1234,
              physicalAddress: "test",
              fax: "test",
              telephone: 1234
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body).to.not.be.null;
          expect(res.body.errors).to.not.exist;
          expect(res.body.data.companies.create.id).to.be.a.string;

          sharedInfo.companyId = res.body.data.companies.create.id;

          done();
        });
    });

    it("Can fail to create create a company on validation", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `
            mutation ($inputCompany: inputCompany!) {
              companies {
                create(company: $inputCompany) {
                  id
                }
              }
            }
          `,
          variables: {
            inputCompany: {
              name: "test",
              address: "test",
              // email: "test",
              town: "test",
              mobile: 1234,
              physicalAddress: "test",
              fax: "test",
              telephone: 1234
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body).to.not.be.null;
          expect(res.body.errors).to.exist;

          done();
        });
    });

    it("Fetching companies returns existing company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `{
            companies{
              id,
              name,
              address,
              email
              physicalAddress,
              fax,
              telephone
            }
          }`
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    it("Updating a single company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `mutation ($inputCompany: inputUpdateCompany!) {
            companies {
              update(company: $inputCompany) {
                id
              }
            }
          }
          `,
          variables: {
            inputCompany: {
              id: sharedInfo.companyId,
              name: "updated"
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    it("Fetch updated company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `query($inputCompany:inputUpdateCompany){
            company(company:$inputCompany){
              id,
              name
            }
          }
          `,
          variables: {
            inputCompany: {
              id: sharedInfo.companyId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.company.name).to.equal("updated");
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    it("Destroy a company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `mutation ($inputCompany: inputUpdateCompany!) {
            companies {
              archive(company: $inputCompany) {
                id
              }
            }
          }          
          `,
          variables: {
            inputCompany: {
              id: sharedInfo.companyId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    it("Cannot Fetch deleted company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `query($inputCompany:inputUpdateCompany){
            company(company:$inputCompany){
              id,
              name
            }
          }
          `,
          variables: {
            inputCompany: {
              id: sharedInfo.companyId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.company).to.not.exist
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    describe("Configurations", function() {
      it("Can create a company configurations", done => {
        done();
      });
    });
  });
});
