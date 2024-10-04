const { enviarNotificacaoDistribuidor } = require('./notificationService');
const { enviarEmailDistribuidor} = require('./enviaEmail');
const { admin, db } = require('./firebaseConfig');
const { addBusinessHours } = require('./horarioComercial');
const { agendarJob, jobEstorno } = require('./jobsProgramados');

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

                    if (novoStatus == 'solicitado'){
                        await enviarNotificacaoDistribuidor(distribuidorId, `Compra Solicitada`,`Uma nova compra foi solicitada. Clique para aprovar ou rejeitar.`);
                        await enviarEmailDistribuidor(externalReference, distribuidorId, `InjectGO - Compra Solicitada`);
                    }
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

async function atualizaVencimento(externalReference) {
    try {
        let distribuidorId = '';
        let paymentId = '';
        let vendasDoPedido;
        let tempoMaximo;

        const vendasSnapshot = await db.collectionGroup('vendas').get();
        if (!vendasSnapshot.empty) {
            for (const doc of vendasSnapshot.docs) {
                if (doc.id === externalReference) {
                    distribuidorId = doc.ref.parent.parent.id;
                    const vendaData = doc.data();
                    vendasDoPedido = vendaData.produtos;
                    paymentId = vendaData.payment_id;
                    const dataAtual = new Date();
                    // Calcula o próximo dia útil + 2 horas e converte para UTC
                    tempoMaximo = addBusinessHours(dataAtual, 2);

                    // Atualiza o campo 'tempo_maximo_aprova' no Firestore
                    await doc.ref.update({
                        tempo_maximo_aprova: admin.firestore.Timestamp.fromDate(tempoMaximo),
                    });

                    console.log(`Pedido ${externalReference}: Vencimento atualizado para ${tempoMaximo}`);
                    agendarJob(tempoMaximo, () => jobEstorno(externalReference, distribuidorId, vendasDoPedido, paymentId));
                }
            }
        } else {
            console.log('Nenhuma venda encontrada.');
        }

        const comprasSnapshot = await db.collectionGroup('compras').get();
        if (!comprasSnapshot.empty) {
            for (const doc of comprasSnapshot.docs) {
                if (doc.id === externalReference) {
                    await doc.ref.update({
                        tempo_maximo_aprova: admin.firestore.Timestamp.fromDate(tempoMaximo),
                    });
                }
            }
        } else {
            console.log('Nenhuma compra encontrada.');
        }

    } catch (error) {
        console.error('Erro ao atualizar vencimento:', error);
        throw error;
    }
}


module.exports = {
    atualizarStatusPagamento,
    atualizaVencimento
  };
  