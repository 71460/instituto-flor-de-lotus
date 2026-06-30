// ══════════════════════════════════════════════════════════════════
// Instituto Flor de Lótus — Integração Supabase para o Portal
// Inclua este arquivo no portal.html após configurar o Supabase
// ══════════════════════════════════════════════════════════════════

// 1. Instale via CDN (adicione no <head> do portal.html):
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// 2. Configure suas credenciais (obtidas no passo 4 do guia):
const SUPABASE_URL  = 'https://imerhiewjfmtzwpqyhcz.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZXJoaWV3amZtdHp3cHF5aGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTQxNzgsImV4cCI6MjA5NzMzMDE3OH0.QtM8FRrHdatXVUTVPMAyFWexFklq_aWn4e3MGltHGTE';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════════════════════════
// AUTH — LOGIN REAL
// ══════════════════════════════════════════════════════════════════

async function doLoginReal() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');

  if (!email || !pass) {
    showLoginError('Preencha email e senha.');
    return;
  }

  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });

    if (error) throw error;

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile) throw new Error('Perfil não encontrado.');

    // O banco usa 'parent'/'partner'/'admin'/'staff', mas os painéis do
    // portal.html usam os IDs 'dash-parents'/'dash-partners'/'dash-admin'
    const dashIdMap = {
      parent:  'dash-parents',
      partner: 'dash-partners',
      admin:   'dash-admin',
      staff:   'dash-admin'
    };
    const dashId = dashIdMap[profile.role] || 'dash-parents';

    // Fechar modal e abrir dashboard correto
    closeLogin();
    document.getElementById('profile-selector').style.display = 'none';
    const dashEl = document.getElementById(dashId);
    if (dashEl) dashEl.classList.add('open');

    // Personalizar boas-vindas
    if (dashId === 'dash-admin') {
      const nameEl = document.getElementById('admin-name-display');
      if (nameEl) nameEl.textContent = profile.full_name.split(' ')[0];
    } else {
      const welcomeEl = document.querySelector('#' + dashId + ' .dash-welcome span');
      if (welcomeEl) welcomeEl.textContent = profile.full_name.split(' ')[0];
    }

    // Carregar dados reais
    if (profile.role === 'parent') {
      await loadParentDashboard(data.user.id);
    } else if (profile.role === 'partner') {
      await loadPartnerDashboard(data.user.id);
    } else if (profile.role === 'admin' || profile.role === 'staff') {
      await adminLoadCategories();
      await adminLoadMaterials();
      if (profile.role === 'admin') await adminLoadPartners();
    }

    // Mostrar nome do usuário + botão Sair na barra de navegação
    showNavUserBadge(profile.full_name);

    // Trava de inatividade (20 min) — apenas para admin/staff
    if (profile.role === 'admin' || profile.role === 'staff') {
      startInactivityTimer();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    showLoginError(err.message === 'Invalid login credentials'
      ? 'Email ou senha incorretos.'
      : err.message);
  } finally {
    btn.innerHTML = '<span class="lpt-i">Entrar no Portal</span><span class="len-i">Enter Portal</span>';
    btn.disabled = false;
  }
}

function showLoginError(msg) {
  let errEl = document.getElementById('login-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'login-error';
    errEl.style.cssText = 'color:#E87EC8;font-size:.8rem;text-align:center;margin-top:.5rem;';
    document.getElementById('login-btn').after(errEl);
  }
  errEl.textContent = msg;
  setTimeout(() => { if (errEl) errEl.textContent = ''; }, 4000);
}

async function doLogoutReal(reason) {
  await _sb.auth.signOut();

  // Reforço: limpa qualquer resíduo de sessão que o Supabase possa ter
  // deixado no localStorage, mesmo que signOut() já devesse fazer isso.
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-') || k.includes('supabase'))
    .forEach(k => localStorage.removeItem(k));

  document.querySelectorAll('.portal-dashboard').forEach(d => d.classList.remove('open'));
  document.getElementById('profile-selector').style.display = '';
  hideNavUserBadge();
  stopInactivityTimer();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (reason === 'inactivity') {
    alert('Sua sessão foi encerrada por inatividade (20 minutos sem uso). Faça login novamente.');
  }
}

