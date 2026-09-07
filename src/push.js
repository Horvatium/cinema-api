const https = require('https');

// Pošlji potisno obvestilo prek Expove storitve za potisna obvestila
const sendPushNotification = async (pushToken, title, body, data = {}) => {
    // Brez veljavnega Expovega žetona nimamo kam poslati — tiho končamo,
    // da klicoča koda ne rabi preverjati vsakega primera posebej
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        return;
    }

    // Oblika sporočila, kot jo pričakuje Expova storitev
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

    // Obljubo vedno razrešimo (tudi ob napaki), nikoli ne zavrnemo —
    // neuspelo obvestilo ne sme prekiniti rezervacije ali odpovedi predvajanja
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Potisno obvestilo poslano na ${pushToken}: ${title}`);
                resolve(data);
            });
        });

        // Napako pri omrežju samo zabeležimo in nadaljujemo
        req.on('error', (err) => {
            console.error('Napaka pri pošiljanju potisnega obvestila:', err.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
};

module.exports = { sendPushNotification };