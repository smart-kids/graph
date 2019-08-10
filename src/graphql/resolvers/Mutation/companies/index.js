const create = async (root, { db: { collections } }) => {
  console.log({});

  var test = await collections.test.create({
    id: "beagle" + Math.random(),
    foo: "dog"
  });

  console.log(test)

  return {
    id: "test"
  };
};

export default () => {
  return {
    create
  };
};