// ══════════════════════════════════════════════════════════════════
// CADASTRO — NOVO USUÁRIO (pai OU parceiro)
// ══════════════════════════════════════════════════════════════════
// Pressupõe um formulário com os campos: signup-name, signup-email,
// signup-pass, signup-role (valor 'parent' ou 'partner'), e opcionalmente
// signup-org (nome da instituição, só relevante se role === 'partner').

async function doSignupReal() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-pass').value;
  const role  = document.getElementById('signup-role').value; // 'parent' | 'partner'
  const orgEl = document.getElementById('signup-org');
  const orgName = orgEl ? orgEl.value.trim() : '';
  const btn   = document.getElementById('signup-btn');

  if (!name || !email || !pass) {
    showSignupError('Preencha nome, email e senha.');
    return;
  }
  if (pass.length < 8) {
    showSignupError('A senha deve ter pelo menos 8 caracteres.');
    return;
  }
  if (role === 'partner' && !orgName) {
    showSignupError('Informe o nome da sua instituição/clínica.');
    return;
  }

  btn.textContent = 'Criando conta...';
  btn.disabled = true;

  try {
    // 1. Criar usuário no Auth (o trigger handle_new_user cria o profile automaticamente)
    const { data, error } = await _sb.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name, role: role, lang: localStorage.getItem('fl_lang') || 'pt' } }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Não foi possível criar a conta.');

    // 2. Se for parceiro, criar o registro correspondente em partners
    //    (a política partner_self_insert garante que só o próprio usuário pode fazer isso)
    if (role === 'partner') {
      const { error: partnerErr } = await _sb.from('partners').insert({
        user_id: data.user.id,
        org_name: orgName,
        type: 'professional', // valor inicial; admin pode refinar depois (clinic/school/health_plan)
        active: true
      });
      if (partnerErr) console.error('Erro ao criar registro de parceiro:', partnerErr);
    }

    // 3. Mostrar mensagem de confirmação
    //    (Supabase por padrão exige confirmação de email antes do primeiro login)
    showSignupSuccess(
      'Conta criada! Verifique seu email para confirmar o cadastro antes de entrar.'
    );

  } catch (err) {
    showSignupError(
      err.message === 'User already registered'
        ? 'Este email já está cadastrado. Tente fazer login.'
        : err.message
    );
  } finally {
    btn.textContent = 'Criar Conta';
    btn.disabled = false;
  }
}

function showSignupError(msg) {
  let errEl = document.getElementById('signup-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'signup-error';
    errEl.style.cssText = 'color:#E87EC8;font-size:.8rem;text-align:center;margin-top:.5rem;';
    document.getElementById('signup-btn').after(errEl);
  }
  errEl.style.color = '#E87EC8';
  errEl.textContent = msg;
}

