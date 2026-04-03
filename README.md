# GuardRail

![GuardRail logo](src/assets/guardrail-logo.svg)

Extensão de navegador (Manifest V3) para reduzir erros de contexto ao navegar entre ambientes sensíveis.

A GuardRail monitora a URL da página atual com base em regras configuradas e aplica alertas visuais (borda + banner) quando houver correspondência.

## Principais recursos

- Regras de URL com 4 tipos de comparação:
  - `startsWith` (começa com)
  - `contains` (contém)
  - `regex`
  - `domain` (domínio exato)
- Perfis de ambiente (ex.: Trabalho, Produção, Homologação)
- Criação de contextos personalizados
- Tags opcionais por regra
- Agrupamento de regras por perfil, domínio-base ou tag
- Cor de alerta por ambiente
- Texto de banner por ambiente
- Borda configurável (espessura e estilo)
- Importação e exportação de configurações em JSON
- Desfazer última remoção de regra
- Confirmação opcional antes de remover regra
- Configurações persistidas em `chrome.storage.sync`

## Como funciona

1. Você cria regras na aba `Regras` do popup.
1. Cada regra é vinculada a um perfil.
1. Quando a URL da aba ativa combina com uma regra ativa, a extensão sobrepõe uma borda de alerta e pode mostrar um banner no topo com o texto do ambiente.
1. O alerta visual usa as configurações do perfil correspondente.

### Precedência entre regras

A GuardRail usa uma política explícita para evitar comportamento arbitrário quando mais de uma regra combina com a mesma URL.

Ordem de decisão:

1. Regra mais específica vence (por tipo de comparação)
1. Em empate de especificidade, vence a regra que apareceu primeiro na lista

Prioridade por tipo (da mais forte para a mais fraca):

- `domain` (domínio exato)
- `startsWith` (começa com)
- `contains` (contém)
- `regex`

Observação: dentro do mesmo tipo, valores mais longos têm prioridade sobre valores mais curtos.

### Transparência do match

Quando uma regra é aplicada, o banner mostra:

- Regra aplicada (tipo + valor)
- Perfil associado
- URL detectada

Isso melhora a confiança operacional e facilita depuração de regras.

## Estrutura do popup

- Aba `Regras`:
  - Adição de regras
  - Campo de tag opcional por regra
  - Agrupamento da lista por perfil, domínio-base, tag ou sem agrupamento
  - Botão `Usar URL atual` (preenche o input, não adiciona automaticamente)
  - Lista de regras ativas
- Aba `Configurações`:
  - Configuração de perfis (ativação, criação de contexto personalizado, cor e texto do banner por ambiente)
  - Configuração global da borda (espessura e estilo)
  - Confirmação de remoção
  - Importar/Exportar JSON

## Instalação local (Chrome/Edge)

1. Abra `chrome://extensions` (ou `edge://extensions`)
2. Ative o `Modo do desenvolvedor`
3. Clique em `Carregar sem compactação`
4. Selecione a pasta [src](src)

## Permissões

- `storage`: salvar e ler configurações da extensão
- `tabs`: capturar a URL da aba ativa quando o usuário usa `Usar URL atual`
- `content_scripts.matches: <all_urls>`: aplicar alerta visual nas páginas alvo

## Arquivos principais

- Manifesto: [src/manifest.json](src/manifest.json)
- Script de página (alertas): [src/content.js](src/content.js)
- Interface do popup: [src/popup.html](src/popup.html)
- Lógica do popup: [src/popup.js](src/popup.js)
- Estilos do popup: [src/styles.css](src/styles.css)

## Design e marca

- Logo: [src/assets/guardrail-logo.svg](src/assets/guardrail-logo.svg)
- Marca (ícone): [src/assets/guardrail-mark.svg](src/assets/guardrail-mark.svg)
- Ícones da extensão: [src/icons/icon-16.png](src/icons/icon-16.png), [src/icons/icon-32.png](src/icons/icon-32.png), [src/icons/icon-48.png](src/icons/icon-48.png), [src/icons/icon-128.png](src/icons/icon-128.png)

## Privacidade

- Política de Privacidade (PT-BR): [PRIVACY.md](PRIVACY.md)
- Privacy Policy (EN): [PRIVACY.en.md](PRIVACY.en.md)

## Licença

MIT. Veja [LICENSE](LICENSE).
