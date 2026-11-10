const locationId = 'Xh4xXC1YTfKzsjcS4qAr';
const token = 'pit-638857a8-7b60-4458-8217-96e9214123ba';

async function buscarCliquesAnalyticsTemplate() {
  console.log('A consultar os dados de interações do template de WhatsApp via API (com paginação)...\n');

  try {
    let conversas = [];
    let nextPageUrl = `https://services.leadconnectorhq.com/conversations/search?locationId=${locationId}&limit=100`;

    // Paginação segura respeitando o limite máximo de 100 por requisição
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-04-15',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Erro ao buscar página: ${response.status}`);
        break;
      }

      const data = await response.json();
      const opps = data.conversations || [];
      conversas = conversas.concat(opps);

      // Tratamento da paginação da API de conversas do GHL
      if (data.meta && data.meta.nextPageUrl) {
        nextPageUrl = data.meta.nextPageUrl;
      } else if (data.meta && data.meta.startAfter && opps.length > 0) {
        nextPageUrl = `https://services.leadconnectorhq.com/conversations/search?locationId=${locationId}&limit=100&startAfter=${data.meta.startAfter}`;
      } else {
        nextPageUrl = null;
      }
    }

    console.log(`Total de conversas obtidas: ${conversas.length}. Analisando mensagens...`);

    const clicaramOferta = [];
    const recusaramOferta = [];

    for (const conv of conversas) {
      try {
        const resMsg = await fetch(`https://services.leadconnectorhq.com/conversations/${conv.id}/messages`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-04-15',
            'Accept': 'application/json'
          }
        });

        if (!resMsg.ok) continue;

        const dataMsg = await resMsg.json();
        const mensagens = dataMsg.messages?.messages || dataMsg.messages || [];

        for (const msg of mensagens) {
          const rawStr = JSON.stringify(msg).toUpperCase();

          if (
            rawStr.includes('OBTER OFERTA') || 
            rawStr.includes('OBTER_OFERTA') || 
            (rawStr.includes('OBTER') && rawStr.includes('OFERTA'))
          ) {
            clicaramOferta.push({
              Nome: conv.contactName || 'Sem Nome',
              Contact_ID: conv.contactId,
              Telefone: conv.phone || 'N/D',
              Data: msg.dateAdded || 'N/D'
            });
            break;
          }
          
          if (rawStr.includes('NÃO TENHO INTERESSE') || rawStr.includes('NAO TENHO INTERESSE')) {
            recusaramOferta.push({
              Nome: conv.contactName || 'Sem Nome',
              Contact_ID: conv.contactId,
              Telefone: conv.phone || 'N/D',
              Data: msg.dateAdded || 'N/D'
            });
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        // Ignora erros individuais
      }
    }

    console.clear();
    console.log('==================================================');
    console.log(`🔥 TOTAL ENCONTRADO NO SCRIPT ("OBTER OFERTA"): ${clicaramOferta.length}`);
    console.log('==================================================');
    console.table(clicaramOferta);

    console.log('\n==================================================');
    console.log(`❌ TOTAL ENCONTRADO NO SCRIPT ("NÃO TENHO INTERESSE"): ${recusaramOferta.length}`);
    console.log('==================================================');
    console.table(recusaramOferta);

  } catch (error) {
    console.error('Erro na requisição:', error.message);
  }
}

buscarCliquesAnalyticsTemplate();