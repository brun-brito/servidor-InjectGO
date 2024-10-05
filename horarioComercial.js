const { DateTime } = require('luxon');

// Função para verificar se um dia é útil (segunda a sexta)
function isBusinessDay(date) {
    const weekday = date.weekday;
    return weekday >= 1 && weekday <= 5; // Segunda (1) a Sexta (5)
}

function calcularProximoHorarioUtil(dataAtual, horasAdicionais) {
    let datetime = DateTime.fromJSDate(dataAtual, { zone: 'America/Sao_Paulo' });

    const WORK_START_HOUR = 8;
    const WORK_END_HOUR = 18;

    while (horasAdicionais > 0) {
        if (isBusinessDay(datetime)) {
            const currentHour = datetime.hour;
            const currentMinute = datetime.minute;

            // Calcula quantos minutos faltam para o final do expediente
            const remainingMinutesToday = Math.max(0, (WORK_END_HOUR * 60) - (currentHour * 60 + currentMinute));

            if (currentHour >= WORK_START_HOUR && currentHour < WORK_END_HOUR) {
                // Converte horas a adicionar para minutos e compara com os minutos restantes do expediente
                const minutesToAddToday = Math.min(horasAdicionais * 60, remainingMinutesToday);
                datetime = datetime.plus({ minutes: minutesToAddToday });
                horasAdicionais -= minutesToAddToday / 60;
            }

            // Caso horas ainda precisem ser adicionadas, mover para o próximo dia útil
            if (horasAdicionais > 0) {
                datetime = datetime.plus({ days: 1 }).set({ hour: WORK_START_HOUR, minute: 0 });
            }
        } else {
            // Se for fim de semana, pular para a próxima segunda-feira
            datetime = datetime.plus({ days: 1 }).set({ hour: WORK_START_HOUR, minute: 0 });
        }
    }

    return datetime.toFormat('yyyy-MM-dd HH:mm');
}

function somarHorasUteis(data, horasUteis) {
    let datetime = DateTime.fromISO(data.toISOString(), { zone: 'America/Sao_Paulo' });
    const WORK_START_HOUR = 8;
    const WORK_END_HOUR = 18;

    while (horasUteis > 0) {
        if (isBusinessDay(datetime)) {
            const currentHour = datetime.hour;
            const currentMinute = datetime.minute;

            const remainingMinutesToday = Math.max(0, (WORK_END_HOUR * 60) - (currentHour * 60 + currentMinute));

            if (currentHour >= WORK_START_HOUR && currentHour < WORK_END_HOUR) {
                const minutesToAddToday = Math.min(horasUteis * 60, remainingMinutesToday);
                datetime = datetime.plus({ minutes: minutesToAddToday });
                horasUteis -= minutesToAddToday / 60;
            }

            if (horasUteis > 0) {
                datetime = datetime.plus({ days: 1 }).set({ hour: WORK_START_HOUR, minute: 0 });
            }
        } else {
            datetime = datetime.plus({ days: 1 }).set({ hour: WORK_START_HOUR, minute: 0 });
        }
    }

    return datetime.toJSDate();
}

function avancar24Horas(dataAtual) {
    let datetime = DateTime.fromJSDate(dataAtual, { zone: 'America/Sao_Paulo' });
    datetime = datetime.plus({ hours: 24 });

    if (!isBusinessDay(datetime)) {
        if (datetime.weekday === 6) {
            datetime = datetime.plus({ days: 2 }).set({ hour: datetime.hour, minute: datetime.minute });
        }
        else if (datetime.weekday === 7) {
            datetime = datetime.plus({ days: 1 }).set({ hour: datetime.hour, minute: datetime.minute });
        }
    }

    return datetime.toFormat('yyyy-MM-dd HH:mm');
}

module.exports = {
    calcularProximoHorarioUtil,
    somarHorasUteis,
    avancar24Horas
};
