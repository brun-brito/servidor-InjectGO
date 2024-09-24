require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { verificarPagamentosDistribuidores } = require('./paymentService');
const { enviarNotificacaoDistribuidor } = require('./notificationService');
const { db, admin } = require('./firebaseConfig');
const { verificarPagamento } = require('./verificaPagamento');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Middleware para verificar a chave da API
// app.use((req, res, next) => {
//   const apiKey = req.headers['x-api-key'];
//   if (apiKey !== API_KEY) {
//     return res.status(403).json({ error: 'Acesso negado: chave da API inválida' });
//   }
//   next();
// });

// Middleware para processar JSON no corpo da requisição
app.use(express.json());

// Agendamento diário para verificação de pagamentos
cron.schedule('0 3 * * *', async () => {
  console.log('Iniciando verificação diária AUTOMÁTICA dos pagamentos...');
  const logs = await verificarPagamentosDistribuidores();
  console.log(logs.join('\n'));
  console.log('Verificação diária dos pagamentos concluída.');
});

// Rota para teste manual de verificação de pagamentos
app.get('/verificar-pagamentos', async (req, res) => {
  console.log('Iniciando verificação MANUAL dos pagamentos...');
  const logs = await verificarPagamentosDistribuidores();
  res.json({ logs });
});

// Rota para registrar compra e enviar notificação
app.post('/realizar-compra', async (req, res) => {
  const { distribuidorId, productId, userId } = req.body;

  try {
    // Registrar a compra (exemplo simplificado)
    const compraRef = await db.collection('distribuidores').doc(distribuidorId).collection('vendas').add({
      productId: productId,
      userId: userId,
      status: 'solicitado',
      data_pedido: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Compra registrada com sucesso: ${compraRef.id}`);

    // Enviar notificação ao distribuidor
    await enviarNotificacaoDistribuidor(distribuidorId, `Uma nova compra foi realizada para o produto ${productId}.`);

    res.status(200).json({ message: 'Compra realizada e notificação enviada.' });
  } catch (error) {
    console.error('Erro ao realizar compra:', error);
    res.status(500).json({ error: 'Erro ao realizar compra.' });
  }
});

// Rota de sucesso
app.get('/success', async (req, res) => {
    try {
        const { external_reference, payment_id } = req.query;

        if (!external_reference || !payment_id) {
            return res.status(400).send('Parâmetros inválidos.');
        }

        // Atualiza a coleção 'distribuidores' e 'users' para o pedido
        await atualizarStatusPagamento(external_reference, payment_id, 'solicitado');
        res.status(200).send('Pagamento aprovado.');
    } catch (error) {
        console.error('Erro ao processar sucesso de pagamento:', error);
        res.status(500).send('Erro ao processar sucesso de pagamento.');
    }
});

// Rota de falha
app.get('/failure', async (req, res) => {
    try {
        const { external_reference, payment_id } = req.query;

        if (!external_reference) {
            return res.status(400).send('Parâmetros inválidos.');
        }

        // Atualiza o status para 'rejeitado' em caso de falha
        await atualizarStatusPagamento(external_reference, payment_id, 'rejeitado');
        res.status(200).send('Pagamento rejeitado.');
    } catch (error) {
        console.error('Erro ao processar falha de pagamento:', error);
        res.status(500).send('Erro ao processar falha de pagamento.');
    }
});

// Função que busca e atualiza uma venda com base no external_reference
async function atualizarStatusPagamento(externalReference, paymentId, novoStatus) {
    try {
        let vendaAtualizada = false;
        let compraAtualizada = false;
        let distribuidorId = '';


        // Busca todas as vendas na coleção 'vendas'
        const vendasSnapshot = await db.collectionGroup('vendas').get();
        if (!vendasSnapshot.empty) {
            for (const doc of vendasSnapshot.docs) {
                if (doc.id === externalReference) {
                    distribuidorId = doc.ref.parent.parent.id;


                    // Atualizar a venda com os novos dados
                    await doc.ref.update({
                        'payment_id': paymentId,
                        'status': novoStatus,
                        'data_pagamento': new Date(),  // Atualiza a data de pagamento
                    });
                    vendaAtualizada = true;


                    // Envia notificação ao distribuidor
                    await enviarNotificacaoDistribuidor(distribuidorId, `Compra Solicitada`,`Uma nova compra foi solicitada para o produto. Clique para aprovar ou rejeitar.`);
                }
            }
        } else {
        }

        // Busca todas as compras na coleção 'compras'
        const comprasSnapshot = await db.collectionGroup('compras').get();
        if (!comprasSnapshot.empty) {
            for (const doc of comprasSnapshot.docs) {
                if (doc.id === externalReference) {

                    // Atualizar a compra com os novos dados
                    await doc.ref.update({
                        'payment_id': paymentId,
                        'status': novoStatus,
                        'data_pagamento': new Date(),  // Atualiza a data de pagamento
                    });

                    compraAtualizada = true;
                }
            }
        } else {
        }

        if (!vendaAtualizada && !compraAtualizada) {
            console.log(`Nenhuma venda ou compra encontrada com o external_reference fornecido (${externalReference}).`);
        } else {
            console.log('Atualização de venda e compra concluída com sucesso.');
        }

    } catch (error) {
        console.error('Erro ao atualizar venda e compra por external_reference:', error);
        throw new Error('Erro ao atualizar venda e compra por external_reference.');
    }
}


// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
