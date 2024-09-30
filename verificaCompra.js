const { enviarNotificacaoDistribuidor, enviarEmailDistribuidor } = require('./notificationService');
const { db } = require('./firebaseConfig');

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

                    if (novoStatus == 'solicitado')
                        await enviarNotificacaoDistribuidor(distribuidorId, `Compra Solicitada`,`Uma nova compra foi solicitada. Clique para aprovar ou rejeitar.`);
                        await enviarEmailDistribuidor(externalReference, distribuidorId, `InjectGO - Compra Solicitada`);
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

module.exports = {
    atualizarStatusPagamento,
  };
  