// ============================================================
// VALIDATORS.JS — Validação e Máscaras de Formulário
// ============================================================

const Validators = {

    // ---- NOME COMPLETO ----
    nome(value) {
        const trimmed = value.replace(/\s+/g, ' ').trim();
        if (trimmed.length < 3) return 'Nome deve ter pelo menos 3 caracteres.';
        if (/[0-9@!_#$%^&*()+=\[\]{};':"\\|,.<>\/?]/.test(trimmed))
            return 'Nome não pode conter números ou símbolos.';
        const parts = trimmed.split(' ').filter(p => p.length > 0);
        if (parts.length < 2) return 'Informe o nome completo (nome e sobrenome).';
        return null; // válido
    },

    // ---- CPF ----
    cpf(value) {
        const cpf = value.replace(/\D/g, '');
        if (cpf.length !== 11) return 'CPF deve ter 11 dígitos.';
        // Bloquear sequências inválidas
        if (/^(\d)\1{10}$/.test(cpf)) return 'CPF inválido.';
        // Dígito verificador 1
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
        let rem = (sum * 10) % 11;
        if (rem === 10 || rem === 11) rem = 0;
        if (rem !== parseInt(cpf[9])) return 'CPF inválido (dígito verificador incorreto).';
        // Dígito verificador 2
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
        rem = (sum * 10) % 11;
        if (rem === 10 || rem === 11) rem = 0;
        if (rem !== parseInt(cpf[10])) return 'CPF inválido (dígito verificador incorreto).';
        return null;
    },

    // ---- CNPJ ----
    cnpj(value) {
        const cnpj = value.replace(/\D/g, '');
        if (cnpj.length !== 14) return 'CNPJ deve ter 14 dígitos.';
        if (/^(\d)\1{13}$/.test(cnpj)) return 'CNPJ inválido.';
        const calc = (c, l) => {
            let sum = 0, pos = l - 7;
            for (let i = l; i >= 1; i--) {
                sum += parseInt(c[l - i]) * pos--;
                if (pos < 2) pos = 9;
            }
            return sum % 11 < 2 ? 0 : 11 - (sum % 11);
        };
        if (calc(cnpj, 12) !== parseInt(cnpj[12])) return 'CNPJ inválido.';
        if (calc(cnpj, 13) !== parseInt(cnpj[13])) return 'CNPJ inválido.';
        return null;
    },

    // ---- EMAIL ----
    email(value) {
        const v = value.trim().toLowerCase();
        if (/\s/.test(v)) return 'E-mail não pode conter espaços.';
        const re = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
        if (!re.test(v)) return 'E-mail inválido. Use o formato nome@dominio.com';
        return null;
    },

    // ---- TELEFONE ----
    telefone(value) {
        const tel = value.replace(/\D/g, '');
        if (tel.length < 10 || tel.length > 11) return 'Telefone deve ter 10 ou 11 dígitos (com DDD).';
        const ddd = parseInt(tel.substring(0, 2));
        if (ddd < 11 || tel[0] === '0' || tel[0] === '1') return 'DDD inválido.';
        return null;
    },

    // ---- CEP (busca ViaCEP) ----
    async buscarCep(cep, fields) {
        const c = cep.replace(/\D/g, '');
        if (c.length !== 8) return { ok: false, msg: 'CEP deve ter 8 dígitos.' };
        try {
            const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
            const data = await res.json();
            if (data.erro) return { ok: false, msg: 'CEP não encontrado.' };
            // Preenche os campos automaticamente
            if (fields.logradouro) fields.logradouro.value = data.logradouro || '';
            if (fields.bairro)     fields.bairro.value     = data.bairro || '';
            if (fields.cidade)     fields.cidade.value     = data.localidade || '';
            if (fields.estado)     fields.estado.value     = data.uf || '';
            return { ok: true, data };
        } catch(e) {
            return { ok: false, msg: 'Erro ao buscar CEP. Verifique sua conexão.' };
        }
    },

    // ---- LIMPAR DADOS (sanitize antes de salvar) ----
    sanitize: {
        nome: v  => v.replace(/\s+/g, ' ').trim(),
        cpf:  v  => v.replace(/\D/g, ''),
        cnpj: v  => v.replace(/\D/g, ''),
        email: v => v.trim().toLowerCase(),
        telefone: v => v.replace(/\D/g, ''),
        cep: v   => v.replace(/\D/g, '')
    }
};

// ============================================================
// MÁSCARAS DE INPUT (aplicar via data-mask)
// ============================================================
function applyMasks() {
    document.querySelectorAll('[data-mask]').forEach(input => {
        const mask = input.dataset.mask;
        input.addEventListener('input', () => {
            let v = input.value.replace(/\D/g, '');
            if (mask === 'cpf') {
                v = v.substring(0, 11);
                v = v.replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else if (mask === 'cnpj') {
                v = v.substring(0, 14);
                v = v.replace(/(\d{2})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1.$2')
                     .replace(/(\d{3})(\d)/, '$1/$2')
                     .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            } else if (mask === 'cep') {
                v = v.substring(0, 8);
                v = v.replace(/(\d{5})(\d)/, '$1-$2');
            } else if (mask === 'telefone') {
                v = v.substring(0, 11);
                if (v.length <= 10) {
                    v = v.replace(/(\d{2})(\d)/, '($1) $2')
                         .replace(/(\d{4})(\d)/, '$1-$2');
                } else {
                    v = v.replace(/(\d{2})(\d)/, '($1) $2')
                         .replace(/(\d{5})(\d)/, '$1-$2');
                }
            }
            input.value = v;
        });
    });

    // Estado: força maiúsculas e aceita só letras
    document.querySelectorAll('#estado').forEach(input => {
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2);
        });
    });

    // Email: força minúsculas em tempo real
    document.querySelectorAll('input[type="email"]').forEach(input => {
        input.addEventListener('input', () => {
            const pos = input.selectionStart;
            input.value = input.value.toLowerCase();
            input.setSelectionRange(pos, pos);
        });
    });
}

// Aplica as máscaras quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMasks);
} else {
    applyMasks();
}
