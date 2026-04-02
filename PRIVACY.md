# Politica de Privacidade - GuardRail

Ultima atualizacao: 2026-04-02

Esta Politica de Privacidade descreve como a extensao GuardRail trata dados de usuarios.

## 1. Resumo

- A GuardRail nao coleta dados pessoais para servidores externos.
- A GuardRail nao vende, compartilha ou transfere dados para terceiros.
- Todas as configuracoes ficam no armazenamento do proprio navegador (`chrome.storage.sync`), vinculado a conta do usuario no navegador, quando aplicavel.

## 2. Quais dados sao tratados

A extensao pode armazenar somente configuracoes funcionais, como:

- Regras de URL configuradas pelo usuario
- Perfis de ambiente (nomes, ativacao/desativacao)
- Preferencias visuais (cor, espessura, estilo de borda)
- Texto de banner por ambiente
- Preferencias de interface (por exemplo, confirmacao de remocao)

Esses dados sao definidos pelo proprio usuario dentro da extensao.

## 3. O que NAO coletamos

A GuardRail nao coleta:

- Nome, email, telefone ou documentos
- Conteudo de formularios digitados em sites
- Historico de navegacao para analytics
- Cookies para rastreamento
- Geolocalizacao
- Dados biometricos

## 4. Permissoes usadas

A extensao utiliza as seguintes permissoes:

- `storage`: salvar e recuperar configuracoes da extensao.
- `tabs`: ler a URL da aba ativa quando o usuario usa a acao "Usar URL atual".

A permissao `tabs` e usada apenas para essa funcionalidade local e nao envia dados para fora do navegador.

## 5. Onde os dados ficam

Os dados sao armazenados em `chrome.storage.sync`.

- Em navegadores compativeis, isso pode sincronizar dados entre dispositivos da mesma conta do usuario.
- A sincronizacao e gerenciada pelo proprio navegador (Chrome/Edge), nao por servidores da GuardRail.

## 6. Compartilhamento de dados

A GuardRail nao compartilha dados com terceiros.

## 7. Seguranca

A extensao foi projetada para operar localmente. Mesmo assim, nenhum software pode garantir risco zero. Recomenda-se manter navegador e extensoes sempre atualizados.

## 8. Retencao e exclusao

Os dados permanecem armazenados ate que:

- o usuario os altere/remova no popup da extensao,
- o usuario limpe os dados do navegador,
- ou a extensao seja desinstalada.

## 9. Publico-alvo

A GuardRail nao e destinada especificamente a criancas.

## 10. Alteracoes nesta politica

Esta politica pode ser atualizada para refletir melhorias da extensao ou exigencias legais. A data de "Ultima atualizacao" sera revisada quando houver mudancas.

## 11. Contato

Responsavel: JP Rodrigues
Projeto: GuardRail
Licenca: MIT

Para duvidas sobre privacidade, abra uma issue no repositorio do projeto ou entre em contato com o mantenedor pelos canais oficiais do repositorio.
