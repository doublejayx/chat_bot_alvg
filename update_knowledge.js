// ================================================================
//  update_knowledge.js  v3  —  append + deduplicate + auto re-embed
//
//  วิธีใช้:
//    1. ยัดข้อมูลดิบลงใน data_input_raw.txt
//    2. node update_knowledge.js
//    3. Restart server.js
// ================================================================

const fs   = require('fs');
const path = require('path');

const INPUT_FILE  = path.join(__dirname, 'data_input_raw.txt');
const OUTPUT_FILE = path.join(__dirname, 'data', 'avalant_media.txt');

// ── Section keyword map ──────────────────────────────────────────
const SECTION_KEYWORDS = [
    {
        heading: '## ข้อมูลทั่วไป',
        keywords: ['ก่อตั้ง', 'บริษัท', 'co., ltd', 'จำกัด', 'founded', 'established', 'cmmi', 'มาตรฐาน', 'ประวัติ', 'history', 'about', 'ceo'],
    },
    {
        heading: '## ที่ตั้งและติดต่อ',
        keywords: ['ที่ตั้ง', 'ที่อยู่', 'address', 'location', 'ถนน', 'อาคาร', 'ชั้น', 'เขต', 'แขวง', 'กรุงเทพ', 'โทร', 'email', 'tel', 'contact', 'office'],
    },
    {
        heading: '## ผลิตภัณฑ์และบริการ',
        keywords: ['oneweb', 'promptx', 'veda', 'product', 'ผลิตภัณฑ์', 'บริการ', 'service', 'platform', 'low-code', 'lowcode', 'แพลตฟอร์ม', 'solution', 'โซลูชัน', 'feature', 'ฟีเจอร์'],
    },
    {
        heading: '## AI และเทคโนโลยี',
        keywords: ['ai', 'artificial intelligence', 'generative', 'llm', 'rag', 'machine learning', 'automation', 'อัตโนมัติ', 'chatbot', 'watsonx', 'ollama', 'embedding', 'อัจฉริยะ'],
    },
    {
        heading: '## พาร์ทเนอร์และพันธมิตร',
        keywords: ['ibm', 'partner', 'พาร์ทเนอร์', 'พันธมิตร', 'computer union', 'cu', 'ความร่วมมือ', 'collaboration', 'integration'],
    },
    {
        heading: '## กรณีศึกษาและผลงาน',
        keywords: ['use case', 'กรณีศึกษา', 'ตัวอย่าง', 'example', 'demo', 'สาธิต', 'ลูกค้า', 'customer', 'client', 'hr', 'human resource', 'workflow'],
    },
    {
        heading: '## งานและกิจกรรม',
        keywords: ['event', 'งาน', 'สัมมนา', 'seminar', 'summit', 'conference', 'workshop', 'webinar', 'ประกาศ', 'launch', 'เปิดตัว'],
    },
];

