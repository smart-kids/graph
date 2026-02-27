export const nested = {
    PaymentRecord: {
        student: async (root, args, { loaders }) => {
            console.log(`[RESOLVER CALL] Queuing 'student' lookup for PaymentRecord ID: ${root.id}`);
            if (!root.student) return null;
            // The loader efficiently fetches the student based on the ID stored in the DB
            return loaders.studentById.load(root.student);
        }
    }
};
