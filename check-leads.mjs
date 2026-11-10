const locationId = 'Xh4xXC1YTfKzsjcS4qAr';
const token = 'pit-638857a8-7b60-4458-8217-96e9214123ba';
const targetStageId = '75d2f12d-7d18-4032-a6ff-e35c6b25c112'; 

async function testarLeadDiferente() {
  let allOpportunities = [];
  let nextPageUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100`;

  console.log('A procurar os leads no Stage 863...');

  try {
    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) break;

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

    const leadsNoStage = allOpportunities.filter(opp => opp.pipelineStageId === targetStageId && opp.contactId);
    
    // Escolhe um lead diferente (ex: alterando o índice para pegar o 5º lead, ou seja, índice 4)
    const indiceDoLead = 4; // Podes mudar para 5, 6, 10, etc.
    const leadSelecionado = leadsNoStage[indiceDoLead];

    if (!leadSelecionado) {
      console.log('❌ Lead não encontrado nessa posição.');
      return;
    }

    console.clear();
    console.log('==================================================');
    console.log(`🧪 TESTE COM NOVO LEAD SELECIONADO (Índice ${indiceDoLead + 1}):`);
    console.log(`- Nome: ${leadSelecionado.name || leadSelecionado.contact?.name || 'Sem Nome'}`);
    console.log(`- ID de Contacto: ${leadSelecionado.contactId}`);
    console.log('==================================================\n');

    const contactId = leadSelecionado.contactId;
    const nomeLead = leadSelecionado.name || leadSelecionado.contact?.name || 'Sem Nome';

    // A. Busca as tags atuais para preservar
    const getRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });

    if (!getRes.ok) {
      console.log(`❌ Erro ao buscar dados do contacto ${nomeLead}`);
      return;
    }

    const contactData = await getRes.json();
    const tagsAtuais = contactData.contact?.tags || [];

    let novasTags = [...tagsAtuais];
    if (!novasTags.includes('black26')) {
      novasTags.push('black26');
    }

    // B. Atualiza o contacto adicionando a tag de forma segura
    const putRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tags: novasTags
      })
    });

    if (putRes.ok) {
      console.log(`✅ Sucesso! O novo lead (${nomeLead}) foi atualizado com a tag 'black26' (tags anteriores preservadas).`);
      console.log('🚀 Podes verificar agora os Registos de Execução no Workflow para este contacto!');
    } else {
      console.log(`❌ Falha ao atualizar o lead (Status ${putRes.status})`);
    }

  } catch (error) {
    console.error('Erro na execução:', error.message);
  }
}

testarLeadDiferente();