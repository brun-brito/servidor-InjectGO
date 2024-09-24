const axios = require('axios');
const { db, admin } = require('./firebaseConfig');

// Função para verificar o status dos pagamentos e retornar os logs
async function verificarPagamentosDistribuidores() {
  let logs = [];

  logs.push('Iniciando leitura de distribuidores do banco de dados...');

  try {
    const distribuidoresSnapshot = await db.collection('distribuidores').get();
    logs.push(`Total de distribuidores encontrados: ${distribuidoresSnapshot.size}`);

    const distribuidores = distribuidoresSnapshot.docs;

    for (const distribuidor of distribuidores) {
      const dadosPagamento = distribuidor.data().dados_pagamento;

      if (dadosPagamento && dadosPagamento.id) {
        const transactionId = dadosPagamento.id;
        logs.push(`Lendo dados do distribuidor ${distribuidor.id}, transaction ID: ${transactionId}`);

        try {
          const response = await axios.get(`https://api.mercadopago.com/preapproval/${transactionId}`, {
            headers: {
              Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          });

          const status = response.data.status;
          logs.push(`Status do pagamento para o distribuidor ${distribuidor.id}: ${status}`);

          const updateData = {
            'dados_pagamento.last_checked': admin.firestore.FieldValue.serverTimestamp(),
            pagamento_em_dia: status === 'authorized',
          };

          await db.collection('distribuidores').doc(distribuidor.id).update(updateData);
          logs.push(`Distribuidor ${distribuidor.id} atualizado com sucesso.`);
          
        } catch (error) {
          logs.push(`Erro ao verificar pagamento do distribuidor ${distribuidor.id}: ${error.response ? error.response.data : error.message}`);
        }
      } else {
        logs.push(`Distribuidor ${distribuidor.id} não tem dados de pagamento.`);
      }
    }

    logs.push('Verificação dos pagamentos finalizada com sucesso.');

  } catch (error) {
    logs.push(`Erro ao ler distribuidores do banco de dados: ${error.message}`);
  }

  return logs;
}

module.exports = {
  verificarPagamentosDistribuidores,
};
