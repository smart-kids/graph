// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
import app from "../src";

// Configure chai
chai.use(chaiHttp);
chai.should();
var expect = chai.expect;

describe("Companies", () => {
  before(function(done) {
    this.timeout(1000); // wait for db connections etc.
    setTimeout(done, 500);
  });

  describe("GET /", function() {
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
          done();
        });
    });
  });
});
