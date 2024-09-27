const { db, admin } = require('./firebaseConfig');
const axios = require('axios');
const { getAccessToken } = require('./accessTokenGoogle');

// Função para enviar notificação ao distribuidor
async function enviarNotificacaoDistribuidor(distribuidorId, titulo, mensagem) {
    try {
      // Obter os tokens FCM do distribuidor
      const distribuidorRef = db.collection('distribuidores').doc(distribuidorId);
      const distribuidorDoc = await distribuidorRef.get();
      
      if (!distribuidorDoc.exists) {
        console.log(`Distribuidor com ID ${distribuidorId} não encontrado.`);
        return;
      }
  
      const distribuidorData = distribuidorDoc.data();
      const fcmTokens = distribuidorData.fcmTokens || [];
  
      if (fcmTokens.length === 0) {
        console.log(`Nenhum token FCM encontrado para o distribuidor ${distribuidorId}.`);
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
          console.log(`Notificação enviada com sucesso para token ${token}`);
        } else {
          console.log(`Erro ao enviar notificação para token ${token}:`, response);
        }
      }
  
    } catch (error) {
      console.error(`Erro ao enviar notificação para o distribuidor ${distribuidorId}:`, error);
    }
}

async function enviarNotificacaoProfissional(email, titulo, mensagem) {
  try {
    // Fazer uma busca no Firestore pelo email
    const profissionalRef = db.collection('users').where('email', '==', email).limit(1);
    const profissionalSnapshot = await profissionalRef.get();
    
    if (profissionalSnapshot.empty) {
      console.log(`Profissional com email ${email} não encontrado.`);
      return;
    }

    const profissionalDoc = profissionalSnapshot.docs[0]; // Obtém o primeiro documento
    const profissionalData = profissionalDoc.data();
    const fcmTokens = profissionalData.fcmTokens || [];

    if (fcmTokens.length === 0) {
      console.log(`Nenhum token FCM encontrado para o profissional com email ${email}.`);
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
            route: "/minhas_compras",
            profissionalId: profissionalDoc.id,  // Usa o ID do documento encontrado
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
        console.log(`Notificação enviada com sucesso para token ${token}`);
      } else {
        console.log(`Erro ao enviar notificação para token ${token}:`, response);
      }
    }

  } catch (error) {
    console.error(`Erro ao enviar notificação para o profissional com email ${email}:`, error);
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
  enviarNotificacaoProfissional
};
