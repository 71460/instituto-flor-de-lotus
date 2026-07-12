# 🔑 Script de Criação Automática de Usuários

Script Node.js que cria usuários no Supabase Auth em lote (bulk creation).

## ⚙️ Como usar

### 1. Preparar arquivo JSON com usuários

Crie um arquivo `usuarios.json` (ou use `usuarios.exemplo.json` como referência):

```json
[
  {
    "email": "pai@example.com",
    "password": "SenhaSegura123!",
    "name": "João Silva",
    "role": "parent"
  },
  {
    "email": "terapeuta@example.com",
    "password": "SenhaSegura456!",
    "name": "Maria Santos",
    "role": "partner"
  }
]
```

**Campos obrigatórios:**
- `email`: email do usuário (único)
- `password`: senha temporária (usuário pode mudar depois)
- `name`: nome completo
- `role`: `"parent"` ou `"partner"` (define permissões no portal)

### 2. Rodar o script

```bash
node create-users.js --file usuarios.json
```

**Exemplo de saída:**
```
📥 Criando 4 usuário(s)...

  → Criando usuário: pai@example.com (parent)...
    ✅ Usuário criado: 12abc-34def-56ghi-78jkl
  → Criando perfil...
    ✅ Perfil criado (parent)

  → Criando usuário: terapeuta@example.com (partner)...
    ✅ Usuário criado: 9abc-123de-456fgh-789ij
  → Criando perfil...
    ✅ Perfil criado (partner)

✅ RESUMO:
   Criados: 2/2

📋 Usuários criados com sucesso:
   • pai@example.com (parent) — João Silva
   • terapeuta@example.com (partner) — Maria Santos

🎯 Próximo passo: acesse o Portal e teste o login destes usuários.
```

## 🔒 Segurança

- **Admin Key** está gravada no script (necessário para criar usuários)
- Guarde bem! Se vazar, qualquer um pode criar/deletar usuários
- Nunca compartilhe este script em público

## 📋 Próximos passos após criar

1. **Teste login** com um dos emails criados no portal
2. **Confirme acesso** aos materiais (pais vê `materiais-pais`, parceiros vê `materiais-parceiros`)
3. **Distribua credenciais** aos usuários de forma segura (WhatsApp, email pessoal, etc.)
4. **Considere reset de senha**: no Supabase Auth → usuário → send reset link
