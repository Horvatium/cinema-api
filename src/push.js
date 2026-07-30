const https = require('https');

// Pošlji potisno obvestilo prek Expove storitve za potisna obvestila
const sendPushNotification = async (pushToken, title, body, data = {}) => {
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    const payload = JSON.stringify(message);

    const options = {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Potisno obvestilo poslano na ${pushToken}: ${title}`);
                resolve(data);
            });
        });

        req.on('error', (err) => {
            console.error('Napaka pri pošiljanju potisnega obvestila:', err.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
};

module.exports = { sendPushNotification };