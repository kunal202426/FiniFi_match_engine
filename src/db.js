const mongoose = require('mongoose');

const connect = async() => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDb connected');
};

module.exports = connect;