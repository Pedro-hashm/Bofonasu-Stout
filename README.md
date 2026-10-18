# Bofonasu Stout

Cliente personalizado baseado nos projetos open source do Stoat.

## Estrutura

- `for-web/`: interface web em SolidJS; as alterações visuais e o visualizador de streams entram aqui.
- `for-desktop/`: aplicativo desktop em Electron, que abre a interface web e gera os pacotes para PC.

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
mise install:frozen
mise build:deps
mise dev
```

Em outro terminal, abra o app Electron apontando para o cliente web local:

```powershell
cd F:\Workspace\Projetos\Bofonasu-Stout\for-desktop
mise install
mise install:frozen
mise exec -- pnpm start -- --force-server http://localhost:5173
```

Para gerar os distribuíveis desktop, use `mise build` e `mise make` dentro de `for-desktop`.

Os assets públicos do desktop são incluídos como submódulo. O cliente web usa os assets de fallback incluídos no próprio código.

## Licenças

Os diretórios `for-web/` e `for-desktop/` mantêm os arquivos de licença dos respectivos projetos de origem. Consulte-os antes de redistribuir modificações.
