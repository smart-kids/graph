module.exports = (socket) => {
    // Accept a login event with user's data
    socket.on("login", function (userdata) {
        console.log(socket.id, " login")
        socket.handshake.session.userdata = userdata;
        socket.handshake.session.save();
    });
    socket.on("logout", function (userdata) {
        console.log(socket.id, " logout")
        if (socket.handshake.session.userdata) {
            delete socket.handshake.session.userdata;
            socket.handshake.session.save();
        }
    });
}