function showSignupSuccess(msg) {
  let errEl = document.getElementById('signup-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'signup-error';
    errEl.style.cssText = 'font-size:.8rem;text-align:center;margin-top:.5rem;';
    document.getElementById('signup-btn').after(errEl);
  }
  errEl.style.color = '#4CAF50';
  errEl.textContent = msg;
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD DE PAIS — Carregar dados reais
// ══════════════════════════════════════════════════════════════════

async function loadParentDashboard(userId) {
  try {
    // Buscar paciente da família
    const { data: familyData } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .single();

    if (!familyData) return;

    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .eq('family_id', familyData.family_id);

    // Carregar materiais disponíveis para pais
    await loadMaterials('parent');

    // Carregar agendamentos
    if (patients && patients.length > 0) {
      await loadAppointments(patients[0].id);
      await loadProgress(patients[0].id);
    }

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

// ══════════════════════════════════════════════════════════════════
// MATERIAIS — Carregar do banco real
// ══════════════════════════════════════════════════════════════════

async function loadMaterials(role) {
  const gridEl = document.getElementById(role === 'parent'
    ? 'parents-tab-materiais'
    : 'partners-tab-protocolos');

  if (!gridEl) return;

  const lang = localStorage.getItem('fl_lang') || 'pt';

  const { data: materials, error } = await supabase
    .from('materials_with_category')
    .select('*')
    .or(`for_role.eq.${role},for_role.eq.both`)
    .eq('published', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !materials) return;

  const grid = document.createElement('div');
  grid.className = 'materials-grid';

  materials.forEach(mat => {
    const title = lang === 'en' ? (mat.title_en || mat.title_pt)
                : lang === 'es' ? (mat.title_es || mat.title_pt)
                : mat.title_pt;

    const desc  = lang === 'en' ? (mat.desc_en  || mat.desc_pt)
                : lang === 'es' ? (mat.desc_es  || mat.desc_pt)
                : mat.desc_pt;

    const icon = mat.file_type === 'video' ? '🎬'
               : mat.file_type === 'doc'   ? '📄'
               : '📋';

    const actionLabel = mat.file_type === 'video' ? '▶ Assistir' : '⬇ Baixar';

    const card = document.createElement('div');
    card.className = 'mat-card';
    card.innerHTML = `
      ${mat.is_new ? '<span class="mat-new">Novo</span>' : ''}
      <span class="mat-category cat-${mat.category_slug || 'orientacao'}">${mat.category_name_pt || ''}</span>
      <span class="mat-icon">${icon}</span>
      <h3 class="mat-title">${title}</h3>
      <p class="mat-desc">${desc || ''}</p>
      <div class="mat-meta">
        <span class="mat-tag">${mat.file_type?.toUpperCase() || 'PDF'}${mat.file_size ? ' · ' + mat.file_size : ''}${mat.duration ? ' · ' + mat.duration : ''}</span>
        <button class="mat-download" onclick="downloadMaterial('${mat.id}','${mat.file_url || ''}','${mat.file_type}', this)">${actionLabel}</button>
      </div>`;
    grid.appendChild(card);
  });

  // Substituir grid existente
  const existingGrid = gridEl.querySelector('.materials-grid');
  if (existingGrid) {
    gridEl.replaceChild(grid, existingGrid);
  } else {
    gridEl.appendChild(grid);
  }

  // Atualizar contador no stat-box
  const statEl = document.querySelector('#dash-' + role + 's .stat-box-num');
  if (statEl) statEl.textContent = materials.length;
}

// ══════════════════════════════════════════════════════════════════
// DOWNLOAD DE MATERIAL
// ══════════════════════════════════════════════════════════════════

async function downloadMaterial(materialId, fileUrl, fileType, btnEl) {
  const { data: { user } } = await _sb.auth.getUser();
  if (!user) return;

  // Descobrir o role do usuário para saber qual bucket usar
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const bucket = profile?.role === 'partner' ? 'materiais-parceiros' : 'materiais-pais';

  // Registrar acesso (analytics)
  await _sb.from('material_access').insert({
    user_id: user.id,
    material_id: materialId,
    action: fileType === 'video' ? 'view' : 'download'
  });

  // Incrementar contador
  await _sb.rpc('increment_download', { mat_id: materialId });

  // Se tiver URL real, abrir; senão mostrar "em breve"
  if (fileUrl && fileUrl.startsWith('http')) {
    const { data } = await _sb.storage
      .from(bucket)
      .createSignedUrl(fileUrl, 3600); // URL válida por 1 hora
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
      return;
    }
  }

  // Fallback para demo
  if (btnEl) dlMat(btnEl);
}

// ══════════════════════════════════════════════════════════════════
// AGENDAMENTOS — Carregar do banco real
// ══════════════════════════════════════════════════════════════════

async function loadAppointments(patientId) {
  const { data: appts } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5);

  if (!appts || appts.length === 0) return;

  const container = document.querySelector('#parents-tab-agenda .dash-card:first-child');
  if (!container) return;

  const header = container.querySelector('.dash-card-header');
  container.innerHTML = '';
  container.appendChild(header);

  appts.forEach(appt => {
    const dt = new Date(appt.scheduled_at);
    const dateStr = dt.toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const item = document.createElement('div');
    item.className = 'news-item';
    item.innerHTML = `
      <div class="news-dot" style="background:var(--pk)"></div>
      <div class="news-text">
        <strong>${appt.specialty}</strong> — ${dateStr}
        <span class="news-date">${appt.professional || ''} · ${appt.duration_min || 50} min</span>
      </div>`;
    container.appendChild(item);
  });
}

// ══════════════════════════════════════════════════════════════════
// PROGRESSO — Carregar do banco real
// ══════════════════════════════════════════════════════════════════

async function loadProgress(patientId) {
  const { data: lastRound } = await supabase
    .from('rounds')
    .select('goals, pts_summary, held_at')
    .eq('patient_id', patientId)
    .order('held_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastRound || !lastRound.goals) return;

  const goals = lastRound.goals;
  const labels = {
    comunicacao: 'Comunicação Verbal',
    motor:       'Habilidades Motoras',
    sensorial:   'Regulação Sensorial',
    social:      'Interação Social'
  };

  const container = document.querySelector('#parents-tab-agenda .dash-card:last-child');
  if (!container) return;

  const header = container.querySelector('.dash-card-header');
  container.innerHTML = '';
  container.appendChild(header);

  Object.entries(goals).forEach(([key, val]) => {
    const label = labels[key] || key;
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.innerHTML = `
      <div class="progress-label"><span>${label}</span><span>${val}%</span></div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${val}%"></div>
      </div>`;
    container.appendChild(item);
  });

  if (lastRound.pts_summary) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:.76rem;color:var(--txl);margin-top:.8rem;font-weight:300;line-height:1.5;';
    note.textContent = '📋 ' + lastRound.pts_summary.substring(0, 120) + '...';
    container.appendChild(note);
  }
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD DE PARCEIROS
// ══════════════════════════════════════════════════════════════════

async function loadPartnerDashboard(userId) {
  await loadMaterials('partner');
}

// ══════════════════════════════════════════════════════════════════
// VERIFICAR SESSÃO AO CARREGAR A PÁGINA
// ══════════════════════════════════════════════════════════════════

async function checkExistingSession() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile || !profile.active) return;

  const dashIdMap = {
    parent:  'dash-parents',
    partner: 'dash-partners',
    admin:   'dash-admin',
    staff:   'dash-admin'
  };
  const dashId = dashIdMap[profile.role] || 'dash-parents';

  // Restaurar sessão automaticamente
  document.getElementById('profile-selector').style.display = 'none';
  const dashEl = document.getElementById(dashId);
  if (dashEl) dashEl.classList.add('open');

  if (dashId === 'dash-admin') {
    const nameEl = document.getElementById('admin-name-display');
    if (nameEl) nameEl.textContent = profile.full_name.split(' ')[0];
  } else {
    const welcomeEl = document.querySelector('#' + dashId + ' .dash-welcome span');
    if (welcomeEl) welcomeEl.textContent = profile.full_name.split(' ')[0];
  }

  if (profile.role === 'parent') {
    await loadParentDashboard(session.user.id);
  } else if (profile.role === 'partner') {
    await loadPartnerDashboard(session.user.id);
  } else if (profile.role === 'admin' || profile.role === 'staff') {
    await adminLoadCategories();
    await adminLoadMaterials();
    if (profile.role === 'admin') await adminLoadPartners();
  }

  showNavUserBadge(profile.full_name);

  if (profile.role === 'admin' || profile.role === 'staff') {
    startInactivityTimer();
  }
}

