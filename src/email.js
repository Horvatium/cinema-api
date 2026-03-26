const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

const reservationConfirmedEmail = (user, film, screening, seats, total) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `🎬 Booking Confirmed — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0; 
            border-radius: 10px; overflow: hidden;">
            
            <!-- Header -->
            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 CinemaApp
                </h1>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Booking Confirmed!
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Hi ${user.first_name}, your seats are reserved. 
                    See you at the cinema!
                </p>

                <!-- Booking Details -->
                <div style="background: #1a1a1a; border-radius: 8px; 
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Booking Details
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Date</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Time</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Room</td>
                            <td style="color: #fff;">${screening.room_name}</td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Seats</td>
                            <td style="color: #fff;">${seats}</td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Total</td>
                            <td style="color: #e50914; font-weight: bold; 
                                font-size: 18px;">
                                €${total}
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #aaa; font-size: 13px; text-align: center;">
                    Please arrive 15 minutes before the screening starts.
                </p>
            </div>

            <!-- Footer -->
            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    CinemaApp · You are receiving this because you made a booking
                </p>
            </div>
        </div>
    `
});

const reservationCancelledEmail = (user, film, screening) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `❌ Reservation Cancelled — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0;
            border-radius: 10px; overflow: hidden;">

            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 CinemaApp
                </h1>
            </div>

            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Reservation Cancelled
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Hi ${user.first_name}, your reservation has been cancelled.
                </p>

                <div style="background: #1a1a1a; border-radius: 8px; 
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Cancelled Booking
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Date</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Time</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                }
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #aaa; font-size: 14px;">
                    We hope to see you at a future screening!
                </p>
            </div>

            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    CinemaApp · You are receiving this because you 
                    cancelled a booking
                </p>
            </div>
        </div>
    `
});

const screeningDeletedEmail = (user, film, screening) => ({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `⚠️ Screening Cancelled — ${film}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
            margin: 0 auto; background: #0a0a0a; color: #f0f0f0;
            border-radius: 10px; overflow: hidden;">

            <div style="background: #e50914; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 24px;">
                    🎬 CinemaApp
                </h1>
            </div>

            <div style="padding: 32px;">
                <h2 style="color: #fff; margin-bottom: 8px;">
                    Screening Cancelled
                </h2>
                <p style="color: #aaa; margin-bottom: 24px;">
                    Hi ${user.first_name}, we are sorry to inform you that 
                    the following screening has been cancelled by the cinema.
                    Your reservation has been automatically cancelled.
                </p>

                <div style="background: #1a1a1a; border-radius: 8px;
                    padding: 20px; margin-bottom: 24px;">
                    <h3 style="color: #e50914; margin: 0 0 16px 0;">
                        Cancelled Screening
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Film</td>
                            <td style="color: #fff; font-weight: bold;">
                                ${film}
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Date</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                                }
                            </td>
                        </tr>
                        <tr>
                            <td style="color: #aaa; padding: 6px 0;">Time</td>
                            <td style="color: #fff;">
                                ${new Date(screening.start_time)
                                    .toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                }
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #aaa; font-size: 14px;">
                    We apologise for the inconvenience. 
                    We hope to see you at a future screening!
                </p>
            </div>

            <div style="background: #111; padding: 16px; text-align: center;">
                <p style="color: #555; font-size: 12px; margin: 0;">
                    CinemaApp · This screening was cancelled by the cinema
                </p>
            </div>
        </div>
    `
});

// ─── SEND FUNCTION ────────────────────────────────────────────────────────────

const sendEmail = async (mailOptions) => {
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${mailOptions.to}`);
    } catch (err) {
        // Log but don't crash the app if email fails
        console.error('Email send error:', err.message);
    }
};

module.exports = {
    sendReservationConfirmed: (user, film, screening, seats, total) =>
        sendEmail(reservationConfirmedEmail(user, film, screening, seats, total)),

    sendReservationCancelled: (user, film, screening) =>
        sendEmail(reservationCancelledEmail(user, film, screening)),

    sendScreeningDeleted: (user, film, screening) =>
        sendEmail(screeningDeletedEmail(user, film, screening)),
};