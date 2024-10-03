const { admin } = require('./firebaseConfig');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { enviarNotificacaoProfissional } = require('./notificationService'); 
const { enviarEmailProfissional } = require('./enviaEmail')

async function rejeitarVendaPorTempo(distribuidorId, vendasDoPedido, paymentId) {
    try {
        const reembolsoData = await realizarReembolso(paymentId, distribuidorId);
        
        // Percorre todas as vendas no pedido
        for (let venda of vendasDoPedido) {
            const vendaId = venda.id;
            const buyerEmail = venda.buyerInfo.email;
            
            // Atualiza o status para o distribuidor no Firestore e salva os dados do reembolso
            await admin.firestore()
                .collection('distribuidores')
                .doc(distribuidorId)
                .collection('vendas')
                .doc(vendaId)
                .update({
                    status: 'rejeitado',
                    reembolsoInfo: {
                        refund_id: reembolsoData.id,
                        date_created: reembolsoData.date_created,
                        status: reembolsoData.status
                    }
                });

            // Atualiza o status para o comprador
            const querySnapshot = await admin.firestore()
                .collection('users')
                .where('email', '==', buyerEmail)
                .limit(1)
                .get();

            if (!querySnapshot.empty) {
                const buyerDoc = querySnapshot.docs[0];
                const buyerId = buyerDoc.id;
                const compraId = venda.id;

                await admin.firestore()
                    .collection('users')
                    .doc(buyerId)
                    .collection('compras')
                    .doc(compraId)
                    .update({
                        status: 'rejeitado',
                        reembolsoInfo: {
                            refund_id: reembolsoData.id,
                            date_created: reembolsoData.date_created,
                            status: reembolsoData.status
                        }
                    });

                // Envia a notificação para o comprador
                await enviarNotificacaoProfissional(buyerEmail, 'Pedido sem resposta', 'O responsável pelo seu pedido não nos forneceu uma resposta no tempo hábil, sua compra foi cancelada e reembolsada.');

                // Envia um e-mail para o comprador
                await enviarEmailProfissional(compraId, buyerId, 'Pedido sem resposta', 'rejeitado');
            }
        }

        console.log('Venda rejeitada automáticamente e reembolso realizado com sucesso!');
    } catch (error) {
        console.error('Erro ao rejeitar a venda:', error);
        throw error;
    }
}

async function realizarReembolso(paymentId, distribuidorId) {
    try {
        const distribuidorRef = admin.firestore().collection('distribuidores').doc(distribuidorId);
        const distribuidorDoc = await distribuidorRef.get();

        if (!distribuidorDoc.exists) {
            throw new Error('Distribuidor não encontrado.');
        }

        const distribuidorData = distribuidorDoc.data();
        const accessToken = distribuidorData.credenciais_mp.access_token;

        if (!accessToken) {
            throw new Error('Access token não encontrado.');
        }

        // Gera a chave de idempotência (UUID V4)
        const idempotencyKey = uuidv4();

        // Faz a requisição para o Mercado Pago para realizar o reembolso
        const url = `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`;
        const response = await axios.post(url, {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Idempotency-Key': idempotencyKey // Chave de idempotência gerada
            }
        });

        if (response.status === 201) {
            // Reembolso bem-sucedido
            const refundData = response.data;
            return {
                id: refundData.id,
                date_created: refundData.date_created,
                status: refundData.status
            };
        } else {
            throw new Error('Erro ao realizar o reembolso.');
        }
    } catch (error) {
        if (error.response) {
            console.error('Erro ao realizar o reembolso:');
            console.error(`Status: ${error.response.status} - ${error.response.statusText}`);
        } else {
            console.error('Erro ao realizar o reembolso:', error.message);
        }
        // Lançar o erro para que a função chamadora saiba que falhou
        throw new Error('Erro ao realizar o reembolso.');
    }
}

module.exports = {
    rejeitarVendaPorTempo,
};
