// Fetch report from backend and render. Support PDF download using jsPDF + html2canvas.

const loadingBlock = document.getElementById('loading-block');
const reportContainer = document.getElementById('report-container');
const downloadBtn = document.getElementById('download-pdf');
const backHomeBtn = document.getElementById('back-home');

backHomeBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

async function fetchReport() {
  const sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    alert('No active session found. Starting from home.');
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) throw new Error(`report failed: ${res.status}`);
    const data = await res.json();
    const text = data.report || 'Failed to generate report.';
    renderMarkdownBasic(text);
  } catch (e) {
    console.error(e);
    renderMarkdownBasic('Failed to generate report.');
  } finally {
    loadingBlock.style.display = 'none';
    reportContainer.style.display = 'block';
  }
}

// Very small markdown renderer for headings and bullets (no external lib)
function renderMarkdownBasic(md) {
  const lines = md.split(/\r?\n/);
  const root = document.createElement('div');

  let currentUl = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) {
      const br = document.createElement('br');
      root.appendChild(br);
      continue;
    }

    if (line.startsWith('# ')) {
      const h1 = document.createElement('h1');
      h1.textContent = line.replace(/^#\s*/, '');
      root.appendChild(h1);
      currentUl = null;
      continue;
    }
    if (line.startsWith('## ')) {
      const h2 = document.createElement('h2');
      h2.textContent = line.replace(/^##\s*/, '');
      root.appendChild(h2);
      currentUl = null;
      continue;
    }
    if (line.startsWith('### ')) {
      const h3 = document.createElement('h3');
      h3.textContent = line.replace(/^###\s*/, '');
      root.appendChild(h3);
      currentUl = null;
      continue;
    }

    if (line.startsWith('- ')) {
      if (!currentUl) {
        currentUl = document.createElement('ul');
        root.appendChild(currentUl);
      }
      const li = document.createElement('li');
      li.textContent = line.replace(/^-+\s*/, '');
      currentUl.appendChild(li);
      continue;
    }

    currentUl = null;
    const p = document.createElement('p');
    p.textContent = line;
    root.appendChild(p);
  }

  reportContainer.innerHTML = '';
  reportContainer.appendChild(root);
}

downloadBtn.addEventListener('click', async () => {
  if (!window.jspdf || !window.html2canvas) {
    alert('PDF libraries not loaded. Please check your connection and retry.');
    return;
  }

  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Generating...';

    const { jsPDF } = window.jspdf;
    const element = reportContainer;
    const canvas = await window.html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(pdfW / imgW, pdfH / imgH);
    const renderW = imgW * ratio;
    const renderH = imgH * ratio;

    let heightLeft = renderH;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, renderW, renderH);
    heightLeft -= pdfH;

    while (heightLeft > 0) {
      position = heightLeft - renderH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, renderW, renderH);
      heightLeft -= pdfH;
    }

    const name = `Interview_Report_${new Date()
      .toISOString()
      .split('T')[0]}.pdf`;
    pdf.save(name);
  } catch (e) {
    console.error(e);
    alert('Failed to generate PDF. Please try again.');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = '📄 Download PDF';
  }
});

fetchReport();

