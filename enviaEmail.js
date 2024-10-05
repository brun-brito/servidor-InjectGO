const { db, admin } = require('./firebaseConfig');
const nodemailer = require('nodemailer');

function construirHtmlProdutos(produtos) {
  return produtos.map(produto => `
    <div style="border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
      <img src="${produto.productInfo.imageUrl || 'https://via.placeholder.com/150'}" alt="${produto.productInfo.nome || 'Produto'}" style="width: 100px; height: 100px; object-fit: cover;"/>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Produto:</strong> ${produto.productInfo.nome || 'N/A'}</li>
        <li><strong>Categoria:</strong> ${produto.productInfo.categoria || 'N/A'}</li>
        <li><strong>Marca:</strong> ${produto.productInfo.marca || 'N/A'}</li>
        <li><strong>Preço:</strong> R$ ${produto.productInfo.preco ? produto.productInfo.preco.toFixed(2) : 'N/A'}</li>
        <li><strong>Quantidade:</strong> ${produto.productInfo.quantidade || 'N/A'}</li>
      </ul>
    </div>
  `).join('');
}

async function enviarEmailProfissional(externalReference, profissionalId, titulo, status) {
  try {
    const profissionalRef = db.collection('users').doc(profissionalId);
    const profissionalDoc = await profissionalRef.get();
  
    if (!profissionalDoc.exists) {
      console.log(`Profissional com ID ${profissionalId} não encontrado.`);
      return;
    }
  
    const profissionalData = profissionalDoc.data();
    const profissionalEmail = profissionalData.email;
  
    if (!profissionalEmail) {
      console.log(`Nenhum email encontrado para o profissional com ID ${profissionalId}.`);
      return;
    }
  
    const pedidoRef = profissionalRef.collection('compras').doc(externalReference);
    const pedidoDoc = await pedidoRef.get();
  
    if (!pedidoDoc.exists) {
      console.log(`Pedido com ID ${externalReference} não encontrado.`);
      return;
    }
  
    const pedido = pedidoDoc.data();
    const distribuidor = pedido.distributorInfo;
    const produtos = pedido.produtos;
    const endereco = pedido.endereco_entrega;
    const envio = {
      frete: pedido.info_entrega.frete || 0,
      id: pedido.info_entrega.id_responsavel || 'N/A',
      responsavel: pedido.info_entrega.responsavel || 'N/A',
      tempoPrevisto: pedido.info_entrega.id_responsavel === 'frete_gratis'
        ? 'Até 5 horas úteis'
        : (pedido.info_entrega.tempo_previsto > 0 ? pedido.info_entrega.tempo_previsto + ' dias' : 'Não especificado')
    };

    // Adiciona a lista de produtos ao HTML
    const htmlProdutos = construirHtmlProdutos(produtos);

    const htmlContentAprovado = (distribuidor, endereco, envio) => `
    <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #ec3f79; padding: 10px 0; text-align: center;">
          <img src="cid:logo" alt="InjectGO Logo" style="width: 150px;"/>
        </div>
        
        <div style="padding: 20px;">
          <h1 style="color: #333;">Seu pedido foi aprovado!</h1>
          <p>O pagamento ${pedido.payment_id} foi confirmado, e o seu pedido está sendo processado.</p>

          <h2 style="color: #ec3f79;">Pedido:</h2>
          ${htmlProdutos}

          <h2 style="color: #ec3f79;">Distribuidor:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Razão Social:</strong> ${distribuidor.razao_social || 'N/A'}</li>
            <li><strong>CNPJ:</strong> ${distribuidor.cnpj || 'N/A'}</li>
            <li><strong>E-mail:</strong> ${distribuidor.email || 'N/A'}</li>
            <li><strong>Telefone:</strong> ${distribuidor.telefone || 'N/A'}</li>
          </ul>

          <h2 style="color: #ec3f79;">Endereço de Entrega:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Rua:</strong> ${endereco.rua || 'N/A'}, ${endereco.numero || 'N/A'}</li>
            <li><strong>Bairro:</strong> ${endereco.bairro || 'N/A'}</li>
            <li><strong>Cidade:</strong> ${endereco.cidade || 'N/A'} - ${endereco.uf || 'N/A'}</li>
            <li><strong>CEP:</strong> ${endereco.cep || 'N/A'}</li>
            <li><strong>Complemento:</strong> ${endereco.complemento || 'N/A'}</li>
          </ul>

          <h2 style="color: #ec3f79;">Informações de Envio:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Frete:</strong> R$ ${(typeof envio.frete === 'number' ? envio.frete.toFixed(2) : '0.00')}</li>
            <li><strong>Responsável:</strong> ${envio.responsavel || 'N/A'}</li>
            <li><strong>Tempo Previsto de Entrega:</strong> ${envio.tempoPrevisto}</li>
          </ul>

          <p style="margin-top: 20px;">
            <a href="injectgo.com.br" style="display: inline-block; padding: 10px 15px; background-color: #ec3f79; color: #fff; text-decoration: none; border-radius: 5px;">Ver Pedido no App</a>
          </p>
        </div>

        <div style="background-color: #f1f1f1; padding: 10px; text-align: center;">
          <p style="font-size: 12px; color: #888;">InjectGO © 2024. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
    `;

    const htmlContentRejeitado = (distribuidor, reembolsoInfo) => `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        
          <div style="background-color: #ec3f79; padding: 10px 0; text-align: center;">
            <img src="cid:logo" alt="InjectGO Logo" style="width: 150px;"/>
          </div>
          
          <div style="padding: 20px;">
            <h1 style="color: #333;">Seu pedido foi rejeitado</h1>
            <p>Infelizmente, seu pedido foi rejeitado e o reembolso foi processado.</p>

            <h2 style="color: #ec3f79;">Pedido:</h2>
            ${htmlProdutos}

            <h2 style="color: #ec3f79;">Distribuidor:</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Razão Social:</strong> ${distribuidor.razao_social || 'N/A'}</li>
              <li><strong>CNPJ:</strong> ${distribuidor.cnpj || 'N/A'}</li>
              <li><strong>E-mail:</strong> ${distribuidor.email || 'N/A'}</li>
              <li><strong>Telefone:</strong> ${distribuidor.telefone || 'N/A'}</li>
            </ul>

            <h2 style="color: #ec3f79;">Informações de Reembolso:</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>ID do Reembolso:</strong> ${reembolsoInfo.refund_id || 'N/A'}</li>
              <li><strong>Data do Reembolso:</strong> ${new Date(reembolsoInfo.date_created).toLocaleString() || 'N/A'}</li>
              <li><strong>Status do Reembolso:</strong> ${reembolsoInfo.status || 'N/A'}</li>
            </ul>

            <p>O reembolso foi processado e você deverá receber o valor em sua conta nos próximos dias.</p>

            <p style="margin-top: 20px;">
              <a href="injectgo.com.br" style="display: inline-block; padding: 10px 15px; background-color: #ec3f79; color: #fff; text-decoration: none; border-radius: 5px;">Ver Pedido no App</a>
            </p>
          </div>

          <div style="background-color: #f1f1f1; padding: 10px; text-align: center;">
            <p style="font-size: 12px; color: #888;">InjectGO © 2024. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    `;

    const htmlContentEnviado = (distribuidor, endereco, envio, codigoRastreio) => `
    <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #ec3f79; padding: 10px 0; text-align: center;">
          <img src="cid:logo" alt="InjectGO Logo" style="width: 150px;"/>
        </div>
        
        <div style="padding: 20px;">
          <h1 style="color: #333;">Seu pedido foi enviado!</h1>
          <p>O seu pedido foi enviado e está a caminho.</p>

          <h2 style="color: #ec3f79;">Pedido:</h2>
          ${htmlProdutos}

          <h2 style="color: #ec3f79;">Distribuidor:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Razão Social:</strong> ${distribuidor.razao_social || 'N/A'}</li>
            <li><strong>CNPJ:</strong> ${distribuidor.cnpj || 'N/A'}</li>
            <li><strong>E-mail:</strong> ${distribuidor.email || 'N/A'}</li>
            <li><strong>Telefone:</strong> ${distribuidor.telefone || 'N/A'}</li>
          </ul>

          <h2 style="color: #ec3f79;">Endereço de Entrega:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Rua:</strong> ${endereco.rua || 'N/A'}, ${endereco.numero || 'N/A'}</li>
            <li><strong>Bairro:</strong> ${endereco.bairro || 'N/A'}</li>
            <li><strong>Cidade:</strong> ${endereco.cidade || 'N/A'} - ${endereco.uf || 'N/A'}</li>
            <li><strong>CEP:</strong> ${endereco.cep || 'N/A'}</li>
            <li><strong>Complemento:</strong> ${endereco.complemento || 'N/A'}</li>
          </ul>

          <h2 style="color: #ec3f79;">Informações de Envio:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Frete:</strong> R$ ${(typeof envio.frete === 'number' ? envio.frete.toFixed(2) : '0.00')}</li>
            <li><strong>Responsável pelo envio:</strong> ${envio.responsavel || 'N/A'}</li>
            <li><strong>Tempo Previsto de Entrega:</strong> ${typeof envio.tempoPrevisto === 'number' ? envio.tempoPrevisto : 'N/A'} dias</li>
            <li><strong>Código de Rastreio:</strong> ${codigoRastreio || 'N/A'}</li>
          </ul>

          <p style="margin-top: 20px;">
            <a href="injectgo.com.br" style="display: inline-block; padding: 10px 15px; background-color: #ec3f79; color: #fff; text-decoration: none; border-radius: 5px;">Ver Pedido no App</a>
          </p>
          </div>

        <div style="background-color: #f1f1f1; padding: 10px; text-align: center;">
          <p style="font-size: 12px; color: #888;">InjectGO © 2024. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
    `;

    let htmlContent;
    if (status === 'aprovado') {
      htmlContent = htmlContentAprovado(distribuidor, endereco, envio );
    } else if (status === 'rejeitado') {
      const reembolsoInfo = pedido.reembolsoInfo || {};
      htmlContent = htmlContentRejeitado(distribuidor, reembolsoInfo);
    } else if (status === 'enviado') {
      htmlContent = htmlContentEnviado(distribuidor, endereco, envio, 'codigoRastreio'); /** COLOCAR CODIGO REAL */
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.MAIL_SENDER, pass: process.env.MAIL_PASSWORD }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: profissionalEmail,
      subject: titulo,
      html: htmlContent,
      attachments: [{
        filename: 'logoDeitadaBranca.jpeg',
        path: 'fotos/logoDeitadaBranca.jpeg',
        cid: 'logo'
      }]
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('E-mail enviado com sucesso para ', info.accepted);
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return { success: false, error: error.message };
  }
}
  
