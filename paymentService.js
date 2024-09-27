require('dotenv').config();
const axios = require('axios');
const { db, admin } = require('./firebaseConfig');
const moment = require('moment'); 

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

async function verificarEAtualizarTokens() {
  try {
    // Busca todos os distribuidores
    const distribuidoresSnapshot = await db.collection('distribuidores').get();

    // Para cada distribuidor, verifica a data de expiração
    distribuidoresSnapshot.forEach(async (doc) => {
      const distribuidorData = doc.data();
      const credenciaisMp = distribuidorData.credenciais_mp;

      if (credenciaisMp && credenciaisMp.data_expiracao) {
        const dataExpiracao = moment(credenciaisMp.data_expiracao, 'DD-MM-YYYY');
        const dataAtual = moment();
        const diasRestantes = dataExpiracao.diff(dataAtual, 'days');

        // Se faltarem 5 dias ou menos para expirar, renova o token
        if (diasRestantes <= 5) {
          console.log(`Token do distribuidor ${doc.id} vai expirar em ${diasRestantes} dias. Atualizando...`);

          // Chama a função de renovação do token
          await renovarAccessToken(
            credenciaisMp.refresh_token,
            doc.id // Passa o ID do distribuidor para atualizar no Firestore
          );
        } else {
          console.log(`Token do distribuidor ${doc.id} é válido até ${credenciaisMp.data_expiracao} (${diasRestantes} dias restantes)`);
        }
      }
    });
  } catch (error) {
    console.error('Erro ao verificar e atualizar tokens:', error);
  }
}

// Função para renovar o access_token usando o refresh_token
async function renovarAccessToken(refreshToken, distribuidorId) {
  try {
    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_id: process.env.MERCADO_PAGO_CLIENT_ID,     // CLIENT_ID do dono do marketplace
      client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET, // CLIENT_SECRET do dono do marketplace
      grant_type: 'refresh_token',
      refresh_token: refreshToken,       // Refresh token do distribuidor que vai vencer
    });

    if (response.status === 200) {
      const data = response.data;

      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token;
      const publicKey = data.public_key;
      const userId = data.user_id.toString();  // Convertendo o user_id para string
      const expiresIn = data.expires_in;       // Tempo de expiração em segundos

      // Calcula a nova data de expiração (em 180 dias, conforme o expires_in)
      const novaDataExpiracao = moment().add(expiresIn, 'seconds').format('DD-MM-YYYY');

      // Atualiza os dados no Firestore no formato especificado
      await db.collection('distribuidores').doc(distribuidorId).update({
        'credenciais_mp': {
          'access_token': newAccessToken,       // Atualiza o access_token
          'refresh_token': newRefreshToken,     // Atualiza o refresh_token
          'data_expiracao': novaDataExpiracao,  // Nova data de expiração no formato dd-mm-yyyy
          'public_key': publicKey,              // Atualiza a public_key
          'user_id': userId,                    // Atualiza o user_id como string
        }
      });

      console.log(`Token do distribuidor ${distribuidorId} atualizado com sucesso.`);
    } else {
      console.error(`Falha ao renovar token do distribuidor ${distribuidorId}: Status ${response.status}`);
    }
  } catch (error) {
    console.error(`Erro ao renovar token do distribuidor ${distribuidorId}:`, error);
  }
}

module.exports = {
  verificarPagamentosDistribuidores,
  verificarEAtualizarTokens
};
