const axios = require('axios');
require('dotenv').config();

async function verificarPagamento(paymentId) {
    try {
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer APP_USR-3686677339330781-091008-aea413fcc1713ef2b91932b6b017fdcb-1983286839`
            }
        });

        // O external_reference é utilizado para identificar o distribuidor
        return {
            status: response.data.status,
            distributorId: response.data.external_reference  // Obtendo o distribuidor do external_reference
        };
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        throw error;
    }
}

module.exports = {
    verificarPagamento,
};
