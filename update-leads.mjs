const locationId = 'Xh4xXC1YTfKzsjcS4qAr';
const token = 'pit-638857a8-7b60-4458-8217-96e9214123ba';
const targetStageId = '1e7f8965-de5b-4f13-a990-18e16c5cf21b'; // ID da coluna "Parou de responder"
const tagToAdd = 'black26';

// Lead de teste que deve ser ignorado
const idsParaIgnorar = [
  'FwASpG56LEOQXypJHPLc' // Wagner Magalhães
];

async function atualizarParouDeResponder() {
  let allOpportunities = [];
  let nextPageUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100`;

  console.log('1. A buscar todas as oportunidades da API...');

  try {
    // Busca com paginação completa
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      const opps = data.opportunities || [];
      allOpportunities = allOpportunities.concat(opps);

      if (data.meta && data.meta.nextPageUrl) {
        nextPageUrl = data.meta.nextPageUrl;
      } else if (data.meta && data.meta.startAfter && opps.length > 0) {
        nextPageUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100&startAfter=${data.meta.startAfter}`;
      } else {
        nextPageUrl = null;
      }
    }

    // Filtra apenas os da coluna "Parou de responder" excluindo o de teste
    const leadsAlvo = allOpportunities.filter(opp => {
      return opp.pipelineStageId === targetStageId && !idsParaIgnorar.includes(opp.contactId);
    });

    console.log(`\n🎯 Total de leads restantes para atualizar: ${leadsAlvo.length}\n`);

    let sucessos = 0;
    let falhas = 0;

    for (const [index, opp] of leadsAlvo.entries()) {
      const contactId = opp.contactId;
      const nomeLead = opp.name || opp.contact?.name || 'Sem Nome';

      if (!contactId) {
        console.log(`[${index + 1}/${leadsAlvo.length}] ⚠️ Oportunidade ${opp.id} (${nomeLead}) sem contactId.`);
        falhas++;
        continue;
      }

      try {
        // 1. Busca as tags atuais para não as apagar
        const getRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        });

        if (!getRes.ok) {
          console.log(`[${index + 1}/${leadsAlvo.length}] ❌ Erro ao buscar contacto "${nomeLead}"`);
          falhas++;
          continue;
        }

        const getData = await getRes.json();
        const contact = getData.contact || getData;
        let tagsAtuais = contact.tags || [];

        // 2. Adiciona a nova tag se ainda não existir
        if (!tagsAtuais.includes(tagToAdd)) {
          tagsAtuais.push(tagToAdd);
        }

        // 3. Atualiza o contacto no GHL mantendo as tags antigas
        const updateRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            tags: tagsAtuais
          })
        });

        if (updateRes.ok) {
          console.log(`[${index + 1}/${leadsAlvo.length}] ✅ Sucesso: Tag adicionada a "${nomeLead}"`);
          sucessos++;
        } else {
          const errText = await updateRes.text();
          console.log(`[${index + 1}/${leadsAlvo.length}] ❌ Erro no lead "${nomeLead}": ${updateRes.status} - ${errText}`);
          falhas++;
        }

        // Pausa de 200ms entre chamadas para evitar rate limit da API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.log(`[${index + 1}/${leadsAlvo.length}] ❌ Erro de rede em "${nomeLead}": ${err.message}`);
        falhas++;
      }
    }

    console.log('\n==================================================');
    console.log(`🏁 ATUALIZAÇÃO CONCLUÍDA!`);
    console.log(`Sucessos: ${sucessos}`);
    console.log(`Falhas: ${falhas}`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('Erro geral no script:', error.message);
  }
}

atualizarParouDeResponder();