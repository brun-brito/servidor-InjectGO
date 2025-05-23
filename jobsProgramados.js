const schedule = require('node-schedule');
const { rejeitarVendaPorTempo } = require('./estornoCompra');
const { admin } = require('./firebaseConfig');

function agendarJob(tempoMaximo, tarefa) {
    const job = schedule.scheduleJob(tempoMaximo, tarefa);
    console.log(`Job agendado para ${tempoMaximo}`);
    return job;
}

async function jobEstorno(id, distribuidorId, vendasDoPedido, paymentId) {
  console.log(`Tentativa de estorno do pedido ${id} executada no horário:`, new Date());

  try {
      const vendaDoc = await admin.firestore()
          .collection('distribuidores')
          .doc(distribuidorId)
          .collection('vendas')
          .doc(id)
          .get();

      if (!vendaDoc.exists) {
          console.log(`Pedido ${id} não encontrado para o distribuidor ${distribuidorId}.`);
          return;
      }

      const vendaData = vendaDoc.data();
      
      if (vendaData.status === 'preparando') {
          console.log(`O pedido ${id} já foi aceito pelo distribuidor. Nenhum estorno será realizado.`);
          return;
      }

      await rejeitarVendaPorTempo(distribuidorId, vendasDoPedido, paymentId);
      console.log(`Estorno do pedido ${id} finalizado com SUCESSO no horário:`, new Date());
  } catch (e) {
      console.log(`Estorno do pedido ${id} finalizado com FALHA no horário:`, new Date());
      console.error('Causa do erro:', e.message || e);
  }
}

module.exports = {
    agendarJob,
    jobEstorno
};