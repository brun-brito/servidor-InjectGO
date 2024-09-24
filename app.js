require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { verificarPagamentosDistribuidores } = require('./paymentService');
const { enviarNotificacaoDistribuidor } = require('./notificationService');
const { db, admin } = require('./firebaseConfig');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Middleware para verificar a chave da API
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Acesso negado: chave da API inválida' });
  }
  next();
});

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

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
