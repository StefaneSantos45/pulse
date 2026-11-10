const locationId = 'Xh4xXC1YTfKzsjcS4qAr';
const token = 'pit-638857a8-7b60-4458-8217-96e9214123ba';

// Nomes de referência da coluna "Template Enviado"
const nomesReferencia = [
  'sandro rocha',
  'juliana floriano',
  'andré raize',
  'cristina poplawski',
  'josue dos santos batista junior'
];

async function listarLeadsComValorNaColuna() {
  let allOpportunities = [];
  let nextPageUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100`;

  console.log('🔍 A buscar e a filtrar oportunidades com valor > 0 na coluna "Template Enviado"...');

  try {
    // 1. Paginação para trazer todas as oportunidades
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

    // 2. Mapeia o Stage ID exato da coluna
    let targetStageId = null;
    for (const opp of allOpportunities) {
      const nomeLead = (opp.name || opp.contact?.name || '').toLowerCase();
      if (nomesReferencia.some(ref => nomeLead.includes(ref))) {
        targetStageId = opp.pipelineStageId;
        break;
      }
    }

    if (!targetStageId) {
      console.log('❌ Não foi possível mapear o Stage ID da coluna.');
      return;
    }

    // 3. Filtra estritamente pela coluna E por valor > 0
    const leadsFiltrados = allOpportunities.filter(opp => {
      const eDaColuna = opp.pipelineStageId === targetStageId;
      const temValor = parseFloat(opp.monetaryValue || 0) > 0;
      return eDaColuna && temValor && opp.contactId;
    });

    console.clear();
    console.log('==================================================');
    console.log(`🎯 LEADS NA COLUNA "Template Enviado" COM VALOR > 0,00: ${leadsFiltrados.length}`);
    console.log(`🆔 Stage ID: ${targetStageId}`);
    console.log('==================================================\n');

    const listaTabela = leadsFiltrados.map((opp, index) => ({
      N: index + 1,
      Nome_Lead: opp.name || opp.contact?.name || 'Sem Nome',
      Valor: `R$ ${parseFloat(opp.monetaryValue).toFixed(2)}`,
      Contact_ID: opp.contactId,
      Oportunidade_ID: opp.id
    }));

    console.table(listaTabela);
    console.log('\n✅ Consulta concluída sem nenhuma alteração nos contactos.');

  } catch (error) {
    console.error('Erro:', error.message);
  }
}

listarLeadsComValorNaColuna();