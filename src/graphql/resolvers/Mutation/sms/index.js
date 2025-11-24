import sms from "../../../../utils/sms";
import Handlebars from "handlebars"; // Run: npm install handlebars

const name = "sms";

const send = async (data, { db: { collections } }) => {
  const { message: rawTemplate, parents: parentIds } = data[name];

  // We process each parent individually to personalize the message
  await Promise.all(
    parentIds.map(async (id) => {
      try {
        // 1. Fetch Parent
        // NOTE: Ensure your ORM fetches the 'students' relation if you use {{student.names}}
        // Example for Waterline/Sails: .findOne({ where: { id } }).populate('students')
        const parent = await collections["parent"].findOne({ where: { id } });

        if (!parent || !parent.phone) return;

        // 2. Prepare Data Context (matching your Frontend structure)
        // If parent.students is undefined, {{student.names}} will be blank.
        const firstStudent = (parent.students && parent.students.length > 0) 
          ? parent.students[0] 
          : {};

        const context = {
          recipient: parent, // Enables {{recipient.name}}
          parent: parent,
          student: firstStudent // Enables {{student.names}}
        };

        // 3. Compile Message
        const template = Handlebars.compile(rawTemplate);
        // Handlebars "fallback" helper might be missing on backend unless registered.
        // For safety, you can register it here or just rely on standard replacement.
        const compiledMessage = template(context);

        // 4. Send SMS
        // We log the result to ensure we see what's happening
        sms({ data: { phone: parent.phone, message: compiledMessage } }, (res) => {
            console.log(`Sent to ${parent.name}:`, res);
        });

      } catch (err) {
        console.error(`Failed to send SMS to parent ID ${id}`, err);
      }
    })
  );

  return "ok";
};

export default () => ({
  send,
});