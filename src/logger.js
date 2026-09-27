// Skupni logger (pino). Zapisi so v obliki JSON, da jih Railway in druga
// orodja lahko iščejo in filtrirajo; lokalno jih berljivo izpiše pino-pretty
// (npm run dev). V testih je privzeto utišan.
const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    // Žetoni in gesla ne smejo v dnevnik
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.password'],
});

module.exports = logger;
