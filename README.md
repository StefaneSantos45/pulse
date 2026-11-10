# Pulse · Dashboard de leads

Dashboard React conectada à subconta GoHighLevel configurada no servidor.

## Abrir

Com o servidor em execução, acesse http://127.0.0.1:4317.

Para iniciar novamente, abra um terminal nesta pasta e execute:

```powershell
node server.mjs --production
```

Para instalar e compilar em outra máquina (Node.js 24):

```powershell
npm ci
npm run build
npm start
```

Copie `.env.example` para `.env` e configure `GHL_TOKEN`, `GHL_LOCATION_ID` e `PORT=4317`. O arquivo `.env` local já está configurado nesta máquina. O token nunca é incluído na aplicação do navegador. Não compartilhe `.env` nem `.cache/`.

## Recursos

- Períodos de 7, 30 e 90 dias completos e datas personalizadas (até 366 dias).
- Contagem diária, média, melhor dia e comparação com o intervalo anterior equivalente.
- Comparação opcional no gráfico; tabela diária e exportação CSV.
- Atualização automática de todas as fontes, com status global, tentativas após falhas e botão Atualizar tudo agora.
- Layout para desktop e celular, estados de carregamento e erros.

## Dados e limites

“Lead” significa contato criado, independentemente de sua classificação atual como lead ou cliente. Cada ID conta uma vez. Importações também podem gerar cadastros. O fuso utilizado é America/Sao_Paulo e hoje fica fora dos períodos completos.

O servidor consulta a API, verifica a paginação e mantém cópias locais com os campos utilizados por cada módulo, incluindo dados de contatos. A interface recebe indicadores e listas. Não compartilhe a pasta .cache: ela contém dados privados da operação.

Esta primeira versão suporta até 10.000 contatos na busca paginada. Se a base exceder esse limite, ou mudar de tamanho durante a coleta, uma mensagem pede nova tentativa e a cópia anterior é preservada. Para bases maiores, será necessário adaptar a coleta para particionamento ou cursor.

O servidor escuta apenas em 127.0.0.1. Esta versão é local e não contém login para publicação na internet.

## Desenvolvimento e testes

```powershell
npm run dev
npm test
```

O modo dev recompila ao iniciar. Após editar a interface, execute `npm run build` e atualize a página; não há recarga automática. A compilação usa Rollup e Babel, sem processos auxiliares, para funcionar neste ambiente Windows. Os cálculos ficam em `metrics.mjs`, a conexão em `server.mjs` e a interface em `src/`.

## Módulo Mensagens

Acesse http://127.0.0.1:4317/#messages. O módulo é separado de Aquisição e crescimento e considera apenas WhatsApp, incluindo os registros classificados como SMS pela integração informada pelo usuário. A lista contém somente os contatos identificados na base consultada, após as exclusões solicitadas. Cadastros com a palavra grupo/grupos ou @g.us no nome ficam fora da lista e de todos os indicadores.

Há nome, telefone, quantidade de mensagens recebidas e enviadas, primeira e última resposta e último envio. A interface mostra datas em Brasília; o CSV identifica suas colunas de data como UTC.

- Respondeu: ao menos uma mensagem recebida, inclusive se o contato iniciou a conversa.
- Nunca respondeu: nenhum recebimento no histórico exportável.
- Enviado, sem resposta: parte da categoria anterior com saída registrada; não garante entrega.
- Sem troca registrada: nenhum recebimento ou envio de WhatsApp.

Cada ID de contato conta uma vez. Contatos não identificados na base consultada ficam fora dos totais deste módulo. Há busca, filtros, paginação e exportação CSV. O resumo é salvo em .cache/replies.json e atualizado pelo ciclo global. O histórico mínimo privado em .cache/replies-history.json permite atualização incremental, com sobreposição de um dia e conferência completa a cada 24 horas. O módulo de investigação mantém separadamente os textos necessários em .cache/investigation-history.json, nunca servida como arquivo estático.

## Módulo Oportunidades

Acesse http://127.0.0.1:4317/#opportunities. Consulta o pipeline Vendas e a coluna Venda, incluindo todos os status. Uma linha representa uma oportunidade; contatos distintos e oportunidades são contados separadamente.

Colunas: nome, telefone, valor registrado, cadastro do lead (data de criação do contato), criação da oportunidade e última entrada na coluna Venda (lastStageChangeAt). A criação da oportunidade não é tratada como a entrada no pipeline Vendas. A data de atualização geral e a data de mudança de status não são usadas como datas de entrada na coluna.