// ══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════════════════════════

// Substituir funções de login do portal.html
window.doLogin    = doLoginReal;
window.doLogout   = doLogoutReal;
window.doSignup   = doSignupReal;

// Verificar sessão existente ao carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkExistingSession);
} else {
  checkExistingSession();
}

// ══════════════════════════════════════════════════════════════════
// PAINEL ADMINISTRATIVO — gerenciar materiais e parceiros
// Disponível para usuários com role 'admin' ou 'staff'
// ══════════════════════════════════════════════════════════════════

// Mostrar/esconder campo de arquivo vs link, conforme o tipo escolhido
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'admin-mat-type') {
    const isLink = e.target.value === 'link';
    const fileGroup = document.getElementById('admin-file-group');
    const linkGroup = document.getElementById('admin-link-group');
    if (fileGroup) fileGroup.style.display = isLink ? 'none' : '';
    if (linkGroup) linkGroup.style.display = isLink ? '' : 'none';
  }
});

// ── Carregar categorias no <select> do formulário ──────────────────
async function adminLoadCategories() {
  const sel = document.getElementById('admin-mat-category');
  if (!sel) return;

  const { data, error } = await supabase
    .from('material_categories')
    .select('*')
    .order('name_pt');

  if (error || !data) {
    sel.innerHTML = '<option value="">Erro ao carregar categorias</option>';
    return;
  }

  sel.innerHTML = data.map(cat =>
    `<option value="${cat.id}">${cat.icon || ''} ${cat.name_pt}</option>`
  ).join('');
}

