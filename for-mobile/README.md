# Bofonasu Stout mobile

Capacitor 8.5.3 com a interface de `../for-web/packages/client` incluída no app.
Android 7/API 24+; iPhone/iPad com iOS 15+.

As builds de distribuição são geradas no GitHub Actions. No desenvolvimento
local, compile primeiro `node scripts/build-web.cjs` na raiz, instale as
dependências nesta pasta com `npm ci` e use `npx cap sync android` ou `npx cap sync ios`.
Android exige JDK 21 e SDK 36; iOS exige um Mac com Xcode 26+.

O APK de release é assinado com a chave fixa dos secrets do repositório.
O IPA publicado não tem assinatura: precisa ser assinado e provisionado antes
de instalar. Não é um download instalável diretamente no iPhone.

Microfone e câmera usam as permissões do sistema. Envio da própria tela e chamadas
em segundo plano ainda não possuem implementação nativa. Atualizações Android
são instaladas pelo APK; as configurações mostram os downloads de cada plataforma.

O cliente usa o backend oficial do Stoat e o backend auxiliar já configurado.
Nenhum token administrativo ou chave de assinatura faz parte dos apps.