Inclui busca, paginação, exportação CSV e atualização própria pela API. A consulta é salva em .cache/sales.json. O token continua somente no servidor. Dados ausentes são apresentados como não informados. A conta não informou moeda na API, portanto os valores são exibidos sem símbolo ou conversão. As datas na interface usam Brasília, e o CSV identifica datas em UTC.

O indicador Tempo médio até Venda calcula a média aritmética, por oportunidade, entre o cadastro do lead e a última entrada na coluna Venda. Usa dias corridos com as horas incluídas, exclui datas inválidas/ausentes ou intervalos negativos e informa o tamanho da amostra. É recalculado para o período e a busca selecionados, assim como os totais, o gráfico, a lista e a exportação CSV.

O filtro considera a última entrada na coluna Venda, incluindo os dias inicial e final em Brasília. Há atalhos para todo o período, 7 dias, 30 dias e este mês, além de datas personalizadas. O gráfico alterna quantidade e valor, por dia ou mês, preenchendo períodos sem vendas com zero. Intervalos acima de 366 dias usam meses. Hoje é parcial até a consulta. São consideradas oportunidades atualmente na coluna; vendas que já saíram dela não são reconstruídas.


## Módulo Formulários e Pesquisas

Acesse http://127.0.0.1:4317/#forms. Coleta paginada desde 01/01/2000, com validação dos totais e preservação da consulta anterior em caso de falha. Formulários externos são separados pelo ID externo. Campos personalizados usam os títulos disponíveis; campos excluídos ou sem título permanecem identificados. As respostas originais do Facebook têm prefixo Facebook e podem repetir a pergunta de um campo personalizado; não devem ser somadas entre perguntas. Telefone e e-mail ausentes são complementados com o cadastro atual.

Datas, tipo, formulário e busca afetam todos os indicadores, gráficos, distribuição, lista e CSV. Datas incluem os dois dias em Brasília; hoje é parcial. Pessoas únicas usam contactId; reenvios são contados por pessoa no recorte. A distribuição conta envios por pergunta e cada alternativa uma vez por envio. Múltiplas escolhas podem somar mais de 100%.

Cada oportunidade atualmente na coluna Venda é vinculada uma vez ao último envio anterior à venda que atende aos filtros. Isso mede associação temporal, não atribuição causal. Oportunidades que saíram da coluna não são reconstruídas. A média usa dias corridos fracionários. O período filtra os envios; vendas posteriores ao fim do período podem entrar até a consulta de oportunidades, cujo horário aparece separadamente. O ciclo global atualiza envios e oportunidades; os botões individuais antecipam somente suas fontes. Moeda ausente não é presumida e valores não comprovam recebimento.

A opção Responderam mais de uma vez seleciona contatos com pelo menos dois envios dentro dos filtros atuais (data, formulário, tipo e busca). O cartão Responderam novamente oferece o mesmo atalho. Todos os envios dessas pessoas permanecem na lista, com uma coluna de quantidade por pessoa, também incluída no CSV. Contatos sem ID não são agrupados como uma pessoa.


Aquisição e crescimento inclui o card Leads via formulários: contatos distintos com envio do tipo Formulário no período selecionado, incluindo formulários externos. Usa data do envio em Brasília e pode incluir contatos cadastrados anteriormente; não afirma atribuição de aquisição. Reenvios não duplicam pessoas. O card usa a consulta salva de formulários e informa seu horário; os envios são atualizados pelo ciclo global ou pelo botão do módulo Formulários e Pesquisas.


## Módulo Estratégias

Acesse http://127.0.0.1:4317/#strategies. Cruza as quatro consultas salvas por contactId. Os filtros selecionam cadastros pela data de criação; para essa coorte, o histórico dos demais módulos é integral. Os indicadores de aquisição dos últimos 30 dias são contexto geral fixo, ancorado na data da consulta. A fila comercial exclui quem está na coluna Venda; isso não comprova ausência de compras históricas.

Seis filas exclusivas: reenvio com resposta; um formulário com resposta; formulário sem troca; formulário com envio e sem resposta; conversa sem formulário; base sem resposta nem formulário. A prioridade é uma hipótese de trabalho, não uma probabilidade de compra. Formulários posteriores ao corte de mensagens ou sem data ficam fora das filas de ação. Contatos ausentes da base individual de WhatsApp e grupos não entram no cruzamento. Cada fonte exibe sua data e cobertura; por isso os contatos com Venda no cruzamento podem diferir do total da coluna.

A interface apresenta evidências, hipótese, ação, teste inicial, indicadores para medição manual, rascunho de mensagem e público exportável. Não envia mensagens, modifica contatos, executa workflows nem registra automaticamente resultados dos testes. Exemplos devem ser revisados com o histórico atual. Métricas por formulário são sobrepostas e não medem atribuição causal. Respostas de pesquisa mostram até três opções por pergunta e contam envios, incluindo reenvios. O ciclo da coluna inteira é descritivo apenas dos registros observados.

