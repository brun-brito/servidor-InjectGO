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
const API_KEY = process.env.API_KEY; // Defina no seu arquivo .env

// Middleware para verificar a chave da API
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Acesso negado: chave da API inválida' });
  }
  next();
});

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
          // Faz a requisição GET para verificar o status da assinatura no Mercado Pago
          const response = await axios.get(`https://api.mercadopago.com/preapproval/${transactionId}`, {
            headers: {
              Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          });

          const status = response.data.status;
          logs.push(`Status do pagamento para o distribuidor ${distribuidor.id}: ${status}`);

          if (status === 'authorized') {
            // Se estiver autorizado, manter o pagamento em dia
            await db.collection('distribuidores').doc(distribuidor.id).update({
              'pagamento_em_dia': true,
              'dados_pagamento.last_checked': admin.firestore.FieldValue.serverTimestamp(),
            });
            logs.push(`Distribuidor ${distribuidor.id} com pagamento autorizado.`);
          } else {
            // Caso contrário, marcar como pagamento não em dia
            await db.collection('distribuidores').doc(distribuidor.id).update({
              'pagamento_em_dia': false,
              'dados_pagamento.last_checked': admin.firestore.FieldValue.serverTimestamp(),
            });
            logs.push(`Distribuidor ${distribuidor.id} com pagamento não autorizado.`);
          }
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

// Agendamento diário para rodar a verificação às 00:00
cron.schedule('16 19 * * *', async () => {
  console.log('Iniciando verificação diária dos pagamentos...');
  const logs = await verificarPagamentosDistribuidores();
  console.log(logs.join('\n'));
  console.log('Verificação diária dos pagamentos concluída.');
});

// Rota para testar manualmente a verificação com logs retornados
app.get('/verificar-pagamentos', async (req, res) => {
  console.log('Iniciando verificação manual dos pagamentos...');
  console.log(`Hora atual do servidor: ${new Date().toLocaleString()}`);
  const logs = await verificarPagamentosDistribuidores();
  res.json({ logs });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