async function enviarEmailDistribuidor(externalReference, distribuidorId, titulo) {
    try {
      const distribuidorRef = db.collection('distribuidores').doc(distribuidorId);
      const distribuidorDoc = await distribuidorRef.get();
  
      if (!distribuidorDoc.exists) {
        console.log(`Distribuidor com ID ${distribuidorId} não encontrado.`);
        return;
      }
  
      const distribuidorData = distribuidorDoc.data();
      const distribuidorEmail = distribuidorData.email;
  
      if (!distribuidorEmail) {
        console.log(`Nenhum email encontrado para o distribuidor com ID ${distribuidorId}.`);
        return;
      }
  
      const pedidoRef = distribuidorRef.collection('vendas').doc(externalReference);
      const pedidoDoc = await pedidoRef.get();
  
      if (!pedidoDoc.exists) {
          console.log(`Pedido com ID ${externalReference} não encontrado.`);
          return;
      }
  
      const pedido = pedidoDoc.data();
  
      const comprador = pedido.buyerInfo;
      const endereco = pedido.endereco_entrega;
      const envio = pedido.info_envio;
      const produtosHtml = pedido.produtos.map(produto => `
        <li>
          <img src="${produto.productInfo.imageUrl}" alt="${produto.productInfo.nome}" style="width: 100px; height: 100px; object-fit: cover;"/> <br/>
          <strong>Produto:</strong> ${produto.productInfo.nome} <br/>
          <strong>Preço:</strong> R$ ${produto.productInfo.preco.toFixed(2)} <br/>
          <strong>Quantidade:</strong> ${produto.productInfo.quantidade} <br/>
        </li>
      `).join('');
  
      // Construir o conteúdo HTML estilizado com os pedido:
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            
            <div style="background-color: #ec3f79; padding: 10px 0; text-align: center;">
              <img src="cid:logo" alt="InjectGO Logo" style="width: 150px;"/>
            </div>
            
            <div style="padding: 20px;">
              <h1 style="color: #333;">Compra Solicitada</h1>
              <p>O pedido de ID <strong>${pedido.payment_id}</strong> foi solicitado.</p>
              
              <h2 style="color: #ec3f79;">Pedido:</h2>
              <ul style="list-style: none; padding: 0;">
                ${produtosHtml}
              </ul>

              <h2 style="color: #ec3f79;">Comprador:</h2>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Comprador:</strong> ${comprador.nome} (${comprador.email})</li>
                <li><strong>Telefone:</strong> ${comprador.telefone}</li>
              </ul>
              
              <h2 style="color: #ec3f79;">Endereço de Entrega:</h2>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Rua:</strong> ${endereco.rua}, ${endereco.numero}</li>
                <li><strong>Bairro:</strong> ${endereco.bairro}</li>
                <li><strong>Cidade:</strong> ${endereco.cidade} - ${endereco.uf}</li>
                <li><strong>CEP:</strong> ${endereco.cep}</li>
                <li><strong>Complemento:</strong> ${endereco.complemento}</li>
              </ul>
  
              <h2 style="color: #ec3f79;">Informações de Envio:</h2>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Responsável:</strong> ${envio.responsavel}</li>
                <li><strong>Frete:</strong> R$ ${envio.frete}</li>
                <li><strong>Tempo Previsto:</strong> ${envio.tempo_previsto} dias</li>
                <li><strong>Dimensões:</strong> ${envio.dimensoes_caixa.altura}x${envio.dimensoes_caixa.largura}x${envio.dimensoes_caixa.comprimento} cm</li>
                <li><strong>Peso Aproximado:</strong> ${envio.dimensoes_caixa.peso_aproximado} kg</li>
              </ul>
  
              <p style="margin-top: 20px;">
                <a href="injectgo.com.br" style="display: inline-block; padding: 10px 15px; background-color: #ec3f79; color: #fff; text-decoration: none; border-radius: 5px;">Ver Pedido no App</a>
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
        secure: true,
        auth: { user: process.env.MAIL_SENDER, pass: process.env.MAIL_PASSWORD }
      });
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: distribuidorEmail,
        subject: titulo,
        html: htmlContent,
        attachments: [{
          filename: 'logoDeitadaBranca.jpeg',
          path: 'fotos/logoDeitadaBranca.jpeg',
          cid: 'logo'
        }]
      }
      
      const info = await transporter.sendMail(mailOptions);
      console.log('E-mail enviado com sucesso para ', info.accepted);
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
    }
  }
  
  
module.exports = {
    enviarEmailDistribuidor,
    enviarEmailProfissional,
  };
  