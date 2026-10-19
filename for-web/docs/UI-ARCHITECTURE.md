# Workspace e Studio de aparência

## Auditoria dos fluxos

| Área                | Responsabilidade que precisa permanecer                                                                           | Implementação                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Autenticação        | Login, criação, recuperação, verificação, sessões e instâncias                                                    | Fluxos existentes; superfícies e cantos seguem os tokens globais                                  |
| Servidores          | Ordem, pastas, não lidos, menções, criação, descoberta e conta                                                    | `ServerList` permanece funcional e monta no módulo `navigation`                                   |
| Canais e DMs        | Categorias, ordenação e permissões, grupos, notas, seleção e menus                                                | `ServerSidebar` / `HomeSidebar` montam no módulo `channels`                                       |
| Conversa            | Histórico virtualizado, leitura, saltos, edição, exclusão, Markdown, anexos, embeds e reações                     | `TextChannel`, `Messages` e `Message` mantêm os seus controladores                                |
| Composição          | Rascunho por canal, responder, autocomplete, upload/colar/arrastar, emoji, digitação, limites, slowmode e timeout | `MessageComposition` permanece junto do histórico no módulo `conversation`                        |
| Pessoas             | Membros por cargo, presença, perfis e menus; busca e fixados                                                      | `members` recebe a região contextual pelo mesmo contexto Solid                                    |
| Voz                 | Conectar, desconectar, microfone, áudio, câmera, tela, participantes, foco, PiP e fullscreen                      | A âncora da chamada passa para o workspace; controles se reorganizam em painéis pequenos          |
| Início e amigos     | Conversas recentes, pedidos, bloqueados, adicionar amigo, criar grupos e comunidades                              | Início reconstruído; amigos usa abas compactas mantendo ações e virtualização                     |
| Configurações       | Conta, segurança, dispositivos, servidor, cargos e permissões de canais                                           | Mantém configurações e validações; shell, navegação e transições compartilham o sistema visual    |
| Descoberta          | Diretório e convites de comunidades/bots                                                                          | Integração atual com `stt.gg` preservada; o conteúdo externo do iframe tem o seu próprio renderer |
| Integrações globais | Atalhos, notificações, reconexão, modais e titlebar do desktop                                                    | Mantidos pelos contextos existentes e por `Interface`                                             |

## Organização

- `src/interface/workspace/Workspace.tsx`: shell, grade, regiões estáveis, modo de edição e adaptação por largura real da janela.
- `WorkspaceModule`: entrega um módulo ao seu slot usando `Portal`. Alterar geometria não recria a composição ou a chamada.
- `components/ui/lib/workspace.ts`: contrato de navegação das regiões, sem dependência do shell concreto.
- `AppearanceStudio.tsx`: diálogo Kobalte com foco preso, Esc, presets, cópias nomeadas e importação/exportação.
- `ThemePreview.tsx`: prévia com os mesmos tokens de superfície, tipografia, cantos e ajustes dos módulos.
- `components/ui/lib/motion.ts`: entrada com Motion/WAAPI respeitando redução de movimento.
- `layoutPreferences.ts`: catálogo dos módulos, limites, normalização, migração e presets da grade.
- `Theme.ts`, `Layout.ts`: preferências locais da conta, sem entrar em `SYNCED_KEYS`.

## Contrato do canvas

A grade é independente de resolução: 48 colunas por 36 linhas. Cada módulo tem
`{ x, y, w, h }`, mínimo próprio e coordenadas limitadas ao canvas. O modo de
edição oferece arrastar pelo título, redimensionar pelo canto e um inspetor de
coordenadas. Setas movem; Shift + setas redimensionam. Cancelar/Esc restaura o
snapshot anterior. Concluir mantém o resultado. A conversa nunca pode ser ocultada.

Sobreposição é permitida. A lista do inspetor seleciona um módulo e o coloca
acima dos outros durante a edição, permitindo recuperá-lo. Restaurar distribuição
recoloca todos os módulos nas posições iniciais.

Abaixo de 900 px, os slots continuam montados e são apresentados em uma região
por vez. Uma barra com os cinco módulos permite alternar entre eles. A geometria
desktop continua salva. Uma conversa encoberta nessa navegação não confirma
automaticamente novas mensagens como lidas.

## Sistema visual e persistência

Studio, Discord, Stoat e Foco combinam aparência e geometria. Uma cópia salva
contém um snapshot independente, inclusive os ajustes por módulo. Presets
importados passam pela mesma validação, usam um envelope JSON versão 1 e têm
limite de 100 KB. Valores desconhecidos são descartados; coordenadas, escalas e
medidas são limitadas. Dados antigos sem `frame` recebem uma distribuição válida.

As cores de superfícies são compartilhadas com os componentes Material e MDUI.
Os cantos também geram os aliases dos dois sistemas. Fontes, escala da interface,
tamanho das mensagens, densidade e movimento têm controles globais. Cada módulo
pode substituir o destaque, o fundo, os cantos e a densidade. A cor de texto dos
botões de destaque é escolhida considerando a luminância da cor configurada.

## Revisão sem backend

