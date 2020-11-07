import { ObjectId } from "mongodb";
var request = require("request-promise");

const { name } = require("./about.js");

const { UserError } = require("graphql-errors");

const init = async (data, { db: { collections } }) => {

  var jar = request.jar();
  jar.setCookie(request.cookie("connect.sid=s%253A1GKmr59wh9aH8XfBPuVW0dM9V-I0KDG1.%252BpjFq%252BqzW9yrYcrIA8RuWeszRWN4SN0FvFljnnpOeHI"), "http://localhost:4000/graph");

  var options = {
    method: 'POST',
    url: 'https://benefactor-kenya.herokuapp.com/payment/start',
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.5',
      referer: 'https://benefactor-kenya.herokuapp.com/@beatrice_kuria/buy-parantal-empowerment-and-engagement-in-new-kanya-CBC-book',
      'content-type': 'application/json',
      origin: 'https://benefactor-kenya.herokuapp.com',
      connection: 'keep-alive',
      pragma: 'no-cache',
      'cache-control': 'no-cache'
    },
    body: { phone: '0711657108', amount: 20, project: '12345' },
    json: true
  };

  const res = await request(options);

  return res.data
};


const confirm = async (data, { db: { collections } }) => {
  var options = {
    method: 'POST',
    url: 'https://benefactor-kenya.herokuapp.com/payment/check',
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.5',
      referer: 'https://benefactor-kenya.herokuapp.com/@beatrice_kuria/buy-parantal-empowerment-and-engagement-in-new-kanya-CBC-book',
      'content-type': 'application/json',
      origin: 'https://benefactor-kenya.herokuapp.com',
      connection: 'keep-alive',
      pragma: 'no-cache',
      'cache-control': 'no-cache'
    },
    body: {
      CheckoutRequestID: 'ws_CO_07112020183301770885',
      MerchantRequestID: '11473-60586661-1'
    },
    json: true
  };

  try {
    const res = await request(options);

    console.log(res.data)
    return res.data
  } catch (err) {
    console.log(err)
    return {
      success:false,
      message:err.error.data.ResultDesc
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
