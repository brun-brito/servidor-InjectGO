
const { JWT } = require('google-auth-library');

async function getAccessToken() {
    try {
      const client = new JWT({
        email: process.env.FIREBASE_CLIENT_EMAIL,
        key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
  
      const tokens = await client.authorize();
      return tokens.access_token;
    } catch (error) {
      console.error('Erro ao gerar o token de acesso:', error);
      throw error;
    }
  }

  module.exports = {
    getAccessToken
};