// ── Listar todos os materiais existentes ────────────────────────────
async function adminLoadMaterials() {
  const list = document.getElementById('admin-materials-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--txl);font-size:.85rem">Carregando...</p>';

  const { data, error } = await supabase
    .from('materials_with_category')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p style="color:#E87EC8;font-size:.85rem">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--txl);font-size:.85rem">Nenhum material cadastrado ainda.</p>';
    return;
  }

  const roleLabel = { parent: '👪 Pais', partner: '🤝 Parceiros', both: '👪🤝 Ambos' };

  list.innerHTML = data.map(mat => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem 1rem;border:1px solid var(--lb2);border-radius:10px">
      <div style="flex:1">
        <div style="font-weight:500;font-size:.88rem">${mat.title_pt}</div>
        <div style="font-size:.75rem;color:var(--txl);margin-top:.2rem">
          ${mat.category_icon || ''} ${mat.category_name_pt || 'Sem categoria'} &middot;
          ${roleLabel[mat.for_role] || mat.for_role} &middot;
          ${mat.download_count || 0} acessos
          ${mat.is_new ? ' &middot; <span style="color:#9b87c4">Novo</span>' : ''}
        </div>
      </div>
      <button class="forum-reply-btn" onclick="adminDeleteMaterial('${mat.id}', '${mat.title_pt.replace(/'/g, "\\'")}')" style="color:#E87EC8;border-color:#E87EC8">
        &#x1F5D1; Excluir
      </button>
    </div>
  `).join('');
}

// ── Excluir material ─────────────────────────────────────────────
async function adminDeleteMaterial(id, title) {
  if (!confirm(`Tem certeza que deseja excluir "${title}"? Esta ação não pode ser desfeita.`)) return;

  const { error } = await _sb.from('materials').delete().eq('id', id);

  if (error) {
    alert('Erro ao excluir: ' + error.message);
    return;
  }
  await adminLoadMaterials();
}

// ── Mostrar mensagem de status no formulário de upload ──────────
function adminShowUploadMsg(msg, isError) {
  const el = document.getElementById('admin-upload-msg');
  if (!el) return;
  el.style.display = 'block';
  el.style.background = isError ? '#FDEAF3' : '#E8F5E9';
  el.style.color = isError ? '#C8388C' : '#2E7D32';
  el.textContent = msg;
}

// ── Publicar novo material (com upload de arquivo real) ─────────
async function adminUploadMaterial() {
  const btn = document.getElementById('admin-upload-btn');
  const categoryId = document.getElementById('admin-mat-category').value;
  const forRole    = document.getElementById('admin-mat-for-role').value;
  const titlePt     = document.getElementById('admin-mat-title-pt').value.trim();
  const titleEn     = document.getElementById('admin-mat-title-en').value.trim();
  const titleEs     = document.getElementById('admin-mat-title-es').value.trim();
  const descPt      = document.getElementById('admin-mat-desc-pt').value.trim();
  const descEn       = document.getElementById('admin-mat-desc-en').value.trim();
  const descEs       = document.getElementById('admin-mat-desc-es').value.trim();
  const fileType     = document.getElementById('admin-mat-type').value;
  const fileInput     = document.getElementById('admin-mat-file');
  const linkUrl       = document.getElementById('admin-mat-link-url').value.trim();
  const isNew          = document.getElementById('admin-mat-new').checked;
  const isFeatured     = document.getElementById('admin-mat-featured').checked;

  if (!categoryId) { adminShowUploadMsg('Selecione uma categoria.', true); return; }
  if (!titlePt)     { adminShowUploadMsg('Preencha o título em português.', true); return; }
  if (!descPt)      { adminShowUploadMsg('Preencha a descrição em português.', true); return; }
  if (fileType === 'link' && !linkUrl) {
    adminShowUploadMsg('Informe a URL do link.', true); return;
  }
  if (fileType !== 'link' && (!fileInput.files || fileInput.files.length === 0)) {
    adminShowUploadMsg('Selecione um arquivo para enviar.', true); return;
  }

  btn.textContent = 'Publicando...';
  btn.disabled = true;

  try {
    let fileUrl = linkUrl;
    let fileSizeLabel = null;

    // Se houver arquivo real, fazer upload para o Storage
    if (fileType !== 'link') {
      const file = fileInput.files[0];
      const bucket = (forRole === 'partner') ? 'materiais-parceiros' : 'materiais-pais';
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${Date.now()}_${safeName}`;

      const { error: upErr } = await _sb.storage.from(bucket).upload(path, file);
      if (upErr) throw upErr;

      fileUrl = path;
      fileSizeLabel = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Criar o registro do material no banco
    const { error: insErr } = await _sb.from('materials').insert({
      category_id: categoryId,
      for_role: forRole,
      title_pt: titlePt,
      title_en: titleEn || null,
      title_es: titleEs || null,
      desc_pt: descPt,
      desc_en: descEn || null,
      desc_es: descEs || null,
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSizeLabel,
      is_new: isNew,
      is_featured: isFeatured,
      published: true
    });

    if (insErr) throw insErr;

    adminShowUploadMsg('Material publicado com sucesso! ✅', false);

    // Limpar formulário
    ['admin-mat-title-pt','admin-mat-title-en','admin-mat-title-es',
     'admin-mat-desc-pt','admin-mat-desc-en','admin-mat-desc-es',
     'admin-mat-link-url'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('admin-mat-new').checked = false;
    document.getElementById('admin-mat-featured').checked = false;
    if (fileInput) fileInput.value = '';

    // Atualizar a lista de materiais (caso o usuário vá olhar a aba)
    await adminLoadMaterials();

  } catch (err) {
    adminShowUploadMsg('Erro ao publicar: ' + err.message, true);
  } finally {
    btn.innerHTML = '&#x2B06; Publicar Material';
    btn.disabled = false;
  }
}

