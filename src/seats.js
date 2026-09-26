// Preveri, ali so zahtevani sedeži veljavni za dano dvorano: seznam mora biti
// neprazen, brez ponovitev, vsi sedeži pa morajo obstajati v dvorani predstave.
// Brez tega bi odjemalec lahko rezerviral sedež iz druge dvorane ali isti
// sedež navedel dvakrat in ga plačal dvojno. Vrne sporočilo o napaki ali null.
const preveriSedeze = async (connection, roomId, seatIds) => {
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        return 'Izberite vsaj en sedež.';
    }
    if (new Set(seatIds.map(Number)).size !== seatIds.length) {
        return 'Isti sedež je izbran večkrat.';
    }

    const [seats] = await connection.query('SELECT id FROM seats WHERE room_id = ? AND id IN (?)', [
        roomId,
        seatIds,
    ]);
    if (seats.length !== seatIds.length) {
        return 'Izbrani sedeži ne pripadajo dvorani te predstave.';
    }

    return null;
};

module.exports = { preveriSedeze };
