require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { verificarPagamentosDistribuidores, verificarEAtualizarTokens } = require('./paymentService');
const { enviarNotificacaoProfissional } = require('./notificationService');
const { enviarEmailProfissional, enviarEmailDistribuidor} = require('./enviaEmail');
const { db, admin } = require('./firebaseConfig');
const { aprovaPedido } = require('./aprovaPedido');
const { atualizarStatusPagamento, atualizaVencimento } = require('./verificaCompra');
const nodemailer = require('nodemailer');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const user = process.env.MAIL_SENDER;
const pass = process.env.MAIL_PASSWORD;

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
  await verificarEAtualizarTokens();
  console.log('Verificação diária dos pagamentos e tokens concluída.');
});

// Rota para teste manual de verificação de pagamentos
app.get('/verificar-pagamentos', async (req, res) => {
  console.log('Iniciando verificação MANUAL dos pagamentos...');
  const logs = await verificarPagamentosDistribuidores();
  res.json({ logs });
});

app.get('/renova-tokens', async (req, res) => {
    try {
        console.log('Iniciando verificação MANUAL de tokens...');
        const logs = await verificarEAtualizarTokens();

        res.status(200).json({ message: 'Verificação e atualização de tokens concluída com sucesso.', logs });
    } catch (error) {
        console.error('Erro durante a verificação e atualização de tokens:', error);
        res.status(500).json({ message: 'Erro ao verificar e atualizar tokens.', error: error.message });
    }
});


app.get('/mantem-server', async (req, res) => {
    res.status(200).send('Servidor ativo');
});

