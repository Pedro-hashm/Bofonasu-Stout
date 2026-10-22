# Changelog — Bofonasu Stout

Histórico das builds. As versões publicadas podem ser consultadas no GitHub Releases.

## Em desenvolvimento — ainda não publicado

### Melhorias de chat, chamada e efeitos sonoros

- Removido o som genérico de clicar em botões, menus e navegação.
- Novos MP3 locais para entrar e sair da chamada, mutar e reativar, iniciar e encerrar apresentações e entrada e saída de espectadores.
- Microfone e fone usam os mesmos efeitos de mute/unmute, reproduzidos apenas para quem acionou.
- Avisos de espectadores sincronizados entre os clientes da chamada, sem repetir ao trocar entre Living Room, chamada normal e tela cheia.
- Botão para expandir e restaurar o chat na área conjunta de conversa e chamada, preservando o layout salvo e o áudio da chamada.
- Painel compacto de chamada para módulos pequenos, com status, avatares com indicador de fala, contador de participantes, apresentações e controles organizados.
- Botão de efeitos sonoros abre o popup com quatro efeitos recentes e acesso ao painel completo, sem ocupar espaço no layout.

## 1.9.0 — 2026-10-21

### Interface mobile com navegação própria

- Navegação mobile em telas dedicadas, com Canais, Chat, Chamada e Ajustes na barra inferior e troca de servidor pelo cabeçalho.
- Configurações mobile em lista e detalhe, com voltar, fechar, rolagem e áreas de toque ampliadas.
- Personalização acessível por Aparência nas configurações, sem editor de módulos no celular; presets mobile preservam a geometria do desktop.
- Lista mobile de servidores com nomes, atalhos de conversas e indicadores de mensagens não lidas.
- Chamada mantém o áudio ao navegar entre telas, sem uma janela flutuante cobrindo o chat no mobile.

## 1.8.0 — 2026-10-21

### Android, iOS e builds automáticas

- Clientes mobile com a interface compartilhada: APK Android assinado e IPA iOS sem assinatura, destinado a assinatura e provisionamento antes de instalar.
- GitHub Actions compila a interface uma vez e gera Windows, Android e iOS em paralelo, publicando a release completa com checksums.
- Versão e histórico compartilhados entre desktop e mobile, com acesso ao APK ou IPA correto nas configurações.
- Permissões de câmera e microfone nos projetos mobile; captura de tela não suportada pelo WebView deixa de ser oferecida como se estivesse disponível.

## 1.7.0 — 2026-10-18

### Acesso rápido aos servidores

- Nova aba discreta na lateral esquerda para mostrar ou ocultar servidores e amigos sem abrir o editor de layout.
- O módulo de servidores aparece acima dos outros módulos no desktop, inclusive quando a chamada está expandida, preservando posição e tamanho.
- A visibilidade continua salva localmente; o botão permite acesso pelo teclado e respeita a preferência de movimento reduzido.

## 1.6.0 — 2026-10-18

### Atualizações automáticas e histórico de versões

- O desktop instalado verifica atualizações ao abrir e a cada 30 minutos e baixa novas versões em segundo plano.
- Nova seção Atualizações e novidades nas configurações, com a versão instalada, a versão mais recente e o histórico de mudanças.
- Indicador discreto de atualização disponível e botão para reiniciar após o download, com proteção durante chamadas.
- Versionamento e preparação de releases passam a usar um histórico único, incluído também na build para consulta offline.
- Inicialização web com cache de dependências estável, limpeza do antigo service worker de desenvolvimento e compilação das macros do Lingui em arquivos TypeScript.
- Correções de sintaxe nos catálogos de tradução catalão, árabe, albanês e sueco.
- O build Windows prepara um runtime Node compatível no próprio projeto, com verificação SHA-256, evitando incompatibilidades do empacotador com o Node do sistema.

## 1.5.5 — 2026-10-18

### Grade de chamada e ambiente de desenvolvimento

- A grade da chamada recebe referências explícitas dos participantes e utiliza o mesmo player de vídeo do Living Room.
- Participantes sem câmera exibem o avatar; a opção de ocultar outros participantes deixa de ocultar toda a grade ao sair do foco.
- Ajustes de dimensionamento da grade e de identidade das dependências compartilhadas.
- Recuperação do runtime do pnpm no Windows e novo lançador local para o Vite.

## 1.5.4 — 2026-10-18

### Primeira distribuição personalizada para Windows

- Instalador e ZIP do Bofonasu Stout com a interface personalizada e os sons incluídos no aplicativo.
- Perfil próprio, separado do Stoat oficial, e carregamento da interface a partir da build local.
- Living Room personalizável, presets, chat sobreposto, organização de participantes e áreas de apresentação.
- Soundboard compartilhado e opções de áudio espacial.
- Captura de áudio de apresentação no desktop Windows 11 com exclusão do áudio do próprio cliente.
