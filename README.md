# GuardRail

![GuardRail logo](src/assets/guardrail-logo.svg)

Extensao de navegador (Manifest V3) que aplica uma borda vermelha de 4px na pagina quando a URL atual comeca com um dos prefixos configurados.

## O que faz

- Permite adicionar prefixos de URL pelo popup
- Permite remover prefixos de URL pelo popup
- Salva os prefixos em `chrome.storage.sync`
- Verifica a URL da pagina e aplica uma borda vermelha de 4px quando houver correspondencia

## Instalar localmente (Chrome/Edge)

1. Abra a pagina de extensoes do navegador (`chrome://extensions` ou `edge://extensions`)
2. Ative o modo desenvolvedor
3. Clique em "Carregar sem compactacao"
4. Selecione a pasta `src` deste projeto

## Uso

1. Clique no icone da extensao
2. Adicione um prefixo de URL, por exemplo: `https://app.exemplo.com/`
3. Abra qualquer pagina cuja URL comece com esse prefixo
4. A pagina recebera uma borda vermelha de 4px
5. Para parar o efeito, remova o prefixo no popup