// ── helpers ──────────────────────────────────────────────────────
function nowTH() {
    return new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

function cleanText(text) {
    return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ')
               .replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function splitParagraphs(text) {
    return text.split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p.length > 10);
}

function classifyParagraph(para) {
    const lower = para.toLowerCase();
    let best = null, bestScore = 0;
    for (const sec of SECTION_KEYWORDS) {
        const score = sec.keywords.reduce((a, kw) => a + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; best = sec.heading; }
    }
    return best || '## ข้อมูลอื่นๆ';
}

function formatParagraph(text) {
    if (text.length <= 120) return text;
    const sentences = text.split(/(?<=[.!?ๆ])\s+(?=[ก-๙A-Z"'(])/u).map(s => s.trim()).filter(s => s.length > 5);
    return sentences.length <= 1 ? text : sentences.map(s => `- ${s}`).join('\n');
}

function fingerprint(text) {
    return text.toLowerCase().replace(/\s+/g, '').slice(0, 60);
}

function loadExistingFingerprints(filePath) {
    if (!fs.existsSync(filePath)) return new Set();
    const content = fs.readFileSync(filePath, 'utf-8');
    return new Set(content.split(/\n\n+/).map(p => p.trim()).filter(Boolean).map(fingerprint));
}

function formatNew(rawText, existingFPs) {
    const paragraphs = splitParagraphs(cleanText(rawText));
    const sections   = {};
    let   newCount   = 0;

    for (const para of paragraphs) {
        const fp = fingerprint(para);
        if (existingFPs.has(fp)) continue;
        newCount++;
        const heading = classifyParagraph(para);
        if (!sections[heading]) sections[heading] = [];
        sections[heading].push(para);
    }
    return { sections, newCount };
}

function buildAppendBlock(sections, timestamp) {
    const lines = [`\n\n<!-- ===== เพิ่มข้อมูลเมื่อ: ${timestamp} ===== -->`];
    const order = [...SECTION_KEYWORDS.map(s => s.heading), '## ข้อมูลอื่นๆ'];
    for (const heading of order) {
        if (!sections[heading]) continue;
        lines.push(`\n${heading}`, '');
        for (const para of sections[heading]) { lines.push(formatParagraph(para), ''); }
    }
    return lines.join('\n');
}

// ── MAIN (async) ──────────────────────────────────────────────────
async function main() {
    console.log('\n🔄  Knowledge Updater  (append + deduplicate + re-embed)');
    console.log('─'.repeat(52));

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌  ไม่พบ: ${INPUT_FILE}\n`); process.exit(1);
    }

    const rawText   = fs.readFileSync(INPUT_FILE, 'utf-8');
    const meaningful = rawText.replace(/\/\/.*$/gm, '').replace(/ยัดข้อมูลดิบ.*/s, '').trim();

    if (meaningful.length < 30) {
        console.error(`❌  data_input_raw.txt ยังว่างอยู่!\n`); process.exit(1);
    }
    console.log(`📄  อ่านข้อมูลดิบ: ${meaningful.length} ตัวอักษร`);

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) { fs.mkdirSync(outputDir, { recursive: true }); }

    const existingFPs        = loadExistingFingerprints(OUTPUT_FILE);
    const { sections, newCount } = formatNew(meaningful, existingFPs);

    if (newCount === 0) {
        console.log(`\n✅  ไม่มีข้อมูลใหม่ — ทุกอย่างซ้ำกับที่มีอยู่แล้ว\n`);
        return;
    }

    console.log(`✨  ข้อมูลใหม่: ${newCount} paragraphs`);

    const timestamp = nowTH();
    if (!fs.existsSync(OUTPUT_FILE)) {
        fs.writeFileSync(OUTPUT_FILE, `# ฐานความรู้ Avalant\n> สร้างเมื่อ: ${timestamp}\n`, 'utf-8');
    }

    // Backup
    const ts         = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = OUTPUT_FILE.replace('.txt', `_backup_${ts}.txt`);
    fs.copyFileSync(OUTPUT_FILE, backupPath);
    console.log(`💾  Backup: data/${path.basename(backupPath)}`);

    const appendBlock = buildAppendBlock(sections, timestamp);
    fs.appendFileSync(OUTPUT_FILE, appendBlock, 'utf-8');
    console.log(`✅  อัพเดทไฟล์: ${OUTPUT_FILE} (${fs.statSync(OUTPUT_FILE).size} bytes)`);

    // ── Re-embed อัตโนมัติ ─────────────────────────────────────────
    console.log('\n🔄  Rebuilding vector store...');
    try {
        // ลบ vector store เก่าก่อนเพื่อให้ rebuild ใหม่สมบูรณ์
        const { buildVectorStore, VECTOR_DIR } = require('./knowledgebase');
        const vectorIndexPath = path.join(VECTOR_DIR, 'index.json');
        if (fs.existsSync(vectorIndexPath)) {
            fs.rmSync(VECTOR_DIR, { recursive: true, force: true });
            console.log('🗑️   ลบ vector store เก่าแล้ว');
        }
        await buildVectorStore('http://localhost:11434', 'nomic-embed-text');
        console.log('✅  Vector store อัปเดตแล้ว — restart server.js เพื่อโหลดใหม่');
    } catch (err) {
        console.warn('⚠️   Re-embed ล้มเหลว:', err.message);
        console.warn('    ตรวจสอบว่า Ollama รันอยู่ จากนั้น restart server.js');
    }
}

(async () => { await main(); })();