// Rota de sucesso
app.get('/success', async (req, res) => {
    try {
        const { external_reference, payment_id } = req.query;

        if (!external_reference || !payment_id) {
            return res.status(400).send('Parâmetros inválidos.');
        }

        await atualizarStatusPagamento(external_reference, payment_id, 'solicitado');
        await atualizaVencimento(external_reference);
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Compra Bem Sucedida</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .container {
                        background-color: #fff;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    h1 {
                        color: #28a745;
                    }
                    p {
                        font-size: 18px;
                        color: #333;
                    }
                    .success-message {
                        font-size: 24px;
                        font-weight: bold;
                        color: #28a745;
                    }
                    .button {
                        margin-top: 20px;
                        padding: 10px 20px;
                        background-color: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    .button:hover {
                        background-color: #218838;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Pagamento Aprovado!</h1>
                    <p class="success-message">Sua compra foi realizada com sucesso.</p>
                    <p>Agora você pode fechar esta página.</p>
                    <p>ID da compra: ${external_reference}</p>
                </div>
            </body>
            </html>
        `);
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

        // Atualiza o status para 'falha-pagamento' em caso de falha
        await atualizarStatusPagamento(external_reference, payment_id, 'falha-pagamento');

        // Retorna uma página HTML estilizada para falha
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pagamento Falhou</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f0f0f0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .container {
                        background-color: #fff;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    h1 {
                        color: #dc3545;
                    }
                    p {
                        font-size: 18px;
                        color: #333;
                    }
                    .error-message {
                        font-size: 24px;
                        font-weight: bold;
                        color: #dc3545;
                    }
                    .button {
                        margin-top: 20px;
                        padding: 10px 20px;
                        background-color: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    .button:hover {
                        background-color: #c82333;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Pagamento Rejeitado</h1>
                    <p class="error-message">Infelizmente, seu pagamento não foi aprovado.</p>
                    <p>Por favor, tente novamente ou entre em contato com o suporte.</p><br>
                    <p>ID da compra: ${external_reference}</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erro ao processar falha de pagamento:', error);
        res.status(500).send('Erro ao processar falha de pagamento.');
    }
});

app.post('/enviar-notificacao-profissional', async (req, res) => {
    const { email, titulo, mensagem } = req.body;

    if (!email || !titulo || !mensagem ) {
        return res.status(400).json({ error: 'Parâmetros ausentes' });
    }

    try {
        await enviarNotificacaoProfissional(email, titulo, mensagem);
        return res.status(200).json({ success: 'Notificação enviada para o profissional.' });
    } catch (error) {
        console.error('Erro ao enviar notificação para o profissional:', error);
        return res.status(500).json({ error: 'Erro ao enviar notificação para o profissional.' });
    }
});

app.post('/webhook', (req, res) => {
    console.log('Recebido webhook:', req.body);
    // Processar webhook
    res.status(200).send('Webhook recebido');
});

app.post('/send-email', async (req, res) => {
    const { to, subject, text, replyTo } = req.body;
  
    if (!to || !subject || !text) {
      return res.status(400).send({ message: "Faltam informações obrigatórias." });
    }
  
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user,
          pass
        }
      });
  
      const mailOptions = {
        from: user,
        to,
        replyTo: replyTo || user,
        subject,
        text,
      };
  
      const info = await transporter.sendMail(mailOptions);
  
      res.status(200).send({ message: "Email enviado com sucesso", info });
    } catch (error) {
      res.status(500).send({ message: "Erro ao enviar email", error });
    }
  });

app.post('/enviar-email-profissional', async (req, res) => {
  const { externalReference, profissionalId, status } = req.body;

  // Validação dos parâmetros obrigatórios
  if (!externalReference || !profissionalId || !status) {
    return res.status(400).json({ error: 'Os parâmetros externalReference, profissionalId e status são obrigatórios.' });
  }

  try {
    let titulo;
    let mensagem;

    // Definir o título e mensagem do e-mail com base no status
    switch (status) {
      case 'aprovado':
        titulo = 'Seu pedido foi aprovado!';
        mensagem = 'Seu pedido foi aprovado e está em processo de separação.';
        break;
      case 'rejeitado':
        titulo = 'Seu pedido foi rejeitado';
        mensagem = 'Seu pedido foi rejeitado pelo distribuidor. Um reembolso foi processado.';
        break;
      case 'reembolsado':
        titulo = 'Reembolso realizado';
        mensagem = 'O reembolso do seu pedido foi processado com sucesso.';
        break;
      default:
        return res.status(400).json({ error: 'Status inválido. Os valores permitidos são: aprovado, rejeitado, reembolsado.' });
    }

    // Tenta enviar o e-mail
    const emailResult = await enviarEmailProfissional(externalReference, profissionalId, titulo, mensagem, status);

    // Verifica se o e-mail foi enviado corretamente (baseado em possíveis respostas da função `enviarEmailProfissional`)
    if (emailResult.success) {
      res.status(200).json({ message: 'E-mail enviado com sucesso.' });
    } else {
      res.status(500).json({ error: emailResult.error || 'Erro desconhecido ao enviar o e-mail.' });
    }

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: `Ocorreu um erro ao enviar o e-mail: ${error.message}` });
  }
});

app.post('/enviar-email-distribuidor', async (req, res) => {
  const { externalReference, distribuidorId, titulo } = req.body;

  // Verifica se os parâmetros obrigatórios estão presentes
  if (!externalReference || !distribuidorId || !titulo) {
    return res.status(400).json({ error: 'Os campos externalReference, distribuidorId e titulo são obrigatórios.' });
  }

  try {
    // Chama a função de envio de e-mail
    await enviarEmailDistribuidor(externalReference, distribuidorId, titulo);
    res.status(200).json({ message: 'E-mail enviado com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: 'Erro ao enviar e-mail' });
  }
});

app.post('/aprovar-pedido', async (req, res) => {
  try {
      const { distribuidorId, pedidoId } = req.body;

      if (!distribuidorId || !pedidoId) {
          return res.status(400).json({
              sucesso: false,
              mensagem: 'Os campos distribuidorId e pedidoId são obrigatórios.'
          });
      }

      await aprovaPedido(distribuidorId, pedidoId);

      return res.status(200).json({
          sucesso: true,
          mensagem: `Pedido ${pedidoId} enviado com sucesso!`,
      });

  } catch (error) {
      console.error('Erro ao aprovar o pedido:', error);

      if (error.message.includes('Pedido não encontrado')) {
          return res.status(404).json({
              sucesso: false,
              mensagem: `Pedido ${req.body.pedidoId} não encontrado.`,
          });
      }

      if (error.message.includes('Comprador não encontrado')) {
          return res.status(404).json({
              sucesso: false,
              mensagem: `Comprador não encontrado para o e-mail fornecido no pedido.`,
          });
      }

      return res.status(500).json({
          sucesso: false,
          mensagem: 'Erro interno ao aprovar o pedido.',
          detalhes: error.message || 'Erro desconhecido',
      });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
