// Vstopna točka zalednega sistema: naloži aplikacijo in zažene strežnik.
const app = require('./src/app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Strežnik deluje na portu ${PORT}`);
});
