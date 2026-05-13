// ============================================================
// theme.js — Carrega e aplica as cores do site em TODAS as páginas
// Usa fetch() nativo (sem depender do SDK Supabase)
// ============================================================

(function () {
    var SUPABASE_URL = 'https://kakeytwbtnwbkofintuh.supabase.co';
    var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2V5dHdidG53YmtvZmludHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODM3NjYsImV4cCI6MjA5MzE1OTc2Nn0.6mDIto6yuhcFDm7R-QKR3M3IcgeMdCykDkNUH8MFc5M';
    var CACHE_KEY = 'otmake10_site_colors';

    // Função que deriva a versão escura de uma cor hex
    function darkenHex(hex, factor) {
        try {
            var num = parseInt(hex.slice(1), 16);
            var r = Math.max(0, (num >> 16) - Math.round((num >> 16) * factor));
            var g = Math.max(0, ((num >> 8) & 0xFF) - Math.round(((num >> 8) & 0xFF) * factor));
            var b = Math.max(0, (num & 0xFF) - Math.round((num & 0xFF) * factor));
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        } catch (e) { return hex; }
    }

    // Aplica as cores no :root
    function applyColors(primary, text, admin) {
        var root = document.documentElement;
        if (primary) {
            root.style.setProperty('--primary-green', primary);
            root.style.setProperty('--light-green', primary);
            root.style.setProperty('--dark-green', darkenHex(primary, 0.3));
        }
        if (text) {
            root.style.setProperty('--text-main', text);
        }
        // Cor do painel admin (sidebar, cards, botões)
        if (admin) {
            root.style.setProperty('--admin-primary', admin);
        }
    }

    // PASSO 1: Aplica do cache (localStorage) IMEDIATAMENTE — sem flash verde
    try {
        var cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            var c = JSON.parse(cached);
            applyColors(c.primary, c.text, c.admin);
        }
    } catch (e) {}

    // PASSO 2: Sincroniza com o Supabase via fetch nativo
    fetch(
        SUPABASE_URL + '/rest/v1/store_settings?select=primary_color,text_color&limit=1&_t=' + new Date().getTime(),
        {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            cache: 'no-store'
        }
    )
    .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    })
    .then(function (data) {
        if (!data || data.length === 0) return;
        var row = data[0];
        var primary = row.primary_color;
        var text = row.text_color;
        
        var admin = null;
        try {
            var cached = localStorage.getItem(CACHE_KEY);
            if (cached) admin = JSON.parse(cached).admin;
        } catch(e) {}

        // Aplica no DOM
        applyColors(primary, text, admin);

        // Atualiza o cache local com os dados mais recentes
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ primary: primary, text: text, admin: admin }));
        } catch (e) {}
    })
    .catch(function () {
        // Se falhar, o cache já foi aplicado no passo 1 — sem quebrar nada
    });

})();
