require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');
const axios = require('axios');

// Inicializar o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

// Função para verificar o status dos pagamentos
async function verificarPagamentosDistribuidores() {
  console.log('Iniciando leitura de distribuidores do banco de dados...');

  try {
    const distribuidoresSnapshot = await db.collection('distribuidores').get();
    console.log(`Total de distribuidores encontrados: ${distribuidoresSnapshot.size}`);

    const distribuidores = distribuidoresSnapshot.docs;

    // Usar for...of para esperar a conclusão de cada verificação
    for (const distribuidor of distribuidores) {
      const dadosPagamento = distribuidor.data().dados_pagamento;

      if (dadosPagamento && dadosPagamento.id) {
        const transactionId = dadosPagamento.id;
        console.log(`Lendo dados do distribuidor ${distribuidor.id}, transaction ID: ${transactionId}`);

        try {
          // Faz a requisição GET para verificar o status da assinatura no Mercado Pago
          const response = await axios.get(`https://api.mercadopago.com/preapproval/${transactionId}`, {
            headers: {
              Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          });

          const status = response.data.status;
          console.log(`Status do pagamento para o distribuidor ${distribuidor.id}: ${status}`);

          if (status === 'authorized') {
            // Se estiver autorizado, manter o pagamento em dia
            await db.collection('distribuidores').doc(distribuidor.id).update({
              'pagamento_em_dia': true,
              'dados_pagamento.last_checked': admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Distribuidor ${distribuidor.id} com pagamento autorizado.`);
          } else {
            // Caso contrário, marcar como pagamento não em dia
            await db.collection('distribuidores').doc(distribuidor.id).update({
              'pagamento_em_dia': false,
              'dados_pagamento.last_checked': admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Distribuidor ${distribuidor.id} com pagamento não autorizado.`);
          }
        } catch (error) {
          console.error(`Erro ao verificar pagamento do distribuidor ${distribuidor.id}:`, error.response ? error.response.data : error.message);
        }
      } else {
        console.log(`Distribuidor ${distribuidor.id} não tem dados de pagamento.`);
      }
    }

    console.log('Verificação dos pagamentos finalizada com sucesso.');

  } catch (error) {
    console.error('Erro ao ler distribuidores do banco de dados:', error.message);
  }
}

// Agendamento diário para rodar a verificação às 12:05 da tarde
cron.schedule('00 00 * * *', async () => {
  console.log('Iniciando verificação diária dos pagamentos às 12:05 PM...');
  await verificarPagamentosDistribuidores();
  console.log('Verificação diária dos pagamentos concluída.');
});

// Rota para testar manualmente a verificação
app.get('/verificar-pagamentos', async (req, res) => {
  console.log('Iniciando verificação manual dos pagamentos...');
  await verificarPagamentosDistribuidores();
  res.send('Verificação de pagamentos concluída.');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
