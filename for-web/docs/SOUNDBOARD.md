# Efeitos sonoros compartilhados

## Uso

O botão de nota musical fica nos controles da chamada, tanto na grade quanto no
Living Room e nos controles compactos. A reprodução pertence ao contexto global
de voz: fechar a biblioteca, trocar de conversa, esconder a bandeja ou mudar de
grade para Room não interrompe o efeito.

A chamada não reserva uma faixa de status para os efeitos. No Room, clicar no
avatar abre um menu sobre a sala com os quatro efeitos usados mais recentemente,
completando os lugares livres com os recém-adicionados, e um atalho para o painel
completo. Clicar fora ou pressionar Escape fecha o menu. O botão de nota musical
na bandeja continua abrindo o painel completo em qualquer visualização.

Na primeira abertura, cole o convite da biblioteca e clique em **Conectar**. A
instalação recebe uma sessão anônima do Supabase; o convite libera sua associação
à biblioteca. Não é necessário cadastrar email ou outra senha. A sessão é local
por conta Stoat e projeto Supabase. Perder os dados do site exige novo ingresso.
O arquivo local `.env.soundboard-invite.local` contém o primeiro convite. Está
ignorado pelo Git e não é incluído na build. Compartilhe seu valor com os amigos
que vão usar a biblioteca; ele permite ingressar por 30 dias a partir da criação.
As associações já aceitas continuam válidas depois que o convite expira.

- **Ativar efeitos** adiciona o perfil à chamada para todos os clientes compatíveis.
- O botão grande de cada efeito toca para a chamada; o botão de **fones** faz uma
  prévia apenas no dispositivo atual. A interface diferencia os dois estados.
- Qualquer integrante da biblioteca pode parar ou desativar os efeitos. A interface
  exige permissão de fala para iniciar um efeito compartilhado.
- Um efeito por vez na chamada. O próximo substitui o atual; o servidor aplica
  intervalo mínimo de 800 ms entre comandos de reprodução. Parar é imediato.
- Busca considera nome e tags, ignorando acentos. Há filtros de favoritos,
  recentes, baixados e novos, além de ordenação por nome, data ou duração.
- **Baixar todos / Baixar novidades** baixa apenas arquivos ausentes, com três
  transferências simultâneas e progresso. Pausar mantém o que já foi concluído;
  repetir tenta somente os que faltam. Detalhes também permite baixar um efeito.
- O botão **Atualizar** atualiza o catálogo, sem baixar todos os áudios. Novos
  envios e edições chegam por Realtime, com atualização periódica de recuperação.
- Novidades continuam marcadas até **Marcar novidades como vistas**. O indicador
  de novos arquivos para baixar é independente dessa marcação.
- É possível adicionar MP3, WAV, OGG, WebM, M4A ou FLAC de até 10 MB e 60 segundos.
  O dono pode editar nome/tags e excluir o próprio efeito com confirmação na UI.
- Volume e silenciamento são locais. Ensurdecido e a saída selecionada da chamada
  são respeitados. Prévia de arquivos baixados funciona sem internet.
- No Room, **Editar sala** permite arrastar o perfil e mover com as setas. A posição
  fica no preset da sala. O áudio espacial dos efeitos tem toggle local e também
  depende de o áudio espacial do Room estar ativo. Na grade, o áudio fica central.

## Arquitetura

`components/rtc/soundboard/` separa backend, validação dos dados, cache, mixer,
estado global e UI. Não utiliza o bot. URL/chave publishable são configurações
públicas; os overrides opcionais estão em `.env.example`. Não há chave secreta
ou token de bot no cliente.

O Supabase armazena arquivos originais em um bucket privado e mantém o catálogo e
um registro de reprodução por canal Stoat. Uma RPC serializa comandos sob lock,
incrementa a versão e agenda o início 700 ms à frente. Clientes ignoram versões
antigas, sincronizam na inscrição/reconexão e consultam snapshots a cada 15 s.
Um ping de relógio estima a diferença de horários; rede e dispositivos ainda
impedem garantir sincronização exata entre computadores.

