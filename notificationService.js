const { db, admin } = require('./firebaseConfig');
const axios = require('axios');
const { getAccessToken } = require('./accessTokenGoogle');
const nodemailer = require('nodemailer');

// Função para enviar notificação ao distribuidor
async function enviarNotificacaoDistribuidor(distribuidorId, titulo, mensagem) {
  try {
    // Obter os tokens do distribuidor
    const distribuidorRef = db.collection('distribuidores').doc(distribuidorId);
    const distribuidorDoc = await distribuidorRef.get();
    
    if (!distribuidorDoc.exists) {
      console.log(`Distribuidor com ID ${distribuidorId} não encontrado.`);
      return;
    }

    const distribuidorData = distribuidorDoc.data();
    const tokens = distribuidorData.tokens || []; // Busca o array de tokens

    if (tokens.length === 0) {
      console.log(`Nenhum token encontrado para o distribuidor ${distribuidorId}.`);
      return;
    }

    // Envia notificações para todos os tokens do distribuidor
    for (const tokenData of tokens) {
      const fcmToken = tokenData.fcmToken; // Pega o FCM token

      if (!fcmToken) {
        console.log(`Nenhum FCM token válido encontrado.`);
        continue;
      }

      const payload = {
        message: {
          token: fcmToken,
          notification: {
            title: titulo,
            body: mensagem,
          },
          data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            route: "/minhas_vendas",
            distribuidorId: distribuidorId,
            initialTab: "0"  // Aba "Solicitado"
          }
        }
      };

      const url = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
      
      const accessToken = await getAccessToken();

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data) {
        console.log(`Notificação enviada com sucesso para token ${fcmToken}`);
      } else {
        console.log(`Erro ao enviar notificação para token ${fcmToken}:`, response);
      }
    }

  } catch (error) {
    console.error(`Erro ao enviar notificação para o distribuidor ${distribuidorId}:`, error);
  }
}

async function enviarNotificacaoProfissional(email, titulo, mensagem) {
  try {
    // Buscar o documento do profissional pelo email
    const profissionalRef = db.collection('users').where('email', '==', email).limit(1);
    const profissionalSnapshot = await profissionalRef.get();
    
    if (profissionalSnapshot.empty) {
      console.log(`Profissional com email ${email} não encontrado.`);
      return;
    }

    const profissionalDoc = profissionalSnapshot.docs[0];
    const profissionalData = profissionalDoc.data();
    const tokens = profissionalData.tokens || []; // Busca o array de tokens

    if (tokens.length === 0) {
      console.log(`Nenhum token encontrado para o profissional com email ${email}.`);
      return;
    }

    // Loop para enviar notificações para todos os tokens
    for (const tokenData of tokens) {
      const fcmToken = tokenData.fcmToken; // Pega o FCM token

      if (!fcmToken) {
        console.log(`Nenhum FCM token válido encontrado no array de tokens.`);
        continue;
      }

      const payload = {
        message: {
          token: fcmToken,
          notification: {
            title: titulo,
            body: mensagem,
          },
          data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            route: "/minhas_compras",
            profissionalId: profissionalDoc.id,
            initialTab: "1"
          }
        }
      };

      const url = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
      const accessToken = await getAccessToken();

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data) {
        console.log(`Notificação enviada com sucesso para token ${fcmToken}`);
      } else {
        console.log(`Erro ao enviar notificação para token ${fcmToken}:`, response);
      }
    }

  } catch (error) {
    console.error(`Erro ao enviar notificação para o profissional com email ${email}:`, error);
  }
}

