// Import the dependencies for testing
import chai from "chai";
import chaiHttp from "chai-http";
var rimraf = require("rimraf");
import app from "../src";

// Configure chai
chai.use(chaiHttp);
chai.should();
var expect = chai.expect;

const sharedInfo = {};

rimraf(".tmp/localDiskDb/*", () => {
  console.log("  Cleared setup dir");
});

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
          expect(res.body.data.company).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    it("Restore a company", done => {
      chai
        .request(app)
        .post("/graph")
        .set("content-type", "application/json")
        .send({
          query: `mutation ($inputCompany: inputUpdateCompany!) {
            companies {
              restore(company: $inputCompany) {
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

    it("Can Fetch restored company", done => {
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
          expect(res.body.data.company.name).to.exist;
          expect(res.body).to.exist;
          expect(res.body.errors).to.not.exist;

          done();
        });
    });

    describe("Configurations", function() {
      it("Can create a company configurations", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputCompanyConfig: inputCompanyConfig!) {
                companies {
                  configurations {
                    create(configurations:$inputCompanyConfig)
                  }
                }
              }
          `,
            variables: {
              inputCompanyConfig: {
                company: sharedInfo.companyId,
                emailMailer: "test",
                emailHost: "test",
                emailEncrypt: "test",
                emailFrom: "test",
                emailUsername: "test",
                emailPort: "test",
                minimumSwitchDuration: 1234,
                transfer: 1234,
                printing: 1234,
                minimumTransferDuration: 1234,
                membership: 1234,
                switch: 1234,
                bounceCheque: 1234,
                minimumNavChart: 1234,
                dividendsTax: 1234,
                exerciseTax: 1234,
                withholdingResident: 1234,
                maxJointMembers: 1234,
                vat: 1234,
                withholdingNonResident: 1234,
                withdrawal: 1234,
                duration: 1234,
                minimumWithdrawalDuration: 1234,
                smsPort: "test"
              }
            }
          })
          .end((err, res) => {
            expect(res.body.errors).to.not.exist;
            expect(res.body).to.not.be.null;
            expect(res.body.data.companies.configurations.create).to.be.true;
            res.should.have.status(200);

            done();
          });
      });

      it("Updating a company config", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
            mutation ($inputCompanyConfig: inputCompanyConfig!) {
              companies {
                configurations {
                  update(configurations:$inputCompanyConfig)
                }
              }
            }
            `,
            variables: {
              inputCompanyConfig: {
                company: sharedInfo.companyId,
                emailMailer: "updated",
                emailHost: "test",
                emailEncrypt: "test",
                emailFrom: "test",
                emailUsername: "test",
                emailPort: "test",
                minimumSwitchDuration: 1234,
                transfer: 1234,
                printing: 1234,
                minimumTransferDuration: 1234,
                membership: 1234,
                switch: 1234,
                bounceCheque: 1234,
                minimumNavChart: 1234,
                dividendsTax: 1234,
                exerciseTax: 1234,
                withholdingResident: 1234,
                maxJointMembers: 1234,
                vat: 1234,
                withholdingNonResident: 1234,
                withdrawal: 1234,
                duration: 1234,
                minimumWithdrawalDuration: 1234,
                smsPort: "test"
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
    });

    describe("Securities", function() {
      it("Can create a company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputCompanySecurities: inputCompanySecurities!) {
                companies {
                  securities {
                    create(security:$inputCompanySecurities){
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputCompanySecurities: {
                company: sharedInfo.companyId,
                code: "test",
                name: "test",
                type: "ADMIN",
                abbreviation: "test",
                frequency: 2,

                adminFee: 2,
                managementFee: 2,

                currency: "test",
                currencyCode: "test",

                accountNumber: 2,
                disbursementAccount: 2,

                Description: "test"
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.exist;
            expect(res.body.errors).to.not.exist;
            expect(res.body.data.companies.securities.create.id).to.exist;

            sharedInfo.securityId =
              res.body.data.companies.securities.create.id;
            done();
          });
      });

      it("Can update a company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputCompanySecurities: inputEditCompanySecurities!) {
                companies {
                  securities {
                    update(security:$inputCompanySecurities){
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputCompanySecurities: {
                id: sharedInfo.securityId,
                code: "test",
                name: "updated name",
                type: "ADMIN",
                abbreviation: "test",
                frequency: 2,

                adminFee: 2,
                managementFee: 2,

                currency: "test",
                currencyCode: "test",

                accountNumber: 2,
                disbursementAccount: 2,

                Description: "test"
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

      it("Fetch updated company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              query($inputCompanySecurities:inputEditCompanySecurities){
                security(security:$inputCompanySecurities){
                  id,
                  name
                }
              }
            `,
            variables: {
              inputCompanySecurities: {
                id: sharedInfo.securityId
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body.data.security.id).to.exist;
            expect(res.body).to.exist;
            expect(res.body.errors).to.not.exist;

            done();
          });
      });

      it("Can delete a company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputCompanySecurities: inputEditCompanySecurities!) {
                companies {
                  securities {
                    delete(security:$inputCompanySecurities){
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputCompanySecurities: {
                id: sharedInfo.securityId
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

      it("Can restore a company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputCompanySecurities: inputEditCompanySecurities!) {
                companies {
                  securities {
                    restore(security:$inputCompanySecurities){
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputCompanySecurities: {
                id: sharedInfo.securityId
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

      it("Fetch restored company security", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              query($inputCompanySecurities:inputEditCompanySecurities){
                security(security:$inputCompanySecurities){
                  id
                }
              }
            `,
            variables: {
              inputCompanySecurities: {
                id: sharedInfo.securityId
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body.data.security.id).to.exist;
            expect(res.body).to.exist;
            expect(res.body.errors).to.not.exist;

            done();
          });
      });

      describe("Expenses", function() {
        it("Can create security expenses", done => {
          chai
            .request(app)
            .post("/graph")
            .set("content-type", "application/json")
            .send({
              query: `
              mutation ($inputSecurityExpense: inputSecurityExpense!) {
                companies {
                  securities {
                    expenses{
                      create(expense:$inputSecurityExpense){
                        id
                      }
                    }
                  }
                }
              }
          `,
              variables: {
                inputSecurityExpense: {
                  name: "test",
                  minimumAmount: 2,
                  rate: 2,

                  controls: true,
                  vat: true,
                  exercise: true,

                  remark: "test",
                  security: sharedInfo.securityId
                }
              }
            })
            .end((err, res) => {
              res.should.have.status(200);
              expect(res.body).to.exist;
              expect(res.body.data.companies.securities.expenses.create.id).to
                .exist;
              expect(res.body.data.companies.securities.expenses.create.id).to
                .be.a.string;
              expect(res.body.errors).to.not.exist;

              sharedInfo.expensesId =
                res.body.data.companies.securities.expenses.create.id;
              done();
            });
        });

        it("Can fetch security expenses", done => {
          chai
            .request(app)
            .post("/graph")
            .set("content-type", "application/json")
            .send({
              query: `
              query($inputEditSecurityExpense:inputEditSecurityExpense){
                expense(expense:$inputEditSecurityExpense){
                  id
                }
              }
            `,
              variables: {
                inputEditSecurityExpense: {
                  id: sharedInfo.expensesId
                }
              }
            })
            .end((err, res) => {
              res.should.have.status(200);
              expect(res.body.data.expense.id).to.exist;
              expect(res.body).to.exist;
              expect(res.body.errors).to.not.exist;

              done();
            });
        });

        it("Can edit security expenses", done => {
          chai
            .request(app)
            .post("/graph")
            .set("content-type", "application/json")
            .send({
              query: `
              mutation ($inputEditSecurityExpense: inputEditSecurityExpense!) {
                companies {
                  securities {
                    expenses{
                      update(expense:$inputEditSecurityExpense){
                        id
                      }
                    }
                  }
                }
              }
          `,
              variables: {
                inputEditSecurityExpense: {
                  id: sharedInfo.expensesId,
                  name: "test edited",
                  minimumAmount: 2,
                  rate: 2,

                  controls: true,
                  vat: true,
                  exercise: true,

                  remark: "test",
                  security: sharedInfo.securityId
                }
              }
            })
            .end((err, res) => {
              res.should.have.status(200);
              expect(res.body).to.exist;
              expect(res.body.data.companies.securities.expenses.update.id).to
                .exist;
              expect(res.body.data.companies.securities.expenses.update.id).to
                .be.a.string;
              expect(res.body.errors).to.not.exist;

              done();
            });
        });

        it("Can delete security expenses", done => {
          chai
            .request(app)
            .post("/graph")
            .set("content-type", "application/json")
            .send({
              query: `
            mutation ($inputEditSecurityExpense: inputEditSecurityExpense!) {
              companies {
                securities {
                  expenses{
                    delete(expense:$inputEditSecurityExpense){
                      id
                    }
                  }
                }
              }
            }
        `,
              variables: {
                inputEditSecurityExpense: {
                  id: sharedInfo.expensesId
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

        it("Can restore security expenses", done => {
          chai
            .request(app)
            .post("/graph")
            .set("content-type", "application/json")
            .send({
              query: `
            mutation ($inputEditSecurityExpense: inputEditSecurityExpense!) {
              companies {
                securities {
                  expenses{
                    restore(expense:$inputEditSecurityExpense){
                      id
                    }
                  }
                }
              }
            }
        `,
              variables: {
                inputEditSecurityExpense: {
                  id: sharedInfo.expensesId
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

        it("Can fetch restored security expenses", done => {
          done();
        });
      });
    });

    describe("Agents", function() {
      it("Can create an agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputAgents: inputAgents!) {
                companies {
                  agents{
                    create(agent: $inputAgents) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputAgents: {
                surname: "test",
                othername: "test",
                dob: "2/2/2002",
                gender: "test",
                agentType: "test",
                bank: "test",
                bankAccountNumber: 234,
                postalAddress: "test",
                kraPinNo: 123,
                idPassportNumber: 123,
                mobileNumber: 123,
                email: "test",
                agentCategory: "test",
                bankBranch: "test",
                postalCode: 123,
                physicalAddress: "test"
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.not.be.null;
            expect(res.body.errors).to.not.exist;
            expect(res.body.data.companies.agents.create.id).to.be.a.string;

            sharedInfo.agentId = res.body.data.companies.agents.create.id;

            done();
          });
      });

      it("Can edit an agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditAgents: inputEditAgents!) {
                companies {
                  agents{
                    update(agent: $inputEditAgents) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditAgents: {
                id: sharedInfo.agentId,
                surname: "test edit",
                othername: "test",
                dob: "2/2/2002",
                gender: "test",
                agentType: "test",
                bank: "test",
                bankAccountNumber: 234,
                postalAddress: "test",
                kraPinNo: 123,
                idPassportNumber: 123,
                mobileNumber: 123,
                email: "test",
                agentCategory: "test",
                bankBranch: "test",
                postalCode: 123,
                physicalAddress: "test"
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.not.be.null;
            expect(res.body.errors).to.not.exist;
            expect(res.body.data.companies.agents.update.id).to.be.a.string;

            done();
          });
      });

      it("Can delete an agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditAgents: inputEditAgents!) {
                companies {
                  agents{
                    delete(agent: $inputEditAgents) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditAgents: {
                id: sharedInfo.agentId
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

      it("Can restore an agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditAgents: inputEditAgents!) {
                companies {
                  agents{
                    restore(agent: $inputEditAgents) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditAgents: {
                id: sharedInfo.agentId
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

      it("Can fetch a restored agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `query($inputEditAgents:inputEditAgents){
            agent(agent:$inputEditAgents){
              id,
              surname
            }
          }
          `,
            variables: {
              inputEditAgents: {
                id: sharedInfo.agentId
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.exist;
            expect(res.body.data.agent.surname).to.exist;
            expect(res.body.errors).to.not.exist;

            done();
          });
      });
    });

    describe("Members", function() {
      it("Can create an member", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputMembers: inputMembers!) {
                companies {
                  members{
                    create(member: $inputMembers) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputMembers: {
                name: "name",
                mobile: 123,
                email: "test@gmail.com",
                regDate: "1233",
                confirmed: false
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.not.be.null;
            expect(res.body.errors).to.not.exist;
            expect(res.body.data.companies.members.create.id).to.be.a.string;

            sharedInfo.memberId = res.body.data.companies.members.create.id;

            done();
          });
      });

      it("Can edit an member", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditMembers: inputEditMembers!) {
                companies {
                  members{
                    update(member: $inputEditMembers) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditMembers: {
                id: sharedInfo.memberId,
                name: "name updated",
                mobile: 123,
                email: "test@gmail.com",
                regDate: "1233",
                confirmed: false
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.not.be.null;
            expect(res.body.errors).to.not.exist;
            expect(res.body.data.companies.members.update.id).to.be.a.string;

            done();
          });
      });

      it("Can delete an member", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditMembers: inputEditMembers!) {
                companies {
                  members{
                    delete(member: $inputEditMembers) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditMembers: {
                id: sharedInfo.memberId
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

      it("Can restore an member", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `
              mutation ($inputEditMembers: inputEditMembers!) {
                companies {
                  members{
                    restore(member: $inputEditMembers) {
                      id
                    }
                  }
                }
              }
          `,
            variables: {
              inputEditMembers: {
                id: sharedInfo.memberId
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

      it("Can fetch a restored agent", done => {
        chai
          .request(app)
          .post("/graph")
          .set("content-type", "application/json")
          .send({
            query: `query($inputEditMembers:inputEditMembers){
                member(member:$inputEditMembers){
                  id,
                  name
                }
              }
            `,
            variables: {
              inputEditMembers: {
                id: sharedInfo.memberId
              }
            }
          })
          .end((err, res) => {
            res.should.have.status(200);
            expect(res.body).to.exist;
            expect(res.body.data.member.name).to.exist;
            expect(res.body.data.member.id).to.exist;
            expect(res.body.errors).to.not.exist;

            done();
          });
      });
    });
  });
});
