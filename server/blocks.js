/** Render blocks to HTML - no build, pure strings */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBlock(block) {
  const d = block.data || {};
  switch (block.block_type) {
    case 'hero': {
      const badge = d.badge || '';
      const headline = d.headline || '';
      const subhead = (d.subhead || '').replace(/\n/g, '<br>');
      const ctaLabel = d.cta_label || 'Book Consultation';
      const ctaHref = d.cta_href || '#contact';
      const warning = d.warning_text || '';
      return `
<section id="hook" class="min-h-screen flex items-center justify-center relative overflow-hidden pt-20" style="background:#050505;color:#fff">
  <div class="container mx-auto px-6 relative z-10 text-center">
    ${badge ? `<span class="inline-block font-mono text-sm uppercase tracking-widest mb-6 px-4 py-2 border border-[#00FF94]/50 bg-[rgba(0,255,148,0.05)] text-[#00FF94]">${esc(badge)}</span>` : ''}
    <h1 class="text-5xl md:text-7xl font-black text-white mb-8 leading-tight" style="letter-spacing:-3px">${headline}</h1>
    ${subhead ? `<p class="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-12 font-mono">${subhead}</p>` : ''}
    <a href="${esc(ctaHref)}" class="inline-block px-8 py-4 bg-[#00FF94] text-[#050505] font-bold uppercase tracking-wider rounded-lg hover:bg-white transition">${esc(ctaLabel)}</a>
    ${warning ? `<p class="font-mono text-xs text-white/50 mt-8">${esc(warning)}</p>` : ''}
  </div>
</section>`;
    }
    case 'terminal_problem': {
      const eyebrow = d.eyebrow || '';
      const title = d.title || '';
      const body = d.body || '';
      const bullets = d.bullets || [];
      const logs = d.terminal_logs || [];
      const status = d.status_text || '';
      const bulletsHtml = bullets.map((b) => `<li class="font-mono text-red-400">${esc(b)}</li>`).join('');
      const logsHtml = logs.map((l) => `<div class="mb-2"><span class="text-white/50">${esc(l.time || '')}</span> ${esc(l.msg || '')}</div>`).join('');
      return `
<section class="py-24 border-t border-white/10" style="background:#0A0A0A;color:#fff">
  <div class="container mx-auto px-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        ${eyebrow ? `<span class="text-[#FF00FF] font-mono block mb-3">${esc(eyebrow)}</span>` : ''}
        <h2 class="text-3xl md:text-5xl font-bold text-white mb-4">${esc(title)}</h2>
        ${body ? `<p class="text-lg text-white/70 mb-6">${esc(body)}</p>` : ''}
        <hr class="border-white/20 my-6"/>
        ${bulletsHtml ? `<ul class="list-none space-y-3 font-mono">${bulletsHtml}</ul>` : ''}
      </div>
      <div class="font-mono text-sm p-6 rounded-lg border border-white/10 bg-black/50">${logsHtml}${status ? `<div class="mt-3 text-[#00FF94]">${esc(status)}</div>` : ''}</div>
    </div>
  </div>
</section>`;
    }
    case 'solution_cards': {
      const eyebrow = d.eyebrow || '';
      const title = d.title || '';
      const cards = d.cards || [];
      const cardHtml = cards.map((c) => {
        const bc = c.border_color === 'neon-green' ? '#00FF94' : c.border_color === 'neon-pink' ? '#FF00FF' : '#00B8FF';
        return `<div class="p-6 rounded-lg border border-white/10 h-full" style="border-left:4px solid ${bc}"><h3 class="text-white text-lg font-bold mb-3">${c.title || ''}</h3><p class="text-white/70 text-sm">${esc(c.body || '')}</p></div>`;
      }).join('');
      return `
<section id="solution" class="py-24" style="background:#000;color:#fff">
  <div class="container mx-auto px-6">
    <div class="text-center mb-12">${eyebrow ? `<span class="text-[#00B8FF] font-mono block mb-2">${esc(eyebrow)}</span>` : ''}<h2 class="text-2xl md:text-3xl font-bold">${esc(title)}</h2></div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${cardHtml}</div>
  </div>
</section>`;
    }
    case 'authority': {
      const title = d.title || '';
      const body = d.body || '';
      const stats = d.stats || [];
      const statsHtml = stats.map((s) => `<div><div class="text-2xl font-bold text-[#00FF94]">${esc(s.value || '')}</div><div class="text-sm text-white/60">${esc(s.label || '')}</div></div>`).join('');
      return `
<section class="py-24" style="background:#0A0A0A;color:#fff">
  <div class="container mx-auto px-6">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="text-2xl md:text-4xl font-bold text-white mb-6">${title}</h2>
      ${body ? `<div class="text-white/70 mb-8 prose prose-invert">${body}</div>` : ''}
      ${statsHtml ? `<div class="flex justify-center gap-12 font-mono border-t border-b border-white/10 py-6">${statsHtml}</div>` : ''}
    </div>
  </div>
</section>`;
    }
    case 'audit_form': {
      const title = d.title || 'Technical Strategy Session';
      const subhead = d.subhead || "Let's audit your stack and find the bottleneck.";
      const formTitle = d.form_title || 'INITIATE_HANDSHAKE_PROTOCOL';
      const submitSource = d.submit_source || 'CAW_SITE';
      const formId = `architectForm-${esc(submitSource).replace(/[^a-zA-Z0-9]/g, '')}`; // Unique ID for the form
      return `
<section id="audit" class="py-24 relative">
  <div class="container mx-auto px-6">
    <div class="max-w-xl mx-auto">
      <div class="bg-black border border-white/10 p-8">
        <div class="text-center mb-6">
          <h2 class="text-white uppercase text-lg font-bold">${esc(title)}</h2>
          ${subhead ? `<p class="text-white/60 text-sm font-mono mt-1">${esc(subhead)}</p>` : ''}
        </div>
        <form id="${formId}" class="space-y-4">
          <div>
            <label for="${formId}-name" class="text-[#00FF94] font-mono text-xs uppercase block mb-1">Root User ID (Name)</label>
            <input type="text" id="${formId}-name" name="name" required placeholder="John Doe"
              style="width:100%;background:#111;border:1px solid rgba(255,255,255,.25);color:#fff;padding:.65rem .9rem;font-size:.875rem;border-radius:.25rem"/>
          </div>
          <div>
            <label for="${formId}-email" class="text-[#00FF94] font-mono text-xs uppercase block mb-1">Communication Link (Email)</label>
            <input type="email" id="${formId}-email" name="email" required placeholder="john@agency.com"
              style="width:100%;background:#111;border:1px solid rgba(255,255,255,.25);color:#fff;padding:.65rem .9rem;font-size:.875rem;border-radius:.25rem"/>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="${formId}-revenue" class="text-[#00FF94] font-mono text-xs uppercase block mb-1">Load (Revenue)</label>
              <select id="${formId}-revenue" name="revenue" aria-label="Select revenue range"
                style="width:100%;background:#111;border:1px solid rgba(255,255,255,.25);color:#fff;padding:.6rem .9rem;font-size:.875rem;border-radius:.25rem;-webkit-appearance:none;appearance:none;">
                <option value="500k-1m">$500k – $1M</option>
                <option value="1m-3m">$1M – $3M</option>
                <option value="3m+">$3M+</option>
              </select>
            </div>
            <div>
              <label for="${formId}-budget" class="text-[#00FF94] font-mono text-xs uppercase block mb-1">Budget</label>
              <select id="${formId}-budget" name="budget" aria-label="Select budget range"
                style="width:100%;background:#111;border:1px solid rgba(255,255,255,.25);color:#fff;padding:.6rem .9rem;font-size:.875rem;border-radius:.25rem;-webkit-appearance:none;appearance:none;">
                <option value="10k+">$10k+</option>
                <option value="25k+">$25k+</option>
                <option value="50k+">$50k+</option>
              </select>
            </div>
          </div>
          <div>
            <label for="${formId}-problem" class="text-[#00FF94] font-mono text-xs uppercase block mb-1">System Error (The Problem)</label>
            <textarea id="${formId}-problem" name="problem" rows="3" placeholder="What is currently breaking?"
              style="width:100%;background:#111;border:1px solid rgba(255,255,255,.25);color:#fff;padding:.65rem .9rem;font-size:.875rem;border-radius:.25rem;resize:vertical;min-height:80px"></textarea>
          </div>
          <input type="hidden" name="source" value="${esc(submitSource)}"/>
          <input type="hidden" name="form_type" value="architect"/>
          <button type="submit" style="width:100%;min-height:52px;padding:1rem;background:#00FF94;color:#050505;font-weight:700;font-size:.95rem;text-transform:uppercase;letter-spacing:.06em;border:none;border-radius:.375rem;cursor:pointer;transition:background .2s">${esc(formTitle)}</button>
        </form>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('${formId}')?.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const f=e.target,b=f.querySelector('button'),o=b.innerText;
      b.innerText='ENCRYPTING...';b.disabled=true;
      try{
        const r=await fetch('/api/submit-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
        if(r.ok){b.innerText='TRANSMISSION_SUCCESSFUL';b.style.borderColor='#00FF94';setTimeout(()=>{f.reset();b.innerText=o;b.disabled=false;},3000);}else throw 0;
      }catch{b.innerText='ERR_CONNECTION_REFUSED';b.style.borderColor='#FF00FF';setTimeout(()=>{b.innerText=o;b.disabled=false;},3000);}
    });
  </script>
</section>`;
    }
    case 'cta': {
      const heading = d.heading || 'Ready to Scale?';
      const text = d.text || "Book a strategy call.";
      const href = d.href || '#contact';
      const label = d.label || 'Start Your Moat Audit';
      return `
<section class="py-24" style="background:#050505;color:#fff;text-align:center">
  <div class="container" style="max-width:1400px;margin:0 auto;padding:0 1.5rem">
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${esc(heading)}</h2>
    <p style="color:rgba(255,255,255,.7);margin-bottom:1.5rem">${esc(text)}</p>
    <a href="${esc(href)}" class="btn-primary">${esc(label)}</a>
  </div>
</section>`;
    }
    case 'value_prop': {
      const title = d.title || '';
      const body = d.body || '';
      return `
<section class="py-24" style="background:#08080A;color:#fff">
  <div class="container mx-auto px-6"><div class="max-w-3xl">${title ? `<h2 class="text-3xl font-bold text-white mb-6">${esc(title)}</h2>` : ''}${body ? `<div class="text-white/70 prose prose-invert">${body}</div>` : ''}</div></div>
</section>`;
    }
    case 'icon_bullets': {
      const title = d.title || '';
      const bullets = d.bullets || [];
      const items = bullets.map((b) => `<div class="p-6 rounded-lg border border-white/10"><span class="text-3xl block mb-4">${b.icon || '•'}</span><h4 class="text-lg font-bold text-white mb-2">${esc(b.title || '')}</h4><p class="text-white/60 text-sm">${esc(b.text || '')}</p></div>`).join('');
      return `
<section class="py-24" style="background:#050505;color:#fff">
  <div class="container mx-auto px-6">${title ? `<h2 class="text-2xl font-bold text-center mb-12">${esc(title)}</h2>` : ''}<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">${items}</div></div>
</section>`;
    }
    case 'calculator':
      return `<section id="projects" class="py-24" style="background:#050505;color:#fff"><div class="container mx-auto px-6"><h2 class="text-3xl font-bold text-center mb-12">${esc(d.section_title || 'Engineering Resources')}</h2><div class="max-w-4xl mx-auto p-8 rounded-2xl border border-white/10"><p class="text-white/70 text-center">Calculator tools available at <a href="https://jumpstartscaling.com/resources/calculators" class="text-[#00FF94]">jumpstartscaling.com/resources/calculators</a></p></div></div></section>`;
    case 'survey':
      return `<section id="contact" class="py-24" style="background:#000;color:#fff"><div class="container mx-auto px-6"><h2 class="text-3xl font-bold text-center mb-12">${esc(d.section_title || "Let's Build It Right.")}</h2><p class="text-center text-white/70"><a href="#audit" class="text-[#00FF94] underline">Fill out the Technical Strategy form above</a> or <a href="https://jumpstartscaling.com/audit" class="text-[#00FF94] underline">take the full Moat Audit</a>.</p></div></section>`;
    case 'diagnosis': {
      const eyebrow = d.eyebrow || '';
      const title = d.title || '';
      const body = d.body || '';
      const videoSrc = d.video_src || '/assets/videos/zombiebabyzaiper.mp4';
      return `
<section id="about" class="py-24" style="background:#08080A;color:#fff">
  <div class="container mx-auto px-6"><div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">${eyebrow ? `<span class="font-mono text-xs uppercase text-[#00FF94] block mb-4">${esc(eyebrow)}</span>` : ''}<h2 class="text-4xl font-bold text-white mb-6">${esc(title)}</h2>${body ? `<p class="text-lg text-white/70 mb-8">${esc(body)}</p>` : ''}<div class="aspect-video bg-black rounded overflow-hidden"><video autoplay loop muted playsinline class="w-full h-full object-cover" src="${esc(videoSrc)}"></video></div></div></div>
</section>`;
    }
    default:
      return '';
  }
}

export function renderBlocks(blocks) {
  return (blocks || []).map((b) => renderBlock(b)).join('');
}
