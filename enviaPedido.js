/*
    Se o distribuidor aprovar o pedido, ele vai entrar no processo de envio dos produtos, em que, se for escolhido o envio próprio, ele tem 
    ATÉ 5 horas ÚTEIS para realizar o envio, se for por transportadora, ele terá até 24 horas (exclui os fins de semana) para postar o produto
    na transportadora escolhida pelo cliente, gerando o código de rastreio.

 */

    const { admin } = require('./firebaseConfig');
    const { addBusinessHours, adicionar24HorasNormais } = require('./horarioComercial');
    const { enviarNotificacaoProfissional } = require('./notificationService'); 
    const { enviarEmailProfissional } = require('./enviaEmail')
    
    async function enviarPedido(distribuidorId, pedidoId) {    
        try {
            const pedidoRef = admin.firestore()
                .collection('distribuidores')
                .doc(distribuidorId)
                .collection('vendas')
                .doc(pedidoId);
            
            const pedidoDoc = await pedidoRef.get();
            
            // Verifica se o documento existe
            if (!pedidoDoc.exists) {
                console.error(`[ERROR] Pedido ${pedidoId} não encontrado para o distribuidor ${distribuidorId}.`);
                return;
            }

            const pedidoData = pedidoDoc.data();
            const tipoFrete = pedidoData.info_envio.id_responsavel;
            const dataAtual = new Date('2024-10-03T18:20:33');
            const emailComprador = pedidoData.buyerInfo.email; 
            
            let prazoMaximoEnvio;
    
            // Verifica o tipo de frete e aplica os prazos correspondentes
            try {
                if (tipoFrete === 'frete_gratis') {
                    // Envio próprio -> 5 horas úteis
                    prazoMaximoEnvio = addBusinessHours(dataAtual, 5);
                    console.log(`[INFO] Envio próprio: O distribuidor tem até ${prazoMaximoEnvio} para realizar o envio.`);
                } else {
                    // Transportadora -> 24 horas (sem incluir fins de semana)
                    prazoMaximoEnvio = adicionar24HorasNormais(dataAtual);
                    console.log(`[INFO] Transportadora: O distribuidor tem até ${prazoMaximoEnvio} para postar o produto.`);
                }
            } catch (generateError) {
                console.error(`[ERROR] Erro ao calcular o prazo máximo de envio:`, generateError.message || generateError);
                return;
            }
    
            await pedidoRef.update({
                tempo_maximo_envio: admin.firestore.Timestamp.fromDate(prazoMaximoEnvio),
                status: 'enviado'
            });

            const userSnapshot = await admin.firestore()
                .collection('users')
                .where('email', '==', emailComprador)
                .limit(1)
                .get();
            
            if (userSnapshot.empty) {
                console.error(`[ERROR] Comprador com o e-mail ${emailComprador} não encontrado.`);
                return;
            }
    
            const buyerDoc = userSnapshot.docs[0];
            const buyerId = buyerDoc.id;
    
    
            const compraRef = admin.firestore()
                .collection('users')
                .doc(buyerId)
                .collection('compras')
                .doc(pedidoId);
            
            await compraRef.update({
                tempo_maximo_envio: admin.firestore.Timestamp.fromDate(prazoMaximoEnvio),
                status: 'enviado' 
            });
    
            await enviarNotificacaoProfissional(emailComprador, 
                'Pedido enviado!', 
                `Uhuul! Seu pedido ${pedidoId} está em processo de envio.`
            );
    
            await enviarEmailProfissional(pedidoId, buyerId, 'Pedido enviado!', 'enviado');
    
            console.log(`[SUCCESS] Pedido ${pedidoId} enviado com sucesso. Prazo de envio: ${prazoMaximoEnvio}`);
            
        } catch (error) {
            // Log detalhado do erro
            console.error(`[ERROR] Erro ao aprovar o pedido ${pedidoId}:`, error.message || error);
            throw new Error('Erro ao aprovar o pedido.');
        }
    }
    
    module.exports = {
        enviarPedido
    };