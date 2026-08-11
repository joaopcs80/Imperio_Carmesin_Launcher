# Próximos Passos - Launcher V Rising (Império Carmesim)

Este arquivo serve como um guia para retomarmos o desenvolvimento do Launcher quando você estiver pronto.

## 1. O que já está feito:
- Projeto Tauri + React inicializado.
- Interface base (Frontend) criada com Tailwind CSS e imagem temática gerada por IA.
- Configuração da janela para o modo "Frameless" e "Transparent" (sem bordas padrão do Windows).

## 2. O que falta implementar no Launcher (Frontend & Backend):
- [ ] **Lógica de Atualização:** Fazer o botão "Atualizar" consultar a API do GitHub Releases (`api.github.com/repos/SEU-USUARIO/Imperio_Carmesim_ModPack/releases/latest`).
- [ ] **Download Direto:** Implementar a função em Rust para baixar o arquivo `.zip` do GitHub para uma pasta temporária do Windows e atualizar a barra de progresso no React.
- [ ] **Extração Automática:** Extrair o conteúdo do `.zip` silenciosamente para a pasta `BepInEx/plugins` do jogador.
- [ ] **Descoberta da Pasta do Jogo:** Ler os Registros do Windows (Steam Registry) para encontrar o caminho de instalação do V Rising automaticamente.
- [ ] **Inicialização do Jogo:** Fazer o botão "Jogar" executar `steam://rungameid/1604030//+connect 198.22.204.17:43157`.

## 3. Painel Administrativo (Para Criptografia):
- [ ] Criar um atalho escondido (ex: `Shift + Clique na Logo`) para abrir a área de Admin.
- [ ] Tela para inserir a chave do Patcher.
- [ ] Botão para o Admin selecionar as DLLs originais.
- [ ] Código em Rust (`aes-gcm`) para ler a `.dll`, criptografar e salvar como `.enc`.

## 4. O que você precisa ajustar/preparar (Suas pendências):
- [ ] **Repositório GitHub:** Garantir que o repositório `Imperio_Carmesim_ModPack` esteja criado lá no site do GitHub e que você saiba enviar arquivos pra lá.
- [ ] **Desenvolvimento do Patcher:** Criar o mod (Patcher) do V Rising em C# que fará a descriptografia das DLLs (usando a mesma chave AES-256) em tempo de execução e carregará os assemblies.
- [ ] **ConfuserEx:** Preparar o pipeline para ofuscar o seu Patcher antes de enviar para os jogadores.

---
*Quando estiver pronto para continuar, basta me avisar e retomaremos de onde paramos!*
