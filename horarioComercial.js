const { format } = require('date-fns');
const { admin, db } = require('./firebaseConfig');

// Função para verificar se é horário comercial (08:00 a 18:00 no horário de Brasília)
const isBusinessHours = (date) => {
    const hour = date.getUTCHours() - 3; // Ajuste para o UTC-3 (horário de Brasília)
    return hour >= 8 && hour < 18;
};

// Função para verificar se é dia útil (segunda a sexta)
const isBusinessDay = (date) => {
    const day = date.getUTCDay(); // UTC-based
    return day >= 1 && day <= 5; // Segunda (1) a sexta (5)
};

// Função para avançar para o próximo dia útil, preservando os minutos no fuso horário de Brasília
const getNextBusinessDay = (date) => {
    do {
        date.setUTCDate(date.getUTCDate() + 1);
    } while (!isBusinessDay(date));

    date.setUTCHours(8 + 3, 0, 0, 0); // Ajusta a hora para 08:00 no horário de Brasília (UTC-3)
    return date;
};

// Função para ajustar para 08:00 do mesmo dia se for antes das 08:00 no horário de Brasília
const adjustForBusinessStart = (date) => {
    const hour = date.getUTCHours() - 3; // Ajusta para UTC-3
    if (hour < 8) {
        date.setUTCHours(8 + 3, 0, 0, 0); // Ajusta para 08:00 no horário de Brasília
    }
    return date;
};

// Função para adicionar horas úteis, preservando os minutos corretamente no fuso horário de Brasília
const addBusinessHours = (startDate, hoursToAdd) => {
    let date = new Date(startDate.getTime());
    const initialMinutes = date.getMinutes(); // Preserva os minutos

    // Se o pedido for feito entre 18:00 e 23:59 no horário de Brasília
    if (date.getUTCHours() - 3 >= 18) {
        date = getNextBusinessDay(date);
        date.setUTCMinutes(0); // Zera os minutos
        date.setUTCSeconds(0);
    }

    // Se o pedido for feito entre 00:00 e 07:59 no horário de Brasília
    if (date.getUTCHours() - 3 < 8) {
        date = adjustForBusinessStart(date);
    }

    while (hoursToAdd > 0) {
        let hoursLeftToday = 18 - (date.getUTCHours() - 3); // Horas restantes no dia útil no horário de Brasília

        if (hoursToAdd <= hoursLeftToday) {
            date.setUTCHours(date.getUTCHours() + hoursToAdd);
            break;
        } else {
            hoursToAdd -= hoursLeftToday;
            date.setUTCHours(18 + 3); // Termina o expediente às 18:00 no horário de Brasília
            date = getNextBusinessDay(date); // Vai para o próximo dia útil

            date.setUTCMinutes(initialMinutes); // Preserva os minutos dentro do horário útil
        }
    }

    return date;
};

// Função para formatar a data no formato desejado
const formatDate = (date) => format(date, "dd/MM/yyyy, HH:mm:ss");

// Exemplo de uso:
const dataAtual = new Date('2024-10-04T07:20:00.000');
console.log((dataAtual));
console.log((admin.firestore.Timestamp.fromDate(dataAtual).toDate()));
const horasAdicionadas = addBusinessHours(dataAtual, 2);
console.log((horasAdicionadas));
console.log((admin.firestore.Timestamp.fromDate(horasAdicionadas).toDate()));


module.exports = {
    addBusinessHours,
    formatDate,
};
