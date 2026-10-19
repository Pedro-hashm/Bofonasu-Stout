# Living Room

## Acesso

O botão com a poltrona nos controles da chamada alterna grade e sala.
Configurações → Living Room contém o editor com participantes fictícios e os
controles de áudio espacial. `Editar sala` também abre o editor dentro da chamada.
Na rota de desenvolvimento `/design`, o mesmo botão e as mesmas configurações
funcionam sem autenticação, com preferências isoladas da conta.

A seta para baixo nos controles esconde a bandeja de chamada. `CallControlsTray`
recolhe sua altura e deixa a visualização ocupar o espaço liberado, com uma seta
pequena sobreposta no rodapé para reabrir. A sala, os vídeos e o áudio permanecem
montados. A mesma bandeja funciona na grade normal, no modo expandido e em tela
cheia; substitui o antigo layout de chamada recolhida de 56 px. Controles ocultos
ficam `inert`, e o foco acompanha o botão de reabertura para permitir uso pelo
teclado. A transição respeita as preferências de movimento.

## Cena e edição

`components/rtc/living-room` contém o modelo validado, o editor, o renderizador,
os elementos de vídeo e a integração de áudio. O preset Studio é desenhado em
SVG e acompanha o cliente. Fundos PNG/JPEG/WebP são copiados para IndexedDB por
localForage (12 MB e 40 megapixels por imagem). Arquivos locais originais não
precisam permanecer no mesmo caminho.

Fundo, lugares e tela compartilham coordenadas proporcionais em uma cena de
proporção fixa. A cena inteira se encaixa no módulo, preservando o alinhamento
mesmo quando a janela muda de tamanho. Avatares são circulares, com o detector de
fala compartilhado e seu anel animado. O próprio avatar representa a posição de
escuta. Nomes, tamanho e cor do anel são configuráveis. Os menus de contexto dos
usuários e transmissões preservam as opções de volume, mute e moderação.

Arraste avatares, a alça central da tela ou seus quatro cantos. Os mesmos controles
aceitam setas; Shift aumenta o passo. Os quatro cantos geram uma homografia CSS
`matrix3d`. A validação impede telas invertidas ou degeneradas. A proporção do
conteúdo, enquadramento, borda, cantos, brilho, sombra e camada são independentes.

O arraste captura uma cópia das coordenadas iniciais, pois os pontos do store são
proxies mutáveis. Eventos de ponteiro usam a posição mais recente a cada frame,
com aplicação da última posição ao soltar o mouse. O caminho de movimento altera
somente o ponto ou os cantos envolvidos, sem normalizar toda a cena a cada evento.
No modo de edição, posições não recebem transições CSS.

## Modo sincronizado

Configurações → Living Room → **Modo sincronizado** ativa a preferência local
por conta. O editor dentro da chamada também oferece o toggle em Sincronização.
Cada cliente precisa ativar a opção para usar as posições compartilhadas. Em
Editar sala, qualquer participante pode mover qualquer avatar; a posição do
próprio usuário também muda o ponto de escuta do áudio espacial. Fundo, tela,
chat, áudio e presets mantêm suas preferências locais. Desativar o modo restaura
as posições locais, sem sobrescrever o preset.

