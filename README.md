# Bofonasu Stout

Cliente personalizado baseado nos projetos open source do Stoat.

## Estrutura

- `for-web/`: interface web em SolidJS; as alterações visuais e o visualizador de streams entram aqui.
- `for-desktop/`: aplicativo desktop em Electron, que abre a interface web e gera os pacotes para PC.
- `for-mobile/`: projetos Capacitor para Android e iOS, usando a mesma interface.

## Releases compiladas no GitHub

O workflow **Build and publish release** em `.github/workflows/release.yml` compila
a interface uma vez e gera Windows, Android e iOS em paralelo nos servidores do
GitHub. Nenhum SDK Android ou Xcode precisa ser instalado no PC para esse fluxo.

1. Prepare uma versão com `node scripts/release.cjs prepare minor --title "Título" --change "Alteração"`.
2. Envie o código para `main`.
3. Em **Actions → Build and publish release → Run workflow**, informe a versão,
   por exemplo `v1.8.0`. A tag é criada depois das builds aprovadas.

Enviar uma tag `v*` também inicia o processo. O workflow confere o versionamento,
compila e só publica a release depois que todas as plataformas terminarem.
Reexecuções não sobrescrevem uma release já publicada. Builds intermediárias
expiram em um ou dois dias; os downloads finais permanecem nas Releases.

Arquivos gerados: instalador Windows, pacote do atualizador, ZIP portátil,
APK Android assinado, IPA iOS sem assinatura e `SHA256SUMS.txt`.

**Android:** a assinatura usa os secrets `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`.
Preserve a mesma chave nas próximas versões. O backup desta configuração foi
salvo em `tooling/android-signing/`, fora do Git.

**iPhone/iPad:** o IPA é compilado para dispositivos reais, mas não instala
diretamente pelo download. Exige assinatura/provisionamento Apple antes da
instalação, mesmo para compartilhar com uma pessoa. Não exige uma conta Apple
para o GitHub compilar esse arquivo sem assinatura. TestFlight não está configurado.

Os clientes mobile são a primeira distribuição da interface compartilhada:
requerem teste em aparelhos reais. Receber apresentações utiliza o player web;
enviar a própria tela e manter chamadas em segundo plano exigem integrações
nativas adicionais e não são oferecidos como recursos concluídos nesta versão.

## Backend oficial do Stoat

Por padrão, o cliente usa a infraestrutura hospedada do Stoat (`https://api.stoat.chat` e `stoat.chat`). Para manter esse comportamento, não defina `VITE_API_URL` nem `VITE_HOST` no arquivo `for-web/packages/client/.env`. O arquivo `.env.example` deixa as opções de backend local comentadas.

## Clonar o projeto

Clone com o submódulo de assets incluído:

```bash
git clone --recurse-submodules https://github.com/Pedro-hashm/Bofonasu-Stout.git
```

## Desenvolvimento no Windows

