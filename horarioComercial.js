const { format } = require('date-fns');

// Função para verificar se é horário comercial (entre 08:00 e 18:00)
const isBusinessHours = (date) => {
    const hour = date.getHours();
    return hour >= 8 && hour < 18;
};

// Função para verificar se é dia útil (segunda a sexta)
const isBusinessDay = (date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Segunda (1) a sexta (5)
};

// Função para avançar para o próximo dia útil, preservando os minutos
const getNextBusinessDay = (date) => {
    do {
        date.setDate(date.getDate() + 1);
    } while (!isBusinessDay(date));
    date.setHours(8); // Ajusta a hora para 08:00, mas mantém os minutos
    return date;
};

// Função para ajustar para 08:00 do mesmo dia se for antes das 08:00, preservando os minutos
const adjustForBusinessStart = (date) => {
    if (date.getHours() < 8) {
        date.setHours(8, 0, 0, 0); // Ajusta para 08:00 do mesmo dia
    }
    return date;
};

// Função para adicionar horas úteis, preservando os minutos corretamente
const addBusinessHours = (startDate, hoursToAdd) => {
    let date = new Date(startDate);
    const initialMinutes = date.getMinutes(); // Preserva os minutos

    // Se o pedido for feito entre 18:00 e 23:59, ajusta para o próximo dia útil às 08:00
    if (date.getHours() >= 18) {
        date = getNextBusinessDay(date);
        date.setMinutes(0); // Zera os minutos se estiver após o expediente
        date.setSeconds(0);
    }

    // Se o pedido for feito entre 00:00 e 07:59, ajusta para o mesmo dia, mas às 08:00
    if (date.getHours() < 8) {
        date = adjustForBusinessStart(date);
    }

    while (hoursToAdd > 0) {
        let hoursLeftToday = 18 - date.getHours(); // Horas restantes no dia útil (até as 18:00)

        // Se as horas restantes couberem no dia atual
        if (hoursToAdd <= hoursLeftToday) {
            date.setHours(date.getHours() + hoursToAdd);
            break;
        } else {
            // Adiciona as horas restantes do dia e vai para o próximo dia útil
            hoursToAdd -= hoursLeftToday;
            date.setHours(18); // Termina o expediente às 18:00
            date = getNextBusinessDay(date); // Vai para o próximo dia útil

            // Adicionar antes de preservar os minutos
            if (date.getHours() >= 8 && date.getHours() < 18) {
                date.setMinutes(initialMinutes); // Preserva os minutos apenas dentro do horário útil
            } else {
                date.setMinutes(0); // Zera os minutos fora do horário útil
            }
        }
    }

    return date;
};

const formatDate = (date) => format(date, "dd/MM/yyyy, HH:mm:ss");

const adicionar24HorasNormais = (dataUTC) => {
    let dateBrasilia = converterParaHorarioBrasilia(dataUTC);
    dateBrasilia.setUTCHours(dateBrasilia.getUTCHours() + 24);

    if (isWeekend(dateBrasilia)) {
        dateBrasilia = skipWeekend(dateBrasilia);
    }

    return converterParaUTC(dateBrasilia);
};

function converterParaHorarioBrasilia(dateUTC) {
    return new Date(dateUTC.getTime() - 3 * 60 * 60 * 1000);
}

const isWeekend = (date) => {
    const day = date.getUTCDay();
    return day === 6 || day === 0;
};

const skipWeekend = (date) => {
    const day = date.getUTCDay();
    if (day === 6) { // Sábado
        date.setUTCDate(date.getUTCDate() + 2);
    } else if (day === 0) { // Domingo
        date.setUTCDate(date.getUTCDate() + 1);
    }
    return date;
};

function converterParaUTC(dateBrasilia) {
    return new Date(dateBrasilia.getTime() + 3 * 60 * 60 * 1000);
}

module.exports = {
    addBusinessHours,
    adicionar24HorasNormais,
    formatDate
};