`RoomSyncManager` funciona durante a chamada, separado da biblioteca de sons.
Usa [pacotes de dados do LiveKit](https://docs.livekit.io/transport/data/packets/)
no tópico `bofonasu.living-room.v1`, com envio confiável e coordenadas normalizadas.
Não exige Supabase, bot, convite da biblioteca ou mudanças no backend.
O arraste local segue cada frame; a rede agrupa o último movimento por avatar em
intervalos de 50 ms. Relógios lógicos e desempate pelo autor resolvem movimentos
concorrentes de forma determinística. Entradas tardias solicitam snapshots, e
snapshots periódicos recuperam atualizações perdidas. O transporte confiável é
best effort: não mantém histórico para quem está desconectado.

As mensagens são limitadas em tamanho, frequência e quantidade de posições,
validadas e vinculadas aos participantes da chamada. O cliente informa quando o
servidor não permite publicar dados ou há falha no envio. As posições compartilhadas
vivem na memória dos participantes sincronizados e deixam de existir quando
todos saem desse modo/chamada. Não são gravadas no banco nem nos presets locais.

O hover/foco no avatar mostra **Room sincronizado** ou **Room local** junto ao nome
quando aquele cliente anuncia que está visualizando a sala. IntersectionObserver
e a visibilidade do documento evitam anunciar uma sala oculta ou a prévia de
configurações. A sincronização de coordenadas permanece ativa em segundo plano
para preservar o áudio espacial. A presença usa heartbeat de cinco segundos,
expira após 18 segundos sem notícias e é removida imediatamente ao receber a
desconexão do participante. Clientes oficiais ou antigos sem esse protocolo não
recebem um indicador de status.

## Vídeo e áudio de apresentações

A tela aceita uma transmissão, grid com colunas automáticas ou fixas, ou uma
principal com miniaturas. Câmeras podem participar da tela. Apresentações têm
preferência inicial, e o seletor permite fixar outra fonte. Sem transmissão, a tela
mostra painel, relógio ou transparência. A tela cheia usa a API nativa
`requestFullscreen`, em um portal fora dos limites e transformações do módulo.
O vídeo fica plano e inteiro, com retorno por botão ou Escape. O controlador da
chamada respeita apresentações em tela cheia e preserva o modo expandido ao sair
delas. Se o navegador bloquear a solicitação, o player ocupa a janela e informa
o erro, com opção de tentar novamente. A navegação por teclado fica no player e
devolve o foco ao botão da sala ao fechar.

`RoomVideo` anexa e desanexa faixas com limpeza de listeners e contagem dos
consumidores. Apenas vídeos exibidos são assinados. O elemento de vídeo permanece
mudo: `RoomAudioManager` é o único responsável pelo áudio. No modo sala, somente
as apresentações exibidas têm áudio habilitado, respeitando também o mute e o
volume configurados pelo usuário. A prévia de configurações não interfere nessa
seleção da chamada.

Os cards de transmissão são identificados pelo ID estável da publicação. Novos
objetos `TrackReference` emitidos pelo LiveKit não recriam os players nem cancelam
suas assinaturas. O controle de assinatura observa a identidade da publicação,
instala os listeners antes de solicitar o vídeo e libera o último consumidor com
um pequeno atraso para permitir a troca entre grade e Room. Um player conectado
na grade impede que essa liberação cancele a transmissão que ele assumiu.

A tela cheia move o mesmo contêiner de mídia para fora da cena com perspectiva,
preservando os elementos de vídeo, faixas e assinaturas. Ao sair, o contêiner volta
para a moldura original. Não há um segundo player competindo pela assinatura ou
um intervalo de desassinatura durante a expansão. A reprodução é retomada após a
mudança de contêiner e ao voltar à janela visível.

## Chat sobreposto

O botão de chat na barra da sala mostra ou oculta o visualizador. O editor salva
posição, largura, altura, fonte, quantidade de mensagens, duração e opacidade no
preset. A alça move o chat e o canto inferior direito o redimensiona, usando o
mesmo caminho de arraste por frame da sala. Setas também fazem os ajustes.

O padrão tem fundo transparente e mostra as últimas cinco mensagens por 12
segundos, com desaparecimento suave. Hover/foco permite reler as últimas mensagens,
e o alfinete mantém o chat visível. As partes transparentes vazias não interceptam
o mouse. O editor também mostra o retângulo de posição quando o chat está oculto.

`useRoomChat` acompanha o canal da chamada ou a conversa aberta, conforme a
preferência. Usa histórico normal e eventos do cliente, respeita permissões e
usuários bloqueados, mascara spoilers pela conversão de texto do SDK e acompanha
edições, exclusões e reconexões. Mantém até 50 mensagens em memória, sem publicar
mensagens, marcar conversas como lidas ou gravar conteúdo nos presets. A prévia de
configurações usa mensagens fictícias e não inicia conexão com o backend.

GIFs aparecem no próprio visualizador: anexos, links diretos `.gif` e embeds de
provedores reconhecidos pelo chat normal (como Tenor, Giphy e Gifbox). Os embeds
recebidos depois da mensagem também atualizam a prévia. Vídeos usados pelos
provedores como GIF repetem sem áudio; as imagens ficam limitadas à caixa, com
até três prévias por mensagem. Spoilers não são expostos. Clicar abre o original;
falhas de carregamento mantêm um link disponível. A rolagem acompanha a chegada
da mídia, preservando a leitura de quem está consultando mensagens anteriores.

## Áudio espacial

A caixa de som compartilhada também pode aparecer como objeto arrastável na
sala. Ela funciona igualmente na grade de chamada; veja [Caixa de som](SOUNDBOARD.md)
para biblioteca, downloads locais, controles e configuração do Supabase.

Começa desativado e pode ser habilitado nas configurações. Usa o contexto de áudio
compartilhado fornecido a `Room.webAudioMix`; a chamada mantém sua liberação de
autoplay, seleção de saída e recuperação de reprodução bloqueada. O contexto é
fechado ao desconectar, inclusive por desconexão remota.

Cada microfone remoto recebe um `PannerNode` (HRTF ou equalpower) e um `GainNode`
através de `RemoteAudioTrack.setWebAudioPlugins`. Essa API experimental fica
isolada em `spatialAudio.ts`, usando a versão de LiveKit instalada no cliente.
Não existe outra captura, publicação, gravação ou cópia reproduzida das vozes.

As coordenadas relativas ao ouvinte determinam a direção. A intensidade comprime
o ângulo; a distância tem atenuação limitada (no máximo 50% da amplitude, antes
do volume escolhido pelo usuário). Parâmetros são suavizados com constantes de
35 ms. Ao desativar, as fontes voltam ao centro e ao ganho normal antes de remover
o processamento. A amplificação e volumes explicitamente zerados são preservados
ao reconstruir a cadeia do SDK. Apresentações não recebem espacialização.

## Presets e persistência

`LivingRoom` é um store local por conta, fora de `SYNCED_KEYS`. Mantém uma cena
de trabalho persistente, o preset ativo e até 50 cópias nomeadas. É possível
duplicar, atualizar, renomear, excluir e restaurar. O preset Studio é imutável.
Lugares são reutilizáveis; associações canal/usuário lembram os participantes que
saem e voltam. Novos participantes recebem lugares sem marcar o preset como
alterado. Dados importados e dados de disco passam pelo mesmo normalizador.

Exportar gera `.stoat-room.json`: formato/versionamento, nome, cena e imagem
embutida em base64. O uso normal mantém imagens como Blob, fora do JSON de
preferências. O pacote remove associações locais canal/usuário e preserva os
lugares, para que outro grupo possa utilizar o mesmo ambiente. Importar copia a
imagem para um novo identificador local e salva um novo preset. Não usa Supabase
nem sincronização remota. Limpar dados do site/aplicativo pode apagar a biblioteca;
os pacotes exportados funcionam como backup e compartilhamento manual.

## Validação desta implementação

Não há verificação de chamada real nesta etapa. A audição binaural precisa ser
avaliada com fones no ambiente do usuário; as checagens de tipos, lint e compilação
não substituem essa confirmação.