No servidor Vite, `/design` abre uma demonstração usando o shell real e o
`MessageContainer` de produção. A demonstração tem estado e armazenamento próprios
(`stoat:design-preview:v1`), não inicia o cliente do backend e não envia mensagens.
Ela não faz parte das rotas da build de produção.

Ela permite verificar presets, cópias, restauração, editor, recuperação de módulos,
entradas locais e tamanhos de janela. Para revisar chat e voz com dados reais,
entre pelo `/login` e use a aplicação normalmente. Chamadas reais e permissões de
contas precisam ser verificadas com uma sessão autenticada.

## Verificações

Os testes de preferências cobrem presets sem sobreposição, limites, arredondamento
na grade, valores inválidos, módulos desconhecidos e serialização JSON. A revisão
visual usa janelas desktop e estreitas, aplicação/restauração de presets, persistência
após recarregar, arrastar, redimensionar e cancelamento da edição.

Dependências visuais adicionadas: `@kobalte/core`, `motion` e `lucide-solid`.
O framework reativo continua Solid; os componentes de domínio continuam conectados
ao SDK Stoat existente.

## Ajustes de uso do workspace

O menu de Layout, Personalizar e configurações fica numa bandeja retrátil no canto
superior direito. Hover ou foco revela a bandeja; o pequeno acionador também aceita
clique/toque. Ela não reserva altura no canvas.

No desktop, trocar conversa e chamada permuta seus retângulos completos, preservando
as demais preferências. Os dois módulos aceitam o mesmo tamanho mínimo para que a
troca continue válida após recarregar. Maximizar a chamada usa o retângulo que engloba
as duas áreas e encobre temporariamente a conversa. Restaurar recupera a geometria
original. Essa expansão não é persistida, e tela cheia continua sendo outra ação.
Enquanto a conversa está encoberta, mensagens novas não são confirmadas como lidas.

O histórico compartilhado (`ListView2`) mantém um viewport flexível sem encolher seu
conteúdo. Em módulos muito baixos, há também rolagem do conjunto cabeçalho, histórico
e composição. A prévia usa o mesmo histórico e os mesmos botões da chamada. Seu
botão de configurações abre o navegador de produção com páginas locais e a tela real
de idioma, sem precisar de login.

Cada página das configurações recebe um proprietário Solid novo ao navegar, inclusive
subpáginas. Animações de entrada começam após a montagem e não deixam o conteúdo
funcional transparente quando um webview suspende animações em segundo plano.

## Indicador de fala

`components/rtc/useSpeakingIndicator.ts` lê o áudio do microfone publicado/recebido
a cada 20 ms usando Web Audio. As vistas do mesmo participante compartilham um
analisador; a chamada compartilha um contexto e um temporizador. A leitura local
usa o áudio após o processamento do cliente. Não há nova captura, envio, gravação
ou reprodução. A entrada do indicador não espera os eventos de fala do servidor.
Há limiares de entrada/saída, estimativa do ruído baixo e tolerância de 140 ms nas
pausas. Se Web Audio não estiver disponível ou estiver suspenso, os eventos do SDK
servem de alternativa. Troca de microfone, mute e substituição de faixas são
observados; os recursos são liberados quando a última vista deixa de usá-los.

O anel compartilhado em `speakingIndicator.css` anima opacidade: entrada de 60 ms,
saída de 140 ms. Configurações de movimento desativado e preferência do sistema
por redução de movimento continuam respeitadas.

O analisador recebe uma cópia privada da faixa de áudio. Somente essa cópia é
interrompida no descarte; a faixa usada para ouvir a chamada fica sob controle
do LiveKit.

## Reprodução das vozes

`RoomAudioManager` mantém elementos de áudio próprios, estáveis por publicação,
anexados diretamente com `RemoteAudioTrack.attach/detach`. Não utiliza o mixer
de amplificação do componente auxiliar, que zerava o elemento normal antes de
criar um contexto separado que podia permanecer suspenso. `Room.webAudioMix`
centraliza volume e amplificação no mixer do SDK. O áudio começa a ser liberado
na ação de entrar na chamada e há recuperação de bloqueio de reprodução por
interação, com botão explícito quando necessário. Mute, deafen, volume por
participante e dispositivo de saída permanecem aplicados à reprodução.

## Sons locais

`src/assets/sounds` contém 17 efeitos originais em WAV (aproximadamente 265 KiB),
reproduzíveis com `python scripts/generateUiSounds.py`. São arquivos versionados,
importados pelo Vite; acompanham a distribuição e o cache offline da PWA. Não
dependem dos arquivos opcionais de assets do Stoat, cujos fallbacks de chamada
eram silenciosos, nem de um serviço de sons externo.

O `SoundController` pré-carrega/decodifica os arquivos, libera a reprodução após
uma interação e respeita volume e preferências por evento. Cliques em botões,
menus, links e opções usam delegação no documento, incluindo elementos em portals.
Controles que já têm um efeito específico evitam um segundo som de clique.
Som de entrada/saída e de transmissão é ligado aos eventos da sala/publicação;
o início de compartilhamento não espera o usuário abrir o vídeo. Há também efeitos
de câmera, mute e deafen. As configurações permitem ouvir cada efeito sem alternar
acidentalmente a preferência. A prévia local oferece os mesmos arquivos e controles.
