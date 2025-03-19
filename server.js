const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const rateLimiter = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const emailRoutes = require('./routes/emailRoutes');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(rateLimiter);
app.use('/api', emailRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