Recalcular análise relê consultas salvas; não é nova coleta de GoHighLevel. Busca por nome, telefone e formulário afeta apenas a lista e sua exportação; datas afetam a coorte completa.

## Módulo Tags

Acesse http://127.0.0.1:4317/#tags. Consulta as nove tags marcadas na imagem do usuário, com correspondência exata de nome. Exibe quantidade por tag, união de contatos e contatos com múltiplas tags selecionadas. Tags desmarcadas ficam fora. A seleção de uma tag e a busca afetam apenas a lista e sua exportação; os indicadores mantêm as nove tags. Coleta todos os contatos, valida paginação e totais e mantém a consulta anterior se falhar. Exclui nomes com grupo/grupos ou @g.us. A base de tags tem atualização própria e pode diferir em data e quantidade dos outros módulos. Tags são atuais, sem data de aplicação; cadastro exibido é a criação do contato. Nenhum contato é excluído por ser cliente ou por etapa comercial.


## Saúde do negócio

Acesse http://127.0.0.1:4317/#health. Mostra sinais comerciais observáveis, sem score geral ou metas presumidas. Compara 7, 30 ou 90 dias completos com a janela anterior, ancorados no último dia completo comum às consultas de aquisição, mensagens, formulários e oportunidades. Aumentos e quedas são descritivos, sem classificação arbitrária de negócio saudável ou doente.

Formulários contam pessoas únicas por período; a série diária pode repetir uma pessoa em vários dias. Respostas consideram os cadastros do período presentes na base individual e seu histórico até a consulta. Vendas e valores usam apenas oportunidades atualmente na coluna Venda, pela última entrada; valores não são recebimentos. Ciclo e valor médio informam a limitação da amostra. Custos, lucro, caixa, CAC, retorno, retenção e metas ficam explicitamente não avaliados. Recalcular visão usa consultas salvas, não atualiza o CRM.


Meta comercial definida pelo usuário: 30.000 por mês calendário. Configurada em business-goals.mjs e exibida em Saúde do negócio, independente da janela móvel. Soma oportunidades atualmente na coluna Venda pela última entrada no mês, até a consulta. A média necessária divide a diferença positiva pelo número de dias restantes, incluindo hoje parcial. Não é projeção, recebimento ou lucro. Se a consulta for anterior ao mês atual, a meta aparece sem avaliação.


Oportunidades também mostra origem e contexto. Consulta fonte do cadastro, primeira e última atribuição e tags atuais dos contatos; cruza formulários salvos anteriores à última entrada em Venda. A origem principal usa a primeira atribuição, com fallback para o campo source, sem promover tags atuais ou formulários vinculados a atribuição comprovada. Cadastro manual é mecanismo de entrada e pode coexistir com influencer ou indicação nas tags. Resumos por tags e formulários são sobrepostos, enquanto a origem registrada conta cada oportunidade uma vez. Filtros de origem, tag ou formulário afetam os indicadores, lista e CSV. Atualizar oportunidades também renova a consulta de origem dos contatos; os formulários mantêm sua consulta independente. Metadados de IP e navegador não são expostos.


## Atualização automática de todo o sistema

Ao iniciar o servidor, um ciclo consulta contatos, formulários/pesquisas, ciclo de vida, oportunidades/origens, tags, mensagens e investigação; em seguida, valida estratégias, saúde e cruzamentos. O próximo ciclo começa 5 minutos depois do término. Ciclos simultâneos compartilham a mesma execução. O estado e os horários são persistidos em .cache/system-sync.json, e reiniciar o servidor respeita o próximo horário quando aplicável.

As telas consultam o status a cada 5 segundos e recarregam seus dados ao concluir o ciclo, sem recarregar a página ou limpar filtros. O painel mostra a última conclusão por fonte, falhas e atualização parcial. Fontes com falha preservam os dados anteriores; a próxima execução tenta novamente. Atualizar tudo agora antecipa um ciclo. GET /api/system/status consulta o estado; POST /api/system/sync inicia ou acompanha a execução atual.

O servidor local precisa permanecer ligado. Não é uma integração instantânea por webhook: a latência inclui o intervalo e o tempo de consulta da API. Contatos, oportunidades e formulários são relidos integralmente. Mensagens usam atualização incremental e revisão completa diária; a investigação recarrega os últimos 7 dias entre revisões completas para atualizar texto e status de entrega recentes. A primeira investigação completa pode levar vários minutos. Exclusões ou alterações históricas antigas em mensagens aparecem na revisão completa.
