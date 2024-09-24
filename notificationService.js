const { db, admin } = require('./firebaseConfig');

// Função para enviar notificação ao distribuidor
async function enviarNotificacaoDistribuidor(distribuidorId, mensagem) {
  try {
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

    const payload = {
      notification: {
        title: "Nova Compra Realizada",
        body: mensagem,
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        route: "/minhas_vendas",
        distribuidorId: distribuidorId,
        initialTab: "0",  // Aba "Solicitado"
      }
    };

    const response = await admin.messaging().sendToDevice(fcmTokens, payload);
    console.log(`Notificação enviada para o distribuidor ${distribuidorId}.`, response);
  } catch (error) {
    console.error(`Erro ao enviar notificação para o distribuidor ${distribuidorId}:`, error);
  }
}

module.exports = {
  enviarNotificacaoDistribuidor,
};
