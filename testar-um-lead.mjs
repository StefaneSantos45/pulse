const locationId = 'Xh4xXC1YTfKzsjcS4qAr';
const token = 'pit-638857a8-7b60-4458-8217-96e9214123ba';
const tagParaAdicionar = 'chamada_freemiun_disparo_sms';

// Nomes de referência da coluna para detetar o Stage correto
const nomesReferencia = ['sandro rocha', 'juliana floriano', 'andré raize'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function aplicarTagEmMassa() {
  let allOpportunities = [];
  let nextPageUrl = `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100`;

  console.log('🔍 A procurar as oportunidades da coluna "Template Enviado"...');

  try {
    // 1. Paginação para recolher todas as oportunidades
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
      allOpportunities = allOpportunities.concat(data.opportunities || []);
      nextPageUrl = data.meta?.nextPageUrl || (data.meta?.startAfter && (data.opportunities || []).length > 0 ? `https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=100&startAfter=${data.meta.startAfter}` : null);
    }

    // 2. Identifica o Stage ID correto
    let targetStageId = null;
    for (const opp of allOpportunities) {
      const nomeLead = (opp.name || opp.contact?.name || '').toLowerCase();
      if (nomesReferencia.some(ref => nomeLead.includes(ref))) {
        targetStageId = opp.pipelineStageId;
        break;
      }
    }

    if (!targetStageId) {
      console.log('❌ Erro: Não foi possível mapear a coluna.');
      return;
    }

    // 3. Filtra estritamente os leads da coluna com valor > 0
    const leadsAlvo = allOpportunities.filter(opp => {
      return opp.pipelineStageId === targetStageId && parseFloat(opp.monetaryValue || 0) > 0 && opp.contactId;
    });

    console.clear();
    console.log('==================================================');
    console.log(`🚀 INICIANDO APLICAÇÃO DA TAG EM ${leadsAlvo.length} LEADS`);
    console.log(`🏷️ Tag: '${tagParaAdicionar}'`);
    console.log('==================================================\n');

    let sucessos = 0;
    let jaPossuía = 0;
    let falhas = 0;

    for (let i = 0; i < leadsAlvo.length; i++) {
      const opp = leadsAlvo[i];
      const contactId = opp.contactId;
      const nomeLead = opp.name || opp.contact?.name || 'Sem Nome';

      try {
        // A. Busca os dados e tags atuais do contacto
        const getRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        });

        if (!getRes.ok) {
          console.log(`[${i + 1}/${leadsAlvo.length}] ❌ Erro ao consultar contacto: ${nomeLead}`);
          falhas++;
          continue;
        }

        const contactData = await getRes.json();
        const contact = contactData.contact || contactData;
        const tagsAtuais = contact.tags || [];

        // B. Se já tiver a tag, ignora
        if (tagsAtuais.includes(tagParaAdicionar)) {
          jaPossuía++;
          console.log(`[${i + 1}/${leadsAlvo.length}] ℹ️ ${nomeLead} já possui a tag. Ignorado.`);
          continue;
        }

        // C. Adiciona a nova tag preservando as anteriores
        const novasTags = [...tagsAtuais, tagParaAdicionar];

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
          sucessos++;
          console.log(`[${i + 1}/${leadsAlvo.length}] ✅ Sucesso! Tag adicionada a "${nomeLead}"`);
        } else {
          falhas++;
          console.log(`[${i + 1}/${leadsAlvo.length}] ❌ Erro ao atualizar "${nomeLead}" (Status ${putRes.status})`);
        }

        // Pausa de segurança entre chamadas
        await sleep(300);

      } catch (err) {
        falhas++;
        console.error(`❌ Erro de execução no lead ${contactId}:`, err.message);
      }
    }

    console.log('\n==================================================');
    console.log('🏁 EXECUÇÃO CONCLUÍDA COM SUCESSO!');
    console.log(`- Total processados: ${leadsAlvo.length}`);
    console.log(`- Novos atualizados: ${sucessos}`);
    console.log(`- Já possuíam a tag (ignorados): ${jaPossuía}`);
    console.log(`- Falhas: ${falhas}`);
    console.log('==================================================');

  } catch (error) {
    console.error('Erro geral no script:', error.message);
  }
}

aplicarTagEmMassa();