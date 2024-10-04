const { DateTime } = require('luxon');

// Função para verificar se um dia é útil (segunda a sexta)
function isBusinessDay(date) {
    const weekday = date.weekday;
    return weekday >= 1 && weekday <= 5; // Segunda (1) a Sexta (5)
}

// Função para calcular o próximo horário útil
function calcularProximoHorarioUtil(dataAtual, horasAdicionais) {
    let datetime = DateTime.fromJSDate(dataAtual, { zone: 'America/Sao_Paulo' });

    const WORK_START_HOUR = 8;
    const WORK_END_HOUR = 18;

    // Enquanto houver horas a adicionar, iteramos
    while (horasAdicionais > 0) {
        // Verifica se é um dia útil
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

// Função para somar horas úteis a um horário específico, incluindo minutos
function somarHorasUteis(data, horasUteis) {
    let datetime = DateTime.fromISO(data.toISOString(), { zone: 'America/Sao_Paulo' }); // Converta a data para ISO
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

    return datetime.toJSDate(); // Retorna um objeto Date
}

function avancar24Horas(dataAtual) {
    let datetime = DateTime.fromJSDate(dataAtual, { zone: 'America/Sao_Paulo' });

    // Avançar 24 horas
    datetime = datetime.plus({ hours: 24 });

    // Verificar se cai no fim de semana
    if (!isBusinessDay(datetime)) {
        // Se for sábado, pular para segunda-feira (48 horas depois)
        if (datetime.weekday === 6) {
            datetime = datetime.plus({ days: 2 }).set({ hour: datetime.hour, minute: datetime.minute });
        }
        // Se for domingo, pular para segunda-feira (24 horas depois)
        else if (datetime.weekday === 7) {
            datetime = datetime.plus({ days: 1 }).set({ hour: datetime.hour, minute: datetime.minute });
        }
    }

    return datetime.toFormat('yyyy-MM-dd HH:mm');
}
const agora = new Date(); // Horário atual
const horasParaAdicionar = 5;

console.log(`Próximo horário útil após ${horasParaAdicionar} horas:`, calcularProximoHorarioUtil(agora, horasParaAdicionar));

const horasUteis = 5; // Adicionar 2 horas e 30 minutos úteis
const inicioDiaUtil = new Date('2024-10-07T11:49:09.581Z'); // Exemplo de início
console.log(`Somando ${horasUteis} horas úteis ao horário ${inicioDiaUtil}:`, somarHorasUteis(inicioDiaUtil, horasUteis));

// Usando a nova função para avançar 24 horas
console.log(`Avançando 24 horas (pulando fim de semana):`, avancar24Horas(agora));

module.exports = {
    calcularProximoHorarioUtil,
    somarHorasUteis,
    avancar24Horas
};
