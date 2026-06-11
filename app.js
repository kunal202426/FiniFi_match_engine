require('dotenv').config();
const express = require('express');
const connect = require('./src/db');
const documentRoutes = require('./src/routes/documents');
const matchRoutes = require('./src/routes/match');

const app = express();
app.use(express.json());

app.use('/documents', documentRoutes);
app.use('/match', matchRoutes);

const PORT = process.env.PORT || 3000;

connect().then(() => {
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
});