// ── Listar parceiros cadastrados ─────────────────────────────────
async function adminLoadPartners() {
  const list = document.getElementById('admin-partners-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--txl);font-size:.85rem">Carregando...</p>';

  const { data, error } = await supabase
    .from('partners')
    .select('*, profiles:user_id(full_name)')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p style="color:#E87EC8;font-size:.85rem">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--txl);font-size:.85rem">Nenhum parceiro cadastrado ainda.</p>';
    return;
  }

  const typeLabel = { clinic: 'Clínica', school: 'Escola', health_plan: 'Plano de Saúde', professional: 'Profissional' };

  list.innerHTML = data.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem 1rem;border:1px solid var(--lb2);border-radius:10px">
      <div>
        <div style="font-weight:500;font-size:.88rem">${p.org_name || '(sem nome de organização)'}</div>
        <div style="font-size:.75rem;color:var(--txl);margin-top:.2rem">
          Responsável: ${p.profiles?.full_name || '—'} &middot; ${typeLabel[p.type] || p.type} &middot;
          ${p.active ? '<span style="color:#2E7D32">Ativo</span>' : '<span style="color:#E87EC8">Inativo</span>'}
        </div>
      </div>
      <button class="forum-reply-btn" onclick="adminTogglePartner('${p.id}', ${!p.active})">
        ${p.active ? 'Desativar' : 'Ativar'}
      </button>
    </div>
  `).join('');
}

// ── Ativar/desativar parceiro ─────────────────────────────────────
async function adminTogglePartner(id, newActiveState) {
  const { error } = await _sb.from('partners').update({ active: newActiveState }).eq('id', id);
  if (error) {
    alert('Erro: ' + error.message);
    return;
  }
  await adminLoadPartners();
}

window.adminLoadCategories  = adminLoadCategories;
window.adminLoadMaterials   = adminLoadMaterials;
window.adminDeleteMaterial  = adminDeleteMaterial;
window.adminUploadMaterial  = adminUploadMaterial;
window.adminLoadPartners    = adminLoadPartners;
window.adminTogglePartner   = adminTogglePartner;

// ══════════════════════════════════════════════════════════════════
// BADGE DE USUÁRIO NA NAVBAR — mostra nome + botão Sair sempre visível
// ══════════════════════════════════════════════════════════════════

function showNavUserBadge(fullName) {
  const badge = document.getElementById('nav-user-badge');
  const nameEl = document.getElementById('nav-user-name');
  if (!badge || !nameEl) return;
  nameEl.textContent = fullName.split(' ')[0];
  badge.style.display = 'flex';
}

function hideNavUserBadge() {
  const badge = document.getElementById('nav-user-badge');
  if (badge) badge.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════
// TRAVA DE INATIVIDADE — 20 minutos, apenas para admin/staff
// Qualquer movimento de mouse, clique, tecla ou rolagem da página
// reseta o contador. Após 20 minutos sem nenhuma dessas atividades,
// a sessão é encerrada automaticamente.
// ══════════════════════════════════════════════════════════════════

const INACTIVITY_LIMIT_MS = 20 * 60 * 1000; // 20 minutos
let inactivityTimer = null;
let inactivityListenersAttached = false;

function resetInactivityTimer() {
  if (!inactivityTimer && inactivityTimer !== 0) return; // timer não está ativo
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    doLogoutReal('inactivity');
  }, INACTIVITY_LIMIT_MS);
}

function startInactivityTimer() {
  resetInactivityTimer();
  if (inactivityListenersAttached) return; // evita duplicar listeners
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
  inactivityListenersAttached = true;
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
  if (inactivityListenersAttached) {
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
      document.removeEventListener(evt, resetInactivityTimer);
    });
    inactivityListenersAttached = false;
  }
}

// ══════════════════════════════════════════════════════════════════
// FUNÇÃO RPC para incrementar downloads (executar no Supabase):
// ══════════════════════════════════════════════════════════════════
/*
CREATE OR REPLACE FUNCTION increment_download(mat_id UUID)
RETURNS void AS $$
  UPDATE materials SET download_count = download_count + 1
  WHERE id = mat_id;
$$ LANGUAGE sql SECURITY DEFINER;
*/
