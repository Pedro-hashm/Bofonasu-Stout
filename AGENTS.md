# Versionamento do Bofonasu Stout

- Alterações entregues ao usuário devem constar no histórico de `releases.json`, em português e com descrições concretas.
- A primeira versão do catálogo e `for-desktop/package.json` devem ter a mesma versão. Use SemVer: correções em patch, funcionalidades em minor e incompatibilidades em major.
- Para iniciar uma próxima versão, use `node scripts/release.cjs prepare patch|minor|major --title "Título" --change "Alteração"`. Adicione outras mudanças à versão em preparação antes de publicá-la.
- Gere `CHANGELOG.md` com `node scripts/release.cjs write` depois de editar o catálogo. Preserve o histórico das versões anteriores e não afirme validações que não foram feitas.
- O catálogo é incluído na interface para consulta offline; releases estáveis do próprio repositório complementam esse histórico em execução.
- O build para distribuição é `for-desktop/scripts/build-windows.cjs`. Ele valida a versão e gera um manifesto dos artefatos. A publicação usa `scripts/publish-release.cjs` após o envio da tag correspondente.
