// GraphQL Mutations Test
require("dotenv").config();
import chai from "chai";
import chaiHttp from "chai-http";
import { v4 as uuidv4 } from "uuid";

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

const sharedInfo = {};
let authorization = null;

describe("GraphQL Mutations Test Suite", () => {
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
          sharedInfo.auth = res.body;
        }
        done();
      });
  });

  describe("School Mutations", () => {
    it("Can create a school", done => {
      const schoolId = uuidv4();
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($school: ISchool!) { schools { create(school: $school) { id name phone email } } }",
          variables: {
            school: {
              id: schoolId,
              name: "Test School",
              phone: "+254712345678",
              email: "test@shuleplus.co.ke",
              address: "123 Test Street, Nairobi, Kenya",
              gradeOrder: ["One", "Two", "Three"],
              termOrder: ["One", "Two"]
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.schools.create.id).to.be.a.string;
          expect(res.body.data.schools.create.name).to.equal("Test School");
          sharedInfo.schoolId = res.body.data.schools.create.id;
          done();
        });
    });

    it("Can update a school", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($school: USchool!) { schools { update(school: $school) { id name } } }",
          variables: {
            school: {
              id: sharedInfo.schoolId,
              name: "Updated Test School"
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.schools.update.name).to.equal("Updated Test School");
          done();
        });
    });
  });

  describe("Grade Mutations", () => {
    it("Can create a grade", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($grade: Igrade!) { grades { create(grade: $grade) { id name } } }",
          variables: {
            grade: {
              id: uuidv4(),
              name: "Grade 1",
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.grades.create.id).to.be.a.string;
          expect(res.body.data.grades.create.name).to.equal("Grade 1");
          sharedInfo.gradeId = res.body.data.grades.create.id;
          done();
        });
    });
  });

  describe("Class Mutations", () => {
    it("Can create a class", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($class: Iclass!) { classes { create(class: $class) { id name } } }",
          variables: {
            class: {
              id: uuidv4(),
              name: "Class 1A",
              teacher: uuidv4(),
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.classes.create.id).to.be.a.string;
          expect(res.body.data.classes.create.name).to.equal("Class 1A");
          sharedInfo.classId = res.body.data.classes.create.id;
          done();
        });
    });
  });

  describe("Student Mutations", () => {
    it("Can create a student", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($student: Istudent!) { students { create(student: $student) { id names registration } } }",
          variables: {
            student: {
              id: uuidv4(),
              names: "Test Student",
              registration: "2024-001",
              school: sharedInfo.schoolId,
              class: sharedInfo.classId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.students.create.id).to.be.a.string;
          expect(res.body.data.students.create.names).to.equal("Test Student");
          sharedInfo.studentId = res.body.data.students.create.id;
          done();
        });
    });
  });

  describe("Parent Mutations", () => {
    it("Can create a parent", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($parent: Iparent!) { parents { create(parent: $parent) { id name } } }",
          variables: {
            parent: {
              id: uuidv4(),
              name: "Test Parent",
              phone: "+254711111111",
              email: "parent@test.com",
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.parents.create.id).to.be.a.string;
          expect(res.body.data.parents.create.name).to.equal("Test Parent");
          sharedInfo.parentId = res.body.data.parents.create.id;
          done();
        });
    });
  });

  describe("Teacher Mutations", () => {
    it("Can create a teacher", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($teacher: Iteacher!) { teachers { create(teacher: $teacher) { id name } } }",
          variables: {
            teacher: {
              id: uuidv4(),
              name: "Test Teacher",
              phone: "+254722222222",
              email: "teacher@test.com",
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.teachers.create.id).to.be.a.string;
          expect(res.body.data.teachers.create.name).to.equal("Test Teacher");
          sharedInfo.teacherId = res.body.data.teachers.create.id;
          done();
        });
    });
  });

  describe("Admin Mutations", () => {
    it("Can create an admin", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($admin: Iadmin!) { admins { create(admin: $admin) { id names } } }",
          variables: {
            admin: {
              id: uuidv4(),
              names: "Test Admin",
              email: "admin@test.com",
              phone: "+254711111111",
              password: "test123",
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.admins.create.id).to.be.a.string;
          expect(res.body.data.admins.create.names).to.equal("Test Admin");
          sharedInfo.adminId = res.body.data.admins.create.id;
          done();
        });
    });
  });

  describe("Subject Mutations", () => {
    it("Can create a subject", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($subject: Isubject!) { subjects { create(subject: $subject) { id name } } }",
          variables: {
            subject: {
              id: uuidv4(),
              name: "Mathematics",
              grade: sharedInfo.gradeId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.subjects.create.id).to.be.a.string;
          expect(res.body.data.subjects.create.name).to.equal("Mathematics");
          sharedInfo.subjectId = res.body.data.subjects.create.id;
          done();
        });
    });
  });

  describe("Book Mutations", () => {
    it("Can create a book", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($book: Ibook!) { books { create(book: $book) { id title } } }",
          variables: {
            book: {
              id: uuidv4(),
              title: "Test Book",
              author: "Test Author",
              category: "Education",
              description: "A test book",
              coverUrl: "https://via.placeholder.com/100x140.png?text=Test+Book",
              pdfUrl: "https://example.com/test.pdf",
              school: sharedInfo.schoolId
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.books.create.id).to.be.a.string;
          expect(res.body.data.books.create.title).to.equal("Test Book");
          sharedInfo.bookId = res.body.data.books.create.id;
          done();
        });
    });
  });

  describe("Payment Mutations", () => {
    it("Can create a payment", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($payment: Ipayment!) { payments { create(payment: $payment) { id amount } } }",
          variables: {
            payment: {
              id: uuidv4(),
              school: sharedInfo.schoolId,
              phone: "+254711111111",
              amount: "15000",
              status: "COMPLETED",
              type: "fees_payment",
              paymentType: "MPESA",
              student: sharedInfo.studentId,
              time: new Date().toISOString(),
              ref: "TEST001",
              resultDesc: "Test payment"
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.payments.create.id).to.be.a.string;
          expect(res.body.data.payments.create.amount).to.equal("15000");
          sharedInfo.paymentId = res.body.data.payments.create.id;
          done();
        });
    });
  });

  describe("Term Mutations", () => {
    it("Can create a term", done => {
      chai
        .request("http://localhost:4001")
        .post("/graph")
        .set("authorization", authorization)
        .set("content-type", "application/json")
        .send({
          query: "mutation ($term: Iterm!) { terms { create(term: $term) { id name } } }",
          variables: {
            term: {
              id: uuidv4(),
              name: "Term 1 2024",
              startDate: "2024-01-08",
              endDate: "2024-04-05",
              school: sharedInfo.schoolId,
              isActive: true
            }
          }
        })
        .end((err, res) => {
          res.should.have.status(200);
          expect(res.body.data.terms.create.id).to.be.a.string;
          expect(res.body.data.terms.create.name).to.equal("Term 1 2024");
          sharedInfo.termId = res.body.data.terms.create.id;
          done();
        });
    });
  });
});
