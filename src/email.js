require('dotenv').config();
const db = require('./db');
const { Resend } = require('resend');
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
const formatPrice = (value) =>
  `${Number(value).toFixed(2).replace(".", ",")} €`;


// Zabeleži izid pošiljanja v podatkovno bazo
const zabeleziPosiljanje = async (mailOptions, status, napaka = null) => {
    try {
        await db.query(
            `INSERT INTO email_log (recipient, subject, status, error_message)
             VALUES (?, ?, ?, ?)`,
            [mailOptions.to, mailOptions.subject, status, napaka]
        );
    } catch (err) {
        // Napaka pri beleženju ne sme vplivati na pošiljanje
        console.error('Napaka pri beleženju e-pošte:', err.message);
    }
};

// PREDLOGE E-POŠTNIH SPOROČIL

const reservationConfirmedEmail = (user, film, screening, seats, total) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `🎬 Rezervacija potrjena — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0; 
            border-radius: 10px; overflow: hidden;">
            
            <!-- Glava -->
            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 KinoPlex
                </h1>
            </div>

            <!-- Vsebina -->
            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Rezervacija potrjena!
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Pozdravljeni, ${user.first_name}, vaši sedeži so rezervirani.
                    Se vidimo v kinu!
                </p>

                <!-- Podrobnosti rezervacije -->
                <div style="background: #1a1a1a; border-radius: 8px; 
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Podrobnosti rezervacije
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Datum</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('sl-SI', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Ura</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString('sl-SI', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Dvorana</td>
                            <td style="color: #fff;">${screening.room_name}</td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Sedeži</td>
                            <td style="color: #fff;">${seats}</td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Skupaj</td>
                            <td style="color: #e50914; font-weight: bold; 
                                font-size: 18px;">
                                ${formatPrice(total)}
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #aaa; font-size: 13px; text-align: center;">
                    Prosimo, pridite 15 minut pred začetkom predvajanja.
                </p>
            </div>

            <!-- Noga -->
            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    KinoPlex · To sporočilo ste prejeli, ker ste opravili rezervacijo
                </p>
            </div>
        </div>
    `
});

const reservationCancelledEmail = (user, film, screening) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `❌ Rezervacija preklicana — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0;
            border-radius: 10px; overflow: hidden;">

            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 KinoPlex
                </h1>
            </div>

            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Rezervacija preklicana
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Pozdravljeni, ${user.first_name}, vaša rezervacija je bila preklicana.
                </p>

                <div style="background: #1a1a1a; border-radius: 8px; 
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Preklicana rezervacija
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Datum</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('sl-SI', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Ura</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString('sl-SI', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #aaa; font-size: 14px;">
                    Upamo, da vas vidimo na kakšnem prihodnjem predvajanju!
                </p>
            </div>

            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    KinoPlex · To sporočilo ste prejeli, ker ste 
                    preklicali rezervacijo
                </p>
            </div>
        </div>
    `
});

const screeningDeletedEmail = (user, film, screening, refundInfo = {}) => {
    const { refunded = false, total_price = null } = refundInfo;
    const zneseBesedilo = total_price !== null
        ? `znesek ${formatPrice(total_price)}`
        : 'znesek vaše rezervacije';

    const vracilnoSporocilo = refunded
        ? `💳 Vrnili smo vam ${zneseBesedilo} na kartico, s katero ste plačali. `
            + `Sredstva bodo predvidoma vidna v nekaj delovnih dneh.`
        : `💳 Za vračilo zneska (${zneseBesedilo}) vas bomo kontaktirali ločeno.`;

    return {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `⚠️ Predvajanje odpovedano — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0;
            border-radius: 10px; overflow: hidden;">

            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 KinoPlex
                </h1>
            </div>

            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Predvajanje odpovedano
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Pozdravljeni, ${user.first_name}, žal vas moramo obvestiti, da je
                    kinematograf odpovedal spodnje predvajanje.
                    Vaša rezervacija je bila samodejno preklicana.
                </p>

                <div style="background: #1a1a1a; border-radius: 8px;
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Odpovedano predvajanje
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Datum</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('sl-SI', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Ura</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString('sl-SI', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                        timeZone: 'UTC',
                                    })
                                }
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="background: ${refunded ? 'rgba(0,201,177,0.08)' : 'rgba(229,9,20,0.08)'};
                    border: 1px solid ${refunded ? 'rgba(0,201,177,0.3)' : 'rgba(229,9,20,0.3)'};
                    border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #fff; font-size: 14px;">
                        ${vracilnoSporocilo}
                    </p>
                </div>

                <p style="color: #aaa; font-size: 14px;">
                    Opravičujemo se za nevšečnosti.
                    Upamo, da vas vidimo na kakšnem prihodnjem predvajanju!
                </p>
            </div>

            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    KinoPlex · To predvajanje je odpovedal kinematograf
                </p>
            </div>
        </div>
    `
    };
};

const verifyEmailTemplate = (user, link) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Potrdite svoj elektronski naslov — KinoPlex',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Pozdravljeni, ${user.first_name}!</h2>
            <p>Za dokončanje registracije v sistemu KinoPlex potrdite svoj
               elektronski naslov s klikom na spodnjo povezavo.</p>
            <p style="margin: 24px 0;">
                <a href="${link}"
                   style="background:#e50914;color:#fff;padding:12px 24px;
                          text-decoration:none;border-radius:6px;">
                    Potrdi elektronski naslov
                </a>
            </p>
            <p style="color:#666;font-size:13px;">
                Če povezava ne deluje, jo prilepite v brskalnik:<br>${link}
            </p>
        </div>
    `
});

// FUNKCIJA ZA POŠILJANJE
const sendEmail = async (mailOptions) => {
    if (!resend) {
        console.error('RESEND_API_KEY ni nastavljen — e-pošta ni poslana.');
        return;
    }

    if (!mailOptions.from) {
        console.error('EMAIL_FROM ni nastavljen — e-pošta ni poslana.');
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
        });

        if (error) {
            const sporocilo = error.message || JSON.stringify(error);
            console.error('Napaka pri pošiljanju e-pošte:', sporocilo);
            await zabeleziPosiljanje(mailOptions, 'failed', sporocilo);
            return;
        }

        console.log(`E-pošta poslana (id: ${data?.id})`);
        await zabeleziPosiljanje(mailOptions, 'sent');
    } catch (err) {
        // Napako zabeleži, a ne dovoli, da bi zrušila aplikacijo
        console.error('Napaka pri pošiljanju e-pošte:', err.message);
        await zabeleziPosiljanje(mailOptions, 'failed', err.message);
    }
};

module.exports = {
    sendReservationConfirmed: (user, film, screening, seats, total) =>
        sendEmail(reservationConfirmedEmail(user, film, screening, seats, total)),

    sendReservationCancelled: (user, film, screening) =>
        sendEmail(reservationCancelledEmail(user, film, screening)),

    sendScreeningDeleted: (user, film, screening, refundInfo) =>
        sendEmail(screeningDeletedEmail(user, film, screening, refundInfo)),

    sendVerifyEmail: (user, link) =>
        sendEmail(verifyEmailTemplate(user, link))


};