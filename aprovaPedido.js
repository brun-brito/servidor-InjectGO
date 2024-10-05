/*
    Se o distribuidor aprovar o pedido, ele vai entrar no processo de envio dos produtos, em que, se for escolhido o envio próprio, ele tem 
    ATÉ 5 horas ÚTEIS para realizar o envio, se for por transportadora, ele terá até 24 horas (exclui os fins de semana) para postar o produto
    na transportadora escolhida pelo cliente, gerando o código de rastreio.

 */

    const { admin } = require('./firebaseConfig');
    const { somarHorasUteis, avancar24Horas } = require('./horarioComercial');
    const { enviarNotificacaoProfissional } = require('./notificationService'); 
    const { enviarEmailProfissional } = require('./enviaEmail')
    const { logger } = require('./winston')
    
    async function aprovaPedido(distribuidorId, pedidoId) {    
        try {
            const pedidoRef = admin.firestore()
                .collection('distribuidores')
                .doc(distribuidorId)
                .collection('vendas')
                .doc(pedidoId);
            
            const pedidoDoc = await pedidoRef.get();
            
            if (!pedidoDoc.exists) {
                logger.error(`Pedido ${pedidoId} não encontrado para o distribuidor ${distribuidorId}.`);
                return;
            }
            const pedidoData = pedidoDoc.data();
            const tipoFrete = pedidoData.info_envio.id_responsavel;
            const dataAtual = new Date();
            const emailComprador = pedidoData.buyerInfo.email; 
            
            let prazoMaximoEnvio;
    
            // Verifica o tipo de frete e aplica os prazos correspondentes
            try {
                if (tipoFrete === 'frete_gratis') {
                    // Envio próprio -> 5 horas úteis
                    prazoMaximoEnvio = somarHorasUteis(dataAtual, 5);
                    logger.info(`Envio próprio: O distribuidor tem até ${prazoMaximoEnvio} para realizar o envio.`);
                } else {
                    // Transportadora -> 24 horas (sem incluir fins de semana)
                    prazoMaximoEnvio = avancar24Horas(dataAtual);
                    logger.info(`Transportadora: O distribuidor tem até ${prazoMaximoEnvio} para postar o produto.`);
                }
            } catch (generateError) {
                logger.error(`Erro ao calcular o prazo máximo de envio: ${generateError.message}`);
                return;
            }
    
            await pedidoRef.update({
                tempo_maximo_envio: admin.firestore.Timestamp.fromDate(prazoMaximoEnvio),
                status: 'preparando'
            });
    
            const userSnapshot = await admin.firestore()
                .collection('users')
                .where('email', '==', emailComprador)
                .limit(1)
                .get();
            
            if (userSnapshot.empty) {
                logger.error(`Comprador com o e-mail ${emailComprador} não encontrado.`);
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
                status: 'preparando' 
            });
    
            try {
                await enviarNotificacaoProfissional(emailComprador, 
                    'Pedido Aprovado!', 
                    `Uhuul! Seu pedido ${pedidoId} foi aprovado e está em processo de preparo.`
                );
                logger.info(`Notificação enviada com sucesso para ${emailComprador}`);
            } catch (notificationError) {
                logger.error(`Erro ao enviar notificação para o profissional com email ${emailComprador}: ${notificationError.message}`);
            }
    
            try {
                await enviarEmailProfissional(pedidoId, buyerId, 'Pedido aprovado!', 'aprovado');
            } catch (emailError) {
                logger.error(`Erro ao enviar e-mail: ${emailError.message}`);
            }
    
            logger.info(`Pedido aprovado com sucesso às ${new Date()}. Prazo de envio: ${prazoMaximoEnvio}`);
            
        } catch (error) {
            logger.error(`Erro ao aprovar o pedido ${pedidoId}: ${error.message}`);
            throw new Error('Erro ao aprovar o pedido.');
        }
    }    
    
    module.exports = {
        aprovaPedido
    };