O cliente só escuta o canal da chamada à qual está conectado. A biblioteca é
compartilhada pelo grupo de amigos, não separada por servidor. A autorização do
Supabase é por convite; ela **não valida presença ou permissões do Stoat no
servidor**. As verificações de chamada e permissão de fala ficam no cliente. Isso
é adequado a esse grupo confiável; para distribuição pública seria necessário
adicionar verificação de identidade e participação no backend auxiliar.

Os arquivos são baixados por HTTPS e reproduzidos localmente. Sem cache, o som
solicitado é baixado sob demanda e começa no trecho correspondente ao horário
compartilhado; efeitos já terminados são descartados. Nenhum áudio passa pelo
microfone, supressor de ruído ou publicação WebRTC. Usuários do cliente oficial
não escutam os efeitos compartilhados.

IndexedDB guarda blobs e preferências por projeto/conta. SHA-256 confere downloads;
IDs e hashes identificam versões imutáveis. Exclusões e versões antigas são
removidas do cache após atualização completa. Uma falha parcial no catálogo não
apaga o cache. O catálogo carrega em páginas de 500; a UI exibe 120 resultados
por vez para não criar milhares de cards simultaneamente.

O mixer usa Web Audio API, duas faixas (prévia/compartilhada), ganho suave,
compressor para limitar picos e panner HRTF/equalpower. A saída passa por um
elemento de áudio com `setSinkId` quando suportado. A memória de buffers
decodificados é limitada a aproximadamente 32 MB; os arquivos ficam no disco.
Reprodução bloqueada pelo navegador mostra uma ação para liberar áudio.

## Configuração do Supabase

As migrações `202610180001_soundboard.sql` e `202610180002_soundboard_grants.sql`
criam as tabelas, funções, bucket privado, RLS, grants restritos e publicação no
Realtime. Foram aplicadas neste projeto pelo SQL Editor em 18/10/2026, e o
provedor de sessões anônimas foi ativado em Authentication → Sign In / Providers.
Não há necessidade de Edge Functions ou processos permanentes.

Para criar outro convite, execute como administrador no SQL Editor:

```sql
select public.soundboard_create_invite() as convite;
```

Somente o hash do convite fica no banco. Para revogar um convite antes do prazo,
ajuste sua `expires_at` na tabela `soundboard_invites`. Para revogar uma
instalação já admitida, remova sua associação em `soundboard_members` e encerre
sua sessão Auth. Essas operações não são oferecidas na UI dos amigos.

Em outro projeto, aplique as migrações uma vez e habilite sessões anônimas.
Se passar a gerenciar este projeto pelo Supabase CLI, registre as migrações já
aplicadas no histórico antes de usar `db push`, para não tentar recriar tabelas.

## Validação

Tipos, lint e build são checagens estáticas. A reprodução entre dois clientes,
seleção de dispositivos, atraso de rede e audição espacial em chamada real
precisam ser conferidos no uso do aplicativo. Nenhum teste de chamada foi
executado nesta implementação.

## Imagem compartilhada e envio de OGG

A migração `202610180003_soundboard_avatar.sql` aceita `application/ogg` no bucket
original e cria o perfil global, bucket privado de imagens e RPC para membros.
Aplicada no SQL Editor em 18/10/2026. O frontend envia bytes com MIME normalizado:
o SDK de Storage preservava o `File.type` do Firefox ao gerar multipart, ignorando
o `contentType` informado para arquivos Blob/File.

Em Efeitos sonoros → Configurações dos efeitos, qualquer membro pode escolher
PNG, JPEG, WebP ou GIF de até 5 MB e 16 megapixels e salvar para todos. O original
é preservado para manter a animação. O perfil é único na biblioteca, sincronizado
por Realtime e consultado periodicamente. IndexedDB mantém a última imagem para
uso local. A posição no Room continua sendo uma preferência local do layout.
O botão Restaurar ícone retorna ao símbolo de música para todos.
