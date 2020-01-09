import sms from "../../../../utils/sms"
const name = "sms"

const send = async (data, { db: { collections }}) => {
  const { message, parents: parentIds } = data[name]

  const phones = await Promise.all(parentIds.map(async id => {
    const parent = await collections["parent"].findOne({ where : { id }})
    return parent.phone
  }))

  phones.map(phone => sms({ data: { phone, message }}, console.log))

  return "ok"
}

export default () => ({
  send
})