async function enviarEmailDistribuidor(externalReference, distribuidorId, titulo) {
  try {
    // Obter os dados do distribuidor
    const distribuidorRef = db.collection('distribuidores').doc(distribuidorId);
    const distribuidorDoc = await distribuidorRef.get();

    if (!distribuidorDoc.exists) {
      console.log(`Distribuidor com ID ${distribuidorId} não encontrado.`);
      return;
    }

    const distribuidorData = distribuidorDoc.data();
    const distribuidorEmail = distribuidorData.email;

    if (!email) {
      console.log(`Nenhum email encontrado para o distribuidor com ID ${distribuidorId}.`);
      return;
    }

    const pedidoSnapshot = await db.collectionGroup('vendas').where('id', '==', externalReference).limit(1).get();
    
    if (pedidoSnapshot.empty) {
      console.log(`Nenhum pedido encontrado para o ID ${externalReference}.`);
      return;
    }
    
    const pedido = pedidoSnapshot.docs[0].data();
    const comprador = pedido.buyerInfo;
    const endereco = pedido.endereco_entrega;
    const produto = pedido.produtos[0].productInfo;
    const envio = pedido.info_envio;

    // Construir o conteúdo HTML estilizado com os detalhes do pedido
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          
          <div style="background-color: #ec3f79; padding: 10px 0; text-align: center;">
            <img src="cid:logo" alt="InjectGO Logo" style="width: 150px;"/>
          </div>
          
          <div style="padding: 20px;">
            <h1 style="color: #333;">Compra Solicitada</h1>
            <p>O pedido de ID <strong>${pedido.id}</strong> foi solicitado.</p>
            
            <h2 style="color: #ec3f79;">Detalhes do Pedido</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Produto:</strong> ${produto.nome}</li>
              <li><strong>Preço:</strong> R$ ${produto.preco}</li>
              <li><strong>Quantidade:</strong> ${produto.quantidade}</li>
              <li><strong>Comprador:</strong> ${comprador.nome} (${comprador.email})</li>
              <li><strong>Telefone:</strong> ${comprador.telefone}</li>
            </ul>
            
            <h2 style="color: #ec3f79;">Endereço de Entrega</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Rua:</strong> ${endereco.rua}, ${endereco.numero}</li>
              <li><strong>Bairro:</strong> ${endereco.bairro}</li>
              <li><strong>Cidade:</strong> ${endereco.cidade} - ${endereco.uf}</li>
              <li><strong>CEP:</strong> ${endereco.cep}</li>
              <li><strong>Complemento:</strong> ${endereco.complemento}</li>
            </ul>

            <h2 style="color: #ec3f79;">Informações de Envio</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Responsável:</strong> ${envio.responsavel}</li>
              <li><strong>Frete:</strong> R$ ${envio.frete}</li>
              <li><strong>Tempo Previsto:</strong> ${envio.tempo_previsto} dias</li>
              <li><strong>Dimensões:</strong> ${envio.dimensoes_caixa.altura}x${envio.dimensoes_caixa.largura}x${envio.dimensoes_caixa.comprimento} cm</li>
              <li><strong>Peso Aproximado:</strong> ${envio.dimensoes_caixa.peso_aproximado} kg</li>
            </ul>

            <p style="margin-top: 20px;">
              <a href="myapp://minhascompras" style="display: inline-block; padding: 10px 15px; background-color: #ec3f79; color: #fff; text-decoration: none; border-radius: 5px;">Ver Pedido no App</a>
            </p>
          </div>
          
          <div style="background-color: #f1f1f1; padding: 10px; text-align: center;">
            <p style="font-size: 12px; color: #888;">InjectGO © 2024. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: distribuidorEmail,
      subject: titulo,
      html: htmlContent,
      attachments: [{
        filename: 'logoDeitadaBranca.jpeg',
        path: 'fotos/logoDeitadaBranca.jpeg',
        cid: 'logo'
      }]
    });

    console.log("E-mail enviado com sucesso.");

  } catch (error) {
    console.error(`Erro ao enviar o e-mail para o distribuidor: ${error}`);
  }
}

async function enviarNotificacao(titulo, mensagem, userId, tipoUsuario) {
  try {
      // Definir a coleção com base no tipo de usuário
      const userCollections = {
        'distribuidor': 'distribuidores',
        'profissional': 'users',
      };
      const collection = userCollections[tipoUsuario];

      if (!collection) {
        return 'Tipo de usuário inválido';
      }
      
      // Obter os tokens FCM do usuário (distribuidor ou profissional)
      const userRef = db.collection(collection).where('email', '==', userId);
      const userSnapshot = await userRef.get();

      // Verificar se o documento foi encontrado
      if (userSnapshot.empty) {
          console.log(`Usuário com email ${userId} não encontrado na coleção ${collection}.`);
          return;
      }

      const userDoc = userSnapshot.docs[0];
      
      if (!userDoc.exists) {
          console.log(`${tipoUsuario} com ID ${userId} não encontrado.`);
          return;
      }
      
      const userData = userDoc.data();
      const fcmTokens = userData.fcmTokens || [];
      
      if (fcmTokens.length === 0) {
          console.log(`Nenhum token FCM encontrado para o ${tipoUsuario} ${userId}.`);
          return;
      }
      
      // Para cada token, enviar a notificação usando a API v1
      for (const token of fcmTokens) {
          const payload = {
              message: {
                  token: token,
                  notification: {
                      title: titulo,
                      body: mensagem,
                  },
                  data: {
                      click_action: "FLUTTER_NOTIFICATION_CLICK",
                      route: tipoUsuario === 'distribuidor' ? "/minhas_vendas" : "/minhas_compras",
                      userId: userId,
                      initialTab: "0"  // Aba inicial (pode ser ajustada conforme necessário)
                  }
              }
          };
          
          const url = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
          const accessToken = await getAccessToken();
          console.log(accessToken);
          
          const response = await axios.post(url, payload, {
              headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
              }
          });
          
          if (response.data) {
              console.log(`Notificação enviada com sucesso para token ${token}`);
          } else {
              console.log(`Erro ao enviar notificação para token ${token}:`, response);
          }
      }
      
  } catch (error) {
      console.error(`Erro ao enviar notificação para o ${tipoUsuario} ${userId}:`, error);
  }
}

module.exports = {
  enviarNotificacaoDistribuidor,
  enviarNotificacao,
  enviarNotificacaoProfissional,
  enviarEmailDistribuidor,
};
