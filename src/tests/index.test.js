// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
import app from "../src";

// Configure chai
chai.use(chaiHttp);
chai.should();
describe("Students", () => {
  describe("GET /", () => {
    // Test to get all students record
    it("Health should return 200", done => {
      chai
        .request(app)
        .get("/health")
        .end((err, res) => {
          res.should.have.status(200);
          // res.body.should.be.null;
          done();
        });
    });

    it("Hello graphql responds correct", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({ query: "{ hello }" })
        .end((err, res) => {
          res.should.have.status(200);
          // res.body.should.be.null;
          done();
        });
    });
  });
});
