// Vstopna točka zalednega sistema: naloži aplikacijo in zažene strežnik.
const app = require('./src/app');
const logger = require('./src/logger');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Strežnik deluje');
});