Instale o Git e o [mise](https://mise.jdx.dev/) (`winget install --id jdx.mise --exact`). Depois, abra um novo PowerShell para atualizar o PATH. As versões de Node.js e pnpm estão definidas nos arquivos `.mise/config.toml` de cada projeto.

Em um terminal, inicie o cliente web:

```powershell
cd F:\Workspace\Projetos\Bofonasu-Stout\for-web
mise install
node scripts/pnpm-local.cjs install --frozen-lockfile
mise dev
```

Em outro terminal, abra o app Electron apontando para o cliente web local:

```powershell
cd F:\Workspace\Projetos\Bofonasu-Stout\for-desktop
pnpm install --frozen-lockfile --store-dir F:\Workspace\Projetos\Bofonasu-Stout\tooling\pnpm-store
pnpm start:local
```

O comando `start:local` procura o frontend em `localhost:5173` e `localhost:5174`.
Para outra porta, use `pnpm start:local http://localhost:PORTA`.
Mantenha o servidor web aberto em outro terminal. O desktop de desenvolvimento
usa um perfil separado em `tooling/desktop-dev-profile`, sem disputar a instância
ou a sessão do Stoat instalado. Navegador e Electron também usam sessões separadas,
permitindo testar duas contas diferentes na mesma chamada.
No Windows, se `mise exec -- pnpm` falhar em `dist/worker.js` com erro de módulo
ES, use `node scripts/pnpm-local.cjs` no lugar do comando `pnpm` dentro de
`for-web`. Esse lançador prepara uma cópia do runtime em `tooling/pnpm-runtime`
com os metadados ESM necessários, sem alterar a instalação do mise.
O pnpm 11.17 requer Node 22.13 ou mais recente; o Node 22.15 instalado neste
ambiente atende esse requisito. O comando `mise dev` inicia o Vite pelo Node,
prepara os assets e reutiliza o cache válido de dependências. O service worker
fica reservado à build de produção; o modo dev remove registros antigos desse
worker antes de carregar o cliente. Também é
possível iniciar diretamente com:

```powershell
node "F:\Workspace\Projetos\Bofonasu-Stout\for-web\scripts\dev-local.cjs"
```

## Gerar uma build para Windows

Com as dependências dos dois projetos já instaladas, execute de qualquer pasta:

```powershell
pnpm --dir "F:\Workspace\Projetos\Bofonasu-Stout\for-desktop" run build:win
```

O comando compila o cliente web e suas dependências, inclui os arquivos no
aplicativo e gera o instalador e o ZIP. Não precisa deixar o Vite aberto.
As configurações públicas de produção do web, incluindo o Supabase, são
incorporadas pelo Vite; arquivos `.env` não são copiados para o aplicativo.

Para PCs x64, envie um destes arquivos:

- `for-desktop/out/make/squirrel.windows/x64/Bofonasu-Stout-Setup.exe`: instalador.
- O `.zip` em `for-desktop/out/make/zip/win32/x64/`: versão para extrair e abrir `bofonasu-stout.exe`; mantenha todos os arquivos extraídos juntos.

Seu amigo precisa apenas instalar/abrir o app e entrar na conta do Stoat.
A interface funciona a partir dos arquivos incluídos na build, com uma origem
local segura `bofonasu://app`, sem servidor HTTP local. O chat, as chamadas e
o soundboard continuam dependendo de internet e dos respectivos serviços.
O perfil instalado é separado do Stoat oficial e do perfil de desenvolvimento.
Layouts, imagens e sessões pessoais do desenvolvedor não entram na build.

## Atualizações automáticas e novas versões

### Acesso rápido aos servidores (1.7.0)

No desktop, a pequena seta na lateral esquerda mostra ou oculta o módulo de
servidores e amigos sem entrar no editor de layout. O módulo aparece acima dos
outros painéis, inclusive da chamada expandida, mantendo sua posição e tamanho.
A visibilidade é salva localmente. Em janelas estreitas, a navegação continua
disponível nas abas inferiores.

A partir da **1.6.0**, o desktop instalado no Windows x64 consulta as releases
públicas deste repositório ao abrir e a cada 30 minutos. Quando há uma versão
estável mais recente com os artefatos de atualização, ele baixa em segundo plano.
A versão baixada é aplicada ao próximo início. Quem mantém o aplicativo aberto
pode usar **Configurações → Atualizações e novidades → Reiniciar e atualizar**.
Esse botão fica bloqueado enquanto a pessoa estiver em uma chamada.

A seção mostra a versão instalada, a mais recente publicada, as mudanças por
versão, pesquisa e um filtro para novidades posteriores à instalação atual.
O histórico incluído na build fica disponível mesmo sem internet; notas de
releases públicas complementam esse histórico. Uma pequena indicação aparece
na entrada de configurações quando existe uma atualização.

O ZIP, outras plataformas e o ambiente de desenvolvimento permitem consultar
as novidades e abrir o instalador, mas não executam atualizações automáticas.
Quem já está na 1.5.5 precisa instalar a 1.6.0 uma vez para receber o atualizador.

### Preparar a próxima versão

No diretório raiz do repositório:

```powershell
node scripts/release.cjs prepare patch --title "Correções da chamada" --change "Descrição concreta da alteração"
```

Use `minor` para novas funcionalidades e `major` para mudanças incompatíveis.
O comando atualiza `releases.json`, a versão do desktop e `CHANGELOG.md`.
Para acrescentar alterações à versão em preparação, edite `releases.json` e
execute `node scripts/release.cjs write`. O build recusa versões inconsistentes.

### Publicar uma atualização

1. Revise e envie o código e a tag correspondente, por exemplo `v1.6.0`, ao GitHub.
2. Gere a build com `pnpm --dir "F:\Workspace\Projetos\Bofonasu-Stout\for-desktop" run build:win`.
3. No diretório `for-desktop`, com o GitHub CLI autenticado, execute:

```powershell
mise exec gh -- node ../scripts/publish-release.cjs
```

O comando exige que a tag já exista no remoto, confere os hashes e a versão dos
artefatos gerados e publica a release com as notas do catálogo. A geração da build
não publica nada por conta própria.

O build usa Node 22.19+ da linha 22 ou Node 24. Se o runtime atual não for compatível,
baixa o Node 22.23.3 oficial para `tooling/node-runtime/`, verifica o SHA-256 e
executa o build com ele. Nenhuma instalação do Node no sistema é alterada.

Se preferir publicar pela página de Releases do GitHub, anexe **todos** estes
arquivos de `for-desktop/out/make/squirrel.windows/x64/`:

- `Bofonasu-Stout-Setup.exe`;
- `BofonasuStout-VERSÃO-full.nupkg`;
- `RELEASES`.

O ZIP em `out/make/zip/win32/x64/` é opcional para distribuição portátil.
As notas prontas ficam em `out/make/release-notes.md`. Use uma release estável,
sem marcar como rascunho ou pré-release. O atualizador utiliza somente releases
do `Pedro-hashm/Bofonasu-Stout`; não consulta as versões oficiais do Stoat.

Os assets públicos do desktop são incluídos como submódulo. O cliente web usa os assets de fallback incluídos no próprio código.

### Áudio da apresentação no Windows

No desktop com Windows 11, a captura usa `loopbackWithoutChrome` para excluir
o áudio do próprio cliente e evitar que os participantes se escutem pela
apresentação. O restante do áudio do sistema continua sendo capturado, inclusive
ao selecionar uma janela. Essa alteração exige encerrar e abrir novamente o
desktop e iniciar uma nova apresentação; recarregar a interface não basta.

Esse identificador é um detalhe interno do Electron 44.3/Chromium atualmente
usado pelo projeto. Ao atualizar o Electron, confira o tratamento de áudio em
[electron_browser_context.cc](https://github.com/electron/electron/blob/v44.3.0/shell/browser/electron_browser_context.cc)
e a implementação de captura por processo em
[audio_low_latency_input_win.cc](https://github.com/chromium/chromium/blob/152.0.7977.130/media/audio/win/audio_low_latency_input_win.cc).

Na versão web, o cliente solicita `restrictOwnAudio` diretamente ao navegador.
A exclusão depende do suporte do navegador a essa opção e não tem a mesma
garantia da seleção explícita do dispositivo no desktop. A confirmação disponível
na faixa capturada aparece no console em `[Screenshare audio]`; a ausência dessa
confirmação não demonstra, por si só, que a exclusão falhou.

## Licenças

Os diretórios `for-web/` e `for-desktop/` mantêm os arquivos de licença dos respectivos projetos de origem. Consulte-os antes de redistribuir modificações.
