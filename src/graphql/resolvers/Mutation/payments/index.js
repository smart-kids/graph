import { ObjectId } from "mongodb";
var request = require("request-promise");
var fetch = require("node-fetch")

const { name } = require("./about.js");

const { UserError } = require("graphql-errors");

const init = async (data, { db: { collections } }) => {

  const { payment: { id, phone, ammount } } = data
  var jar = request.jar();
  jar.setCookie(request.cookie("connect.sid=s%253A1GKmr59wh9aH8XfBPuVW0dM9V-I0KDG1.%252BpjFq%252BqzW9yrYcrIA8RuWeszRWN4SN0FvFljnnpOeHI"), "http://localhost:4000/graph");

  var options = {
    method: 'POST',
    url: 'https://benefactor-kenya.herokuapp.com/payment/start',
    body: { phone, amount: ammount, project: '12345' },
    json: true
  };

  const res = await request(options);

  return res.data
};


const confirm = async (data, { db: { collections } }) => {
  const { payment: { CheckoutRequestID, MerchantRequestID, school } } = data

  var options = {
    method: 'POST',
    url: 'https://benefactor-kenya.herokuapp.com/payment/check',
    body: {
      CheckoutRequestID,
      MerchantRequestID
    },
    json: true
  };

  try {
    const res = await request(options);

    const { success, data: { ResultDesc: message } = {} } = res

    // make an entry into the payments collection
    console.log(res)
    const meta = JSON.parse(res.data.meta).Item

    meta.map(({Name,Value})=>{

    })
    // const id = new ObjectId().toHexString();
    // const entry = Object.assign(data[name], { id, isDeleted: false });

  
    // school: ,
    // ammount: ,
    // type: ,
    // acc: ,
    // ref: ,
    // time: ,

    // {
    //   success: true,
    //   data: {
    //     _id: '5fa97fbecfe35300170e112d',
    //     id: '5fa97fbe6ebd7a00172ee817',
    //     MerchantRequestID: '9258-60408806-1',
    //     CheckoutRequestID: 'ws_CO_09112020204213757172',
    //     ResultCode: '0',
    //     ResultDesc: 'The service request is processed successfully.',
    //     meta: '{"Item":[{"Name":"Amount","Value":2},{"Name":"MpesaReceiptNumber","Value":"OK94CNHIXQ"},{"Name":"TransactionDate","Value":20201109204258},{"Name":"PhoneNumber","Value":254711657108}]}'
    //   }
    // }

    return {
      success,
      message
    }

  } catch (err) {
    console.log(err.error)

    const { success, data: { ResultDesc: message } = {} } = err.error
    return {
      success,
      message
    }
  }
};

const create = async (data, { db: { collections } }) => {

  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  try {
    await collections[name].create(entry);

    return entry;
  } catch (err) {
    console.log(err)
    throw new UserError(err.details);
  }
};

// const update = async (data, { db: { collections } }) => {
//   const { id } = data[name];
//   const entry = data[name];

//   // stringify actions - contains a hbs templates for sms and email
//   entry.actions = JSON.stringify(entry.actions);

//   try {
//     delete entry.id;

//     await collections[name].update({ id }).set(entry);

//     return {
//       id
//     };
//   } catch (err) {
//     throw new UserError(err.details);
//   }
// };

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: true });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: false });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    // update,
    archive,
    restore,
    init,
    confirm
  };
};
