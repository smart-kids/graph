const geolib = require('geolib');

const students = [
    "-1.138607, 36.986749",
    "-1.139488, 36.986405"
]

const bus = "-1.138897, 36.987063"

const { getDistance } = require('geolib')

const run = async () => {
    await Promise.all(students.map((student, i) => {
        const [longitude, latitude] = student.split(",")
        const [blongitude, blatitude] = bus.split(",")
        const distance = getDistance({
            longitude,
            latitude
        }, {
            longitude: blongitude,
            latitude: blatitude
        })

        console.log(`student ${i} is ${distance} meters away.`)
    }))
}

run().catch(console.log)